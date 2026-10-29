const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const https = require('https');

async function testMonitoring() {
  try {
    const keyPath = path.resolve(__dirname, 'service-account.json');
    const auth = new GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/monitoring.read']
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const startTime = "2026-10-28T00:00:00Z";
    const endTime = "2026-10-29T00:00:00Z";

    const mType = 'firestore.googleapis.com/document/read_count';
    const url = `https://monitoring.googleapis.com/v3/projects/proctored-app/timeSeries?filter=metric.type%3D%22${encodeURIComponent(mType)}%22&interval.startTime=${startTime}&interval.endTime=${endTime}&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM&aggregation.crossSeriesReducer=REDUCE_SUM`;

    const resData = await new Promise((resolve) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${token.token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', err => resolve({ status: 500, body: err.message }));
    });

    console.log("Cloud Monitoring HTTP Status:", resData.status);
    console.log("Cloud Monitoring Response:", resData.body);
  } catch (e) {
    console.error("Monitoring test error:", e.message);
  }
}

testMonitoring();
