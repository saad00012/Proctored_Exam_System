import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db } from '../firebase';
import API_BASE_URL from '../config';

function LiveMonitor({ user, defaultDuration = 45 }) {
  const [attempts, setAttempts] = useState([]);
  const [papers, setPapers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reviewingAttempt, setReviewingAttempt] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Fetch attempts, papers, questions, and users
  useEffect(() => {
    setLoading(true);

    // Sync users list to map student profiles & PRN numbers
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uMap = {};
      snapshot.forEach((doc) => {
        uMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setUsersMap(uMap);
    }, (error) => {
      console.error("Error syncing users in LiveMonitor.jsx:", error);
    });

    // Sync papers list
    const unsubPapers = onSnapshot(collection(db, 'papers'), (snapshot) => {
      const pList = [];
      snapshot.forEach((doc) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      setPapers(pList);
    }, (error) => {
      console.error("Error syncing papers in LiveMonitor.jsx:", error);
    });

    // Sync questions list
    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      const qList = [];
      snapshot.forEach((doc) => {
        qList.push({ id: doc.id, ...doc.data() });
      });
      setQuestions(qList);
    }, (error) => {
      console.error("Error syncing questions in LiveMonitor.jsx:", error);
    });

    // Sync attempts list
    const unsubAttempts = onSnapshot(collection(db, 'exam_attempts'), (snapshot) => {
      const aList = [];
      snapshot.forEach((doc) => {
        aList.push({ id: doc.id, ...doc.data() });
      });
      setAttempts(aList);
      setLoading(false);
    }, (error) => {
      console.error("Error syncing attempts in LiveMonitor.jsx:", error);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPapers();
      unsubQuestions();
      unsubAttempts();
    };
  }, [user]);

  const handleGrantAccess = async (attempt) => {
    setLoading(true);
    const department = getPaperDepartment(attempt.paperId);

    // Find next unused published paper in pool
    const departmentPapers = papers.filter(p => p.department === department && p.status === 'published');
    const studentAttempts = attempts.filter(a => a.studentId === attempt.studentId);
    const attemptedPaperIds = studentAttempts.map(a => a.paperId);
    let unusedPaper = departmentPapers.find(p => !attemptedPaperIds.includes(p.id));
    if (!unusedPaper) {
      // Fallback: reuse the same paper if no other published paper is available
      unusedPaper = papers.find(p => p.id === attempt.paperId);
    }

    if (!unusedPaper) {
      alert(`No papers available under department "${department}" to assign for this student.`);
      setLoading(false);
      return;
    }

    try {
      let token = (user && user.token) || '';
      try {
        if (auth && auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (e) {
        console.warn("Using default token");
      }

      const res = await fetch(`${API_BASE_URL}/teacher/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: attempt.studentId,
          paperId: unusedPaper.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server returned error.");
      }

      setReviewingAttempt(null);
      alert(`Access granted successfully! Student has been unblocked with assigned paper: "${data.newPaperTitle || unusedPaper.title}".`);
    } catch (err) {
      console.error("Failed to grant access:", err);
      alert("Failed to grant access: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDenyMalpractice = async (attempt) => {
    if (!window.confirm(`Are you sure you want to permanently mark ${attempt.studentName}'s attempt as a malpractice failure?`)) {
      return;
    }

    setLoading(true);

    try {
      let token = (user && user.token) || '';
      try {
        if (auth && auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (e) {
        console.warn("Using default token");
      }

      const res = await fetch(`${API_BASE_URL}/teacher/deny`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: attempt.studentId,
          paperId: attempt.paperId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server returned error.");
      }

      setReviewingAttempt(null);
      alert("Malpractice confirmed. Session permanently closed.");
    } catch (err) {
      console.error("Failed to deny override:", err);
      alert("Failed to confirm malpractice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearStudentLogs = async (studentId, paperId) => {
    if (!window.confirm("Are you sure you want to completely clear the exam logs and reset the attempt status for this student? This will delete all their attempts and violations for this subject, allowing them to attempt the exam again from the beginning.")) {
      return;
    }

    setLoading(true);

    try {
      let token = (user && user.token) || '';
      try {
        if (auth && auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (e) {
        console.warn("Using default token");
      }

      const res = await fetch(`${API_BASE_URL}/teacher/clear-student-attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId,
          paperId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server returned error.");
      }

      alert("Student logs and attempts cleared successfully! The student can now restart the exam.");
    } catch (err) {
      console.error("Failed to clear student logs:", err);
      alert("Failed to clear student logs: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const groupedStudents = getFilteredGroupedStudents();
    if (groupedStudents.length === 0) {
      alert("No student attempts available to export.");
      return;
    }

    const headers = ["PRN Number", "Student Name", "Department", "Semester", "Paper Title", "Warnings", "Status", "Score", "Date"];
    const rows = groupedStudents.map(student => {
      // Sort attempts ascending (Attempt 1, Attempt 2...) to build historical paper title list
      const sortedAttempts = [...student.attempts].sort((a, b) => {
        const timeA = parseTimestampToMs(a.submittedAt || a.startedAt);
        const timeB = parseTimestampToMs(b.submittedAt || b.startedAt);
        return timeA - timeB;
      });

      const latestAttempt = student.latestAttempt;
      const latestDept = student.department || getPaperDepartment(latestAttempt.paperId);

      const paperTitles = sortedAttempts.map(a => getPaperTitle(a.paperId));
      const paperTitlesStr = paperTitles.join(", ");

      const statusStr = latestAttempt.status.toUpperCase();

      let scoreStr = 'N/A';
      if (latestAttempt.status === 'submitted') {
        const stats = computeGradeDetails(latestAttempt);
        scoreStr = `${stats.score} of ${stats.total}`; // Using "of" format to prevent Excel date auto-conversion
      }

      const latestDateStr = latestAttempt.submittedAt || latestAttempt.startedAt;
      const dateStr = latestDateStr ? new Date(latestDateStr).toLocaleString().replace(/,/g, '') : 'N/A';

      return [
        `"${(student.prnNumber || 'N/A').replace(/"/g, '""')}"`,
        `"${student.studentName.replace(/"/g, '""')}"`,
        `"${latestDept.replace(/"/g, '""')}"`,
        `"${(student.semester || 'N/A').replace(/"/g, '""')}"`,
        `"${paperTitlesStr.replace(/"/g, '""')}"`,
        student.totalWarnings,
        `"${statusStr}"`,
        `"${scoreStr}"`,
        `"${dateStr}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Proctored_Exam_Results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaperTitle = (paperId) => {
    const paper = papers.find(p => p.id === paperId);
    return paper ? paper.title : 'Unknown Exam';
  };

  const getPaperDepartment = (paperId) => {
    const paper = papers.find(p => p.id === paperId);
    return paper ? paper.department : '';
  };

  const parseTimestampToMs = (val) => {
    if (!val) return 0;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val.seconds !== undefined) return val.seconds * 1000;
    const time = new Date(val).getTime();
    return isNaN(time) ? 0 : time;
  };

  // Compute grade details for a specific attempt
  const computeGradeDetails = (attempt) => {
    const paperQs = questions.filter(q => q.paperId === attempt.paperId);
    if (paperQs.length === 0) return { score: 0, total: 0, details: [] };

    let score = 0;
    const answers = attempt.answers || {};
    const details = paperQs.map(q => {
      const studentAns = answers[q.id];
      const isCorrect = studentAns !== undefined && studentAns === q.correctOptionIndex;
      if (isCorrect) score++;

      return {
        questionId: q.id,
        questionText: q.questionText,
        questionImageUrl: q.questionImageUrl,
        options: q.options,
        studentAnswerIdx: studentAns,
        correctAnswerIdx: q.correctOptionIndex,
        isCorrect
      };
    });

    return {
      score,
      total: paperQs.length,
      details
    };
  };

  // Group and Filter student attempts dynamically with user profile resolution
  const getFilteredGroupedStudents = () => {
    const groups = {};
    attempts.forEach(attempt => {
      const studentKey = attempt.studentId || attempt.studentName;
      if (!groups[studentKey]) {
        groups[studentKey] = {
          studentId: attempt.studentId || studentKey,
          studentName: attempt.studentName,
          attempts: []
        };
      }
      groups[studentKey].attempts.push(attempt);
    });

    const studentSummaries = Object.values(groups).map(group => {
      // Sort attempts descending by submission or activity date
      const sortedAttempts = [...group.attempts].sort((a, b) => {
        const timeA = parseTimestampToMs(a.submittedAt || a.startedAt);
        const timeB = parseTimestampToMs(b.submittedAt || b.startedAt);
        return timeB - timeA;
      });
      
      const latestAttempt = sortedAttempts[0];
      const userProfile = usersMap[group.studentId] || {};
      
      // Resolve student real name (avoid generic "Student")
      const resolvedName = (userProfile.name && userProfile.name !== 'Student')
        ? userProfile.name
        : (latestAttempt.studentName && latestAttempt.studentName !== 'Student')
          ? latestAttempt.studentName
          : (group.studentName && group.studentName !== 'Student')
            ? group.studentName
            : (userProfile.email ? userProfile.email.split('@')[0] : (latestAttempt.studentEmail ? latestAttempt.studentEmail.split('@')[0] : 'Student'));

      const prnNumber = latestAttempt.prnNumber || userProfile.prnNumber || 'N/A';
      const department = userProfile.department || latestAttempt.department || getPaperDepartment(latestAttempt.paperId) || 'Unassigned';
      const semester = userProfile.semester || latestAttempt.semester || 'N/A';

      const latestDepartment = getPaperDepartment(latestAttempt.paperId);
      const totalWarnings = group.attempts
        .filter(a => getPaperDepartment(a.paperId) === latestDepartment)
        .reduce((sum, a) => sum + (a.warnings || 0), 0);
      
      return {
        studentId: group.studentId,
        studentName: resolvedName,
        prnNumber,
        department,
        semester,
        email: userProfile.email || latestAttempt.studentEmail || '',
        latestAttempt,
        totalWarnings,
        attempts: sortedAttempts
      };
    });

    return studentSummaries.filter(student => {
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const matchesName = student.studentName.toLowerCase().includes(queryLower);
        const matchesPrn = (student.prnNumber || '').toLowerCase().includes(queryLower);
        const matchesEmail = (student.email || '').toLowerCase().includes(queryLower);
        if (!matchesName && !matchesPrn && !matchesEmail) {
          return false;
        }
      }
      
      const latestDepartment = getPaperDepartment(student.latestAttempt.paperId);
      if (selectedDepartment !== 'All' && latestDepartment !== selectedDepartment && student.department !== selectedDepartment) {
        return false;
      }

      if (selectedStatus !== 'All') {
        const status = student.latestAttempt.status;
        if (selectedStatus === 'submitted' && status !== 'submitted') return false;
        if (selectedStatus === 'blocked' && status !== 'blocked_pending_review') return false;
        if (selectedStatus === 'failed' && status !== 'malpractice_failed') return false;
        if (selectedStatus === 'in_progress' && status !== 'started' && status !== 'exited_on_violation') return false;
      }

      return true;
    });
  };

  const availableDepartments = ['All', ...new Set(papers.map(p => p.department).filter(Boolean))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
      
      {!selectedAttempt ? (
        <div>
          <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'flex-start' }}>
            <div>
              <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Proctored Exam Monitoring</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Track active student attempts, review warning logs generated by screen exit telemetry, and grade submitted papers.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              📥 Export Results (CSV)
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="🔍 Search student by name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '300px', flex: '1 1 200px' }}
            />
            <select 
              className="input-field" 
              value={selectedDepartment} 
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{ maxWidth: '200px' }}
            >
              {availableDepartments.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <select 
              className="input-field" 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ maxWidth: '200px' }}
            >
              <option value="All">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="blocked">Blocked</option>
              <option value="failed">Malpractice Fail</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {loading ? (
            <p>Loading session logs...</p>
          ) : attempts.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No student attempts found in database yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {getFilteredGroupedStudents().map((student) => {
                const isExpanded = expandedStudentId === student.studentId;
                const isLatestFlagged = student.latestAttempt.warnings > 0 || student.latestAttempt.status === 'blocked_pending_review' || student.latestAttempt.status === 'malpractice_failed';
                
                return (
                  <div 
                    key={student.studentId} 
                    className="glass-card" 
                    style={{ 
                      padding: '1.25rem 1.5rem',
                      border: isLatestFlagged ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                      background: isLatestFlagged ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Collapsed view toggle row */}
                    <div 
                      className="flex-between" 
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedStudentId(isExpanded ? null : student.studentId)}
                    >
                      <div>
                        <div className="flex-row" style={{ marginBottom: '0.4rem', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {student.latestAttempt.status === 'started' && (
                            <span className="live-pulse-dot" title="Student is currently active inside exam" style={{ marginRight: '0.25rem' }} />
                          )}
                          <h4 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{student.studentName}</h4>
                          {student.prnNumber && student.prnNumber !== 'N/A' && (
                            <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.75rem', fontWeight: 600 }}>
                              PRN: {student.prnNumber}
                            </span>
                          )}
                          <span className={`badge ${
                            student.latestAttempt.status === 'submitted' ? 'badge-success' : 
                            student.latestAttempt.status === 'blocked_pending_review' ? 'badge-danger' : 
                            student.latestAttempt.status === 'malpractice_failed' ? 'badge-danger' : 
                            student.latestAttempt.status === 'started' ? 'badge-success' : 'badge-warning'
                          }`}>
                            {student.latestAttempt.status === 'blocked_pending_review' ? 'Blocked' :
                             student.latestAttempt.status === 'malpractice_failed' ? 'Malpractice Fail' :
                             student.latestAttempt.status === 'started' ? 'Active' :
                             student.latestAttempt.status === 'terminated_reassigned' ? 'Reassigned' :
                             student.latestAttempt.status === 'exited_on_violation' ? 'Violation Locked Out' :
                             student.latestAttempt.status}
                          </span>

                          {student.latestAttempt.status === 'started' && (() => {
                            const lastBeatMs = parseTimestampToMs(student.latestAttempt.lastHeartbeatAt);
                            const isBeatStale = lastBeatMs > 0 && (Date.now() - lastBeatMs) > 35000;
                            const pendingCount = student.latestAttempt.pendingSyncCount || 0;
                            const latency = student.latestAttempt.latencyMs;

                            if (isBeatStale) {
                              return (
                                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', fontWeight: 600 }}>
                                  📡 Network Lost ({Math.round((Date.now() - lastBeatMs) / 1000)}s)
                                </span>
                              );
                            }
                            if (pendingCount > 0) {
                              return (
                                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.75rem', fontWeight: 600 }}>
                                  ☁️ {pendingCount} syncing
                                </span>
                              );
                            }
                            if (latency !== undefined && latency > 0) {
                              return (
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', fontWeight: 600 }}>
                                  📶 {latency}ms
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          Latest Exam: <strong>{getPaperTitle(student.latestAttempt.paperId)}</strong> ({student.department || getPaperDepartment(student.latestAttempt.paperId)})
                          {student.semester && student.semester !== 'N/A' && <span> • Sem: {student.semester}</span>}
                        </p>
                      </div>

                      <div className="flex-row" style={{ alignItems: 'center' }}>
                        <div className="warning-dot-container" style={{ marginRight: '0.5rem' }} title={`Warnings tally: ${student.totalWarnings} of 3`}>
                          <span className={`warning-dot ${student.totalWarnings >= 1 ? 'active' : 'inactive'}`} />
                          <span className={`warning-dot ${student.totalWarnings >= 2 ? 'active' : 'inactive'}`} />
                          <span className={`warning-dot ${student.totalWarnings >= 3 ? 'active' : 'inactive'}`} />
                        </div>
                        {student.totalWarnings > 0 ? (
                          <span className={`badge ${isLatestFlagged ? 'badge-danger' : 'badge-warning'}`}>
                            ⚠️ {student.totalWarnings} Warnings
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            🛡️ Secure
                          </span>
                        )}
                        <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Expandable Session Log History */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '1.5rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        <div className="flex-between" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                            Timeline History ({student.attempts.length} Attempts)
                          </h5>
                          <button
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.35rem 0.75rem', 
                              fontSize: '0.75rem', 
                              borderColor: 'rgba(239, 68, 68, 0.4)', 
                              color: '#fca5a5',
                              background: 'rgba(239, 68, 68, 0.05)'
                            }}
                            onClick={() => handleClearStudentLogs(student.studentId, student.latestAttempt.paperId)}
                            disabled={loading}
                          >
                            🧹 Clear Logs / Reset Exam
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {student.attempts.map((attempt, index) => {
                            const aIdx = student.attempts.length - index;
                            return (
                              <div key={attempt.id} className="flex-between" style={{
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.15)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)'
                              }}>
                                <div>
                                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                                    Attempt #{aIdx}: {getPaperTitle(attempt.paperId)}
                                  </p>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Warnings: <strong style={{ color: attempt.warnings > 0 ? '#ef4444' : 'inherit' }}>{attempt.warnings}</strong> | 
                                    Elapsed Time: {Math.round(attempt.elapsedTime / 60)} mins | 
                                    Status: <span style={{ fontWeight: 500 }}>{attempt.status}</span>
                                  </p>
                                </div>

                                <div>
                                  {attempt.status === 'submitted' ? (
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => setSelectedAttempt(attempt)}
                                    >
                                      Grade Answers
                                    </button>
                                  ) : attempt.status === 'blocked_pending_review' ? (
                                    <button 
                                      className="btn btn-danger pulse-primary" 
                                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => setReviewingAttempt(attempt)}
                                    >
                                      Review Blocked
                                    </button>
                                  ) : attempt.status === 'malpractice_failed' ? (
                                    <span className="badge badge-danger" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                      Malpractice Fail
                                    </span>
                                  ) : attempt.status === 'terminated_reassigned' ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                      Terminated & Reassigned
                                    </span>
                                  ) : attempt.status === 'exited_on_violation' ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                      Violation Locked Out
                                    </span>
                                  ) : (
                                    <span className="badge badge-info" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                      In Progress
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        
        /* Detailed Grading & Answer Comparison View */
        <div>
          <div className="flex-between" style={{ marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedAttempt(null)}>
              ⬅️ Back to Logs List
            </button>
            <div className="flex-row">
              <span className="badge badge-info" style={{ fontSize: '0.9rem' }}>
                Student: {selectedAttempt.studentName}
              </span>
            </div>
          </div>

          {/* Grading Stats Summary */}
          {(() => {
            const stats = computeGradeDetails(selectedAttempt);
            const scorePercent = stats.total > 0 ? ((stats.score / stats.total) * 100).toFixed(0) : 0;
            const activeDepartment = getPaperDepartment(selectedAttempt.paperId);
            const allStudentAttempts = attempts.filter(a => a.studentId === selectedAttempt.studentId && getPaperDepartment(a.paperId) === activeDepartment);
            const totalWarnings = allStudentAttempts.reduce((sum, a) => sum + (a.warnings || 0), 0);
            
            return (
              <div>
                <div className="grid-cols-1-3" style={{ marginBottom: '2rem' }}>
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Calculated Score</h3>
                    <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--primary)' }}>
                      {stats.score} / {stats.total}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Accuracy: {scorePercent}%
                    </p>
                  </div>

                  <div className="glass-card" style={{ 
                    borderColor: totalWarnings > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'
                  }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Proctoring Telemetry</h3>
                    <p style={{ 
                      fontSize: '2.5rem', 
                      fontWeight: 700, 
                      marginTop: '0.5rem',
                      color: totalWarnings > 0 ? '#ef4444' : '#10b981'
                    }}>
                      {totalWarnings} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Warnings (Session Total)</span>
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {totalWarnings > 0 ? `⚠️ App focus lost ${totalWarnings} times during this session.` : '🛡️ No security violations across all attempts.'}
                    </p>
                  </div>

                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Session Result</h3>
                    <p style={{ 
                      fontSize: '2.2rem', 
                      fontWeight: 700, 
                      marginTop: '0.8rem',
                      color: selectedAttempt.status === 'malpractice_failed' ? '#ef4444' : '#10b981'
                    }}>
                      {selectedAttempt.status === 'malpractice_failed' ? 'MALPRACTICE FAIL' : 'PASSED'}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Final grading decision
                    </p>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Question-by-Question Answers Comparison
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {stats.details.map((item, idx) => (
                    <div 
                      key={item.questionId} 
                      className="glass-card" 
                      style={{ 
                        borderLeft: item.isCorrect ? '4px solid #10b981' : '4px solid #ef4444',
                        padding: '1.5rem'
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '1rem' }}>
                        <span className="badge badge-info">Question {idx + 1}</span>
                        <span className={`badge ${item.isCorrect ? 'badge-success' : 'badge-danger'}`}>
                          {item.isCorrect ? 'Correct (+1 Mark)' : 'Incorrect'}
                        </span>
                      </div>

                      <p style={{ fontWeight: 500, fontSize: '1.1rem', marginBottom: '1rem' }}>
                        {item.questionText}
                      </p>

                      {item.questionImageUrl && (
                        <img 
                          src={item.questionImageUrl} 
                          alt="Question Diagram" 
                          style={{ 
                            maxHeight: '200px', 
                            borderRadius: '8px', 
                            marginBottom: '1rem', 
                            border: '1px solid var(--border-color)',
                            display: 'block'
                          }} 
                        />
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                        {item.options.map((opt, oIdx) => {
                          const isStudentSelected = item.studentAnswerIdx === oIdx;
                          const isCorrectChoice = item.correctAnswerIdx === oIdx;
                          
                          let bgStyle = 'rgba(0, 0, 0, 0.15)';
                          let borderStyle = '1px solid var(--border-color)';
                          
                          if (isCorrectChoice) {
                            bgStyle = 'rgba(16, 185, 129, 0.15)';
                            borderStyle = '1px solid #10b981';
                          } else if (isStudentSelected && !isCorrectChoice) {
                            bgStyle = 'rgba(239, 68, 68, 0.1)';
                            borderStyle = '1px solid #ef4444';
                          }

                          return (
                            <div 
                              key={oIdx} 
                              style={{ 
                                padding: '0.75rem 1rem', 
                                background: bgStyle,
                                border: borderStyle,
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                  <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt.text}
                                </span>
                                
                                {isCorrectChoice && <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Correct</span>}
                                {isStudentSelected && !isCorrectChoice && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✗ Selected</span>}
                                {isStudentSelected && isCorrectChoice && <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Selected</span>}
                              </div>
                              
                              {opt.imageUrl && (
                                <img src={opt.imageUrl} alt="" style={{ display: 'block', maxHeight: '40px', marginTop: '0.4rem', borderRadius: '4px' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {reviewingAttempt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Review Blocked Student
            </h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.25rem' }}>
              <strong>Student Name:</strong> {reviewingAttempt.studentName}<br/>
              <strong>Department:</strong> {getPaperDepartment(reviewingAttempt.paperId)}<br/>
              <strong>Compromised Paper:</strong> {getPaperTitle(reviewingAttempt.paperId)}<br/>
              <strong>Warnings Tally:</strong> {reviewingAttempt.warnings} (Threshold exceeded)
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem', borderRadius: '8px', fontSize: '0.85rem', color: '#fca5a5', marginBottom: '1.5rem' }}>
              ⚠️ Student was hard-blocked from their exam session due to multiple app-switching / minimize violations.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setReviewingAttempt(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDenyMalpractice(reviewingAttempt)}
                disabled={loading}
              >
                🚫 Deny Access (Disqualify)
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleGrantAccess(reviewingAttempt)}
                disabled={loading}
              >
                {loading ? 'Processing...' : '✅ Grant Access (Unblock)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveMonitor;
