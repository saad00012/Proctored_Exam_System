const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function runStats() {
  console.log('Fetching system statistics from Firestore...');

  // 1. Users Breakdown
  const usersSnap = await db.collection('users').get();
  let studentsCount = 0;
  let teachersCount = 0;
  let adminCount = 0;
  let otherUsersCount = 0;

  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.role === 'student') studentsCount++;
    else if (data.role === 'teacher') teachersCount++;
    else if (data.role === 'superadmin' || data.role === 'admin') adminCount++;
    else otherUsersCount++;
  });

  // 2. Exams, Papers, Questions
  const examsSnap = await db.collection('exams').get();
  const papersSnap = await db.collection('papers').get();
  const questionsSnap = await db.collection('questions').get();

  // 3. Exam Attempts
  const attemptsSnap = await db.collection('exam_attempts').get();
  const totalAttempts = attemptsSnap.size;
  const attemptsByStatus = {};
  const attemptsByDate = {};
  const attemptsByExam = {};

  attemptsSnap.forEach(doc => {
    const data = doc.data();
    const st = data.status || 'unknown';
    attemptsByStatus[st] = (attemptsByStatus[st] || 0) + 1;

    let dateKey = 'Unknown Date';
    if (data.startedAt) {
      dateKey = data.startedAt.substring(0, 10);
    } else if (data.submittedAt) {
      dateKey = data.submittedAt.substring(0, 10);
    }
    attemptsByDate[dateKey] = (attemptsByDate[dateKey] || 0) + 1;

    const examTitle = data.examTitle || data.paperTitle || data.subject || data.examId || 'Unknown Exam';
    attemptsByExam[examTitle] = (attemptsByExam[examTitle] || 0) + 1;
  });

  // 4. Violations
  const violationsSnap = await db.collection('violations').get();
  const totalViolations = violationsSnap.size;
  const violationsByReason = {};
  violationsSnap.forEach(doc => {
    const data = doc.data();
    const r = data.reason || data.type || 'unspecified';
    violationsByReason[r] = (violationsByReason[r] || 0) + 1;
  });

  // 5. Allowed domains & settings
  const domainsSnap = await db.collection('allowed_domains').get();

  const report = {
    generatedAt: new Date().toISOString(),
    users: {
      total: usersSnap.size,
      students: studentsCount,
      teachers: teachersCount,
      admins: adminCount,
      others: otherUsersCount
    },
    academics: {
      totalExams: examsSnap.size,
      totalPapers: papersSnap.size,
      totalQuestions: questionsSnap.size
    },
    examAttempts: {
      total: totalAttempts,
      byStatus: attemptsByStatus,
      byDate: attemptsByDate,
      topExams: Object.entries(attemptsByExam).sort((a,b) => b[1] - a[1]).slice(0, 15)
    },
    violations: {
      total: totalViolations,
      byReason: violationsByReason
    },
    allowedDomains: domainsSnap.size
  };

  console.log(JSON.stringify(report, null, 2));
}

runStats().catch(err => {
  console.error('Error running stats:', err);
  process.exit(1);
});
