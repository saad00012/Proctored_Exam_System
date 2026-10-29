const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

// Helper to compute SHA-256 hash
function getFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Helper to write JSON and Gzip
function saveJsonAndGzip(dir, filename, data) {
  const jsonPath = path.join(dir, filename);
  const gzPath = path.join(dir, `${filename}.gz`);
  const jsonStr = JSON.stringify(data, null, 2);

  fs.writeFileSync(jsonPath, jsonStr, 'utf8');
  const gzipped = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), { level: 9 });
  fs.writeFileSync(gzPath, gzipped);

  return {
    rawBytes: fs.statSync(jsonPath).size,
    gzBytes: fs.statSync(gzPath).size,
    sha256: getFileSha256(jsonPath)
  };
}

async function exportCollection(colName) {
  console.log(`⏳ Exporting collection: "${colName}"...`);
  const snapshot = await db.collection(colName).get();
  const docs = [];
  snapshot.forEach(docSnap => {
    docs.push({
      _id: docSnap.id,
      ...docSnap.data()
    });
  });
  console.log(`   ✓ Fetched ${docs.length} documents from "${colName}".`);
  return docs;
}

async function runBackup() {
  const startTime = Date.now();
  const dateStr = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupDirName = `backup_${dateStr}`;
  const backupsRoot = path.resolve(__dirname, '..', 'backups');
  const targetDir = path.join(backupsRoot, backupDirName);

  if (!fs.existsSync(backupsRoot)) {
    fs.mkdirSync(backupsRoot, { recursive: true });
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`====================================================`);
  console.log(`🚀 STARTING COMPLETE DATABASE BACKUP FOR ARCHIVING`);
  console.log(`📁 Destination: ${targetDir}`);
  console.log(`====================================================\n`);

  const collections = [
    'users',
    'exams',
    'papers',
    'questions',
    'exam_attempts',
    'violations',
    'allowed_domains',
    'settings',
    'audit_logs'
  ];

  const manifest = {
    backupName: backupDirName,
    createdAt: new Date().toISOString(),
    collections: {},
    summary: {
      totalCollections: collections.length,
      totalDocuments: 0,
      totalRawBytes: 0,
      totalGzBytes: 0
    }
  };

  const allExports = {};

  for (const col of collections) {
    const docs = await exportCollection(col);
    allExports[col] = docs;
    const fileStats = saveJsonAndGzip(targetDir, `${col}.json`, docs);

    manifest.collections[col] = {
      docCount: docs.length,
      file: `${col}.json`,
      gzFile: `${col}.json.gz`,
      rawBytes: fileStats.rawBytes,
      gzBytes: fileStats.gzBytes,
      sha256: fileStats.sha256
    };

    manifest.summary.totalDocuments += docs.length;
    manifest.summary.totalRawBytes += fileStats.rawBytes;
    manifest.summary.totalGzBytes += fileStats.gzBytes;
  }

  // Generate Academic CSV Summary of Exam Attempts
  console.log(`\n⏳ Generating academic CSV summary: "exam_results_summary.csv"...`);
  const papersMap = {};
  allExports['papers'].forEach(p => {
    papersMap[p._id] = p.title || p.subject || p._id;
  });

  const examsMap = {};
  allExports['exams'].forEach(e => {
    examsMap[e._id] = e.title || e.subject || e._id;
  });

  const csvRows = [
    [
      'Attempt ID',
      'Student PRN',
      'Student Name',
      'Student Email',
      'Department',
      'Semester',
      'Exam Title',
      'Paper Set',
      'Score',
      'Total Marks',
      'Percentage',
      'Status',
      'Warnings',
      'Started At',
      'Submitted At'
    ].map(v => `"${v}"`).join(',')
  ];

  allExports['exam_attempts'].forEach(att => {
    const exTitle = att.examTitle || examsMap[att.examId] || 'N/A';
    const paperTitle = att.paperTitle || papersMap[att.paperId] || 'N/A';
    let percent = 'N/A';
    if (typeof att.score === 'number' && typeof att.totalMarks === 'number' && att.totalMarks > 0) {
      percent = ((att.score / att.totalMarks) * 100).toFixed(2) + '%';
    }

    const row = [
      att._id,
      att.prnNumber || att.prn || 'N/A',
      att.studentName || 'N/A',
      att.studentEmail || 'N/A',
      att.department || 'N/A',
      att.semester || 'N/A',
      exTitle,
      paperTitle,
      att.score !== undefined ? att.score : 'N/A',
      att.totalMarks !== undefined ? att.totalMarks : 'N/A',
      percent,
      att.status || 'unknown',
      att.warnings || 0,
      att.startedAt || 'N/A',
      att.submittedAt || 'N/A'
    ];
    csvRows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  });

  const csvPath = path.join(targetDir, 'exam_results_summary.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`   ✓ Wrote ${csvRows.length - 1} records to "exam_results_summary.csv".`);

  manifest.csvExport = {
    file: 'exam_results_summary.csv',
    records: csvRows.length - 1,
    bytes: fs.statSync(csvPath).size,
    sha256: getFileSha256(csvPath)
  };

  // Save Manifest
  const manifestPath = path.join(targetDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n====================================================`);
  console.log(`✅ DATABASE BACKUP COMPLETE IN ${elapsedSec}s!`);
  console.log(`📁 Directory: ${targetDir}`);
  console.log(`📄 Total Documents Backed Up: ${manifest.summary.totalDocuments.toLocaleString()}`);
  console.log(`📦 Total Raw JSON: ${(manifest.summary.totalRawBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🗜️ Total Compressed (Gz): ${(manifest.summary.totalGzBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`====================================================\n`);

  console.log(JSON.stringify(manifest, null, 2));
}

runBackup().catch(err => {
  console.error("❌ Fatal Backup Error:", err);
  process.exit(1);
});
