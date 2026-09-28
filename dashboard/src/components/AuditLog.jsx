import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API_BASE_URL from '../config';

const AuditLog = () => {
  const { getAuthToken, students = [] } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const getStudentInfo = (studentId) => {
    if (!studentId) return { name: '-', prn: '' };
    const s = students.find((item) => item.uid === studentId || item.id === studentId);
    if (s) {
      return {
        name: s.name || (s.email ? s.email.split('@')[0] : 'Student'),
        prn: s.prnNumber && s.prnNumber !== 'N/A' ? s.prnNumber : ''
      };
    }
    return { name: studentId, prn: '' };
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/audit-logs?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch logs');
      setLogs(data.logs || []);
    } catch (err) {
      alert('Error fetching audit logs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const studentInfo = getStudentInfo(log.studentId);
    const searchLower = search.toLowerCase();
    const matchesSearch =
      (log.teacherName || '').toLowerCase().includes(searchLower) ||
      (log.studentId || '').toLowerCase().includes(searchLower) ||
      studentInfo.name.toLowerCase().includes(searchLower) ||
      studentInfo.prn.toLowerCase().includes(searchLower);
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionDetails = (action) => {
    switch (action) {
      case 'grant_override':
        return { label: '✅ Granted Access', badge: 'badge-success' };
      case 'deny_override_malpractice':
        return { label: '🚫 Denied (Malpractice)', badge: 'badge-danger' };
      case 'clear_student_logs':
        return { label: '🗑️ Cleared Logs', badge: 'badge-warning' };
      default:
        return { label: action, badge: 'badge-neutral' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      <div>
        <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          Audit Log
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review administrative actions and policy overrides.
        </p>
      </div>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search by teacher, student, or PRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="input-field"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="All">All Actions</option>
              <option value="grant_override">Granted Access</option>
              <option value="deny_override_malpractice">Denied (Malpractice)</option>
              <option value="clear_student_logs">Cleared Logs</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
            <span style={{ fontSize: '2.5rem', opacity: 0.5 }}>📋</span>
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No audit logs found matching your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Teacher</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Student</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Subject/Paper</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const { label, badge } = getActionDetails(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${badge}`}>{label}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                        {log.teacherName || log.teacherEmail || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {(() => {
                          const info = getStudentInfo(log.studentId);
                          return (
                            <div>
                              <div style={{ fontWeight: 600 }}>{info.name}</div>
                              {info.prn && (
                                <span className="badge badge-neutral" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                  PRN: {info.prn}
                                </span>
                              )}
                              {!info.prn && log.studentId && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title={log.studentId}>
                                  ID: {log.studentId.length > 12 ? `${log.studentId.substring(0, 10)}...` : log.studentId}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {log.subject || (log.paperId ? (log.paperId.length > 12 ? `${log.paperId.substring(0, 10)}...` : log.paperId) : '-')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {log.overrideMinutes ? `Override: ${log.overrideMinutes} mins` : (log.details || log.reason || '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
