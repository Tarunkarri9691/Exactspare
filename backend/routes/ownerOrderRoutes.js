import express from 'express';
import {
  getOwnerOrders,
  getOwnerOrderById,
  updateOwnerOrderStatus
} from '../controllers/orderController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// All owner order endpoints require authenticated OWNER role
router.use(authenticateUser);
router.use(authorizeRoles('OWNER'));

router.get('/', getOwnerOrders);
router.get('/:orderId', getOwnerOrderById);
router.patch('/:orderId/status', updateOwnerOrderStatus);

export default router;
