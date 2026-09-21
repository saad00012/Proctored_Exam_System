import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, query, getDocs, where } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/Login';
import PaperUpload from './components/PaperUpload';
import LiveMonitor from './components/LiveMonitor';
import StudentDirectory from './components/StudentDirectory';
import UserManagement from './components/UserManagement';
import API_BASE_URL from './config';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('teacher'); // 'superadmin' or 'teacher'
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [allowedDomains, setAllowedDomains] = useState(['dnyanshree.edu.in']);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(45);
  const [warningThreshold, setWarningThreshold] = useState(3);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [papersCount, setPapersCount] = useState(0);

  // Helper to get fresh auth token
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

  // Restore login session on app load via Firebase Auth
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          let userRole = 'teacher';
          let userName = firebaseUser.displayName || 'Teacher';
          
          try {
            if (db) {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                userRole = data.role || 'teacher';
                userName = data.name || userName;
                if (userRole === 'student') {
                  await signOut(auth);
                  setUser(null);
                  alert("Access Denied: Student accounts cannot access the Teacher Dashboard. Please use the mobile app.");
                  return;
                }
              } else {
                // Auto-create teacher document if not found in Firestore
                await setDoc(userDocRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  name: userName,
                  role: 'teacher',
                  createdAt: new Date().toISOString()
                }, { merge: true });
              }
            }
          } catch (e) {
            console.warn("Could not sync Firestore profile in onAuthStateChanged:", e);
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: userName,
            role: userRole,
            token: token
          });
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Load global exam policies
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const token = await getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/admin/policies`, { headers });
        if (response.ok) {
          const data = await response.json();
          setDefaultDuration(data.defaultDuration || 45);
          setWarningThreshold(data.warningThreshold || 3);
        }
      } catch (err) {
        console.error("Failed to load settings config from API:", err);
      }
    };
    loadConfig();
  }, [user]);

  // Sync teachers and students from Firestore in live mode
  useEffect(() => {
    if (!db || !user) return;

    console.log("👥 Syncing users from Firestore...");
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() });
      });
      setTeachers(list);
    }, (error) => {
      console.error("Error syncing teachers in App.jsx:", error);
    });

    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() });
      });
      setStudents(list);
    }, (error) => {
      console.error("Error syncing students in App.jsx:", error);
    });

    return () => {
      unsubTeachers();
      unsubStudents();
    };
  }, [user]);


  const handleSavePolicies = async (e) => {
    e.preventDefault();
    setPolicyLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          defaultDuration: parseInt(defaultDuration),
          warningThreshold: parseInt(warningThreshold)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      alert(data.message || "Exam policies updated successfully!");
    } catch (err) {
      alert("Failed to save policies: " + err.message);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleSeedSampleData = async () => {
    if (!window.confirm("Seed sample papers and MCQs in Firestore?")) return;
    setPolicyLoading(true);
    try {
      const paper1Id = "cse-set-a";
      await setDoc(doc(db, "papers", paper1Id), {
        title: "CSE Set A: Intro to Programming",
        department: "Computer Science",
        status: "published",
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, "questions", "q-cse-1-1"), {
        paperId: paper1Id,
        questionText: "What is the time complexity of searching in a balanced BST?",
        options: [
          { text: "O(n)", imageUrl: null },
          { text: "O(log n)", imageUrl: null },
          { text: "O(1)", imageUrl: null },
          { text: "O(n log n)", imageUrl: null }
        ],
        correctOptionIndex: 1,
        department: "Computer Science"
      });

      const paper2Id = "cse-set-b";
      await setDoc(doc(db, "papers", paper2Id), {
        title: "CSE Set B: OOP Concepts",
        department: "Computer Science",
        status: "published",
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, "questions", "q-cse-2-1"), {
        paperId: paper2Id,
        questionText: "Which concept allows a subclass to provide a specific implementation of a method?",
        options: [
          { text: "Method Overriding", imageUrl: null },
          { text: "Method Overloading", imageUrl: null },
          { text: "Encapsulation", imageUrl: null },
          { text: "Abstraction", imageUrl: null }
        ],
        correctOptionIndex: 0,
        department: "Computer Science"
      });

      const paper3Id = "cse-set-c";
      await setDoc(doc(db, "papers", paper3Id), {
        title: "CSE Set C: Data Structures",
        department: "Computer Science",
        status: "published",
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, "questions", "q-cse-3-1"), {
        paperId: paper3Id,
        questionText: "Which data structure follows the LIFO (Last In First Out) principle?",
        options: [
          { text: "Queue", imageUrl: null },
          { text: "Stack", imageUrl: null },
          { text: "Tree", imageUrl: null },
          { text: "Graph", imageUrl: null }
        ],
        correctOptionIndex: 1,
        department: "Computer Science"
      });

      const paper4Id = "ee-set-a";
      await setDoc(doc(db, "papers", paper4Id), {
        title: "EE Set A: Ohm's Law Basics",
        department: "Electrical Engineering",
        status: "published",
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, "questions", "q-ee-1-1"), {
        paperId: paper4Id,
        questionText: "Which formula represents Ohm's Law?",
        options: [
          { text: "V = I * R", imageUrl: null },
          { text: "P = V * I", imageUrl: null },
          { text: "R = V * P", imageUrl: null },
          { text: "I = V * R", imageUrl: null }
        ],
        correctOptionIndex: 0,
        department: "Electrical Engineering"
      });

      alert("Sample CSE and EE exam papers seeded successfully!");
    } catch (err) {
      console.error("Failed to seed sample papers:", err);
      alert("Failed: " + err.message);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleClearAttempts = async () => {
    if (!window.confirm("Are you sure you want to delete ALL student attempt logs? This resets all blocks, submissions, and warnings.")) return;
    setPolicyLoading(true);
    try {
      const q = query(collection(db, "exam_attempts"));
      const snapshot = await getDocs(q);
      const deletePromises = [];
      snapshot.forEach((document) => {
        deletePromises.push(deleteDoc(doc(db, "exam_attempts", document.id)));
      });
      await Promise.all(deletePromises);
      alert("All student attempt logs cleared successfully!");
    } catch (err) {
      console.error("Failed to clear attempts:", err);
      alert("Failed: " + err.message);
    } finally {
      setPolicyLoading(false);
    }
  };

  // Sync attempts and papers count for Overview metrics in real-time
  useEffect(() => {
    if (!db || !user) {
      setPapersCount(3);
      
      const poll = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/teacher/live-monitor`, {
            headers: {
              'Authorization': `Bearer ${user?.token || 'mock-teacher'}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setAttempts(data.activeSessions || []);
          }
        } catch (err) {
          console.error("Failed to poll mock live-monitor in App.jsx:", err);
        }
      };

      poll();
      // P1 Fix: Only poll when on overview or live tabs, and use 5s interval
      if (activeTab === 'overview' || activeTab === 'live') {
        const interval = setInterval(poll, 5000);
        return () => clearInterval(interval);
      }
    }

    const unsubAttempts = onSnapshot(collection(db, 'exam_attempts'), (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setAttempts(list);
    }, (error) => {
      console.error("Error syncing attempts in App.jsx:", error);
    });

    const unsubPapers = onSnapshot(collection(db, 'papers'), (snapshot) => {
      setPapersCount(snapshot.size);
    }, (error) => {
      console.error("Error syncing papers in App.jsx:", error);
    });

    return () => {
      unsubAttempts();
      unsubPapers();
    };
  }, [user, activeTab]);

  const parseTime = (timestamp) => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    return new Date(timestamp);
  };

  const getLiveAlerts = () => {
    const alerts = [];
    attempts.forEach(attempt => {
      if (attempt.status === 'blocked_pending_review') {
        alerts.push({
          id: `${attempt.id}-blocked`,
          studentName: attempt.studentName,
          message: 'was hard-blocked (warnings limit exceeded)',
          type: 'danger',
          time: attempt.startedAt || new Date().toISOString()
        });
      } else if (attempt.status === 'malpractice_failed') {
        alerts.push({
          id: `${attempt.id}-failed`,
          studentName: attempt.studentName,
          message: 'malpractice fail confirmed by teacher',
          type: 'danger',
          time: new Date().toISOString()
        });
      } else if (attempt.status === 'submitted') {
        alerts.push({
          id: `${attempt.id}-submitted`,
          studentName: attempt.studentName,
          message: 'submitted their exam successfully',
          type: 'success',
          time: attempt.submittedAt || new Date().toISOString()
        });
      } else if (attempt.status === 'started' && attempt.overrideTimeSeconds > 0) {
        alerts.push({
          id: `${attempt.id}-override`,
          studentName: attempt.studentName,
          message: 'granted override, resuming with custom timer',
          type: 'info',
          time: attempt.startedAt || new Date().toISOString()
        });
      } else if (attempt.warnings > 0) {
        alerts.push({
          id: `${attempt.id}-warning`,
          studentName: attempt.studentName,
          message: `exited exam screen (Warning count: ${attempt.warnings})`,
          type: 'warning',
          time: attempt.startedAt || new Date().toISOString()
        });
      } else if (attempt.status === 'started') {
        alerts.push({
          id: `${attempt.id}-started`,
          studentName: attempt.studentName,
          message: 'started an exam session',
          type: 'info',
          time: attempt.startedAt || new Date().toISOString()
        });
      }
    });

    return alerts.sort((a, b) => {
      return parseTime(b.time).getTime() - parseTime(a.time).getTime();
    }).slice(0, 6);
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      try {
        await signOut(auth);
        setUser(null);
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
  };

  // Sync whitelisted domains in real-time if live Firebase is active
  useEffect(() => {
    if (!db || !user) return;

    console.log("🔗 Listening to allowed_domains in Firestore...");
    const unsubscribe = onSnapshot(collection(db, 'allowed_domains'), (snapshot) => {
      const domains = [];
      snapshot.forEach((doc) => {
        if (doc.data().isActive) {
          domains.push(doc.id);
        }
      });
      setAllowedDomains(domains);
    }, (error) => {
      console.error("Firestore sync error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    
    const formattedDomain = newDomain.trim().toLowerCase();
    
    // Domain regex validation supporting subdomains and multiple dots
    const domainRegex = /^[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(formattedDomain)) {
      alert("Please enter a valid domain format (e.g. college.edu.in).");
      return;
    }

    if (allowedDomains.includes(formattedDomain)) {
      alert("Domain already whitelisted.");
      return;
    }

    setSettingsLoading(true);

    // Write directly to Firestore
    try {
      setSettingsLoading(true);
      await setDoc(doc(db, 'allowed_domains', formattedDomain), {
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setNewDomain('');
    } catch (err) {
      console.error("Failed to add domain to Firestore:", err);
      alert("Failed to write to database: " + err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRemoveDomain = async (domain) => {
    if (domain === 'dnyanshree.edu.in') {
      alert("Default domain dnyanshree.edu.in cannot be removed for safety.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove @${domain} from whitelisted domains?`)) {
      return;
    }

    setSettingsLoading(true);

    // Delete from Firestore
    try {
      await deleteDoc(doc(db, 'allowed_domains', domain));
    } catch (err) {
      console.error("Failed to delete domain from Firestore:", err);
      alert("Failed to delete from database: " + err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // If not logged in, show Login Screen
  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        const activeSessionsCount = attempts.filter(a => a.status === 'started' || a.status === 'exited_on_violation').length;
        const blockedCount = attempts.filter(a => a.status === 'blocked_pending_review').length;
        const liveAlerts = getLiveAlerts();

        return (
          <div className="fade-in">
            <div className="page-header">
              <h2>Welcome back 👋</h2>
              <p>
                {role === 'superadmin'
                  ? 'Super Admin Command Console — manage email domains, register teachers, and configure global exam policies.'
                  : 'Teacher Console — conduct secure proctored exams, monitor active student sessions, and review violations.'}
              </p>
            </div>

            {role === 'superadmin' ? (
              <div className="grid-cols-1-3" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                  <div className="flex-between">
                    <span className="stat-label">Live Sessions</span>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <div className="stat-number" style={{ color: 'var(--primary)' }}>{activeSessionsCount}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Students currently in exam</p>
                </div>

                <div className="stat-card">
                  <div className="flex-between">
                    <span className="stat-label">Faculty</span>
                    <span className="badge badge-info">Registered</span>
                  </div>
                  <div className="stat-number">{teachers.length}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Total teacher accounts</p>
                </div>

                <div className="stat-card">
                  <div className="flex-between">
                    <span className="stat-label">Domains</span>
                    <span className="badge badge-warning">Whitelisted</span>
                  </div>
                  <div className="stat-number">{allowedDomains.length}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Active email domain rules</p>
                </div>
              </div>
            ) : (
              <div className="grid-cols-1-3" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                  <div className="flex-between">
                    <span className="stat-label">Active Sessions</span>
                    <span className="badge badge-success">Live</span>
                  </div>
                  <div className="stat-number" style={{ color: 'var(--primary)' }}>{activeSessionsCount}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Students currently in exam</p>
                </div>

                <div className="stat-card">
                  <div className="flex-between">
                    <span className="stat-label">Question Papers</span>
                    <span className="badge badge-info">Stored</span>
                  </div>
                  <div className="stat-number">{papersCount}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Published MCQ sets</p>
                </div>

                <div className="stat-card" style={{ borderColor: blockedCount > 0 ? 'rgba(239,68,68,0.2)' : 'var(--border-color)' }}>
                  <div className="flex-between">
                    <span className="stat-label">Pending Review</span>
                    <span className="badge badge-danger">Urgent</span>
                  </div>
                  <div className="stat-number" style={{ color: blockedCount > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{blockedCount}</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Students blocked pending action</p>
                </div>
              </div>
            )}

            <div className="grid-cols-1-2" style={{ gap: '1.5rem', alignItems: 'stretch' }}>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>System Status</h3>
                
                <div className="flex-between" style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Backend Server Status</span>
                  <span className="badge badge-success">Online (Stub)</span>
                </div>
                <div className="flex-between" style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Firestore Connection</span>
                  <span className="badge badge-success">
                    Connected
                  </span>
                </div>
                <div className="flex-between" style={{ padding: '0.4rem 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Active Whitelisted Domains</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end', maxWidth: '60%' }}>
                    {allowedDomains.map(d => (
                      <span key={d} className="badge badge-info">@{d}</span>
                    ))}
                  </div>
                </div>
              </div>

              {role === 'superadmin' ? (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Quick Settings Shortcuts
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Access portal settings and setup default thresholds to lock students during cheating events.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                    <button className="btn btn-primary" onClick={() => setActiveTab('domains')}>
                      🌐 Whitelists
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('policies')}>
                      🛠️ Exam Policies
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Live Proctoring Activity Feed
                  </h3>
                  
                  {liveAlerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🕐</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Waiting for proctoring events...</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '260px', overflowY: 'auto' }}>
                      {liveAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            padding: '0.7rem 0.9rem',
                            background: alert.type === 'danger' ? 'var(--color-danger-bg)' :
                                        alert.type === 'warning' ? 'var(--color-warning-bg)' :
                                        alert.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
                            borderLeft: `3px solid ${
                              alert.type === 'danger' ? 'var(--color-danger)' :
                              alert.type === 'warning' ? 'var(--color-warning)' :
                              alert.type === 'success' ? 'var(--color-success)' : 'var(--color-info)'
                            }`,
                            borderRadius: '0 8px 8px 0',
                            fontSize: '0.84rem'
                          }}
                        >
                          <div style={{ flex: 1, lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{alert.studentName}</strong>
                            <span style={{ color: 'var(--text-secondary)' }}> {alert.message}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {parseTime(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'papers':
        return <div><PaperUpload /></div>;
      case 'live':
        return <div><LiveMonitor user={user} defaultDuration={defaultDuration} /></div>;
      case 'students':
        return <div><StudentDirectory /></div>;
      case 'domains':
        return (
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Whitelisted Email Domains</h2>
            <div className="glass-card" style={{ textAlign: 'left' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Manage Registrations
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Add or remove domain suffixes. Students can only log in if their email address matches a whitelist.
              </p>

              <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. college.edu.in"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  style={{ maxWidth: '300px' }}
                  disabled={settingsLoading}
                />
                <button type="submit" className="btn btn-primary" disabled={settingsLoading}>
                  {settingsLoading ? 'Adding...' : 'Add Domain'}
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {allowedDomains.map(domain => (
                  <div key={domain} className="flex-between" style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(0, 0, 0, 0.15)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div className="flex-row">
                      <span className="badge badge-info">Domain</span>
                      <span style={{ fontWeight: 500 }}>@{domain}</span>
                    </div>
                    {domain !== 'dnyanshree.edu.in' && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                        onClick={() => handleRemoveDomain(domain)}
                        disabled={settingsLoading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'users':
        return <UserManagement user={user} />;
      case 'policies':
        return (
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>System Config & Policies</h2>
            
            <div className="glass-card" style={{ textAlign: 'left', padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                General Exam Parameters
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Configure global settings for student testing, warning counts, and total allowed minutes.
              </p>

              <form onSubmit={handleSavePolicies} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Default Exam Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    required
                    disabled={policyLoading}
                    min="1"
                    max="180"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Malpractice Warning Threshold (Infractions before block)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                    required
                    disabled={policyLoading}
                    min="1"
                    max="10"
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', padding: '0.6rem 1.5rem' }} disabled={policyLoading}>
                  {policyLoading ? 'Saving...' : 'Save Policies'}
                </button>
              </form>
            </div>

            <div className="glass-card" style={{ textAlign: 'left', padding: '2rem', border: '1px solid rgba(163, 163, 163, 0.2)' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: '#fbbf24' }}>
                🛠️ Developer Sandbox Utilities
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Quick utility functions for developer sandbox testing to populate sample papers or reset attempts in 1 click.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleSeedSampleData} 
                  className="btn btn-secondary" 
                  style={{ borderColor: '#fbbf24', color: '#fbbf24' }}
                  disabled={policyLoading}
                >
                  Seed Sample Exam Papers
                </button>

                <button 
                  onClick={handleClearAttempts} 
                  className="btn btn-danger" 
                  disabled={policyLoading}
                >
                  Clear All Attempt Logs
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
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
            <div className="sidebar-logo-sub">Live Mode</div>
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

          {role === 'teacher' ? (
            <>
              <div
                className={`sidebar-link ${activeTab === 'papers' ? 'active' : ''}`}
                onClick={() => setActiveTab('papers')}
              >
                <span className="sidebar-icon">📝</span> Question Papers
              </div>

              <div
                className={`sidebar-link ${activeTab === 'live' ? 'active' : ''}`}
                onClick={() => setActiveTab('live')}
              >
                <span className="sidebar-icon">📡</span> Live Monitor
              </div>

              <div
                className={`sidebar-link ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <span className="sidebar-icon">👥</span> Students
              </div>
            </>
          ) : (
            <>
              <div
                className={`sidebar-link ${activeTab === 'domains' ? 'active' : ''}`}
                onClick={() => setActiveTab('domains')}
              >
                <span className="sidebar-icon">🌐</span> Domain Whitelists
              </div>

              <div
                className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <span className="sidebar-icon">👥</span> User Management
              </div>

              <div
                className={`sidebar-link ${activeTab === 'policies' ? 'active' : ''}`}
                onClick={() => setActiveTab('policies')}
              >
                <span className="sidebar-icon">🛠️</span> Exam Policies
              </div>
            </>
          )}
        </nav>

        {/* Dev Console Switcher */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p className="sidebar-section-label" style={{ marginBottom: '0.5rem' }}>Dev Console</p>
          <select
            value={role}
            onChange={(e) => {
              const newRole = e.target.value;
              setRole(newRole);
              setUser(prev => ({ ...prev, role: newRole, name: newRole === 'superadmin' ? 'Mock Super Admin' : 'Mock Teacher (Dev)' }));
              setActiveTab('overview');
            }}
            className="input-field"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
          >
            <option value="teacher">👨‍🏫 Teacher Console</option>
            <option value="superadmin">👑 Super Admin Console</option>
          </select>
        </div>

        {/* User Info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.65rem',
          background: 'var(--primary-light)', borderRadius: '12px',
          padding: '0.75rem', border: '1px solid rgba(79,70,229,0.1)'
        }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontWeight: 700,
            fontSize: '0.8rem', flexShrink: 0
          }}>
            {user.name?.charAt(0) || 'T'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{role === 'superadmin' ? 'Super Admin' : 'Teacher'}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {role === 'superadmin' ? 'Super Admin Console' : 'Teacher Console'}
            </p>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {activeTab === 'live' ? 'Live Monitor' : activeTab}
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

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
