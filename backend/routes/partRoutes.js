import express from 'express';
import {
  getPublicParts,
  getPartById,
  createPart,
  getMyInventory,
  updatePart,
  deletePart,
  uploadPartImagesAction,
  deletePartImageAction
} from '../controllers/partController.js';
import { authenticateUser, authorizeRoles, optionalAuthenticateUser } from '../middleware/authMiddleware.js';
import { uploadPartImages } from '../utils/upload.js';

const router = express.Router();

// Owner Protected Routes (Declared before :id route)
router.get(
  '/my',
  authenticateUser,
  authorizeRoles('OWNER'),
  getMyInventory
);

router.post(
  '/',
  authenticateUser,
  authorizeRoles('OWNER'),
  uploadPartImages,
  createPart
);

router.patch(
  '/:id',
  authenticateUser,
  authorizeRoles('OWNER'),
  uploadPartImages,
  updatePart
);

router.delete(
  '/:id',
  authenticateUser,
  authorizeRoles('OWNER'),
  deletePart
);

router.post(
  '/:id/images',
  authenticateUser,
  authorizeRoles('OWNER'),
  uploadPartImages,
  uploadPartImagesAction
);

router.delete(
  '/:id/images/:imageFilename',
  authenticateUser,
  authorizeRoles('OWNER'),
  deletePartImageAction
);

// Public Parts Discovery Routes
router.get('/', getPublicParts);
router.get('/:id', optionalAuthenticateUser, getPartById);

export default router;
