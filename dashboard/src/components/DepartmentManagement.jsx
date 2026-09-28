import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

function DepartmentManagement() {
  const {
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    students,
    teachers,
    exams
  } = useApp();

  const [newDeptName, setNewDeptName] = useState('');
  const [editingDept, setEditingDept] = useState(null); // { oldName: '', newName: '' }
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;

    setLoading(true);
    try {
      await addDepartment(name);
      setNewDeptName('');
      showToast(`Department "${name}" added successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDept || !editingDept.newName.trim()) return;

    setLoading(true);
    try {
      await updateDepartment(editingDept.oldName, editingDept.newName.trim());
      showToast(`Department renamed to "${editingDept.newName.trim()}"!`, 'success');
      setEditingDept(null);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deptName) => {
    const studentCount = students.filter(s => (s.department === deptName || s.course === deptName)).length;
    const examCount = exams.filter(e => e.department === deptName).length;

    let warningMsg = `Are you sure you want to delete the "${deptName}" department?`;
    if (studentCount > 0 || examCount > 0) {
      warningMsg += `\n\n⚠️ Caution: There are ${studentCount} student(s) and ${examCount} exam(s) associated with this department.`;
    }

    if (!window.confirm(warningMsg)) return;

    setLoading(true);
    try {
      await deleteDepartment(deptName);
      showToast(`Department "${deptName}" removed.`, 'info');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
      <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🏛️ Academic Departments Management
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
            Add, update, or remove institution branches. Changes automatically sync to student sign-up, exam creation, and faculty settings.
          </p>
        </div>
        <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>
          {departments.length} Active Branches
        </span>
      </div>

      {toast && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 500,
            background: toast.type === 'danger' ? 'rgba(239, 68, 68, 0.15)' : toast.type === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: toast.type === 'danger' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981',
            border: `1px solid ${toast.type === 'danger' ? 'rgba(239,68,68,0.3)' : toast.type === 'info' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`
          }}
        >
          {toast.type === 'danger' ? '⚠️ ' : toast.type === 'info' ? 'ℹ️ ' : '✅ '}
          {toast.message}
        </div>
      )}

      {/* Add Department Form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="input-field"
          placeholder="New Department Name (e.g. Civil Engineering, Information Technology)"
          value={newDeptName}
          onChange={(e) => setNewDeptName(e.target.value)}
          style={{ flex: 1, minWidth: '260px' }}
          disabled={loading}
          required
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !newDeptName.trim()}
          style={{ whiteSpace: 'nowrap', padding: '0.6rem 1.25rem' }}
        >
          ➕ Add Department
        </button>
      </form>

      {/* Departments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {departments.map((dept, index) => {
          const studentCount = students.filter(s => (s.department === dept || s.course === dept)).length;
          const teacherCount = teachers.filter(t => t.department === dept).length;
          const examCount = exams.filter(e => e.department === dept).length;
          const isEditing = editingDept && editingDept.oldName === dept;

          return (
            <div
              key={dept}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                background: 'rgba(0, 0, 0, 0.12)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              {isEditing ? (
                <form onSubmit={handleUpdate} style={{ display: 'flex', gap: '0.5rem', flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={editingDept.newName}
                    onChange={(e) => setEditingDept({ ...editingDept, newName: e.target.value })}
                    style={{ flex: 1, minWidth: '200px', padding: '0.4rem 0.75rem' }}
                    autoFocus
                    disabled={loading}
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !editingDept.newName.trim()}>
                    💾 Save
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingDept(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, width: '24px' }}>
                      #{index + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {dept}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: '0.72rem' }}>
                        👥 {studentCount} student{studentCount !== 1 ? 's' : ''}
                      </span>
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: '0.72rem' }}>
                        👨‍🏫 {teacherCount} faculty
                      </span>
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: '0.72rem' }}>
                        📝 {examCount} exam{examCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex-row" style={{ gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingDept({ oldName: dept, newName: dept })}
                      disabled={loading}
                      title="Rename this department across all dropdowns"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(dept)}
                      disabled={loading || departments.length <= 1}
                      title={departments.length <= 1 ? "Cannot delete the last remaining department" : "Remove department"}
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DepartmentManagement;
