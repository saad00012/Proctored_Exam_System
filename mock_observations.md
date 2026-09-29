# 📋 Mock Exam Observations & Technical Log

> **Date:** September 29, 2026  
> **Context:** Mock Student Examination (15 Active Students)  
> **Status:** Pending Implementation  

---

## 🚨 Observation 1: Rate Limiting Error During Multi-Student Session

### 1. Symptom
During a 15-student mock exam session, students encountered the following error on screen:
```
Unexpected token 'T', "Too many r"... is not valid JSON
```

### 2. Root Cause Analysis
* **Server-Side Enforcement:** The backend Express API had rate-limiting configured via `express-rate-limit` capped at **20 requests per 15 minutes per IP address** on exam endpoints.
* **Shared Network IP Aggregation:** When 15 students took the exam in the same room via college Wi-Fi, a shared mobile hotspot, or the same mobile network tower (Carrier-Grade NAT), all 15 devices shared a single public IP address.
* **Quota Exhaustion:** With 15 students sending initial auth checks, paper fetches, session starts, and heartbeats, the shared IP exceeded the 20-request quota within ~2 minutes.
* **Parsing Failure:** The server returned HTTP `429 Too Many Requests` with plain-text body `"Too many requests, please try again later."`. The frontend/app called `res.json()`, which threw a `SyntaxError: Unexpected token 'T'` when attempting to parse non-JSON text.

---

## 🛠️ Planned Solutions for Observation 1 (To Be Implemented)

### Solution A (Option 3): Remove Rate-Limiting on Exam Endpoints
* **Action:** Remove the `express-rate-limit` middleware from exam-critical routes (`/start-exam`, `/submit-answer`, `/report-violation`, `/auto-submit`).
* **Benefit:** Ensures exam sessions will never block or reject legitimate students under any network configuration (Wi-Fi, hotspots, or mobile data).
* **Security:** Security remains enforced because every route requires a verified Firebase Auth Bearer token (`verifyToken`).

### Solution B (Option 4): Robust Frontend & Mobile App Error Handling
* **Action:** Update API request handlers in the dashboard and Android app to inspect `res.ok` before attempting `res.json()`.
* **Benefit:** If the server ever returns plain-text or HTML errors (e.g. 429, 500, 502, 503), the client will gracefully display a clean, user-friendly alert (e.g. *"Server temporarily busy, retrying..."*) instead of crashing with a raw `SyntaxError`.

---

## 🚨 Observation 2: Missing / Delayed Email Verification Links

### 1. Symptom
During student account registration, students filled in all required details (Name, PRN, Email, Password, Department, Semester), but several students did not receive their verification link — **even after checking their Spam / Junk folders**.

### 2. Root Cause Analysis
* **Domain Gateway-Level Rejection (Not in Spam):** Institutional email servers (`@dnyanshree.edu.in`) and strict Google Workspace MX gateways filter unauthenticated emails from `noreply@<project-id>.firebaseapp.com` at the **server gateway level** (dropping them before they reach the user's Inbox or Spam folder) due to missing SPF/DKIM domain alignment records.
* **Async Race Condition in App Code:** In `AuthScreen.kt` (line 542), `user?.sendEmailVerification()` was called as a fire-and-forget background call. Immediately after, `user.getIdToken(true)` completed and triggered `onSuccess()`, unmounting the Auth screen while the verification email HTTP request was still in flight, causing Android to cancel the pending network request.
* **Firebase Auth Quota Limits:** When multiple students register simultaneously within minutes, Firebase Auth's default free-tier SMTP server rate-limits or silently drops outgoing verification emails.
* **No "Resend Link" UI in Student App:** When an unverified student attempts to log in, the app blocks login with `"Please verify your email address..."` but provides no button to resend the verification link.

---

## 🛠️ Planned Solutions for Observation 2 (To Be Implemented)

### Solution A: Await Email Dispatch before Screen Completion
* **Action:** Update `AuthScreen.kt` to await `user?.sendEmailVerification()` with `.addOnCompleteListener` before invoking `onSuccess()`, ensuring the email request completes over the network before the screen state changes.

### Solution B: Add "Resend Verification Email" Button in App
* **Action:** Update the login screen in `AuthScreen.kt` to include a **"📩 Resend Verification Email"** button whenever an unverified email error occurs.

### Solution C: Configure Custom SMTP / Domain in Firebase Console
* **Action:** In **Firebase Console &rarr; Authentication &rarr; Settings &rarr; Templates / SMTP**, configure custom SMTP settings (via Google Workspace / SendGrid) or authorize `dnyanshree.edu.in`.
* **Benefit:** Emails will be sent directly from `noreply@dnyanshree.edu.in`, guaranteeing 100% inbox delivery without gateway rejection or spam filtering.

### Solution D: Admin Email Verification Bypass (Dashboard)
* **Action:** Add a **"Verify Email"** toggle button in the Super Admin User Management console.
* **Benefit:** Allows administrators to manually verify a student's email status instantly if they face email delivery issues right before an exam.

---

## 🚨 Observation 3: Android 13+ Restricted Settings Blocking Device Admin Access (Vivo, Realme, Oppo, Xiaomi)

### 1. Symptom
On devices running Android 13, 14, or 15 (especially OEM Android ROMs like Vivo Funtouch OS, Realme UI, Oppo ColorOS, Xiaomi MIUI/HyperOS), when students tap "Activate Device Administrator", the OS shows a security popup blocking access:
```
App was denied access
Access to this permission can put your personal and financial info at risk...
It's possible the app won't work properly without this restricted permission.
```

### 2. Root Cause Analysis
* **Android 13+ Restricted Settings Guard:** Starting in Android 13 (API level 33), Google introduced an OS-level security feature called **"Restricted Settings"**. Any app installed from outside the Google Play Store (e.g. side-loaded via APK, WhatsApp, Chrome, or File Manager) has high-privilege permissions (Device Administrator & Accessibility) locked by default.
* **OEM Custom Android Restrictions:** Brands like Vivo, Realme, Oppo, and Xiaomi enforce extra strict side-load restrictions to prevent malware from gaining Device Admin control.

---

## 🛠️ Planned Solutions for Observation 3 (To Be Implemented)

### Solution A: Student Self-Unlocking Steps (How Students Fix It in 10 Seconds)
1. Open phone **Settings** &rarr; **Apps** &rarr; **Dnyanshree Exam Proctor**.
2. Tap the **3 dots (⋮)** in the top-right corner.
3. Tap **"Allow restricted settings"** and authenticate with Fingerprint / PIN / Pattern.
4. Re-open the exam app and tap **Activate Device Administrator** (it will now be granted instantly).

### Solution B: Add Guided Unlocking Dialog in App
* **Action:** When `DevicePolicyManager` activation is denied or blocked, display a step-by-step visual card in `ExamScreen.kt` explaining how to tap *3 dots (⋮) &rarr; Allow restricted settings* in Android Settings.

### Solution C: Modern App Pinning / Lock Task Mode (Architectural Alternative)
* **Action:** Replace deprecated `DeviceAdminReceiver` with **Android Lock Task Mode (`startLockTask()`)** + `FLAG_SECURE` + Lifecycle Focus Loss Violation Counter.
* **Benefit:** Lock Task Mode (Screen Pinning) pins the app to the screen without requiring Device Admin privileges, bypassing Android 13 Restricted Settings entirely across 100% of OEM devices (Vivo, Realme, Oppo, Xiaomi, Samsung).

### Solution D: Dashboard Proctor Exemption Toggle
* **Action:** Add a toggle in `LiveMonitor.jsx` allowing teachers to bypass Device Admin enforcement for specific students if their device OS prevents activation.
