const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { verifyToken, isTeacherOrAdmin } = require('../middleware/auth');

// 1. Report Violation
router.post('/report-violation', verifyToken, async (req, res) => {
  const { paperId, reason } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    let paperDepartment = '';
    let paperSubject = '';
    let returnWarnings = 0;
    let nextStatus = 'exited_on_violation';
    let studentName = 'Student';

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
        attemptedPaperIds.add(paperId);

        const unusedPapersCount = candidatePaperIds.filter(pId => !attemptedPaperIds.has(pId)).length;

        if (unusedPapersCount === 0) {
          nextStatus = 'malpractice_failed';
        } else {
          nextStatus = 'blocked_pending_review';
        }
      }

      transaction.update(attemptRef, {
        status: nextStatus,
        warnings: newWarningsForAttempt,
        elapsedTime: newElapsedTime,
        overrideTimeSeconds: finalRemainingSeconds
      });
    });

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

    await db.collection('violations').add(violationRecord);

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

// 2. Teacher: Get violations list (proctoring alerts)
router.get('/teacher/violations', verifyToken, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    const snap = await db.collection('violations').orderBy('timestamp', 'desc').limit(50).get();
    const violations = [];
    snap.forEach(doc => {
      violations.push({ id: doc.id, ...doc.data() });
    });
    res.json({ violations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
