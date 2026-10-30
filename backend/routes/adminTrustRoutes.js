import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  getTrustSummary,
  getTrustCases,
  getTrustCaseDetails,
  updateTrustCaseStatus,
  executeTrustAction,
  generateAiAdvisoryForCase,
  triggerPlatformScan
} from '../controllers/adminTrustController.js';

const router = express.Router();

// Strict Admin-only middleware
router.use(authenticateUser, authorizeRoles('ADMIN'));

router.get('/summary', getTrustSummary);
router.get('/cases', getTrustCases);
router.get('/cases/:caseId', getTrustCaseDetails);
router.patch('/cases/:caseId/status', updateTrustCaseStatus);
router.post('/cases/:caseId/actions', executeTrustAction);
router.post('/cases/:caseId/generate-ai-advisory', generateAiAdvisoryForCase);
router.post('/scan', triggerPlatformScan);

export default router;
