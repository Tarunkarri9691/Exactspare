import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getOrderTracking
} from '../controllers/orderController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import { orderLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Customer Order Endpoints
router.post('/', authenticateUser, authorizeRoles('CUSTOMER'), orderLimiter, createOrder);
router.get('/my', authenticateUser, authorizeRoles('CUSTOMER'), getMyOrders);
router.get('/:orderId/tracking', authenticateUser, getOrderTracking);
router.get('/:orderId', authenticateUser, getOrderById);
router.post('/:orderId/cancel', authenticateUser, authorizeRoles('CUSTOMER'), cancelOrder);

export default router;

