import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, doc, getDoc, setDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import API_BASE_URL from '../config';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('teacher'); // 'superadmin' or 'teacher'
  const [authLoading, setAuthLoading] = useState(true);

  // Shared Data
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [papers, setPapers] = useState([]);
  const [exams, setExams] = useState([]);
  const DEFAULT_DEPARTMENTS = [
    'AI & DS Engineering',
    'Civil Engineering',
    'Civil & Environmental Engineering',
    'Computer Science & Engineering',
    'Electrical Engineering',
    'Electrical & Computer Engineering',
    'Electronics & Telecommunication Engineering',
    'Mechanical Engineering',
    'Mechanical & Mechatronics Engineering',
    'Applied Science & Engineering'
  ];

  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [questions, setQuestions] = useState([]);
  const [allowedDomains, setAllowedDomains] = useState(['dnyanshree.edu.in']);
  
  // Policies & Settings
  const [defaultDuration, setDefaultDuration] = useState(45);
  const [warningThreshold, setWarningThreshold] = useState(3);

  // Inactivity & Sleep / Auto-Pause Mode state (to avoid runaway read charges)
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(true);
  const [isIdlePaused, setIsIdlePaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(null); // 'idle' | 'background' | 'manual'

  // Exam History load state
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasHistoryLoaded, setHasHistoryLoaded] = useState(false);

  // Helper to fetch fresh ID token
  const getAuthToken = useCallback(async () => {
    try {
      if (auth && auth.currentUser) {
        return await auth.currentUser.getIdToken(true);
      }
    } catch (e) {
      console.warn('Could not get fresh token:', e);
    }
    return user?.token || '';
  }, [user]);

  // Dynamic Department Actions
  const addDepartment = useCallback(async (deptName) => {
    const trimmed = (deptName || '').trim();
    if (!trimmed) throw new Error('Department name cannot be empty.');
    if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Department "${trimmed}" already exists.`);
    }

    const updatedList = [...departments, trimmed];
    if (db) {
      await setDoc(doc(db, 'settings', 'departments'), {
        list: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      }, { merge: true });
    }
    setDepartments(updatedList);
    return updatedList;
  }, [departments, user]);

  const updateDepartment = useCallback(async (oldName, newName) => {
    const trimmedNew = (newName || '').trim();
    if (!trimmedNew) throw new Error('New department name cannot be empty.');
    if (oldName.toLowerCase() !== trimmedNew.toLowerCase() && departments.some(d => d.toLowerCase() === trimmedNew.toLowerCase())) {
      throw new Error(`Department "${trimmedNew}" already exists.`);
    }

    const updatedList = departments.map(d => d === oldName ? trimmedNew : d);
    if (db) {
      await setDoc(doc(db, 'settings', 'departments'), {
        list: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      }, { merge: true });
    }
    setDepartments(updatedList);
    return updatedList;
  }, [departments, user]);

  const deleteDepartment = useCallback(async (deptName) => {
    if (departments.length <= 1) {
      throw new Error('At least one department must remain configured.');
    }
    const updatedList = departments.filter(d => d !== deptName);
    if (db) {
      await setDoc(doc(db, 'settings', 'departments'), {
        list: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      }, { merge: true });
    }
    setDepartments(updatedList);
    return updatedList;
  }, [departments, user]);

  // Firestore sync for settings/departments
  useEffect(() => {
    if (!db) return;
    const deptDocRef = doc(db, 'settings', 'departments');
    const unsubDept = onSnapshot(deptDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.list) && data.list.length > 0) {
          const missingDefaults = DEFAULT_DEPARTMENTS.filter(
            d => !data.list.some(existing => existing.trim().toLowerCase() === d.trim().toLowerCase())
          );
          if (missingDefaults.length > 0) {
            const mergedList = [...data.list, ...missingDefaults];
            setDepartments(mergedList);
            setDoc(deptDocRef, {
              list: mergedList,
              updatedAt: new Date().toISOString(),
              updatedBy: 'system-auto-merge'
            }, { merge: true }).catch(err => console.warn('Auto-merge departments error:', err));
          } else {
            setDepartments(data.list);
          }
        }
      } else {
        // Initialize with default list if not yet present in database
        setDoc(deptDocRef, {
          list: DEFAULT_DEPARTMENTS,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn('Init departments error:', err));
      }
    }, (err) => console.error('Error syncing departments in AppContext:', err));

    return () => unsubDept();
  }, []);

  // Auth Observer
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        let userRole = 'teacher';
        let userName = firebaseUser.displayName || 'Teacher';
        let userDept = 'Computer Science & Engineering';
        let userDepts = ['Computer Science & Engineering'];

        try {
          if (db) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const data = userDocSnap.data();
              userRole = data.role || 'teacher';
              userName = data.name || userName;
              userDept = data.department || userDept;
              if (Array.isArray(data.departments) && data.departments.length > 0) {
                userDepts = data.departments;
              } else if (data.department) {
                userDepts = [data.department];
              }
              if (userRole === 'student') {
                await signOut(auth);
                setUser(null);
                alert('Access Denied: Student accounts cannot access the Teacher/Admin Dashboard.');
                setAuthLoading(false);
                return;
              }
            } else {
              const isAdminEmail = firebaseUser.email?.toLowerCase().startsWith('admin');
              const autoRole = isAdminEmail ? 'superadmin' : 'teacher';
              const autoDept = isAdminEmail ? 'Administration' : 'Computer Science & Engineering';

              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: userName,
                role: autoRole,
                department: autoDept,
                departments: [autoDept],
                semester: 'N/A',
                prnNumber: 'N/A',
                createdAt: new Date().toISOString()
              }, { merge: true });
              userRole = autoRole;
              userDept = autoDept;
              userDepts = [autoDept];
            }
          }
        } catch (e) {
          console.warn('Could not sync Firestore profile on auth change:', e);
        }

        const emailLower = (firebaseUser.email || '').toLowerCase();
        const isSuperAdmin = userRole === 'superadmin' || 
                             userRole === 'admin' || 
                             emailLower.startsWith('admin') || 
                             emailLower.includes('admin') || 
                             emailLower === 'yash.chiplunkar@dnyanshree.edu.in';
        const finalRole = isSuperAdmin ? 'superadmin' : 'teacher';
        setRole(finalRole);

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: userName,
          role: finalRole,
          department: userDept,
          departments: userDepts,
          token
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // INACTIVITY & TAB VISIBILITY DETECTOR (Auto-Pauses Live Sync to Save Quota)
  // ─────────────────────────────────────────────────────────────────────────────
  const resumeLiveSync = useCallback(() => {
    setIsIdlePaused(false);
    setPauseReason(null);
    setIsLiveSyncActive(true);
  }, []);

  const toggleLiveSync = useCallback(() => {
    setIsLiveSyncActive(prev => {
      const next = !prev;
      if (!next) {
        setIsIdlePaused(false);
        setPauseReason('manual');
      } else {
        setPauseReason(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    let idleTimer = null;
    let bgTimer = null;
    const IDLE_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute no user interaction
    const BG_GRACE_PERIOD_MS = 1 * 60 * 1000; // 1 minute grace period for background tab

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      // Auto-wake if paused due to idle and user returns to typing/mouse
      if (isIdlePaused && pauseReason === 'idle') {
        setIsIdlePaused(false);
        setPauseReason(null);
        setIsLiveSyncActive(true);
      }
      idleTimer = setTimeout(() => {
        setIsIdlePaused(true);
        setPauseReason('idle');
        setIsLiveSyncActive(false);
        console.log('⏸️ [Proctor Console] Auto-paused live sync due to 1m inactivity to save Firestore reads.');
      }, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab minimized or in background — 1 min grace period:
        // If teacher returns within 1 minute, listener was NEVER dropped (0 reconnect penalty!)
        // If teacher is away > 1 min, disconnect completely to save reads.
        if (bgTimer) clearTimeout(bgTimer);
        bgTimer = setTimeout(() => {
          setIsIdlePaused(true);
          setPauseReason('background');
          setIsLiveSyncActive(false);
          console.log('⏸️ [Proctor Console] Auto-paused live sync: Tab hidden in background for >1 min.');
        }, BG_GRACE_PERIOD_MS);
      } else {
        // Tab restored to foreground
        if (bgTimer) {
          clearTimeout(bgTimer);
          bgTimer = null;
        }
        if (isIdlePaused && pauseReason === 'background') {
          setIsIdlePaused(false);
          setPauseReason(null);
          setIsLiveSyncActive(true);
          console.log('▶️ [Proctor Console] Resumed live sync on tab return.');
        }
        resetIdleTimer();
      }
    };

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (bgTimer) clearTimeout(bgTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isIdlePaused, pauseReason]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SOLUTION C: ONE-TIME STATIC DATA LOADERS (Users, Papers, Exams, Questions)
  // Instead of continuous full-collection streaming, fetch once and provide refresh.
  // ─────────────────────────────────────────────────────────────────────────────
  const refreshUsers = useCallback(async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      const studentList = [];
      const teacherList = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const depts = Array.isArray(data.departments) && data.departments.length > 0
          ? data.departments
          : (data.department ? [data.department] : []);
        const item = { id: docSnap.id, uid: docSnap.id, departments: depts, ...data };
        if (data.role === 'teacher') {
          teacherList.push(item);
        } else {
          studentList.push({
            id: docSnap.id,
            uid: docSnap.id,
            name: data.name || (data.email ? data.email.split('@')[0] : 'Unknown Student'),
            prnNumber: data.prnNumber || 'N/A',
            email: data.email || '',
            department: data.department || 'N/A',
            course: data.course || data.department || 'N/A',
            semester: data.semester || 'N/A',
            role: data.role || 'student',
            ...data
          });
        }
      });
      setStudents(studentList);
      setTeachers(teacherList);
    } catch (err) {
      console.error('Error fetching users in AppContext:', err);
    }
  }, []);

  const refreshPapers = useCallback(async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'papers'));
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPapers(list);
    } catch (err) {
      console.error('Error fetching papers in AppContext:', err);
    }
  }, []);

  const refreshExams = useCallback(async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'exams'));
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setExams(list);
    } catch (err) {
      console.error('Error fetching exams in AppContext:', err);
    }
  }, []);

  const refreshQuestions = useCallback(async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'questions'));
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setQuestions(list);
    } catch (err) {
      console.error('Error fetching questions in AppContext:', err);
    }
  }, []);

  const refreshAllStaticData = useCallback(async () => {
    await Promise.all([
      refreshUsers(),
      refreshPapers(),
      refreshExams(),
      refreshQuestions(),
      loadHistoricalAttempts()
    ]);
  }, [refreshUsers, refreshPapers, refreshExams, refreshQuestions, loadHistoricalAttempts]);

  // Initial load of static collections once when user logs in
  useEffect(() => {
    if (!db || !user) return;
    refreshAllStaticData();

    // Fetch allowed domains once
    getDocs(collection(db, 'allowed_domains')).then((snapshot) => {
      const domains = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.data().isActive !== false) {
          domains.push(docSnap.id);
        }
      });
      if (domains.length > 0) setAllowedDomains(domains);
    }).catch(err => console.error('Error fetching allowed_domains:', err));
  }, [user, refreshAllStaticData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SOLUTION A: DATE-SCOPED LIVE ATTEMPTS LISTENER (Today / Rolling 24 Hours Only)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!db || !user || !isLiveSyncActive) return;

    // Rolling 24-hour cutoff — captures any ongoing exam without loading past months
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const attemptsQuery = query(
      collection(db, 'exam_attempts'),
      where('startedAt', '>=', cutoffDate)
    );

    const unsubAttempts = onSnapshot(attemptsQuery, (snapshot) => {
      const liveList = [];
      snapshot.forEach((docSnap) => {
        liveList.push({ id: docSnap.id, ...docSnap.data() });
      });

      setAttempts(prev => {
        // If history is not yet populated, use live list
        if (prev.length === 0) return liveList;

        // Merge live updates into full history without erasing older records!
        const liveMap = new Map(liveList.map(item => [item.id, item]));
        const updated = prev.map(oldItem => liveMap.has(oldItem.id) ? liveMap.get(oldItem.id) : oldItem);
        const existingIds = new Set(prev.map(p => p.id));
        liveList.forEach(item => {
          if (!existingIds.has(item.id)) updated.push(item);
        });
        return updated;
      });
    }, (err) => console.error('Error syncing 24h exam_attempts in AppContext:', err));

    return () => unsubAttempts();
  }, [user, isLiveSyncActive]);

  // On-Demand loader for full historical attempts (for ExamHistory)
  const loadHistoricalAttempts = useCallback(async () => {
    if (!db) return [];
    setIsHistoryLoading(true);
    try {
      const snap = await getDocs(collection(db, 'exam_attempts'));
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAttempts(list);
      setHasHistoryLoaded(true);
      return list;
    } catch (e) {
      console.error('Failed to load historical attempts:', e);
      return [];
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // Global Policies loader
  useEffect(() => {
    if (!user) return;
    const loadConfig = async () => {
      try {
        const token = await getAuthToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/admin/policies`, { headers });
        if (response.ok) {
          const data = await response.json();
          setDefaultDuration(data.defaultDuration || 45);
          setWarningThreshold(data.warningThreshold || 3);
        }
      } catch (err) {
        console.error('Failed to load settings config from API:', err);
      }
    };
    loadConfig();
  }, [user, getAuthToken]);

  const value = useMemo(() => ({
    user,
    setUser,
    role,
    setRole,
    authLoading,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    students,
    teachers,
    attempts,
    setAttempts,
    papers,
    exams,
    questions,
    papersCount: papers.length,
    allowedDomains,
    setAllowedDomains,
    defaultDuration,
    setDefaultDuration,
    warningThreshold,
    setWarningThreshold,
    getAuthToken,
    // Realtime Sync & Auto-Pause controls
    isLiveSyncActive,
    isIdlePaused,
    pauseReason,
    resumeLiveSync,
    toggleLiveSync,
    // Static Data Refreshers
    refreshAllStaticData,
    refreshUsers,
    refreshPapers,
    refreshExams,
    refreshQuestions,
    // Historical Attempts Loader
    loadHistoricalAttempts,
    isHistoryLoading,
    hasHistoryLoaded
  }), [
    user,
    role,
    authLoading,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    students,
    teachers,
    attempts,
    papers,
    exams,
    questions,
    allowedDomains,
    defaultDuration,
    warningThreshold,
    getAuthToken,
    isLiveSyncActive,
    isIdlePaused,
    pauseReason,
    resumeLiveSync,
    toggleLiveSync,
    refreshAllStaticData,
    refreshUsers,
    refreshPapers,
    refreshExams,
    refreshQuestions,
    loadHistoricalAttempts,
    isHistoryLoading,
    hasHistoryLoaded
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
