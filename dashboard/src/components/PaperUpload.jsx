import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, addDoc, query, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { compressImage } from '../utils/imageCompressor';
import ExamImport from './ExamImport';


function PaperUpload() {
  const formatScheduleDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  const formatCreatedDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showCreatePaper, setShowCreatePaper] = useState(false);
  const [paperTitle, setPaperTitle] = useState('');
  const [paperSubject, setPaperSubject] = useState('');
  const [paperDepartment, setPaperDepartment] = useState('AI & DS Engineering');
  const [loading, setLoading] = useState(false);
  const [showEditPaperInfo, setShowEditPaperInfo] = useState(false);
  const [editPaperTitle, setEditPaperTitle] = useState('');
  const [editPaperSubject, setEditPaperSubject] = useState('');
  const [editPaperDepartment, setEditPaperDepartment] = useState('');
  const [paperDuration, setPaperDuration] = useState('');
  const [paperScheduleStart, setPaperScheduleStart] = useState('');
  const [paperScheduleEnd, setPaperScheduleEnd] = useState('');
  const [editPaperDuration, setEditPaperDuration] = useState('');
  const [editPaperScheduleStart, setEditPaperScheduleStart] = useState('');
  const [editPaperScheduleEnd, setEditPaperScheduleEnd] = useState('');

  // Exam-level grouping state
  const [exams, setExams] = useState([]);
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [examName, setExamName] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examDepartment, setExamDepartment] = useState('AI & DS Engineering');
  const [examSemester, setExamSemester] = useState('Semester 7');
  const [examDuration, setExamDuration] = useState('');
  const [examScheduleStart, setExamScheduleStart] = useState('');
  const [examScheduleEnd, setExamScheduleEnd] = useState('');
  const [addingSetToExamId, setAddingSetToExamId] = useState(null);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [editingExamId, setEditingExamId] = useState(null);
  const [editExamName, setEditExamName] = useState('');
  const [editExamSubject, setEditExamSubject] = useState('');
  const [editExamDepartment, setEditExamDepartment] = useState('');
  const [editExamSemester, setEditExamSemester] = useState('Semester 7');
  const [editExamDuration, setEditExamDuration] = useState('');
  const [editExamScheduleStart, setEditExamScheduleStart] = useState('');
  const [editExamScheduleEnd, setEditExamScheduleEnd] = useState('');
  const [expandedExams, setExpandedExams] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);

  // New Question Form State
  const [questionText, setQuestionText] = useState('');
  const [questionFile, setQuestionFile] = useState(null);
  const [questionPreview, setQuestionPreview] = useState(null);
  const [questionCompStat, setQuestionCompStat] = useState('');
  
  // Option fields
  const [options, setOptions] = useState([
    { text: '', file: null, preview: null, compStat: '' },
    { text: '', file: null, preview: null, compStat: '' },
    { text: '', file: null, preview: null, compStat: '' },
    { text: '', file: null, preview: null, compStat: '' }
  ]);
  const [correctOption, setCorrectOption] = useState(0);

  // Sync papers from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'papers'), (snapshot) => {
      const papersList = [];
      snapshot.forEach((doc) => {
        papersList.push({ id: doc.id, ...doc.data() });
      });
      setPapers(papersList);
    }, (error) => {
      console.error("Error syncing papers in PaperUpload.jsx:", error);
    });

    return () => unsubscribe();
  }, []);

  // Sync exams from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'exams'), (snapshot) => {
      const examsList = [];
      snapshot.forEach((doc) => {
        examsList.push({ id: doc.id, ...doc.data() });
      });
      setExams(examsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (error) => {
      console.error("Error syncing exams in PaperUpload.jsx:", error);
    });
    return () => unsubscribe();
  }, []);

  // Sync questions for selected paper
  useEffect(() => {
    if (!selectedPaper) {
      setQuestions([]);
      return;
    }

    const q = query(collection(db, 'questions'), where('paperId', '==', selectedPaper.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qList = [];
      snapshot.forEach((doc) => {
        qList.push({ id: doc.id, ...doc.data() });
      });
      setQuestions(qList);
    }, (error) => {
      console.error("Error syncing questions in PaperUpload.jsx:", error);
    });

    return () => unsubscribe();
  }, [selectedPaper]);

  // Track select changes to sync edit fields
  useEffect(() => {
    if (selectedPaper) {
      setEditPaperTitle(selectedPaper.title);
      setEditPaperSubject(selectedPaper.subject || '');
      setEditPaperDepartment(selectedPaper.department);
      setEditPaperDuration(selectedPaper.durationMinutes || '');
      setEditPaperScheduleStart(selectedPaper.scheduleStart || '');
      setEditPaperScheduleEnd(selectedPaper.scheduleEnd || '');
    } else {
      setShowEditPaperInfo(false);
    }
  }, [selectedPaper]);

  const handleCreatePaperSubmit = async (e) => {
    e.preventDefault();
    if (!paperTitle || !paperSubject || !paperDepartment) return;

    setLoading(true);
    const paperData = {
      title: paperTitle,
      subject: paperSubject,
      department: paperDepartment,
      status: 'draft',
      isVisible: false,
      isHidden: true,
      createdAt: new Date().toISOString(),
      ...(paperDuration && { durationMinutes: parseInt(paperDuration) }),
      ...(paperScheduleStart && { scheduleStart: paperScheduleStart }),
      ...(paperScheduleEnd && { scheduleEnd: paperScheduleEnd })
    };

    try {
      await addDoc(collection(db, 'papers'), paperData);
      setPaperTitle('');
      setPaperSubject('');
      setPaperDepartment('');
      setPaperDuration('');
      setPaperScheduleStart('');
      setPaperScheduleEnd('');
      setShowCreatePaper(false);
    } catch (err) {
      console.error("Failed to create paper:", err);
      alert("Failed to save paper: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishPaper = async () => {
    if (!selectedPaper) return;
    if (questions.length === 0) {
      alert("Cannot publish an empty paper. Please add at least 1 question first.");
      return;
    }

    setLoading(true);

    try {
      await updateDoc(doc(db, 'papers', selectedPaper.id), {
        status: 'published',
        isVisible: true,
        isHidden: false
      });
      setSelectedPaper({ ...selectedPaper, status: 'published', isVisible: true, isHidden: false });
    } catch (err) {
      console.error("Failed to publish paper:", err);
      alert("Failed to publish: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExamVisibility = async (exam) => {
    const examPapers = papers.filter(p => p.examId === exam.id);
    const isCurrentlyPublished = (exam.status === 'published' || (examPapers.length > 0 && examPapers.every(p => p.status === 'published'))) && exam.isVisible !== false && !exam.isHidden;
    const nextStatus = isCurrentlyPublished ? 'draft' : 'published';
    const nextVisible = !isCurrentlyPublished;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        status: nextStatus,
        isVisible: nextVisible,
        isHidden: !nextVisible
      });
      if (examPapers.length > 0) {
        await Promise.all(examPapers.map(p =>
          updateDoc(doc(db, 'papers', p.id), {
            status: nextStatus,
            isVisible: nextVisible,
            isHidden: !nextVisible
          })
        ));
      }
    } catch (err) {
      console.error("Failed to toggle exam visibility:", err);
      alert("Failed to toggle visibility: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExamSession = async (exam) => {
    const examPapers = papers.filter(p => p.examId === exam.id);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        isStarted: true,
        examOtp: otp,
        sessionStartedAt: new Date().toISOString(),
        status: 'published',
        isVisible: true,
        isHidden: false
      });
      if (examPapers.length > 0) {
        await Promise.all(examPapers.map(p =>
          updateDoc(doc(db, 'papers', p.id), {
            isStarted: true,
            examOtp: otp,
            sessionStartedAt: new Date().toISOString(),
            status: 'published',
            isVisible: true,
            isHidden: false
          })
        ));
      }
      alert(`Exam session started! Room OTP Key is: ${otp}. Disclose this code to students in the examination room.`);
    } catch (err) {
      console.error("Failed to start exam session:", err);
      alert("Failed to start session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndExamSession = async (exam) => {
    if (!window.confirm("Are you sure you want to end this live exam session? Students who have not entered will no longer be able to start.")) return;
    const examPapers = papers.filter(p => p.examId === exam.id);
    setLoading(true);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        isStarted: false,
        sessionEndedAt: new Date().toISOString()
      });
      if (examPapers.length > 0) {
        await Promise.all(examPapers.map(p =>
          updateDoc(doc(db, 'papers', p.id), {
            isStarted: false,
            sessionEndedAt: new Date().toISOString()
          })
        ));
      }
      alert("Exam session ended successfully.");
    } catch (err) {
      console.error("Failed to end exam session:", err);
      alert("Failed to end session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateOtp = async (exam) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const examPapers = papers.filter(p => p.examId === exam.id);
    setLoading(true);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        examOtp: otp
      });
      if (examPapers.length > 0) {
        await Promise.all(examPapers.map(p =>
          updateDoc(doc(db, 'papers', p.id), {
            examOtp: otp
          })
        ));
      }
      alert(`New Room OTP generated: ${otp}`);
    } catch (err) {
      alert("Failed to regenerate OTP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPaperSession = async (paper, e) => {
    if (e) e.stopPropagation();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'papers', paper.id), {
        isStarted: true,
        examOtp: otp,
        sessionStartedAt: new Date().toISOString(),
        status: 'published',
        isVisible: true,
        isHidden: false
      });
      if (selectedPaper && selectedPaper.id === paper.id) {
        setSelectedPaper({ ...selectedPaper, isStarted: true, examOtp: otp, status: 'published', isVisible: true, isHidden: false });
      }
      alert(`Exam session started! Room OTP Key is: ${otp}`);
    } catch (err) {
      alert("Failed to start session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndPaperSession = async (paper, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("End this live exam session?")) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'papers', paper.id), {
        isStarted: false,
        sessionEndedAt: new Date().toISOString()
      });
      if (selectedPaper && selectedPaper.id === paper.id) {
        setSelectedPaper({ ...selectedPaper, isStarted: false });
      }
    } catch (err) {
      alert("Failed to end session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegeneratePaperOtp = async (paper, e) => {
    if (e) e.stopPropagation();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'papers', paper.id), {
        examOtp: otp
      });
      if (selectedPaper && selectedPaper.id === paper.id) {
        setSelectedPaper({ ...selectedPaper, examOtp: otp });
      }
      alert(`New Room OTP generated: ${otp}`);
    } catch (err) {
      alert("Failed to regenerate OTP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaper = async (paperId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this question paper? This will also delete all questions in this paper!")) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'papers', paperId));
      const qQuery = query(collection(db, 'questions'), where('paperId', '==', paperId));
      const qSnapshot = await getDocs(qQuery);
      const deletePromises = [];
      qSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Failed to delete paper:", err);
      alert("Failed to delete paper: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'questions', questionId));
    } catch (err) {
      console.error("Failed to delete question:", err);
      alert("Failed to delete question: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaperInfo = async (e) => {
    e.preventDefault();
    if (!editPaperTitle || !editPaperSubject || !editPaperDepartment) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'papers', selectedPaper.id), {
        title: editPaperTitle,
        subject: editPaperSubject,
        department: editPaperDepartment,
        ...(editPaperDuration ? { durationMinutes: parseInt(editPaperDuration) } : { durationMinutes: null }),
        ...(editPaperScheduleStart ? { scheduleStart: editPaperScheduleStart } : { scheduleStart: null }),
        ...(editPaperScheduleEnd ? { scheduleEnd: editPaperScheduleEnd } : { scheduleEnd: null })
      });
      setSelectedPaper({ ...selectedPaper, title: editPaperTitle, subject: editPaperSubject, department: editPaperDepartment, durationMinutes: editPaperDuration ? parseInt(editPaperDuration) : null, scheduleStart: editPaperScheduleStart || null, scheduleEnd: editPaperScheduleEnd || null });
      setShowEditPaperInfo(false);
    } catch (err) {
      console.error("Failed to update paper info:", err);
      alert("Failed to update paper details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Exam-level handlers ──────────────────────────────────────────────────

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examName || !examSubject || !examDepartment) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'exams'), {
        name: examName,
        subject: examSubject,
        department: examDepartment,
        semester: examSemester,
        ...(examDuration && { durationMinutes: parseInt(examDuration) }),
        ...(examScheduleStart && { scheduleStart: examScheduleStart }),
        ...(examScheduleEnd && { scheduleEnd: examScheduleEnd }),
        status: 'draft',
        isVisible: false,
        isHidden: true,
        createdAt: new Date().toISOString()
      });
      setExamName(''); setExamSubject(''); setExamDepartment('AI & DS Engineering'); setExamSemester('Semester 7');
      setExamDuration(''); setExamScheduleStart(''); setExamScheduleEnd('');
      setShowCreateExam(false);
    } catch (err) {
      alert('Failed to create exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaperSet = async (examId) => {
    if (!newSetTitle.trim()) return;
    const exam = exams.find(ex => ex.id === examId);
    if (!exam) return;
    const examIsVisible = exam.status === 'published' && exam.isVisible !== false && !exam.isHidden;
    setLoading(true);
    try {
      await addDoc(collection(db, 'papers'), {
        title: newSetTitle.trim(),
        examId: examId,
        subject: exam.subject,
        department: exam.department,
        ...(exam.durationMinutes && { durationMinutes: exam.durationMinutes }),
        ...(exam.scheduleStart && { scheduleStart: exam.scheduleStart }),
        ...(exam.scheduleEnd && { scheduleEnd: exam.scheduleEnd }),
        status: examIsVisible ? 'published' : 'draft',
        isVisible: examIsVisible,
        isHidden: !examIsVisible,
        createdAt: new Date().toISOString()
      });
      setNewSetTitle('');
      setAddingSetToExamId(null);
    } catch (err) {
      alert('Failed to add paper set: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExam = async (e, examId) => {
    e.preventDefault();
    if (!editExamName || !editExamSubject || !editExamDepartment) return;
    setLoading(true);
    try {
      const updatedExamData = {
        name: editExamName,
        subject: editExamSubject,
        department: editExamDepartment,
        semester: editExamSemester,
        ...(editExamDuration ? { durationMinutes: parseInt(editExamDuration) } : { durationMinutes: null }),
        ...(editExamScheduleStart ? { scheduleStart: editExamScheduleStart } : { scheduleStart: null }),
        ...(editExamScheduleEnd ? { scheduleEnd: editExamScheduleEnd } : { scheduleEnd: null })
      };
      await updateDoc(doc(db, 'exams', examId), updatedExamData);

      // Push shared attributes down to all child papers in one batch
      const examPapers = papers.filter(p => p.examId === examId);
      await Promise.all(examPapers.map(paper =>
        updateDoc(doc(db, 'papers', paper.id), {
          subject: editExamSubject,
          department: editExamDepartment,
          semester: editExamSemester,
          ...(editExamDuration ? { durationMinutes: parseInt(editExamDuration) } : { durationMinutes: null }),
          ...(editExamScheduleStart ? { scheduleStart: editExamScheduleStart } : { scheduleStart: null }),
          ...(editExamScheduleEnd ? { scheduleEnd: editExamScheduleEnd } : { scheduleEnd: null })
        })
      ));

      setEditingExamId(null);
      alert(`Exam settings updated and applied to all ${examPapers.length} paper set(s).`);
    } catch (err) {
      alert('Failed to update exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId, e) => {
    e.stopPropagation();
    const examPapers = papers.filter(p => p.examId === examId);
    if (!window.confirm(`Delete this exam and all ${examPapers.length} paper set(s) + their questions? This cannot be undone.`)) return;
    setLoading(true);
    try {
      for (const paper of examPapers) {
        const qQuery = query(collection(db, 'questions'), where('paperId', '==', paper.id));
        const qSnapshot = await getDocs(qQuery);
        await Promise.all(qSnapshot.docs.map(d => deleteDoc(d.ref)));
        await deleteDoc(doc(db, 'papers', paper.id));
      }
      await deleteDoc(doc(db, 'exams', examId));
    } catch (err) {
      alert('Failed to delete exam: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Question Image compression
  const handleQuestionFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setQuestionCompStat('Compressing...');
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      // Calculate savings
      const saving = ((file.size - compressedBlob.size) / file.size * 100).toFixed(0);
      setQuestionCompStat(`✅ Compressed from ${(file.size / 1024).toFixed(0)}KB to ${(compressedBlob.size / 1024).toFixed(0)}KB (${saving}% saved)`);
      
      if (questionPreview) {
        URL.revokeObjectURL(questionPreview);
      }
      const previewUrl = URL.createObjectURL(compressedFile);
      setQuestionFile(compressedFile);
      setQuestionPreview(previewUrl);
    } catch (err) {
      console.error(err);
      setQuestionCompStat('❌ Compression failed: ' + err.message);
    }
  };

  // Handle Option Image compression
  const handleOptionFileChange = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const updatedOptions = options.map((opt, i) =>
        i === index ? { ...opt, compStat: 'Compressing...' } : opt
      );
      setOptions(updatedOptions);

      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      const saving = ((file.size - compressedBlob.size) / file.size * 100).toFixed(0);
      
      const prevPreview = options[index].preview;
      if (prevPreview) {
        URL.revokeObjectURL(prevPreview);
      }
      const previewUrl = URL.createObjectURL(compressedFile);

      const nextOptions = options.map((opt, i) =>
        i === index ? {
          ...opt,
          compStat: `Compressed: ${(compressedBlob.size / 1024).toFixed(0)}KB (${saving}% saved)`,
          file: compressedFile,
          preview: previewUrl
        } : opt
      );
      setOptions(nextOptions);
    } catch (err) {
      console.error(err);
      const nextOptions = options.map((opt, i) =>
        i === index ? { ...opt, compStat: '❌ Failed' } : opt
      );
      setOptions(nextOptions);
    }
  };



  const handleAddQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!questionText) return;

    setLoading(true);

    try {
      let questionImageUrl = null;
      const optionsData = [];

        // Live Firebase Uploads: Store in Firebase Storage
        if (questionFile) {
          const fileName = `q_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
          const storageRef = ref(storage, `questions/${selectedPaper.id}/${fileName}`);
          await uploadBytes(storageRef, questionFile);
          questionImageUrl = await getDownloadURL(storageRef);
        }

        for (let i = 0; i < 4; i++) {
          let optImageUrl = null;
          if (options[i].file) {
            const fileName = `opt_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
            const storageRef = ref(storage, `questions/${selectedPaper.id}/${fileName}`);
            await uploadBytes(storageRef, options[i].file);
            optImageUrl = await getDownloadURL(storageRef);
          }
          optionsData.push({
            text: options[i].text,
            imageUrl: optImageUrl
          });
        }

        const questionData = {
          paperId: selectedPaper.id,
          questionText,
          questionImageUrl,
          options: optionsData,
          correctOptionIndex: correctOption,
          department: selectedPaper.department
        };

        await addDoc(collection(db, 'questions'), questionData);

      // Reset fields with URL revocation
      if (questionPreview) {
        URL.revokeObjectURL(questionPreview);
      }
      options.forEach(opt => {
        if (opt.preview) {
          URL.revokeObjectURL(opt.preview);
        }
      });

      setQuestionText('');
      setQuestionFile(null);
      setQuestionPreview(null);
      setQuestionCompStat('');
      setOptions([
        { text: '', file: null, preview: null, compStat: '' },
        { text: '', file: null, preview: null, compStat: '' },
        { text: '', file: null, preview: null, compStat: '' },
        { text: '', file: null, preview: null, compStat: '' }
      ]);
      setCorrectOption(0);
    } catch (err) {
      console.error(err);
      alert("Failed to add question: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Paper List View ─────────────────────────────────────────────── */}
      {!selectedPaper ? (
        <div>
          {/* Header */}
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem' }}>MCQ Examination Papers</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Create an Exam first, then add multiple paper sets under it. All sets share the same subject, department, duration and schedule.
              </p>
            </div>
            <div className="flex-row" style={{ gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => { setShowCreateExam(true); setShowCreatePaper(false); }}>
                📋 Create New Exam
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '0.8rem', background: 'linear-gradient(135deg,#059669,#065f46)', color: '#fff' }}
                onClick={() => setShowImportModal(true)}>
                📥 Import from Excel
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setShowCreatePaper(true); setShowCreateExam(false); }}>
                ➕ Standalone Paper
              </button>
            </div>
          </div>

          {/* Excel Import Modal */}
          {showImportModal && (
            <ExamImport onClose={() => setShowImportModal(false)} onImported={() => setShowImportModal(false)} />
          )}

          {/* Create Exam Form */}
          {showCreateExam && (
            <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.75rem' }}>
              <h4 style={{ marginBottom: '1.25rem' }}>📋 New Exam Configuration</h4>
              <form onSubmit={handleCreateExam}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <input type="text" className="input-field" placeholder="Exam Name (e.g. Data Structures Mid-Sem)" value={examName} onChange={e => setExamName(e.target.value)} style={{ flex: 2, minWidth: '220px' }} required disabled={loading} />
                  <input type="text" className="input-field" placeholder="Subject / Course Name (e.g. Data Structures)" value={examSubject} onChange={e => setExamSubject(e.target.value)} style={{ flex: 2, minWidth: '200px' }} required disabled={loading} />
                  <select className="input-field" value={examDepartment} onChange={e => setExamDepartment(e.target.value)} style={{ flex: 1, minWidth: '200px' }} required disabled={loading}>
                    <option value="AI & DS Engineering">AI &amp; DS Engineering</option>
                    <option value="Computer Science & Engineering">Computer Science &amp; Engineering</option>
                    <option value="Electrical & Computer Engineering">Electrical &amp; Computer Engineering</option>
                    <option value="Electronics & Telecommunication Engineering">Electronics &amp; Telecommunication Engineering</option>
                    <option value="Mechanical & Mechatronics Engineering">Mechanical &amp; Mechatronics Engineering</option>
                    <option value="Applied Science & Engineering">Applied Science &amp; Engineering</option>
                  </select>
                  <select className="input-field" value={examSemester} onChange={e => setExamSemester(e.target.value)} style={{ flex: 1, minWidth: '150px' }} required disabled={loading}>
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Semester 3">Semester 3</option>
                    <option value="Semester 4">Semester 4</option>
                    <option value="Semester 5">Semester 5</option>
                    <option value="Semester 6">Semester 6</option>
                    <option value="Semester 7">Semester 7</option>
                    <option value="Semester 8">Semester 8</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration (mins)</label>
                    <input type="number" className="input-field" placeholder="e.g. 45" value={examDuration} onChange={e => setExamDuration(e.target.value)} min="1" disabled={loading} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '185px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule Start</label>
                    <input type="datetime-local" className="input-field" value={examScheduleStart} onChange={e => setExamScheduleStart(e.target.value)} disabled={loading} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '185px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule End</label>
                    <input type="datetime-local" className="input-field" value={examScheduleEnd} onChange={e => setExamScheduleEnd(e.target.value)} disabled={loading} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : '✅ Create Exam'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateExam(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Legacy standalone paper form */}
          {showCreatePaper && (
            <div className="glass-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Create Standalone Paper (Legacy)</h4>
              <form onSubmit={handleCreatePaperSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <input type="text" className="input-field" placeholder="Paper Title (e.g. Set A)" value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)} style={{ flex: 1, minWidth: '200px' }} required disabled={loading} />
                <input type="text" className="input-field" placeholder="Subject / Exam Name (e.g. Data Structures)" value={paperSubject} onChange={(e) => setPaperSubject(e.target.value)} style={{ flex: 1, minWidth: '220px' }} required disabled={loading} />
                <select className="input-field" value={paperDepartment} onChange={(e) => setPaperDepartment(e.target.value)} style={{ flex: 1, minWidth: '200px' }} required disabled={loading}>
                  <option value="AI & DS Engineering">AI &amp; DS Engineering</option>
                  <option value="Computer Science & Engineering">Computer Science &amp; Engineering</option>
                  <option value="Electrical & Computer Engineering">Electrical &amp; Computer Engineering</option>
                  <option value="Electronics & Telecommunication Engineering">Electronics &amp; Telecommunication Engineering</option>
                  <option value="Mechanical & Mechatronics Engineering">Mechanical &amp; Mechatronics Engineering</option>
                  <option value="Applied Science & Engineering">Applied Science &amp; Engineering</option>
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '140px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration (mins)</label>
                  <input type="number" className="input-field" placeholder="e.g. 45" value={paperDuration} onChange={(e) => setPaperDuration(e.target.value)} min="1" disabled={loading} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule Start</label>
                  <input type="datetime-local" className="input-field" value={paperScheduleStart} onChange={(e) => setPaperScheduleStart(e.target.value)} disabled={loading} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule End</label>
                  <input type="datetime-local" className="input-field" value={paperScheduleEnd} onChange={(e) => setPaperScheduleEnd(e.target.value)} disabled={loading} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Save Paper Draft'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePaper(false)}>Cancel</button>
              </form>
            </div>
          )}

          {/* ── Exam Groups ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {exams.map(exam => {
              const examPapers = papers.filter(p => p.examId === exam.id);
              const isExpanded = !!expandedExams[exam.id];
              const isEditingThisExam = editingExamId === exam.id;
              const isExamStarted = exam.isStarted === true;
              const isExamVisible = (exam.status === 'published' || (examPapers.length > 0 && examPapers.every(p => p.status === 'published'))) && exam.isVisible !== false && !exam.isHidden;
              const anyPublished = examPapers.some(p => p.status === 'published' && p.isVisible !== false && !p.isHidden);

              return (
                <div key={exam.id} className="glass-card" style={{ padding: '1.5rem' }}>
                  {/* Exam header row */}
                  <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: (isExpanded || isExamStarted) ? '1.25rem' : '0' }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedExams(prev => ({ ...prev, [exam.id]: !prev[exam.id] }))}>
                      <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem' }}>{isExpanded ? '▼' : '▶'}</span>
                        <h4 style={{ fontSize: '1.15rem', margin: 0 }}>{exam.name}</h4>
                        {isExamStarted ? (
                          <span className="badge badge-success" style={{ background: '#059669', color: '#ffffff', fontWeight: 'bold' }}>
                            🟢 Live in Room (OTP: {exam.examOtp || 'Active'})
                          </span>
                        ) : (
                          <span className={`badge ${isExamVisible ? 'badge-success' : anyPublished ? 'badge-warning' : 'badge-warning'}`} style={!isExamVisible ? { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' } : {}}>
                            {isExamVisible ? '👁️ Published (Ready to Start)' : anyPublished ? 'Partial Visible' : '🔒 Hidden from App'}
                          </span>
                        )}
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          {examPapers.length} set{examPapers.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, paddingLeft: '1.75rem' }}>
                        📚 {exam.subject} &nbsp;|&nbsp; 🏛️ {exam.department}
                        {exam.durationMinutes && <> &nbsp;|&nbsp; ⏱️ {exam.durationMinutes} min</>}
                        {exam.scheduleStart && <> &nbsp;|&nbsp; 🗓️ {formatScheduleDate(exam.scheduleStart)} → {formatScheduleDate(exam.scheduleEnd)}</>}
                      </p>
                    </div>

                    <div className="flex-row" style={{ gap: '0.5rem', marginLeft: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isExamStarted ? (
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', fontWeight: 'bold' }}
                          onClick={(e) => { e.stopPropagation(); handleEndExamSession(exam); }}
                          disabled={loading}
                        >
                          ⏹️ End Session
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', background: 'linear-gradient(135deg,#059669,#047857)', fontWeight: 'bold' }}
                          onClick={(e) => { e.stopPropagation(); handleStartExamSession(exam); }}
                          disabled={loading}
                          title="Start exam session and generate 6-digit room key OTP for students"
                        >
                          ▶️ Start Exam (Generate OTP)
                        </button>
                      )}

                      <button
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.75rem',
                          background: isExamVisible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isExamVisible ? '#10b981' : '#f87171',
                          border: isExamVisible ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                        onClick={(e) => { e.stopPropagation(); handleToggleExamVisibility(exam); }}
                        disabled={loading}
                        title={isExamVisible ? 'Hide all sets of this exam from student app' : 'Publish and make all sets visible to students'}
                      >
                        {isExamVisible ? '👁️ Visible' : '🔒 Hidden'}
                      </button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                        onClick={() => { setEditingExamId(exam.id); setEditExamName(exam.name); setEditExamSubject(exam.subject); setEditExamDepartment(exam.department); setEditExamSemester(exam.semester || 'Semester 7'); setEditExamDuration(exam.durationMinutes || ''); setEditExamScheduleStart(exam.scheduleStart || ''); setEditExamScheduleEnd(exam.scheduleEnd || ''); setExpandedExams(prev => ({ ...prev, [exam.id]: true })); }}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-danger" style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }} onClick={e => handleDeleteExam(exam.id, e)} disabled={loading}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Prominent Active Exam OTP Room Banner */}
                  {isExamStarted && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.2))',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      marginBottom: isExpanded ? '1.25rem' : '0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.5px' }}>● EXAM IN PROGRESS IN ROOM</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Students Can Enter</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Room OTP Key:</span>
                          <span style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '4px', color: '#34d399', fontFamily: 'monospace' }}>
                            {exam.examOtp || '------'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-row" style={{ gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} onClick={() => { navigator.clipboard.writeText(exam.examOtp || ''); alert(`Room OTP ${exam.examOtp} copied!`); }}>
                          📋 Copy OTP
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} onClick={() => handleRegenerateOtp(exam)} disabled={loading}>
                          🔄 New OTP
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Edit Exam Settings form */}
                  {isEditingThisExam && (
                    <form onSubmit={e => handleUpdateExam(e, exam.id)} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                        ⚡ Saving will update all {examPapers.length} paper set(s) automatically.
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <input type="text" className="input-field" placeholder="Exam Name" value={editExamName} onChange={e => setEditExamName(e.target.value)} style={{ flex: 2, minWidth: '180px' }} required disabled={loading} />
                        <input type="text" className="input-field" placeholder="Subject / Course" value={editExamSubject} onChange={e => setEditExamSubject(e.target.value)} style={{ flex: 2, minWidth: '180px' }} required disabled={loading} />
                        <select className="input-field" value={editExamDepartment} onChange={e => setEditExamDepartment(e.target.value)} style={{ flex: 1, minWidth: '190px' }} required disabled={loading}>
                          <option value="AI & DS Engineering">AI &amp; DS Engineering</option>
                          <option value="Computer Science & Engineering">Computer Science &amp; Engineering</option>
                          <option value="Electrical & Computer Engineering">Electrical &amp; Computer Engineering</option>
                          <option value="Electronics & Telecommunication Engineering">Electronics &amp; Telecommunication Engineering</option>
                          <option value="Mechanical & Mechatronics Engineering">Mechanical &amp; Mechatronics Engineering</option>
                          <option value="Applied Science & Engineering">Applied Science &amp; Engineering</option>
                        </select>
                        <select className="input-field" value={editExamSemester} onChange={e => setEditExamSemester(e.target.value)} style={{ flex: 1, minWidth: '140px' }} required disabled={loading}>
                          <option value="Semester 1">Semester 1</option>
                          <option value="Semester 2">Semester 2</option>
                          <option value="Semester 3">Semester 3</option>
                          <option value="Semester 4">Semester 4</option>
                          <option value="Semester 5">Semester 5</option>
                          <option value="Semester 6">Semester 6</option>
                          <option value="Semester 7">Semester 7</option>
                          <option value="Semester 8">Semester 8</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '130px' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Duration (mins)</label>
                          <input type="number" className="input-field" placeholder="45" value={editExamDuration} onChange={e => setEditExamDuration(e.target.value)} min="1" disabled={loading} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '175px' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Schedule Start</label>
                          <input type="datetime-local" className="input-field" value={editExamScheduleStart} onChange={e => setEditExamScheduleStart(e.target.value)} disabled={loading} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '175px' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Schedule End</label>
                          <input type="datetime-local" className="input-field" value={editExamScheduleEnd} onChange={e => setEditExamScheduleEnd(e.target.value)} disabled={loading} />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : '💾 Save & Propagate'}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditingExamId(null)}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {/* Expanded paper sets list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      {examPapers.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                          No paper sets yet. Add one below.
                        </p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                        {examPapers.map((paper, idx) => {
                          const isPaperVisible = paper.status === 'published' && paper.isVisible !== false && !paper.isHidden;
                          return (
                            <div key={paper.id} className="flex-between" style={{ padding: '0.85rem 1rem', background: 'rgba(0,0,0,0.12)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div>
                                <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>Set {idx + 1}: {paper.title}</span>
                                <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Created {formatCreatedDate(paper.createdAt)}</span>
                              </div>
                              <div className="flex-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                                <span className={`badge ${isPaperVisible ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem', ...(isPaperVisible ? {} : { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }) }}>
                                  {isPaperVisible ? '👁️ Visible' : '🔒 Hidden'}
                                </span>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={(e) => handleTogglePaperVisibility(paper, e)} disabled={loading}>
                                  {isPaperVisible ? 'Hide' : 'Publish'}
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={() => setSelectedPaper(paper)}>Open</button>
                                <button className="btn btn-danger" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={e => handleDeletePaper(paper.id, e)} disabled={loading}>Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add paper set inline */}
                      {addingSetToExamId === exam.id ? (
                        <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                          <input type="text" className="input-field" placeholder="Set title (e.g. Set A, Set B...)" value={newSetTitle} onChange={e => setNewSetTitle(e.target.value)} style={{ flex: 1 }} autoFocus disabled={loading} />
                          <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => handleAddPaperSet(exam.id)} disabled={loading || !newSetTitle.trim()}>{loading ? 'Adding...' : '✅ Add Set'}</button>
                          <button className="btn btn-secondary" onClick={() => { setAddingSetToExamId(null); setNewSetTitle(''); }}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => setAddingSetToExamId(exam.id)}>
                          ➕ Add Paper Set
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Ungrouped / Standalone Papers ──────────────────────────── */}
          {papers.filter(p => !p.examId).length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>📄 Standalone Papers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {papers.filter(p => !p.examId).map(paper => {
                  const isPaperVisible = paper.status === 'published' && paper.isVisible !== false && !paper.isHidden;
                  const isPaperStarted = paper.isStarted === true;
                  return (
                    <div key={paper.id} className="glass-card flex-between" style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }} onClick={() => setSelectedPaper(paper)}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <h4 style={{ fontSize: '1.1rem', margin: 0 }}>{paper.title}</h4>
                          {isPaperStarted && (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                              🟢 OTP: {paper.examOtp || 'Active'}
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          Department: <strong>{paper.department}</strong> | Created: {formatCreatedDate(paper.createdAt)}
                        </p>
                      </div>
                      <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                        {isPaperStarted ? (
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={e => handleEndPaperSession(paper, e)} disabled={loading}>
                            ⏹️ End Session
                          </button>
                        ) : (
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'linear-gradient(135deg,#059669,#047857)' }} onClick={e => handleStartPaperSession(paper, e)} disabled={loading}>
                            ▶️ Start Exam (OTP)
                          </button>
                        )}
                        <span className={`badge ${isPaperVisible ? 'badge-success' : 'badge-warning'}`} style={!isPaperVisible ? { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' } : {}}>
                          {isPaperVisible ? '👁️ Visible' : '🔒 Hidden'}
                        </span>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={e => handleTogglePaperVisibility(paper, e)} disabled={loading}>
                          {isPaperVisible ? '🔒 Hide' : '👁️ Publish'}
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={e => { e.stopPropagation(); setSelectedPaper(paper); }}>Open</button>
                        <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={e => handleDeletePaper(paper.id, e)} disabled={loading}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {exams.length === 0 && papers.filter(p => !p.examId).length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No exams yet.</p>
              <p style={{ fontSize: '0.85rem' }}>Click <strong>📋 Create New Exam</strong> to get started.</p>
            </div>
          )}
        </div>
      ) : (
        
        /* Selected Paper Detail / Editor View */
        <div>
          <div className="flex-between" style={{ marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedPaper(null)}>
              ⬅️ Back to Papers List
            </button>
            <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
              {selectedPaper.isStarted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>🟢 Active Room OTP:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#34d399', letterSpacing: '2px', fontFamily: 'monospace' }}>{selectedPaper.examOtp || '------'}</strong>
                  <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => { navigator.clipboard.writeText(selectedPaper.examOtp || ''); alert(`Room OTP ${selectedPaper.examOtp} copied!`); }}>
                    Copy
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={(e) => handleRegeneratePaperOtp(selectedPaper, e)} disabled={loading}>
                    🔄
                  </button>
                </div>
              )}

              {selectedPaper.isStarted ? (
                <button className="btn btn-danger" onClick={(e) => handleEndPaperSession(selectedPaper, e)} disabled={loading}>
                  ⏹️ End Live Session
                </button>
              ) : (
                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#059669,#047857)' }} onClick={(e) => handleStartPaperSession(selectedPaper, e)} disabled={loading}>
                  ▶️ Start Session &amp; Generate OTP
                </button>
              )}

              <span className={`badge ${selectedPaper.status === 'published' && selectedPaper.isVisible !== false && !selectedPaper.isHidden ? 'badge-success' : 'badge-warning'}`} style={!(selectedPaper.status === 'published' && selectedPaper.isVisible !== false && !selectedPaper.isHidden) ? { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' } : {}}>
                {selectedPaper.status === 'published' && selectedPaper.isVisible !== false && !selectedPaper.isHidden ? '👁️ Visible in App' : '🔒 Hidden from App'}
              </span>
              {selectedPaper.status === 'published' && selectedPaper.isVisible !== false && !selectedPaper.isHidden ? (
                <button className="btn btn-secondary" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }} onClick={(e) => handleTogglePaperVisibility(selectedPaper, e)} disabled={loading}>
                  🔒 Hide from App
                </button>
              ) : (
                <button className="btn btn-primary pulse-primary" onClick={handlePublishPaper} disabled={loading}>
                  {loading ? 'Publishing...' : '📢 Publish & Make Visible'}
                </button>
              )}
            </div>
          </div>

          {showEditPaperInfo ? (
            <form onSubmit={handleUpdatePaperInfo} className="glass-card" style={{ marginBottom: '2.5rem', padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', textAlign: 'left' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Paper Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={editPaperTitle}
                  onChange={(e) => setEditPaperTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Subject / Exam Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editPaperSubject}
                  onChange={(e) => setEditPaperSubject(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Department</label>
                <select
                  className="input-field"
                  value={editPaperDepartment}
                  onChange={(e) => setEditPaperDepartment(e.target.value)}
                  required
                >
                  <option value="AI & DS Engineering">AI & DS Engineering</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Electrical & Computer Engineering">Electrical & Computer Engineering</option>
                  <option value="Electronics & Telecommunication Engineering">Electronics & Telecommunication Engineering</option>
                  <option value="Mechanical & Mechatronics Engineering">Mechanical & Mechatronics Engineering</option>
                  <option value="Applied Science & Engineering">Applied Science & Engineering</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Duration (mins)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Global default"
                  value={editPaperDuration}
                  onChange={(e) => setEditPaperDuration(e.target.value)}
                  min="1"
                />
              </div>
              <div style={{ flex: 1, minWidth: '170px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Schedule Start</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={editPaperScheduleStart}
                  onChange={(e) => setEditPaperScheduleStart(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: '170px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Schedule End</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={editPaperScheduleEnd}
                  onChange={(e) => setEditPaperScheduleEnd(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem' }} disabled={loading}>
                  Save
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem' }} onClick={() => setShowEditPaperInfo(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="glass-card flex-between" style={{ marginBottom: '2.5rem', textAlign: 'left', padding: '1.5rem' }}>
              <div>
                <h2 className="gradient-text" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{selectedPaper.title}</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Subject: <strong style={{ color: 'white' }}>{selectedPaper.subject || 'None'}</strong> | Department: <strong style={{ color: 'white' }}>{selectedPaper.department}</strong> | Total Questions: <strong style={{ color: 'white' }}>{questions.length}</strong>
                  {selectedPaper.durationMinutes && <> | Duration: <strong style={{ color: 'white' }}>{selectedPaper.durationMinutes} mins</strong></>}
                </p>
                {(selectedPaper.scheduleStart || selectedPaper.scheduleEnd) && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                    📅 Schedule: {formatScheduleDate(selectedPaper.scheduleStart)} → {formatScheduleDate(selectedPaper.scheduleEnd)}
                  </p>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setShowEditPaperInfo(true)}>
                ⚙️ Edit Paper Settings
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', textAlign: 'left' }}>
            
            {/* Left: Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Questions ({questions.length})
              </h3>
              
              {questions.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  No questions in this paper yet. Use the form to add one.
                </p>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="glass-card" style={{ padding: '1.25rem' }}>
                    <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Q{idx + 1}</span>
                      <div className="flex-row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Correct: Option {String.fromCharCode(65 + q.correctOptionIndex)}
                        </span>
                        {selectedPaper.status === 'draft' && (
                          <button 
                            type="button"
                            className="btn btn-danger" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => handleDeleteQuestion(q.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <p style={{ fontWeight: 500, marginBottom: '1rem' }}>{q.questionText}</p>
                    
                    {q.questionImageUrl && (
                      <img 
                        src={q.questionImageUrl} 
                        alt="Question visual" 
                        style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}
                      />
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} style={{ 
                          padding: '0.5rem', 
                          background: q.correctOptionIndex === oIdx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                          border: q.correctOptionIndex === oIdx ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt.text}
                          {opt.imageUrl && (
                            <img src={opt.imageUrl} alt="" style={{ display: 'block', maxHeight: '40px', marginTop: '0.25rem', borderRadius: '4px' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right: Add Question Creator */}
            {selectedPaper.status === 'draft' ? (
              <div className="glass-card" style={{ height: 'fit-content' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Add New Question
                </h3>
                
                <form onSubmit={handleAddQuestionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      Question Statement
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="Type the question statement here..."
                      rows="3"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      required
                      disabled={loading}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      Question Diagram/Circuit Image (Optional)
                    </label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleQuestionFileChange}
                      disabled={loading}
                      style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                    />
                    {questionCompStat && (
                      <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>{questionCompStat}</p>
                    )}
                    {questionPreview && (
                      <div style={{ marginTop: '0.75rem', position: 'relative' }}>
                        <img src={questionPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          onClick={() => { setQuestionFile(null); setQuestionPreview(null); setQuestionCompStat(''); }}
                          style={{ position: 'absolute', top: 5, right: 5, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options fields */}
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Answer Options
                    </label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {options.map((opt, index) => (
                        <div key={index} style={{ padding: '0.75rem', background: 'rgba(0, 0, 0, 0.1)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', display: 'block', marginBottom: '0.4rem' }}>
                            Option {String.fromCharCode(65 + index)}
                          </span>
                          <input
                            type="text"
                            className="input-field"
                            placeholder={`Option ${String.fromCharCode(65 + index)} Text`}
                            value={opt.text}
                            onChange={(e) => {
                              const updated = options.map((opt, i) =>
                                i === index ? { ...opt, text: e.target.value } : opt
                              );
                              setOptions(updated);
                            }}
                            required
                            disabled={loading}
                            style={{ marginBottom: '0.5rem' }}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleOptionFileChange(index, e)}
                            disabled={loading}
                            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                          />
                          {opt.compStat && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.compStat}</p>}
                          {opt.preview && (
                            <img src={opt.preview} alt="" style={{ display: 'block', maxHeight: '40px', marginTop: '0.25rem', borderRadius: '4px' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Correct answer toggle */}
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      Identify Correct Option
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {[0, 1, 2, 3].map((num) => (
                        <label key={num} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="correctOption"
                            checked={correctOption === num}
                            onChange={() => setCorrectOption(num)}
                            disabled={loading}
                          />
                          <span>Option {String.fromCharCode(65 + num)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '1rem' }} disabled={loading}>
                    {loading ? 'Processing Upload...' : '📥 Save Question to Paper'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass-card" style={{ height: 'fit-content', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <span className="badge badge-success" style={{ marginBottom: '1rem' }}>Published</span>
                <h4 style={{ marginBottom: '0.5rem' }}>Paper Lock Active</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  This MCQ exam paper is already published and in-use/ready. Questions cannot be added, edited, or deleted once locked to prevent exam configuration drift.
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default PaperUpload;
