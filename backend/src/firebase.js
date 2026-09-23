const fs = require('fs');
const path = require('path');
require('dotenv').config();

let admin = null;
let db = null;

const serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'service-account.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully via JSON environment variable.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK from env var:', error.message);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require('firebase-admin');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully with service account JSON.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  }
} else if (process.env.NODE_ENV === 'production') {
  try {
    admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized using Google Cloud Application Default Credentials.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK with Application Default Credentials:', error.message);
  }
} else {
  console.warn(`⚠️ Warning: Service account file not found at ${serviceAccountPath}. Running in Mock mode.`);
}

module.exports = {
  admin,
  db
};
