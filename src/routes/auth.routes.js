const express = require('express');
const {
  register,
  resendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  login,
  logout,
  me,
} = require('../controllers/auth.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const {
  loginRateLimit,
  registerRateLimit,
} = require('../middlewares/rate-limit.middleware');

const router = express.Router();

router.post('/register', registerRateLimit, register);
router.post('/resend-otp', registerRateLimit, resendOtp);
router.post('/verify-otp', registerRateLimit, verifyOtp);
router.post('/forgot-password', registerRateLimit, forgotPassword);
router.post('/reset-password', registerRateLimit, resetPassword);
router.post('/login', loginRateLimit, login);
router.post('/logout', logout);
router.get('/me', optionalAuth, me);

module.exports = router;
