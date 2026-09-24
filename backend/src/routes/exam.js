const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { verifyToken } = require('../middleware/auth');

// 1. Start Exam
router.post('/start-exam', verifyToken, async (req, res) => {
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
    if (!db) {
      return res.status(500).json({ error: 'Database connection is required to start an exam.' });
    }

    // 1. Fetch Paper details
    const paperDoc = await db.collection('papers').doc(paperId).get();
    if (!paperDoc.exists) {
      return res.status(404).json({ error: 'Exam paper not found.' });
    }
    const paperObj = paperDoc.data();
    const paperDepartment = paperObj.department;
    let paperTitle = paperObj.title;
    const paperSubject = paperObj.subject || paperObj.title || '';

    // Security Check: Ensure student matches paper department and semester
    if (req.user.role === 'student') {
      if (req.user.department !== 'All' && paperDepartment !== req.user.department) {
        return res.status(403).json({ error: 'Forbidden: This exam belongs to a different department.' });
      }
      if (paperObj.semester && req.user.semester && String(paperObj.semester) !== String(req.user.semester)) {
        return res.status(403).json({ error: `Forbidden: This exam is for Semester ${paperObj.semester}, but you are in Semester ${req.user.semester}.` });
      }
    }

const parseScheduleDate = (dateStr) => {
  if (!dateStr) return null;
  let str = String(dateStr).trim();
  if (!str.includes('Z') && !str.includes('+') && !str.match(/-\d\d:\d\d$/) && !str.includes('GMT')) {
    str = str.replace(' ', 'T');
    if (str.length === 16) str += ':00';
    str += '+05:30'; // Default to Indian Standard Time (IST)
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

    // Schedule Window Check: Block students from starting outside the configured time window (unless explicitly started by teacher)
    if (req.user.role === 'student' && !paperObj.isStarted) {
      const now = new Date();
      const scheduleStart = parseScheduleDate(paperObj.scheduleStart);
      const scheduleEnd = parseScheduleDate(paperObj.scheduleEnd);
      if (scheduleStart && now < scheduleStart) {
        const formattedStart = scheduleStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        return res.status(403).json({
          error: `Exam has not started yet. It is scheduled to open on ${formattedStart}. Please wait.`,
          scheduleStart: paperObj.scheduleStart,
          scheduleEnd: paperObj.scheduleEnd || null
        });
      }
      if (scheduleEnd && now > scheduleEnd) {
        const formattedEnd = scheduleEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        return res.status(403).json({
          error: `Exam window has closed. This exam ended on ${formattedEnd}.`,
          scheduleStart: paperObj.scheduleStart || null,
          scheduleEnd: paperObj.scheduleEnd
        });
      }
    }

    // 2. Load Warning Threshold and Duration
    let defaultDurationSeconds = paperObj.durationMinutes ? (parseInt(paperObj.durationMinutes) * 60) : null;
    let warningThreshold = 3;

    const configDoc = await db.collection('settings').doc('config').get();
    if (configDoc.exists) {
      if (!defaultDurationSeconds) {
        const durationMin = configDoc.data().defaultDuration || 45;
        defaultDurationSeconds = durationMin * 60;
      }
      warningThreshold = configDoc.data().warningThreshold || 3;
    }
    if (!defaultDurationSeconds) defaultDurationSeconds = 2700;

    // 3. Retrieve all attempts by student to find status/prior warnings and calculate remaining time
    let priorAttempts = [];
    let isBlocked = false;

    const attemptsSnapshot = await db.collection('exam_attempts')
      .where('studentId', '==', studentId)
      .get();
    
    attemptsSnapshot.forEach(doc => {
      priorAttempts.push({ id: doc.id, ...doc.data() });
    });

    // Batch pre-fetch all paper subjects for prior attempts to eliminate N+1 Firestore queries
    const paperSubjectMap = {};
    if (priorAttempts.length > 0) {
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
      const papersSnapshot = await db.collection('papers')
        .where('subject', '==', paperSubject)
        .where('status', '==', 'published')
        .get();
      papersSnapshot.forEach(doc => {
        candidatePapers.push({ id: doc.id, ...doc.data() });
      });

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
    }

    // Recompute attemptId using final (possibly reassigned) paperId
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
          if (att.status === 'exited_on_violation' && att.overrideTimeSeconds > 0) {
            customOverrideSeconds = Math.max(customOverrideSeconds, att.overrideTimeSeconds);
          }
        }
      } else {
        if (att.overrideTimeSeconds > 0) {
          customOverrideSeconds = att.overrideTimeSeconds;
        }
      }
    }

    // Strongly consistent direct document check for custom override time
    const attemptDoc = await db.collection('exam_attempts').doc(attemptId).get();
    if (attemptDoc.exists) {
      const attData = attemptDoc.data();
      if (attData.overrideTimeSeconds > 0) {
        customOverrideSeconds = attData.overrideTimeSeconds;
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
      startedAt: new Date().toISOString(),
      warnings: 0,
      overrideTimeSeconds: calculatedTimeLeft
    };

    // Terminate any other active/exited attempts for other papers in the same subject pool
    const batch = db.batch();
    let terminatedCount = 0;
    for (const att of priorAttempts) {
      if (att.paperId !== paperId) {
        let attSubject = '';
        const pDoc = await db.collection('papers').doc(att.paperId).get();
        if (pDoc.exists) attSubject = pDoc.data().subject || pDoc.data().title || '';

        if (attSubject === paperSubject && (att.status === 'started' || att.status === 'exited_on_violation')) {
          const oldAttemptRef = db.collection('exam_attempts').doc(att.id);
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

    await db.runTransaction(async (transaction) => {
      const attemptRef = db.collection('exam_attempts').doc(attemptId);
      const attemptDocSnap = await transaction.get(attemptRef);
      if (attemptDocSnap.exists) {
        const data = attemptDocSnap.data();
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

    let questionsList = [];
    const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
    qSnap.forEach(doc => {
      questionsList.push({ id: doc.id, ...doc.data() });
    });

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

// 2. Submit Answer
router.post('/submit-answer', verifyToken, async (req, res) => {
  const { paperId, questionId, selectedOptionIndex } = req.body;
  if (!paperId || !questionId || selectedOptionIndex === undefined) {
    return res.status(400).json({ error: 'Paper ID, question ID, and selected option index are required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

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

// 2.5. Batch Sync Answers (Offline Resilience & Queue Replay)
router.post('/sync-batch-answers', verifyToken, async (req, res) => {
  const { paperId, answers } = req.body;
  if (!paperId || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Paper ID and answers array are required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    let syncedCount = 0;
    let returnRemaining = 0;

    await db.runTransaction(async (transaction) => {
      const attemptRef = db.collection('exam_attempts').doc(attemptId);
      const attemptDoc = await transaction.get(attemptRef);
      if (!attemptDoc.exists) {
        throw new Error('Active exam attempt not found.');
      }
      const attempt = attemptDoc.data();
      if (attempt.status !== 'started') {
        throw new Error(`Cannot sync answers. Exam session status is currently: ${attempt.status}`);
      }

      const paperDoc = await transaction.get(db.collection('papers').doc(paperId));
      let paperDuration = 2700;
      if (paperDoc.exists && paperDoc.data().durationMinutes) {
        paperDuration = parseInt(paperDoc.data().durationMinutes) * 60;
      }

      const existingAnswers = attempt.answers || {};
      answers.forEach(item => {
        if (item.questionId && item.selectedOptionIndex !== undefined) {
          existingAnswers[item.questionId] = item.selectedOptionIndex;
          syncedCount++;
        }
      });

      const startedAt = new Date(attempt.startedAt).getTime();
      const now = Date.now();
      const sessionElapsed = Math.round((now - startedAt) / 1000);
      const newElapsedTime = (attempt.elapsedTime || 0) + sessionElapsed;
      const currentLimit = attempt.overrideTimeSeconds > 0 ? attempt.overrideTimeSeconds : paperDuration;
      const remaining = Math.max(0, currentLimit - sessionElapsed);
      returnRemaining = remaining;

      transaction.update(attemptRef, {
        answers: existingAnswers,
        startedAt: new Date().toISOString(),
        elapsedTime: newElapsedTime,
        overrideTimeSeconds: remaining,
        lastSyncAt: new Date().toISOString(),
        pendingSyncCount: 0
      });
    });

    res.json({
      message: 'Batch answers synced successfully',
      sessionId: attemptId,
      syncedCount,
      remainingTimeSeconds: returnRemaining
    });
  } catch (error) {
    console.error('Error in /sync-batch-answers:', error);
    if (error.message.includes('not found') || error.message.includes('Cannot sync answers')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to sync answers: ' + error.message });
  }
});

// Ping Endpoint for Latency Measurement
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 3. Heartbeat (with Network Telemetry)
router.post('/heartbeat', verifyToken, async (req, res) => {
  const { paperId, pendingSyncCount, networkLatencyMs } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    let returnStatus = 'started';
    let returnRemaining = 0;

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

      const telemetryUpdate = {
        lastHeartbeatAt: new Date().toISOString(),
        networkStatus: (networkLatencyMs !== undefined && networkLatencyMs > 400) ? 'degraded' : 'online',
        ...(networkLatencyMs !== undefined ? { latencyMs: networkLatencyMs } : {}),
        ...(pendingSyncCount !== undefined ? { pendingSyncCount } : {})
      };

      if (finalRemainingSeconds <= 0) {
        transaction.update(attemptRef, {
          ...telemetryUpdate,
          status: 'submitted',
          elapsedTime: (attempt.elapsedTime || 0) + currentLimit,
          overrideTimeSeconds: 0,
          submittedAt: new Date().toISOString()
        });
        returnStatus = 'submitted';
        returnRemaining = 0;
      } else {
        transaction.update(attemptRef, {
          ...telemetryUpdate,
          startedAt: new Date().toISOString(),
          elapsedTime: (attempt.elapsedTime || 0) + sessionElapsed,
          overrideTimeSeconds: finalRemainingSeconds
        });
        returnStatus = 'started';
        returnRemaining = finalRemainingSeconds;
      }
    });

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

// 4. Auto-submit Exam
router.post('/auto-submit', verifyToken, async (req, res) => {
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const studentId = req.user.uid;
  const attemptId = `${studentId}_${paperId}`;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const attemptDoc = await db.collection('exam_attempts').doc(attemptId).get();
    if (!attemptDoc.exists) {
      return res.status(404).json({ error: 'Active exam attempt not found.' });
    }
    const attempt = attemptDoc.data();

    if (attempt.status === 'submitted') {
      let questionsList = [];
      const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
      qSnap.forEach(doc => {
        questionsList.push({ id: doc.id, ...doc.data() });
      });

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
    const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
    qSnap.forEach(doc => {
      questionsList.push({ id: doc.id, ...doc.data() });
    });

    let score = 0;
    const studentAnswers = attempt.answers || {};
    questionsList.forEach(q => {
      const ans = studentAnswers[q.id];
      if (ans !== undefined && ans === q.correctOptionIndex) {
        score++;
      }
    });
    const total = questionsList.length;

    await db.collection('exam_attempts').doc(attemptId).update({
      status: 'submitted',
      elapsedTime: finalElapsedTime,
      overrideTimeSeconds: 0,
      submittedAt: new Date().toISOString()
    });

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

module.exports = router;
