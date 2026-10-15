import express from 'express';
import { register, login, logout, getMe } from '../controllers/authController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Public Authentication Routes (Rate limited)
 */
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

/**
 * Protected Authentication Routes
 */
router.get('/me', authenticateUser, getMe);

export default router;
