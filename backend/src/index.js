const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

// Helper middleware for Firebase ID token verification with server-side domain verification
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Check for explicit mock headers first to facilitate offline development
  if (token.startsWith('mock-')) {
    console.log(`⚠️ Mocking token verification for token: ${token}`);
    // Mock Admin
    if (token === 'mock-superadmin') {
      req.user = { uid: 'mock-uid-superadmin-001', email: 'admin@dnyanshree.edu.in', role: 'superadmin', name: 'Mock Superadmin', department: 'All' };
      return next();
    }
    // Mock Teacher
    if (token === 'mock-teacher') {
      req.user = { uid: 'mock-uid-teacher-456', email: 'teacher@dnyanshree.edu.in', role: 'teacher', name: 'Mock Teacher (Dev)', department: 'Computer Science' };
      return next();
    }
    // Mock Student
    if (token === 'mock-student') {
      req.user = { uid: 'mock-uid-student-123', email: 'student@dnyanshree.edu.in', role: 'student', name: 'Mock Student (Dev)', department: 'Computer Science' };
      return next();
    }
    return next();
  }

  // 2. Real Firebase token verification
  if (!admin || !db) {
    // If user sent a non-mock token but Firebase is not initialized, reject or fallback to mock student
    console.warn('⚠️ Firebase not initialized but non-mock token received. Fallback to mock student.');
    req.user = {
      uid: 'mock-uid-student-123',
      email: 'student@dnyanshree.edu.in',
      role: 'student',
      name: 'Mock Student',
      department: 'Computer Science'
    };
    return next();
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
    
    // Fetch role from Firestore user profile
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      req.user.role = userDoc.data().role;
      req.user.name = userDoc.data().name;
      req.user.department = userDoc.data().department || 'Unassigned';
    } else {
      req.user.role = 'student'; // default role
      req.user.department = 'Unassigned';
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
  const { name, phoneNumber, role, department, semester } = req.body;
  if (!name || !phoneNumber || !role) {
    return res.status(400).json({ error: 'Name, phone number, and role are required.' });
  }

  const email = req.user.email;
  const uid = req.user.uid;
  const domain = email.substring(email.lastIndexOf('@') + 1);

  const userProfile = {
    uid,
    name,
    email,
    phoneNumber,
    role: role === 'teacher' ? 'teacher' : 'student',
    collegeDomain: domain,
    department: department || 'Unassigned',
    semester: semester || 'N/A',
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

// In-Memory mock data for offline development fallback
const mockExamAttempts = new Map();
const mockConfig = { defaultDuration: 45, warningThreshold: 3 };
const mockViolations = [];
const mockPapers = new Map([
  ['paper-1', { id: 'paper-1', title: 'Midterm Circuit Analysis', department: 'Electrical Engineering', status: 'published' }],
  ['paper-2', { id: 'paper-2', title: 'Data Structures Quiz 1', department: 'Computer Science', status: 'published' }],
  ['paper-3', { id: 'paper-3', title: 'Data Structures Quiz 2', department: 'Computer Science', status: 'published' }],
  ['cse-set-a', { id: 'cse-set-a', title: 'CSE Set A: Intro to Programming', department: 'Computer Science', status: 'published' }],
  ['cse-set-b', { id: 'cse-set-b', title: 'CSE Set B: OOP Concepts', department: 'Computer Science', status: 'published' }],
  ['cse-set-c', { id: 'cse-set-c', title: 'CSE Set C: Data Structures', department: 'Computer Science', status: 'published' }],
  ['ee-set-a', { id: 'ee-set-a', title: "EE Set A: Ohm's Law Basics", department: 'Electrical Engineering', status: 'published' }]
]);

const mockQuestions = [
  // --- EE SET A ---
  {
    id: 'q-ee-1',
    paperId: 'ee-set-a',
    questionText: "[ELECTRICAL SET A] Question 1: Which formula represents Ohm's Law?",
    options: [
      { text: 'V = I * R', imageUrl: null },
      { text: 'P = V * I', imageUrl: null },
      { text: 'R = V * P', imageUrl: null },
      { text: 'I = V * R', imageUrl: null }
    ],
    correctOptionIndex: 0
  },
  {
    id: 'q-paper-1',
    paperId: 'paper-1',
    questionText: "[ELECTRICAL SET A] Question 1: Which formula represents Ohm's Law?",
    options: [
      { text: 'V = I * R', imageUrl: null },
      { text: 'P = V * I', imageUrl: null },
      { text: 'R = V * P', imageUrl: null },
      { text: 'I = V * R', imageUrl: null }
    ],
    correctOptionIndex: 0
  },

  // --- CSE SET A ---
  {
    id: 'q-cse-a-1',
    paperId: 'cse-set-a',
    questionText: "[SET A] Question 1: What is the average time complexity of Binary Search in a sorted array?",
    options: [
      { text: 'O(log n)', imageUrl: null },
      { text: 'O(n)', imageUrl: null },
      { text: 'O(n^2)', imageUrl: null },
      { text: 'O(1)', imageUrl: null }
    ],
    correctOptionIndex: 0
  },
  {
    id: 'q-paper-2',
    paperId: 'paper-2',
    questionText: "[SET A] Question 1: What is the average time complexity of Binary Search in a sorted array?",
    options: [
      { text: 'O(log n)', imageUrl: null },
      { text: 'O(n)', imageUrl: null },
      { text: 'O(n^2)', imageUrl: null },
      { text: 'O(1)', imageUrl: null }
    ],
    correctOptionIndex: 0
  },

  // --- CSE SET B ---
  {
    id: 'q-cse-b-1',
    paperId: 'cse-set-b',
    questionText: "[SET B] Question 1: Which data structure operates on a Last-In, First-Out (LIFO) order?",
    options: [
      { text: 'Stack', imageUrl: null },
      { text: 'Queue', imageUrl: null },
      { text: 'Array', imageUrl: null },
      { text: 'Linked List', imageUrl: null }
    ],
    correctOptionIndex: 0
  },
  {
    id: 'q-paper-3',
    paperId: 'paper-3',
    questionText: "[SET B] Question 1: Which data structure operates on a Last-In, First-Out (LIFO) order?",
    options: [
      { text: 'Stack', imageUrl: null },
      { text: 'Queue', imageUrl: null },
      { text: 'Array', imageUrl: null },
      { text: 'Linked List', imageUrl: null }
    ],
    correctOptionIndex: 0
  },

  // --- CSE SET C ---
  {
    id: 'q-cse-c-1',
    paperId: 'cse-set-c',
    questionText: "[SET C] Question 1: Which graph traversal algorithm uses a Queue data structure?",
    options: [
      { text: 'Breadth-First Search (BFS)', imageUrl: null },
      { text: 'Depth-First Search (DFS)', imageUrl: null },
      { text: 'Dijkstra Algorithm', imageUrl: null },
      { text: 'Kruskal Algorithm', imageUrl: null }
    ],
    correctOptionIndex: 0
  }
];

// 4. Start Exam
app.post('/start-exam', verifyToken, async (req, res) => {
  let { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const studentName = req.user.name || 'Student';

  try {
    let paperDepartment = '';
    let paperTitle = '';

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

    // Security Check: Ensure student matches paper department
    if (req.user.role === 'student' && req.user.department !== 'All') {
      if (paperDepartment !== req.user.department) {
        return res.status(403).json({ error: 'Forbidden: This exam belongs to a different department.' });
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
    const paperDepartmentMap = {};
    if (db && priorAttempts.length > 0) {
      const uniquePaperIds = [...new Set(priorAttempts.map(a => a.paperId))];
      const paperDocs = await Promise.all(
        uniquePaperIds.map(id => db.collection('papers').doc(id).get())
      );
      paperDocs.forEach(doc => {
        if (doc.exists) paperDepartmentMap[doc.id] = doc.data().department;
      });
    } else {
      priorAttempts.forEach(att => {
        paperDepartmentMap[att.paperId] = mockPapers.get(att.paperId)?.department || '';
      });
    }

    const getSubjectForPaper = (pId) => paperDepartmentMap[pId] || '';

    // Check if user is currently blocked (failed malpractice or blocked pending review in this subject)
    for (const att of priorAttempts) {
      if (att.status === 'blocked_pending_review' || att.status === 'malpractice_failed') {
        const attDepartment = getSubjectForPaper(att.paperId);
        if (attDepartment === paperDepartment) {
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
        const attDepartment = getSubjectForPaper(att.paperId);
        if (attDepartment === paperDepartment) {
          hasSameSubjectSoftViolation = true;
          break;
        }
      }
    }

    if (hasSameSubjectSoftViolation) {
      let candidatePapers = [];
      if (db) {
        const papersSnapshot = await db.collection('papers')
          .where('subject', '==', paperDepartment)
          .where('status', '==', 'published')
          .get();
        papersSnapshot.forEach(doc => {
          candidatePapers.push({ id: doc.id, ...doc.data() });
        });
      } else {
        mockPapers.forEach((val, key) => {
          if (val.department === paperDepartment && val.status === 'published') {
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
    let departmentWarningsCount = 0;

    for (const att of priorAttempts) {
      const attDepartment = getSubjectForPaper(att.paperId);

      if (attDepartment === paperDepartment) {
        departmentWarningsCount += att.warnings || 0;
      }

      if (att.paperId !== paperId) {
        if (attDepartment === paperDepartment) {
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
          let attDepartment = '';
          const pDoc = await db.collection('papers').doc(att.paperId).get();
          if (pDoc.exists) attDepartment = pDoc.data().department;

          if (attDepartment === paperDepartment && (att.status === 'started' || att.status === 'exited_on_violation')) {
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
          const attDepartment = mockPapers.get(att.paperId)?.department || '';
          if (attDepartment === paperDepartment && (att.status === 'started' || att.status === 'exited_on_violation')) {
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
      warningsCount: departmentWarningsCount,
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
          if (pDoc.exists && pDoc.data().department === paperDepartment) {
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
          nextStatus = 'blocked_pending_review';
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
      paperDepartment = mockPapers.get(paperId)?.department || '';

      const paperObj = mockPapers.get(paperId);
      let paperDuration = 2700;
      if (paperObj && paperObj.durationMinutes) {
        paperDuration = parseInt(paperObj.durationMinutes) * 60;
      }

      let warningThreshold = mockConfig.warningThreshold;

      let cumulativeWarnings = 0;
      mockExamAttempts.forEach((val) => {
        if (val.studentId === studentId && val.paperId !== paperId && mockPapers.get(val.paperId)?.department === paperDepartment) {
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
        nextStatus = 'blocked_pending_review';
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

  // Ensure user is teacher
  if (req.user.role !== 'teacher' && !req.user.uid.startsWith('mock-uid-teacher')) {
    return res.status(403).json({ error: 'Only teachers can grant exam overrides.' });
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

    // If target attempt wasn't found by exact paperId, find any blocked attempt for that student
    if (!attempt) {
      if (db) {
        const snap = await db.collection('exam_attempts').where('studentId', '==', studentId).get();
        if (!snap.empty) {
          const foundDoc = snap.docs.find(d => d.data().status === 'blocked_pending_review' || d.data().status === 'exited_on_violation') || snap.docs[0];
          attempt = foundDoc.data();
          actualPaperId = attempt.paperId;
        }
      } else {
        mockExamAttempts.forEach((val) => {
          if (val.studentId === studentId) {
            if (!attempt || val.status === 'blocked_pending_review' || val.status === 'exited_on_violation') {
              attempt = val;
              actualPaperId = val.paperId;
            }
          }
        });
      }
    }

    if (!attempt) {
      return res.status(404).json({ error: 'No attempt found to grant override for this student.' });
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

  // Ensure user is teacher
  if (req.user.role !== 'teacher' && !req.user.uid.startsWith('mock-uid-teacher')) {
    return res.status(403).json({ error: 'Only teachers can deny exam overrides.' });
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

      // If Firestore has fewer than 3 papers, seed Set A, Set B, Set C directly into Firestore!
      if (papersList.length < 3) {
        console.log("🌱 Auto-seeding missing paper sets into Firestore database...");
        const seedPapers = [
          { id: 'cse-set-a', title: 'CSE Set A: Intro to Programming', department: 'Computer Science', status: 'published' },
          { id: 'cse-set-b', title: 'CSE Set B: OOP Concepts', department: 'Computer Science', status: 'published' },
          { id: 'cse-set-c', title: 'CSE Set C: Data Structures', department: 'Computer Science', status: 'published' },
          { id: 'ee-set-a', title: "EE Set A: Ohm's Law Basics", department: 'Electrical Engineering', status: 'published' }
        ];

        for (const p of seedPapers) {
          const docRef = db.collection('papers').doc(p.id);
          const pDoc = await docRef.get();
          if (!pDoc.exists) {
            await docRef.set({
              title: p.title,
              department: p.department,
              status: p.status,
              createdAt: new Date().toISOString()
            });
            papersList.push(p);
          }
        }

        // Seed respective questions into Firestore
        for (const q of mockQuestions) {
          const qRef = db.collection('questions').doc(q.id);
          const qDoc = await qRef.get();
          if (!qDoc.exists) {
            await qRef.set({
              paperId: q.paperId,
              questionText: q.questionText,
              options: q.options,
              correctOptionIndex: q.correctOptionIndex,
              department: q.paperId.startsWith('ee') ? 'Electrical Engineering' : 'Computer Science'
            });
          }
        }
      }
    }
    
    // Always ensure default pool papers (Set A, Set B, Set C, EE Set A) are present in available papers list
    mockPapers.forEach((val, key) => {
      if (!papersList.some(p => p.id === key || p.title === val.title)) {
        papersList.push({ id: key, ...val });
      }
    });

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
app.get('/admin/policies', async (req, res) => {
  try {
    let defaultDuration = mockConfig.defaultDuration;
    let warningThreshold = mockConfig.warningThreshold;
    if (db) {
      const configDoc = await db.collection('settings').doc('config').get();
      if (configDoc.exists) {
        defaultDuration = configDoc.data().defaultDuration || 45;
        warningThreshold = configDoc.data().warningThreshold || 3;
      }
    }
    res.json({ defaultDuration, warningThreshold });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Admin: Save global exam policies
app.post('/admin/policies', verifyToken, async (req, res) => {
  // F4 Fix: Ensure user has teacher/admin role
  if (req.user.role !== 'teacher' && !req.user.uid.startsWith('mock-uid-teacher')) {
    return res.status(403).json({ error: 'Forbidden: Only teachers/admins can update exam policies.' });
  }
  const { defaultDuration, warningThreshold } = req.body;
  if (!defaultDuration || !warningThreshold) {
    return res.status(400).json({ error: 'Duration and threshold are required.' });
  }
  try {
    mockConfig.defaultDuration = parseInt(defaultDuration);
    mockConfig.warningThreshold = parseInt(warningThreshold);

    if (db) {
      await db.collection('settings').doc('config').set({
        defaultDuration: parseInt(defaultDuration),
        warningThreshold: parseInt(warningThreshold),
        updatedAt: new Date().toISOString()
      });
    }
    res.json({ message: 'Exam policies updated successfully', mockConfig });
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

