import express from 'express';
import {
  getAdminApplications,
  getAdminApplicationById,
  decideApplication
} from '../controllers/adminApplicationController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All admin application routes require authenticated ADMIN role
 */
router.use(authenticateUser);
router.use(authorizeRoles('ADMIN'));

router.get('/', getAdminApplications);
router.get('/:id', getAdminApplicationById);
router.patch('/:id/decision', decideApplication);

export default router;
