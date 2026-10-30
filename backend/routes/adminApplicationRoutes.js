import express from 'express';
import {
  getAdminApplications,
  getAdminApplicationById,
  decideApplication,
  getAdminScannerConfig,
  updateAdminScannerConfig,
  verifyApplicationPayment,
  rejectApplicationPayment
} from '../controllers/adminApplicationController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All admin application routes require authenticated ADMIN role
 */
router.use(authenticateUser);
router.use(authorizeRoles('ADMIN'));

router.get('/scanner/config', getAdminScannerConfig);
router.put('/scanner/config', updateAdminScannerConfig);

router.get('/', getAdminApplications);
router.get('/:id', getAdminApplicationById);
router.patch('/:id/decision', decideApplication);
router.patch('/:id/verify-payment', verifyApplicationPayment);
router.patch('/:id/reject-payment', rejectApplicationPayment);

export default router;

