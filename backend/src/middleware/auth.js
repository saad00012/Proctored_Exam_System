const { admin, db } = require('../firebase');

// Helper to check if a user has Admin/SuperAdmin privileges ONLY
const isAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'superadmin' ||
    (user.uid && user.uid.startsWith('mock-uid-admin')) ||
    email.startsWith('admin') ||
    email.includes('admin')
  );
};

// Helper to check if a user has faculty/teacher/admin privileges
const isTeacherOrAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return (
    role === 'teacher' ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'faculty' ||
    (user.uid && (user.uid.startsWith('mock-uid-teacher') || user.uid.startsWith('mock-uid-admin'))) ||
    email.startsWith('admin') ||
    email.startsWith('teacher') ||
    email.includes('admin') ||
    email.includes('faculty')
  );
};

const isAdminOrTeacher = isTeacherOrAdmin;

// Helper middleware for Firebase ID token verification with server-side domain verification
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (!admin || !db) {
    console.error('❌ Firebase not initialized. Cannot verify token.');
    return res.status(500).json({ error: 'Internal Server Error: Database not connected.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;
    if (!email) {
      return res.status(400).json({ error: 'Forbidden: Firebase token does not contain an email address.' });
    }

    const domain = email.substring(email.lastIndexOf('@') + 1);
    
    // Server-side Domain Whitelist re-validation
    const domainDoc = await db.collection('allowed_domains').doc(domain).get();
    if (!domainDoc.exists || !domainDoc.data().isActive) {
      return res.status(403).json({ error: `Forbidden: Email domain @${domain} is not whitelisted or is inactive.` });
    }

    // Attach decoded user info
    req.user = decodedToken;
    
    // Fetch role & details from Firestore user profile
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const rawRole = (data.role || '').toLowerCase();
      req.user.role = (rawRole === 'teacher' || rawRole === 'admin' || rawRole === 'superadmin' || rawRole === 'faculty') 
        ? rawRole 
        : (data.role || 'student');
      req.user.name = data.name || decodedToken.name || (email ? email.split('@')[0] : 'User');
      req.user.department = data.department || 'Unassigned';
      req.user.semester = data.semester || 'N/A';
      req.user.prnNumber = data.prnNumber || 'N/A';
    } else {
      // Auto-heal: If user doc is missing in Firestore, resolve from Firebase Auth
      let resolvedName = decodedToken.name || (email ? email.split('@')[0] : 'User');
      try {
        const authRecord = await admin.auth().getUser(decodedToken.uid);
        if (authRecord.displayName) {
          resolvedName = authRecord.displayName;
        }
      } catch (e) {
        // fallback
      }

      const isTeacherEmail = email.toLowerCase().startsWith('admin') || email.toLowerCase().startsWith('teacher') || email.toLowerCase().includes('admin');
      const defaultRole = isTeacherEmail ? 'teacher' : 'student';

      req.user.role = defaultRole;
      req.user.name = resolvedName;
      req.user.department = 'Unassigned';
      req.user.semester = 'N/A';
      req.user.prnNumber = 'N/A';

      // Heal user doc in Firestore in background
      db.collection('users').doc(decodedToken.uid).set({
        uid: decodedToken.uid,
        name: resolvedName,
        email: email,
        role: defaultRole,
        department: 'Unassigned',
        semester: 'N/A',
        prnNumber: 'N/A',
        collegeDomain: domain,
        createdAt: new Date().toISOString()
      }).catch(err => console.warn('Could not auto-heal user doc in Firestore:', err.message));
    }

    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
};

// Async route wrapper utility to prevent uncaught exceptions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  isAdmin,
  isTeacherOrAdmin,
  isAdminOrTeacher,
  verifyToken,
  asyncHandler
};
