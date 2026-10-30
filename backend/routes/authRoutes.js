import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification
} from '../controllers/authController.js';
import { authenticateUser, optionalAuthenticateUser } from '../middleware/authMiddleware.js';
import {
  authLimiter,
  passwordResetLimiter,
  changePasswordLimiter,
  verificationLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Public Authentication Routes (Rate limited)
 */
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

/**
 * Password Recovery & Email Security Routes (Module 14)
 */
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.post('/verify-email', verificationLimiter, verifyEmail);
router.post('/resend-verification', optionalAuthenticateUser, verificationLimiter, resendVerification);

/**
 * Protected Authentication & Account Security Routes
 */
router.get('/me', authenticateUser, getMe);
router.post('/change-password', authenticateUser, changePasswordLimiter, changePassword);

export default router;

