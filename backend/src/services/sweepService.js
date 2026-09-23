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

      activeAttemptsSnapshot.forEach(doc => {
        const attempt = doc.data();
        if ((attempt.warnings || 0) >= 3) return; // Skip sessions with warnings exceeding threshold

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
        console.log(`✅ [Auto-Sweep] Auto-submitted ${count} expired exam sessions.`);
      }
    } catch (err) {
      console.error('❌ Error during active exam sweep:', err.message);
    }
  }, intervalMs);
}

module.exports = {
  startSweepService
};
