import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, query, getDocs, where } from 'firebase/firestore';
import { db, auth, isMock } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/Login';
import PaperUpload from './components/PaperUpload';
import LiveMonitor from './components/LiveMonitor';
import StudentDirectory from './components/StudentDirectory';
import API_BASE_URL from './config';

function App() {
  const [user, setUser] = useState({
    uid: 'mock-uid-teacher-456',
    email: 'teacher@dnyanshree.edu.in',
    name: 'Mock Teacher (Dev)',
    role: 'teacher',
    token: 'mock-teacher'
  });
  const [role, setRole] = useState('teacher'); // 'superadmin' or 'teacher'
  const [teachers, setTeachers] = useState([
    { uid: 'mock-uid-teacher-456', name: 'Mock Teacher (Dev)', email: 'teacher@dnyanshree.edu.in', subject: 'Computer Science' },
    { uid: 'mock-uid-teacher-789', name: 'Dr. Neha Gupta', email: 'neha.gupta@dnyanshree.edu.in', subject: 'Data Structures' },
    { uid: 'mock-uid-teacher-101', name: 'Prof. Suresh Patil', email: 'suresh.patil@dnyanshree.edu.in', subject: 'Electrical Engineering' }
  ]);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('Computer Science');
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

  // Restore login session on app load (disabled for development phase)
  useEffect(() => {
    console.log("🛠️ Dev Mode: Login system disabled, using mock teacher session.");
    if (auth) {
      signOut(auth).catch(() => {});
    }
    setUser({
      uid: 'mock-uid-teacher-456',
      email: 'teacher@dnyanshree.edu.in',
      name: 'Mock Teacher (Dev)',
      role: 'teacher',
      token: 'mock-teacher'
    });
  }, []);

  // Load global exam policies
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/policies`);
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

  // Sync teachers from Firestore in live mode
  useEffect(() => {
    if (isMock || !db || !user) return;

    console.log("👥 Syncing teachers from Firestore...");
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() });
      });
      setTeachers(list);
    }, (error) => {
      console.error("Error syncing teachers in App.jsx:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName || !newTeacherEmail) {
      alert("Please fill all details.");
      return;
    }
    setPolicyLoading(true);
    const teacherData = {
      name: newTeacherName,
      email: newTeacherEmail,
      subject: newTeacherSubject,
      role: 'teacher'
    };

    if (isMock) {
      const newTeacher = {
        uid: `mock-uid-teacher-${Date.now()}`,
        ...teacherData
      };
      setTeachers([...teachers, newTeacher]);
      setNewTeacherName('');
      setNewTeacherEmail('');
      alert(`Teacher account for ${newTeacherName} created successfully (Mock mode)!`);
      setPolicyLoading(false);
    } else {
      try {
        const docRef = doc(collection(db, 'users'));
        await setDoc(docRef, teacherData);
        setNewTeacherName('');
        setNewTeacherEmail('');
        alert(`Teacher account for ${newTeacherName} registered in database!`);
      } catch (err) {
        console.error("Failed to create teacher:", err);
        alert("Failed to create teacher: " + err.message);
      } finally {
        setPolicyLoading(false);
      }
    }
  };

  const handleDeleteTeacher = async (uid) => {
    if (!window.confirm("Are you sure you want to delete this teacher account?")) return;
    setPolicyLoading(true);
    if (isMock) {
      setTeachers(teachers.filter(t => t.uid !== uid));
      alert("Teacher account deleted successfully.");
      setPolicyLoading(false);
    } else {
      try {
        await deleteDoc(doc(db, 'users', uid));
        alert("Teacher account deleted successfully.");
      } catch (err) {
        console.error("Failed to delete teacher:", err);
        alert("Failed to delete teacher: " + err.message);
      } finally {
        setPolicyLoading(false);
      }
    }
  };

  const handleSavePolicies = async (e) => {
    e.preventDefault();
    setPolicyLoading(true);
    if (isMock) {
      alert("General exam policies saved successfully! (Mock Mode)");
      setPolicyLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/admin/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || 'mock-teacher'}`
        },
        body: JSON.stringify({
          defaultDuration: parseInt(defaultDuration),
          warningThreshold: parseInt(warningThreshold)
        })
      });
      if (response.ok) {
        alert("General exam policies updated successfully!");
      } else {
        const errData = await response.json();
        alert("Failed to save policies: " + errData.error);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      alert("Failed to save policies: " + err.message);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleSeedSampleData = async () => {
    if (!window.confirm("Seed sample papers and MCQs in Firestore?")) return;
    setPolicyLoading(true);
    if (isMock) {
      // L2 fix: Call backend /papers to trigger auto-seed instead of being a no-op
      try {
        const response = await fetch(`${API_BASE_URL}/papers`);
        if (response.ok) {
          alert("Sample papers seeded via backend successfully (Mock Mode).");
        } else {
          alert("Backend seed failed. Is the server running?");
        }
      } catch (err) {
        alert("Could not reach backend to seed: " + err.message);
      }
      setPolicyLoading(false);
      return;
    }

    try {
      const paper1Id = "cse-set-a";
      await setDoc(doc(db, "papers", paper1Id), {
        title: "CSE Set A: Intro to Programming",
        subject: "Computer Science",
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
        subject: "Computer Science"
      });

      const paper2Id = "cse-set-b";
      await setDoc(doc(db, "papers", paper2Id), {
        title: "CSE Set B: OOP Concepts",
        subject: "Computer Science",
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
        subject: "Computer Science"
      });

      const paper3Id = "cse-set-c";
      await setDoc(doc(db, "papers", paper3Id), {
        title: "CSE Set C: Data Structures",
        subject: "Computer Science",
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
        subject: "Computer Science"
      });

      const paper4Id = "ee-set-a";
      await setDoc(doc(db, "papers", paper4Id), {
        title: "EE Set A: Ohm's Law Basics",
        subject: "Electrical Engineering",
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
        subject: "Electrical Engineering"
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
    if (isMock) {
      alert("Attempts cleared successfully (Mock Mode).");
      setPolicyLoading(false);
      return;
    }

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
    if (isMock || !db || !user) {
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
    alert("Logout is disabled during the development phase.");
  };

  // Sync whitelisted domains in real-time if live Firebase is active
  useEffect(() => {
    if (isMock || !db || !user) return;

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

    if (isMock) {
      // Mock flow
      setTimeout(() => {
        setAllowedDomains([...allowedDomains, formattedDomain]);
        setNewDomain('');
        setSettingsLoading(false);
      }, 500);
    } else {
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

    if (isMock) {
      // Mock flow
      setTimeout(() => {
        setAllowedDomains(allowedDomains.filter(d => d !== domain));
        setSettingsLoading(false);
      }, 500);
    } else {
      // Delete from Firestore
      try {
        await deleteDoc(doc(db, 'allowed_domains', domain));
      } catch (err) {
        console.error("Failed to delete domain from Firestore:", err);
        alert("Failed to delete from database: " + err.message);
      } finally {
        setSettingsLoading(false);
      }
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
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome to Dnyanshree Exam Portal</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              {role === 'superadmin' 
                ? 'Super Admin Command Console: Manage email domains whitelists, register teacher accounts, and review global system policies.'
                : 'Teacher Console: Conduct secure, proctored examinations. Monitor active student screens and review warnings.'}
            </p>
            
            {role === 'superadmin' ? (
              <div className="grid-cols-1-3" style={{ marginBottom: '2.5rem' }}>
                <div className="glass-card">
                  <span className="badge badge-success" style={{ marginBottom: '1rem' }}>Active</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Live Exam Sessions</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--primary)' }}>
                    {activeSessionsCount}
                  </p>
                </div>
                
                <div className="glass-card">
                  <span className="badge badge-info" style={{ marginBottom: '1rem' }}>Faculty</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Total Teachers</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                    {teachers.length}
                  </p>
                </div>

                <div className="glass-card">
                  <span className="badge badge-warning" style={{ marginBottom: '1rem' }}>Whitelists</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Allowed Domains</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent)' }}>
                    {allowedDomains.length}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid-cols-1-3" style={{ marginBottom: '2.5rem' }}>
                <div className="glass-card">
                  <span className="badge badge-success" style={{ marginBottom: '1rem' }}>Live</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Active Sessions</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--primary)' }}>
                    {activeSessionsCount}
                  </p>
                </div>
                
                <div className="glass-card">
                  <span className="badge badge-info" style={{ marginBottom: '1rem' }}>Storage</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>MCQ Question Papers</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                    {papersCount}
                  </p>
                </div>

                <div className="glass-card" style={{ border: blockedCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)' }}>
                  <span className="badge badge-danger" style={{ marginBottom: '1rem' }}>Urgent</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Pending Review (Blocked)</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: blockedCount > 0 ? '#ef4444' : 'inherit' }}>
                    {blockedCount}
                  </p>
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
                  <span className={isMock ? "badge badge-warning" : "badge badge-success"}>
                    {isMock ? "Mock (Offline)" : "Connected"}
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
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
                      Waiting for proctoring events...
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {liveAlerts.map((alert) => (
                        <div 
                          key={alert.id} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            background: 'rgba(0, 0, 0, 0.15)',
                            borderLeft: alert.type === 'danger' || alert.type === 'malpractice' ? '3px solid #ef4444' :
                                       alert.type === 'warning' ? '3px solid #fbbf24' :
                                       alert.type === 'success' ? '3px solid #10b981' : '3px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <strong>{alert.studentName}</strong> {alert.message}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {parseTime(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
      case 'teachers':
        return (
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Teacher Management</h2>
            
            <div className="grid-cols-1-2" style={{ alignItems: 'flex-start', gap: '2rem' }}>
              <div className="glass-card" style={{ textAlign: 'left' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Register Teacher Account
                </h3>
                <form onSubmit={handleCreateTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                      Teacher Full Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Prof. Ramesh Deshmukh"
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                      Teacher Email
                    </label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="e.g. ramesh@dnyanshree.edu.in"
                      value={newTeacherEmail}
                      onChange={(e) => setNewTeacherEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                      Primary Subject Dept
                    </label>
                    <select
                      className="input-field"
                      value={newTeacherSubject}
                      onChange={(e) => setNewTeacherSubject(e.target.value)}
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electrical Engineering">Electrical Engineering</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
                    ➕ Create Account
                  </button>
                </form>
              </div>

              <div className="glass-card" style={{ textAlign: 'left' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Active Faculty Directory ({teachers.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {teachers.map(t => (
                    <div key={t.uid} className="flex-between" style={{
                      padding: '1rem',
                      background: 'rgba(0, 0, 0, 0.15)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{t.name}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.email}</p>
                        <span className="badge badge-info" style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                          {t.subject}
                        </span>
                      </div>
                      {t.uid !== 'mock-uid-teacher-456' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => handleDeleteTeacher(t.uid)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
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

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
            DIET <span style={{ color: 'var(--primary)' }}>Proctor</span>
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isMock ? "🔧 Mock Mode (Offline)" : "📡 Live Mode"}
          </p>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          <div 
            className={`sidebar-link ${activeTab === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </div>
          
          {role === 'teacher' ? (
            <>
              <div 
                className={`sidebar-link ${activeTab === 'papers' ? 'active' : ''}`} 
                onClick={() => setActiveTab('papers')}
              >
                📝 Question Papers
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'live' ? 'active' : ''}`} 
                onClick={() => setActiveTab('live')}
              >
                📡 Live Monitor
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'students' ? 'active' : ''}`} 
                onClick={() => setActiveTab('students')}
              >
                👥 Students
              </div>
            </>
          ) : (
            <>
              <div 
                className={`sidebar-link ${activeTab === 'domains' ? 'active' : ''}`} 
                onClick={() => setActiveTab('domains')}
              >
                🌐 Domain Whitelists
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'teachers' ? 'active' : ''}`} 
                onClick={() => setActiveTab('teachers')}
              >
                👥 Faculty Directory
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'policies' ? 'active' : ''}`} 
                onClick={() => setActiveTab('policies')}
              >
                🛠️ Exam Policies
              </div>
            </>
          )}
        </nav>

        {/* Development Console Switcher */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', textAlign: 'left' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Console Switcher (Dev)
          </p>
          <select 
            value={role} 
            onChange={(e) => {
              const newRole = e.target.value;
              setRole(newRole);
              setUser(prev => ({ ...prev, role: newRole, name: newRole === 'superadmin' ? 'Mock Super Admin' : 'Mock Teacher (Dev)' }));
              setActiveTab('overview');
            }} 
            className="input-field"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            <option value="teacher">👨‍🏫 Teacher Console</option>
            <option value="superadmin">👑 Super Admin Console</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged in as:</p>
          <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{user.name}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              {role === 'superadmin' ? 'Super Admin Console' : 'Teacher Console'}
            </h4>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{activeTab}</h1>
          </div>
          <div>
            <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </header>
        
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
