import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useRealtimeMetrics() {
  const { user, role, attempts, papers, exams, students, teachers } = useApp();

  const isSuperAdmin =
    role === 'superadmin' ||
    user?.role === 'superadmin' ||
    user?.role === 'admin' ||
    user?.email?.toLowerCase().startsWith('admin');

  const teacherDepts = useMemo(() => {
    return Array.isArray(user?.departments) && user.departments.length > 0
      ? user.departments
      : (user?.department ? [user.department] : []);
  }, [user]);

  // Check if a paper belongs to the current teacher
  const isMyPaper = useMemo(() => {
    return (paper) => {
      if (isSuperAdmin) return true;
      if (!paper) return false;
      return (
        (paper.createdById && paper.createdById === user?.uid) ||
        (!paper.createdById && paper.createdByEmail && paper.createdByEmail.toLowerCase() === user?.email?.toLowerCase()) ||
        (!paper.createdById && !paper.createdByEmail && paper.createdBy && paper.createdBy.toLowerCase() === user?.name?.toLowerCase()) ||
        (!paper.createdById && !paper.createdByEmail && !paper.createdBy && teacherDepts.includes(paper.department))
      );
    };
  }, [isSuperAdmin, user, teacherDepts]);

  // Check if an exam belongs to the current teacher
  const isMyExam = useMemo(() => {
    return (exam) => {
      if (isSuperAdmin) return true;
      if (!exam) return false;
      return (
        (exam.createdById && exam.createdById === user?.uid) ||
        (!exam.createdById && exam.createdByEmail && exam.createdByEmail.toLowerCase() === user?.email?.toLowerCase()) ||
        (!exam.createdById && !exam.createdByEmail && exam.createdBy && exam.createdBy.toLowerCase() === user?.name?.toLowerCase()) ||
        (!exam.createdById && !exam.createdByEmail && !exam.createdBy && teacherDepts.includes(exam.department))
      );
    };
  }, [isSuperAdmin, user, teacherDepts]);

  // Scoped papers and exams
  const scopedPapers = useMemo(() => {
    return isSuperAdmin ? papers : papers.filter(isMyPaper);
  }, [papers, isSuperAdmin, isMyPaper]);

  const scopedExams = useMemo(() => {
    return isSuperAdmin ? exams : exams.filter(isMyExam);
  }, [exams, isSuperAdmin, isMyExam]);

  // Scoped attempts (attempts on this teacher's papers or by students in teacher's department)
  const scopedAttempts = useMemo(() => {
    if (isSuperAdmin) return attempts;
    const scopedPaperIds = new Set(scopedPapers.map(p => p.id));
    return attempts.filter(att => {
      if (scopedPaperIds.has(att.paperId)) return true;
      const paper = papers.find(p => p.id === att.paperId);
      if (paper && isMyPaper(paper)) return true;
      if (att.department && teacherDepts.includes(att.department)) return true;
      return false;
    });
  }, [attempts, isSuperAdmin, scopedPapers, papers, isMyPaper, teacherDepts]);

  const metrics = useMemo(() => {
    let activeExams = 0;
    let submittedExams = 0;
    let malpractices = 0;
    let warningsTotal = 0;

    scopedAttempts.forEach((att) => {
      if (att.status === 'started') activeExams++;
      if (att.status === 'submitted') submittedExams++;
      if (att.status === 'blocked_pending_review' || att.status === 'malpractice_failed') malpractices++;
      warningsTotal += att.warnings || 0;
    });

    const totalStudents = isSuperAdmin
      ? students.length
      : students.filter(s => teacherDepts.includes(s.department) || teacherDepts.includes(s.course)).length;

    const totalTeachers = teachers.length;
    const totalPapers = scopedPapers.length;
    const totalExams = scopedExams.length;

    return {
      activeExams,
      submittedExams,
      malpractices,
      warningsTotal,
      totalStudents,
      totalTeachers,
      totalPapers,
      totalExams
    };
  }, [scopedAttempts, isSuperAdmin, students, teachers, teacherDepts, scopedPapers, scopedExams]);

  const liveAlerts = useMemo(() => {
    const alerts = [];
    scopedAttempts.forEach((attempt) => {
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
  }, [scopedAttempts]);

  return { metrics, liveAlerts };
}
