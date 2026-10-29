import React, { useState, useEffect } from 'react';
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
import DepartmentManagement from './components/DepartmentManagement';
import AuditLog from './components/AuditLog';
import QuestionBank from './components/QuestionBank';
import HelpCenter from './components/HelpCenter';
import AppDownload from './components/AppDownload';
import BroadcastNotice from './components/BroadcastNotice';
import API_BASE_URL from './config';
import { parseApiResponse } from './utils/api';

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
    setAttempts,
    isLiveSyncActive,
    isIdlePaused,
    pauseReason,
    resumeLiveSync,
    toggleLiveSync,
    refreshAllStaticData,
    maintenanceConfig
  } = useApp();

  const { metrics, liveAlerts } = useRealtimeMetrics();
  const [activeTab, setActiveTab] = useState('overview');
  const [policyLoading, setPolicyLoading] = useState(false);
  const [dbActionLoading, setDbActionLoading] = useState(false);

  // Path detection for public /download or /apps portal
  const [currentPath, setCurrentPath] = useState(window.location.pathname.toLowerCase());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // App Update Policy State
  const [appVersionLoading, setAppVersionLoading] = useState(false);
  const [appVersionConfig, setAppVersionConfig] = useState({
    minRequiredVersionCode: 1,
    latestVersionCode: 1,
    latestVersionName: '1.0',
    apkDownloadUrl: '',
    releaseNotes: '',
    forceUpdate: false
  });

  // Live Broadcast Notice State (visible to faculty & admins)
  const [broadcastNotice, setBroadcastNotice] = useState(null);
  const [acknowledgedNoticeId, setAcknowledgedNoticeId] = useState(() => {
    return localStorage.getItem('ack_broadcast_notice_id') || '';
  });

  // Load broadcast notice on mount and poll every 15s for urgent broadcasts
  useEffect(() => {
    const fetchBroadcastNotice = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/broadcast-notice`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.active && data.title) {
            setBroadcastNotice(data);
          } else {
            setBroadcastNotice(null);
          }
        }
      } catch (err) {
        console.warn('Could not fetch broadcast notice:', err.message);
      }
    };
    fetchBroadcastNotice();
    const interval = setInterval(fetchBroadcastNotice, 300000); // 5 min interval to protect API rate limit
    return () => clearInterval(interval);
  }, []);

  // Load app_version settings on mount
  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/app-version`);
        if (res.ok) {
          const data = await res.json();
          setAppVersionConfig({
            minRequiredVersionCode: data.minRequiredVersionCode ?? 1,
            latestVersionCode: data.latestVersionCode ?? 1,
            latestVersionName: data.latestVersionName || '1.0',
            apkDownloadUrl: data.apkDownloadUrl || '',
            releaseNotes: data.releaseNotes || '',
            forceUpdate: Boolean(data.forceUpdate)
          });
        }
      } catch (err) {
        console.warn('Could not load app version config:', err.message);
      }
    };
    fetchAppVersion();
  }, []);

  const handleSaveAppVersion = async (e) => {
    e.preventDefault();
    setAppVersionLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/app-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(appVersionConfig)
      });
      const data = await parseApiResponse(response);
      alert(data.message || 'App update policy saved successfully!');
    } catch (err) {
      alert('Failed to save app update policy: ' + err.message);
    } finally {
      setAppVersionLoading(false);
    }
  };

  // ── Role-Based System Maintenance Mode State & Handlers ──────────────
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintForm, setMaintForm] = useState({
    enabled: false,
    message: 'System upgrade in progress. Regular services will resume shortly.',
    estimatedEndTime: ''
  });

  useEffect(() => {
    if (maintenanceConfig) {
      setMaintForm({
        enabled: Boolean(maintenanceConfig.enabled),
        message: maintenanceConfig.message || 'System upgrade in progress. Regular services will resume shortly.',
        estimatedEndTime: maintenanceConfig.estimatedEndTime || ''
      });
    }
  }, [maintenanceConfig]);

  const handleSaveMaintenanceSettings = async (e, overrideEnabled) => {
    if (e && e.preventDefault) e.preventDefault();
    setMaintenanceLoading(true);
    try {
      const isActivating = overrideEnabled !== undefined ? overrideEnabled : maintForm.enabled;
      const token = await getAuthToken();
      const payload = {
        enabled: isActivating,
        message: maintForm.message,
        estimatedEndTime: maintForm.estimatedEndTime
      };
      const response = await fetch(`${API_BASE_URL}/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);
      setMaintForm(payload);
      alert(data.message || 'Maintenance settings updated!');
    } catch (err) {
      alert('Failed to update maintenance settings: ' + err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

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
      const data = await parseApiResponse(response);
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
      const data = await parseApiResponse(response);
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
      const data = await parseApiResponse(response);
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

  // Public download routes — no login required
  const isDownloadRoute = 
    currentPath.startsWith('/download') ||
    currentPath.startsWith('/apps') ||
    currentPath === '/app' ||
    currentPath === '/apk' ||
    window.location.hash === '#download';

  if (isDownloadRoute) {
    return <AppDownload />;
  }

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

  const isSuperAdmin = role === 'superadmin' || 
                       role === 'admin' || 
                       user?.email?.toLowerCase().includes('admin') || 
                       user?.email === 'yash.chiplunkar@dnyanshree.edu.in';

  // Role-Based Maintenance Gate: Non-admin users see full maintenance screen
  if (maintenanceConfig?.enabled && !isSuperAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-main, #0f172a)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '18px',
          maxWidth: '560px',
          width: '100%',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛠️</div>
          <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            SCHEDULED SYSTEM MAINTENANCE
          </span>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', margin: '0.5rem 0 1rem' }}>
            Exam Console Temporarily Locked
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {maintenanceConfig.message || 'The examination system is currently undergoing scheduled maintenance and updates. Regular faculty and student services will resume shortly.'}
          </p>
          {maintenanceConfig.estimatedEndTime && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#f59e0b',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.5rem'
            }}>
              ⏱️ Expected Completion: {maintenanceConfig.estimatedEndTime}
            </div>
          )}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Faculty & student console actions are paused. Only Super Admins have active system access.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button onClick={() => window.location.reload()} className="btn btn-secondary" style={{ padding: '0.55rem 1.3rem', fontSize: '0.85rem' }}>
              🔄 Check Status
            </button>
            <button onClick={handleLogout} className="btn" style={{ padding: '0.55rem 1.3rem', fontSize: '0.85rem', background: 'transparent', color: 'var(--text-muted)' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="sidebar-section-label">Monitor & Insights</p>

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
                <span className="live-pulse-dot" style={{ width: '5px', height: '5px', marginRight: '3px' }}></span>
                {metrics.activeExams} Active
              </span>
            )}
          </div>

          <div
            className={`sidebar-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="sidebar-icon">📚</span> Exam History
          </div>

          <p className="sidebar-section-label" style={{ marginTop: '0.85rem' }}>Exams & Question Bank</p>

          <div
            className={`sidebar-link ${activeTab === 'papers' ? 'active' : ''}`}
            onClick={() => setActiveTab('papers')}
          >
            <span className="sidebar-icon">📝</span> Question Papers
          </div>

          <div
            className={`sidebar-link ${activeTab === 'questionbank' ? 'active' : ''}`}
            onClick={() => setActiveTab('questionbank')}
          >
            <span className="sidebar-icon">📖</span> Question Bank
          </div>

          <p className="sidebar-section-label" style={{ marginTop: '0.85rem' }}>Students & Faculty</p>

          <div
            className={`sidebar-link ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span className="sidebar-icon">👥</span> Students Directory
          </div>

          {!isSuperAdmin && (
            <div
              className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <span className="sidebar-icon">🎓</span> Manage Students
            </div>
          )}

          <div
            className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="sidebar-icon">⚙️</span> Faculty Settings
          </div>

          <div
            className={`sidebar-link ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => setActiveTab('download')}
          >
            <span className="sidebar-icon">📲</span> Download App
          </div>

          <div
            className={`sidebar-link ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            <span className="sidebar-icon">❓</span> Help & Support
          </div>

          {isSuperAdmin && (
            <>
              <p className="sidebar-section-label" style={{ marginTop: '0.85rem' }}>Super Admin Suite</p>
              <div
                className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <span className="sidebar-icon">🔐</span> User Management
              </div>
              <div
                className={`sidebar-link ${activeTab === 'auditlog' ? 'active' : ''}`}
                onClick={() => setActiveTab('auditlog')}
              >
                <span className="sidebar-icon">📋</span> Audit Log
              </div>
              <div
                className={`sidebar-link ${activeTab === 'broadcast' ? 'active' : ''}`}
                onClick={() => setActiveTab('broadcast')}
              >
                <span className="sidebar-icon">📢</span> Broadcast Notice
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
        {/* Super Admin Maintenance Mode Active Banner */}
        {maintenanceConfig?.enabled && isSuperAdmin && (
          <div style={{
            background: 'linear-gradient(90deg, #b45309, #d97706)',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🛠️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                  SYSTEM MAINTENANCE MODE ACTIVE
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  Faculty &amp; Student access is locked. You have unrestricted Admin bypass access.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setActiveTab('maintenance')}
                style={{
                  background: '#ffffff',
                  color: '#b45309',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                ⚙️ Maintenance Settings
              </button>
              <button
                onClick={() => handleSaveMaintenanceSettings(null, false)}
                disabled={maintenanceLoading}
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {maintenanceLoading ? '...' : '🟢 Deactivate Now'}
              </button>
            </div>
          </div>
        )}
        <header className="dashboard-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span className={`badge ${isSuperAdmin ? 'badge-primary' : 'badge-info'}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isSuperAdmin ? '🛡️ Super Admin Console' : '🎓 Faculty Console'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)'
              }}
            >
              {activeTab === 'live'
                ? '📡 Live Proctoring Monitor'
                : activeTab === 'papers'
                ? '📝 Question Papers & Sets'
                : activeTab === 'students'
                ? '👥 Student Directory'
                : activeTab === 'history'
                ? '📚 Exam History & Results'
                : activeTab === 'settings'
                ? '⚙️ Faculty Teaching Settings'
                : activeTab === 'users'
                ? (isSuperAdmin ? '🔐 User Management' : '🎓 Department Student Management')
                : activeTab === 'auditlog'
                ? '📋 Security & Audit Trail'
                : activeTab === 'broadcast'
                ? '📢 Faculty Broadcast Notice'
                : activeTab === 'questionbank'
                ? '📖 Central Question Bank'
                : activeTab === 'download'
                ? '📲 Student App Download Portal'
                : activeTab === 'help'
                ? '❓ Help & Support Center'
                : activeTab === 'maintenance'
                ? '🗄️ Database & Policy Administration'
                : '📊 Examination Overview'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Live Sync Status & Sleep Mode Toggle */}
            {isLiveSyncActive ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={toggleLiveSync}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '0.35rem 0.75rem',
                  cursor: 'pointer'
                }}
                title="Live Sync Active: Real-time Firestore streaming enabled. Click to pause."
              >
                <span className="live-pulse-dot" style={{ width: '7px', height: '7px' }}></span>
                Live Sync: ON
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={resumeLiveSync}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '0.35rem 0.75rem',
                  cursor: 'pointer'
                }}
                title="Live Sync Paused to save Firestore reads. Click to resume real-time updates."
              >
                <span>⏸️</span> Live Sync: PAUSED
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
              style={{ gap: '0.45rem', fontWeight: 600 }}
              title="Sign out of proctor portal"
            >
              <span>🚪</span> Sign Out
            </button>
          </div>
        </header>

        {/* ── Auto-Pause Inactivity / Sleep Mode Banner ────────────────────── */}
        {isIdlePaused && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '10px',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⏸️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#b45309' }}>
                  Live Sync Paused ({pauseReason === 'background' ? 'Tab in Background for >1 min' : 'Inactive for 1 min'})
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Continuous database reads have been stopped to save college cloud resources. Move mouse or resume below.
                </div>
              </div>
            </div>
            <button
              onClick={resumeLiveSync}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700, padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
            >
              ▶ Resume Live Sync
            </button>
          </div>
        )}

        {/* ── Blocking Modal Popup for Official Admin Broadcast ────────── */}
        {(() => {
          if (!broadcastNotice || !broadcastNotice.active || !broadcastNotice.title) return null;
          const currentNoticeId = `${broadcastNotice.title}_${broadcastNotice.updatedAt || ''}`;
          if (acknowledgedNoticeId === currentNoticeId) return null;

          const isDanger = broadcastNotice.severity === 'danger';
          const isWarning = broadcastNotice.severity === 'warning';
          const isSuccess = broadcastNotice.severity === 'success';

          const accentColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : isSuccess ? '#10b981' : '#3b82f6';
          const bgAccent = isDanger ? 'rgba(239, 68, 68, 0.12)' : isWarning ? 'rgba(245, 158, 11, 0.12)' : isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)';
          const icon = isDanger ? '🚨' : isWarning ? '⚠️' : isSuccess ? '✅' : '📢';

          const handleAcknowledge = () => {
            localStorage.setItem('ack_broadcast_notice_id', currentNoticeId);
            setAcknowledgedNoticeId(currentNoticeId);
          };

          return (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '1.5rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                background: 'var(--bg-card, #1e293b)',
                border: `2px solid ${accentColor}`,
                borderRadius: '18px',
                maxWidth: '680px',
                width: '100%',
                boxShadow: `0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px ${accentColor}33`,
                overflow: 'hidden',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Header */}
                <div style={{
                  background: bgAccent,
                  padding: '1.4rem 1.75rem',
                  borderBottom: `1px solid ${accentColor}40`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    fontSize: '2.4rem',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.08)'
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <span className={`badge ${isDanger ? 'badge-danger' : isWarning ? 'badge-warning' : isSuccess ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em' }}>
                        OFFICIAL ADMIN BROADCAST
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Priority Alert
                      </span>
                    </div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      color: accentColor,
                      lineHeight: 1.3
                    }}>
                      {broadcastNotice.title}
                    </h2>
                  </div>
                </div>

                {/* Body Content */}
                <div style={{
                  padding: '1.75rem',
                  maxHeight: '55vh',
                  overflowY: 'auto'
                }}>
                  <p style={{
                    fontSize: '1.05rem',
                    lineHeight: 1.65,
                    color: 'var(--text-primary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontWeight: 500
                  }}>
                    {broadcastNotice.message}
                  </p>

                  <div style={{
                    marginTop: '1.5rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>🔒</span>
                    <span>Console actions are paused until you acknowledge this mandatory notice.</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{
                  padding: '1.25rem 1.75rem',
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <button
                    onClick={handleAcknowledge}
                    className="btn btn-primary"
                    style={{
                      background: accentColor,
                      borderColor: accentColor,
                      padding: '0.75rem 2rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      borderRadius: '10px',
                      color: '#ffffff',
                      boxShadow: `0 4px 14px ${accentColor}66`
                    }}
                  >
                    I Understand &amp; Acknowledge →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {isSuperAdmin ? 'Published Papers' : 'My Question Papers'}
                  </span>
                  <span className="badge badge-neutral">
                    {metrics.totalExams || 0} {metrics.totalExams === 1 ? 'Exam' : 'Exams'}
                  </span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7C3AED', marginTop: '0.5rem' }}>
                  {metrics.totalPapers}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {metrics.totalExams || 0} {metrics.totalExams === 1 ? 'exam' : 'exams'} ({metrics.totalPapers} question {metrics.totalPapers === 1 ? 'set' : 'sets'})
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
        {activeTab === 'users' && <UserManagement user={user} />}
        {activeTab === 'auditlog' && isSuperAdmin && <AuditLog />}
        {activeTab === 'broadcast' && isSuperAdmin && <BroadcastNotice />}
        {activeTab === 'questionbank' && <QuestionBank />}
        {activeTab === 'download' && <AppDownload />}
        {activeTab === 'help' && <HelpCenter />}

        {activeTab === 'maintenance' && isSuperAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
            <div>
              <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                Database & Policy Administration
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Configure academic departments, global exam policies, timeouts, and clean databases.
              </p>
            </div>

            {/* System Maintenance Control Panel */}
            <div className="glass-card" style={{
              borderLeft: maintForm.enabled ? '4px solid #f59e0b' : '4px solid #10b981',
              background: maintForm.enabled ? 'rgba(245, 158, 11, 0.05)' : 'var(--glass-bg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🛠️ System Maintenance Mode
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      background: maintForm.enabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: maintForm.enabled ? '#ef4444' : '#10b981',
                      border: maintForm.enabled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      {maintForm.enabled ? '● MAINTENANCE ACTIVE (STUDENTS & FACULTY BLOCKED)' : '● NORMAL OPERATIONAL'}
                    </span>
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    When active, the exam system is completely offline for students & faculty (returns HTTP 503). <strong>Administrators have uninterrupted full access.</strong>
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveMaintenanceSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: maintForm.enabled ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)'
                }}>
                  <input
                    type="checkbox"
                    id="maintToggle"
                    style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: '#f59e0b' }}
                    checked={maintForm.enabled}
                    onChange={(e) => setMaintForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <label htmlFor="maintToggle" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                    {maintForm.enabled ? 'Disable normal access for Faculty & Students' : 'Enable System Maintenance Mode'}
                  </label>
                </div>

                <div className="grid-cols-2" style={{ gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Maintenance Notice to Faculty & Students
                    </label>
                    <textarea
                      className="input-field"
                      rows="2"
                      value={maintForm.message}
                      onChange={(e) => setMaintForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="e.g. System is undergoing scheduled maintenance. Please check back later."
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Estimated Completion Time / Message
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={maintForm.estimatedEndTime}
                      onChange={(e) => setMaintForm(prev => ({ ...prev, estimatedEndTime: e.target.value }))}
                      placeholder="e.g. Today at 2:00 PM IST or in 45 minutes"
                    />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Shown to students on app launch & portal login attempts.
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {maintForm.enabled && (
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                      disabled={maintLoading}
                      onClick={() => {
                        setMaintForm(prev => ({ ...prev, enabled: false }));
                        setTimeout(() => {
                          const fakeEvent = { preventDefault: () => {} };
                          handleSaveMaintenanceSettings(fakeEvent);
                        }, 50);
                      }}
                    >
                      Turn Off Maintenance
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={maintLoading}
                    style={{ background: maintForm.enabled ? '#f59e0b' : 'var(--primary)', borderColor: maintForm.enabled ? '#f59e0b' : 'var(--primary)' }}
                  >
                    {maintLoading ? 'Saving...' : maintForm.enabled ? '⚠️ Update Active Maintenance' : '💾 Save Maintenance Settings'}
                  </button>
                </div>
              </form>
            </div>

            {/* Department Management */}
            <DepartmentManagement />

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

            {/* App Updates & Version Control */}
            <div className="glass-card" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>
                  📱 App Version & Update Controls
                </h3>
                <span className={`badge ${appVersionConfig.forceUpdate ? 'badge-danger' : 'badge-success'}`}>
                  {appVersionConfig.forceUpdate ? '🔒 Mandatory Force Update Active' : '🟢 Normal Mode (No Lockout)'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Control student APK updates. When <strong>Force Update</strong> is enabled, any student running an app version below the minimum required version code will be locked out with a mandatory update screen.
              </p>

              <form onSubmit={handleSaveAppVersion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Minimum Required Version Code
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={appVersionConfig.minRequiredVersionCode}
                      onChange={(e) => setAppVersionConfig({ ...appVersionConfig, minRequiredVersionCode: parseInt(e.target.value) || 1 })}
                      min="1"
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Apps with Version Code below this will be blocked if Force Update is ON.
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Latest Released Version Code
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={appVersionConfig.latestVersionCode}
                      onChange={(e) => setAppVersionConfig({ ...appVersionConfig, latestVersionCode: parseInt(e.target.value) || 1 })}
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                      Latest Version Name (e.g., 2.0.1)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={appVersionConfig.latestVersionName}
                      onChange={(e) => setAppVersionConfig({ ...appVersionConfig, latestVersionName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Direct APK Download URL / Release Link
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://drive.google.com/... or https://github.com/.../releases"
                    value={appVersionConfig.apkDownloadUrl}
                    onChange={(e) => setAppVersionConfig({ ...appVersionConfig, apkDownloadUrl: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Tapping "Update App" on the student's phone opens this link directly.
                  </small>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Release Notes / Update Message
                  </label>
                  <textarea
                    className="input-field"
                    rows="2"
                    placeholder="Describe what changed in this version..."
                    value={appVersionConfig.releaseNotes}
                    onChange={(e) => setAppVersionConfig({ ...appVersionConfig, releaseNotes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <input
                    type="checkbox"
                    id="forceUpdateToggle"
                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                    checked={appVersionConfig.forceUpdate}
                    onChange={(e) => setAppVersionConfig({ ...appVersionConfig, forceUpdate: e.target.checked })}
                  />
                  <label htmlFor="forceUpdateToggle" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: appVersionConfig.forceUpdate ? '#ef4444' : 'var(--text-primary)' }}>
                    {appVersionConfig.forceUpdate ? '⚠️ Force Update is ENABLED (Older apps cannot be used)' : 'Enable Force Update (Lock older apps until updated)'}
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={appVersionLoading}>
                  {appVersionLoading ? 'Saving...' : '💾 Save App Update Settings'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
