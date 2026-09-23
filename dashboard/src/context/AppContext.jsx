import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, getDoc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
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
  const [questions, setQuestions] = useState([]);
  const [allowedDomains, setAllowedDomains] = useState(['dnyanshree.edu.in']);
  
  // Policies & Settings
  const [defaultDuration, setDefaultDuration] = useState(45);
  const [warningThreshold, setWarningThreshold] = useState(3);

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
                alert('Access Denied: Student accounts cannot access the Teacher/Admin Dashboard.');
                setAuthLoading(false);
                return;
              }
            } else {
              const isAdminEmail = firebaseUser.email?.toLowerCase().startsWith('admin');
              const autoRole = isAdminEmail ? 'superadmin' : 'teacher';
              const autoDept = isAdminEmail ? 'Administration' : 'Unassigned';

              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: userName,
                role: autoRole,
                department: autoDept,
                semester: 'N/A',
                prnNumber: 'N/A',
                createdAt: new Date().toISOString()
              }, { merge: true });
              userRole = autoRole;
            }
          }
        } catch (e) {
          console.warn('Could not sync Firestore profile on auth change:', e);
        }

        const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin' || firebaseUser.email?.startsWith('admin');
        const finalRole = isSuperAdmin ? 'superadmin' : 'teacher';
        setRole(finalRole);

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: userName,
          role: userRole,
          token
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Single-source Firestore Subscriptions (Active only when user logged in)
  useEffect(() => {
    if (!db || !user) return;

    // 1. Users (Teachers & Students)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const studentList = [];
      const teacherList = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = { id: docSnap.id, uid: docSnap.id, ...data };
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
    }, (err) => console.error('Error syncing users in AppContext:', err));

    // 2. Exam Attempts
    const unsubAttempts = onSnapshot(collection(db, 'exam_attempts'), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAttempts(list);
    }, (err) => console.error('Error syncing exam_attempts in AppContext:', err));

    // 3. Papers
    const unsubPapers = onSnapshot(collection(db, 'papers'), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPapers(list);
    }, (err) => console.error('Error syncing papers in AppContext:', err));

    // 4. Exams
    const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setExams(list);
    }, (err) => console.error('Error syncing exams in AppContext:', err));

    // 5. Questions
    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setQuestions(list);
    }, (err) => console.error('Error syncing questions in AppContext:', err));

    // 6. Whitelisted Domains
    const unsubDomains = onSnapshot(collection(db, 'allowed_domains'), (snapshot) => {
      const domains = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.data().isActive !== false) {
          domains.push(docSnap.id);
        }
      });
      if (domains.length > 0) setAllowedDomains(domains);
    }, (err) => console.error('Error syncing allowed_domains in AppContext:', err));

    return () => {
      unsubUsers();
      unsubAttempts();
      unsubPapers();
      unsubExams();
      unsubQuestions();
      unsubDomains();
    };
  }, [user]);

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
    getAuthToken
  }), [
    user,
    role,
    authLoading,
    students,
    teachers,
    attempts,
    papers,
    exams,
    questions,
    allowedDomains,
    defaultDuration,
    warningThreshold,
    getAuthToken
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
