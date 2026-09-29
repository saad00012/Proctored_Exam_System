// Centralized API configuration for the dashboard
// Uses VITE_API_URL environment variable with fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://proctored-exam-system-3z35.onrender.com';

export default API_BASE_URL;
