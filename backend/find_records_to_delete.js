const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function findRecords() {
  console.log("=== SEARCHING EXAMS ===");
  const examsSnap = await db.collection('exams').get();
  const matchedExams = [];
  examsSnap.forEach(d => {
    const data = d.data();
    const str = `${data.name || ''} ${data.subject || ''}`.toLowerCase();
    if (str.includes('object oriented') || str.includes('oop') || str.includes('unit test-i')) {
      matchedExams.push({ id: d.id, ...data });
    }
  });

  console.log(`Found ${matchedExams.length} potentially matching exams:`);
  matchedExams.forEach(e => {
    console.log(`- Exam ID: ${e.id} | Name: "${e.name}" | Subject: "${e.subject}" | CreatedAt: ${e.createdAt} | By: ${e.createdBy} (${e.createdByEmail})`);
  });

  console.log("\n=== SEARCHING PAPERS ===");
  const papersSnap = await db.collection('papers').get();
  const matchedPapers = [];
  papersSnap.forEach(d => {
    const data = d.data();
    const str = `${data.title || ''} ${data.subject || ''}`.toLowerCase();
    if (str.includes('object oriented') || str.includes('oop')) {
      matchedPapers.push({ id: d.id, ...data });
    }
  });

  console.log(`Found ${matchedPapers.length} matching papers:`);
  matchedPapers.forEach(p => {
    console.log(`- Paper ID: ${p.id} | Exam ID: ${p.examId} | Title: "${p.title}" | Subject: "${p.subject}" | CreatedAt: ${p.createdAt} | By: ${p.createdBy} (${p.createdByEmail})`);
  });

  console.log("\n=== SEARCHING ATTEMPTS ===");
  const matchedPaperIds = new Set(matchedPapers.map(p => p.id));
  const attemptsSnap = await db.collection('exam_attempts').get();
  const matchedAttempts = [];
  attemptsSnap.forEach(d => {
    const data = d.data();
    if (matchedPaperIds.has(data.paperId) || (data.subject && data.subject.toLowerCase().includes('object oriented'))) {
      matchedAttempts.push({ id: d.id, paperId: data.paperId, studentName: data.studentName, status: data.status, startedAt: data.startedAt });
    }
  });

  console.log(`Found ${matchedAttempts.length} matching student attempts.`);
  const attemptsByPaper = {};
  matchedAttempts.forEach(a => {
    attemptsByPaper[a.paperId] = (attemptsByPaper[a.paperId] || 0) + 1;
  });
  console.log("Attempts breakdown by paperId:", attemptsByPaper);
}

findRecords().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
