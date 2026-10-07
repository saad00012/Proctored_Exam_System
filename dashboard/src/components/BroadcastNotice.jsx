import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useApp } from '../context/AppContext';

function BroadcastNotice() {
  const { getAuthToken } = useApp();
  const [notice, setNotice] = useState({
    active: false,
    title: '',
    message: '',
    severity: 'danger',
    targetAudience: 'all_faculty'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch current broadcast status
  useEffect(() => {
    const fetchNotice = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/broadcast-notice`);
        if (res.ok) {
          const data = await res.json();
          setNotice({
            active: Boolean(data.active),
            title: data.title || '',
            message: data.message || '',
            severity: data.severity || 'danger',
            targetAudience: data.targetAudience || 'all_faculty'
          });
          if (data.updatedAt) {
            setLastUpdated({
              time: data.updatedAt,
              by: data.updatedBy || 'Super Admin'
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load broadcast notice:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/admin/broadcast-notice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(notice)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update notice');

      alert(notice.active 
        ? '📢 Broadcast Notice published to all faculty members!' 
        : '⏹️ Broadcast Notice disabled.');
      
      setLastUpdated({
        time: new Date().toISOString(),
        by: 'You'
      });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickTemplate = (type) => {
    if (type === 'app_update') {
      setNotice({
        active: true,
        severity: 'danger',
        targetAudience: 'all_faculty',
        title: '⚠️ MANDATORY ACTION: Check Student App Versions',
        message: 'All faculty members must verify that students have updated their Dnyanshree Exam App to the latest version (v3.0). Students on older versions will not be able to start the exam. Instruct students to download the APK from: exam.dnyanshree.edu.in/download'
      });
    } else if (type === 'server_maintenance') {
      setNotice({
        active: true,
        severity: 'warning',
        targetAudience: 'all_faculty',
        title: '🔧 Scheduled Server Maintenance',
        message: 'The examination servers will undergo routine optimization today between 06:00 PM and 07:00 PM. Please conclude all pending exam sessions before this window.'
      });
    } else if (type === 'hall_ticket') {
      setNotice({
        active: true,
        severity: 'info',
        targetAudience: 'all_faculty',
        title: '📋 Verify Student PRN & Department',
        message: 'Before announcing the Room OTP, please verify each student\'s PRN and department in your Live Monitor tab to avoid incorrect set assignments.'
      });
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading broadcast notice configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      <div>
        <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          📢 Faculty Broadcast Notice System
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Send real-time alerts, critical exam announcements, or urgent instructions directly to all faculty members' dashboard headers.
        </p>
      </div>

      {/* ── Status Banner Preview ────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            👁️ Live Faculty Header Preview
          </h3>
          <span className={`badge ${notice.active ? (notice.severity === 'danger' ? 'badge-danger' : notice.severity === 'warning' ? 'badge-warning' : 'badge-info') : 'badge-neutral'}`}>
            {notice.active ? '🟢 BROADCAST ACTIVE' : '⚪ INACTIVE / HIDDEN'}
          </span>
        </div>

        {notice.active ? (
          <div style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: `1.5px solid ${
              notice.severity === 'danger' ? 'rgba(239, 68, 68, 0.5)' :
              notice.severity === 'warning' ? 'rgba(245, 158, 11, 0.5)' :
              notice.severity === 'success' ? 'rgba(16, 185, 129, 0.5)' :
              'rgba(59, 130, 246, 0.5)'
            }`,
            background: notice.severity === 'danger' ? 'rgba(239, 68, 68, 0.08)' :
              notice.severity === 'warning' ? 'rgba(245, 158, 11, 0.08)' :
              notice.severity === 'success' ? 'rgba(16, 185, 129, 0.08)' :
              'rgba(59, 130, 246, 0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>
              {notice.severity === 'danger' ? '🚨' : notice.severity === 'warning' ? '⚠️' : notice.severity === 'success' ? '✅' : '📢'}
            </span>
            <div style={{ flex: 1 }}>
              <h4 style={{
                margin: '0 0 0.35rem 0',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: notice.severity === 'danger' ? '#ef4444' :
                  notice.severity === 'warning' ? '#f59e0b' :
                  notice.severity === 'success' ? '#10b981' :
                  '#3b82f6'
              }}>
                {notice.title || 'Untitled Notice'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {notice.message || 'No notice content entered yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No notice is currently visible to faculty members. Check "Activate Broadcast Notice" below to show an alert.
            </p>
          </div>
        )}
      </div>

      {/* ── Configuration Form ──────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
            ✏️ Compose Broadcast Notice
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickTemplate('app_update')}
              title="Use App Update template"
            >
              📲 Template: App Update Alert
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickTemplate('server_maintenance')}
              title="Use Maintenance template"
            >
              🔧 Template: Maintenance
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickTemplate('hall_ticket')}
              title="Use Instructions template"
            >
              📋 Template: Exam Hall Rule
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Toggle Switch */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            background: notice.active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0,0,0,0.03)',
            border: `1.5px solid ${notice.active ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
            borderRadius: '10px'
          }}>
            <input
              type="checkbox"
              id="broadcastToggle"
              style={{ width: '1.4rem', height: '1.4rem', cursor: 'pointer' }}
              checked={notice.active}
              onChange={(e) => setNotice({ ...notice, active: e.target.checked })}
            />
            <label htmlFor="broadcastToggle" style={{ cursor: 'pointer', margin: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: notice.active ? 'var(--color-success-text)' : 'var(--text-primary)' }}>
                {notice.active ? '📢 Broadcast Notice is Active (Visible on all Teacher consoles)' : '⏹️ Broadcast Notice is Disabled (Hidden)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Toggle this to immediately show or hide the announcement banner on every teacher's screen.
              </div>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {/* Severity Level */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Notice Severity / Style
              </label>
              <select
                className="input-field"
                value={notice.severity}
                onChange={(e) => setNotice({ ...notice, severity: e.target.value })}
              >
                <option value="danger">🚨 Urgent / Action Required (Red Alert)</option>
                <option value="warning">⚠️ Warning / Attention (Amber Notice)</option>
                <option value="info">📢 General Information (Blue Announcement)</option>
                <option value="success">✅ Operational Notice (Green Status)</option>
              </select>
            </div>

            {/* Target Audience */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Target Audience
              </label>
              <select
                className="input-field"
                value={notice.targetAudience}
                onChange={(e) => setNotice({ ...notice, targetAudience: e.target.value })}
              >
                <option value="all_faculty">All Faculty & Super Admins</option>
                <option value="teachers_only">Teaching Faculty Only</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Notice Headline / Title *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. MANDATORY: Verify Student App Version Before Starting Exam"
              value={notice.title}
              onChange={(e) => setNotice({ ...notice, title: e.target.value })}
              required={notice.active}
            />
          </div>

          {/* Message Body */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Notice Content / Detailed Message *
            </label>
            <textarea
              className="input-field"
              rows="4"
              placeholder="Provide exact instructions for the teachers (e.g. instructions regarding room OTP, version download links, exam timings)..."
              value={notice.message}
              onChange={(e) => setNotice({ ...notice, message: e.target.value })}
              required={notice.active}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
              >
                {saving ? 'Publishing...' : '💾 Save & Publish Broadcast'}
              </button>

              {notice.active && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={saving}
                  onClick={() => {
                    setNotice({ ...notice, active: false });
                    setTimeout(() => handleSave(), 100);
                  }}
                >
                  🛑 Disable Notice Now
                </button>
              )}
            </div>

            {lastUpdated && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Last updated by <strong>{lastUpdated.by}</strong> at {new Date(lastUpdated.time).toLocaleString()}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default BroadcastNotice;
