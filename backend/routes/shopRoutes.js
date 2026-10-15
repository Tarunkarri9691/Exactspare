import express from 'express';
import {
  getPublicShops,
  getPublicShopById,
  getMyApprovedShop,
  updateMyShop,
  uploadMyShopImages,
  updateShopStatusAdmin
} from '../controllers/shopController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadShopImages } from '../utils/upload.js';

const router = express.Router();

// Owner Protected Routes (Must be declared before :id to prevent conflict)
router.get(
  '/my',
  authenticateUser,
  authorizeRoles('OWNER'),
  getMyApprovedShop
);

router.patch(
  '/my',
  authenticateUser,
  authorizeRoles('OWNER'),
  updateMyShop
);

router.post(
  '/my/images',
  authenticateUser,
  authorizeRoles('OWNER'),
  uploadShopImages,
  uploadMyShopImages
);

// Admin Shop Governance
router.patch(
  '/:id/status',
  authenticateUser,
  authorizeRoles('ADMIN'),
  updateShopStatusAdmin
);

// Public Shop Discovery Routes
router.get('/', getPublicShops);
router.get('/:id', getPublicShopById);

export default router;
