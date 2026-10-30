import express from 'express';
import {
  getPublicParts,
  getPartById,
  getPartByBarcode,
  createPart,
  getMyInventory,
  updatePart,
  deletePart,
  uploadPartImagesAction,
  deletePartImageAction,
  autoFillPartFromImage
} from '../controllers/partController.js';
import { searchNearbyParts } from '../controllers/searchController.js';
import { authenticateUser, authorizeRoles, optionalAuthenticateUser } from '../middleware/authMiddleware.js';
import { uploadPartImages, uploadPartScan } from '../utils/upload.js';

const router = express.Router();

// Auto-fill Part Details from Uploaded Photo
router.post(
  '/auto-fill-from-image',
  authenticateUser,
  authorizeRoles('OWNER'),
  uploadPartScan,
  autoFillPartFromImage
);

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
router.get('/nearby', searchNearbyParts);
router.get('/nearby-parts', searchNearbyParts);
router.get('/barcode/:barcode', getPartByBarcode);
router.get('/:id', optionalAuthenticateUser, getPartById);

export default router;
