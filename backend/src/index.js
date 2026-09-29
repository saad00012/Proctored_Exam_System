const express = require('express');
const cors = require('cors');
require('dotenv').config();

const requestLogger = require('./middleware/logger');
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const violationRoutes = require('./routes/violations');
const paperRoutes = require('./routes/papers');
const teacherRoutes = require('./routes/teacher');
const adminRoutes = require('./routes/admin');
const { startSweepService } = require('./services/sweepService');

const app = express();
const PORT = process.env.PORT || 5000;
const rateLimit = require('express-rate-limit');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://exam.dnyanshree.edu.in',
  'http://exam.dnyanshree.edu.in',
  ...(process.env.DASHBOARD_URL ? [process.env.DASHBOARD_URL] : [])
];

// Standard Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('dnyanshree.edu.in')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());
app.use(requestLogger);

// Root Health Check Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Proctored Exam Backend API',
    timestamp: new Date().toISOString()
  });
});

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

const authExamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);
app.use('/start-exam', authExamLimiter);
app.use('/auto-submit', authExamLimiter);
app.use('/report-violation', authExamLimiter);
app.use('/admin', adminLimiter);

// Mount Routes
app.use('/', authRoutes);
app.use('/', examRoutes);
app.use('/', violationRoutes);
app.use('/', paperRoutes);
app.use('/teacher', teacherRoutes);
app.use('/admin', adminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Background Auto-Submit Sweep
startSweepService(30000);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Proctored Exam API Server running on http://localhost:${PORT}`);
});

module.exports = app;
