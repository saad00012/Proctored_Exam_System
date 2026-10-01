import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Inline Visual Components (CSS flowcharts / diagrams)
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_ARROW = () => (
  <div style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--text-muted)', lineHeight: 1 }}>
    ↓
  </div>
);

const FLOW_ARROW_H = () => (
  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0 }}>
    →
  </div>
);

function FlowNode({ label, sub, color = 'var(--primary)', bg = 'var(--primary-light)', icon }) {
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: '10px',
        background: bg,
        padding: '0.55rem 0.85rem',
        textAlign: 'center',
        minWidth: '100px',
        flexShrink: 0,
      }}
    >
      {icon && <div style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>{icon}</div>}
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

function FlowRow({ nodes }) {
  // nodes: array of {label, sub, color, bg, icon} | 'arrow'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      {nodes.map((n, i) =>
        n === 'arrow' ? <FLOW_ARROW_H key={i} /> : <FlowNode key={i} {...n} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagram Definitions
// ─────────────────────────────────────────────────────────────────────────────

function ExamFlowDiagram() {
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        📊 Student Exam Flow
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <FlowRow nodes={[
          { label: 'Register', sub: 'Institutional email', icon: '📋', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
          'arrow',
          { label: 'Verify Email', sub: 'Click link in inbox', icon: '✉️', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
          'arrow',
          { label: 'Login', sub: 'Email + Password', icon: '🔑', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
        ]} />
        <FLOW_ARROW />
        <FlowRow nodes={[
          { label: 'Exam Lobby', sub: 'Available exams shown', icon: '📋', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
          'arrow',
          { label: 'Enter OTP', sub: 'From teacher', icon: '🔐', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          'arrow',
          { label: 'Read Rules', sub: 'Instructions screen', icon: '📜', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
        ]} />
        <FLOW_ARROW />
        <FlowRow nodes={[
          { label: 'Take Exam', sub: 'Shuffled Q+Options', icon: '✍️', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
          'arrow',
          { label: 'Submit', sub: 'Manual or auto-timer', icon: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
          'arrow',
          { label: 'View Result', sub: 'Score + pass/fail', icon: '📊', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
        ]} />
      </div>
    </div>
  );
}

function ViolationFlowDiagram() {
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        ⚠️ Violation & Override Flow
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <FlowRow nodes={[
          { label: 'App Switched', sub: 'Student leaves exam', icon: '📵', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          'arrow',
          { label: 'Warning +1', sub: 'Dialog shown to student', icon: '⚠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
        ]} />
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Below threshold</div>
            <FLOW_ARROW />
            <FlowNode label="Continue Exam" icon="▶️" color="#10B981" bg="rgba(16,185,129,0.08)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#EF4444' }}>Threshold exceeded</div>
            <FLOW_ARROW />
            <FlowNode label="AUTO BLOCK" sub="Pending review" icon="🚫" color="#EF4444" bg="rgba(239,68,68,0.08)" />
          </div>
        </div>
        <FLOW_ARROW />
        <FlowRow nodes={[
          { label: 'Teacher Reviews', sub: 'Live Monitor panel', icon: '👁️', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
        ]} />
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <FLOW_ARROW />
            <FlowNode label="✅ Grant Access" sub="New paper assigned" icon="" color="#10B981" bg="rgba(16,185,129,0.08)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <FLOW_ARROW />
            <FlowNode label="🚫 Disqualify" sub="Malpractice logged" icon="" color="#EF4444" bg="rgba(239,68,68,0.08)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperCreationDiagram() {
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        📝 Paper Creation Flow
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <FlowRow nodes={[
          { label: 'Create Exam', sub: 'Name, subject, dept, sem', icon: '🗂️', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
          'arrow',
          { label: 'Add Paper Set', sub: 'Set A / Set B…', icon: '📄', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
        ]} />
        <FLOW_ARROW />
        <FlowRow nodes={[
          { label: 'Add Questions', sub: 'Manual or Excel', icon: '✍️', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
          'arrow',
          { label: 'Reorder / Edit', sub: '▲▼ buttons', icon: '🔀', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
          'arrow',
          { label: 'Publish Set', sub: 'Makes it live', icon: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
        ]} />
        <FLOW_ARROW />
        <FlowRow nodes={[
          { label: 'Generate OTP', sub: 'Start Exam button', icon: '🔐', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          'arrow',
          { label: 'Share OTP', sub: 'Verbally / on board', icon: '📢', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          'arrow',
          { label: 'Students Begin', sub: 'OTP entered in app', icon: '📱', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
        ]} />
      </div>
    </div>
  );
}

function RandomisationDiagram() {
  const levelStyle = (color) => ({
    border: `2px solid ${color}`,
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    background: `${color}12`,
    flex: 1,
    minWidth: '140px',
  });
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        🔀 3-Level Randomisation
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={levelStyle('#6366F1')}>
          <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>🗂️</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Level 1 — Paper Set</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Each student randomly assigned a different set (A, B, C…)</div>
        </div>
        <div style={levelStyle('#0EA5E9')}>
          <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>🔢</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Level 2 — Question Order</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Questions shuffled uniquely per student using a seeded RNG</div>
        </div>
        <div style={levelStyle('#10B981')}>
          <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>🔡</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Level 3 — Option Order</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>A/B/C/D options reshuffled per question per student. Grading uses original index.</div>
        </div>
      </div>
    </div>
  );
}

function ExamScreenDiagram() {
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        📱 Exam Screen Layout
      </p>
      <div
        style={{
          border: '2px solid var(--border-color)',
          borderRadius: '10px',
          overflow: 'hidden',
          maxWidth: '380px',
          margin: '0 auto',
          fontFamily: 'monospace',
        }}
      >
        {/* Status bar */}
        <div style={{ background: '#6366F1', color: 'white', padding: '0.45rem 0.75rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>⏱ 42:17 remaining</span>
          <span>Q 3 / 30</span>
          <span>⚠ 1 warning</span>
        </div>
        {/* Question */}
        <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Question 3</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Which OSI layer handles routing?</div>
        </div>
        {/* Options */}
        {['A. Data Link Layer', 'B. Transport Layer', 'C. Network Layer', 'D. Session Layer'].map((opt, i) => (
          <div key={i} style={{
            padding: '0.55rem 0.75rem',
            fontSize: '0.78rem',
            color: i === 2 ? 'white' : 'var(--text-secondary)',
            background: i === 2 ? '#6366F1' : i % 2 === 0 ? 'var(--bg-main)' : 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}>
            {opt} {i === 2 ? ' ✓' : ''}
          </div>
        ))}
        {/* Actions */}
        <div style={{ background: 'var(--bg-card)', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: '#EF4444', cursor: 'pointer' }}>✕ Clear Answer</span>
          <span style={{ color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}>Next →</span>
        </div>
        {/* Grid */}
        <div style={{ background: 'var(--bg-main)', padding: '0.5rem 0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Question Status Overview</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{
                width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: 'white',
                background: i < 2 ? '#10B981' : i === 2 ? '#6366F1' : 'var(--border-color)',
              }}>
                {i + 1}
              </div>
            ))}
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '2px' }}>…</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '0.35rem' }}>
            {[['#6366F1', 'Current'], ['#10B981', 'Answered'], ['var(--border-color)', 'Unanswered']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleDiagram() {
  const roles = [
    { icon: '👨‍🎓', label: 'Student', color: '#10B981', perms: ['Take exams', 'View own results', 'Android app only'] },
    { icon: '🧑‍🏫', label: 'Teacher', color: '#6366F1', perms: ['Create papers & sets', 'Monitor live sessions', 'Review exam history', 'Manage own students'] },
    { icon: '🛡️', label: 'Super Admin', color: '#F59E0B', perms: ['All teacher permissions', 'User Management', 'Audit Logs', 'Department & policy config', 'Database cleanup'] },
  ];
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        👥 Role Hierarchy
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {roles.map((r) => (
          <div key={r.label} style={{ border: `2px solid ${r.color}`, borderRadius: '10px', padding: '0.85rem', flex: 1, minWidth: '140px', background: `${r.color}10` }}>
            <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.4rem' }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>{r.label}</div>
            <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {r.perms.map((p) => <li key={p} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Help Center Content
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
        what: 'DIET Proctor is a full-stack proctored examination platform for Dnyanshree Institute of Engineering & Technology. It lets teachers conduct secure digital exams on students\' Android phones while monitoring every session live from a web dashboard.',
        why: 'Traditional paper exams are resource-intensive and prone to malpractice. DIET Proctor automates anti-malpractice detection, provides instant grading, and gives teachers a live view of every student\'s progress — all in one integrated system.',
        how: [
          'Teachers use this web Faculty Console to create question papers, assign OTPs, and monitor live sessions.',
          'Students install the Android app, register with their institutional email, and take exams under device-level proctoring.',
          'Results and violation reports are stored in Firebase Firestore and are always accessible from the Exam History tab.',
        ],
        diagram: <ExamFlowDiagram />,
      },
      {
        id: 'system-roles',
        title: 'User Roles & Permissions',
        what: 'Three roles exist: Student (Android app only), Teacher (Faculty Console), and Super Admin (full access to all console features).',
        why: 'Role separation ensures teachers only manage their own exams while Super Admins have complete oversight including user management, audit trails, and database tools.',
        how: [
          'Student — registers via the Android app, can only take exams in their own department & semester.',
          'Teacher — logs into the web console to create papers, run live sessions, and review results of exams they created.',
          'Super Admin — has all teacher abilities plus User Management, Audit Log, Department config, and database reset tools.',
        ],
        diagram: <RoleDiagram />,
      },
      {
        id: 'system-security',
        title: 'Anti-Malpractice System',
        what: 'A multi-layer malpractice detection system that operates both on the Android device and in the backend — automatically blocking students who exceed the violation threshold.',
        why: 'To enforce academic integrity without requiring physical presence for every student during the exam.',
        how: [
          'App Switching Detection — if a student leaves the exam app, a violation is logged and a warning dialog is shown. After the configured threshold, the student is auto-blocked and flagged for teacher review.',
          'OTP-Gated Start — students cannot start any exam without the teacher\'s session OTP, preventing early access.',
          'Question + Option Randomisation — every student gets a unique question order and option order, making answer-sharing ineffective.',
          'Screenshot & Screen Recording Block — Android system flags prevent screen capture.',
          'Device Admin — prevents the student from uninstalling the app mid-exam.',
          'Teacher Override — teachers review blocked students in Live Monitor and choose to unblock with a fresh paper or permanently disqualify.',
        ],
        diagram: <ViolationFlowDiagram />,
      },
      {
        id: 'system-randomisation',
        title: '3-Level Question Randomisation',
        what: 'Three independent levels of randomisation: Paper Set assignment, Question order, and Option order — all seeded per student so they are deterministic on reconnect.',
        why: 'Even sitting next to each other, two students see different sets, different question order, and different A/B/C/D positions — making collaboration or copying ineffective.',
        how: [
          'Level 1 — Paper Set: if multiple published sets exist for an exam, each student is randomly assigned an unused one on first attempt.',
          'Level 2 — Question Order: questions are shuffled using a seeded RNG (seed = studentId + paperId). The same shuffle is restored if the student reconnects mid-exam.',
          'Level 3 — Option Order: the four options for each question are independently shuffled per student. Grading always uses the original correct index, not the visual position — so accuracy is never affected by the shuffle.',
        ],
        diagram: <RandomisationDiagram />,
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
        title: 'Dashboard Metric Cards',
        what: 'Four real-time stat cards visible on the Overview tab: Active Live Exams, Completed Exams, Flagged Malpractice, and Question Papers count.',
        why: 'Gives teachers an instant health snapshot without navigating to individual tabs.',
        how: [
          'Active Exams — students currently in a started session. Updates in real time via Firestore.',
          'Completed Exams — total attempts with status "submitted".',
          'Flagged Malpractice — attempts blocked or terminated for violations.',
          'My Question Papers — paper sets created by the logged-in teacher (all papers for Super Admin).',
        ],
      },
      {
        id: 'overview-feed',
        title: 'Live Activity Feed',
        what: 'A scrolling real-time list of proctoring events: violations, submissions, and blocks that occurred in the current browser session.',
        why: 'Lets teachers react immediately to high-priority alerts without switching to the Live Monitor tab.',
        how: [
          'Events appear automatically as students trigger violations or submit.',
          'Red rows = malpractice blocks. Yellow = individual violation warnings. Green = successful submission.',
          'Click "📡 Live Monitor" in the sidebar for full detail and teacher action tools.',
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
        what: 'An Exam Group is a named container for one or more question paper sets for a specific subject, department, and semester.',
        why: 'Groups multiple sets under one exam name for easy management. Having multiple sets enables the randomised set-assignment feature.',
        how: [
          'Click "📝 Question Papers" in the sidebar.',
          'Click "Create New Exam" and fill in: Exam Name, Subject, Department, Semester, Duration (minutes).',
          'After saving, add one or more paper sets inside the exam group.',
        ],
        diagram: <PaperCreationDiagram />,
      },
      {
        id: 'papers-sets',
        title: 'Adding & Publishing Paper Sets',
        what: 'A Paper Set is one version (e.g. "Set A") within an exam group — it contains its own list of questions. Publishing a set makes it available for student assignment.',
        why: 'Multiple sets in one exam allow random assignment to different students in the same session.',
        how: [
          'Inside an exam group, click "Add Paper Set". Give it a title (e.g. "Set A").',
          'Add questions manually or import from Excel.',
          'Click "Publish" from the paper set\'s action menu (⋮) when the set is ready.',
          'Repeat for additional sets.',
          'Only published sets are assigned to students.',
        ],
      },
      {
        id: 'papers-import',
        title: 'Importing Questions from Excel',
        what: 'Bulk-upload questions to a paper set using an Excel (.xlsx) template.',
        why: 'Saves time for large question banks — hundreds of questions can be added in one upload instead of one by one.',
        how: [
          'Download the template: open the paper set\'s action menu (⋮) → "Download .xlsx".',
          'Fill in the template: each row = one question. Columns: Question, Option A, Option B, Option C, Option D, Correct (A/B/C/D), optionally ImageURL.',
          'Upload the filled file using "Import from Excel".',
          'Questions appear immediately and can be reviewed, reordered, or edited.',
        ],
      },
      {
        id: 'papers-otp',
        title: 'Starting an Exam with OTP',
        what: 'After publishing at least one paper set, the teacher clicks "Start Exam" which generates a session OTP. Only students who enter this OTP in the app can begin.',
        why: 'The OTP is a classroom gate — only students physically present (who receive the OTP verbally) can access the exam.',
        how: [
          'Publish at least one paper set in the exam group.',
          'Click "Start Exam" from the exam group\'s action menu (⋮).',
          'An OTP is generated and displayed on screen.',
          'Share the OTP verbally or write it on the board.',
          'Students enter the OTP in the app — on success, the pre-exam instructions screen appears and they can start.',
          'To close the session, use "Hide Exam" from the action menu to stop new students from entering.',
        ],
      },
      {
        id: 'papers-reorder',
        title: 'Reordering Questions',
        what: 'Questions within a paper set can be reordered using ▲ / ▼ arrow buttons on each question card.',
        why: 'Allows fine-tuning the logical flow of a paper without re-entering or re-importing questions.',
        how: [
          'Open a paper set to see its question list.',
          'Click ▲ to move a question up and ▼ to move it down.',
          'Order is saved to Firestore immediately after each click.',
          'The order is preserved exactly as set — it is the base order before randomisation is applied per student.',
        ],
      },
      {
        id: 'papers-duplicate',
        title: 'Duplicating a Paper Set',
        what: 'Clone an existing paper set (including all questions) to create a new set with a different title.',
        why: 'Saves time when creating Set B from Set A — avoids re-entering every question.',
        how: [
          'Open the paper set\'s action menu (⋮) → "Duplicate".',
          'Enter a new title for the copy (e.g. "Set B").',
          'Click "Confirm Duplicate" — all questions are copied and the new set is saved as a draft.',
          'Edit the duplicate as needed, then publish it.',
        ],
      },
      {
        id: 'papers-download',
        title: 'Downloading a Question Paper',
        what: 'Export any paper set as an Excel (.xlsx) file in the exact same format used for import.',
        why: 'Useful for offline archiving, sharing papers, or re-importing with modifications.',
        how: [
          'Open the paper set\'s action menu (⋮) → "Download .xlsx".',
          'The file downloads with one row per question, matching the import template exactly.',
          'Admin can download any paper; teachers can download their own.',
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
        title: 'Monitoring Active Sessions',
        what: 'The Live Monitor shows a real-time table of students and their exam status — name, department, paper assigned, warnings, elapsed time, and attempt status.',
        why: 'Lets teachers spot students in trouble (high warnings, long elapsed time, blocked status) without being physically present at every desk.',
        how: [
          'Click "📡 Live Monitor" in the sidebar.',
          'The table updates in real time. Rows with warnings or blocked status are highlighted red.',
          'Click a student row to expand their full attempt timeline (all attempts listed with status).',
          'Use the filter bar at the top to filter by status: All, Active, Blocked, Submitted, Malpractice Fail.',
        ],
      },
      {
        id: 'live-override',
        title: 'Reviewing a Blocked Student',
        what: 'When a student is auto-blocked, they appear in Live Monitor with a "Blocked" badge. The teacher can open a review panel showing the student\'s violation count and choose an action.',
        why: 'Not every app switch is intentional malpractice — a phone call or accidental home button press can trigger a block. Teachers need a fair, logged way to make the final decision.',
        how: [
          'Find the blocked student in Live Monitor (red row, "Blocked" badge).',
          'Click their row to expand — then click "Review" to open the override panel.',
          'The panel shows: student name, department, paper assigned, and violation count.',
          'Three action buttons are available:',
          '   ✅ Grant Access (Unblock) — the student is unblocked and automatically assigned a fresh unused paper from the same department pool. The student restarts from Q1 on the new paper.',
          '   🚫 Deny Access (Disqualify) — the attempt is permanently marked as "Malpractice Fail". The student cannot restart.',
          '   🔓 Bypass Admin / 🔒 Enforce Admin — toggle the Device Admin requirement if the student\'s phone is blocking the admin activation.',
          'All grant/deny actions are logged to the Audit Trail (visible to Super Admins).',
        ],
      },
      {
        id: 'live-heartbeat',
        title: 'Student Online Status',
        what: 'Each active student sends a heartbeat to the server every 30 seconds. The Live Monitor shows whether a student is "Online" or "Offline" based on the last heartbeat time.',
        why: 'Helps teachers distinguish between a student who closed the app intentionally and one who lost connectivity.',
        how: [
          'A green "Online" badge means the student sent a heartbeat within the last 60 seconds.',
          'A grey "Offline" badge means no recent heartbeat — the student may have lost connection or left the app.',
          'Offline status alone does not trigger a block — only app-switch violations do.',
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
        what: 'The Exam History tab shows all submitted exam attempts grouped by exam name and paper set. Each student row displays score, warnings, elapsed time, and submission time.',
        why: 'Permanent record of results that teachers can access long after the exam is over.',
        how: [
          'Click "📚 Exam History" in the sidebar.',
          'Exam groups are listed. Click on one to expand and see all participants.',
          'Each student row shows: name, PRN, score (X/Y), percentage, warning count, and submission timestamp.',
          'Teachers see only exams they created. Super Admins see all exams.',
        ],
      },
      {
        id: 'history-review',
        title: 'Per-Student Answer Review',
        what: 'Click "📋 Review" on any student row to open a question-by-question breakdown showing correct (✅), wrong (❌), and unanswered (⬜) questions with the actual option text.',
        why: 'Lets teachers verify scores, spot patterns (e.g. all students missed Q5), and investigate disputed results.',
        how: [
          'Expand an exam group in Exam History.',
          'Click the "📋 Review" button on any student row.',
          'A modal opens listing each question with: question text, the student\'s chosen option, the correct option, and a ✅/❌/⬜ indicator.',
          'Green rows = correct. Red rows = wrong answer given. Grey rows = question was skipped.',
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
        what: 'A read-only list of all registered students filterable by department and semester.',
        why: 'Gives teachers a quick reference for enrolment — who is registered, their PRN, and email verification status.',
        how: [
          'Click "👥 Students Directory" in the sidebar.',
          'Use Department and Semester dropdowns to filter the list.',
          'Each row shows: name, PRN number, email, department, semester, and verification badge.',
          'This view is read-only for teachers. Profile editing is a Super Admin function in User Management.',
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
        what: 'A shared, searchable repository of reusable questions any teacher can save independently of a paper set, and import into paper sets when building exams.',
        why: 'Prevents teachers from re-creating the same questions repeatedly. Builds a permanent library of exam-quality questions organised by subject and department.',
        how: [
          'Click "📖 Question Bank" in the sidebar.',
          'Add a question: fill in the "Add to Bank" form — question text, four options, correct answer, subject, department.',
          'Browse existing questions using the search bar, department filter, or subject filter.',
          'To import into a paper: click "+ Add to Paper" on any bank question card (only visible when the paper editor is open).',
          'Teachers can delete their own questions; Super Admins can delete any question.',
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
        what: 'Lets teachers configure their personal teaching profile: department and semester assignment.',
        why: 'Ensures a teacher\'s papers and history are scoped to the right class so students and teachers are matched correctly.',
        how: [
          'Click "⚙️ Faculty Settings" in the sidebar.',
          'Update your Department and Semester.',
          'Click Save — these settings apply immediately to your exam creation forms and student visibility.',
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
        what: 'Super Admins can view and manage all registered students and teachers: manually verify emails, edit profiles, suspend accounts, reset passwords, and delete users.',
        why: 'Centralised user control for fixing profile errors, removing stale accounts, and suspending malpractice offenders.',
        how: [
          'Click "🔐 User Management" in the Super Admin section.',
          'Switch between "Students" and "Teachers" tabs.',
          'Use the ⋮ action menu on each row: Verify Email | Edit | Suspend / Unsuspend | Reset Password | Delete.',
          'Suspended users are blocked from logging in.',
          'Email verification can be manually granted if a student cannot access the verification email.',
          'A "Suspended" badge appears next to suspended accounts in the list.',
        ],
      },
      {
        id: 'admin-audit',
        title: 'Audit Log',
        what: 'A chronological log of all sensitive admin actions: override grants, malpractice decisions (deny/disqualify), and database resets.',
        why: 'Accountability trail — if a student disputes a block or disqualification, the audit log shows who acted, when, and what decision was made.',
        how: [
          'Click "📋 Audit Log" in the Super Admin section.',
          'Filter by action type: Granted Access | Denied (Malpractice) | Cleared Logs.',
          'Search by teacher name or student ID.',
          'Click "Refresh" to reload the latest entries.',
          'Each entry shows: timestamp, action badge, teacher name, student ID, and the paper/subject involved.',
        ],
      },
      {
        id: 'admin-departments',
        title: 'Department Management',
        what: 'Add, rename, or remove academic departments that appear in paper creation forms and the student registration screen.',
        why: 'Keeps the department list in sync with the institution without a code deployment.',
        how: [
          'Navigate to "🗄️ Database & Policies" in the Super Admin section.',
          'The Department Management card is at the top.',
          'Type a new department name and click Save.',
          'Existing departments can be removed if no active students or papers reference them.',
        ],
      },
      {
        id: 'admin-policies',
        title: 'Global Exam Policies',
        what: 'System-wide settings: Default Exam Duration (minutes) and Violation Warning Threshold (number of violations before auto-block).',
        why: 'These defaults apply to all new exams and all active sessions, letting admins tune sensitivity system-wide.',
        how: [
          'Navigate to "🗄️ Database & Policies".',
          'Set Default Duration — used when a paper set doesn\'t specify its own duration.',
          'Set Warning Threshold — after this many violations, students are automatically blocked.',
          'Click "Save Global Policies". Changes take effect for new exam sessions immediately.',
        ],
      },
      {
        id: 'admin-db',
        title: 'Database Cleanup',
        what: 'Destructive admin tools to clear all exam attempt history or delete all question papers. Use only at semester boundaries.',
        why: 'Fresh semesters require resetting attempt data so students can retake papers and old results don\'t pollute reports.',
        how: [
          'Navigate to "🗄️ Database & Policies".',
          '"Clear All Student Attempts & Violations" — deletes all exam_attempts documents. Papers and user accounts are not deleted.',
          '"Delete All Question Papers & Sets" — removes all papers and questions. Users are not affected.',
          'Both actions show a confirmation dialog. They are irreversible.',
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
        what: 'Students create an account in the Android app using their institutional email. A verification link is sent to that email and must be confirmed before taking exams.',
        why: 'Ensures only enrolled students (with a valid college email) can register — preventing outsiders from impersonating students.',
        how: [
          'Open the app and tap "Register".',
          'Enter your full name, institutional email (e.g. student@dnyanshree.edu.in), PRN number, and password.',
          'Select your Department and Semester from the dropdowns.',
          'Tap Register — a verification link is sent to your email.',
          'Open your email (on any device) and tap the verification link.',
          'Return to the app and log in — your account is now fully active.',
        ],
      },
      {
        id: 'app-login',
        title: 'Logging In',
        what: 'Students log in with their registered institutional email and password. On login, the app fetches published exams available for the student\'s department and semester.',
        why: 'Scoped login ensures each student only sees exams relevant to their class.',
        how: [
          'Open the app and tap "Login".',
          'Enter your institutional email and password.',
          'Tap Login — your available exams appear in the lobby.',
          'If you see "Email not verified", check your inbox for the verification link and open it.',
        ],
      },
      {
        id: 'app-exam-lobby',
        title: 'Exam Lobby & OTP Entry',
        what: 'The main screen lists all published, active exams for the student\'s department. Each exam card shows subject, duration, and a "Start Exam" button.',
        why: 'The OTP gate ensures students can only start when the teacher has actively opened the session — preventing early access.',
        how: [
          'Find your exam in the lobby and tap "Start Exam".',
          'An OTP entry dialog appears. Enter the OTP given by your teacher.',
          'Tap "Confirm" — if the OTP matches, the pre-exam instructions screen appears.',
          'If the OTP is wrong, an error is shown and you can try again.',
        ],
      },
      {
        id: 'app-instructions',
        title: 'Pre-Exam Instructions Screen',
        what: 'Before the exam begins, a scrollable screen lists all exam rules and proctoring conditions. The student must explicitly confirm they understand before the exam starts.',
        why: 'Ensures students are informed of the rules and cannot claim ignorance of proctoring conditions.',
        how: [
          'Read all rules on the screen — they cover app switching, timer, auto-save, Device Admin, and screenshots.',
          'Tap "I Understand, Start Exam" to begin the exam.',
          'Tap "Cancel" to exit without starting (the OTP is not consumed).',
        ],
      },
      {
        id: 'app-exam',
        title: 'Taking the Exam',
        what: 'The exam screen shows one question at a time with four shuffled options, a countdown timer at the top, a question status grid at the bottom, and a single action row at the bottom.',
        why: 'Single-question layout minimises distraction. The grid and colour codes let students track their progress at a glance.',
        how: [
          'Read each question and tap an option to select it. The selected option is highlighted.',
          'Action row at the bottom has two sides:',
          '   Left: "✕ Clear Answer" — appears only when an answer is selected. Deselects the current answer.',
          '   Right: "Skip & Next →" (unanswered) or "Next →" (answered), or "🏁 Finish & Submit" on the last question.',
          'Question Status Grid (bottom bar): colour-coded circles — Blue = current, Green = answered, Default = unanswered.',
          'Tap a circle in the grid to jump forward to that question (only forward navigation is allowed).',
          'Answers are auto-saved to device storage every few seconds — safe even if you go offline.',
          'The countdown timer runs continuously and cannot be paused.',
        ],
        diagram: <ExamScreenDiagram />,
      },
      {
        id: 'app-submit',
        title: 'Submitting the Exam',
        what: 'Students can submit before time runs out using the "🏁 Finish & Submit" button. The server auto-submits when the timer reaches zero.',
        why: 'Manual submit lets students finish early. Auto-submit prevents data loss if time expires.',
        how: [
          'When done, tap "🏁 Finish & Submit" (appears on the last question, or tap it from the grid).',
          'Confirm the submission in the dialog.',
          'Answers are graded server-side and the result is saved.',
          'After submission the Device Admin lock is released and you can use the phone normally.',
        ],
      },
      {
        id: 'app-results',
        title: 'Viewing Your Results',
        what: 'Students can view a full result history from the Profile → "📊 View My Results" section, listing every submitted exam with score, percentage, and pass/fail status.',
        why: 'Gives students transparent access to their own performance data after every exam.',
        how: [
          'On the main screen, tap the profile icon in the top-right corner.',
          'Tap "📊 View My Results".',
          'A list of all submitted exams appears — each card shows subject, score, percentage, and a progress bar.',
          'Green progress bar = 50% or above (pass). Red = below 50% (fail).',
          'Tap the back arrow to return to the exam lobby.',
        ],
      },
      {
        id: 'app-violations',
        title: 'Violations & Being Blocked',
        what: 'If a student leaves the exam app (switches apps, presses home, opens a notification), a violation is recorded. After exceeding the configured threshold, the session is auto-blocked.',
        why: 'App switching is the primary method used to look up answers. The automatic block enforces integrity without a physical invigilator at every seat.',
        how: [
          'When a violation occurs, a warning dialog appears — tap "Return to Exam" immediately.',
          'Your warning count is shown at the top of the exam screen.',
          'If blocked: the screen shows "Your exam session has been blocked. Please contact your teacher."',
          'Your teacher sees you in Live Monitor with a red "Blocked" badge.',
          'The teacher reviews your case and either:',
          '   — Grants access: you are unblocked and assigned a fresh paper. You restart from Q1.',
          '   — Disqualifies: your attempt is permanently marked as Malpractice Fail.',
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Article Card
// ─────────────────────────────────────────────────────────────────────────────

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '0.75rem',
        background: 'var(--bg-card)',
      }}
    >
      {/* Header toggle */}
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
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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
          {/* Diagram (if any) */}
          {article.diagram && article.diagram}

          {/* What */}
          <div style={{ paddingTop: article.diagram ? '0' : '1rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: '0.4rem' }}>
              📌 What It Is
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {article.what}
            </p>
          </div>

          {/* Why */}
          <div style={{ background: 'var(--primary-light)', borderRadius: '8px', padding: '0.85rem 1rem', borderLeft: '3px solid var(--primary)' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)', marginBottom: '0.4rem' }}>
              💡 Why You Need It
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {article.why}
            </p>
          </div>

          {/* How */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', marginBottom: '0.6rem' }}>
              🚀 How To Use It
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {article.how.map((step, i) => (
                <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
      {/* Header */}
      <div>
        <h2 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Help & Support Center
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Complete documentation for the DIET Proctor system — Teacher Console and Student App.
        </p>
      </div>

      {/* Search */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="🔍  Search — OTP, malpractice, override, import Excel, results…"
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
              <p style={{ fontSize: '0.85rem' }}>Try different keywords or browse a section using the sidebar.</p>
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
        /* Two-column layout */
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Section Nav */}
          <div className="glass-card" style={{ padding: '0.75rem', position: 'sticky', top: '1rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', marginBottom: '0.25rem' }}>
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
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{activeSection.icon}</span>
                {activeSection.label}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {activeSection.articles.length} article{activeSection.articles.length !== 1 ? 's' : ''}
              </p>
            </div>

            {activeSection.articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
