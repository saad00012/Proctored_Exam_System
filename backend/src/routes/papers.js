const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { verifyToken } = require('../middleware/auth');

// Endpoint to list all published papers
router.get('/papers', verifyToken, async (req, res) => {
  try {
    let papersList = [];
    if (db) {
      let queryRef = db.collection('papers').where('status', '==', 'published');
      
      // Multi-tenancy filter
      if (req.user.role === 'student' || req.user.role === 'teacher') {
        if (req.user.department && req.user.department !== 'All') {
           queryRef = queryRef.where('department', '==', req.user.department);
        }
      }

      const snap = await queryRef.get();
      snap.forEach(doc => papersList.push({ id: doc.id, ...doc.data() }));
    }

const parseScheduleDate = (dateStr) => {
  if (!dateStr) return null;
  let str = String(dateStr).trim();
  if (!str.includes('Z') && !str.includes('+') && !str.match(/-\d\d:\d\d$/) && !str.includes('GMT')) {
    str = str.replace(' ', 'T');
    if (str.length === 16) str += ':00';
    str += '+05:30'; // Default to Indian Standard Time (IST)
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

    // Schedule Window, Visibility & Semester Filter: students only see papers that are published, visible, and within their time window and semester
    if (req.user.role === 'student') {
      const now = new Date();
      papersList = papersList.filter(paper => {
        if (paper.status !== 'published') return false;
        if (paper.isVisible === false) return false;
        if (paper.isHidden === true) return false;
        if (!paper.isStarted) {
          const sStart = parseScheduleDate(paper.scheduleStart);
          const sEnd = parseScheduleDate(paper.scheduleEnd);
          if (sStart && now < sStart) return false;
          if (sEnd && now > sEnd) return false;
        }
        if (paper.semester && req.user.semester && String(paper.semester) !== String(req.user.semester)) return false;
        return true;
      });
    }

    res.json({ papers: papersList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start an exam session and send FCM to relevant students
router.patch('/papers/:id/start', verifyToken, async (req, res) => {
  try {
    const paperId = req.params.id;
    const { isExam, otp } = req.body;
    
    let docRef, docData;
    if (isExam) {
      docRef = db.collection('exams').doc(paperId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: 'Exam not found' });
      docData = docSnap.data();
      
      await docRef.update({
        isStarted: true,
        examOtp: otp,
        sessionStartedAt: new Date().toISOString(),
        status: 'published',
        isVisible: true,
        isHidden: false
      });
      
      // Update all papers in this exam
      const papersSnap = await db.collection('papers').where('examId', '==', paperId).get();
      const batch = db.batch();
      papersSnap.forEach(p => {
        batch.update(p.ref, {
          isStarted: true,
          examOtp: otp,
          sessionStartedAt: new Date().toISOString(),
          status: 'published',
          isVisible: true,
          isHidden: false
        });
      });
      await batch.commit();
    } else {
      docRef = db.collection('papers').doc(paperId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: 'Paper not found' });
      docData = docSnap.data();
      
      await docRef.update({
        isStarted: true,
        examOtp: otp,
        sessionStartedAt: new Date().toISOString(),
        status: 'published',
        isVisible: true,
        isHidden: false
      });
    }

    // Send FCM notification to students of this department/semester
    try {
      const { admin } = require('../firebase'); 
      const paper = docData; 
      // Get all students in the department
      const studentsSnap = await db.collection('users')
        .where('role', '==', 'student')
        .where('department', '==', paper.department)
        .where('semester', '==', paper.semester || 'Semester 7')
        .get();
      
      const tokens = [];
      studentsSnap.forEach(s => { if (s.data().fcmToken) tokens.push(s.data().fcmToken); });
      
      if (tokens.length > 0) {
        // Send in batches of 500 (FCM limit)
        for (let i = 0; i < tokens.length; i += 500) {
          const batch = tokens.slice(i, i + 500);
          await admin.messaging().sendEachForMulticast({
            tokens: batch,
            notification: {
              title: `📝 Exam Started: ${paper.subject || paper.title || paper.name}`,
              body: `Your ${paper.department} exam is now open. Enter the OTP from your teacher to begin.`
            },
            android: {
              priority: 'high',
              notification: { channelId: 'exam_alerts' }
            }
          });
        }
      }
    } catch (fcmErr) {
      console.warn('FCM notification failed (non-critical):', fcmErr.message);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
