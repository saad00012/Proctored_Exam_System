import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import API_BASE_URL from '../config';

function TeacherSettings({ user }) {
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState('AI & DS Engineering');
  const [phone, setPhone] = useState('');
  const [defaultDuration, setDefaultDuration] = useState('45');
  const [defaultSemester, setDefaultSemester] = useState('Semester 7');
  const [createdAt, setCreatedAt] = useState('');
  
  // Password Reset State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Toast / Feedback State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const departments = [
    'AI & DS Engineering',
    'Computer Science & Engineering',
    'Electrical & Computer Engineering',
    'Electronics & Telecommunication Engineering',
    'Mechanical & Mechatronics Engineering',
    'Applied Science & Engineering'
  ];

  const semesters = [
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Semester 6',
    'Semester 7',
    'Semester 8'
  ];

  const getAuthToken = async () => {
    try {
      if (auth && auth.currentUser) {
        return await auth.currentUser.getIdToken(true);
      }
    } catch (e) {
      console.warn("Could not get fresh token:", e);
    }
    return user?.token || '';
  };

  // Fetch teacher profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid || !db) {
        setProfileLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setName(data.name || user.name || '');
          setEmail(data.email || user.email || '');
          setDepartment(data.department || 'AI & DS Engineering');
          setPhone(data.phoneNumber || '');
          setCreatedAt(data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Active Member');
          
          if (data.preferences) {
            setDefaultDuration(data.preferences.defaultDuration || '45');
            setDefaultSemester(data.preferences.defaultSemester || 'Semester 7');
          }
        }
      } catch (err) {
        console.error("Error fetching teacher profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required.', 'danger');
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          department: department,
          phoneNumber: phone.trim(),
          preferences: {
            defaultDuration: defaultDuration,
            defaultSemester: defaultSemester
          }
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update profile');
      }

      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      console.error("Save profile error:", err);
      showToast(err.message || 'Failed to save changes.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Link
  const handleSendResetEmail = async () => {
    setPasswordLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.uid}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mode: 'email' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate reset link');

      showToast(data.message || 'Password reset link sent to your email.', 'info');
    } catch (err) {
      console.error("Password reset error:", err);
      showToast(err.message || 'Failed to send reset link.', 'danger');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Direct Password Update
  const handleDirectPasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'danger');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.uid}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: 'force',
          newPassword: newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update password');

      showToast('Password changed successfully!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error("Change password error:", err);
      showToast(err.message || 'Failed to change password.', 'danger');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading faculty settings...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h2>Teacher Settings &amp; Profile</h2>
        <p>Manage your faculty account details, exam defaults, and security credentials.</p>
      </div>

      {toast && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            borderRadius: '10px',
            background: toast.type === 'danger' ? 'var(--color-danger-bg)' : toast.type === 'info' ? 'var(--color-info-bg)' : 'var(--color-success-bg)',
            color: toast.type === 'danger' ? 'var(--color-danger)' : toast.type === 'info' ? 'var(--primary)' : 'var(--color-success)',
            border: `1px solid ${toast.type === 'danger' ? 'var(--color-danger)' : toast.type === 'info' ? 'var(--primary)' : 'var(--color-success)'}`,
            fontSize: '0.9rem',
            fontWeight: 500
          }}
        >
          {toast.type === 'danger' ? '⚠️ ' : toast.type === 'info' ? 'ℹ️ ' : '✅ '}
          {toast.message}
        </div>
      )}

      {/* Faculty Info Card Header */}
      <div className="glass-card" style={{ marginBottom: '1.75rem', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            fontWeight: 700
          }}>
            {name ? name.charAt(0).toUpperCase() : 'T'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{name || 'Faculty Member'}</h3>
              <span className="badge badge-info">👨‍🏫 Teacher Account</span>
              <span className="badge badge-success">Active</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {email} &nbsp;•&nbsp; {department} {createdAt && `• Joined ${createdAt}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid-cols-1-2" style={{ gap: '1.75rem', alignItems: 'flex-start' }}>
        {/* Profile Information Form */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
            👤 Personal Faculty Details
          </h3>
          
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Prof. Rajesh Sharma"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Faculty Email (Read-Only)
              </label>
              <input
                type="email"
                className="input-field"
                value={email}
                disabled
                style={{ opacity: 0.75, cursor: 'not-allowed', background: 'rgba(0,0,0,0.1)' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Email is tied to your college authentication domain.
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Primary Department
              </label>
              <select
                className="input-field"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Contact Phone Number
              </label>
              <input
                type="tel"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                disabled={loading}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                📝 Exam Authoring Preferences
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Default Duration
                  </label>
                  <select
                    className="input-field"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    disabled={loading}
                  >
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                    <option value="120">120 Minutes</option>
                    <option value="180">180 Minutes</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Default Semester
                  </label>
                  <select
                    className="input-field"
                    value={defaultSemester}
                    onChange={(e) => setDefaultSemester(e.target.value)}
                    disabled={loading}
                  >
                    {semesters.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ padding: '0.65rem 1.75rem' }}
              >
                {loading ? 'Saving Changes...' : '💾 Save Profile & Preferences'}
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
              🔒 Security &amp; Credentials
            </h3>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Update your account password directly or request a secure password reset link sent to your registered college email.
            </p>

            <form onSubmit={handleDirectPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  New Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={passwordLoading || !newPassword}
                style={{ alignSelf: 'flex-start', padding: '0.55rem 1.4rem' }}
              >
                {passwordLoading ? 'Updating...' : '🔑 Update Password'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Prefer receiving a reset link via email?
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSendResetEmail}
                disabled={passwordLoading}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.84rem' }}
              >
                📧 Send Password Reset Email
              </button>
            </div>
          </div>

          {/* Role Access Information Banner */}
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(79, 70, 229, 0.05)', borderColor: 'rgba(79, 70, 229, 0.2)' }}>
            <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛡️ Role &amp; Permission Scope
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              You are logged in as a <strong>Teacher</strong>. You have permissions to configure exams, upload question papers, monitor active proctored sessions, and review student malpractice logs.
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', margin: 0 }}>
              Global administrative settings (Domain Whitelisting, User Provisioning, System Exam Policies) are exclusively managed in the Admin Command Center.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherSettings;
