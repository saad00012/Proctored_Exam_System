require('dotenv').config();
const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');
const serviceAccountPath = path.resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'service-account.json');
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin (assuming credentials in ENV just like index.js)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function clearUsers() {
    console.log("Starting full user wipe...");
    try {
        // 1. Delete all Firestore 'users' documents
        console.log("Fetching Firestore users collection...");
        const usersSnapshot = await db.collection('users').get();
        if (usersSnapshot.empty) {
            console.log("No users found in Firestore 'users' collection.");
        } else {
            const batch = db.batch();
            usersSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`Deleted ${usersSnapshot.size} user documents from Firestore.`);
        }

        // 2. Delete all Firebase Auth users
        console.log("Fetching Firebase Auth users...");
        let pageToken;
        let authUserCount = 0;
        do {
            const listUsersResult = await auth.listUsers(1000, pageToken);
            const uids = listUsersResult.users.map(userRecord => userRecord.uid);
            
            if (uids.length > 0) {
                await auth.deleteUsers(uids);
                authUserCount += uids.length;
            }
            pageToken = listUsersResult.pageToken;
        } while (pageToken);
        console.log(`Deleted ${authUserCount} users from Firebase Auth.`);

        console.log("✅ Wipe complete! All students and teachers are deleted.");
    } catch (err) {
        console.error("❌ Error wiping users:", err);
    }
}

clearUsers();
