import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

function StudentDirectory() {
  const { students, attempts, papers, questions } = useApp();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const paperMap = useMemo(() => {
    const map = new Map();
    papers.forEach((p) => map.set(p.id, p));
    return map;
  }, [papers]);

  const getPaperTitle = (paperId) => {
    const p = paperMap.get(paperId);
    return p ? p.title : 'Unknown Exam';
  };

  const getPaperDepartment = (paperId) => {
    const p = paperMap.get(paperId);
    return p ? p.department : '';
  };

  // Grade calculation helper
  const computeAttemptScore = (attempt) => {
    const paperQs = questions.filter((q) => q.paperId === attempt.paperId);
    if (paperQs.length === 0) return { score: 0, total: 0, percent: 0 };

    let score = 0;
    paperQs.forEach((q) => {
      if (attempt.answers && attempt.answers[q.id] === q.correctOptionIndex) {
        score++;
      }
    });
    return {
      score,
      total: paperQs.length,
      percent: Math.round((score / paperQs.length) * 100)
    };
  };

  // Summarize stats for a student
  const getStudentStats = (studentId) => {
    const studAttempts = attempts.filter((a) => a.studentId === studentId);
    const totalExams = studAttempts.length;
    const totalWarnings = studAttempts.reduce((sum, a) => sum + (a.warnings || 0), 0);

    const submittedAttempts = studAttempts.filter((a) => a.status === 'submitted');
    let avgAccuracy = 0;
    if (submittedAttempts.length > 0) {
      const totalAccuracy = submittedAttempts.reduce((sum, a) => sum + computeAttemptScore(a).percent, 0);
      avgAccuracy = Math.round(totalAccuracy / submittedAttempts.length);
    }

    return {
      totalExams,
      totalWarnings,
      avgAccuracy,
      attempts: studAttempts
    };
  };

  // Filter students list
  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return students.filter(
      (student) =>
        (student.name || '').toLowerCase().includes(query) ||
        (student.email || '').toLowerCase().includes(query) ||
        (student.prnNumber || '').toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      <div>
        <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Student Directory</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review student registrations, academic exam attempt metrics, and cumulative proctoring histories.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="🔍 Search student by name, PRN, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '360px', flex: '1 1 200px' }}
        />
      </div>

      {filteredStudents.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No registered students found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedStudent ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Table list */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>PRN</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Email Address</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'center' }}>Exams</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'center' }}>Warnings</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const stats = getStudentStats(student.id);
                  const isOffender = stats.totalWarnings >= 3;
                  return (
                    <tr
                      key={student.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: selectedStudent?.id === student.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {student.prnNumber || 'N/A'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                        {student.name}
                        {isOffender && (
                          <span className="badge badge-danger" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                            Offender
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {student.email}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: 600 }}>
                        {stats.totalExams}
                      </td>
                      <td
                        style={{
                          padding: '1rem 1.5rem',
                          textAlign: 'center',
                          fontWeight: 600,
                          color: stats.totalWarnings > 0 ? '#ef4444' : 'inherit'
                        }}
                      >
                        {stats.totalWarnings}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                          }}
                        >
                          View Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Details Side Panel */}
          {selectedStudent && (() => {
            const stats = getStudentStats(selectedStudent.id);
            const isOffender = stats.totalWarnings >= 3;
            return (
              <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{selectedStudent.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      {selectedStudent.email}
                    </p>
                    <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.35rem' }}>
                      🎓 {selectedStudent.course} • {selectedStudent.semester}{' '}
                      {selectedStudent.prnNumber && selectedStudent.prnNumber !== 'N/A' && `• PRN: ${selectedStudent.prnNumber}`}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setSelectedStudent(null)} style={{ padding: '0.4rem 0.8rem' }}>
                    ✕ Close
                  </button>
                </div>

                {isOffender && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      padding: '1rem',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 500
                    }}
                  >
                    🚨 <strong>Repeat Offender:</strong> This student has accumulated {stats.totalWarnings} warnings across their exam sessions.
                  </div>
                )}

                {/* Grid summaries */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Accuracy</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>{stats.avgAccuracy}%</p>
                  </div>
                  <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Exams</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>{stats.totalExams}</p>
                  </div>
                  <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warnings</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, color: stats.totalWarnings > 0 ? '#ef4444' : 'inherit', marginTop: '0.25rem' }}>
                      {stats.totalWarnings}
                    </p>
                  </div>
                </div>

                {/* Attempts list */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Exam Session History
                  </h4>

                  {stats.attempts.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No exam logs recorded for this student.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {[...stats.attempts].reverse().map((attempt) => {
                        const scoreDetails = computeAttemptScore(attempt);
                        const displayScore = attempt.status === 'submitted' ? `${scoreDetails.score}/${scoreDetails.total}` : 'N/A';
                        return (
                          <div
                            key={attempt.id}
                            style={{
                              padding: '1rem',
                              background: 'rgba(0,0,0,0.15)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.9rem'
                            }}
                          >
                            <div className="flex-between">
                              <span style={{ fontWeight: 600 }}>{getPaperTitle(attempt.paperId)}</span>
                              <span
                                className={`badge ${
                                  attempt.status === 'submitted'
                                    ? 'badge-success'
                                    : attempt.status === 'blocked_pending_review' || attempt.status === 'malpractice_failed'
                                    ? 'badge-danger'
                                    : 'badge-warning'
                                }`}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {attempt.status === 'blocked_pending_review'
                                  ? 'Blocked'
                                  : attempt.status === 'malpractice_failed'
                                  ? 'Failed (Malpractice)'
                                  : attempt.status}
                              </span>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                              Department: {getPaperDepartment(attempt.paperId)}
                            </p>

                            <div
                              className="flex-between"
                              style={{
                                marginTop: '0.75rem',
                                paddingTop: '0.75rem',
                                borderTop: '1px dashed var(--border-color)',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <span>
                                Score: <strong style={{ color: 'var(--text-primary)' }}>{displayScore}</strong>
                              </span>
                              <span>
                                Warnings: <strong style={{ color: attempt.warnings > 0 ? '#ef4444' : 'inherit' }}>{attempt.warnings}</strong>
                              </span>
                              <span>Duration: {Math.round(attempt.elapsedTime / 60)} mins</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default StudentDirectory;
