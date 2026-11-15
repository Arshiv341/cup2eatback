const express = require('express');
const router = express.Router();
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Standard Authentication Routes (POST)
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Informative 405 Method Not Allowed handlers for browser / GET requests to POST-only endpoints
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'The login endpoint requires an HTTP POST request with JSON payload { email, password }. HTTP GET is not supported.',
    endpoint: '/api/auth/login',
    expectedMethod: 'POST',
  });
});

router.get('/register', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'The register endpoint requires an HTTP POST request with JSON payload { name, email, phone, password }. HTTP GET is not supported.',
    endpoint: '/api/auth/register',
    expectedMethod: 'POST',
  });
});

router.get('/verify-otp', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'The verify-otp endpoint requires an HTTP POST request with JSON payload { email, otp }. HTTP GET is not supported.',
    endpoint: '/api/auth/verify-otp',
    expectedMethod: 'POST',
  });
});

router.get('/forgot-password', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'The forgot-password endpoint requires an HTTP POST request with JSON payload { email }. HTTP GET is not supported.',
    endpoint: '/api/auth/forgot-password',
    expectedMethod: 'POST',
  });
});

module.exports = router;
