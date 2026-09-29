/**
 * Generates test student Firebase Auth tokens for Grafana k6
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'backend', '.env') });
const { admin, db } = require('../../backend/src/firebase');

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAwQ5Xdp0LkOOLopbhy7weM5XZR6xW9H8E';
const NUM_STUDENTS = parseInt(process.argv[2]) || 100;
const SIM_PAPER_ID = 'sim_paper_k6_loadtest';

async function getIdToken(uid, email) {
  const customToken = await admin.auth().createCustomToken(uid, { email });
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`Failed to mint ID token for ${uid}: ${data.error?.message || 'Unknown'}`);
  }
  return data.idToken;
}

async function prepare() {
  console.log(`\n📋 Preparing test paper "${SIM_PAPER_ID}"...`);
  await db.collection('papers').doc(SIM_PAPER_ID).set({
    id: SIM_PAPER_ID,
    title: 'Grafana k6 Concurrency Benchmark',
    subject: 'Cloud Load & Scalability Test',
    department: 'All',
    semester: 'All',
    durationMinutes: 45,
    isStarted: true,
    isVisible: true,
    totalMarks: 50,
    passingMarks: 20,
    createdAt: new Date().toISOString()
  }, { merge: true });

  const qBatch = db.batch();
  for (let i = 1; i <= 5; i++) {
    const qRef = db.collection('questions').doc(`k6_q_${i}`);
    qBatch.set(qRef, {
      id: `k6_q_${i}`,
      paperId: SIM_PAPER_ID,
      questionText: `k6 Test Question #${i}: What is the primary benefit of Grafana k6?`,
      options: [
        { text: 'High performance Go-based load testing' },
        { text: 'Slow interpreted execution' },
        { text: 'High memory consumption' },
        { text: 'None of the above' }
      ],
      correctOptionIndex: 0,
      order: i
    }, { merge: true });
  }
  await qBatch.commit();

  console.log(`🔑 Pre-generating ${NUM_STUDENTS} authenticated student sessions for k6...`);
  const students = [];
  const batches = [];
  const BATCH_SIZE = 25;
  for (let i = 0; i < NUM_STUDENTS; i += BATCH_SIZE) {
    batches.push(Array.from({ length: Math.min(BATCH_SIZE, NUM_STUDENTS - i) }, (_, idx) => i + idx + 1));
  }

  for (const chunk of batches) {
    const results = await Promise.all(chunk.map(async (num) => {
      const uid = `k6_student_${String(num).padStart(3, '0')}`;
      const email = `k6_student_${num}@dnyanshree.edu.in`;
      const name = `k6 Student ${num}`;
      const prn = `PRN-K6-${String(num).padStart(4, '0')}`;

      await db.collection('users').doc(uid).set({
        uid,
        name,
        email,
        role: 'student',
        department: 'All',
        semester: 'All',
        prnNumber: prn,
        collegeDomain: 'dnyanshree.edu.in',
        emailVerified: true
      }, { merge: true });

      const token = await getIdToken(uid, email);
      return { id: uid, email, name, prn, token };
    }));
    students.push(...results);
    process.stdout.write(`   Authenticated ${students.length}/${NUM_STUDENTS} students...\r`);
  }

  const outFile = path.join(__dirname, 'students.json');
  fs.writeFileSync(outFile, JSON.stringify({ paperId: SIM_PAPER_ID, students }, null, 2));
  console.log(`\n✅ Saved ${students.length} student sessions to: ${outFile}\n`);
}

prepare().catch(err => {
  console.error('❌ Error preparing k6 data:', err);
  process.exit(1);
});
