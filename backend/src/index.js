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
// General limiter skips all exam endpoints to support shared NAT/hotspots/lab networks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exam routes require individual Firebase Auth tokens; do not rate-limit by IP
    const examPaths = ['/start-exam', '/auto-submit', '/report-violation', '/submit-answer', '/student/results', '/heartbeat', '/papers'];
    return examPaths.some(path => req.path.startsWith(path));
  }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);
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
