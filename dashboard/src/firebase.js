import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};



let app = null;
let auth = null;
let db = null;
let storage = null;

// Detect if configs are default placeholders
const hasValidConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "PLACEHOLDER_API_KEY" &&
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "PLACEHOLDER_PROJECT_ID";

if (hasValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("✅ Firebase Web SDK initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Web SDK:", error.message);
  }
} else {
  console.error("❌ Firebase configurations not detected or invalid! The app will not work.");
}

export { auth, db, storage };
export default app;
