# 🛡️ DIET Proctored Exam System

A secure, 3-tier, production-ready proctored examination platform designed for higher education institutes.

---

## 🏛️ System Architecture

```
                                  ┌────────────────────────────────┐
                                  │       Firebase Firestore       │
                                  │   & Firebase Authentication    │
                                  └───────────────▲────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
  ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
  │      Android Mobile App     │  │       Express API Backend   │  │   Faculty / Admin Dashboard │
  │ (Kotlin + Jetpack Compose)  │  │   (Node.js + Firebase Admin)│  │     (React 19 + Vite 8)     │
  │ • Lockdown Proctoring       │  │ • Authoritative Grading     │  │ • Live Real-time Monitoring │
  │ • Device Admin & Focus Guard│  │ • Schedule & Domain Rules   │  │ • Exam Excel Import & Export│
  │ • OTP Verification         │  │ • Auto-Submit Sweeper       │  │ • Role & User Administration│
  └─────────────────────────────┘  └─────────────────────────────┘  └─────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Backend API (`backend/`)
```bash
cd backend
npm install
# Set up .env with FIREBASE_SERVICE_ACCOUNT_JSON or service-account.json
npm run dev     # Runs with nodemon on port 5000
npm start       # Production startup
```

### 2. Teacher & Admin Dashboard (`dashboard/`)
```bash
cd dashboard
npm install
npm run dev     # Starts local Vite development server
npm run build   # Produces production distribution in dist/
```

### 3. Student Mobile App (`android/`)
```bash
cd android
# Verify JDK 17+ / JBR is selected
.\gradlew.bat assembleDebug   # Builds debug APK in app/build/outputs/apk/debug/
```

---

## 🔒 Proctoring & Security Controls

1. **Hardware & Focus Lockdown**: The Android app utilizes Android Device Policy Management, overlay prevention (`FLAG_SECURE`), and phone call state listeners to detect focus loss.
2. **Cumulative Warning & Hardlock**: Violations are authoritatively counted. Reaching the threshold (default: 3 warnings) hardlocks the session until a faculty member grants an unlock in the Live Monitor.
3. **Session Room OTP Key**: When teachers initiate an exam session from the dashboard, a 6-digit numeric OTP is generated. Students must supply the correct OTP key to enter the test.
4. **Forward-Only Progression**: Question navigation is strictly forward-only. Students may skip questions to proceed, but cannot backtrack to edit previous responses.

---

## 📄 Documentation Links
- [API Reference](backend/API.md)
- [Firestore Security Rules](firestore.rules)
