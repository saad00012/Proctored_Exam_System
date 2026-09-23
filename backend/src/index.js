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

// Standard Middlewares
app.use(cors());
app.use(express.json());
app.use(requestLogger);

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
