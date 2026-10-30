import express from 'express';
import {
  createApplication,
  getMyApplication,
  getApplicationById,
  updateApplication,
  submitApplication,
  getSecureDocument,
  getPaymentScannerConfig,
  payAndActivateApplication
} from '../controllers/shopApplicationController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadShopApplicationFiles } from '../utils/upload.js';

const router = express.Router();

/**
 * All routes require authenticated session
 */
router.use(authenticateUser);

/**
 * Payment Scanner & Instant Direct Activation Endpoints
 */
router.get(
  '/scanner-config',
  getPaymentScannerConfig
);

router.post(
  '/pay-and-activate',
  authorizeRoles('OWNER', 'ADMIN'),
  payAndActivateApplication
);

router.post(
  '/:id/pay-and-activate',
  authorizeRoles('OWNER', 'ADMIN'),
  payAndActivateApplication
);

/**
 * Owner Application Endpoints
 */
router.post(
  '/',
  authorizeRoles('OWNER'),
  uploadShopApplicationFiles,
  createApplication
);

router.get(
  '/my',
  authorizeRoles('OWNER'),
  getMyApplication
);

router.get(
  '/:id',
  getApplicationById
);

router.patch(
  '/:id',
  authorizeRoles('OWNER'),
  uploadShopApplicationFiles,
  updateApplication
);

router.post(
  '/:id/submit',
  authorizeRoles('OWNER'),
  submitApplication
);

router.get(
  '/:id/documents/:filename',
  getSecureDocument
);

export default router;

