import express from 'express';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../controllers/notificationController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication on all notification endpoints
router.use(authenticateUser);

// GET routes
router.get('/', getNotifications);
router.get('/my', getNotifications); // Alias for backward compatibility
router.get('/unread-count', getUnreadNotificationCount);

// PATCH routes
router.patch('/:id/read', markNotificationAsRead);
router.patch('/read-all', markAllNotificationsAsRead);

// DELETE route
router.delete('/:id', deleteNotification);

export default router;
