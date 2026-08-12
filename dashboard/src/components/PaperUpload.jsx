import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, addDoc, query, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isMock } from '../firebase';
import { compressImage } from '../utils/imageCompressor';

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
  const [paperDepartment, setPaperDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEditPaperInfo, setShowEditPaperInfo] = useState(false);
  const [editPaperTitle, setEditPaperTitle] = useState('');
  const [editPaperDepartment, setEditPaperDepartment] = useState('');
  const [paperDuration, setPaperDuration] = useState('');
  const [paperScheduleStart, setPaperScheduleStart] = useState('');
  const [paperScheduleEnd, setPaperScheduleEnd] = useState('');
  const [editPaperDuration, setEditPaperDuration] = useState('');
  const [editPaperScheduleStart, setEditPaperScheduleStart] = useState('');
  const [editPaperScheduleEnd, setEditPaperScheduleEnd] = useState('');

  // Mock questions persistent database state
  const [mockQuestions, setMockQuestions] = useState([
    {
      id: 'q-1',
      paperId: 'paper-1',
      questionText: "Which formula represents Ohm's Law?",
      questionImageUrl: null,
      options: [
        { text: 'V = I * R', imageUrl: null },
        { text: 'P = V * I', imageUrl: null },
        { text: 'R = V * P', imageUrl: null },
        { text: 'I = V * R', imageUrl: null }
      ],
      correctOptionIndex: 0,
      department: 'Electrical Engineering'
    }
  ]);

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

  // Mock initial data
  useEffect(() => {
    if (isMock || !db) {
      setPapers([
        { id: 'paper-1', title: 'Midterm Circuit Analysis', department: 'Electrical Engineering', status: 'published', createdAt: new Date().toISOString() },
        { id: 'paper-2', title: 'Data Structures Quiz 1', department: 'Computer Science', status: 'draft', createdAt: new Date().toISOString() }
      ]);
      return;
    }

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

  // Sync questions when paper is selected
  useEffect(() => {
    if (!selectedPaper) {
      setQuestions([]);
      return;
    }

    if (isMock) {
      // Sync from local mockQuestions state
      setQuestions(mockQuestions.filter(q => q.paperId === selectedPaper.id));
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
  }, [selectedPaper, mockQuestions]);

  // Track select changes to sync edit fields
  useEffect(() => {
    if (selectedPaper) {
      setEditPaperTitle(selectedPaper.title);
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
    if (!paperTitle || !paperDepartment) return;

    setLoading(true);
    const paperData = {
      title: paperTitle,
      department: paperDepartment,
      status: 'draft',
      createdAt: new Date().toISOString(),
      ...(paperDuration && { durationMinutes: parseInt(paperDuration) }),
      ...(paperScheduleStart && { scheduleStart: paperScheduleStart }),
      ...(paperScheduleEnd && { scheduleEnd: paperScheduleEnd })
    };

    if (isMock) {
      const newMockPaper = { id: 'paper-' + Date.now(), ...paperData };
      setPapers([newMockPaper, ...papers]);
      setPaperTitle('');
      setPaperDepartment('');
      setPaperDuration('');
      setPaperScheduleStart('');
      setPaperScheduleEnd('');
      setShowCreatePaper(false);
      setLoading(false);
    } else {
      try {
        await addDoc(collection(db, 'papers'), paperData);
        setPaperTitle('');
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
    }
  };

  const handlePublishPaper = async () => {
    if (!selectedPaper) return;
    if (questions.length === 0) {
      alert("Cannot publish an empty paper. Please add at least 1 question first.");
      return;
    }

    setLoading(true);

    if (isMock) {
      const updated = { ...selectedPaper, status: 'published' };
      setPapers(papers.map(p => p.id === selectedPaper.id ? updated : p));
      setSelectedPaper(updated);
      setLoading(false);
    } else {
      try {
        await updateDoc(doc(db, 'papers', selectedPaper.id), { status: 'published' });
        setSelectedPaper({ ...selectedPaper, status: 'published' });
      } catch (err) {
        console.error("Failed to publish paper:", err);
        alert("Failed to publish: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeletePaper = async (paperId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this question paper? This will also delete all questions in this paper!")) {
      return;
    }

    setLoading(true);
    if (isMock) {
      setPapers(papers.filter(p => p.id !== paperId));
      setMockQuestions(mockQuestions.filter(q => q.paperId !== paperId));
      setLoading(false);
    } else {
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
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question?")) {
      return;
    }

    setLoading(true);
    if (isMock) {
      setMockQuestions(mockQuestions.filter(q => q.id !== questionId));
      setLoading(false);
    } else {
      try {
        await deleteDoc(doc(db, 'questions', questionId));
      } catch (err) {
        console.error("Failed to delete question:", err);
        alert("Failed to delete question: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdatePaperInfo = async (e) => {
    e.preventDefault();
    if (!editPaperTitle || !editPaperDepartment) return;

    setLoading(true);
    if (isMock) {
      const updated = { ...selectedPaper, title: editPaperTitle, department: editPaperDepartment, durationMinutes: editPaperDuration ? parseInt(editPaperDuration) : null, scheduleStart: editPaperScheduleStart || null, scheduleEnd: editPaperScheduleEnd || null };
      setPapers(papers.map(p => p.id === selectedPaper.id ? updated : p));
      setSelectedPaper(updated);
      setShowEditPaperInfo(false);
      setLoading(false);
    } else {
      try {
        await updateDoc(doc(db, 'papers', selectedPaper.id), {
          title: editPaperTitle,
          department: editPaperDepartment,
          ...(editPaperDuration ? { durationMinutes: parseInt(editPaperDuration) } : { durationMinutes: null }),
          ...(editPaperScheduleStart ? { scheduleStart: editPaperScheduleStart } : { scheduleStart: null }),
          ...(editPaperScheduleEnd ? { scheduleEnd: editPaperScheduleEnd } : { scheduleEnd: null })
        });
        setSelectedPaper({ ...selectedPaper, title: editPaperTitle, department: editPaperDepartment, durationMinutes: editPaperDuration ? parseInt(editPaperDuration) : null, scheduleStart: editPaperScheduleStart || null, scheduleEnd: editPaperScheduleEnd || null });
        setShowEditPaperInfo(false);
      } catch (err) {
        console.error("Failed to update paper info:", err);
        alert("Failed to update paper details: " + err.message);
      } finally {
        setLoading(false);
      }
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

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!questionText) return;

    setLoading(true);

    try {
      let questionImageUrl = null;
      const optionsData = [];

      if (isMock) {
        // Mock upload: convert compressed file preview to standard placeholder URL or base64
        questionImageUrl = questionPreview;
        
        for (let i = 0; i < 4; i++) {
          optionsData.push({
            text: options[i].text,
            imageUrl: options[i].preview
          });
        }

        const newMockQ = {
          id: 'q-' + Date.now(),
          paperId: selectedPaper.id,
          questionText,
          questionImageUrl,
          options: optionsData,
          correctOptionIndex: correctOption,
          department: selectedPaper.department
        };

        setMockQuestions([...mockQuestions, newMockQ]);
      } else {
        // Live Firebase Uploads: Store as Base64 text directly in Firestore doc
        if (questionFile) {
          questionImageUrl = await convertToBase64(questionFile);
        }

        for (let i = 0; i < 4; i++) {
          let optImageUrl = null;
          if (options[i].file) {
            optImageUrl = await convertToBase64(options[i].file);
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
      }

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
      
      {/* Paper List View */}
      {!selectedPaper ? (
        <div>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.5rem' }}>MCQ Examination Papers</h3>
            <button className="btn btn-primary" onClick={() => setShowCreatePaper(true)}>
              ➕ Create Question Paper
            </button>
          </div>

          {showCreatePaper && (
            <div className="glass-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Create New Paper Profile</h4>
              <form onSubmit={handleCreatePaperSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Paper Title (e.g. Final Semester Quiz)"
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  style={{ flex: 1, minWidth: '250px' }}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Department (e.g. Basic Electronics)"
                  value={paperDepartment}
                  onChange={(e) => setPaperDepartment(e.target.value)}
                  style={{ flex: 1, minWidth: '200px' }}
                  required
                  disabled={loading}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '140px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration (mins)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 45"
                    value={paperDuration}
                    onChange={(e) => setPaperDuration(e.target.value)}
                    min="1"
                    disabled={loading}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule Start</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={paperScheduleStart}
                    onChange={(e) => setPaperScheduleStart(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule End</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={paperScheduleEnd}
                    onChange={(e) => setPaperScheduleEnd(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Save Paper Draft'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePaper(false)}>
                  Cancel
                </button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {papers.map((paper) => (
              <div 
                key={paper.id} 
                className="glass-card flex-between" 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }}
                onClick={() => setSelectedPaper(paper)}
              >
                <div>
                  <h4 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{paper.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Department: <strong>{paper.department}</strong> | Created: {formatCreatedDate(paper.createdAt)}
                  </p>
                </div>
                <div className="flex-row" style={{ gap: '0.75rem' }}>
                  <span className={`badge ${paper.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                    {paper.status}
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedPaper(paper); }}
                  >
                    Open
                  </button>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => handleDeletePaper(paper.id, e)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        
        /* Selected Paper Detail / Editor View */
        <div>
          <div className="flex-between" style={{ marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedPaper(null)}>
              ⬅️ Back to Papers List
            </button>
            <div className="flex-row">
              <span className={`badge ${selectedPaper.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                {selectedPaper.status}
              </span>
              {selectedPaper.status === 'draft' && (
                <button className="btn btn-primary pulse-primary" onClick={handlePublishPaper} disabled={loading}>
                  {loading ? 'Publishing...' : '📢 Publish Exam Paper'}
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
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Department</label>
                <input
                  type="text"
                  className="input-field"
                  value={editPaperDepartment}
                  onChange={(e) => setEditPaperDepartment(e.target.value)}
                  required
                />
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
                  Department: <strong style={{ color: 'white' }}>{selectedPaper.department}</strong> | Total Questions: <strong style={{ color: 'white' }}>{questions.length}</strong>
                  {selectedPaper.durationMinutes && <> | Duration: <strong style={{ color: 'white' }}>{selectedPaper.durationMinutes} mins</strong></>}
                </p>
                {(selectedPaper.scheduleStart || selectedPaper.scheduleEnd) && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                    📅 Schedule: {formatScheduleDate(selectedPaper.scheduleStart)} → {formatScheduleDate(selectedPaper.scheduleEnd)}
                  </p>
                )}
              </div>
              {selectedPaper.status === 'draft' && (
                <button className="btn btn-secondary" onClick={() => setShowEditPaperInfo(true)}>
                  ⚙️ Edit Paper Settings
                </button>
              )}
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
