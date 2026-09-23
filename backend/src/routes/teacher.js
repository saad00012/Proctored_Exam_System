const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { verifyToken, isAdminOrTeacher } = require('../middleware/auth');

// 1. Teacher: Override blocked student session
router.post('/override', verifyToken, async (req, res) => {
  const { studentId, paperId, overrideMinutes } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  // Ensure user is teacher/admin
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Only teachers or admins can grant exam overrides.' });
  }

  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    const targetAttemptId = paperId ? `${studentId}_${paperId}` : null;
    let attempt = null;
    let actualPaperId = paperId;

    if (targetAttemptId) {
      const attemptDoc = await db.collection('exam_attempts').doc(targetAttemptId).get();
      if (attemptDoc.exists) attempt = attemptDoc.data();
    }

    // If target attempt wasn't found by exact paperId, find any overrideable attempt for that student
    if (!attempt) {
      const snap = await db.collection('exam_attempts').where('studentId', '==', studentId).get();
      if (!snap.empty) {
        const foundDoc = snap.docs.find(d => d.data().status === 'blocked_pending_review' || d.data().status === 'exited_on_violation');
        if (foundDoc) {
          attempt = foundDoc.data();
          actualPaperId = attempt.paperId;
        }
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
    const overrideSeconds = overrideMinutes ? parseInt(overrideMinutes) * 60 : null;

    const updatedData = {
      ...attempt,
      status: 'exited_on_violation',
      ...(overrideSeconds ? { overrideTimeSeconds: overrideSeconds } : {})
    };

    await db.collection('exam_attempts').doc(keyId).set(updatedData);
    await db.collection('audit_logs').add({
      action: 'grant_override',
      teacherId: req.user.uid,
      teacherName: req.user.name || 'Teacher',
      studentId: attempt.studentId,
      paperId: actualPaperId,
      ...(overrideMinutes ? { overrideMinutes: parseInt(overrideMinutes) } : {}),
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Access granted successfully',
      sessionId: keyId,
      paperId: actualPaperId
    });
  } catch (error) {
    console.error('Error in /teacher/override:', error);
    res.status(500).json({ error: 'Failed to grant override: ' + error.message });
  }
});

// 2. Teacher: Deny blocked student session (Confirm Malpractice)
router.post('/deny', verifyToken, async (req, res) => {
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
    if (!db) return res.status(500).json({ error: 'Database not connected' });

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

    res.json({
      message: 'Override denied, malpractice confirmed.'
    });
  } catch (error) {
    console.error('Error in /teacher/deny:', error);
    res.status(500).json({ error: 'Failed to deny override: ' + error.message });
  }
});

// 3. Teacher: Clear student attempts & violations for a specific subject (logs cleanup)
router.post('/clear-student-attempts', verifyToken, async (req, res) => {
  const { studentId, paperId } = req.body;
  if (!studentId || !paperId) {
    return res.status(400).json({ error: 'Student ID and Paper ID are required.' });
  }

  // Ensure user is teacher/admin
  if (!isAdminOrTeacher(req.user)) {
    return res.status(403).json({ error: 'Only teachers or admins can clear student attempts.' });
  }

  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    const paperDoc = await db.collection('papers').doc(paperId).get();
    if (!paperDoc.exists) {
      return res.status(404).json({ error: 'Paper not found.' });
    }
    const paperSubject = paperDoc.data().subject || paperDoc.data().title || '';

    // Find all papers in this subject pool
    const papersSnap = await db.collection('papers')
      .where('subject', '==', paperSubject)
      .get();
    const paperIds = papersSnap.docs.map(doc => doc.id);
    if (!paperIds.includes(paperId)) {
      paperIds.push(paperId);
    }

    let deletedAttemptsCount = 0;
    let deletedViolationsCount = 0;

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

// 4. Teacher: Get Live Monitoring details
router.get('/live-monitor', verifyToken, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    const activeSessions = [];
    const activeSnapshot = await db.collection('exam_attempts').get();
    activeSnapshot.forEach(doc => {
      activeSessions.push({ id: doc.id, ...doc.data() });
    });
    res.json({
      message: 'Live monitor list',
      activeSessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
