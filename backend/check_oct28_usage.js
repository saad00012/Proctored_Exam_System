const admin = require('firebase-admin');
const path = require('path');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function run() {
  console.log("=== CHECKING USAGE FOR YESTERDAY (OCTOBER 28, 2026) ===");

  // Let's load papers & exams first for name mapping
  const papersSnap = await db.collection('papers').get();
  const paperMap = {};
  papersSnap.forEach(d => {
    const data = d.data();
    paperMap[d.id] = data.title || data.subject || data.name || d.id;
  });

  const examsSnap = await db.collection('exams').get();
  const examMap = {};
  examsSnap.forEach(d => {
    const data = d.data();
    examMap[d.id] = data.title || data.subject || data.name || d.id;
  });

  // Query attempts for Oct 28
  // Check both ISO date starting with 2026-10-28 or timestamp in UTC/IST
  const allAttemptsSnap = await db.collection('exam_attempts').get();
  console.log(`Total attempts in collection: ${allAttemptsSnap.size}`);

  const oct28Attempts = [];
  const statusCounts = {};
  const studentSet = new Set();
  const subjectCounts = {};
  const hourlyBuckets = {}; // IST hours
  const paperSetCounts = {};
  let totalScoreSubmitted = 0;
  let submittedCount = 0;

  allAttemptsSnap.forEach(d => {
    const data = d.data();
    const timeStr = data.startedAt || data.submittedAt || data.createdAt;
    if (!timeStr) return;

    // Check if within Oct 28 IST or UTC
    const dateObj = new Date(timeStr);
    // Convert to IST
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(dateObj.getTime() + istOffsetMs);
    const istDateStr = istDate.toISOString().substring(0, 10);

    // If IST date is 2026-10-28
    if (istDateStr === '2026-10-28') {
      oct28Attempts.push({ id: d.id, ...data });

      const st = data.status || 'unknown';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const studentKey = data.studentEmail || data.studentId || data.userId || data.prn || 'unknown_student';
      studentSet.add(studentKey);

      // Subject / Exam name
      let subj = data.subject || data.examTitle;
      if (!subj && data.paperId && paperMap[data.paperId]) {
        subj = paperMap[data.paperId];
      }
      if (!subj && data.examId && examMap[data.examId]) {
        subj = examMap[data.examId];
      }
      subj = subj || 'Uncategorized';
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;

      if (data.paperId) {
        paperSetCounts[data.paperId] = (paperSetCounts[data.paperId] || 0) + 1;
      }

      // Hourly distribution in IST
      const istHour = istDate.getUTCHours();
      const hourLabel = `${String(istHour).padStart(2, '0')}:00 - ${String(istHour).padStart(2, '0')}:59 IST`;
      hourlyBuckets[hourLabel] = (hourlyBuckets[hourLabel] || 0) + 1;

      if (data.status === 'submitted' && typeof data.score === 'number' && typeof data.totalMarks === 'number' && data.totalMarks > 0) {
        totalScoreSubmitted += (data.score / data.totalMarks) * 100;
        submittedCount++;
      }
    }
  });

  console.log(`Total Attempts on Oct 28 (IST): ${oct28Attempts.length}`);
  console.log(`Unique Students on Oct 28: ${studentSet.size}`);
  console.log("Status Breakdown:", statusCounts);

  // Check Violations on Oct 28
  const violationsSnap = await db.collection('violations').get();
  let oct28Violations = 0;
  const violationReasons = {};
  const studentsWithViolations = new Set();

  violationsSnap.forEach(d => {
    const data = d.data();
    const t = data.timestamp || data.createdAt;
    if (t) {
      const dateObj = new Date(t);
      const istDate = new Date(dateObj.getTime() + 5.5 * 60 * 60 * 1000);
      if (istDate.toISOString().substring(0, 10) === '2026-10-28') {
        oct28Violations++;
        const r = data.reason || data.type || 'Unknown';
        violationReasons[r] = (violationReasons[r] || 0) + 1;
        if (data.studentEmail || data.studentId || data.userId) {
          studentsWithViolations.add(data.studentEmail || data.studentId || data.userId);
        }
      }
    }
  });

  const report = {
    date: '2026-10-28 (Yesterday, IST)',
    summary: {
      totalAttempts: oct28Attempts.length,
      uniqueStudents: studentSet.size,
      submitted: statusCounts['submitted'] || 0,
      terminatedReassigned: statusCounts['terminated_reassigned'] || 0,
      startedUnfinished: statusCounts['started'] || 0,
      exitedOnViolation: statusCounts['exited_on_violation'] || 0,
      malpracticeFailed: statusCounts['malpractice_failed'] || 0,
      averagePercentage: submittedCount > 0 ? (totalScoreSubmitted / submittedCount).toFixed(2) + '%' : 'N/A'
    },
    hourlyTrafficIST: Object.entries(hourlyBuckets).sort(),
    topSubjectsExams: Object.entries(subjectCounts).sort((a,b) => b[1] - a[1]),
    distinctPaperSetsUsed: Object.keys(paperSetCounts).length,
    violations: {
      total: oct28Violations,
      uniqueFlaggedStudents: studentsWithViolations.size,
      reasons: violationReasons
    }
  };

  console.log("\n=== FULL REPORT ===");
  console.log(JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error("Error checking Oct 28 usage:", err);
  process.exit(1);
});
