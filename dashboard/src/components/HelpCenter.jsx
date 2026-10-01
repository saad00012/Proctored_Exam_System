import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Help Center Content Definition
// Each section contains articles with {what, why, how} structured content.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'system',
    icon: '🛡️',
    label: 'System Overview',
    articles: [
      {
        id: 'system-intro',
        title: 'What is DIET Proctor?',
        what: 'DIET Proctor is a full-stack proctored online examination platform built for Dnyanshree Institute of Engineering & Technology. It allows faculty to conduct secure, tamper-resistant digital exams on students\' Android devices while monitoring activity in real time from a web dashboard.',
        why: 'Traditional paper-based exams are resource-intensive and prone to malpractice. DIET Proctor digitises the process, adds automated anti-malpractice detection, provides instant grading, and gives teachers a live view of every student\'s progress — all in one integrated system.',
        how: [
          'Teachers log in to the Faculty Console (this web app) to create question papers, assign OTPs, and monitor live sessions.',
          'Students download and install the Android student app, register with their institutional email, and take exams under device-level proctoring restrictions.',
          'Results and violation reports are stored in Firebase Firestore and are always accessible from the Exam History tab.',
        ],
      },
      {
        id: 'system-roles',
        title: 'User Roles & Permissions',
        what: 'The system has three roles: Student, Teacher (Faculty), and Super Admin.',
        why: 'Role separation ensures teachers can only see and manage their own exams and students, while Super Admins have full oversight including user management, audit logs, and database maintenance.',
        how: [
          'Student — registers via the Android app, takes exams only within their department & semester.',
          'Teacher — logs in to the web dashboard, creates question papers, monitors live exams, and reviews results of their own exams.',
          'Super Admin — full access to everything: User Management, Audit Logs, Department config, and database cleanup tools.',
        ],
      },
      {
        id: 'system-security',
        title: 'Security & Anti-Malpractice System',
        what: 'A multi-layer malpractice detection system that operates both on the Android device and in the backend.',
        why: 'To ensure academic integrity without requiring physical invigilation for every exam.',
        how: [
          'App Switching Detection — if a student leaves the exam app, a violation is logged. After the configured threshold (e.g. 3 warnings), the student is automatically blocked.',
          'Device Admin Lock — the Android Device Admin prevents the student from uninstalling the app during an exam.',
          'OTP-Gated Start — students cannot begin without the teacher\'s session OTP.',
          'Question + Option Randomisation — each student gets a uniquely shuffled question order and option order, making collaboration ineffective.',
          'Screenshot & Screen Recording Block — Android system flags prevent screen capture during the exam.',
          'Teacher Override — blocked students can be reviewed and optionally granted extra time by the teacher from the Live Monitor.',
        ],
      },
      {
        id: 'system-randomisation',
        title: 'Question Randomisation',
        what: 'Three levels of randomisation applied per student: Paper Set, Question Order, and Option Order.',
        why: 'Even if two students sit next to each other with the same subject, their question order and option layout will be different — preventing answer copying.',
        how: [
          'Paper Set Randomisation — if multiple paper sets exist for an exam, each student is randomly assigned an unused set on first attempt.',
          'Question Order Shuffle — questions within a set are shuffled using a deterministic seed tied to the student\'s attempt ID. Same shuffle is restored if the student reconnects.',
          'Option Order Shuffle — the four answer options for each question are independently shuffled per student. Grading always uses the original correct index, not the visual position.',
        ],
      },
    ],
  },
  {
    id: 'teacher-overview',
    icon: '📊',
    label: 'Overview Dashboard',
    articles: [
      {
        id: 'overview-metrics',
        title: 'Dashboard Metrics',
        what: 'The Overview tab shows four live stat cards: Active Exams, Completed Exams, Flagged Malpractice, and Question Papers count.',
        why: 'Gives teachers an instant snapshot of ongoing exam sessions and system health without navigating to individual tabs.',
        how: [
          'Active Exams — students currently in a started exam session. Updates in real time via Firestore.',
          'Completed Exams — total exam attempts with status "submitted".',
          'Flagged Malpractice — attempts blocked or terminated due to repeated violations.',
          'My Question Papers — count of paper sets created by the logged-in teacher (or all papers for Super Admin).',
        ],
      },
      {
        id: 'overview-feed',
        title: 'Live Activity Feed',
        what: 'A real-time scrolling list of proctoring events (violations, submissions, blocks) that occurred during the current session.',
        why: 'Allows teachers to react immediately to high-priority events like malpractice blocks without navigating to the Live Monitor.',
        how: [
          'Events appear automatically as students trigger violations or submit their exams.',
          'Danger alerts (red) indicate malpractice blocks. Warning alerts (yellow) indicate individual violations. Success (green) indicates a submission.',
          'Click Live Monitor in the sidebar for full detail and teacher action tools.',
        ],
      },
    ],
  },
  {
    id: 'teacher-papers',
    icon: '📝',
    label: 'Question Papers',
    articles: [
      {
        id: 'papers-exams',
        title: 'Creating an Exam Group',
        what: 'An Exam Group is a named collection of question papers (sets) for a specific subject, department, and semester. Multiple paper sets can be added to one exam group to enable randomised set assignment.',
        why: 'Grouping sets under one exam name lets teachers manage a subject exam as a single unit while maintaining multiple versions for anti-copying.',
        how: [
          'Click "📝 Question Papers" in the sidebar.',
          'Click "Create New Exam" and fill in: Exam Name, Subject, Department, Semester, and Duration (minutes).',
          'After creating, add one or more question paper sets inside the exam group.',
        ],
      },
      {
        id: 'papers-sets',
        title: 'Adding Question Paper Sets',
        what: 'A Question Paper Set is a specific version (Set A, Set B, etc.) of an exam. Each set contains its own list of questions.',
        why: 'Multiple sets within one exam allow the system to randomly assign different papers to different students in the same session.',
        how: [
          'Inside an exam group, click "Add Paper Set".',
          'Give the set a title (e.g. "Set A") and save.',
          'Add questions manually or import from an Excel file.',
          'Publish the set when it is ready.',
          'Repeat for additional sets (Set B, Set C, etc.).',
        ],
      },
      {
        id: 'papers-import',
        title: 'Importing Questions from Excel',
        what: 'Bulk upload questions to a paper set using a structured Excel (.xlsx) template.',
        why: 'Creating questions one by one is time-consuming for large question banks. Excel import allows hundreds of questions to be added at once.',
        how: [
          'Download the template from the paper set actions (⋮ menu → Download .xlsx).',
          'Fill in the template: each row is one question. Columns: Question, Option A, Option B, Option C, Option D, Correct (A/B/C/D), and optionally ImageURL.',
          'Upload the filled file using the "Import from Excel" option.',
          'Questions will appear immediately and can be reviewed and reordered.',
        ],
      },
      {
        id: 'papers-otp',
        title: 'OTP & Starting an Exam',
        what: 'Each paper set has an OTP (One-Time Password) that students must enter in the Android app to begin the exam.',
        why: 'The OTP acts as a session gate — only students physically present in the classroom (who receive the OTP from the teacher) can start.',
        how: [
          'After publishing a paper set, click "Start Exam" from the paper set\'s action menu.',
          'The system generates an OTP for that session.',
          'Share the OTP verbally or on the board with students.',
          'Students enter the OTP in the app to unlock and start the exam.',
          'You can stop/hide the exam after the window closes.',
        ],
      },
      {
        id: 'papers-reorder',
        title: 'Reordering Questions',
        what: 'Questions within a paper set can be reordered using the ▲ / ▼ arrows on each question card.',
        why: 'Fine-tune the logical progression of a paper without having to re-enter or re-import questions.',
        how: [
          'Navigate to a paper set and click into it to see the question list.',
          'Use the ▲ button to move a question up and ▼ to move it down.',
          'Order is saved to Firestore immediately.',
        ],
      },
      {
        id: 'papers-duplicate',
        title: 'Duplicating a Paper Set',
        what: 'Clone an existing paper set (with all its questions) to create a new set with a different title.',
        why: 'Saves time when creating minor variations (Set B from Set A) without re-entering every question.',
        how: [
          'Open the paper set\'s action menu (⋮).',
          'Click "Duplicate".',
          'Enter a new title for the copy.',
          'Click "Confirm Duplicate" — all questions are copied and the new set is saved as a draft.',
        ],
      },
      {
        id: 'papers-download',
        title: 'Downloading a Question Paper',
        what: 'Admin can export any question paper as an Excel (.xlsx) file in the same format used for import.',
        why: 'Useful for archiving, sharing papers offline, or re-importing a paper with modifications.',
        how: [
          'Super Admins can download any paper from the paper set\'s action menu (⋮ → Download .xlsx).',
          'The downloaded file exactly matches the import template format.',
          'Teachers can also download their own papers the same way.',
        ],
      },
    ],
  },
  {
    id: 'teacher-live',
    icon: '📡',
    label: 'Live Monitor',
    articles: [
      {
        id: 'live-view',
        title: 'Viewing Active Sessions',
        what: 'The Live Monitor tab shows a real-time table of all students currently taking exams — their name, department, paper, time elapsed, warnings, and current status.',
        why: 'Allows the teacher to spot students in distress (too many warnings, long elapsed time) or detect malpractice without being physically present.',
        how: [
          'Click "📡 Live Monitor" in the sidebar.',
          'The table updates in real time. Rows turn red for students who are blocked or in violation.',
          'Use the search/filter bar to narrow down by student name or paper.',
        ],
      },
      {
        id: 'live-override',
        title: 'Granting Override / Extra Time',
        what: 'When a student is blocked due to violations (e.g. app switching threshold exceeded), the teacher can review the case and grant access with optional extra time.',
        why: 'Not all app switches are intentional malpractice — a phone call or accidental home button press could trigger a block. Teachers need a way to restore access with a logged decision.',
        how: [
          'Blocked students appear in the Live Monitor with a red "Blocked" badge.',
          'Click the action menu (⋮) next to the student → "Grant Access" or "Grant + Extra Time".',
          'Enter extra time in minutes if needed and confirm.',
          'The decision is logged to the Audit Log (visible to Super Admins).',
          'To permanently block a student as malpractice, choose "Deny — Mark Malpractice".',
        ],
      },
    ],
  },
  {
    id: 'teacher-history',
    icon: '📚',
    label: 'Exam History',
    articles: [
      {
        id: 'history-view',
        title: 'Viewing Exam Results',
        what: 'The Exam History tab shows a grouped list of all submitted exam attempts organised by exam name and paper set. Each row shows the student\'s score, warnings, and time taken.',
        why: 'Provides a permanent record of exam results that teachers can refer to even weeks after the exam.',
        how: [
          'Click "📚 Exam History" in the sidebar.',
          'Expand an exam group to see individual participants.',
          'Each student row shows their score, percentage, warning count, and submission time.',
          'Only exams created by the logged-in teacher are shown (Super Admins see all).',
        ],
      },
      {
        id: 'history-review',
        title: 'Per-Student Answer Review',
        what: 'Click the "📋 Review" button on any student row to see a question-by-question breakdown of their answers — showing correct, wrong, and skipped questions.',
        why: 'Allows teachers to identify patterns (e.g. all students got Q5 wrong) or investigate suspicious score anomalies.',
        how: [
          'Expand an exam group in Exam History.',
          'Click "📋 Review" on any student row.',
          'A modal opens showing each question, the student\'s chosen option, the correct option, and a ✅/❌ indicator.',
          'Green rows = correct, red rows = wrong, grey rows = unanswered.',
        ],
      },
    ],
  },
  {
    id: 'teacher-students',
    icon: '👥',
    label: 'Student Directory',
    articles: [
      {
        id: 'students-view',
        title: 'Student Directory',
        what: 'A read-only list of all registered students, filterable by department and semester.',
        why: 'Gives teachers a quick reference for student enrolment — who is registered, their PRN, email verification status, and assigned department/semester.',
        how: [
          'Click "👥 Students Directory" in the sidebar.',
          'Use the Department and Semester filters to narrow the list.',
          'Each row shows the student\'s name, PRN, email, and verification badge.',
          'Teachers cannot edit student data — that is a Super Admin function in User Management.',
        ],
      },
    ],
  },
  {
    id: 'teacher-questionbank',
    icon: '📖',
    label: 'Question Bank',
    articles: [
      {
        id: 'qb-overview',
        title: 'Central Question Bank',
        what: 'A shared repository of reusable questions that any teacher can save and import into their paper sets.',
        why: 'Prevents teachers from creating the same questions repeatedly. Builds a permanent, searchable library of exam-quality questions organised by subject and department.',
        how: [
          'Click "📖 Question Bank" in the sidebar.',
          'Add a new question using the "Add to Bank" form: fill in question text, four options, the correct answer, subject, and department.',
          'Browse and filter questions by department, subject, or search text.',
          'Click "+ Add to Paper" on any bank question to import it directly into a paper set you are editing.',
          'Delete your own questions (Super Admins can delete any).',
        ],
      },
    ],
  },
  {
    id: 'teacher-settings',
    icon: '⚙️',
    label: 'Faculty Settings',
    articles: [
      {
        id: 'settings-overview',
        title: 'Faculty Teaching Settings',
        what: 'Allows teachers to configure their personal teaching profile: assigned department and semester.',
        why: 'Ensures a teacher\'s created papers and history are correctly scoped to their department, so students and teachers are matched accurately.',
        how: [
          'Click "⚙️ Faculty Settings" in the sidebar.',
          'Update your department and semester assignment.',
          'Save — these settings are reflected immediately in your Exam History and student visibility.',
        ],
      },
    ],
  },
  {
    id: 'admin-suite',
    icon: '🔐',
    label: 'Super Admin Suite',
    articles: [
      {
        id: 'admin-users',
        title: 'User Management',
        what: 'Super Admins can view and manage all registered students and teachers: verify emails, edit profiles, reset passwords, suspend accounts, and delete users.',
        why: 'Centralised user control ensures account hygiene — removing stale or duplicate accounts, correcting profile errors, and suspending malpractice offenders.',
        how: [
          'Click "🔐 User Management" (Super Admin section).',
          'Switch between Students and Teachers tabs.',
          'Use the ⋮ action menu on each row for: Verify Email, Edit, Suspend/Unsuspend, Reset Password, Delete.',
          'Suspended users are blocked from logging in.',
          'Email verification can be manually granted if the student cannot access the verification link.',
        ],
      },
      {
        id: 'admin-audit',
        title: 'Audit Log',
        what: 'A chronological log of all sensitive admin actions — override grants, malpractice decisions, and database resets.',
        why: 'Accountability trail for teacher decisions. If a student disputes an override or block, the audit log shows who took action, when, and what decision was made.',
        how: [
          'Click "📋 Audit Log" (Super Admin section).',
          'Filter by action type (Granted Access, Denied Malpractice, Cleared Logs) or search by teacher/student.',
          'Click Refresh to reload the latest entries.',
          'Each entry shows timestamp, action, teacher name, student ID, and additional context.',
        ],
      },
      {
        id: 'admin-departments',
        title: 'Department Management',
        what: 'Add, rename, or remove academic departments that appear in paper creation and student registration forms.',
        why: 'Keeps the department list in sync with the institution\'s structure without requiring a code deployment.',
        how: [
          'Navigate to "🗄️ Database & Policies" (Super Admin section).',
          'The Department Management card is at the top.',
          'Add a department name and click Save.',
          'Existing departments can be deleted if no students or papers are associated.',
        ],
      },
      {
        id: 'admin-policies',
        title: 'Global Exam Policies',
        what: 'System-wide configuration for Default Exam Duration and Violation Warning Threshold.',
        why: 'These values are used as defaults when creating new papers and as the global malpractice trigger point across all exams.',
        how: [
          'Navigate to "🗄️ Database & Policies".',
          'Set Default Duration (minutes) — used when a paper doesn\'t specify its own duration.',
          'Set Warning Threshold — number of violations before a student is automatically blocked.',
          'Click "Save Global Policies". Changes apply to new sessions immediately.',
        ],
      },
      {
        id: 'admin-db',
        title: 'Database Cleanup',
        what: 'Destructive admin tools to clear all exam attempts & violations, or delete all question papers. Use only between academic semesters.',
        why: 'Fresh starts for new semesters require resetting historical attempt data so students can retake exams and old results don\'t pollute reports.',
        how: [
          'Navigate to "🗄️ Database & Policies".',
          '"Clear All Student Attempts & Violations" — deletes exam_attempts documents. Papers and users are untouched.',
          '"Delete All Question Papers & Sets" — removes all papers and questions. Use to fully reset the question library.',
          'Both actions require a confirmation prompt. They cannot be undone.',
        ],
      },
    ],
  },
  {
    id: 'student-app',
    icon: '📱',
    label: 'Student App Guide',
    articles: [
      {
        id: 'app-register',
        title: 'Registration & Email Verification',
        what: 'Students create an account in the Android app using their institutional email address. After registration, a verification email is sent and must be confirmed before the student can take exams.',
        why: 'Institutional email verification ensures only enrolled students (with a valid college email) can register. It prevents outsiders from impersonating students.',
        how: [
          'Open the DIET Proctor app and tap "Register".',
          'Enter your full name, institutional email (e.g. @dnyanshree.edu.in), PRN number, and password.',
          'Select your Department and Semester.',
          'Tap Register — a verification link is sent to your email.',
          'Open the email on any device and click the verification link.',
          'Return to the app and log in — your account is now fully active.',
        ],
      },
      {
        id: 'app-login',
        title: 'Logging In',
        what: 'Students log in with their registered email and password. On login, the app fetches available published exams for the student\'s department and semester.',
        why: 'Scoped login ensures each student only sees exams relevant to their class, preventing confusion or unauthorised access to other departments\' exams.',
        how: [
          'Open the app and tap "Login".',
          'Enter your institutional email and password.',
          'Tap Login — the app shows your available exams.',
          'If you see "Email not verified", check your inbox for the verification link.',
        ],
      },
      {
        id: 'app-exam-lobby',
        title: 'Exam Lobby & OTP Entry',
        what: 'The main screen lists all published exams for the student\'s department. Each exam is shown with its subject, semester, and a Start button. Clicking Start opens an OTP entry dialog.',
        why: 'The OTP ensures the student can only begin when the teacher has explicitly started the session — preventing students from accessing exam content before the designated time.',
        how: [
          'On the main screen, find the exam to take.',
          'Tap "Start Exam" on the exam card.',
          'Enter the 6-character OTP given by your teacher.',
          'Tap "Confirm" — if the OTP matches, the pre-exam instructions screen appears.',
        ],
      },
      {
        id: 'app-instructions',
        title: 'Pre-Exam Instructions',
        what: 'Before the exam starts, a screen displays all exam rules: no app switching, timer is continuous, answers are auto-saved, etc.',
        why: 'Ensures students are informed of the rules and cannot later claim ignorance. This also serves as the student\'s informed consent to be proctored.',
        how: [
          'Read all rules carefully on this screen.',
          'Tap "I Understand, Start Exam" to begin.',
          'Tap "Cancel" to abort without starting (OTP is not consumed).',
        ],
      },
      {
        id: 'app-exam',
        title: 'Taking the Exam',
        what: 'The exam screen shows one question at a time with four answer options, a countdown timer, a question navigator grid, and navigation buttons.',
        why: 'The single-question layout minimises distraction and makes it easy to track progress through the question grid.',
        how: [
          'Read each question and tap an option to select it. Selected options are highlighted.',
          'Use "Next" to advance or the question grid at the bottom to jump to any question.',
          'Tap "Mark for Review" (🏳) to flag a question — it turns amber in the grid as a reminder to revisit.',
          'Tap "✕ Clear Answer" to deselect your answer for the current question.',
          'Answers are automatically saved every few seconds even if you go offline.',
          'The timer at the top counts down — when it reaches 0, the exam is auto-submitted.',
        ],
      },
      {
        id: 'app-submit',
        title: 'Submitting the Exam',
        what: 'Students can manually submit before time runs out using the "Submit Exam" button. The system auto-submits when the timer expires.',
        why: 'Manual submission allows students who finish early to close the exam securely. Auto-submit prevents data loss if a student forgets to submit.',
        how: [
          'When finished, tap "Submit Exam" on the last question or from the navigation row.',
          'Confirm the submission in the dialog.',
          'Your answers are sent to the backend for grading.',
          'After submission, the Device Admin lock is released.',
        ],
      },
      {
        id: 'app-results',
        title: 'Viewing Your Results',
        what: 'After submission, students can view their score history from the Profile → "My Results" section.',
        why: 'Gives students transparent access to their own performance data — scores, percentages, and pass/fail status for all completed exams.',
        how: [
          'On the main screen, tap your profile icon in the top-right corner.',
          'Tap "📊 View My Results".',
          'A list of all submitted exams appears with score, percentage, a progress bar, and pass/fail badge.',
          'Red progress bar = below 50% (fail), Green = 50% or above (pass).',
        ],
      },
      {
        id: 'app-violations',
        title: 'Violations & Being Blocked',
        what: 'If a student leaves the exam app (switches apps, presses home, receives a notification that opens another app), a violation is recorded. After the warning threshold is exceeded, the student is blocked.',
        why: 'App switching is the primary way students attempt to cheat by looking up answers. The automatic block enforces exam integrity without needing a physical invigilator.',
        how: [
          'Each violation shows a warning dialog — tap "Return to Exam" immediately.',
          'Your warning count is shown in the exam header.',
          'If blocked, a message says "Your exam session has been blocked. Please contact your teacher."',
          'Your teacher can review the case in Live Monitor and grant access or mark it as malpractice.',
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="glass-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        marginBottom: '0.75rem',
      }}
    >
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {article.title}
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '1rem',
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
      </button>

      {/* Body */}
      {open && (
        <div
          style={{
            padding: '0 1.25rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {/* What */}
          <div style={{ paddingTop: '1rem' }}>
            <p
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                marginBottom: '0.4rem',
              }}
            >
              📌 What It Is
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {article.what}
            </p>
          </div>

          {/* Why */}
          <div
            style={{
              background: 'var(--primary-light)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              borderLeft: '3px solid var(--primary)',
            }}
          >
            <p
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                marginBottom: '0.4rem',
              }}
            >
              💡 Why You Need It
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {article.why}
            </p>
          </div>

          {/* How */}
          <div>
            <p
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#10B981',
                marginBottom: '0.6rem',
              }}
            >
              🚀 How To Use It
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {article.how.map((step, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function HelpCenter() {
  const [activeSectionId, setActiveSectionId] = useState('system');
  const [search, setSearch] = useState('');

  const activeSection = SECTIONS.find((s) => s.id === activeSectionId) || SECTIONS[0];

  // Flatten all articles for search
  const searchResults = search.trim()
    ? SECTIONS.flatMap((sec) =>
        sec.articles
          .filter(
            (a) =>
              a.title.toLowerCase().includes(search.toLowerCase()) ||
              a.what.toLowerCase().includes(search.toLowerCase()) ||
              (Array.isArray(a.how) && a.how.some((h) => h.toLowerCase().includes(search.toLowerCase())))
          )
          .map((a) => ({ ...a, sectionLabel: sec.label, sectionIcon: sec.icon }))
      )
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div>
        <h2
          className="gradient-text"
          style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}
        >
          Help & Support Center
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Comprehensive documentation for the DIET Proctor system — Teacher Console and Student App.
        </p>
      </div>

      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="🔍  Search documentation... (e.g. OTP, malpractice, import Excel)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '560px' }}
        />
        {search.trim() && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Search Results */}
      {searchResults !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {searchResults.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔎</div>
              <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>No results found</p>
              <p style={{ fontSize: '0.85rem' }}>Try different keywords or browse a section in the sidebar.</p>
            </div>
          ) : (
            searchResults.map((a) => (
              <div key={a.id}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', paddingLeft: '0.25rem' }}>
                  {a.sectionIcon} {a.sectionLabel}
                </p>
                <ArticleCard article={a} />
              </div>
            ))
          )}
        </div>
      ) : (
        /* Two-column layout: section nav + articles */
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Section Nav */}
          <div className="glass-card" style={{ padding: '0.75rem', position: 'sticky', top: '1rem' }}>
            <p
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-muted)',
                padding: '0.35rem 0.5rem',
                marginBottom: '0.25rem',
              }}
            >
              Sections
            </p>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeSectionId === sec.id ? 'var(--primary-light)' : 'transparent',
                  color: activeSectionId === sec.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeSectionId === sec.id ? 600 : 400,
                  fontSize: '0.875rem',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginBottom: '0.1rem',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{sec.icon}</span>
                <span>{sec.label}</span>
              </button>
            ))}
          </div>

          {/* Articles */}
          <div>
            {/* Section header */}
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{activeSection.icon}</span>
                {activeSection.label}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {activeSection.articles.length} article{activeSection.articles.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Article list */}
            {activeSection.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
