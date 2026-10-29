const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function run() {
  const papersSnap = await db.collection('papers').get();
  const examsSnap = await db.collection('exams').get();

  const examMap = {};
  examsSnap.forEach(d => {
    const data = d.data();
    examMap[d.id] = data.title || data.subject || data.name || d.id;
  });

  const paperToExam = {};
  papersSnap.forEach(d => {
    const data = d.data();
    const exTitle = examMap[data.examId] || data.subject || data.examTitle || 'Unknown Exam';
    paperToExam[d.id] = exTitle;
  });

  const attemptsSnap = await db.collection('exam_attempts').get();
  const examCounts = {};

  attemptsSnap.forEach(d => {
    const data = d.data();
    const timeStr = data.startedAt || data.submittedAt || data.createdAt;
    if (!timeStr) return;
    const dateObj = new Date(timeStr);
    const istDate = new Date(dateObj.getTime() + 5.5 * 60 * 60 * 1000);
    if (istDate.toISOString().substring(0, 10) === '2026-10-28') {
      let exName = 'Unknown Exam';
      if (data.examId && examMap[data.examId]) {
        exName = examMap[data.examId];
      } else if (data.paperId && paperToExam[data.paperId]) {
        exName = paperToExam[data.paperId];
      } else if (data.subject || data.examTitle) {
        exName = data.subject || data.examTitle;
      }
      examCounts[exName] = (examCounts[exName] || 0) + 1;
    }
  });

  console.log("Oct 28 Attempts by Actual Exam/Course Title:");
  console.log(JSON.stringify(Object.entries(examCounts).sort((a,b) => b[1] - a[1]), null, 2));
}

run().catch(console.error);
