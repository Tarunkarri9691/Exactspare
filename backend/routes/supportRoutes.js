import express from 'express';
import {
  createTicket,
  getMyTickets,
  getTicketById,
  replyTicketCustomer
} from '../controllers/supportController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import { supportLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Customer Support Endpoints
router.post('/tickets', authenticateUser, authorizeRoles('CUSTOMER'), supportLimiter, createTicket);
router.get('/tickets/my', authenticateUser, authorizeRoles('CUSTOMER'), getMyTickets);
router.get('/tickets/:ticketId', authenticateUser, getTicketById);
router.post('/tickets/:ticketId/messages', authenticateUser, authorizeRoles('CUSTOMER'), replyTicketCustomer);

export default router;
