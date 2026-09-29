import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom Metrics
const startExamLatency = new Trend('latency_start_exam');
const heartbeatLatency = new Trend('latency_heartbeat');
const submitAnswerLatency = new Trend('latency_submit_answer');
const autoSubmitLatency = new Trend('latency_auto_submit');
const rateLimitCount = new Counter('rate_limited_429');

// Load Pre-authenticated Students
const testData = JSON.parse(open('./students.json'));
const students = testData.students;
const paperId = testData.paperId;

const BASE_URL = __ENV.TARGET_URL || 'https://proctored-exam-system-3z35.onrender.com';

export const options = {
  scenarios: {
    exam_concurrency: {
      executor: 'per-vu-iterations',
      vus: Math.min(100, students.length),
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.05'],     // Failure rate must be < 5%
    'rate_limited_429': ['count==0'],    // ZERO rate limits allowed
    'latency_start_exam': ['p(95)<12000'], // 95% of burst starts under 12s on cloud
    'latency_heartbeat': ['p(95)<4000'],   // 95% of heartbeats under 4s
  },
};

export default function () {
  // Map virtual user index to student account
  const vuIndex = (__VU - 1) % students.length;
  const student = students[vuIndex];

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${student.token}`,
    },
    timeout: '25s',
  };

  // 1. BURST START EXAM
  const startPayload = JSON.stringify({ paperId });
  const startRes = http.post(`${BASE_URL}/start-exam`, startPayload, params);
  startExamLatency.add(startRes.timings.duration);
  if (startRes.status === 429) rateLimitCount.add(1);

  check(startRes, {
    'start-exam status is 200': (r) => r.status === 200,
  });

  // Staggered pacing before heartbeat (students read instructions / wait)
  sleep(3);

  // 2. HEARTBEAT
  const hbPayload = JSON.stringify({
    paperId,
    networkLatencyMs: Math.floor(Math.random() * 50) + 20,
  });
  const hbRes = http.post(`${BASE_URL}/heartbeat`, hbPayload, params);
  heartbeatLatency.add(hbRes.timings.duration);
  if (hbRes.status === 429) rateLimitCount.add(1);

  check(hbRes, {
    'heartbeat status is 200': (r) => r.status === 200,
  });

  // Students thinking & selecting answers
  sleep(3);

  // 3. SUBMIT ANSWER
  const ansPayload = JSON.stringify({
    paperId,
    questionId: `k6_q_${(vuIndex % 5) + 1}`,
    selectedOptionIndex: 0,
  });
  const ansRes = http.post(`${BASE_URL}/submit-answer`, ansPayload, params);
  submitAnswerLatency.add(ansRes.timings.duration);
  if (ansRes.status === 429) rateLimitCount.add(1);

  check(ansRes, {
    'submit-answer status is 200': (r) => r.status === 200,
  });

  // Brief pause before exam auto-submits
  sleep(2);

  // 4. AUTO SUBMIT
  const submitPayload = JSON.stringify({ paperId });
  const submitRes = http.post(`${BASE_URL}/auto-submit`, submitPayload, params);
  autoSubmitLatency.add(submitRes.timings.duration);
  if (submitRes.status === 429) rateLimitCount.add(1);

  check(submitRes, {
    'auto-submit status is 200': (r) => r.status === 200,
  });
}
