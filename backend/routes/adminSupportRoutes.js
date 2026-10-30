import express from 'express';
import {
  getAllTicketsAdmin,
  updateTicketStatusAdmin,
  replyTicketAdmin,
  assignTicketAdmin,
  getTicketById
} from '../controllers/supportController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin Support Dashboard Endpoints
router.use(authenticateUser, authorizeRoles('ADMIN'));

router.get('/tickets', getAllTicketsAdmin);
router.get('/tickets/:ticketId', getTicketById);
router.patch('/tickets/:ticketId/status', updateTicketStatusAdmin);
router.post('/tickets/:ticketId/messages', replyTicketAdmin);
router.patch('/tickets/:ticketId/assign', assignTicketAdmin);

export default router;
