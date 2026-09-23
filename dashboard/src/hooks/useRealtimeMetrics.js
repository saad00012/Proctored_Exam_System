import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useRealtimeMetrics() {
  const { attempts, papers, students, teachers } = useApp();

  const metrics = useMemo(() => {
    let activeExams = 0;
    let submittedExams = 0;
    let malpractices = 0;
    let warningsTotal = 0;

    attempts.forEach((att) => {
      if (att.status === 'started') activeExams++;
      if (att.status === 'submitted') submittedExams++;
      if (att.status === 'blocked_pending_review' || att.status === 'malpractice_failed') malpractices++;
      warningsTotal += att.warnings || 0;
    });

    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalPapers = papers.length;

    return {
      activeExams,
      submittedExams,
      malpractices,
      warningsTotal,
      totalStudents,
      totalTeachers,
      totalPapers
    };
  }, [attempts, papers, students, teachers]);

  const liveAlerts = useMemo(() => {
    const alerts = [];
    attempts.forEach((attempt) => {
      if (attempt.status === 'blocked_pending_review') {
        alerts.push({
          id: `${attempt.id}-blocked`,
          studentName: attempt.studentName || 'Student',
          message: 'was hard-blocked (warnings limit exceeded)',
          type: 'danger',
          time: attempt.startedAt || new Date().toISOString()
        });
      } else if (attempt.status === 'malpractice_failed') {
        alerts.push({
          id: `${attempt.id}-failed`,
          studentName: attempt.studentName || 'Student',
          message: 'malpractice fail confirmed by teacher',
          type: 'danger',
          time: new Date().toISOString()
        });
      } else if (attempt.status === 'submitted') {
        alerts.push({
          id: `${attempt.id}-submitted`,
          studentName: attempt.studentName || 'Student',
          message: 'submitted their exam successfully',
          type: 'success',
          time: attempt.submittedAt || new Date().toISOString()
        });
      } else if (attempt.warnings > 0) {
        alerts.push({
          id: `${attempt.id}-warning`,
          studentName: attempt.studentName || 'Student',
          message: `exited exam screen (Warning count: ${attempt.warnings})`,
          type: 'warning',
          time: attempt.startedAt || new Date().toISOString()
        });
      }
    });

    return alerts.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
  }, [attempts]);

  return { metrics, liveAlerts };
}
