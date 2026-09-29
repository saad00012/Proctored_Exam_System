# DIET Proctored Exam System - System Documentation

## Overview
The DIET Proctored Exam System is a secure, 3-tier, production-ready platform designed for higher education institutes to conduct examinations with high integrity.

## Architecture

The system consists of three main components communicating with a centralized Firebase backend:

1. **Android Mobile App (Kotlin + Jetpack Compose)**
   - Used by students to take exams.
   - Features lockdown proctoring, device administration, and focus guard to prevent cheating.
   - OTP verification required to start an exam session.
   - Strictly forward-only question navigation.
2. **Express API Backend (Node.js + Firebase Admin)**
   - Authoritative grading, scheduling, and domain rules validation.
   - Handles auto-submitting exams when time runs out.
   - Exposes RESTful endpoints for student exam sessions and faculty administrative controls.
3. **Faculty / Admin Dashboard (React 19 + Vite 8)**
   - Web interface for teachers and administrators.
   - Features live real-time monitoring of active exam sessions.
   - Allows importing and exporting exams via Excel.
   - Role and user administration.
4. **Firebase Firestore & Authentication**
   - Central database and user authentication provider connecting all tiers.

## Security & Proctoring Mechanisms

- **Hardware & Focus Lockdown:** The mobile app leverages Android Device Policy Management, overlay prevention (`FLAG_SECURE`), and phone call state listeners to detect when the app loses focus or screen recording is attempted.
- **Cumulative Warning & Hardlock:** Violations are tracked server-side. Once a student reaches the defined threshold (e.g., 3 warnings), their session is hardlocked. A faculty member must grant an unlock from the dashboard to continue.
- **Session Room OTP Key:** A 6-digit numeric OTP is generated when a teacher initiates an exam session, acting as a secure entry key.
- **Forward-Only Progression:** Students cannot navigate backwards to change answers to previous questions, ensuring fairness and reducing collaboration opportunities.

## Backend API Summary

The Node.js backend handles operations across several domains. All secured endpoints require a Firebase ID Token (`Authorization: Bearer <token>`).

### Registration & Health
- `GET /health` - System health check.
- `POST /register-check` - Verifies student email domain whitelisting.
- `POST /create-profile` - Syncs user profile in Firestore after registration.

### Examination Lifecycle
- `GET /papers` - Retrieves available published exam papers.
- `POST /start-exam` - Initiates an exam attempt, enforces schedules.
- `POST /submit-answer` - Records a single answer.
- `POST /heartbeat` - Syncs remaining time.
- `POST /auto-submit` - Finalizes submission and returns score.

### Proctoring & Violations
- `POST /report-violation` - Reports a focus loss/hardware violation.
- `GET /teacher/violations` - Fetches recent violations across live exams.

### Faculty / Teacher Controls
- `GET /teacher/live-monitor` - Lists active student exam sessions and statuses.
- `POST /teacher/override` - Unblocks a hardlocked student.
- `POST /teacher/deny` - Denies access to a hardlocked student (disqualification).
- `POST /teacher/clear-student-attempts` - Clears past attempts for a specific student.

### Super Admin Controls
- Endpoints to create, update, and delete users (`/admin/users/*`).
- Endpoints to manage system policies like duration and warning thresholds (`/admin/policies`).
- Endpoints to clear database attempts and papers for new semesters.

## Getting Started

- **Backend:** `cd backend`, run `npm install`, set `.env`, and start with `npm run dev`.
- **Dashboard:** `cd dashboard`, run `npm install`, and start with `npm run dev`.
- **Android App:** `cd android` and build using Gradle (`.\gradlew.bat assembleDebug`).

---
*For detailed API request/response structures, refer to `backend/API.md`.*
*For Firestore database rules, refer to `firestore.rules`.*
