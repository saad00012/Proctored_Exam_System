const { db } = require('../firebase');

/**
 * Periodically checks active exam sessions and marks expired sessions as submitted.
 */
function startSweepService(intervalMs = 30000) {
  setInterval(async () => {
    try {
      if (!db) return;

      const activeAttemptsSnapshot = await db.collection('exam_attempts')
        .where('status', '==', 'started')
        .get();

      if (activeAttemptsSnapshot.empty) return;

      const batch = db.batch();
      let count = 0;

      for (const doc of activeAttemptsSnapshot.docs) {
        const attempt = doc.data();
        if ((attempt.warnings || 0) >= 3) continue; // Skip sessions with warnings exceeding threshold

        const startedAt = new Date(attempt.startedAt).getTime();
        const now = Date.now();
        const sessionElapsed = Math.round((now - startedAt) / 1000);
        const limitSeconds = (attempt.overrideTimeSeconds || 2700);
        const remaining = limitSeconds - sessionElapsed;

        // 10-minute (600s) grace period: never cut off students prematurely due to server/network latency
        const GRACE_PERIOD_SECONDS = 600;

        // Also check if student is still actively heartbeating (within last 5 minutes)
        const lastHeartbeatTime = attempt.lastHeartbeatAt ? new Date(attempt.lastHeartbeatAt).getTime() : 0;
        const isHeartbeatingActive = lastHeartbeatTime > 0 && (now - lastHeartbeatTime < 300000);

        if (remaining <= -GRACE_PERIOD_SECONDS && !isHeartbeatingActive) {
          const finalElapsedTime = (attempt.elapsedTime || 0) + limitSeconds;

          // Calculate score from answers so expired exams are never left with 0/undefined
          let score = 0;
          let totalMarks = 0;
          let totalQuestions = 0;

          try {
            const paperId = attempt.paperId;
            const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
            const studentAnswers = attempt.answers || {};
            totalQuestions = qSnap.size;

            qSnap.forEach(qDoc => {
              const q = qDoc.data();
              const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 1;
              totalMarks += qMarks;
              const ans = studentAnswers[qDoc.id];
              if (ans !== undefined && ans === q.correctOptionIndex) {
                score += qMarks;
              }
            });
            score = Math.round((score + Number.EPSILON) * 100) / 100;
            totalMarks = Math.round((totalMarks + Number.EPSILON) * 100) / 100;
          } catch (calcErr) {
            console.error(`Failed to calculate score during sweep for ${doc.id}:`, calcErr.message);
          }

          const updateData = {
            status: 'submitted',
            elapsedTime: finalElapsedTime,
            overrideTimeSeconds: 0,
            submittedAt: new Date().toISOString()
          };

          if (totalQuestions > 0) {
            updateData.score = score;
            updateData.totalMarks = totalMarks;
            updateData.totalQuestions = totalQuestions;
          }

          batch.update(doc.ref, updateData);
          count++;

          if (count % 450 === 0) {
            await batch.commit();
            batch = db.batch();
          }
        }
      }

      if (count > 0 && count % 450 !== 0) {
        await batch.commit();
        console.log(`✅ [Auto-Sweep] Auto-submitted and graded ${count} expired exam sessions.`);
      }
    } catch (err) {
      console.error('❌ Error during active exam sweep:', err.message);
    }
  }, intervalMs);
}

module.exports = {
  startSweepService
};
