import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import API_BASE_URL from '../config';

function QuestionBank({ onImportQuestion }) {
  const { user, role, departments = [] } = useApp();
  const isSuperAdmin = role === 'superadmin' || role === 'admin';

  const [questions, setQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // New Question State
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState([
    { text: '' },
    { text: '' },
    { text: '' },
    { text: '' }
  ]);
  const [correctOption, setCorrectOption] = useState(0);
  const [department, setDepartment] = useState(user?.department || departments[0] || '');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    const q = collection(db, 'question_bank');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // sort by createdAt desc
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setQuestions(list);
    });
    return () => unsubscribe();
  }, []);

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!questionText || !department || !subject || options.some(o => !o.text)) {
      alert('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'question_bank'), {
        questionText,
        options,
        correctOptionIndex: correctOption,
        subject,
        department,
        tags: [],
        createdById: user?.uid || '',
        createdByEmail: user?.email || '',
        createdBy: user?.name || '',
        createdAt: new Date().toISOString(),
      });
      setQuestionText('');
      setOptions([{ text: '' }, { text: '' }, { text: '' }, { text: '' }]);
      setCorrectOption(0);
      setSubject('');
      alert('✅ Question added to bank!');
    } catch (err) {
      alert('Failed to add question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (qId, createdById) => {
    if (!isSuperAdmin && createdById !== user?.uid) {
      alert('You can only delete your own questions.');
      return;
    }
    if (!window.confirm('Delete this question from the bank?')) return;
    try {
      await deleteDoc(doc(db, 'question_bank', qId));
    } catch (e) {
      alert('Error deleting: ' + e.message);
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (deptFilter !== 'All' && q.department !== deptFilter) return false;
    if (subjectFilter && !q.subject.toLowerCase().includes(subjectFilter.toLowerCase())) return false;
    if (searchTerm && !q.questionText.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {!onImportQuestion && (
        <div>
          <h2 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Question Bank
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage reusable questions across your department.
          </p>
        </div>
      )}

      {!onImportQuestion && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem' }}>Add New Question to Bank</h3>
          <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea
              className="input-field"
              placeholder="Question statement..."
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              required
              rows="3"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <select className="input-field" value={department} onChange={e => setDepartment(e.target.value)} required>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                className="input-field"
                placeholder="Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="bankCorrectOpt"
                    checked={correctOption === idx}
                    onChange={() => setCorrectOption(idx)}
                  />
                  <input
                    className="input-field"
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={opt.text}
                    onChange={e => {
                      const newOpts = [...options];
                      newOpts[idx].text = e.target.value;
                      setOptions(newOpts);
                    }}
                    required
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content' }}>
              {loading ? 'Adding...' : '➕ Add to Bank'}
            </button>
          </form>
        </div>
      )}

      <div className="glass-card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <input
            className="input-field"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select className="input-field" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: '200px' }}>
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            className="input-field"
            placeholder="Filter by subject"
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            style={{ width: '200px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredQuestions.map(q => (
            <div key={q.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-info">{q.department}</span>
                  <span className="badge badge-neutral">{q.subject}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {onImportQuestion && (
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => onImportQuestion(q)}>
                      + Add to Paper
                    </button>
                  )}
                  {(isSuperAdmin || q.createdById === user?.uid) && (
                    <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDelete(q.id, q.createdById)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p style={{ fontWeight: 500, marginBottom: '1rem' }}>{q.questionText}</p>
              {q.questionImageUrl && (
                <img src={q.questionImageUrl} alt="Question visual" style={{ maxWidth: '100%', maxHeight: '150px', marginBottom: '1rem' }} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                {q.options.map((opt, idx) => (
                  <div key={idx} style={{ 
                    padding: '0.5rem', 
                    background: q.correctOptionIndex === idx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.1)',
                    border: q.correctOptionIndex === idx ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    borderRadius: '4px'
                  }}>
                    <strong>{String.fromCharCode(65 + idx)}.</strong> {opt.text}
                    {opt.imageUrl && <img src={opt.imageUrl} alt="" style={{ height: '30px', display: 'block' }} />}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Added by: {q.createdBy} • {new Date(q.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
          {filteredQuestions.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No questions found in the bank.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuestionBank;
