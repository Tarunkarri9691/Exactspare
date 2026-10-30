import express from 'express';
import {
  getSubscriptionConfig,
  getMySubscription,
  submitSubscriptionPayment,
  getAdminSubscriptions,
  verifyAdminSubscription,
  rejectAdminSubscription,
  runAdminManualExpiryCheck
} from '../controllers/subscriptionController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public/General Subscription Configuration
 */
router.get('/config', getSubscriptionConfig);

/**
 * Owner Subscription Routes (Must be authenticated OWNER or ADMIN)
 */
router.get('/my', authenticateUser, authorizeRoles('OWNER', 'ADMIN'), getMySubscription);
router.post('/submit', authenticateUser, authorizeRoles('OWNER', 'ADMIN'), submitSubscriptionPayment);

/**
 * Admin Subscription Verification, Review & Scheduler Routes
 */
router.get('/admin', authenticateUser, authorizeRoles('ADMIN'), getAdminSubscriptions);
router.post('/admin/run-expiry-check', authenticateUser, authorizeRoles('ADMIN'), runAdminManualExpiryCheck);
router.patch('/admin/:id/verify', authenticateUser, authorizeRoles('ADMIN'), verifyAdminSubscription);
router.patch('/admin/:id/reject', authenticateUser, authorizeRoles('ADMIN'), rejectAdminSubscription);

export default router;
