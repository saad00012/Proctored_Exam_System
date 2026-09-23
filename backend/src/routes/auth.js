const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { verifyToken } = require('../middleware/auth');

// 1. Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    firebaseConnected: !!db,
    timestamp: new Date().toISOString()
  });
});

// 2. Validate email domain and mobile before registration
router.post('/register-check', async (req, res) => {
  const { email, phoneNumber } = req.body;
  if (!email || !phoneNumber) {
    return res.status(400).json({ error: 'Email and phone number are required.' });
  }

  const domain = email.substring(email.lastIndexOf('@') + 1);

  if (!db) {
    const isValid = domain === 'dnyanshree.edu.in';
    return res.json({
      allowed: isValid,
      domain,
      message: isValid ? 'Domain is whitelisted (mock).' : `Registration restricted to dnyanshree.edu.in.`
    });
  }

  try {
    const domainDoc = await db.collection('allowed_domains').doc(domain).get();
    if (domainDoc.exists && domainDoc.data().isActive) {
      return res.json({ allowed: true, domain });
    } else {
      return res.status(400).json({ allowed: false, error: `Email domain @${domain} is not whitelisted or is inactive.` });
    }
  } catch (error) {
    console.error('Error in /register-check:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Create/Update Profile (called after registration in Firebase Auth)
router.post('/create-profile', verifyToken, async (req, res) => {
  const { name, phoneNumber, role, department, semester, prnNumber } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  const email = req.user.email || '';
  const uid = req.user.uid;
  const domain = email.substring(email.lastIndexOf('@') + 1);

  const isAdminAccount = role === 'superadmin' || role === 'admin' || email.toLowerCase().startsWith('admin');
  const isTeacherAccount = role === 'teacher' || role === 'faculty';

  const userProfile = {
    uid,
    name,
    email,
    phoneNumber: phoneNumber || '',
    role: isAdminAccount ? 'superadmin' : (isTeacherAccount ? 'teacher' : 'student'),
    collegeDomain: domain,
    department: isAdminAccount ? 'Administration' : (department || 'Unassigned'),
    semester: isAdminAccount || isTeacherAccount ? 'N/A' : (semester || 'N/A'),
    prnNumber: isAdminAccount || isTeacherAccount ? 'N/A' : (prnNumber ? prnNumber.toUpperCase() : 'N/A'),
    createdAt: new Date().toISOString()
  };

  if (!db) {
    return res.json({
      message: 'Profile created successfully (mock)',
      user: userProfile
    });
  }

  try {
    await db.collection('users').doc(uid).set(userProfile);
    return res.json({
      message: 'Profile created successfully.',
      user: userProfile
    });
  } catch (error) {
    console.error('Error in /create-profile:', error);
    return res.status(500).json({ error: 'Failed to create user profile in database.' });
  }
});

module.exports = router;
