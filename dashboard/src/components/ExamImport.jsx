import React, { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEPARTMENTS = [
  'AI & DS Engineering',
  'Computer Science & Engineering',
  'Electrical & Computer Engineering',
  'Electronics & Telecommunication Engineering',
  'Mechanical & Mechatronics Engineering',
  'Applied Science & Engineering',
];

const SET_NAMES = ['Set A', 'Set B', 'Set C', 'Set D'];

function ExamImport({ onClose, onImported }) {
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDownloadTemplate = async () => {
    setLoading(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Proctored Exam System';

      const info = wb.addWorksheet('Exam Info');
      info.columns = [{ width: 36 }, { width: 48 }];

      const r1 = info.addRow(['EXAM CONFIGURATION — Fill Column B only', '']);
      r1.height = 26;
      ['A1', 'B1'].forEach(addr => {
        const c = info.getCell(addr);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        c.alignment = { vertical: 'middle' };
      });

      const r2 = info.addRow(['Yellow cells are editable. Do NOT rename sheets.', '']);
      ['A2','B2'].forEach(addr => {
        info.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
      r2.getCell(1).font = { italic: true, color: { argb: 'FF888888' }, size: 10 };

      const LABEL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      const INPUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      const INPUT_BORDER = { bottom: { style: 'medium', color: { argb: 'FFBFBFBF' } } };

      const addInfoRow = (label) => {
        const r = info.addRow([label, '']);
        r.height = 22;
        r.getCell(1).font = { bold: true };
        r.getCell(1).fill = LABEL_FILL;
        r.getCell(1).alignment = { vertical: 'middle' };
        r.getCell(2).fill = INPUT_FILL;
        r.getCell(2).border = INPUT_BORDER;
        r.getCell(2).alignment = { vertical: 'middle' };
      };

      addInfoRow('Exam Name *');
      addInfoRow('Subject / Course *');
      addInfoRow('Department * (select from dropdown)');
      addInfoRow('Semester * (select from dropdown)');
      addInfoRow('Duration (minutes) *');
      addInfoRow('Schedule Start (YYYY-MM-DD HH:MM) *');
      addInfoRow('Schedule End   (YYYY-MM-DD HH:MM) *');
      addInfoRow('Total Questions Per Set *');

      info.getCell('B5').dataValidation = {
        type: 'list', allowBlank: false,
        formulae: ['"AI & DS Engineering,Computer Science & Engineering,Electrical & Computer Engineering,Electronics & Telecommunication Engineering,Mechanical & Mechatronics Engineering,Applied Science & Engineering"'],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Invalid Department', error: 'Please select a department from the dropdown.'
      };
      info.getCell('B6').dataValidation = {
        type: 'list', allowBlank: false,
        formulae: ['"Semester 1,Semester 2,Semester 3,Semester 4,Semester 5,Semester 6,Semester 7,Semester 8"'],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Invalid Semester', error: 'Please select a semester from the dropdown.'
      };
      info.getCell('B7').dataValidation = {
        type: 'whole', operator: 'greaterThan', formulae: [0],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Invalid Duration', error: 'Enter a positive whole number (e.g. 45).'
      };
      info.getCell('B10').dataValidation = {
        type: 'whole', operator: 'between', formulae: [1, 200],
        showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Invalid Count', error: 'Must be between 1 and 200.'
      };

      const HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      const HDR_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8FF' } };

      SET_NAMES.forEach(setName => {
        const sheet = wb.addWorksheet(setName);
        sheet.columns = [
          { width: 5 }, { width: 70 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 17 }
        ];
        const hdr = sheet.addRow(['No.', 'Question Text *', 'Option A *', 'Option B *', 'Option C *', 'Option D *', 'Correct (1-4) *']);
        hdr.height = 32;
        hdr.eachCell(cell => {
          cell.fill = HDR_FILL; cell.font = HDR_FONT;
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
        for (let i = 1; i <= 100; i++) {
          const row = sheet.addRow([i, '', '', '', '', '', '']);
          row.height = 20;
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(1).font = { color: { argb: 'FF888888' } };
          row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
          if (i % 2 === 0) {
            [2,3,4,5,6,7].forEach(col => { row.getCell(col).fill = ALT_FILL; });
          }
          row.getCell(7).dataValidation = {
            type: 'list', allowBlank: true, formulae: ['"1,2,3,4"'],
            showErrorMessage: true, errorStyle: 'stop',
            errorTitle: 'Invalid Answer', error: '1=Option A, 2=Option B, 3=Option C, 4=Option D.'
          };
          row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Exam_Import_Template.xlsx';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to generate template: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setErrors([]); setParsedData(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const errs = [];

      const infoSheet = wb.getWorksheet('Exam Info');
      if (!infoSheet) {
        setErrors(['"Exam Info" sheet not found. Use the official template and do not rename sheets.']);
        setLoading(false); return;
      }

      const cell = (row) => { const v = infoSheet.getCell('B' + row).value; return v == null ? '' : String(v).trim(); };
      const examName = cell(3), subject = cell(4), department = cell(5), semester = cell(6);
      const durationRaw = cell(7), scheduleStart = cell(8), scheduleEnd = cell(9), totalQRaw = cell(10);

      if (!examName) errs.push('Exam Name is required (Exam Info B3).');
      if (!subject) errs.push('Subject / Course is required (Exam Info B4).');
      if (!department || !DEPARTMENTS.includes(department))
        errs.push('Department is invalid or not selected from dropdown (Exam Info B5). Got: "' + department + '"');
      if (!semester) errs.push('Semester is required (Exam Info B6).');
      const durationMinutes = parseInt(durationRaw);
      if (!durationRaw || isNaN(durationMinutes) || durationMinutes < 1)
        errs.push('Duration must be a positive number (Exam Info B7).');
      if (!scheduleStart) errs.push('Schedule Start is required (Exam Info B8).');
      if (!scheduleEnd) errs.push('Schedule End is required (Exam Info B9).');
      const totalQPerSet = parseInt(totalQRaw);
      if (!totalQRaw || isNaN(totalQPerSet) || totalQPerSet < 1)
        errs.push('Total Questions Per Set must be a positive number (Exam Info B10).');

      const parsedSets = {};
      for (const setName of SET_NAMES) {
        const sheet = wb.getWorksheet(setName);
        if (!sheet) { errs.push('"' + setName + '" sheet is missing. All 4 sets are required.'); continue; }
        const questions = []; const setErrs = [];
        sheet.eachRow({ includeEmpty: false }, (row, rowIdx) => {
          if (rowIdx === 1) return;
          const qText = row.getCell(2).value?.toString().trim(); if (!qText) return;
          const optA = row.getCell(3).value?.toString().trim() || '';
          const optB = row.getCell(4).value?.toString().trim() || '';
          const optC = row.getCell(5).value?.toString().trim() || '';
          const optD = row.getCell(6).value?.toString().trim() || '';
          const correctNum = parseInt(String(row.getCell(7).value ?? '').trim());
          if (!optA || !optB || !optC || !optD)
            setErrs.push(setName + ' row ' + rowIdx + ': All 4 options are required.');
          if (isNaN(correctNum) || correctNum < 1 || correctNum > 4)
            setErrs.push(setName + ' row ' + rowIdx + ': Correct answer must be 1, 2, 3, or 4.');
          questions.push({
            questionText: qText,
            options: [{ text: optA, imageUrl: null }, { text: optB, imageUrl: null }, { text: optC, imageUrl: null }, { text: optD, imageUrl: null }],
            correctOptionIndex: Math.max(0, (correctNum || 1) - 1)
          });
        });
        if (questions.length === 0) errs.push('"' + setName + '" has no questions. All 4 sets must have at least 1 question.');
        errs.push(...setErrs);
        parsedSets[setName] = questions;
      }

      if (errs.length > 0) { setErrors(errs); setLoading(false); return; }
      setParsedData({ examName, subject, department, semester, durationMinutes, scheduleStart, scheduleEnd, totalQPerSet, sets: parsedSets });
      setStep(2);
    } catch (err) {
      setErrors(['Failed to read Excel file: ' + err.message]);
    } finally { setLoading(false); }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    setLoading(true); setErrors([]);
    try {
      const examRef = await addDoc(collection(db, 'exams'), {
        name: parsedData.examName, subject: parsedData.subject, department: parsedData.department, semester: parsedData.semester,
        durationMinutes: parsedData.durationMinutes, scheduleStart: parsedData.scheduleStart,
        scheduleEnd: parsedData.scheduleEnd, status: 'draft',
        createdAt: new Date().toISOString(), importedFrom: 'excel'
      });
      for (const setName of SET_NAMES) {
        const qs = parsedData.sets[setName]; if (!qs || qs.length === 0) continue;
        const paperRef = await addDoc(collection(db, 'papers'), {
          title: setName, examId: examRef.id, subject: parsedData.subject,
          department: parsedData.department, semester: parsedData.semester, durationMinutes: parsedData.durationMinutes,
          scheduleStart: parsedData.scheduleStart, scheduleEnd: parsedData.scheduleEnd,
          status: 'draft', createdAt: new Date().toISOString()
        });
        await Promise.all(qs.map((q, idx) => addDoc(collection(db, 'questions'), {
          paperId: paperRef.id, questionText: q.questionText, questionImageUrl: null,
          options: q.options, correctOptionIndex: q.correctOptionIndex, order: idx, department: parsedData.department
        })));
      }
      setStep(3); if (onImported) onImported();
    } catch (err) { setErrors(['Import failed: ' + err.message]); }
    finally { setLoading(false); }
  };

  const totalQ = parsedData ? SET_NAMES.reduce((s, n) => s + (parsedData.sets[n]?.length || 0), 0) : 0;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
      <div className="glass-card" style={{ width:'100%', maxWidth:'680px', maxHeight:'90vh', overflowY:'auto', padding:'2rem', position:'relative' }}>
        <div className="flex-between" style={{ marginBottom:'1.5rem' }}>
          <div>
            <h3 style={{ fontSize:'1.35rem', margin:0 }}>📥 Import Exam from Excel</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.82rem', marginTop:'0.3rem' }}>
              {step===1 && 'Download the template, fill it in, then upload.'}
              {step===2 && 'Review the parsed data before saving to Firestore.'}
              {step===3 && 'Import complete!'}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding:'0.4rem 0.8rem' }}>✕ Close</button>
        </div>

        {step === 1 && (
          <div>
            <div style={{ background:'rgba(99,102,241,0.08)', borderRadius:'10px', padding:'1.25rem', marginBottom:'1.5rem', border:'1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ fontWeight:600, marginBottom:'0.5rem' }}>Step 1 — Download the Template</p>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>
                5 sheets: <strong>Exam Info</strong> (with department dropdown + schedule fields) + <strong>Set A, Set B, Set C, Set D</strong>.
                Correct-answer column has a 1–4 dropdown. All 4 sets are mandatory.
              </p>
              <button className="btn btn-primary" onClick={handleDownloadTemplate} disabled={loading}>
                {loading ? '⏳ Generating...' : '📥 Download Excel Template'}
              </button>
            </div>
            <div style={{ background:'rgba(16,185,129,0.08)', borderRadius:'10px', padding:'1.25rem', border:'1px solid rgba(16,185,129,0.2)' }}>
              <p style={{ fontWeight:600, marginBottom:'0.5rem' }}>Step 2 — Upload Filled Template</p>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>Do <strong>not</strong> rename any sheets. Use the Exam Info dropdown for department selection.</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleFileUpload} />
              <button className="btn btn-primary" style={{ background:'linear-gradient(135deg,#10b981,#059669)' }}
                onClick={() => fileInputRef.current?.click()} disabled={loading}>
                {loading ? '⏳ Parsing...' : '📤 Upload & Parse Excel'}
              </button>
            </div>
            {errors.length > 0 && (
              <div style={{ marginTop:'1.25rem', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'1rem' }}>
                <p style={{ fontWeight:600, color:'#ef4444', marginBottom:'0.5rem' }}>❌ Fix these errors and re-upload:</p>
                <ul style={{ margin:0, paddingLeft:'1.25rem' }}>
                  {errors.map((e,i) => <li key={i} style={{ fontSize:'0.85rem', color:'#ef4444', marginBottom:'0.25rem' }}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && parsedData && (
          <div>
            <div style={{ background:'rgba(0,0,0,0.12)', borderRadius:'10px', padding:'1.25rem', marginBottom:'1.25rem' }}>
              <p style={{ fontWeight:600, marginBottom:'0.75rem' }}>📋 Exam Details</p>
              {[['Exam Name', parsedData.examName], ['Subject', parsedData.subject], ['Department', parsedData.department],
                ['Semester', parsedData.semester], ['Duration', parsedData.durationMinutes + ' minutes'], 
                ['Schedule Start', parsedData.scheduleStart], ['Schedule End', parsedData.scheduleEnd], 
                ['Total Questions (all sets)', totalQ]
              ].map(([label, val]) => (
                <div key={label} className="flex-between" style={{ padding:'0.35rem 0', borderBottom:'1px solid var(--border-color)' }}>
                  <span style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{label}</span>
                  <strong style={{ fontSize:'0.9rem' }}>{val}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={{ fontWeight:600, marginBottom:'0.75rem' }}>📄 Paper Sets</p>
              {SET_NAMES.map(setName => {
                const qs = parsedData.sets[setName] || [];
                return (
                  <div key={setName} className="flex-between" style={{ padding:'0.6rem 1rem', background:'rgba(0,0,0,0.1)', borderRadius:'8px', marginBottom:'0.5rem' }}>
                    <span style={{ fontWeight:500 }}>{setName}</span>
                    <span className={'badge ' + (qs.length > 0 ? 'badge-success' : 'badge-danger')}>
                      {qs.length} question{qs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            {errors.length > 0 && (
              <div style={{ marginBottom:'1.25rem', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'1rem' }}>
                <p style={{ fontWeight:600, color:'#ef4444', marginBottom:'0.5rem' }}>❌ Import errors:</p>
                {errors.map((e,i) => <p key={i} style={{ fontSize:'0.85rem', color:'#ef4444', margin:'0.2rem 0' }}>{e}</p>)}
              </div>
            )}
            <div className="flex-row" style={{ gap:'0.75rem' }}>
              <button className="btn btn-primary" onClick={handleConfirmImport} disabled={loading} style={{ flex:1 }}>
                {loading ? '⏳ Importing...' : '✅ Confirm & Import to Firestore'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setErrors([]); setParsedData(null); }} disabled={loading}>← Back</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign:'center', padding:'2rem 0' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>✅</div>
            <h4 style={{ fontSize:'1.2rem', marginBottom:'0.5rem' }}>Import Successful!</h4>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', marginBottom:'1.5rem' }}>
              Exam "<strong>{parsedData?.examName}</strong>" created with {SET_NAMES.filter(n => parsedData?.sets[n]?.length > 0).length} paper sets and {totalQ} total questions.
              All sets are saved as <em>draft</em> — publish each one when ready.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Go to Papers List</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExamImport;
