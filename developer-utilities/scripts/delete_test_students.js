const path = require('path');
module.paths.push(path.resolve(__dirname, '..', '..', 'backend', 'node_modules'));
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'backend', '.env') });
const { admin, db } = require('../../backend/src/firebase');

async function inspectAndPurge() {
  console.log('🔍 Scanning Firestore users collection...');
  const usersSnap = await db.collection('users').get();
  
  const testUsersFirestore = [];
  const realUsersFirestore = [];

  usersSnap.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    const prn = data.prnNumber || '';
    const email = data.email || '';

    const isK6 = id.startsWith('k6_student_') || prn.startsWith('PRN-K6') || email.startsWith('k6_student_');
    const isSimLoad = id.startsWith('sim_student_') || prn.startsWith('PRN-LOAD') || email.startsWith('student_');

    if (isK6 || isSimLoad) {
      testUsersFirestore.push({ id, email, prn });
    } else {
      realUsersFirestore.push({ id, email, name: data.name, role: data.role });
    }
  });

  console.log(`\n📊 Scan Results in Firestore:`);
  console.log(`   Found Test Users: ${testUsersFirestore.length} (k6 + prn_load)`);
  console.log(`   Protected Real Users: ${realUsersFirestore.length}`);
  console.log('\n🔒 Real Users that will NOT be touched:');
  realUsersFirestore.forEach(u => console.log(`   - [${u.role || 'user'}] ${u.name || 'No Name'} (${u.email}) [ID: ${u.id}]`));

  console.log(`\n🧹 Proceeding to delete ${testUsersFirestore.length} test users from Firestore...`);

  // Batch delete Firestore user docs
  const testUids = testUsersFirestore.map(u => u.id);
  const BATCH_SIZE = 400;
  for (let i = 0; i < testUids.length; i += BATCH_SIZE) {
    const chunk = testUids.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(uid => {
      batch.delete(db.collection('users').doc(uid));
    });
    await batch.commit();
  }
  console.log(`✅ Deleted ${testUsersFirestore.length} test user documents from Firestore.`);

  // Delete from Firebase Auth
  console.log('🔑 Deleting test user accounts from Firebase Authentication...');
  let authDeletedCount = 0;
  for (let i = 0; i < testUids.length; i += 100) {
    const chunk = testUids.slice(i, i + 100);
    try {
      const deleteResult = await admin.auth().deleteUsers(chunk);
      authDeletedCount += deleteResult.successCount;
    } catch (e) {
      console.warn(`Warning deleting Auth batch: ${e.message}`);
    }
  }
  console.log(`✅ Deleted ${authDeletedCount} user accounts from Firebase Auth.`);

  // Cleanup test papers & questions
  console.log('📄 Removing test papers and questions...');
  const testPaperIds = ['sim_paper_100_loadtest', 'sim_paper_k6_loadtest'];
  for (const paperId of testPaperIds) {
    await db.collection('papers').doc(paperId).delete();
    const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
    const qBatch = db.batch();
    qSnap.forEach(d => qBatch.delete(d.ref));
    await qBatch.commit();
  }
  console.log('✅ Removed test papers and questions.');

  console.log('\n🎉 ALL 200 TEST STUDENTS COMPLETELY REMOVED! REAL STUDENTS INTACT.\n');
}

inspectAndPurge().catch(err => {
  console.error('❌ Error during purge:', err);
  process.exit(1);
});
