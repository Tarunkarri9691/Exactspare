import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getOwnerOrders,
  getOwnerOrderById,
  updateOwnerOrderStatus
} from '../controllers/orderController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer Order Endpoints
router.post('/', authenticateUser, authorizeRoles('CUSTOMER'), createOrder);
router.get('/my', authenticateUser, authorizeRoles('CUSTOMER'), getMyOrders);
router.get('/:orderId', authenticateUser, getOrderById);
router.post('/:orderId/cancel', authenticateUser, authorizeRoles('CUSTOMER'), cancelOrder);

export default router;
