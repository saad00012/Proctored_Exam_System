import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import API_BASE_URL from '../config';

function UserManagement({ user }) {
  const [activeTab, setActiveTab] = useState('teachers'); // 'teachers' | 'students'
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSem, setSelectedSem] = useState('All');

  // Create User form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState('teacher'); // default
  const [newName, setNewName] = useState('');
  const [newPrn, setNewPrn] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDept, setNewDept] = useState('Computer Science & Engineering');
  const [newSem, setNewSem] = useState('Semester 7');
  const [newPhone, setNewPhone] = useState('');

  // Edit User modal state
  const [editUser, setEditUser] = useState(null);

  // Password reset modal state
  const [resettingUser, setResettingUser] = useState(null);
  const [resetPasswordMode, setResetPasswordMode] = useState('email'); // 'email' | 'force'
  const [newForcedPassword, setNewForcedPassword] = useState('');
  const [generatedResetLink, setGeneratedResetLink] = useState('');

  // Delete modal state
  const [deletingUser, setDeletingUser] = useState(null);

  // Toast Alerts
  const [toast, setToast] = useState(null); // { message: '', type: 'success'|'danger'|'info' }

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

  // Sync users from Firestore live
  useEffect(() => {
    setLoading(true);
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubTeachers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'teacher')),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ uid: doc.id, ...doc.data() });
        });
        setTeachers(list);
      },
      (error) => {
        console.error('Error syncing teachers:', error);
      }
    );

    const unsubStudents = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'student')),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ uid: doc.id, ...doc.data() });
        });
        setStudents(list);
      },
      (error) => {
        console.error('Error syncing students:', error);
      }
    );

    const unsubAttempts = onSnapshot(
      collection(db, 'exam_attempts'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setAttempts(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error syncing attempts:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubTeachers();
      unsubStudents();
      unsubAttempts();
    };
  }, []);

  const getStudentExamsCount = (uid) => {
    return attempts.filter((a) => a.studentId === uid).length;
  };

  // CREATE USER API CALL
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      showToast('Please fill out Name, Email, and Password.', 'danger');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'danger');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: newName,
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: createRole,
        department: createRole === 'admin' ? 'Administration' : newDept,
        semester: createRole === 'student' ? newSem : 'N/A',
        prnNumber: createRole === 'student' ? (newPrn.trim().toUpperCase() || 'N/A') : 'N/A',
        phoneNumber: newPhone
      };

      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showToast(`${createRole === 'admin' ? 'Admin' : createRole === 'teacher' ? 'Teacher' : 'Student'} created successfully!`, 'success');
      setShowCreateModal(false);
      // Reset form
      setNewName('');
      setNewPrn('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // EDIT USER API CALL
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editUser.name) {
      showToast('Name is required.', 'danger');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: editUser.name,
        department: editUser.department,
        role: editUser.role,
        email: editUser.email,
        semester: editUser.role === 'student' ? editUser.semester : 'N/A',
        prnNumber: editUser.role === 'student' ? (editUser.prnNumber ? editUser.prnNumber.trim().toUpperCase() : 'N/A') : 'N/A',
        phoneNumber: editUser.phoneNumber || ''
      };

      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${editUser.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user profile');
      }

      showToast('User profile updated successfully!', 'success');
      setEditUser(null);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // PASSWORD RESET API CALL
  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (resetPasswordMode === 'force' && (!newForcedPassword || newForcedPassword.length < 6)) {
      showToast('New password must be at least 6 characters.', 'danger');
      return;
    }

    setActionLoading(true);
    setGeneratedResetLink('');
    try {
      const payload = {
        mode: resetPasswordMode,
        newPassword: resetPasswordMode === 'force' ? newForcedPassword : undefined
      };

      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${resettingUser.uid}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }

      if (resetPasswordMode === 'email') {
        if (data.resetLink) {
          setGeneratedResetLink(data.resetLink);
          showToast('Password reset link generated successfully!', 'success');
        } else {
          showToast('Password reset email requested successfully!', 'success');
          setResettingUser(null);
        }
      } else {
        showToast('Password forced successfully to new value!', 'success');
        setResettingUser(null);
        setNewForcedPassword('');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // DELETE USER API CALL
  const handleDeleteUserConfirm = async () => {
    setActionLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${deletingUser.uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      showToast(`User ${deletingUser.name} deleted successfully from database.`, 'success');
      setDeletingUser(null);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // Filters logic
  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'All' || t.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.prnNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'All' || s.department === selectedDept;
    const matchesSem = selectedSem === 'All' || s.semester === selectedSem;
    return matchesSearch && matchesDept && matchesSem;
  });

  return (
    <div className="fade-in" style={{ textAlign: 'left', position: 'relative' }}>
      
      {/* Toast Alert Header banner */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'success' ? 'var(--color-success-bg)' :
                      toast.type === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-info-bg)',
          color: toast.type === 'success' ? 'var(--color-success-text)' :
                 toast.type === 'danger' ? 'var(--color-danger-text)' : 'var(--color-info-text)',
          borderLeft: `5px solid ${
            toast.type === 'success' ? 'var(--color-success)' :
            toast.type === 'danger' ? 'var(--color-danger)' : 'var(--color-info)'
          }`,
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontWeight: 500,
          animation: 'slideIn 0.3s ease'
        }}>
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'inherit', 
              cursor: 'pointer', 
              fontWeight: 700 
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>User Administration</h2>
          <p>Create faculty accounts, manage student scopes, and configure credential recoveries.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setCreateRole(activeTab === 'teachers' ? 'teacher' : 'student'); setShowCreateModal(true); }}>
          ➕ Register User
        </button>
      </div>

      {/* Tabs Row */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        gap: '0.5rem'
      }}>
        <button 
          onClick={() => { setActiveTab('teachers'); setSearchQuery(''); setSelectedDept('All'); setSelectedSem('All'); }}
          style={{
            padding: '0.8rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'teachers' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'teachers' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'var(--transition-fast)'
          }}
        >
          👩‍🏫 Teachers <span className="badge badge-info" style={{ marginLeft: '0.25rem' }}>{teachers.length}</span>
        </button>
        <button 
          onClick={() => { setActiveTab('students'); setSearchQuery(''); setSelectedDept('All'); setSelectedSem('All'); }}
          style={{
            padding: '0.8rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'students' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'students' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'var(--transition-fast)'
          }}
        >
          👨‍🎓 Students <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>{students.length}</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 250px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder={`🔍 Search ${activeTab} by name, email, or PRN...`} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <select 
            className="input-field"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="All">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {activeTab === 'students' && (
          <div style={{ minWidth: '150px' }}>
            <select 
              className="input-field"
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
            >
              <option value="All">All Semesters</option>
              {semesters.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table view */}
      {loading ? (
        <p>Loading database directory...</p>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                {activeTab === 'students' && <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>PRN</th>}
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Email Address</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Department</th>
                {activeTab === 'students' ? (
                  <>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'center' }}>Sem</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'center' }}>Exams</th>
                  </>
                ) : null}
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'teachers' ? (
                filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No teachers match the criteria.</td>
                  </tr>
                ) : (
                  filteredTeachers.map(t => (
                    <tr key={t.uid} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{t.email}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{t.department}</span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setEditUser(t)}>Edit</button>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--secondary)' }} onClick={() => { setResettingUser(t); setResetPasswordMode('email'); setGeneratedResetLink(''); }}>🔑 Reset Pass</button>
                          <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setDeletingUser(t)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students match the criteria.</td>
                  </tr>
                ) : (
                  filteredStudents.map(s => (
                    <tr key={s.uid} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{s.prnNumber || 'N/A'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{s.email}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem', color: '#78350f', background: '#fef3c7' }}>{s.department}</span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: 600 }}>{s.semester ? s.semester.replace('Semester ', 'S') : 'N/A'}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: 600 }}>
                        <span className="badge badge-info" style={{ borderRadius: '50%', width: '22px', height: '22px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                          {getStudentExamsCount(s.uid)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setEditUser(s)}>Edit</button>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--secondary)' }} onClick={() => { setResettingUser(s); setResetPasswordMode('email'); setGeneratedResetLink(''); }}>🔑 Reset Pass</button>
                          <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setDeletingUser(s)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card fade-in" style={{ padding: '2rem', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Register New User Profile</h3>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button 
                type="button"
                className={`btn ${createRole === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setCreateRole('teacher')}
              >
                Teacher
              </button>
              <button 
                type="button"
                className={`btn ${createRole === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setCreateRole('student')}
              >
                Student
              </button>
              <button 
                type="button"
                className={`btn ${createRole === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setCreateRole('admin')}
              >
                Admin
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Ramesh Deshmukh" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Email Address</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder={createRole === 'admin' ? 'e.g. admin@dnyanshree.edu.in' : 'e.g. ramesh@dnyanshree.edu.in'} 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)} 
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Initial Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="At least 6 characters" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required
                />
              </div>

              {createRole === 'admin' ? (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(79, 70, 229, 0.1)',
                  border: '1px solid rgba(79, 70, 229, 0.25)',
                  fontSize: '0.82rem',
                  color: 'var(--primary)'
                }}>
                  👑 <strong>Super Admin Scope:</strong> College Administration (No course/semester required)
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Department</label>
                  <select 
                    className="input-field"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {createRole === 'student' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>PRN Number / Roll No.</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. 210101001" 
                      value={newPrn} 
                      onChange={(e) => setNewPrn(e.target.value)} 
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Semester</label>
                    <select 
                      className="input-field"
                      value={newSem}
                      onChange={(e) => setNewSem(e.target.value)}
                    >
                      {semesters.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Phone Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. +919876543210" 
                      value={newPhone} 
                      onChange={(e) => setNewPhone(e.target.value)} 
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : '➕ Create Account'}
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card fade-in" style={{ padding: '2rem', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Edit {editUser.role === 'teacher' ? 'Teacher' : 'Student'} Profile</h3>
            
            <form onSubmit={handleEditUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editUser.name} 
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} 
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Email Address</label>
                <input 
                  type="email" 
                  className="input-field" 
                  value={editUser.email} 
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} 
                  required
                />
              </div>

              {editUser.role === 'student' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>PRN Number / Roll No.</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 210101001" 
                    value={editUser.prnNumber || ''} 
                    onChange={(e) => setEditUser({ ...editUser, prnNumber: e.target.value })} 
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Department</label>
                <select 
                  className="input-field"
                  value={editUser.department}
                  onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                >
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {editUser.role === 'student' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Semester</label>
                    <select 
                      className="input-field"
                      value={editUser.semester || 'Semester 7'}
                      onChange={(e) => setEditUser({ ...editUser, semester: e.target.value })}
                    >
                      {semesters.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Phone Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editUser.phoneNumber || ''} 
                      onChange={(e) => setEditUser({ ...editUser, phoneNumber: e.target.value })} 
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {resettingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card fade-in" style={{ padding: '2rem', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Reset Password</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Configure credential recovery settings for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button 
                type="button"
                className={`btn ${resetPasswordMode === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => { setResetPasswordMode('email'); setGeneratedResetLink(''); }}
              >
                Reset Link / Email
              </button>
              <button 
                type="button"
                className={`btn ${resetPasswordMode === 'force' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => { setResetPasswordMode('force'); setGeneratedResetLink(''); }}
              >
                Force New Password
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {resetPasswordMode === 'email' ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Generating a password reset link lets Firebase securely verify the user's identity. 
                    A link will be generated that you can copy and send to the user directly.
                  </p>
                  
                  {generatedResetLink && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Reset URL (Copy and Share):</label>
                      <input 
                        type="text" 
                        readOnly 
                        className="input-field" 
                        value={generatedResetLink} 
                        onClick={(e) => e.target.select()}
                        style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Set New Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Enter at least 6 characters" 
                    value={newForcedPassword} 
                    onChange={(e) => setNewForcedPassword(e.target.value)} 
                    required
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-warning-text)', marginTop: '0.4rem', lineHeight: 1.3 }}>
                    ⚠️ This immediately overwrites the user's password in Firebase. Make sure to share the new password with them.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : resetPasswordMode === 'email' ? '🔗 Generate Link' : '💾 Update Password'}
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setResettingUser(null)}>Done / Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deletingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card fade-in" style={{ padding: '2rem', width: '90%', maxWidth: '400px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.75rem' }}>Confirm Delete User</h3>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to completely delete the account for <strong>{deletingUser.name}</strong> ({deletingUser.email})? 
              <br /><br />
              This will remove their profile from the database and **permanently delete their login credentials** from Firebase Auth. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteUserConfirm} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : '🗑️ Yes, Delete User'}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeletingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default UserManagement;
