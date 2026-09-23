import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useApp } from './context/AppContext';
import { useRealtimeMetrics } from './hooks/useRealtimeMetrics';
import Login from './components/Login';
import PaperUpload from './components/PaperUpload';
import LiveMonitor from './components/LiveMonitor';
import StudentDirectory from './components/StudentDirectory';
import UserManagement from './components/UserManagement';
import TeacherSettings from './components/TeacherSettings';
import ExamHistory from './components/ExamHistory';
import API_BASE_URL from './config';

function App() {
  const {
    user,
    role,
    authLoading,
    allowedDomains,
    defaultDuration,
    setDefaultDuration,
    warningThreshold,
    setWarningThreshold,
    getAuthToken,
    setAttempts
  } = useApp();

  const { metrics, liveAlerts } = useRealtimeMetrics();
  const [activeTab, setActiveTab] = useState('overview');
  const [policyLoading, setPolicyLoading] = useState(false);
  const [dbActionLoading, setDbActionLoading] = useState(false);

  // Global Policies Save
  const handleSavePolicies = async (e) => {
    e.preventDefault();
    setPolicyLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          defaultDuration: parseInt(defaultDuration),
          warningThreshold: parseInt(warningThreshold)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      alert(data.message || 'Global exam policies updated successfully!');
    } catch (err) {
      alert('Failed to save policies: ' + err.message);
    } finally {
      setPolicyLoading(false);
    }
  };

  // Admin Database Maintenance
  const handleClearAllAttempts = async () => {
    if (!window.confirm('⚠️ CAUTION: Are you sure you want to clear ALL student exam attempts and violation logs from the database?\n\nThis will reset all attempt history. Question papers and registered users will NOT be deleted.')) {
      return;
    }

    setDbActionLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/database/clear-attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear attempts');
      alert(`✅ Database Cleaned:\n${data.message || 'All student exam attempts and logs have been reset.'}`);
      setAttempts([]);
    } catch (err) {
      alert('❌ Failed to clear database attempts: ' + err.message);
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleClearAllPapers = async () => {
    if (!window.confirm('⚠️ CAUTION: Are you sure you want to delete ALL question papers, exam sets, and questions from the database?\n\nThis action cannot be undone.')) {
      return;
    }

    setDbActionLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/database/clear-papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear question papers');
      alert(`✅ Database Cleaned:\n${data.message || 'All question papers have been cleared.'}`);
    } catch (err) {
      alert('❌ Failed to clear question papers: ' + err.message);
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (e) {
      console.warn('Error signing out:', e);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Proctor Console...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  const isSuperAdmin = role === 'superadmin' || role === 'admin';

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <div>
            <div className="sidebar-logo-text">DIET Proctor</div>
            <div className="sidebar-logo-sub">{isSuperAdmin ? 'Super Admin' : 'Faculty Console'}</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
          <p className="sidebar-section-label">Navigation</p>

          <div
            className={`sidebar-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="sidebar-icon">📊</span> Overview
          </div>

          <div
            className={`sidebar-link ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <span className="sidebar-icon">📡</span> Live Monitor
            {metrics.activeExams > 0 && (
              <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                {metrics.activeExams}
              </span>
            )}
          </div>

          <div
            className={`sidebar-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="sidebar-icon">📚</span> Exam History
          </div>

          <div
            className={`sidebar-link ${activeTab === 'papers' ? 'active' : ''}`}
            onClick={() => setActiveTab('papers')}
          >
            <span className="sidebar-icon">📝</span> Question Papers
          </div>

          <div
            className={`sidebar-link ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span className="sidebar-icon">👥</span> Students
          </div>

          <div
            className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="sidebar-icon">⚙️</span> Teacher Settings
          </div>

          {isSuperAdmin && (
            <>
              <p className="sidebar-section-label" style={{ marginTop: '1rem' }}>Super Admin</p>
              <div
                className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <span className="sidebar-icon">🔐</span> User Management
              </div>
              <div
                className={`sidebar-link ${activeTab === 'maintenance' ? 'active' : ''}`}
                onClick={() => setActiveTab('maintenance')}
              >
                <span className="sidebar-icon">🗄️</span> Database & Policies
              </div>
            </>
          )}
        </nav>

        {/* User Info & Logout Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'var(--primary-light)',
            borderRadius: '12px',
            padding: '0.75rem',
            border: '1px solid rgba(79,70,229,0.1)',
            marginTop: 'auto'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.85rem',
              flexShrink: 0
            }}
          >
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {user.name}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isSuperAdmin ? 'Super Admin' : 'Faculty / Teacher'}
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            title="Logout"
            style={{ padding: '0.35rem 0.6rem' }}
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600
              }}
            >
              {isSuperAdmin ? 'Super Admin Console' : 'Faculty Console'}
            </p>
            <h1
              style={{
                fontSize: '1.6rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                textTransform: 'capitalize',
                color: 'var(--text-primary)'
              }}
            >
              {activeTab === 'live'
                ? 'Live Monitor'
                : activeTab === 'papers'
                ? 'Question Papers'
                : activeTab === 'students'
                ? 'Student Directory'
                : activeTab === 'history'
                ? 'Exam History'
                : activeTab === 'settings'
                ? 'Teacher Settings'
                : activeTab === 'users'
                ? 'User Management'
                : activeTab === 'maintenance'
                ? 'Database & Policies'
                : 'Overview'}
            </h1>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            style={{ gap: '0.35rem' }}
          >
            🚪 Logout
          </button>
        </header>

        {/* Tab Views */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h2 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Welcome back, {user.name} 👋
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Real-time status of academic examination proctoring and student activity.
              </p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid-cols-4">
              <div className="stat-card">
                <div className="flex-between">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Live Exams</span>
                  <span className="badge badge-success">Live</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.5rem' }}>
                  {metrics.activeExams}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Students currently in exam
                </p>
              </div>

              <div className="stat-card">
                <div className="flex-between">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Exams</span>
                  <span className="badge badge-info">Submitted</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981', marginTop: '0.5rem' }}>
                  {metrics.submittedExams}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Total successful submissions
                </p>
              </div>

              <div className="stat-card" style={{ borderColor: metrics.malpractices > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)' }}>
                <div className="flex-between">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Flagged Malpractice</span>
                  <span className="badge badge-danger">Alerts</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: metrics.malpractices > 0 ? '#EF4444' : 'var(--text-primary)', marginTop: '0.5rem' }}>
                  {metrics.malpractices}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Blocked or failed attempts
                </p>
              </div>

              <div className="stat-card">
                <div className="flex-between">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Published Papers</span>
                  <span className="badge badge-neutral">Catalog</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7C3AED', marginTop: '0.5rem' }}>
                  {metrics.totalPapers}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Configured question sets
                </p>
              </div>
            </div>

            {/* System Status & Activity Feed */}
            <div className="grid-cols-1-2" style={{ gap: '1.5rem', alignItems: 'stretch' }}>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1.15rem' }}>
                  System Status
                </h3>
                
                <div className="flex-between" style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Backend Server</span>
                  <span className="badge badge-success">Online & Connected</span>
                </div>
                <div className="flex-between" style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Firestore Sync</span>
                  <span className="badge badge-success">Live (WebSocket)</span>
                </div>
                <div className="flex-between" style={{ padding: '0.4rem 0' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Whitelisted Domains</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end', maxWidth: '60%' }}>
                    {allowedDomains.map((d) => (
                      <span key={d} className="badge badge-info">@{d}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1.15rem' }}>
                  📡 Live Activity Feed
                </h3>

                {liveAlerts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 'auto' }}>
                    No proctoring alerts recorded yet for this session.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {liveAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.85rem',
                          background: alert.type === 'danger' ? 'var(--color-danger-bg)' : alert.type === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.studentName}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{alert.message}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'live' && <LiveMonitor user={user} />}
        {activeTab === 'history' && <ExamHistory user={user} />}
        {activeTab === 'papers' && <PaperUpload user={user} />}
        {activeTab === 'students' && <StudentDirectory />}
        {activeTab === 'settings' && <TeacherSettings user={user} />}
        {activeTab === 'users' && isSuperAdmin && <UserManagement user={user} />}

        {activeTab === 'maintenance' && isSuperAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
            <div>
              <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                Database & Policy Administration
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Configure global timeouts, warning thresholds, and clean test databases.
              </p>
            </div>

            <div className="grid-cols-1-2" style={{ alignItems: 'flex-start', gap: '1.5rem' }}>
              <div className="glass-card">
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  ⚙️ Global Exam Policies
                </h3>
                <form onSubmit={handleSavePolicies} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Default Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={defaultDuration}
                      onChange={(e) => setDefaultDuration(e.target.value)}
                      min="5"
                      max="180"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Violation Warning Threshold
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={warningThreshold}
                      onChange={(e) => setWarningThreshold(e.target.value)}
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', marginTop: '0.5rem' }} disabled={policyLoading}>
                    {policyLoading ? 'Saving...' : 'Save Global Policies'}
                  </button>
                </form>
              </div>

              <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ color: '#ef4444', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  ⚠️ Database Cleanup Actions
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Perform administrative resets of exam attempts or papers for fresh semester runs.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="btn btn-danger"
                    onClick={handleClearAllAttempts}
                    disabled={dbActionLoading}
                  >
                    🗑️ Clear All Student Attempts & Violations
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleClearAllPapers}
                    disabled={dbActionLoading}
                  >
                    🗑️ Delete All Question Papers & Sets
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
