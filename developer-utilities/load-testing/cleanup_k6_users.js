const { db } = require('../../backend/src/firebase');
const SIM_PAPER_ID = 'sim_paper_k6_loadtest';

async function cleanup() {
  console.log('\n🧹 Cleaning up k6 simulation data...');
  const attemptsSnap = await db.collection('exam_attempts').where('paperId', '==', SIM_PAPER_ID).get();
  const cleanBatch = db.batch();
  attemptsSnap.forEach(d => cleanBatch.delete(d.ref));
  await cleanBatch.commit();
  console.log(`✅ Removed ${attemptsSnap.size} k6 exam attempts.`);
}

cleanup().catch(console.error);
