const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function deleteAidsStudents() {
  console.log('🔍 Searching for students registered under AIDS / AI & DS Engineering...');

  const usersSnap = await db.collection('users')
    .where('role', '==', 'student')
    .get();

  const aidsStudents = [];

  usersSnap.forEach(doc => {
    const data = doc.data();
    const dept = (data.department || '').trim().toLowerCase();
    const depts = (data.departments || []).map(d => String(d).trim().toLowerCase());

    const isAids = 
      dept.includes('ai & ds') || 
      dept.includes('aids') || 
      dept.includes('artificial intelligence') ||
      depts.some(d => d.includes('ai & ds') || d.includes('aids') || d.includes('artificial intelligence'));

    if (isAids) {
      aidsStudents.push({
        uid: doc.id,
        name: data.name || 'Unknown',
        email: data.email || 'No email',
        prn: data.prnNumber || 'N/A',
        department: data.department,
        semester: data.semester || 'N/A'
      });
    }
  });

  if (aidsStudents.length === 0) {
    console.log('ℹ️ No students found registered under AIDS / AI & DS Engineering.');
    process.exit(0);
  }

  console.log(`\n📋 Found ${aidsStudents.length} student(s) enrolled in AIDS:`);
  aidsStudents.forEach((s, idx) => {
    console.log(`  ${idx + 1}. [${s.semester}] ${s.name} | PRN: ${s.prn} | Email: ${s.email} | UID: ${s.uid}`);
  });

  console.log('\n🚀 Starting deletion of student accounts...');
  let deletedCount = 0;
  let failCount = 0;

  for (const student of aidsStudents) {
    try {
      // 1. Delete from Firebase Authentication
      try {
        await auth.deleteUser(student.uid);
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn(`  ⚠️ Auth delete warning for ${student.email}:`, authErr.message);
        }
      }

      // 2. Delete from Firestore users collection
      await db.collection('users').doc(student.uid).delete();

      // 3. Delete any linked exam attempts
      const attemptsSnap = await db.collection('exam_attempts').where('studentId', '==', student.uid).get();
      if (!attemptsSnap.empty) {
        const batch = db.batch();
        attemptsSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      deletedCount++;
      console.log(`  ✅ Deleted: ${student.name} (${student.email})`);
    } catch (err) {
      failCount++;
      console.error(`  ❌ Failed to delete ${student.name} (${student.uid}):`, err.message);
    }
  }

  // Record action in audit log
  try {
    await db.collection('audit_logs').add({
      action: 'batch_delete_aids_students',
      department: 'AI & DS Engineering',
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (_) {}

  console.log(`\n🎉 Finished! Successfully deleted ${deletedCount} student(s). Failed: ${failCount}.`);
  process.exit(0);
}

deleteAidsStudents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
