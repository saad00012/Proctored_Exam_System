import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

function ExamHistory({ user }) {
  const { exams, papers, questions, attempts, students } = useApp();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [expandedExamId, setExpandedExamId] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const departments = [
    'All',
    'AI & DS Engineering',
    'Computer Science & Engineering',
    'Electrical & Computer Engineering',
    'Electronics & Telecommunication Engineering',
    'Mechanical & Mechatronics Engineering',
    'Applied Science & Engineering'
  ];

  const semesters = [
    'All',
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Semester 6',
    'Semester 7',
    'Semester 8'
  ];

  // Compute student score
  const computeScore = (attempt, paperId) => {
    const paperQs = questions.filter(q => q.paperId === paperId);
    const total = paperQs.length > 0 ? paperQs.length : (attempt.totalQuestions || 0);
    if (total === 0) return { score: 0, total: 0, percent: 0 };

    let score = 0;
    const answers = attempt.answers || {};
    paperQs.forEach(q => {
      const ans = answers[q.id];
      if (ans !== undefined && ans === q.correctOptionIndex) {
        score++;
      }
    });

    return {
      score,
      total,
      percent: Math.round((score / total) * 100)
    };
  };

  // Format date helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
             d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Format seconds to mm:ss or hh:mm
  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${s}s`;
  };

  // Group papers by Subject / Exam
  const subjectsMap = new Map();

  // Populate from papers collection
  papers.forEach(p => {
    const subjKey = p.subject || p.title || 'General Examination';
    if (!subjectsMap.has(subjKey)) {
      subjectsMap.set(subjKey, {
        subject: subjKey,
        title: p.title || subjKey,
        department: p.department || 'Unassigned',
        semester: p.semester || 'N/A',
        durationMinutes: p.durationMinutes || 45,
        scheduleStart: p.scheduleStart || '',
        scheduleEnd: p.scheduleEnd || '',
        createdAt: p.createdAt || '',
        papers: []
      });
    }
    const grp = subjectsMap.get(subjKey);
    grp.papers.push(p);
    if (!grp.scheduleStart && p.scheduleStart) grp.scheduleStart = p.scheduleStart;
    if (!grp.scheduleEnd && p.scheduleEnd) grp.scheduleEnd = p.scheduleEnd;
    if (p.department && grp.department === 'Unassigned') grp.department = p.department;
    if (p.semester && grp.semester === 'N/A') grp.semester = p.semester;
  });

  // Also match any configured exam groups from `exams` collection
  exams.forEach(ex => {
    const subjKey = ex.subject || ex.name || 'General Examination';
    if (!subjectsMap.has(subjKey)) {
      subjectsMap.set(subjKey, {
        subject: subjKey,
        title: ex.name || subjKey,
        department: ex.department || 'Unassigned',
        semester: ex.semester || 'N/A',
        durationMinutes: ex.durationMinutes || 45,
        scheduleStart: ex.scheduleStart || '',
        scheduleEnd: ex.scheduleEnd || '',
        createdAt: ex.createdAt || '',
        papers: []
      });
    } else {
      const existing = subjectsMap.get(subjKey);
      if (ex.name) existing.title = ex.name;
      if (ex.department) existing.department = ex.department;
      if (ex.semester) existing.semester = ex.semester;
      if (ex.scheduleStart) existing.scheduleStart = ex.scheduleStart;
      if (ex.scheduleEnd) existing.scheduleEnd = ex.scheduleEnd;
    }
  });

  // Aggregate stats per conducted exam (Consolidated 1 row per student)
  const conductedExams = Array.from(subjectsMap.values()).map(examGrp => {
    const paperIds = examGrp.papers.map(p => p.id);
    
    // Find all attempts associated with this exam's papers
    const examAttempts = attempts.filter(a => paperIds.includes(a.paperId));
    
    // Group attempts by studentId so each student is strictly 1 participant
    const studentAttemptsMap = new Map();
    examAttempts.forEach(att => {
      const sId = att.studentId;
      if (!studentAttemptsMap.has(sId)) {
        studentAttemptsMap.set(sId, []);
      }
      studentAttemptsMap.get(sId).push(att);
    });

    // Create 1 consolidated participant record per student
    const participants = Array.from(studentAttemptsMap.entries()).map(([studentId, studentAtts]) => {
      const studentProfile = students.find(s => s.uid === studentId);
      
      // Determine primary attempt (submitted takes top priority, then blocked, malpractice, started)
      const submittedAttempt = studentAtts.find(a => a.status === 'submitted');
      const blockedAttempt = studentAtts.find(a => a.status === 'blocked_pending_review');
      const malpracticeAttempt = studentAtts.find(a => a.status === 'malpractice_failed');
      const activeAttempt = studentAtts.find(a => a.status === 'started');
      
      const primaryAttempt = submittedAttempt || blockedAttempt || malpracticeAttempt || activeAttempt || studentAtts[0];
      const paperObj = examGrp.papers.find(p => p.id === primaryAttempt.paperId);
      const scoreObj = computeScore(primaryAttempt, primaryAttempt.paperId);

      // Consolidate all warnings across attempts for this subject
      const totalWarnings = studentAtts.reduce((sum, a) => sum + (a.warnings || 0), 0);
      
      // Check for infraction histories
      const hadMalpractice = studentAtts.some(a => a.status === 'malpractice_failed');
      const hadFocusLoss = studentAtts.some(a => a.status === 'exited_on_violation');
      const hadBlock = studentAtts.some(a => a.status === 'blocked_pending_review');
      const attemptsCount = studentAtts.length;

      // Status resolution
      let finalStatus = primaryAttempt.status;
      if (submittedAttempt) {
        finalStatus = (hadMalpractice || hadFocusLoss) ? 'submitted_reattempt' : 'submitted';
      }

      // Elapsed time total
      const totalElapsedTime = studentAtts.reduce((sum, a) => sum + (a.elapsedTime || 0), 0);

      return {
        id: `${studentId}_${examGrp.subject}`,
        studentId: studentId,
        studentName: primaryAttempt.studentName || studentProfile?.name || 'Student',
        studentEmail: primaryAttempt.studentEmail || studentProfile?.email || 'N/A',
        prnNumber: primaryAttempt.prnNumber || studentProfile?.prnNumber || 'N/A',
        department: studentProfile?.department || examGrp.department,
        semester: studentProfile?.semester || examGrp.semester,
        paperTitle: paperObj?.title || 'Set A',
        paperId: primaryAttempt.paperId,
        status: finalStatus,
        score: scoreObj.score,
        totalQuestions: scoreObj.total,
        percentage: scoreObj.percent,
        warnings: totalWarnings,
        attemptsCount: attemptsCount,
        hadMalpractice: hadMalpractice || hadFocusLoss,
        hadBlock: hadBlock,
        elapsedTime: totalElapsedTime,
        startedAt: primaryAttempt.startedAt || '',
        submittedAt: submittedAttempt?.submittedAt || primaryAttempt.submittedAt || ''
      };
    });

    const submittedCount = participants.filter(p => p.status === 'submitted' || p.status === 'submitted_reattempt').length;
    const inProgressCount = participants.filter(p => p.status === 'started').length;
    const malpracticeCount = participants.filter(p => p.status === 'malpractice_failed' || p.status === 'blocked_pending_review').length;

    const submittedScores = participants.filter(p => p.status === 'submitted' || p.status === 'submitted_reattempt').map(p => p.percentage);
    const avgScore = submittedScores.length > 0
      ? Math.round(submittedScores.reduce((a, b) => a + b, 0) / submittedScores.length)
      : 0;
    const maxScore = submittedScores.length > 0 ? Math.max(...submittedScores) : 0;
    const minScore = submittedScores.length > 0 ? Math.min(...submittedScores) : 0;

    return {
      ...examGrp,
      totalParticipants: participants.length,
      submittedCount,
      inProgressCount,
      malpracticeCount,
      avgScore,
      maxScore,
      minScore,
      participants
    };
  });

  // Filter exams
  const filteredExams = conductedExams.filter(exam => {
    const matchesDept = selectedDept === 'All' || exam.department === selectedDept;
    const matchesSem = selectedSemester === 'All' || exam.semester === selectedSemester;
    const matchesSearch = exam.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exam.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSem && matchesSearch;
  });

  // Export CSV for an exam
  const handleExportCSV = (exam) => {
    const headers = [
      'PRN',
      'Student Name',
      'Email',
      'Subject',
      'Paper Set',
      'Score',
      'Total Marks',
      'Percentage (%)',
      'Status',
      'Time Spent (Sec)',
      'Warnings Count',
      'Submitted At'
    ];

    const rows = exam.participants.map(p => [
      `"${p.prnNumber}"`,
      `"${p.studentName}"`,
      `"${p.studentEmail}"`,
      `"${exam.subject}"`,
      `"${p.paperTitle}"`,
      p.score,
      p.totalQuestions,
      `${p.percentage}%`,
      p.status,
      p.elapsedTime,
      p.warnings,
      `"${p.submittedAt ? formatDateTime(p.submittedAt) : 'N/A'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${exam.subject.replace(/[^a-zA-Z0-9]/g, '_')}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Overall metrics
  const totalConducted = conductedExams.filter(e => e.totalParticipants > 0).length;
  const totalSubmissions = attempts.filter(a => a.status === 'submitted').length;
  const totalAllParticipants = attempts.length;
  const allSubmittedPercentages = conductedExams.flatMap(e => e.participants.filter(p => p.status === 'submitted').map(p => p.percentage));
  const overallAvgScore = allSubmittedPercentages.length > 0
    ? Math.round(allSubmittedPercentages.reduce((a, b) => a + b, 0) / allSubmittedPercentages.length)
    : 0;

  return (
    <div className="fade-in" style={{ textAlign: 'left' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h2>📊 Exam History &amp; Scorecards</h2>
        <p>Comprehensive records of conducted proctored examinations, student participation, and score summaries.</p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid-cols-1-3" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="flex-between">
            <span className="stat-label">Conducted Exams</span>
            <span className="badge badge-info">Published</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--primary)' }}>{totalConducted}</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Exams with student submissions</p>
        </div>

        <div className="stat-card">
          <div className="flex-between">
            <span className="stat-label">Total Submissions</span>
            <span className="badge badge-success">Completed</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--color-success)' }}>{totalSubmissions}</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Out of {totalAllParticipants} total attempts recorded
          </p>
        </div>

        <div className="stat-card">
          <div className="flex-between">
            <span className="stat-label">Average Score</span>
            <span className="badge badge-warning">All Papers</span>
          </div>
          <div className="stat-number" style={{ color: '#d97706' }}>{overallAvgScore}%</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Across all submitted examinations</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 2, minWidth: '240px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="🔍 Search exam name, subject, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, minWidth: '180px' }}>
          <select
            className="input-field"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            {departments.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '140px' }}>
          <select
            className="input-field"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            {semesters.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Semesters' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exams List */}
      {filteredExams.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Examination Records Found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            No examinations match the selected filter criteria or no student test submissions have been recorded yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredExams.map(exam => {
            const isExpanded = expandedExamId === exam.subject;
            
            // Filter participants within expanded exam
            const filteredParticipants = exam.participants.filter(p => {
              if (!studentSearchQuery) return true;
              const q = studentSearchQuery.toLowerCase();
              return p.studentName.toLowerCase().includes(q) ||
                     p.prnNumber.toLowerCase().includes(q) ||
                     p.studentEmail.toLowerCase().includes(q) ||
                     p.status.toLowerCase().includes(q);
            });

            return (
              <div key={exam.subject} className="glass-card" style={{ padding: '1.75rem', overflow: 'hidden' }}>
                {/* Exam Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                        {exam.subject}
                      </h3>
                      {exam.papers.length > 0 && (
                        <span className="badge badge-info">{exam.papers.length} {exam.papers.length === 1 ? 'Paper Set' : 'Paper Sets'}</span>
                      )}
                      <span className="badge badge-info" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                        {exam.department}
                      </span>
                      {exam.semester !== 'N/A' && (
                        <span className="badge badge-warning" style={{ color: '#78350f', background: '#fef3c7' }}>
                          {exam.semester}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span>⏱️ <strong>Duration:</strong> {exam.durationMinutes} Mins</span>
                      {exam.scheduleStart && (
                        <span>📅 <strong>Scheduled:</strong> {formatDateTime(exam.scheduleStart)} {exam.scheduleEnd && `→ ${formatDateTime(exam.scheduleEnd)}`}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleExportCSV(exam)}
                      disabled={exam.participants.length === 0}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', gap: '0.35rem' }}
                      title="Download results as CSV"
                    >
                      📥 Export CSV
                    </button>

                    <button
                      type="button"
                      className={`btn ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setExpandedExamId(isExpanded ? null : exam.subject);
                        setStudentSearchQuery('');
                      }}
                      style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
                    >
                      {isExpanded ? '▲ Hide Scorecard' : `👁️ View Results (${exam.participants.length})`}
                    </button>
                  </div>
                </div>

                {/* Exam Key Metrics Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '1rem',
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.15)',
                  borderRadius: '10px',
                  marginBottom: isExpanded ? '1.5rem' : 0
                }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>PARTICIPANTS</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{exam.totalParticipants}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>SUBMITTED</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--color-success)' }}>{exam.submittedCount}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>IN PROGRESS</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>{exam.inProgressCount}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>MALPRACTICE</span>
                    <strong style={{ fontSize: '1.15rem', color: exam.malpracticeCount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                      {exam.malpracticeCount}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>AVG SCORE</span>
                    <strong style={{ fontSize: '1.15rem', color: '#d97706' }}>
                      {exam.submittedCount > 0 ? `${exam.avgScore}%` : '—'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>HIGHEST / LOWEST</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {exam.submittedCount > 0 ? `${exam.maxScore}% / ${exam.minScore}%` : '—'}
                    </strong>
                  </div>
                </div>

                {/* Expanded Students Scorecard Table */}
                {isExpanded && (
                  <div className="fade-in" style={{ marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        🎓 Student Attempt Details &amp; Scorecards
                      </h4>

                      <input
                        type="text"
                        className="input-field"
                        placeholder="🔍 Filter students by PRN, Name, or Status..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        style={{ maxWidth: '300px', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                      />
                    </div>

                    {filteredParticipants.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                          {exam.participants.length === 0
                            ? 'No students have started or submitted this examination yet.'
                            : 'No student attempts match your search filter.'}
                        </p>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>PRN</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Student Name</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Paper Set</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Score</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Percentage</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Status</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Time Taken</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Warnings</th>
                              <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Submitted At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredParticipants.map(student => {
                              const isPassed = student.percentage >= 40;

                              return (
                                <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 0, 0, 0.05)' }}>
                                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    {student.prnNumber}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.studentName}</div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{student.studentEmail}</div>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{student.paperTitle}</span>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                                    {(student.status === 'submitted' || student.status === 'submitted_reattempt')
                                      ? `${student.score} / ${student.totalQuestions}`
                                      : '—'}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    {(student.status === 'submitted' || student.status === 'submitted_reattempt') ? (
                                      <span style={{
                                        fontWeight: 700,
                                        color: isPassed ? 'var(--color-success)' : 'var(--color-danger)'
                                      }}>
                                        {student.percentage}%
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    {student.status === 'submitted' && (
                                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>✓ Submitted</span>
                                    )}
                                    {student.status === 'submitted_reattempt' && (
                                      <span className="badge badge-success" style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }} title="Submitted on re-attempt after focus-loss exit">
                                        ✓ Submitted (Re-attempt)
                                      </span>
                                    )}
                                    {student.status === 'started' && (
                                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>📡 In Progress</span>
                                    )}
                                    {student.status === 'blocked_pending_review' && (
                                      <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>🔒 Blocked</span>
                                    )}
                                    {student.status === 'malpractice_failed' && (
                                      <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>⚠️ Malpractice</span>
                                    )}
                                    {student.status === 'exited_on_violation' && (
                                      <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Focus Lost</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    {formatDuration(student.elapsedTime)}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    {student.hadMalpractice ? (
                                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <span className="badge badge-danger" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                                          ⚠️ {student.warnings} {student.warnings === 1 ? 'warning' : 'warnings'}
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                          (Malpractice/Exit recorded)
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{
                                        fontWeight: 600,
                                        color: student.warnings > 0 ? 'var(--color-danger)' : 'var(--text-muted)'
                                      }}>
                                        {student.warnings}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    {student.submittedAt ? formatDateTime(student.submittedAt) : 'Pending'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExamHistory;
