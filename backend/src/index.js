const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Mock Database Models for fallback/local development
const mockPapers = new Map([
  ['cse-set-a', { id: 'cse-set-a', title: 'CSE Set A: OOP Concepts', department: 'Computer Science & Engineering', subject: 'Data Structures', status: 'published', durationMinutes: 45 }],
  ['cse-set-b', { id: 'cse-set-b', title: 'CSE Set B: Sorting Algorithms', department: 'Computer Science & Engineering', subject: 'Data Structures', status: 'published', durationMinutes: 45 }],
  ['cse-set-c', { id: 'cse-set-c', title: 'CSE Set C: Trees & Graphs', department: 'Computer Science & Engineering', subject: 'Data Structures', status: 'published', durationMinutes: 45 }],
  ['cse-set-d', { id: 'cse-set-d', title: 'CSE Set D: Recursion Basics', department: 'Computer Science & Engineering', subject: 'Data Structures', status: 'published', durationMinutes: 45 }]
]);

const mockQuestions = [
  { id: 'q1', paperId: 'cse-set-a', questionText: 'What is inheritance?', options: [{ text: 'Code reuse' }, { text: 'Polymorphism' }, { text: 'Encapsulation' }, { text: 'None' }], correctOptionIndex: 0 },
  { id: 'q2', paperId: 'cse-set-a', questionText: 'What is OOP?', options: [{ text: 'Object Oriented Programming' }, { text: 'Procedural' }, { text: 'Functional' }, { text: 'Logical' }], correctOptionIndex: 0 }
];

const mockConfig = {
  defaultDuration: 45,
  warningThreshold: 3
};

const mockExamAttempts = new Map();
let mockViolations = [];


const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize Firebase Admin SDK
let admin = null;
let db = null;
const serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'service-account.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully via JSON environment variable.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK from env var:', error.message);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require('firebase-admin');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully with service account JSON.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  }
} else if (process.env.NODE_ENV === 'production') {
  try {
    admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized using Google Cloud Application Default Credentials.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK with Application Default Credentials:', error.message);
  }
} else {
  console.warn(`⚠️ Warning: Service account file not found at ${serviceAccountPath}. Running in Mock mode.`);
}

// Helper to check if a user has faculty/admin/superadmin privileges
const isAdminOrTeacher = (user) => {
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

// Helper middleware for Firebase ID token verification with server-side domain verification
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 2. Real Firebase token verification
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

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    firebaseConnected: !!db,
    timestamp: new Date().toISOString()
  });
});

// 2. Validate email domain and mobile before registration
app.post('/register-check', async (req, res) => {
  const { email, phoneNumber } = req.body;
  if (!email || !phoneNumber) {
    return res.status(400).json({ error: 'Email and phone number are required.' });
  }

  const domain = email.substring(email.lastIndexOf('@') + 1);
  console.log(`Checking registration whitelist for domain: ${domain}`);

  if (!db) {
    // Mock whitelist fallback
    const isValid = domain === 'dnyanshree.edu.in';
    return res.json({
      allowed: isValid,
      domain,
      message: isValid ? 'Domain is whitelisted (mock).' : `Registration restricted to dnyanshree.edu.in.`
    });
  }

  try {
    const domainDoc = await db.collection('allowed_domains').doc(domain).get();
    if (domainDoc.exists && domainDoc.data().isActive) {
      return res.json({ allowed: true, domain });
    } else {
      return res.status(400).json({ allowed: false, error: `Email domain @${domain} is not whitelisted or is inactive.` });
    }
  } catch (error) {
    console.error('Error in /register-check:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Create/Update Profile (called after registration in Firebase Auth)
app.post('/create-profile', verifyToken, async (req, res) => {
  const { name, phoneNumber, role, department, semester, prnNumber } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required.' });
  }

  const email = req.user.email;
  const uid = req.user.uid;
  const domain = email.substring(email.lastIndexOf('@') + 1);

  const userProfile = {
    uid,
    name,
    email,
    phoneNumber: phoneNumber || '',
    role: role === 'teacher' ? 'teacher' : 'student',
    collegeDomain: domain,
    department: department || 'Unassigned',
    semester: semester || 'N/A',
    prnNumber: (prnNumber || 'N/A').toUpperCase(),
    createdAt: new Date().toISOString()
  };

  console.log(`Creating user profile for UID ${uid}:`, userProfile);

  if (!db) {
    // Mock database write
    return res.json({
      message: 'Profile created successfully (mock)',
      user: userProfile
    });
  }

  try {
    await db.collection('users').doc(uid).set(userProfile);
    return res.json({
      message: 'Profile created successfully.',
      user: userProfile
    });
  } catch (error) {
    console.error('Error in /create-profile:', error);
    return res.status(500).json({ error: 'Failed to create user profile in database.' });
  }
});



// 4. Start Exam
app.post('/start-exam', verifyToken, async (req, res) => {
  let { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const studentName = req.user.name || 'Student';
  const studentEmail = req.user.email || '';
  const studentPrn = req.user.prnNumber || 'N/A';
  const studentDept = req.user.department || 'Unassigned';
  const studentSem = req.user.semester || 'N/A';

  try {
    let paperDepartment = '';
    let paperTitle = '';
    let paperSubject = '';

    // 1. Fetch Paper details
    let paperObj = null;
    if (db) {
      const paperDoc = await db.collection('papers').doc(paperId).get();
      if (!paperDoc.exists) {
        return res.status(404).json({ error: 'Exam paper not found.' });
      }
      paperObj = paperDoc.data();
    } else {
      paperObj = mockPapers.get(paperId);
      if (!paperObj) {
        return res.status(404).json({ error: 'Exam paper not found (mock).' });
      }
    }
    paperDepartment = paperObj.department;
    paperTitle = paperObj.title;
    paperSubject = paperObj.subject || paperObj.title || '';

    // Security Check: Ensure student matches paper department and semester
    if (req.user.role === 'student') {
      if (req.user.department !== 'All' && paperDepartment !== req.user.department) {
        return res.status(403).json({ error: 'Forbidden: This exam belongs to a different department.' });
      }
      if (paperObj.semester && req.user.semester && String(paperObj.semester) !== String(req.user.semester)) {
        return res.status(403).json({ error: `Forbidden: This exam is for Semester ${paperObj.semester}, but you are in Semester ${req.user.semester}.` });
      }
    }

    // Schedule Window Check: Block students from starting outside the configured time window
    if (req.user.role === 'student') {
      const now = new Date();
      if (paperObj.scheduleStart) {
        const scheduleStart = new Date(paperObj.scheduleStart);
        if (now < scheduleStart) {
          return res.status(403).json({
            error: `Exam has not started yet. It is scheduled to open on ${scheduleStart.toLocaleString()}. Please wait.`,
            scheduleStart: paperObj.scheduleStart,
            scheduleEnd: paperObj.scheduleEnd || null
          });
        }
      }
      if (paperObj.scheduleEnd) {
        const scheduleEnd = new Date(paperObj.scheduleEnd);
        if (now > scheduleEnd) {
          return res.status(403).json({
            error: `Exam window has closed. This exam ended on ${scheduleEnd.toLocaleString()}.`,
            scheduleStart: paperObj.scheduleStart || null,
            scheduleEnd: paperObj.scheduleEnd
          });
        }
      }
    }

    // 2. Load Warning Threshold and Duration (F1: check per-paper duration first)
    let defaultDurationSeconds = paperObj.durationMinutes ? (parseInt(paperObj.durationMinutes) * 60) : null;
    let warningThreshold = 3;

    if (db) {
      const configDoc = await db.collection('settings').doc('config').get();
      if (configDoc.exists) {
        if (!defaultDurationSeconds) {
          const durationMin = configDoc.data().defaultDuration || 45;
          defaultDurationSeconds = durationMin * 60;
        }
        warningThreshold = configDoc.data().warningThreshold || 3;
      }
    } else {
      if (!defaultDurationSeconds) {
        defaultDurationSeconds = mockConfig.defaultDuration * 60;
      }
      warningThreshold = mockConfig.warningThreshold;
    }
    if (!defaultDurationSeconds) defaultDurationSeconds = 2700;

    // 3. Retrieve all attempts by student to find status/prior warnings and calculate remaining time
    let priorAttempts = [];
    let isBlocked = false;

    if (db) {
      const attemptsSnapshot = await db.collection('exam_attempts')
        .where('studentId', '==', studentId)
        .get();
      
      attemptsSnapshot.forEach(doc => {
        priorAttempts.push({ id: doc.id, ...doc.data() });
      });
    } else {
      mockExamAttempts.forEach((val) => {
        if (val.studentId === studentId) {
          priorAttempts.push(val);
        }
      });
    }

    // A2 Optimization: Batch pre-fetch all paper subjects for prior attempts to eliminate N+1 Firestore queries
    const paperSubjectMap = {};
    if (db && priorAttempts.length > 0) {
      const uniquePaperIds = [...new Set(priorAttempts.map(a => a.paperId))];
      const paperDocs = await Promise.all(
        uniquePaperIds.map(id => db.collection('papers').doc(id).get())
      );
      paperDocs.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          paperSubjectMap[doc.id] = data.subject || data.title || '';
        }
      });
    } else {
      priorAttempts.forEach(att => {
        const mockP = mockPapers.get(att.paperId);
        paperSubjectMap[att.paperId] = mockP?.subject || mockP?.title || '';
      });
    }

    const getSubjectForPaper = (pId) => paperSubjectMap[pId] || '';

    // Check if user is currently blocked (failed malpractice or blocked pending review in this subject)
    for (const att of priorAttempts) {
      if (att.status === 'blocked_pending_review' || att.status === 'malpractice_failed') {
        const attSubject = getSubjectForPaper(att.paperId);
        if (attSubject === paperSubject) {
          isBlocked = true;
          break;
        }
      }
    }

    if (isBlocked) {
      return res.status(403).json({ error: 'You are blocked from starting exams in this subject due to malpractice infractions.' });
    }

    // Reassignment logic for same-subject soft violation (exited_on_violation)
    let hasSameSubjectSoftViolation = false;
    for (const att of priorAttempts) {
      if (att.status === 'exited_on_violation') {
        const attSubject = getSubjectForPaper(att.paperId);
        if (attSubject === paperSubject) {
          hasSameSubjectSoftViolation = true;
          break;
        }
      }
    }

    if (hasSameSubjectSoftViolation) {
      let candidatePapers = [];
      if (db) {
        const papersSnapshot = await db.collection('papers')
          .where('subject', '==', paperSubject)
          .where('status', '==', 'published')
          .get();
        papersSnapshot.forEach(doc => {
          candidatePapers.push({ id: doc.id, ...doc.data() });
        });
      } else {
        mockPapers.forEach((val, key) => {
          if ((val.subject || val.title || '') === paperSubject && val.status === 'published') {
            candidatePapers.push({ id: key, ...val });
          }
        });
      }

      const usedPaperIds = new Set(priorAttempts.map(att => att.paperId));
      const unusedPapers = candidatePapers.filter(p => !usedPaperIds.has(p.id));

      if (unusedPapers.length > 0) {
        const selectedPaper = unusedPapers[Math.floor(Math.random() * unusedPapers.length)];
        paperId = selectedPaper.id;
        paperTitle = selectedPaper.title;
        console.log(`🔁 Reassigning student ${studentId} to new paper set ${paperId} after violation.`);
      } else {
        console.log(`🔁 No unused papers remaining. Student ${studentId} is resuming current paper ${paperId}.`);
      }
    }    // Recompute attemptId using final (possibly reassigned) paperId
    const attemptId = `${studentId}_${paperId}`;

    // 4. Calculate total elapsed time across prior attempts in this subject
    let totalPriorElapsed = 0;
    let customOverrideSeconds = 0;
    let subjectWarningsCount = 0;

    for (const att of priorAttempts) {
      const attSubject = getSubjectForPaper(att.paperId);

      if (attSubject === paperSubject) {
        subjectWarningsCount += att.warnings || 0;
      }

      if (att.paperId !== paperId) {
        if (attSubject === paperSubject) {
          totalPriorElapsed += att.elapsedTime || 0;
          // C3 fix: If this is a violated attempt with remaining override time, carry it forward
          if (att.status === 'exited_on_violation' && att.overrideTimeSeconds > 0) {
            customOverrideSeconds = Math.max(customOverrideSeconds, att.overrideTimeSeconds);
          }
        }
      } else {
        // If they are restarting the exact same paper they were on, we retrieve the overrideTimeSeconds or use default
        if (att.overrideTimeSeconds > 0) {
          customOverrideSeconds = att.overrideTimeSeconds;
        }
      }
    }

    // Strongly consistent direct document check for custom override time
    if (db) {
      const attemptDoc = await db.collection('exam_attempts').doc(attemptId).get();
      if (attemptDoc.exists) {
        const attData = attemptDoc.data();
        if (attData.overrideTimeSeconds > 0) {
          customOverrideSeconds = attData.overrideTimeSeconds;
        }
      }
    } else {
      const existing = mockExamAttempts.get(attemptId);
      if (existing && existing.overrideTimeSeconds > 0) {
        customOverrideSeconds = existing.overrideTimeSeconds;
      }
    }

    // Time Left = default duration - prior elapsed time
    let calculatedTimeLeft = defaultDurationSeconds - totalPriorElapsed;
    if (customOverrideSeconds > 0) {
      calculatedTimeLeft = customOverrideSeconds;
    }
    
    // Ensure a minimum 10 seconds fallback
    calculatedTimeLeft = Math.max(10, calculatedTimeLeft);

    // 5. Create / Update the attempt document
    const attemptData = {
      studentId,
      studentName,
      studentEmail,
      prnNumber: studentPrn,
      department: studentDept,
      semester: studentSem,
      paperId,
      answers: {},
      status: 'started',
      elapsedTime: 0,
      startedAt: new Date().toISOString(), // Use ISO string for consistency
      warnings: 0,
      overrideTimeSeconds: calculatedTimeLeft
    };

    // Terminate any other active/exited attempts for other papers in the same subject pool
    if (db) {
      const batch = db.batch();
      let terminatedCount = 0;
      for (const att of priorAttempts) {
        if (att.paperId !== paperId) {
          let attSubject = '';
          const pDoc = await db.collection('papers').doc(att.paperId).get();
          if (pDoc.exists) attSubject = pDoc.data().subject || pDoc.data().title || '';

          if (attSubject === paperSubject && (att.status === 'started' || att.status === 'exited_on_violation')) {
            const oldAttemptRef = db.collection('exam_attempts').doc(att.id);
            // C5 fix: Compute final elapsedTime including time since last startedAt
            const attStartedAt = att.startedAt ? new Date(att.startedAt).getTime() : Date.now();
            const sinceLastStart = att.status === 'started' ? Math.min(15, Math.max(0, Math.round((Date.now() - attStartedAt) / 1000))) : 0;
            const finalElapsed = (att.elapsedTime || 0) + sinceLastStart;
            batch.update(oldAttemptRef, {
              status: 'terminated_reassigned',
              elapsedTime: finalElapsed,
              overrideTimeSeconds: 0,
              submittedAt: new Date().toISOString()
            });
            terminatedCount++;
          }
        }
      }
      if (terminatedCount > 0) {
        await batch.commit();
      }
    } else {
      mockExamAttempts.forEach((att) => {
        if (att.studentId === studentId && att.paperId !== paperId) {
          const mockP = mockPapers.get(att.paperId);
          const attSubject = mockP?.subject || mockP?.title || '';
          if (attSubject === paperSubject && (att.status === 'started' || att.attStatus === 'exited_on_violation')) {
            // C5 fix: Compute final elapsedTime before terminating
            const attStartedAt = att.startedAt ? new Date(att.startedAt).getTime() : Date.now();
            const sinceLastStart = att.status === 'started' ? Math.min(15, Math.max(0, Math.round((Date.now() - attStartedAt) / 1000))) : 0;
            att.elapsedTime = (att.elapsedTime || 0) + sinceLastStart;
            att.overrideTimeSeconds = 0;
            att.status = 'terminated_reassigned';
            att.submittedAt = new Date().toISOString();
          }
        }
      });
    }

    if (db) {
      await db.runTransaction(async (transaction) => {
        const attemptRef = db.collection('exam_attempts').doc(attemptId);
        const attemptDoc = await transaction.get(attemptRef);
        if (attemptDoc.exists) {
          const data = attemptDoc.data();
          if (data.status === 'submitted') {
            throw new Error('You have already submitted this exam.');
          }
          transaction.update(attemptRef, {
            status: 'started',
            startedAt: new Date().toISOString(),
            overrideTimeSeconds: calculatedTimeLeft
          });
        } else {
          transaction.set(attemptRef, attemptData);
        }
      });
    } else {
      const existing = mockExamAttempts.get(attemptId);
      if (existing) {
        if (existing.status === 'submitted') {
          return res.status(400).json({ error: 'You have already submitted this exam.' });
        }
        existing.status = 'started';
        existing.startedAt = new Date().toISOString();
        existing.overrideTimeSeconds = calculatedTimeLeft;
      } else {
        mockExamAttempts.set(attemptId, attemptData);
      }
    }

    let questionsList = [];
    if (db) {
      const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
      qSnap.forEach(doc => {
        questionsList.push({ id: doc.id, ...doc.data() });
      });
    }
    if (questionsList.length === 0) {
      questionsList = mockQuestions.filter(q => q.paperId === paperId);
    }

    const publicQuestions = questionsList.map(q => {
      const qCopy = { ...q };
      delete qCopy.correctOptionIndex;
      return qCopy;
    });

    res.json({
      message: 'Exam session started',
      sessionId: attemptId,
      paperId,
      remainingTimeSeconds: calculatedTimeLeft,
      warningsCount: subjectWarningsCount,
      paper: {
        title: paperTitle,
        department: paperDepartment
      },
      questions: publicQuestions
    });
  } catch (error) {
    console.error('Error in /start-exam:', error);
    if (error.message === 'You have already submitted this exam.') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to start exam session: ' + error.message });
  }
});

// 5. Submit Answer
app.post('/submit-answer', verifyToken, async (req, res) => {
  const { paperId, questionId, selectedOptionIndex } = req.body;
  if (!paperId || !questionId || selectedOptionIndex === undefined) {
    return res.status(400).json({ error: 'Paper ID, question ID, and selected option index are required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (db) {
      await db.runTransaction(async (transaction) => {
        const attemptRef = db.collection('exam_attempts').doc(attemptId);
        const attemptDoc = await transaction.get(attemptRef);
        if (!attemptDoc.exists) {
          throw new Error('Active exam attempt not found.');
        }
        const attempt = attemptDoc.data();
        if (attempt.status !== 'started') {
          throw new Error(`Cannot submit answer. Exam session status is currently: ${attempt.status}`);
        }

        const paperDoc = await transaction.get(db.collection('papers').doc(paperId));
        let paperDuration = 2700;
        if (paperDoc.exists && paperDoc.data().durationMinutes) {
          paperDuration = parseInt(paperDoc.data().durationMinutes) * 60;
        }

        const answers = attempt.answers || {};
        answers[questionId] = selectedOptionIndex;

        const startedAt = new Date(attempt.startedAt).getTime();
        const now = Date.now();
        const sessionElapsed = Math.round((now - startedAt) / 1000);
        const newElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
        const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
        const remaining = Math.max(0, currentLimit - sessionElapsed);

        transaction.update(attemptRef, {
          answers,
          startedAt: new Date().toISOString(),
          elapsedTime: newElapsedTime,
          overrideTimeSeconds: remaining
        });
      });
    } else {
      const attempt = mockExamAttempts.get(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Active exam attempt not found (mock).' });
      }
      if (attempt.status !== 'started') {
        return res.status(400).json({ error: `Cannot submit answer. Exam session status is currently: ${attempt.status}` });
      }

      let paperDuration = 2700;
      const paperObj = mockPapers.get(paperId);
      if (paperObj && paperObj.durationMinutes) {
        paperDuration = parseInt(paperObj.durationMinutes) * 60;
      }

      const answers = attempt.answers || {};
      answers[questionId] = selectedOptionIndex;

      const startedAt = new Date(attempt.startedAt).getTime();
      const now = Date.now();
      const sessionElapsed = Math.round((now - startedAt) / 1000);
      const newElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
      const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
      const remaining = Math.max(0, currentLimit - sessionElapsed);

      attempt.answers = answers;
      attempt.startedAt = new Date().toISOString();
      attempt.elapsedTime = newElapsedTime;
      attempt.overrideTimeSeconds = remaining;
    }

    res.json({
      message: 'Answer recorded authoritatively',
      sessionId: attemptId,
      questionId
    });
  } catch (error) {
    console.error('Error in /submit-answer:', error);
    if (error.message.includes('not found') || error.message.includes('Cannot submit answer')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to record answer: ' + error.message });
  }
});

// 6. Report Violation
app.post('/report-violation', verifyToken, async (req, res) => {
  const { paperId, reason } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    let paperDepartment = '';
    let paperSubject = '';
    let returnWarnings = 0;
    let nextStatus = 'exited_on_violation';
    let studentName = 'Student';

    if (db) {
      await db.runTransaction(async (transaction) => {
        const attemptRef = db.collection('exam_attempts').doc(attemptId);
        const attemptDoc = await transaction.get(attemptRef);
        if (!attemptDoc.exists) {
          throw new Error('Active exam attempt not found.');
        }
        const attempt = attemptDoc.data();
        if (attempt.status !== 'started') {
          throw new Error('Violation cannot be reported for an inactive session.');
        }
        studentName = attempt.studentName || 'Student';

        const paperDoc = await transaction.get(db.collection('papers').doc(paperId));
        let paperDuration = 2700;
        if (paperDoc.exists) {
          paperDepartment = paperDoc.data().department;
          paperSubject = paperDoc.data().subject || paperDoc.data().title || '';
          if (paperDoc.data().durationMinutes) {
            paperDuration = parseInt(paperDoc.data().durationMinutes) * 60;
          }
        }

        const configDoc = await transaction.get(db.collection('settings').doc('config'));
        let warningThreshold = 3;
        if (configDoc.exists) {
          warningThreshold = configDoc.data().warningThreshold || 3;
        }

        let cumulativeWarnings = 0;
        const attemptsSnapshot = await db.collection('exam_attempts')
          .where('studentId', '==', studentId)
          .get();
        
        for (const doc of attemptsSnapshot.docs) {
          if (doc.id === attemptId) continue;
          const attDoc = doc.data();
          const pDoc = await db.collection('papers').doc(attDoc.paperId).get();
          if (pDoc.exists && (pDoc.data().subject || pDoc.data().title || '') === paperSubject) {
            cumulativeWarnings += attDoc.warnings || 0;
          }
        }

        cumulativeWarnings += attempt.warnings || 0;

        const newWarningsForAttempt = (attempt.warnings || 0) + 1;
        const totalWarningsInSubject = cumulativeWarnings + 1;
        returnWarnings = totalWarningsInSubject;

        const startedAt = new Date(attempt.startedAt).getTime();
        const now = Date.now();
        const sessionElapsed = Math.round((now - startedAt) / 1000);
        const newElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
        const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
        const finalRemainingSeconds = Math.max(0, currentLimit - sessionElapsed);

        if (totalWarningsInSubject >= warningThreshold) {
          // Check if student has unused paper sets left in this subject pool
          const papersSnapshot = await db.collection('papers')
            .where('subject', '==', paperSubject)
            .where('status', '==', 'published')
            .get();
          const candidatePaperIds = papersSnapshot.docs.map(doc => doc.id);
          
          const attemptedPaperIds = new Set(attemptsSnapshot.docs.map(doc => doc.data().paperId));
          attemptedPaperIds.add(paperId); // Include current paper

          const unusedPapersCount = candidatePaperIds.filter(pId => !attemptedPaperIds.has(pId)).length;

          if (unusedPapersCount === 0) {
            nextStatus = 'malpractice_failed'; // Permanent block
          } else {
            nextStatus = 'blocked_pending_review'; // Soft-block, overrideable
          }
        }

        transaction.update(attemptRef, {
          status: nextStatus,
          warnings: newWarningsForAttempt,
          elapsedTime: newElapsedTime,
          overrideTimeSeconds: finalRemainingSeconds
        });
      });
    } else {
      const attempt = mockExamAttempts.get(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Active exam attempt not found (mock).' });
      }
      if (attempt.status !== 'started') {
        return res.status(400).json({ error: 'Violation cannot be reported for an inactive session.' });
      }
      studentName = attempt.studentName || 'Student';
      const mockP = mockPapers.get(paperId);
      paperDepartment = mockP?.department || '';
      paperSubject = mockP?.subject || mockP?.title || '';

      let paperDuration = 2700;
      if (mockP && mockP.durationMinutes) {
        paperDuration = parseInt(mockP.durationMinutes) * 60;
      }

      let warningThreshold = mockConfig.warningThreshold;

      let cumulativeWarnings = 0;
      mockExamAttempts.forEach((val) => {
        const valP = mockPapers.get(val.paperId);
        const valSubject = valP?.subject || valP?.title || '';
        if (val.studentId === studentId && val.paperId !== paperId && valSubject === paperSubject) {
          cumulativeWarnings += val.warnings || 0;
        }
      });
      cumulativeWarnings += attempt.warnings || 0;

      const newWarningsForAttempt = (attempt.warnings || 0) + 1;
      const totalWarningsInSubject = cumulativeWarnings + 1;
      returnWarnings = totalWarningsInSubject;

      const startedAt = new Date(attempt.startedAt).getTime();
      const now = Date.now();
      const sessionElapsed = Math.round((now - startedAt) / 1000);
      const newElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
      const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
      const finalRemainingSeconds = Math.max(0, currentLimit - sessionElapsed);

      if (totalWarningsInSubject >= warningThreshold) {
        const candidatePaperIds = [];
        mockPapers.forEach((val, key) => {
          if ((val.subject || val.title || '') === paperSubject && val.status === 'published') {
            candidatePaperIds.push(key);
          }
        });

        const attemptedPaperIds = new Set();
        mockExamAttempts.forEach((val) => {
          if (val.studentId === studentId) {
            attemptedPaperIds.add(val.paperId);
          }
        });
        attemptedPaperIds.add(paperId);

        const unusedPapersCount = candidatePaperIds.filter(pId => !attemptedPaperIds.has(pId)).length;

        if (unusedPapersCount === 0) {
          nextStatus = 'malpractice_failed';
        } else {
          nextStatus = 'blocked_pending_review';
        }
      }

      attempt.status = nextStatus;
      attempt.warnings = newWarningsForAttempt;
      attempt.elapsedTime = newElapsedTime;
      attempt.overrideTimeSeconds = finalRemainingSeconds;
    }

    console.log(`📡 Sending FCM notification for violation... Student: ${studentName}, Subject: ${paperDepartment}, Violation Count: ${returnWarnings}, Action: ${nextStatus}`);
    
    const violationRecord = {
      studentId,
      studentName: studentName,
      paperId,
      department: paperDepartment,
      reason,
      timestamp: new Date().toISOString(),
      time: new Date().toISOString(),
      cumulativeWarnings: returnWarnings,
      actionTaken: nextStatus
    };

    if (db) {
      await db.collection('violations').add(violationRecord);
    } else {
      mockViolations.unshift(violationRecord);
    }

    res.json({
      message: 'Violation recorded',
      sessionId: attemptId,
      warnings: returnWarnings,
      actionRequired: nextStatus === 'blocked_pending_review' ? 'hard_block' : 'force_logout'
    });
  } catch (error) {
    console.error('Error in /report-violation:', error);
    if (error.message.includes('not found') || error.message.includes('inactive session')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to record violation: ' + error.message });
  }
});

// 7. Heartbeat
app.post('/heartbeat', verifyToken, async (req, res) => {
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    let returnStatus = 'started';
    let returnRemaining = 0;

    if (db) {
      await db.runTransaction(async (transaction) => {
        const attemptRef = db.collection('exam_attempts').doc(attemptId);
        const attemptDoc = await transaction.get(attemptRef);
        if (!attemptDoc.exists) {
          throw new Error('Active exam attempt not found.');
        }
        const attempt = attemptDoc.data();
        if (attempt.status !== 'started') {
          returnStatus = attempt.status;
          returnRemaining = 0;
          return;
        }

        const paperDoc = await transaction.get(db.collection('papers').doc(paperId));
        let paperDuration = 2700;
        if (paperDoc.exists && paperDoc.data().durationMinutes) {
          paperDuration = parseInt(paperDoc.data().durationMinutes) * 60;
        }

        const startedAt = new Date(attempt.startedAt).getTime();
        const now = Date.now();
        const sessionElapsed = Math.round((now - startedAt) / 1000);
        const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
        const finalRemainingSeconds = Math.max(0, currentLimit - sessionElapsed);

        if (finalRemainingSeconds <= 0) {
          transaction.update(attemptRef, {
            status: 'submitted',
            elapsedTime: (attempt.elapsedTime || 0) + currentLimit,
            overrideTimeSeconds: 0,
            submittedAt: new Date().toISOString()
          });
          returnStatus = 'submitted';
          returnRemaining = 0;
        } else {
          transaction.update(attemptRef, {
            startedAt: new Date().toISOString(),
            elapsedTime: (attempt.elapsedTime || 0) + sessionElapsed,
            overrideTimeSeconds: finalRemainingSeconds
          });
          returnStatus = 'started';
          returnRemaining = finalRemainingSeconds;
        }
      });
    } else {
      const attempt = mockExamAttempts.get(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Active exam attempt not found (mock).' });
      }
      if (attempt.status !== 'started') {
        return res.json({ status: attempt.status, remainingTimeSeconds: 0 });
      }

      let paperDuration = 2700;
      const paperObj = mockPapers.get(paperId);
      if (paperObj && paperObj.durationMinutes) {
        paperDuration = parseInt(paperObj.durationMinutes) * 60;
      }

      const startedAt = new Date(attempt.startedAt).getTime();
      const now = Date.now();
      const sessionElapsed = Math.round((now - startedAt) / 1000);
      const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
      const finalRemainingSeconds = Math.max(0, currentLimit - sessionElapsed);

      if (finalRemainingSeconds <= 0) {
        attempt.status = 'submitted';
        attempt.elapsedTime = (attempt.elapsedTime || 0) + currentLimit;
        attempt.overrideTimeSeconds = 0;
        attempt.submittedAt = new Date().toISOString();
        returnStatus = 'submitted';
        returnRemaining = 0;
      } else {
        attempt.startedAt = new Date().toISOString();
        attempt.elapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
        attempt.overrideTimeSeconds = finalRemainingSeconds;
        returnStatus = 'started';
        returnRemaining = finalRemainingSeconds;
      }
    }

    res.json({
      status: returnStatus,
      remainingTimeSeconds: returnRemaining
    });
  } catch (error) {
    console.error('Error in /heartbeat:', error);
    if (error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Heartbeat processing failed: ' + error.message });
  }
});

// 8. Auto-submit Exam
app.post('/auto-submit', verifyToken, async (req, res) => {
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    let attempt = null;

    if (db) {
      const attemptDoc = await db.collection('exam_attempts').doc(attemptId).get();
      if (!attemptDoc.exists) {
        return res.status(404).json({ error: 'Active exam attempt not found.' });
      }
      attempt = attemptDoc.data();
    } else {
      attempt = mockExamAttempts.get(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Active exam attempt not found (mock).' });
      }
    }

    if (attempt.status === 'submitted') {
      // Calculate score even if already submitted so score report screen can load
      let questionsList = [];
      if (db) {
        const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
        qSnap.forEach(doc => {
          questionsList.push({ id: doc.id, ...doc.data() });
        });
      }
      if (questionsList.length === 0) {
        questionsList = mockQuestions.filter(q => q.paperId === paperId);
      }

      let score = 0;
      const studentAnswers = attempt.answers || {};
      questionsList.forEach(q => {
        const ans = studentAnswers[q.id];
        if (ans !== undefined && ans === q.correctOptionIndex) {
          score++;
        }
      });
      return res.json({
        message: 'Exam already submitted',
        sessionId: attemptId,
        score,
        total: questionsList.length
      });
    }

    if (attempt.status !== 'started') {
      return res.status(400).json({ error: 'Cannot submit. Exam session is not in started status.' });
    }

    const startedAt = new Date(attempt.startedAt).getTime();
    const now = Date.now();
    const sessionElapsed = Math.round((now - startedAt) / 1000);
    const finalElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;

    // Calculate score
    let questionsList = [];
    if (db) {
      const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
      qSnap.forEach(doc => {
        questionsList.push({ id: doc.id, ...doc.data() });
      });
    }
    if (questionsList.length === 0) {
      questionsList = mockQuestions.filter(q => q.paperId === paperId);
    }

    let score = 0;
    const studentAnswers = attempt.answers || {};
    questionsList.forEach(q => {
      const ans = studentAnswers[q.id];
      if (ans !== undefined && ans === q.correctOptionIndex) {
        score++;
      }
    });
    const total = questionsList.length;

    if (db) {
      await db.collection('exam_attempts').doc(attemptId).update({
        status: 'submitted',
        elapsedTime: finalElapsedTime,
        overrideTimeSeconds: 0,
        submittedAt: new Date().toISOString()
      });
    } else {
      attempt.status = 'submitted';
      attempt.elapsedTime = finalElapsedTime;
      attempt.overrideTimeSeconds = 0;
      attempt.submittedAt = new Date().toISOString();
    }

    res.json({
      message: 'Exam submitted successfully',
      sessionId: attemptId,
      score,
      total
    });
  } catch (error) {
    console.error('Error in /auto-submit:', error);
    res.status(500).json({ error: 'Failed to submit exam: ' + error.message });
  }
});

// 9. Teacher: Override blocked student session
app.post('/teacher/override', verifyToken, async (req, res) => {
  const { studentId, paperId, overrideMinutes } = req.body;
  if (!studentId || !overrideMinutes) {
    return res.status(400).json({ error: 'Student ID and override minutes are required.' });
  }

  // Ensure user is teacher/admin
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Only teachers or admins can grant exam overrides.' });
  }

  try {
    const targetAttemptId = paperId ? `${studentId}_${paperId}` : null;
    let attempt = null;
    let actualPaperId = paperId;

    if (db && targetAttemptId) {
      const attemptDoc = await db.collection('exam_attempts').doc(targetAttemptId).get();
      if (attemptDoc.exists) attempt = attemptDoc.data();
    } else if (targetAttemptId) {
      attempt = mockExamAttempts.get(targetAttemptId);
    }

    // If target attempt wasn't found by exact paperId, find any overrideable attempt for that student
    if (!attempt) {
      if (db) {
        const snap = await db.collection('exam_attempts').where('studentId', '==', studentId).get();
        if (!snap.empty) {
          const foundDoc = snap.docs.find(d => d.data().status === 'blocked_pending_review' || d.data().status === 'exited_on_violation');
          if (foundDoc) {
            attempt = foundDoc.data();
            actualPaperId = attempt.paperId;
          }
        }
      } else {
        mockExamAttempts.forEach((val) => {
          if (val.studentId === studentId) {
            if (val.status === 'blocked_pending_review' || val.status === 'exited_on_violation') {
              attempt = val;
              actualPaperId = val.paperId;
            }
          }
        });
      }
    }

    if (!attempt) {
      return res.status(404).json({ error: 'No active or blocked attempt found to grant override for this student.' });
    }

    if (attempt.status === 'malpractice_failed') {
      return res.status(403).json({ error: 'Cannot override: This student is permanently blocked due to malpractice across all sets.' });
    }

    if (attempt.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot override: This exam has already been submitted.' });
    }

    const keyId = `${attempt.studentId}_${actualPaperId}`;
    const overrideSeconds = parseInt(overrideMinutes) * 60;

    const updatedData = {
      ...attempt,
      status: 'exited_on_violation', // Set to exited_on_violation so they can re-enter via /start-exam but timer doesn't tick yet
      overrideTimeSeconds: overrideSeconds
    };

    if (db) {
      await db.collection('exam_attempts').doc(keyId).set(updatedData);
      await db.collection('audit_logs').add({
        action: 'grant_override',
        teacherId: req.user.uid,
        teacherName: req.user.name || 'Teacher',
        studentId: attempt.studentId,
        paperId: actualPaperId,
        overrideMinutes: parseInt(overrideMinutes),
        timestamp: new Date().toISOString()
      });
    } else {
      mockExamAttempts.set(keyId, updatedData);
    }

    res.json({
      message: 'Override granted successfully',
      sessionId: keyId,
      paperId: actualPaperId,
      overrideMinutes: parseInt(overrideMinutes),
      remainingTimeSeconds: overrideSeconds
    });
  } catch (error) {
    console.error('Error in /teacher/override:', error);
    res.status(500).json({ error: 'Failed to grant override: ' + error.message });
  }
});

// 10. Teacher: Deny blocked student session (Confirm Malpractice)
app.post('/teacher/deny', verifyToken, async (req, res) => {
  const { studentId, paperId } = req.body;
  if (!studentId || !paperId) {
    return res.status(400).json({ error: 'Student ID and Paper ID are required.' });
  }

  // Ensure user is teacher/admin
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Only teachers or admins can deny exam overrides.' });
  }

  const attemptId = `${studentId}_${paperId}`;

  try {
    if (db) {
      await db.collection('exam_attempts').doc(attemptId).update({
        status: 'malpractice_failed'
      });

      // Audit log
      await db.collection('audit_logs').add({
        action: 'deny_override_malpractice',
        teacherId: req.user.uid,
        teacherName: req.user.name || 'Teacher',
        studentId,
        paperId,
        timestamp: new Date().toISOString()
      });
    } else {
      const attempt = mockExamAttempts.get(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: 'Attempt not found (mock).' });
      }
      attempt.status = 'malpractice_failed';
    }

    res.json({
      message: 'Override denied, malpractice confirmed.'
    });
  } catch (error) {
    console.error('Error in /teacher/deny:', error);
    res.status(500).json({ error: 'Failed to deny override: ' + error.message });
  }
});

// 15. Teacher: Clear student attempts & violations for a specific subject (logs cleanup)
app.post('/teacher/clear-student-attempts', verifyToken, async (req, res) => {
  const { studentId, paperId } = req.body;
  if (!studentId || !paperId) {
    return res.status(400).json({ error: 'Student ID and Paper ID are required.' });
  }

  // Ensure user is teacher/admin
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Only teachers or admins can clear student attempts.' });
  }

  try {
    let paperSubject = '';
    let paperDepartment = '';
    
    if (db) {
      const paperDoc = await db.collection('papers').doc(paperId).get();
      if (!paperDoc.exists) {
        return res.status(404).json({ error: 'Paper not found.' });
      }
      paperSubject = paperDoc.data().subject || paperDoc.data().title || '';
      paperDepartment = paperDoc.data().department || '';
    } else {
      const mockP = mockPapers.get(paperId);
      if (!mockP) return res.status(404).json({ error: 'Paper not found (mock).' });
      paperSubject = mockP.subject || mockP.title || '';
      paperDepartment = mockP.department || '';
    }

    // 1. Delete attempts matching the subject
    let deletedAttemptsCount = 0;
    let deletedViolationsCount = 0;

    if (db) {
      // Find all papers in this subject pool
      const papersSnap = await db.collection('papers')
        .where('subject', '==', paperSubject)
        .get();
      const paperIds = papersSnap.docs.map(doc => doc.id);
      if (!paperIds.includes(paperId)) {
        paperIds.push(paperId);
      }

      // Delete exam attempts
      const batch = db.batch();
      const attemptsSnap = await db.collection('exam_attempts')
        .where('studentId', '==', studentId)
        .get();
      
      let attemptsBatchCount = 0;
      attemptsSnap.forEach(doc => {
        const attempt = doc.data();
        if (paperIds.includes(attempt.paperId)) {
          batch.delete(doc.ref);
          attemptsBatchCount++;
          deletedAttemptsCount++;
        }
      });

      // Delete violations
      const violationsSnap = await db.collection('violations')
        .where('studentId', '==', studentId)
        .get();
      
      violationsSnap.forEach(doc => {
        const violation = doc.data();
        if (paperIds.includes(violation.paperId)) {
          batch.delete(doc.ref);
          deletedViolationsCount++;
        }
      });

      if (attemptsBatchCount > 0 || deletedViolationsCount > 0) {
        await batch.commit();
      }

      // Log to audit log
      await db.collection('audit_logs').add({
        action: 'clear_student_logs',
        teacherId: req.user.uid,
        teacherName: req.user.name || 'Teacher',
        studentId,
        subject: paperSubject,
        timestamp: new Date().toISOString()
      });
    } else {
      // Mock mode delete
      const mockPaperIds = [];
      mockPapers.forEach((val, key) => {
        if ((val.subject || val.title) === paperSubject) {
          mockPaperIds.push(key);
        }
      });
      if (!mockPaperIds.includes(paperId)) {
        mockPaperIds.push(paperId);
      }

      mockExamAttempts.forEach((val, key) => {
        if (val.studentId === studentId && mockPaperIds.includes(val.paperId)) {
          mockExamAttempts.delete(key);
          deletedAttemptsCount++;
        }
      });

      // Remove mock violations
      const oldLen = mockViolations.length;
      mockViolations = mockViolations.filter(v => !(v.studentId === studentId && mockPaperIds.includes(v.paperId)));
      deletedViolationsCount = oldLen - mockViolations.length;
    }

    res.json({
      success: true,
      message: `Cleared attempts and violations successfully for subject "${paperSubject}".`,
      deletedAttempts: deletedAttemptsCount,
      deletedViolations: deletedViolationsCount
    });
  } catch (error) {
    console.error('Error in /teacher/clear-student-attempts:', error);
    res.status(500).json({ error: 'Failed to clear student attempts: ' + error.message });
  }
});

// Endpoint to list all published papers
app.get('/papers', verifyToken, async (req, res) => {
  try {
    let papersList = [];
    if (db) {
      let queryRef = db.collection('papers').where('status', '==', 'published');
      
      // Multi-tenancy filter
      if (req.user.role === 'student' || req.user.role === 'teacher') {
        if (req.user.department && req.user.department !== 'All') {
           queryRef = queryRef.where('department', '==', req.user.department);
        }
      }

      const snap = await queryRef.get();
      snap.forEach(doc => papersList.push({ id: doc.id, ...doc.data() }));

    }
    
    // Only return mock papers when database connection is absent (mock mode)
    if (!db) {
      mockPapers.forEach((val, key) => {
        if (!papersList.some(p => p.id === key || p.title === val.title)) {
          papersList.push({ id: key, ...val });
        }
      });
    }

    // Schedule Window & Semester Filter: students only see papers that are within their time window and semester
    if (req.user.role === 'student') {
      const now = new Date();
      papersList = papersList.filter(paper => {
        if (paper.scheduleStart && now < new Date(paper.scheduleStart)) return false;
        if (paper.scheduleEnd && now > new Date(paper.scheduleEnd)) return false;
        if (paper.semester && req.user.semester && String(paper.semester) !== String(req.user.semester)) return false;
        return true;
      });
    }

    res.json({ papers: papersList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Teacher: Get Live Monitoring details (optional utility route)
app.get('/teacher/live-monitor', verifyToken, async (req, res) => {
  try {
    let activeSessions = [];
    if (db) {
      const activeSnapshot = await db.collection('exam_attempts').get();
      activeSnapshot.forEach(doc => {
        activeSessions.push({ id: doc.id, ...doc.data() });
      });
    } else {
      mockExamAttempts.forEach((val, key) => {
        activeSessions.push({ id: key, ...val });
      });
    }
    res.json({
      message: 'Live monitor list',
      activeSessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Teacher: Get violations list (proctoring alerts)
app.get('/teacher/violations', verifyToken, async (req, res) => {
  try {
    let violations = [];
    if (db) {
      const snap = await db.collection('violations').orderBy('timestamp', 'desc').limit(50).get();
      snap.forEach(doc => {
        violations.push({ id: doc.id, ...doc.data() });
      });
    } else {
      violations = [...mockViolations];
    }
    res.json({ violations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Admin: Get global exam policies
// --- SUPER ADMIN USER MANAGEMENT ---

// Delete a user entirely (Auth + Firestore)
app.delete('/admin/users/:uid', verifyToken, async (req, res) => {
  try {
    if (!isAdminOrTeacher(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { uid } = req.params;

    // Delete from Firebase Auth (if exists)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        console.log(`User ${uid} not found in Firebase Auth, proceeding to delete from Firestore.`);
      } else {
        throw authErr; // rethrow if it's a different auth error
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Update a user's profile (Firestore)
app.put('/admin/users/:uid', verifyToken, async (req, res) => {
  try {
    if (!isAdminOrTeacher(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { uid } = req.params;
    const { name, department, role, email, semester, phoneNumber, prnNumber } = req.body;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (department !== undefined) updates.department = department;
    if (role !== undefined) updates.role = role;
    if (email !== undefined) updates.email = email;
    if (semester !== undefined) updates.semester = semester;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (prnNumber !== undefined) updates.prnNumber = prnNumber ? prnNumber.toUpperCase() : 'N/A';

    await userRef.update(updates);

    // Also sync name/email to Firebase Auth record
    const authUpdates = {};
    if (name) authUpdates.displayName = name;
    if (email) authUpdates.email = email;
    if (Object.keys(authUpdates).length > 0) {
      try {
        await admin.auth().updateUser(uid, authUpdates);
      } catch (authErr) {
        console.warn(`Could not update Firebase Auth for ${uid}:`, authErr.message);
      }
    }

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Create a new user with Firebase Auth + Firestore profile
app.post('/admin/create-user', verifyToken, async (req, res) => {
  try {
    if (!isAdminOrTeacher(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { name, email, password, department, role, semester, phoneNumber, prnNumber } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Create Firebase Auth account
    const authUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    const uid = authUser.uid;

    // Write Firestore profile
    const userProfile = {
      uid,
      name,
      email,
      role: role === 'student' ? 'student' : 'teacher',
      department: department || 'Unassigned',
      semester: semester || 'N/A',
      prnNumber: (prnNumber || 'N/A').toUpperCase(),
      phoneNumber: phoneNumber || '',
      collegeDomain: email.substring(email.lastIndexOf('@') + 1),
      createdAt: new Date().toISOString()
    };

    await db.collection('users').doc(uid).set(userProfile);

    console.log(`[Admin] Created new ${userProfile.role} account: ${email} (uid: ${uid})`);
    res.json({ success: true, uid, message: `${userProfile.role} account created successfully.` });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: error.message || 'Failed to create user.' });
  }
});

// Send password reset email OR force-set a new password for a user
app.post('/admin/users/:uid/reset-password', verifyToken, async (req, res) => {
  try {
    if (!isAdminOrTeacher(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { uid } = req.params;
    const { mode, newPassword } = req.body; // mode: 'email' | 'force'

    // Fetch the user's email from Firestore (more reliable than Auth for display)
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const { email } = userDoc.data();

    if (mode === 'force') {
      // Admin sets a new password directly
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      await admin.auth().updateUser(uid, { password: newPassword });
      console.log(`[Admin] Force-reset password for uid: ${uid}`);
      return res.json({ success: true, message: `Password updated successfully for ${email}.` });
    } else {
      // Send a password reset link via Firebase Auth email
      const resetLink = await admin.auth().generatePasswordResetLink(email);
      // In production you'd send this via email. For now we return it so admin can share it.
      console.log(`[Admin] Password reset link generated for ${email}: ${resetLink}`);
      return res.json({
        success: true,
        message: `Password reset link generated for ${email}.`,
        resetLink // Admin can copy and share this with the user
      });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
});

// --- GLOBAL POLICIES ---

app.get('/admin/policies', verifyToken, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    let defaultDuration = 45;
    let warningThreshold = 3;
    const configDoc = await db.collection('settings').doc('config').get();
    if (configDoc.exists) {
      defaultDuration = configDoc.data().defaultDuration || 45;
      warningThreshold = configDoc.data().warningThreshold || 3;
    }
    res.json({ defaultDuration, warningThreshold });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Admin: Save global exam policies
app.post('/admin/policies', verifyToken, async (req, res) => {
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only teachers/admins can update exam policies.' });
  }
  const { defaultDuration, warningThreshold } = req.body;
  if (!defaultDuration || !warningThreshold) {
    return res.status(400).json({ error: 'Duration and threshold are required.' });
  }
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    await db.collection('settings').doc('config').set({
      defaultDuration: parseInt(defaultDuration),
      warningThreshold: parseInt(warningThreshold),
      updatedAt: new Date().toISOString()
    });
    res.json({ message: 'Exam policies updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Active session timer checker: auto-submit clean sessions that exceeded their limit
setInterval(async () => {
  console.log('⏰ Running server sweep on active exam attempts...');
  try {
    if (db) {
      const activeAttemptsSnapshot = await db.collection('exam_attempts')
        .where('status', '==', 'started')
        .get();

      const batch = db.batch();
      let count = 0;

      activeAttemptsSnapshot.forEach(doc => {
        const attempt = doc.data();
        // Skip sessions with warnings exceeding threshold or pending review
        if ((attempt.warnings || 0) >= (mockConfig.warningThreshold || 3)) return;

        const startedAt = new Date(attempt.startedAt).getTime();
        const now = Date.now();
        const sessionElapsed = Math.round((now - startedAt) / 1000);
        const remaining = (attempt.overrideTimeSeconds || 2700) - sessionElapsed;

        if (remaining <= 0) {
          const finalElapsedTime = (attempt.elapsedTime || 0) + (attempt.overrideTimeSeconds || 2700);
          batch.update(doc.ref, {
            status: 'submitted',
            elapsedTime: finalElapsedTime,
            overrideTimeSeconds: 0,
            submittedAt: new Date().toISOString()
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        console.log(`✅ Auto-submitted ${count} expired exam sessions.`);
      }
    } else {
      let count = 0;
      mockExamAttempts.forEach((attempt, key) => {
        // Only auto-submit clean started sessions; do NOT auto-submit blocked or malpractice sessions
        if (attempt.status === 'started' && (attempt.warnings || 0) < (mockConfig.warningThreshold || 3)) {
          const startedAt = new Date(attempt.startedAt).getTime();
          const now = Date.now();
          const sessionElapsed = Math.round((now - startedAt) / 1000);
          const remaining = (attempt.overrideTimeSeconds || 2700) - sessionElapsed;

          if (remaining <= 0) {
            attempt.status = 'submitted';
            attempt.elapsedTime = (attempt.elapsedTime || 0) + (attempt.overrideTimeSeconds || 2700);
            attempt.overrideTimeSeconds = 0;
            attempt.submittedAt = new Date().toISOString();
            count++;
          }
        }
      });
      if (count > 0) {
        console.log(`✅ [Mock Mode] Auto-submitted ${count} expired mock exam sessions.`);
      }
    }
  } catch (err) {
    console.error('❌ Error during active exam sweep:', err);
  }
}, 30000); // Check every 30 seconds

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

