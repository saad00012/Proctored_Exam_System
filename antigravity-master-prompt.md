# Project Brief for Antigravity: Anti-Cheat MCQ Exam Android App

Paste this entire document as your first message to Antigravity to give it full project context before asking it to build anything.

---

## 1. Project Overview

Build an Android application (native Kotlin) with a companion web dashboard (React) for conducting proctored MCQ exams in a classroom setting. Two user roles: **Teacher** and **Student**. The system must detect and penalize cheating behavior (app-switching, camera use) during timed exams, with zero ongoing financial cost.

**Constraint: this project must use only free-tier services.** No paid APIs, no Firebase Blaze plan, no paid IDE/hosting tiers.

---

## 2. User Roles & Auth

- **Student**: registers with college email (must match a whitelisted domain, e.g. `@dbatu.ac.in`) + mobile number, both mandatory. Personal email domains (gmail.com, yahoo.com, etc.) must be rejected.
- **Teacher**: registers similarly (domain rules TBD — likely same or staff-specific domain).
- Auth via Firebase Auth (email + phone OTP).
- Backend must re-validate domain whitelist server-side even after Firebase Auth succeeds (whitelist stored in Firestore, not hardcoded, so new colleges can be added later).

---

## 3. Core Exam Flow

- Teacher uploads multiple MCQ question papers (per subject), each with questions, options, and correct answers pre-set.
- Student selects a subject and starts an exam.
- **One question shown at a time** — no way to view the full paper, no back navigation. Next question unlocks only after current one is answered.
- **Strict 45-minute timer**, server-authoritative (never trust client-side clock). Auto-submit when time expires.
- Instant scoring on submission (answers are known server-side).

---

## 4. Anti-Cheat / Violation System

**Trigger for a violation:** student switches to another app during an active exam (via `onPause`/`onStop` with no matching permitted-pause event).

**Permitted pauses (timer pauses, NO violation logged):**
- Screen lock (`ACTION_SCREEN_OFF` broadcast)
- Incoming phone call (via `TelephonyCallback`/`PhoneStateListener`)

**Also treated as a violation:**
- Camera re-enabled during exam (Device Admin `setCameraDisabled` toggled off)
- Device Admin permission revoked mid-exam

**On violation (1st and 2nd occurrence):**
1. Student is force-logged out immediately.
2. Server logs elapsed time at moment of violation.
3. Push notification (FCM) sent to both student and teacher.
4. On re-login, student must restart: a **new, unused paper** (same subject) is assigned, starting from Question 1.
5. New time limit = `45 minutes - cumulative elapsed time across all prior attempts` (NOT a fresh 45 min).

**On 3rd violation:**
- Student is **hard-blocked** — cannot self-restart.
- Status becomes `blocked_pending_review`, surfaced in teacher dashboard's review queue.
- Teacher can **Grant Override** (assigns new paper, defaults to the same shrinking-time formula, but teacher has a manual editable time field to bump up the duration if remaining time is impractically short, e.g., 3–5 min) or **Deny** (marks exam as malpractice/failed).
- All override actions (teacher id, original vs adjusted time, timestamp) are logged for audit.

---

## 5. Additional Lockdown Measures

- `FLAG_SECURE` set on the exam Activity window — blocks screenshots/screen recording, and mitigates (not guarantees, OEM-dependent) Circle to Search / Google Lens capture.
- Camera disabled for the full exam duration via `DevicePolicyManager.setCameraDisabled()`, which requires the app to be a **Device Admin** (lightweight — user activates via Settings toggle, no MDM enrollment or factory reset needed).
- Device Admin activation is a **hard gate** — exam cannot start until active. Teacher dashboard should show a visual "Camera Disabled ✅" confirmation per student during live monitoring.
- **Known accepted limitation (do not attempt to solve, just note in UI/docs):** a second physical device photographing the screen, or a friend supplying answers externally, cannot be technically prevented. This is disclosed, not solved.

---

## 6. Question Content: Text & Image/Diagram Support

Some subjects (e.g., circuits, diagrams) require visual content, not just plain text, for a question to be solvable.

**Question types**
- `text_only` — question text + 4 options, no image
- `image_based` — question text + image (diagram/circuit) + 4 options
- Options can optionally carry their own image too (e.g., "which circuit below is correct?") — support this in the schema even if not used immediately

**Image storage (free-tier aware)**
- Use **Firebase Storage** (free tier: 5GB storage, 1GB/day download) since it's already in the stack — sufficient for classroom-scale use if images are compressed.
- Compress/resize images client-side on upload (teacher side) before pushing to Storage — cap around 1024px width, JPEG ~70% quality — to conserve free-tier storage/bandwidth.
- Store only the Storage download URL in the question's Firestore document, never the raw image blob.
- If Firebase Storage limits are ever exceeded, Cloudinary's free tier (25GB storage/bandwidth) is a viable alternative — note this as a fallback, don't build for it unless needed.

**Updated Firestore question schema**
```
questions/{questionId}
  paperId
  questionText
  questionImageUrl (nullable)
  options: [
     { text: "...", imageUrl: null },
     { text: "...", imageUrl: null },
     ...
  ]
  correctOptionIndex
  subject
```

**Teacher upload flow requirements**
- Optional image picker per question (and optionally per option)
- Preview before publishing so teacher can confirm the diagram renders correctly
- Client-side image compression before upload

**Android exam UI requirements**
- Conditional image view above/alongside question text, only rendered when `questionImageUrl` is present
- Use `Coil` or `Glide` (free, lightweight Android image-loading libraries) for efficient loading/caching
- Pre-cache the current question's image the moment it loads — do not rely on a live fetch mid-question, since a network hiccup during the timed exam should not cost time or trigger a false violation
- Support pinch-to-zoom on question/option images — circuit diagrams are often hard to read at fixed mobile screen size

---

## 7. Architecture (Zero-Cost Constraint)

Firebase Cloud Functions require the paid Blaze plan (billing card required even if usage stays free) — **avoid this**. Use this architecture instead, staying entirely on free tiers with no card-on-file anywhere:

```
Android App (Kotlin, native)
   |
   |-- Firebase Auth (free) — email + phone OTP
   |-- Firestore (free tier: 50K reads/20K writes/20K deletes per day) — data storage
   |-- Node.js/Express backend (hosted free on Render or Railway free tier)
   |      |-- Handles: timer validation, violation logic, paper assignment, scoring
   |      |-- Talks to Firestore via Firebase Admin SDK
   |      |-- Sends push via Firebase Cloud Messaging (FCM, free, unlimited)
   |
Web Dashboard (React)
   |-- Hosted free on Firebase Hosting (10GB storage, 360MB/day transfer)
   |-- Reads Firestore directly for real-time live monitoring (listeners, not polling)
   |-- Calls Node.js backend for teacher actions (override, grant/deny)
```

**Server-authoritative principle:** all timer state, violation counts, and current question index live in Firestore/Node backend — never trusted from the Android client. Client sends events (`answer_submitted`, `violation_detected`, `heartbeat`) → backend validates and returns authoritative state.

**Timer implementation note:** don't use in-memory `setTimeout` per session (dies on server restart). Store `startTime + duration + pausedDuration` in Firestore; compute `remaining` on every request; run a lightweight cron sweep (~every 30s) to catch expired sessions and trigger auto-submit.

---

## 8. Backend API (Node.js/Express) — Core Endpoints

- `POST /register-check` — validate email domain + mobile before signup completes
- `POST /start-exam` — assign paper, calculate duration (fresh or post-violation), create session
- `POST /submit-answer` — record answer, advance question index
- `POST /report-violation` — log violation, increment count, trigger block/relogin flow, send FCM
- `POST /heartbeat` — periodic ping (5-10s) carrying `screen_off`/`call_incoming`/`resumed`/`active` events, used to distinguish permitted pauses from real violations and as a backup detection if client-side event is missed
- `POST /auto-submit` — score exam against answer key, finalize session
- `POST /teacher/override` — teacher-only, reset blocked student's session, optional manual time adjustment
- `GET /teacher/live-monitor` — initial state for live dashboard (real-time updates via direct Firestore listeners from the dashboard, not polling this endpoint)

All routes require Firebase ID token verification via Firebase Admin SDK middleware.

---

## 9. Teacher Dashboard — Required Screens

1. **Overview**: active exams now, today's scheduled exams, quick stats
2. **Question Paper Management**: upload/edit/delete papers, status per paper (draft/published/in-use/exhausted)
3. **Live Exam Monitoring**: real-time per-student view — current question, time remaining, status (normal/paused/violated), Device Admin/camera status indicator
4. **Student Management**: registered students, per-student history, repeat-offender view
5. **Results & Analytics**: score distributions, per-student breakdown, CSV/PDF export
6. **Notifications Log**: full violation history, manual false-positive override capability
7. **Blocked/Review Queue**: 3rd-violation students awaiting teacher decision — Grant Override (with editable time field) / Deny
8. **Settings**: manage domain whitelist, default exam duration, violation policy thresholds

---

## 10. Suggested Build Stages (ask Antigravity to tackle one at a time, not all at once)

**Stage 1 — Foundation**
- Firebase project setup (Auth, Firestore, Hosting) — free tier only, no Blaze
- Firestore data model: `users`, `papers`, `questions`, `exam_sessions`, `violations`, `allowed_domains`
- Node.js backend skeleton on Render/Railway free tier, connected to Firestore via Admin SDK

**Stage 2 — Auth & Registration**
- Email/mobile registration with domain whitelist validation (client + server-side)
- Firebase Auth integration (Android + backend token verification middleware)

**Stage 3 — Teacher: Paper Upload**
- Teacher web dashboard skeleton (React + Firebase Hosting)
- MCQ paper upload UI + Firestore write logic

**Stage 4 — Student: Core Exam Flow**
- Android exam UI: one-question-at-a-time, no back nav, answer submission
- Server-authoritative 45-min timer, auto-submit, instant scoring

**Stage 5 — Violation Detection**
- Android lifecycle observers (`onPause`/`onStop`), `ACTION_SCREEN_OFF` receiver, `TelephonyCallback`
- Heartbeat system distinguishing permitted pauses from real violations
- Backend violation handling: paper reassignment, time deduction, FCM notifications

**Stage 6 — Lockdown Features**
- `FLAG_SECURE` on exam Activity
- Device Admin implementation + `setCameraDisabled` integration
- Hard gate: exam won't start without active Device Admin

**Stage 7 — 3-Violation Block & Teacher Override**
- Hard block logic after 3rd violation
- Teacher override screen with editable time field, audit logging

**Stage 8 — Teacher Dashboard: Live Monitoring & Results**
- Real-time Firestore listeners for live exam view
- Results/analytics screens, CSV export

**Stage 9 — Testing**
- Real physical Android device required for Device Admin, camera-block, and Circle-to-Search behavior — cannot be validated on emulator.

---

## 11. Instructions to Antigravity

- Work stage by stage as listed in Section 10 — do not attempt to scaffold the entire app in one pass.
- Confirm free-tier compliance before adding any new service or dependency (no Cloud Functions/Blaze, no paid APIs).
- For Android-specific code (Device Admin, telephony, lifecycle), write native Kotlin — do not suggest cross-platform frameworks.
- After each stage, summarize what was built and what needs manual verification in Android Studio / on a physical device before proceeding to the next stage.
