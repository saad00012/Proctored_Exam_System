const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Delete a user entirely (Auth + Firestore) - ADMIN ONLY
router.delete('/users/:uid', verifyToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges. Only administrators can delete users.' });
    }

    const { uid } = req.params;

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

// Update a user's profile (Firestore) - ADMIN or SELF
router.put('/users/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const isSelf = req.user.uid === uid;
    const isUserAdmin = isAdmin(req.user);

    if (!isUserAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges. You cannot edit other users profiles.' });
    }

    const { name, department, role, email, semester, phoneNumber, prnNumber, preferences } = req.body;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (department !== undefined) updates.department = department;
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

// Create a new user with Firebase Auth + Firestore profile - ADMIN ONLY
router.post('/create-user', verifyToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges. Only administrators can create users.' });
    }

    const { name, email, password, department, role, semester, phoneNumber, prnNumber } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Create Firebase Auth account
    const authUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    const uid = authUser.uid;

    // Write Firestore profile
    const userProfile = {
      uid,
      name,
      email,
      role: role === 'student' ? 'student' : 'teacher',
      department: department || 'Unassigned',
      semester: semester || 'N/A',
      prnNumber: (prnNumber || 'N/A').toUpperCase(),
      phoneNumber: phoneNumber || '',
      collegeDomain: email.substring(email.lastIndexOf('@') + 1),
      createdAt: new Date().toISOString()
    };

    await db.collection('users').doc(uid).set(userProfile);

    console.log(`[Admin] Created new ${userProfile.role} account: ${email} (uid: ${uid})`);
    res.json({ success: true, uid, message: `${userProfile.role} account created successfully.` });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: error.message || 'Failed to create user.' });
  }
});

// Send password reset email OR force-set a new password for a user - ADMIN or SELF
router.post('/users/:uid/reset-password', verifyToken, async (req, res) => {
  try {
    const isSelf = req.user.uid === req.params.uid;
    const isUserAdmin = isAdmin(req.user);

    if (!isUserAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { uid } = req.params;
    const { mode, newPassword } = req.body;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const { email } = userDoc.data();

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

module.exports = router;
