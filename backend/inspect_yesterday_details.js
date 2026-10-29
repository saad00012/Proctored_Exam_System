const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function checkDetails() {
  const startOfDay = "2026-10-27T00:00:00.000Z";
  const endOfDay = "2026-10-28T00:00:00.000Z";

  const snap = await db.collection('exam_attempts')
    .where('startedAt', '>=', startOfDay)
    .where('startedAt', '<', endOfDay)
    .limit(5)
    .get();

  console.log("Sample 5 attempt document keys and fields:");
  snap.forEach(d => {
    console.log(`\nDoc ID: ${d.id}`);
    const data = d.data();
    console.log("Keys:", Object.keys(data));
    console.log("Sample data:", JSON.stringify({
      studentName: data.studentName || data.name,
      studentEmail: data.studentEmail || data.email,
      paperId: data.paperId,
      examId: data.examId,
      paperTitle: data.paperTitle,
      subject: data.subject,
      department: data.department,
      semester: data.semester,
      score: data.score,
      totalMarks: data.totalMarks,
      startedAt: data.startedAt,
      submittedAt: data.submittedAt,
      status: data.status
    }, null, 2));
  });

  // Check unique paperIds yesterday
  const allYesterday = await db.collection('exam_attempts')
    .where('startedAt', '>=', startOfDay)
    .where('startedAt', '<', endOfDay)
    .get();

  const paperIdCounts = {};
  allYesterday.forEach(d => {
    const pid = d.data().paperId || 'no_paper_id';
    paperIdCounts[pid] = (paperIdCounts[pid] || 0) + 1;
  });

  console.log("\nUnique paperIds count yesterday:", Object.keys(paperIdCounts).length);
  for (const [pid, cnt] of Object.entries(paperIdCounts).slice(0, 10)) {
    const pDoc = await db.collection('papers').doc(pid).get();
    if (pDoc.exists) {
      const p = pDoc.data();
      console.log(`Paper ${pid} (${cnt} attempts): ${p.subject} | ${p.title} | By: ${p.createdBy || p.createdByEmail}`);
    } else {
      console.log(`Paper ${pid} (${cnt} attempts): Not found in papers collection`);
    }
  }

  // Also check hourly breakdown of yesterday's attempts
  const hourly = {};
  allYesterday.forEach(d => {
    const s = d.data().startedAt || '';
    if (s.length >= 13) {
      // e.g. 2026-10-27T10:xx -> UTC hour
      const hourUtc = s.substring(11, 13);
      // convert to IST hour: (UTC + 5.5)
      const hInt = (parseInt(hourUtc, 10) + 5) % 24; // approx
      const key = `${hourUtc}:00 UTC (~${hInt}:30 IST)`;
      hourly[key] = (hourly[key] || 0) + 1;
    }
  });
  console.log("\nHourly distribution of exam attempts started yesterday:");
  console.log(JSON.stringify(hourly, null, 2));
}

checkDetails().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
