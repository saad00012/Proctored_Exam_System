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

async function countAidsStudents() {
  console.log('🔍 Fetching all student records from database...');

  const usersSnap = await db.collection('users')
    .where('role', '==', 'student')
    .get();

  const semesterBuckets = {};
  const allAidsStudents = [];

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
      const sem = data.semester || 'Unassigned';
      if (!semesterBuckets[sem]) {
        semesterBuckets[sem] = [];
      }
      const studentInfo = {
        name: data.name || 'Unknown',
        prn: data.prnNumber || 'N/A',
        email: data.email || 'No email',
        semester: sem
      };
      semesterBuckets[sem].push(studentInfo);
      allAidsStudents.push(studentInfo);
    }
  });

  console.log('\n======================================================');
  console.log(`📊 AI & DS ENGINEERING — TOTAL ENROLLED: ${allAidsStudents.length} STUDENTS`);
  console.log('======================================================\n');

  if (allAidsStudents.length === 0) {
    console.log('No students found registered under AI & DS Engineering.');
    process.exit(0);
  }

  // Print breakdown by semester
  const sortedSemesters = Object.keys(semesterBuckets).sort();
  for (const sem of sortedSemesters) {
    const list = semesterBuckets[sem];
    console.log(`🔹 ${sem}: ${list.length} student(s)`);
  }

  console.log('\n------------------------------------------------------');
  console.log('📋 DETAILED STUDENT LIST BY SEMESTER:');
  console.log('------------------------------------------------------');

  for (const sem of sortedSemesters) {
    console.log(`\n📌 ${sem.toUpperCase()} (${semesterBuckets[sem].length} students):`);
    semesterBuckets[sem].forEach((s, idx) => {
      console.log(`   ${idx + 1}. ${s.name} | PRN: ${s.prn} | Email: ${s.email}`);
    });
  }

  console.log('\n======================================================\n');
  process.exit(0);
}

countAidsStudents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
