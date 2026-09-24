/**
 * Exports a beautifully styled, official College Grade Sheet in .xlsx format using ExcelJS.
 */
export async function exportStyledExcelGradeSheet(exam, currentUser = null) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DIET Proctored Examination System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Grade Sheet', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Column definitions with widths
  ws.columns = [
    { width: 8 },  // A: Sr. No.
    { width: 18 }, // B: PRN
    { width: 28 }, // C: Name
    { width: 26 }, // D: Email
    { width: 14 }, // E: Set
    { width: 14 }, // F: Score
    { width: 14 }, // G: Total
    { width: 16 }, // H: Percentage
    { width: 16 }, // I: Grade / Result
    { width: 18 }, // J: Warnings
    { width: 18 }, // K: Status
    { width: 16 }, // L: Time Spent
    { width: 22 }  // M: Submitted At
  ];

  // Colors & Fills
  const NAVY_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  const SUB_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  const META_LABEL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  const META_VAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  const TABLE_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  const ZEBRA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  const PASS_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  const FAIL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

  const THIN_BORDER = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // 1. Top College Header Banner
  ws.mergeCells('A1:M1');
  const r1 = ws.getCell('A1');
  r1.value = 'DNYANSHREE INSTITUTE OF ENGINEERING & TECHNOLOGY';
  r1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15, name: 'Calibri' };
  r1.fill = NAVY_HEADER_FILL;
  r1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 32;

  // 2. Subtitle
  ws.mergeCells('A2:M2');
  const r2 = ws.getCell('A2');
  r2.value = 'OFFICIAL PROCTORED EXAMINATION GRADE SHEET & AUDIT REPORT';
  r2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  r2.fill = SUB_HEADER_FILL;
  r2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // Empty row
  ws.addRow([]);

  // 3. Metadata Table
  const addMetaRow = (l1, v1, l2, v2, l3, v3) => {
    const row = ws.addRow([l1, v1, '', '', l2, v2, '', '', l3, v3, '', '', '']);
    row.height = 20;

    // Merge cells for values
    const rNum = row.number;
    ws.mergeCells(`B${rNum}:D${rNum}`);
    ws.mergeCells(`F${rNum}:H${rNum}`);
    ws.mergeCells(`J${rNum}:M${rNum}`);

    const cA = ws.getCell(`A${rNum}`);
    cA.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
    cA.fill = META_LABEL_FILL;
    cA.border = THIN_BORDER;

    const cB = ws.getCell(`B${rNum}`);
    cB.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    cB.fill = META_VAL_FILL;
    cB.border = THIN_BORDER;

    const cE = ws.getCell(`E${rNum}`);
    cE.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
    cE.fill = META_LABEL_FILL;
    cE.border = THIN_BORDER;

    const cF = ws.getCell(`F${rNum}`);
    cF.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    cF.fill = META_VAL_FILL;
    cF.border = THIN_BORDER;

    const cI = ws.getCell(`I${rNum}`);
    cI.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
    cI.fill = META_LABEL_FILL;
    cI.border = THIN_BORDER;

    const cJ = ws.getCell(`J${rNum}`);
    cJ.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    cJ.fill = META_VAL_FILL;
    cJ.border = THIN_BORDER;
  };

  const participants = exam.participants || [];
  const submittedList = participants.filter(p => p.status === 'submitted' || p.status === 'submitted_reattempt');
  const passedList = submittedList.filter(p => p.percentage >= 40);
  const passRate = submittedList.length > 0 ? Math.round((passedList.length / submittedList.length) * 100) : 0;

  addMetaRow(
    'Subject / Course:', exam.subject || exam.title || 'General Examination',
    'Department:', exam.department || 'All Departments',
    'Semester:', exam.semester || 'N/A'
  );
  addMetaRow(
    'Total Students:', `${participants.length} Enrolled (${submittedList.length} Submitted)`,
    'Pass Rate:', `${passRate}% (${passedList.length} Passed / ${submittedList.length - passedList.length} Failed)`,
    'Exam Duration:', `${exam.durationMinutes || 45} Minutes`
  );
  addMetaRow(
    'Class Average:', `${exam.avgScore || 0}%`,
    'Highest Score:', `${exam.maxScore || 0}%`,
    'Generated By:', `${currentUser?.name || 'Authorized Proctor'} on ${new Date().toLocaleDateString()}`
  );

  // Empty row before table
  ws.addRow([]);

  // 4. Main Data Table Headers
  const tableHeaders = [
    'Sr. No.',
    'PRN Number',
    'Student Name',
    'Student Email',
    'Paper Set',
    'Score',
    'Total Marks',
    'Percentage',
    'Result',
    'Warnings',
    'Status',
    'Time Spent',
    'Submitted At'
  ];

  const headerRow = ws.addRow(tableHeaders);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.fill = TABLE_HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });

  // 5. Data Rows
  participants.forEach((p, idx) => {
    const isSubmitted = p.status === 'submitted' || p.status === 'submitted_reattempt';
    const isPassed = isSubmitted && p.percentage >= 40;
    const resultText = !isSubmitted ? 'INCOMPLETE' : (isPassed ? 'PASSED' : 'FAILED');
    const statusText = p.status === 'blocked_pending_review' ? 'BLOCKED' :
                       p.status === 'malpractice_failed' ? 'MALPRACTICE FAIL' :
                       p.status === 'started' ? 'IN PROGRESS' :
                       p.status === 'submitted_reattempt' ? 'SUBMITTED (RE-ATTEMPT)' :
                       p.status.toUpperCase();

    const m = Math.floor((p.elapsedTime || 0) / 60);
    const s = (p.elapsedTime || 0) % 60;
    const timeSpentStr = `${m}m ${s}s`;

    const submitDateStr = p.submittedAt ? new Date(p.submittedAt).toLocaleString('en-IN') : '—';

    const row = ws.addRow([
      idx + 1,
      p.prnNumber || 'N/A',
      p.studentName,
      p.studentEmail || 'N/A',
      p.paperTitle || 'Set A',
      p.score,
      p.totalQuestions,
      `${p.percentage}%`,
      resultText,
      p.warnings > 0 ? `${p.warnings} Warnings` : '0 (Clean)',
      statusText,
      timeSpentStr,
      submitDateStr
    ]);

    row.height = 20;

    const rowFill = isPassed ? PASS_FILL : (!isSubmitted || p.percentage < 40 ? FAIL_FILL : (idx % 2 === 0 ? ZEBRA_FILL : META_VAL_FILL));

    row.eachCell((cell, colNum) => {
      cell.font = { size: 9.5, name: 'Calibri' };
      cell.border = THIN_BORDER;
      cell.fill = rowFill;

      // Alignments
      if ([1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(colNum)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Special Colors
      if (colNum === 9) { // Result
        cell.font = { bold: true, color: { argb: isPassed ? 'FF059669' : 'FFDC2626' } };
      }
      if (colNum === 10 && p.warnings > 0) { // Warnings
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
      }
    });
  });

  // Empty row before footer signatures
  ws.addRow([]);
  ws.addRow([]);

  // 6. Signatures Row
  const sigRow = ws.addRow([
    '', '___________________________', '', '', '', '___________________________', '', '', '', '___________________________', '', '', ''
  ]);
  sigRow.height = 20;
  ws.mergeCells(`B${sigRow.number}:D${sigRow.number}`);
  ws.mergeCells(`F${sigRow.number}:H${sigRow.number}`);
  ws.mergeCells(`J${sigRow.number}:L${sigRow.number}`);

  const sigTitleRow = ws.addRow([
    '', 'Course Teacher / Invigilator', '', '', '', 'Head of Department (HOD)', '', '', '', 'Principal / Controller of Exam', '', '', ''
  ]);
  sigTitleRow.height = 18;
  ws.mergeCells(`B${sigTitleRow.number}:D${sigTitleRow.number}`);
  ws.mergeCells(`F${sigTitleRow.number}:H${sigTitleRow.number}`);
  ws.mergeCells(`J${sigTitleRow.number}:L${sigTitleRow.number}`);

  [sigRow, sigTitleRow].forEach(r => {
    r.eachCell(c => {
      c.font = { bold: true, size: 9.5, color: { argb: 'FF475569' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // Generate and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `${(exam.subject || 'Exam').replace(/[^a-zA-Z0-9]/g, '_')}_Grade_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an official, print-ready College Grade Sheet in a dedicated printable window (1-Click Print / Save as PDF).
 */
export function printCollegeGradeSheet(exam, currentUser = null) {
  const participants = exam.participants || [];
  const submittedList = participants.filter(p => p.status === 'submitted' || p.status === 'submitted_reattempt');
  const passedList = submittedList.filter(p => p.percentage >= 40);
  const passRate = submittedList.length > 0 ? Math.round((passedList.length / submittedList.length) * 100) : 0;

  const rowsHtml = participants.map((p, idx) => {
    const isSubmitted = p.status === 'submitted' || p.status === 'submitted_reattempt';
    const isPassed = isSubmitted && p.percentage >= 40;
    const resultColor = isPassed ? '#059669' : '#dc2626';
    const resultText = !isSubmitted ? 'INCOMPLETE' : (isPassed ? 'PASSED' : 'FAILED');
    const statusText = p.status === 'blocked_pending_review' ? 'BLOCKED' :
                       p.status === 'malpractice_failed' ? 'MALPRACTICE FAIL' :
                       p.status === 'started' ? 'ACTIVE' :
                       p.status === 'submitted_reattempt' ? 'SUBMITTED (RE)' : 'SUBMITTED';

    return `
      <tr style="background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${p.prnNumber || 'N/A'}</td>
        <td style="font-weight: 600;">${p.studentName}</td>
        <td>${p.studentEmail || 'N/A'}</td>
        <td style="text-align: center;">${p.paperTitle || 'Set A'}</td>
        <td style="text-align: center; font-weight: bold;">${p.score} / ${p.totalQuestions}</td>
        <td style="text-align: center; font-weight: bold;">${p.percentage}%</td>
        <td style="text-align: center; font-weight: bold; color: ${resultColor};">${resultText}</td>
        <td style="text-align: center; color: ${p.warnings > 0 ? '#d97706' : '#10b981'}; font-weight: 600;">
          ${p.warnings > 0 ? `⚠️ ${p.warnings}` : '0 Clean'}
        </td>
        <td style="text-align: center; font-size: 11px;">${statusText}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocked! Please allow pop-ups for this site to generate the printable grade sheet.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${exam.subject || 'Exam'} - Official Grade Sheet</title>
      <style>
        @page {
          size: landscape;
          margin: 15mm 10mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 20px;
          background: #fff;
        }
        .header-box {
          text-align: center;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header-box h1 {
          margin: 0;
          font-size: 20px;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-box h2 {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #475569;
          font-weight: 600;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          background: #f1f5f9;
          padding: 10px 14px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 12px;
        }
        .meta-item strong {
          color: #334155;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-bottom: 24px;
        }
        th {
          background: #0f172a;
          color: #fff;
          padding: 8px 6px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .signatures {
          margin-top: 40px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          text-align: center;
          font-size: 12px;
        }
        .sig-line {
          width: 80%;
          margin: 0 auto 6px auto;
          border-top: 1px solid #64748b;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #1e3a8a; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
          🖨️ Print / Save as PDF
        </button>
        <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
          Close
        </button>
      </div>

      <div class="header-box">
        <h1>Dnyanshree Institute of Engineering & Technology</h1>
        <h2>Department of ${exam.department || 'Engineering'} • Proctored Examination Grade Sheet</h2>
      </div>

      <div class="meta-grid">
        <div class="meta-item"><strong>Subject:</strong> ${exam.subject || exam.title}</div>
        <div class="meta-item"><strong>Department:</strong> ${exam.department || 'N/A'}</div>
        <div class="meta-item"><strong>Semester:</strong> ${exam.semester || 'N/A'}</div>
        <div class="meta-item"><strong>Total Enrolled:</strong> ${participants.length} Students</div>
        <div class="meta-item"><strong>Pass Rate:</strong> ${passRate}% (${passedList.length} Passed)</div>
        <div class="meta-item"><strong>Class Average:</strong> ${exam.avgScore || 0}%</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="width: 120px;">PRN Number</th>
            <th>Student Name</th>
            <th>Email</th>
            <th style="text-align: center;">Set</th>
            <th style="text-align: center;">Score</th>
            <th style="text-align: center;">%</th>
            <th style="text-align: center;">Result</th>
            <th style="text-align: center;">Warnings</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div>
          <div class="sig-line"></div>
          <strong>Course Teacher / Invigilator</strong>
        </div>
        <div>
          <div class="sig-line"></div>
          <strong>Head of Department (HOD)</strong>
        </div>
        <div>
          <div class="sig-line"></div>
          <strong>Principal / Controller of Exam</strong>
        </div>
      </div>

      <script>
        window.onload = function() {
          // Auto-trigger print dialog after render
          setTimeout(function() { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
