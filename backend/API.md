# 📡 Proctored Exam System — API Reference Documentation

**Base URL:** `https://proctored-exam-system-3z35.onrender.com`  
**Local Development:** `http://localhost:5000`

---

## 🔐 Authentication
Most endpoints require a Firebase ID Token in the `Authorization` header:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

---

## 📋 Endpoint Summary

### 1. Health & Registration
| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | System and Firebase connection health check. |
| `POST` | `/register-check` | No | Verifies if the email domain is whitelisted before student registration. |
| `POST` | `/create-profile` | Yes | Creates or synchronizes the user profile in Firestore after registration. |

#### `POST /register-check`
```json
// Request
{
  "email": "student@dnyanshree.edu.in",
  "phoneNumber": "+919876543210"
}

// Response (200 OK)
{
  "allowed": true,
  "domain": "dnyanshree.edu.in"
}
```

---

### 2. Examination Lifecycle
| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/papers` | Yes | Retrieves available published exam papers filtered by department, visibility, and schedule. |
| `POST` | `/start-exam` | Yes | Initiates an exam attempt, enforces schedule window & department matching, returns questions & remaining time. |
| `POST` | `/submit-answer` | Yes | Records a single answer authoritatively and updates elapsed time. |
| `POST` | `/heartbeat` | Yes | Periodic client synchronization of remaining time; auto-submits on timer expiry. |
| `POST` | `/auto-submit` | Yes | Finalizes test submission, calculates score, and returns scorecard summary. |

#### `POST /start-exam`
```json
// Request
{
  "paperId": "cse-data-structures-set-a"
}

// Response (200 OK)
{
  "message": "Exam session started",
  "sessionId": "uid123_cse-data-structures-set-a",
  "paperId": "cse-data-structures-set-a",
  "remainingTimeSeconds": 2700,
  "warningsCount": 0,
  "paper": {
    "title": "Data Structures Set A",
    "department": "Computer Science & Engineering"
  },
  "questions": [
    {
      "id": "q1",
      "questionText": "What is the time complexity of binary search?",
      "options": [{ "text": "O(log n)" }, { "text": "O(n)" }, { "text": "O(1)" }, { "text": "O(n^2)" }]
    }
  ]
}
```

---

### 3. Proctoring & Violations
| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/report-violation` | Yes | Reports a focus loss or hardware violation; manages cumulative warning counter and triggers hardlocks. |
| `GET` | `/teacher/violations` | Yes (Teacher/Admin) | Fetches the recent 50 violation events across all live exams. |

#### `POST /report-violation`
```json
// Request
{
  "paperId": "cse-data-structures-set-a",
  "reason": "Focus loss detected: Application sent to background"
}

// Response (200 OK)
{
  "message": "Violation recorded",
  "sessionId": "uid123_cse-data-structures-set-a",
  "warnings": 2,
  "actionRequired": "warning"
}
```

---

### 4. Faculty / Teacher Controls
| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/teacher/live-monitor` | Yes (Teacher/Admin) | Lists active student exam sessions and real-time statuses. |
| `POST` | `/teacher/override` | Yes (Teacher/Admin) | Unblocks a hardlocked student to resume test with their natural remaining time. |
| `POST` | `/teacher/deny` | Yes (Teacher/Admin) | Denies access to a hardlocked student, confirming disqualification for malpractice. |
| `POST` | `/teacher/clear-student-attempts` | Yes (Teacher/Admin) | Clears previous attempts and violation logs for a specific student in a subject. |

---

### 5. Super Admin Endpoints
| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/admin/create-user` | Yes (Admin) | Creates new teacher or student user in Firebase Auth & Firestore. |
| `PUT` | `/admin/users/:uid` | Yes (Admin) | Updates user profile details, roles, or department. |
| `DELETE` | `/admin/users/:uid` | Yes (Admin) | Deletes user from both Firebase Auth and Firestore. |
| `POST` | `/admin/users/:uid/reset-password` | Yes (Admin) | Triggers password reset email or forces new password. |
| `GET` | `/admin/policies` | Yes (Admin) | Retrieves default duration and warning threshold policies. |
| `POST` | `/admin/policies` | Yes (Admin) | Updates default duration and warning threshold policies. |
| `POST` | `/admin/database/clear-attempts` | Yes (Admin) | Purges all attempt and violation logs for fresh semester testing. |
| `POST` | `/admin/database/clear-papers` | Yes (Admin) | Purges all question papers, exam sets, and questions. |
