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

module.exports = router;
