import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Fetch notifications for current authenticated user
 * @route GET /api/notifications/my
 */
export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false
    });

    res.status(200).json({
      status: 'ok',
      unreadCount,
      notifications
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    next(error);
  }
};

/**
 * Mark a single notification as read
 * @route PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Notification not found.'
      });
    }

    res.status(200).json({
      status: 'ok',
      notification
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    next(error);
  }
};

/**
 * Mark all notifications as read for current user
 * @route PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      status: 'ok',
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    next(error);
  }
};
