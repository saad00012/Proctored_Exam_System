const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { verifyToken, isAdmin, isTeacherOrAdmin } = require('../middleware/auth');

// Helper to check if caller has permission over a student target
const canManageUser = (caller, targetUser) => {
  if (isAdmin(caller)) return true;
  if (!isTeacherOrAdmin(caller)) return false;
  // Teachers can only manage students in their assigned department(s)
  if (targetUser.role !== 'student') return false;
  const teacherDepts = Array.isArray(caller.departments) && caller.departments.length > 0
    ? caller.departments
    : (caller.department ? [caller.department] : []);
  if (teacherDepts.includes('All')) return true;
  return teacherDepts.includes(targetUser.department);
};

// Suspend or Unsuspend a user - ADMIN or FACULTY for department students
router.patch('/users/:uid/suspend', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const { suspended } = req.body;

    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'Suspended field must be a boolean.' });
    }

    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const targetData = targetDoc.data();

    if (!canManageUser(req.user, targetData)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this user.' });
    }

    await db.collection('users').doc(uid).update({ 
      suspended: suspended, 
      suspendedAt: suspended ? new Date().toISOString() : null 
    });

    try {
      await admin.auth().updateUser(uid, { disabled: suspended });
    } catch (authErr) {
      console.warn(`Could not update Firebase Auth disabled status for ${uid}:`, authErr.message);
    }

    res.json({ success: true, uid, suspended });
  } catch (error) {
    console.error('Error suspending/unsuspending user:', error);
    res.status(500).json({ error: 'Failed to update suspension status.' });
  }
});

// Manually verify or unverify a user's email - ADMIN or FACULTY for department students
router.patch('/users/:uid/verify-email', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const { emailVerified = true } = req.body;

    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const targetData = targetDoc.data();

    if (!canManageUser(req.user, targetData)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this user.' });
    }

    // 1. Update Firebase Auth record so client authentication passes
    try {
      await admin.auth().updateUser(uid, { emailVerified: Boolean(emailVerified) });
    } catch (authErr) {
      console.warn(`Could not update Firebase Auth emailVerified for ${uid}:`, authErr.message);
    }

    // 2. Update Firestore profile document
    await db.collection('users').doc(uid).update({
      emailVerified: Boolean(emailVerified),
      emailVerifiedAt: emailVerified ? new Date().toISOString() : null,
      emailVerifiedBy: req.user.email || req.user.name || 'Faculty'
    });

    console.log(`[Admin/Faculty] Set emailVerified=${emailVerified} for user ${uid}`);
    res.json({ success: true, uid, emailVerified: Boolean(emailVerified) });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Failed to update email verification status: ' + error.message });
  }
});

// Reusable helper to clear student security lockouts, reset credentials, and clean attempts
const executeClearStudentLockout = async (uid, targetData, caller, options = {}) => {
  const tempPassword = options.newPassword || 'Student@12345';
  let finalLoginEmail = targetData.originalEmail || targetData.email;

  // If alias explicitly requested by teacher/admin
  if (options.useAlias) {
    const nameParts = (targetData.name || 'Student').trim().split(/\s+/);
    const middleInitial = nameParts.length > 2 ? nameParts[1][0].toLowerCase() + '.' : '1.';
    const emailPrefix = finalLoginEmail.split('@')[0];
    const domain = finalLoginEmail.split('@')[1] || 'dnyanshree.edu.in';
    finalLoginEmail = `${emailPrefix.split('.')[0]}.${middleInitial}${emailPrefix.split('.')[1] || 'exam'}@${domain}`;
  } else {
    // Normal / default: restore canonical email and strip any accidental alias artifact
    if (finalLoginEmail.includes('.1.') || finalLoginEmail.includes('.exam@') || finalLoginEmail.includes('.1@')) {
      finalLoginEmail = finalLoginEmail.replace('.1.', '.').replace('.exam@', '@').replace('.1@', '@');
    }
  }

  // 1. Unsuspend and mark verified in Firestore, update email, clean originalEmail if restored
  const userUpdates = {
    suspended: false,
    suspendedAt: null,
    emailVerified: true,
    email: finalLoginEmail,
    lastUnblockedAt: new Date().toISOString(),
    unblockedBy: caller?.email || caller?.name || 'Admin',
  };
  if (!options.useAlias && targetData.originalEmail) {
    userUpdates.originalEmail = admin.firestore.FieldValue.delete();
  } else if (options.useAlias && finalLoginEmail !== targetData.email) {
    userUpdates.originalEmail = targetData.originalEmail || targetData.email;
  }
  await db.collection('users').doc(uid).update(userUpdates);

  // 2. Clear Firebase Auth lockouts, reset password, enable account, revoke refresh tokens
  try {
    await admin.auth().updateUser(uid, {
      disabled: false,
      emailVerified: true,
      email: finalLoginEmail,
      password: tempPassword
    });
    await admin.auth().revokeRefreshTokens(uid);
  } catch (authErr) {
    console.warn(`Could not update Firebase Auth status for ${uid}:`, authErr.message);
    if (authErr.code === 'auth/email-already-exists') {
      try {
        await admin.auth().updateUser(uid, {
          disabled: false,
          emailVerified: true,
          password: tempPassword
        });
        await admin.auth().revokeRefreshTokens(uid);
      } catch (innerErr) {
        console.warn(`Fallback auth update failed for ${uid}:`, innerErr.message);
      }
    }
  }

  // 3. Reset any blocked / failed attempt in Firestore to allow student back into the exam
  const attemptsSnap = await db.collection('exam_attempts')
    .where('studentId', '==', uid)
    .get();

  const batch = db.batch();
  let unblockedAttemptsCount = 0;

  attemptsSnap.forEach(attDoc => {
    const att = attDoc.data();
    if (['blocked_pending_review', 'malpractice_failed', 'exited_on_violation'].includes(att.status)) {
      batch.update(attDoc.ref, {
        status: 'started',
        warnings: 0,
        startedAt: new Date().toISOString(),
        lastUnblockedAt: new Date().toISOString()
      });
      unblockedAttemptsCount++;
    } else if (att.status === 'started' && (att.warnings || 0) > 0) {
      batch.update(attDoc.ref, {
        warnings: 0
      });
    }
  });

  // 4. Clear all proctoring violation logs for this student
  const violSnap = await db.collection('violations')
    .where('studentId', '==', uid)
    .get();
  violSnap.forEach(vDoc => batch.delete(vDoc.ref));

  await batch.commit();

  // 5. Record action in audit logs
  try {
    await db.collection('audit_logs').add({
      timestamp: new Date().toISOString(),
      action: 'clear_student_lockout',
      teacherEmail: caller?.email || 'Admin',
      teacherName: caller?.name || 'Faculty',
      studentId: uid,
      studentName: targetData.name || '',
      details: `Cleared unusual activity (loginEmail: ${finalLoginEmail}), unblocked ${unblockedAttemptsCount} exam session(s), and deleted ${violSnap.size} violation record(s).`
    });
  } catch (_) {}

  return {
    uid,
    loginEmail: finalLoginEmail,
    password: tempPassword,
    unblockedAttemptsCount,
    deletedViolationsCount: violSnap.size
  };
};

// Clear unusual activity / security lockouts for a student - ADMIN or FACULTY for department students
router.post('/users/:uid/clear-unusual-activity', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;

    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const targetData = targetDoc.data();

    if (!canManageUser(req.user, targetData)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this user.' });
    }

    const result = await executeClearStudentLockout(uid, targetData, req.user, {
      newPassword: req.body.newPassword,
      useAlias: Boolean(req.body.useAlias)
    });

    console.log(`[Admin/Faculty] Cleared unusual activity and locks for student ${uid} (${targetData.name}) -> Login: ${result.loginEmail}`);
    res.json({
      success: true,
      uid: result.uid,
      loginEmail: result.loginEmail,
      password: result.password,
      message: `Cleared security locks! Student can now log in using Email: "${result.loginEmail}" and Password: "${result.password}".`
    });
  } catch (error) {
    console.error('Error clearing unusual activity:', error);
    res.status(500).json({ error: 'Failed to clear student security lockouts: ' + error.message });
  }
});

// Quick unblock student by Email, PRN, or UID
router.post('/unblock-student-by-query', verifyToken, async (req, res) => {
  try {
    const { query: rawQuery, newPassword, useAlias } = req.body;
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.status(400).json({ error: 'Please provide a student Email, PRN number, or UID.' });
    }
    const q = rawQuery.trim().toLowerCase();

    let targetDoc = null;
    let targetUid = null;
    let targetData = null;

    // Check direct doc ID
    const directDoc = await db.collection('users').doc(rawQuery.trim()).get();
    if (directDoc.exists) {
      targetDoc = directDoc;
    }

    // Check email
    if (!targetDoc) {
      const emailSnap = await db.collection('users').where('email', '==', rawQuery.trim()).limit(1).get();
      if (!emailSnap.empty) targetDoc = emailSnap.docs[0];
    }
    if (!targetDoc) {
      const emailSnap = await db.collection('users').where('email', '==', q).limit(1).get();
      if (!emailSnap.empty) targetDoc = emailSnap.docs[0];
    }
    // Check originalEmail
    if (!targetDoc) {
      const origSnap = await db.collection('users').where('originalEmail', '==', rawQuery.trim()).limit(1).get();
      if (!origSnap.empty) targetDoc = origSnap.docs[0];
    }
    // Check prnNumber
    if (!targetDoc) {
      const prnSnap = await db.collection('users').where('prnNumber', '==', rawQuery.trim()).limit(1).get();
      if (!prnSnap.empty) targetDoc = prnSnap.docs[0];
    }

    // Fallback: Check Firebase Auth by email
    if (!targetDoc && q.includes('@')) {
      try {
        const authUser = await admin.auth().getUserByEmail(q);
        if (authUser) {
          const authDoc = await db.collection('users').doc(authUser.uid).get();
          if (authDoc.exists) {
            targetDoc = authDoc;
          } else {
            targetUid = authUser.uid;
            targetData = {
              uid: authUser.uid,
              email: authUser.email,
              name: authUser.displayName || authUser.email.split('@')[0],
              role: 'student',
              department: 'All'
            };
            await db.collection('users').doc(targetUid).set(targetData);
            targetDoc = await db.collection('users').doc(targetUid).get();
          }
        }
      } catch (_) {}
    }

    if (!targetDoc) {
      return res.status(404).json({ error: `No student found matching "${rawQuery}". Please verify the Email or PRN.` });
    }

    targetUid = targetDoc.id;
    targetData = targetDoc.data();

    if (!canManageUser(req.user, targetData)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to manage this student.' });
    }

    const result = await executeClearStudentLockout(targetUid, targetData, req.user, {
      newPassword,
      useAlias: Boolean(useAlias)
    });

    res.json({
      success: true,
      uid: result.uid,
      studentName: targetData.name || '',
      loginEmail: result.loginEmail,
      password: result.password,
      message: `Student ${targetData.name || result.loginEmail} unblocked successfully! Email: "${result.loginEmail}", Password: "${result.password}".`
    });
  } catch (error) {
    console.error('Error in unblock-student-by-query:', error);
    res.status(500).json({ error: 'Failed to unblock student: ' + error.message });
  }
});

// Delete a user entirely (Auth + Firestore) - ADMIN or FACULTY for department students
router.delete('/users/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;

    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const targetData = targetDoc.data();

    if (!canManageUser(req.user, targetData)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    // Delete from Firebase Auth (if exists)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        console.log(`User ${uid} not found in Firebase Auth, proceeding to delete from Firestore.`);
      } else {
        throw authErr;
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Batch Delete Students by Department & Optional Semester - ADMIN ONLY
router.post('/users/batch-delete-by-department', verifyToken, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { department, semester, confirm } = req.body;
    if (!department) {
      return res.status(400).json({ error: 'Department is required.' });
    }

    if (confirm !== true && confirm !== 'CONFIRM_DELETE') {
      return res.status(400).json({ error: 'Explicit confirmation required. Pass confirm: "CONFIRM_DELETE".' });
    }

    const usersSnap = await db.collection('users')
      .where('role', '==', 'student')
      .get();

    const matchedStudents = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      const userDept = (data.department || '').trim().toLowerCase();
      const userDepts = (data.departments || []).map(d => String(d).trim().toLowerCase());
      const targetDept = department.trim().toLowerCase();

      const isDeptMatch = 
        userDept === targetDept ||
        userDepts.includes(targetDept) ||
        (targetDept.includes('aids') || targetDept.includes('ai & ds')) &&
        (userDept.includes('ai & ds') || userDept.includes('aids') || userDept.includes('artificial intelligence') ||
         userDepts.some(d => d.includes('ai & ds') || d.includes('aids')));

      let isSemMatch = true;
      if (semester && semester !== 'All') {
        const cleanSem = String(semester).replace(/[^0-9]/g, '');
        const userSem = String(data.semester || '').replace(/[^0-9]/g, '');
        isSemMatch = cleanSem === userSem || String(data.semester).toLowerCase() === String(semester).toLowerCase();
      }

      if (isDeptMatch && isSemMatch) {
        matchedStudents.push({
          uid: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          prn: data.prnNumber || 'N/A',
          semester: data.semester || 'N/A'
        });
      }
    });

    if (matchedStudents.length === 0) {
      return res.json({ success: true, count: 0, message: 'No students found matching the specified filter.' });
    }

    let deletedCount = 0;
    const errors = [];

    for (const student of matchedStudents) {
      try {
        // 1. Delete from Firebase Auth
        try {
          await admin.auth().deleteUser(student.uid);
        } catch (authErr) {
          if (authErr.code !== 'auth/user-not-found') {
            console.warn(`Auth delete error for ${student.uid}:`, authErr.message);
          }
        }

        // 2. Delete from Firestore users
        await db.collection('users').doc(student.uid).delete();

        // 3. Delete linked exam attempts
        const attemptsSnap = await db.collection('exam_attempts').where('studentId', '==', student.uid).get();
        if (!attemptsSnap.empty) {
          const batch = db.batch();
          attemptsSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }

        deletedCount++;
      } catch (err) {
        errors.push({ uid: student.uid, error: err.message });
      }
    }

    // Audit log
    await db.collection('audit_logs').add({
      action: 'batch_delete_students',
      department,
      semester: semester || 'All',
      deletedCount,
      performedBy: req.user.email || req.user.name || 'Admin',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      count: deletedCount,
      message: `Successfully deleted ${deletedCount} student(s) from ${department}.`,
      deletedStudents: matchedStudents.map(s => ({ name: s.name, email: s.email, prn: s.prn, semester: s.semester })),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in batch-delete-by-department:', error);
    res.status(500).json({ error: 'Failed to batch delete students: ' + error.message });
  }
});

// Update a user's profile (Firestore) - ADMIN, SELF, or FACULTY for department students
router.put('/users/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const isSelf = req.user.uid === uid;
    const isUserAdmin = isAdmin(req.user);

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore.' });
    }

    const targetData = userDoc.data();
    const canFacultyManage = canManageUser(req.user, targetData);

    if (!isUserAdmin && !isSelf && !canFacultyManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges. You cannot edit this user profile.' });
    }

    const { name, department, departments, role, email, semester, phoneNumber, prnNumber, preferences } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (department !== undefined) updates.department = department;
    if (departments !== undefined) updates.departments = Array.isArray(departments) ? departments : [departments];
    if (role !== undefined && isUserAdmin) updates.role = role;
    if (email !== undefined && isUserAdmin) updates.email = email;
    if (semester !== undefined) updates.semester = semester;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (prnNumber !== undefined) updates.prnNumber = prnNumber ? prnNumber.toUpperCase() : 'N/A';
    if (preferences !== undefined) updates.preferences = preferences;

    await userRef.update(updates);

    // Also sync name/email to Firebase Auth record
    const authUpdates = {};
    if (name) authUpdates.displayName = name;
    if (email && isUserAdmin) authUpdates.email = email;
    if (Object.keys(authUpdates).length > 0) {
      try {
        await admin.auth().updateUser(uid, authUpdates);
      } catch (authErr) {
        console.warn(`Could not update Firebase Auth for ${uid}:`, authErr.message);
      }
    }

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Create a new user with Firebase Auth + Firestore profile - ADMIN or FACULTY (students only)
router.post('/create-user', verifyToken, async (req, res) => {
  try {
    const isCallerAdmin = isAdmin(req.user);
    const isCallerTeacher = isTeacherOrAdmin(req.user);

    if (!isCallerAdmin && !isCallerTeacher) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { name, email, password, department, departments, role, semester, phoneNumber, prnNumber } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Faculty can ONLY create student accounts in their assigned department(s)
    if (!isCallerAdmin) {
      if (role !== 'student') {
        return res.status(403).json({ error: 'Forbidden: Faculty can only register student accounts.' });
      }
      const teacherDepts = Array.isArray(req.user.departments) && req.user.departments.length > 0
        ? req.user.departments
        : (req.user.department ? [req.user.department] : []);
      if (!teacherDepts.includes('All') && !teacherDepts.includes(department)) {
        return res.status(403).json({ error: `Forbidden: You can only register students for your department (${teacherDepts.join(', ')}).` });
      }
    }

    // Create Firebase Auth account
    const authUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    const uid = authUser.uid;

    const assignedDepts = Array.isArray(departments) && departments.length > 0
      ? departments
      : (department ? [department] : ['Unassigned']);

    // Write Firestore profile
    const userProfile = {
      uid,
      name,
      email,
      role: role === 'student' ? 'student' : (role === 'admin' ? 'superadmin' : 'teacher'),
      department: department || assignedDepts[0] || 'Unassigned',
      departments: assignedDepts,
      semester: semester || 'N/A',
      prnNumber: (prnNumber || 'N/A').toUpperCase(),
      phoneNumber: phoneNumber || '',
      collegeDomain: email.substring(email.lastIndexOf('@') + 1),
      createdAt: new Date().toISOString()
    };

    await db.collection('users').doc(uid).set(userProfile);

    console.log(`[Admin/Faculty] Created new ${userProfile.role} account: ${email} (uid: ${uid})`);
    res.json({ success: true, uid, message: `${userProfile.role} account created successfully.` });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: error.message || 'Failed to create user.' });
  }
});

// Send password reset email OR force-set a new password for a user - ADMIN, SELF, or FACULTY (department students)
router.post('/users/:uid/reset-password', verifyToken, async (req, res) => {
  try {
    const isSelf = req.user.uid === req.params.uid;
    const isUserAdmin = isAdmin(req.user);

    const { uid } = req.params;
    const { mode, newPassword } = req.body;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const targetData = userDoc.data();
    const canFacultyManage = canManageUser(req.user, targetData);

    if (!isUserAdmin && !isSelf && !canFacultyManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { email } = targetData;

    if (mode === 'force') {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      await admin.auth().updateUser(uid, { password: newPassword });
      console.log(`[Security] Updated password for uid: ${uid}`);
      return res.json({ success: true, message: `Password updated successfully for ${email}.` });
    } else {
      const resetLink = await admin.auth().generatePasswordResetLink(email);
      console.log(`[Security] Password reset link generated for ${email}: ${resetLink}`);
      return res.json({
        success: true,
        message: `Password reset link generated for ${email}.`,
        resetLink
      });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
});

// Global exam policies GET
router.get('/policies', verifyToken, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    let defaultDuration = 45;
    let warningThreshold = 3;
    const configDoc = await db.collection('settings').doc('config').get();
    if (configDoc.exists) {
      defaultDuration = configDoc.data().defaultDuration || 45;
      warningThreshold = configDoc.data().warningThreshold || 3;
    }
    res.json({ defaultDuration, warningThreshold });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Global exam policies POST - ADMIN ONLY
router.post('/policies', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can update global exam policies.' });
  }
  const { defaultDuration, warningThreshold } = req.body;
  if (!defaultDuration || !warningThreshold) {
    return res.status(400).json({ error: 'Duration and threshold are required.' });
  }
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    await db.collection('settings').doc('config').set({
      defaultDuration: parseInt(defaultDuration),
      warningThreshold: parseInt(warningThreshold),
      updatedAt: new Date().toISOString()
    });
    res.json({ message: 'Global exam policies updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// App Version & Update Settings GET (Public / Authenticated)
router.get('/app-version', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    const versionDoc = await db.collection('settings').doc('app_version').get();
    if (versionDoc.exists) {
      return res.json(versionDoc.data());
    }
    return res.json({
      minRequiredVersionCode: 1,
      latestVersionCode: 1,
      latestVersionName: '1.0',
      apkDownloadUrl: '',
      releaseNotes: '',
      forceUpdate: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// App Version & Update Settings POST - ADMIN ONLY
router.post('/app-version', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can configure app updates.' });
  }
  const { minRequiredVersionCode, latestVersionCode, latestVersionName, apkDownloadUrl, releaseNotes, forceUpdate } = req.body;
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    const payload = {
      minRequiredVersionCode: parseInt(minRequiredVersionCode) || 1,
      latestVersionCode: parseInt(latestVersionCode) || 1,
      latestVersionName: String(latestVersionName || '1.0').trim(),
      apkDownloadUrl: String(apkDownloadUrl || '').trim(),
      releaseNotes: String(releaseNotes || '').trim(),
      forceUpdate: Boolean(forceUpdate),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email || req.user.uid
    };
    await db.collection('settings').doc('app_version').set(payload, { merge: true });
    res.json({ success: true, message: 'App update policy saved successfully.', settings: payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear All Exam Attempts & Violations - ADMIN ONLY
router.post('/database/clear-attempts', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can clear database entries.' });
  }

  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    let deletedAttempts = 0;
    let deletedViolations = 0;

    // Clear exam_attempts
    const attemptsSnap = await db.collection('exam_attempts').get();
    const batches = [];
    let currentBatch = db.batch();
    let opCount = 0;

    attemptsSnap.forEach(doc => {
      currentBatch.delete(doc.ref);
      opCount++;
      deletedAttempts++;
      if (opCount === 450) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(currentBatch.commit());

    // Clear violations
    const violationsSnap = await db.collection('violations').get();
    currentBatch = db.batch();
    opCount = 0;
    violationsSnap.forEach(doc => {
      currentBatch.delete(doc.ref);
      opCount++;
      deletedViolations++;
      if (opCount === 450) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(currentBatch.commit());

    await Promise.all(batches);

    console.log(`[Admin DB] Cleared ${deletedAttempts} exam attempts and ${deletedViolations} violations.`);
    res.json({
      success: true,
      message: `Database cleaned: Deleted ${deletedAttempts} exam attempt records and ${deletedViolations} violation logs.`,
      deletedAttempts,
      deletedViolations
    });
  } catch (error) {
    console.error('Error in /admin/database/clear-attempts:', error);
    res.status(500).json({ error: 'Failed to clear attempts: ' + error.message });
  }
});

// Clear All Question Papers & Sets - ADMIN ONLY
router.post('/database/clear-papers', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can clear database entries.' });
  }

  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    let deletedPapers = 0;
    let deletedExams = 0;

    const papersSnap = await db.collection('papers').get();
    const batches = [];
    let currentBatch = db.batch();
    let opCount = 0;

    papersSnap.forEach(doc => {
      currentBatch.delete(doc.ref);
      opCount++;
      deletedPapers++;
      if (opCount === 450) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(currentBatch.commit());

    const examsSnap = await db.collection('exams').get();
    currentBatch = db.batch();
    opCount = 0;
    examsSnap.forEach(doc => {
      currentBatch.delete(doc.ref);
      opCount++;
      deletedExams++;
      if (opCount === 450) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(currentBatch.commit());

    await Promise.all(batches);

    console.log(`[Admin DB] Cleared ${deletedPapers} papers and ${deletedExams} exams.`);
    res.json({
      success: true,
      message: `Database cleaned: Deleted ${deletedPapers} question paper sets and ${deletedExams} exams.`,
      deletedPapers,
      deletedExams
    });
  } catch (error) {
    console.error('Error in /admin/database/clear-papers:', error);
    res.status(500).json({ error: 'Failed to clear papers: ' + error.message });
  }
});

// Get Audit Logs - ADMIN ONLY
router.get('/audit-logs', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const limitParam = parseInt(req.query.limit) || 100;
    const action = req.query.action;

    let query = db.collection('audit_logs');
    if (action) {
      query = query.where('action', '==', action);
    }
    query = query.orderBy('timestamp', 'desc').limit(limitParam);

    const snapshot = await query.get();
    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ── Broadcast Notice Endpoints ──────────────────────────────────────────

// GET Active Broadcast Notice (Accessible to Teachers & Admins)
router.get('/broadcast-notice', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });
    const doc = await db.collection('settings').doc('broadcast_notice').get();
    if (doc.exists) {
      return res.json(doc.data());
    }
    return res.json({
      active: false,
      title: '',
      message: '',
      severity: 'info', // 'danger' | 'warning' | 'info' | 'success'
      targetAudience: 'all_faculty',
      updatedAt: null,
      updatedBy: ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Broadcast Notice (SUPER ADMIN ONLY)
router.post('/broadcast-notice', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can publish broadcast notices.' });
  }

  const { active, title, message, severity, targetAudience } = req.body;
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    const payload = {
      active: Boolean(active),
      title: String(title || '').trim(),
      message: String(message || '').trim(),
      severity: ['danger', 'warning', 'info', 'success'].includes(severity) ? severity : 'info',
      targetAudience: targetAudience || 'all_faculty',
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email || req.user.name || 'Admin'
    };

    await db.collection('settings').doc('broadcast_notice').set(payload, { merge: true });

    // Also record in audit log
    try {
      await db.collection('audit_logs').add({
        timestamp: new Date().toISOString(),
        action: payload.active ? 'publish_broadcast_notice' : 'disable_broadcast_notice',
        teacherEmail: req.user.email,
        teacherName: req.user.name || 'Super Admin',
        details: payload.active ? `Published notice: "${payload.title}"` : 'Disabled broadcast notice'
      });
    } catch (_) {}

    res.json({ success: true, message: 'Broadcast notice updated successfully.', notice: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/heal-all-students — Mass self-heal all student accounts, emails, and lockouts
router.post('/heal-all-students', verifyToken, async (req, res) => {
  if (!isTeacherOrAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
  }

  try {
    if (!db || !admin) return res.status(500).json({ error: 'Database or Auth service not initialized.' });

    const usersSnap = await db.collection('users').get();
    let authUsers = [];
    let nextPageToken;
    do {
      const listRes = await admin.auth().listUsers(1000, nextPageToken);
      authUsers.push(...listRes.users);
      nextPageToken = listRes.pageToken;
    } while (nextPageToken);

    const authMap = new Map();
    authUsers.forEach(u => authMap.set(u.uid, u));

    let verifiedCount = 0;
    let enabledCount = 0;
    let normalizedProfiles = 0;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const uid = doc.id;
      let cleanEmail = (data.email || '').trim().toLowerCase();

      // Clean alias artifacts
      if (cleanEmail.includes('.1.') || cleanEmail.includes('.exam@') || cleanEmail.includes('.1@')) {
        cleanEmail = cleanEmail.replace('.1.', '.').replace('.exam@', '@').replace('.1@', '@');
      }
      if (cleanEmail.endsWith('@dnyanshree.edu') && !cleanEmail.endsWith('.edu.in')) {
        cleanEmail += '.in';
      }
      if (cleanEmail.endsWith('.edu.in.edu.in')) {
        cleanEmail = cleanEmail.replace('.edu.in.edu.in', '.edu.in');
      }

      let firestoreUpdates = {};
      if (data.email !== cleanEmail) firestoreUpdates.email = cleanEmail;
      if (data.originalEmail) firestoreUpdates.originalEmail = admin.firestore.FieldValue.delete();
      if (data.emailVerified !== true) firestoreUpdates.emailVerified = true;
      if (data.suspended === true) {
        firestoreUpdates.suspended = false;
        firestoreUpdates.suspendedAt = null;
      }

      if (Object.keys(firestoreUpdates).length > 0) {
        await db.collection('users').doc(uid).update(firestoreUpdates);
        normalizedProfiles++;
      }

      const authUser = authMap.get(uid);
      if (authUser) {
        let authUpdates = {};
        if (!authUser.emailVerified) {
          authUpdates.emailVerified = true;
          verifiedCount++;
        }
        if (authUser.disabled) {
          authUpdates.disabled = false;
          enabledCount++;
        }
        if (Object.keys(authUpdates).length > 0) {
          await admin.auth().updateUser(uid, authUpdates).catch(() => {});
        }
      }
    }

    // Recover stuck attempts
    const stuckSnap = await db.collection('exam_attempts')
      .where('status', 'in', ['blocked_pending_review', 'exited_on_violation'])
      .get();

    let recoveredAttempts = 0;
    if (!stuckSnap.empty) {
      const batch = db.batch();
      stuckSnap.forEach(attDoc => {
        batch.update(attDoc.ref, {
          status: 'started',
          warnings: 0,
          lastHealedAt: new Date().toISOString()
        });
        recoveredAttempts++;
      });
      await batch.commit();
    }

    // Audit log
    try {
      await db.collection('audit_logs').add({
        timestamp: new Date().toISOString(),
        action: 'admin_triggered_heal_all_students',
        teacherEmail: req.user.email,
        teacherName: req.user.name || 'Faculty/Admin',
        details: `Mass healed student accounts: verified ${verifiedCount} auth accounts, enabled ${enabledCount} disabled accounts, updated ${normalizedProfiles} Firestore profiles, and unblocked ${recoveredAttempts} stuck exam attempts.`
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `System self-heal completed: verified ${verifiedCount} auth accounts, enabled ${enabledCount} accounts, normalized ${normalizedProfiles} profiles, and unblocked ${recoveredAttempts} exam sessions.`,
      stats: { verifiedCount, enabledCount, normalizedProfiles, recoveredAttempts }
    });
  } catch (err) {
    console.error('Error during heal-all-students:', err);
    res.status(500).json({ error: 'Failed to complete system self-heal: ' + err.message });
  }
});

// ── Role-Based System Maintenance Endpoints ──────────────────────────────

// GET /admin/maintenance — View current maintenance settings
router.get('/maintenance', verifyToken, async (req, res) => {
  try {
    const { getMaintenanceConfig } = require('../middleware/maintenance');
    const config = await getMaintenanceConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/maintenance — Toggle/Configure System Maintenance (SUPER ADMIN ONLY)
router.post('/maintenance', verifyToken, async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can configure system maintenance mode.' });
  }

  const { enabled, message, estimatedEndTime } = req.body;
  try {
    if (!db) return res.status(500).json({ error: 'Database not connected' });

    const payload = {
      enabled: Boolean(enabled),
      message: String(message || 'System upgrade in progress. Regular services will resume shortly.').trim(),
      estimatedEndTime: String(estimatedEndTime || '').trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email || req.user.name || 'Admin'
    };

    await db.collection('settings').doc('system_maintenance').set(payload, { merge: true });

    // Instantly update in-memory cache
    const { setMaintenanceCache } = require('../middleware/maintenance');
    setMaintenanceCache(payload);

    // Audit log
    try {
      await db.collection('audit_logs').add({
        timestamp: new Date().toISOString(),
        action: payload.enabled ? 'enable_maintenance_mode' : 'disable_maintenance_mode',
        teacherEmail: req.user.email,
        teacherName: req.user.name || 'Super Admin',
        details: payload.enabled 
          ? `Activated Maintenance Mode: Faculty & Students blocked. Message: "${payload.message}"` 
          : 'Deactivated Maintenance Mode: System restored to normal operations for all users.'
      });
    } catch (_) {}

    res.json({
      success: true,
      message: payload.enabled 
        ? '⚠️ System Maintenance Mode ACTIVATED. Faculty & Students are now blocked.' 
        : '✅ System Maintenance Mode DEACTIVATED. System is open to all users.',
      maintenance: payload
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
