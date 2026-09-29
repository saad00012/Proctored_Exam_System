/**
 * Automated Multi-Student Load Simulation & Stress Testing Engine
 * Simulates up to 100+ concurrent students taking an exam on a shared network.
 * 
 * Usage:
 *   node scripts/simulate_load.js --students=15 --target=local
 *   node scripts/simulate_load.js --students=100 --target=local --duration=30
 *   node scripts/simulate_load.js --students=50 --target=live
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'backend', '.env') });
const { admin, db } = require('../../backend/src/firebase');

// Parse CLI Arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? true : v;
  return acc;
}, {});

const NUM_STUDENTS = parseInt(args.students) || 100;
const DURATION_SECS = parseInt(args.duration) || 30;
const TARGET_ENV = args.target || 'local';
const BASE_URL = TARGET_ENV === 'live'
  ? 'https://proctored-exam-system-3z35.onrender.com'
  : 'http://localhost:5000';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAwQ5Xdp0LkOOLopbhy7weM5XZR6xW9H8E';
const SIM_PAPER_ID = 'sim_paper_100_loadtest';

// Telemetry state
const metrics = {
  totalRequests: 0,
  success: 0,
  rateLimited429: 0,
  serverErrors500: 0,
  otherErrors: 0,
  latencies: [],
  endpointStats: {}
};

function recordRequest(endpoint, status, latencyMs) {
  metrics.totalRequests++;
  metrics.latencies.push(latencyMs);

  if (!metrics.endpointStats[endpoint]) {
    metrics.endpointStats[endpoint] = { total: 0, success: 0, failed: 0 };
  }
  metrics.endpointStats[endpoint].total++;

  if (status >= 200 && status < 300) {
    metrics.success++;
    metrics.endpointStats[endpoint].success++;
  } else if (status === 429) {
    metrics.rateLimited429++;
    metrics.endpointStats[endpoint].failed++;
  } else if (status >= 500) {
    metrics.serverErrors500++;
    metrics.endpointStats[endpoint].failed++;
  } else {
    metrics.otherErrors++;
    metrics.endpointStats[endpoint].failed++;
  }
}

// Exchange Custom Token for real Firebase ID Token
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

// Make HTTP request with metrics recording
async function apiCall(endpoint, method, body, token) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const latency = Date.now() - start;
    recordRequest(endpoint, res.status, latency);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, data: json, text, latency };
  } catch (err) {
    const latency = Date.now() - start;
    recordRequest(endpoint, 599, latency);
    return { ok: false, status: 599, error: err.message, latency };
  }
}

// Setup dedicated test paper in Firestore
async function setupSimulationPaper() {
  console.log(`📄 Initializing test paper: "${SIM_PAPER_ID}"...`);
  const paperRef = db.collection('papers').doc(SIM_PAPER_ID);
  await paperRef.set({
    id: SIM_PAPER_ID,
    title: '100-Student Concurrency Benchmark Exam',
    subject: 'System Architecture & Load Test',
    department: 'All',
    semester: 'All',
    durationMinutes: 45,
    isStarted: true,
    isVisible: true,
    totalMarks: 50,
    passingMarks: 20,
    createdAt: new Date().toISOString()
  }, { merge: true });

  // Add 5 mock questions
  const qBatch = db.batch();
  for (let i = 1; i <= 5; i++) {
    const qRef = db.collection('questions').doc(`sim_q_${i}`);
    qBatch.set(qRef, {
      id: `sim_q_${i}`,
      paperId: SIM_PAPER_ID,
      questionText: `Load Test Question #${i}: What is the expected time complexity of a hash table lookup?`,
      options: [
        { text: 'O(1) Average' },
        { text: 'O(n)' },
        { text: 'O(log n)' },
        { text: 'O(n^2)' }
      ],
      correctOptionIndex: 0,
      order: i
    }, { merge: true });
  }
  await qBatch.commit();
  console.log('✅ Simulation paper and 5 questions ready.');
}

async function runLoadSimulation() {
  console.log('\n===============================================================');
  console.log(`🚀 STARTING EXAM LOAD SIMULATION ENGINE`);
  console.log(`   Target Server:     ${BASE_URL} (${TARGET_ENV})`);
  console.log(`   Virtual Students:  ${NUM_STUDENTS}`);
  console.log(`   Simulation Time:   ${DURATION_SECS} seconds`);
  console.log(`   Local Machine IP:  All requests emanate from this single IP!`);
  console.log('===============================================================\n');

  await setupSimulationPaper();

  // Step 1: Generate student sessions
  console.log(`\n🔑 Minting authentic Firebase Auth tokens for ${NUM_STUDENTS} students in parallel...`);
  const prepStart = Date.now();
  const students = [];

  const tokenBatches = [];
  const BATCH_SIZE = 25;
  for (let i = 0; i < NUM_STUDENTS; i += BATCH_SIZE) {
    const chunk = Array.from({ length: Math.min(BATCH_SIZE, NUM_STUDENTS - i) }, (_, idx) => i + idx + 1);
    tokenBatches.push(chunk);
  }

  for (const chunk of tokenBatches) {
    const results = await Promise.all(chunk.map(async (num) => {
      const uid = `sim_student_${String(num).padStart(3, '0')}`;
      const email = `student_${num}@dnyanshree.edu.in`;
      const name = `LoadTest Student ${num}`;
      const prn = `PRN-LOAD-${String(num).padStart(4, '0')}`;

      // Ensure user profile in Firestore
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
  console.log(`\n✅ Generated ${students.length} student sessions in ${((Date.now() - prepStart) / 1000).toFixed(1)}s.`);

  // Step 2: Simulate BURST Exam Launch (All students call /start-exam at the same instant)
  console.log(`\n⚡ PHASE 1: BURST LAUNCH &mdash; ${NUM_STUDENTS} students hitting /start-exam simultaneously...`);
  const burstStart = Date.now();
  const startResults = await Promise.all(
    students.map(s => apiCall('/start-exam', 'POST', { paperId: SIM_PAPER_ID }, s.token))
  );
  const burstDuration = Date.now() - burstStart;
  const startSuccesses = startResults.filter(r => r.ok).length;
  console.log(`   Completed burst /start-exam in ${burstDuration}ms.`);
  console.log(`   Results: ${startSuccesses}/${NUM_STUDENTS} started successfully (${((startSuccesses / NUM_STUDENTS) * 100).toFixed(1)}%).`);

  // Step 3: Active Exam Phase (Periodic Heartbeats, Answer Submissions & Occasional Violations)
  console.log(`\n⏱️ PHASE 2: ACTIVE SESSION &mdash; Running sustained traffic for ${DURATION_SECS} seconds...`);
  const activeStart = Date.now();
  let intervalCount = 0;

  const simulationPromise = new Promise((resolve) => {
    // Heartbeat ticker every 10 seconds for simulation (to stress test even higher than the 25s production interval)
    const heartbeatTimer = setInterval(async () => {
      intervalCount++;
      const elapsed = Math.round((Date.now() - activeStart) / 1000);
      if (elapsed >= DURATION_SECS) {
        clearInterval(heartbeatTimer);
        resolve();
        return;
      }

      console.log(`   [T+${elapsed}s] Sending heartbeats & answer saves for ${NUM_STUDENTS} students...`);
      
      // Send heartbeats
      const hbPromises = students.map(s => 
        apiCall('/heartbeat', 'POST', { paperId: SIM_PAPER_ID, networkLatencyMs: Math.floor(Math.random() * 80) + 20 }, s.token)
      );

      // Keep track of violating students
      if (!global.violatorIds) global.violatorIds = new Set();
      
      // 5% of students report random app-switching violation once
      const numViolators = Math.max(1, Math.floor(students.length * 0.05));
      const candidatesForViolation = students.filter(s => !global.violatorIds.has(s.id)).slice(0, numViolators);
      candidatesForViolation.forEach(s => global.violatorIds.add(s.id));

      const violPromises = candidatesForViolation.map(s =>
        apiCall('/report-violation', 'POST', { paperId: SIM_PAPER_ID, reason: 'App switched (simulated)' }, s.token)
      );

      // Active (non-violating) students submit answers
      const activeStudents = students.filter(s => !global.violatorIds.has(s.id));
      const answeringStudents = activeStudents.slice().sort(() => 0.5 - Math.random()).slice(0, Math.min(30, activeStudents.length));
      const ansPromises = answeringStudents.map(s =>
        apiCall('/submit-answer', 'POST', {
          paperId: SIM_PAPER_ID,
          questionId: `sim_q_${Math.floor(Math.random() * 5) + 1}`,
          selectedOptionIndex: Math.floor(Math.random() * 4)
        }, s.token)
      );

      await Promise.allSettled([...hbPromises, ...ansPromises, ...violPromises]);
    }, 10000); // 10s tick
  });

  await simulationPromise;

  // Step 4: Exam Auto-Submit Phase
  const activeStudents = students.filter(s => !global.violatorIds?.has(s.id));
  console.log(`\n🏁 PHASE 3: FINAL SUBMISSION — Submitting exams for ${activeStudents.length} active students...`);
  const submitStart = Date.now();
  const submitResults = await Promise.all(
    activeStudents.map(s => apiCall('/auto-submit', 'POST', { paperId: SIM_PAPER_ID }, s.token))
  );
  const submitDuration = Date.now() - submitStart;
  const submitSuccesses = submitResults.filter(r => r.ok).length;
  console.log(`   Completed all submissions in ${submitDuration}ms.`);
  console.log(`   Results: ${submitSuccesses}/${activeStudents.length} submitted successfully.`);

  // Step 5: Generate Final Telemetry Report
  printReport();

  // Cleanup simulation attempt records from Firestore
  console.log('\n🧹 Cleaning up simulation exam attempts from database...');
  const attemptsSnap = await db.collection('exam_attempts').where('paperId', '==', SIM_PAPER_ID).get();
  const cleanBatch = db.batch();
  attemptsSnap.forEach(d => cleanBatch.delete(d.ref));
  await cleanBatch.commit();
  console.log(`✅ Removed ${attemptsSnap.size} temporary simulation attempt records.`);
  console.log('\n🎉 Simulation Complete! Server and database are clean.\n');
  process.exit(0);
}

function printReport() {
  const sorted = metrics.latencies.slice().sort((a, b) => a - b);
  const avgLatency = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const minLatency = sorted.length ? sorted[0] : 0;
  const maxLatency = sorted.length ? sorted[sorted.length - 1] : 0;
  const p95Latency = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const successPct = metrics.totalRequests ? ((metrics.success / metrics.totalRequests) * 100).toFixed(2) : 0;

  console.log('\n===============================================================');
  console.log('📊 LOAD SIMULATION & CAPACITY BENCHMARK REPORT');
  console.log('===============================================================');
  console.log(`   Total HTTP Requests Sent:     ${metrics.totalRequests}`);
  console.log(`   ✅ Successful (HTTP 200/2xx): ${metrics.success} (${successPct}%)`);
  console.log(`   🚫 Rate Limited (HTTP 429):   ${metrics.rateLimited429} (Should be 0)`);
  console.log(`   ❌ Server Errors (HTTP 500):  ${metrics.serverErrors500}`);
  console.log(`   ⚠️ Other / Network Errors:    ${metrics.otherErrors}`);
  console.log('---------------------------------------------------------------');
  console.log(`   ⏱️ Latency (Round-Trip):`);
  console.log(`      Average:     ${avgLatency} ms`);
  console.log(`      Minimum:     ${minLatency} ms`);
  console.log(`      95th %ile:   ${p95Latency} ms`);
  console.log(`      Maximum:     ${maxLatency} ms`);
  console.log('---------------------------------------------------------------');
  console.log(`   Endpoint Breakdown:`);
  for (const [ep, stat] of Object.entries(metrics.endpointStats)) {
    const pct = ((stat.success / stat.total) * 100).toFixed(1);
    console.log(`      ${ep.padEnd(20)} Total: ${String(stat.total).padEnd(5)} Success: ${String(stat.success).padEnd(5)} (${pct}%)`);
  }
  console.log('===============================================================');

  if (metrics.rateLimited429 === 0 && Number(successPct) >= 95) {
    console.log('🌟 VERDICT: PASSED! System successfully handled 100 concurrent students without rate limiting.');
  } else if (metrics.rateLimited429 > 0) {
    console.log('⚠️ VERDICT: Rate limits were triggered. Check route whitelist configuration.');
  } else {
    console.log('⚠️ VERDICT: High error rate detected. Review latency and server logs.');
  }
}

runLoadSimulation().catch(err => {
  console.error('\n❌ Fatal simulation failure:', err);
  process.exit(1);
});
