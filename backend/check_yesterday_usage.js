const path = require('path');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function run() {
  console.log("=== 1. CHECKING FIRESTORE ATTEMPTS & EXAMS FOR YESTERDAY (2026-10-27) ===");
  const startOfDay = "2026-10-27T00:00:00.000Z";
  const endOfDay = "2026-10-28T00:00:00.000Z";

  const attemptsSnap = await db.collection('exam_attempts')
    .where('startedAt', '>=', startOfDay)
    .where('startedAt', '<', endOfDay)
    .get();

  console.log(`Total exam attempts started yesterday (2026-10-27): ${attemptsSnap.size}`);

  const bySubject = {};
  const byStatus = {};
  const uniqueStudents = new Set();

  attemptsSnap.forEach(d => {
    const data = d.data();
    const subj = data.subject || data.paperTitle || 'Unknown';
    bySubject[subj] = (bySubject[subj] || 0) + 1;
    byStatus[data.status] = (byStatus[data.status] || 0) + 1;
    if (data.studentId || data.userId || data.studentEmail) {
      uniqueStudents.add(data.studentId || data.userId || data.studentEmail);
    }
  });

  console.log("Unique students active yesterday:", uniqueStudents.size);
  console.log("Attempts by status:", byStatus);
  console.log("Attempts by subject:", bySubject);

  // Check violations yesterday
  console.log("\n=== 2. CHECKING VIOLATIONS FOR YESTERDAY ===");
  try {
    const vSnap = await db.collection('violations')
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<', endOfDay)
      .get();
    console.log(`Violations recorded yesterday: ${vSnap.size}`);
  } catch (e) {
    console.log("Violations query with timestamp failed, checking general violations count:", e.message);
  }

  // Check Cloud Monitoring API
  console.log("\n=== 3. CHECKING GOOGLE CLOUD MONITORING API METRICS ===");
  try {
    const keyPath = path.resolve(__dirname, 'service-account.json');
    const auth = new GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/monitoring.read']
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const startTime = "2026-10-27T00:00:00Z";
    const endTime = "2026-10-28T04:30:00Z";

    // Metrics to check:
    // 1. firestore.googleapis.com/document/read_count
    // 2. firestore.googleapis.com/document/write_count
    // 3. firestore.googleapis.com/document/delete_count
    // 4. firestore.googleapis.com/network/sent_bytes_count
    const metricTypes = [
      'firestore.googleapis.com/document/read_count',
      'firestore.googleapis.com/document/write_count',
      'firestore.googleapis.com/document/delete_count'
    ];

    for (const mType of metricTypes) {
      const url = `https://monitoring.googleapis.com/v3/projects/proctored-app/timeSeries?filter=metric.type%3D%22${encodeURIComponent(mType)}%22&interval.startTime=${startTime}&interval.endTime=${endTime}&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM&aggregation.crossSeriesReducer=REDUCE_SUM`;

      const resData = await new Promise((resolve) => {
        const req = https.get(url, {
          headers: {
            'Authorization': `Bearer ${token.token}`
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', err => resolve({ status: 500, body: err.message }));
      });

      console.log(`Metric ${mType} HTTP status: ${resData.status}`);
      if (resData.status === 200) {
        try {
          const parsed = JSON.parse(resData.body);
          if (parsed.timeSeries && parsed.timeSeries.length > 0) {
            parsed.timeSeries.forEach(ts => {
              console.log(`Time series resource:`, ts.resource?.type);
              ts.points?.forEach(pt => {
                console.log(`  Interval [${pt.interval.startTime} -> ${pt.interval.endTime}]: Value = ${pt.value.int64Value || pt.value.doubleValue || JSON.stringify(pt.value)}`);
              });
            });
          } else {
            console.log(`  No time series data returned for ${mType}`);
          }
        } catch (e) {
          console.log(`  Parse error:`, e.message);
        }
      } else {
        console.log(`  Response:`, resData.body.substring(0, 300));
      }
    }

  } catch (err) {
    console.log("Cloud Monitoring query failed:", err.message);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
