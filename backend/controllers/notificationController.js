import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Fetch notifications for current authenticated user with pagination and unread filter
 * @route GET /api/notifications
 * @route GET /api/notifications/my (alias for backward compatibility)
 */
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { recipientId: userId };
    if (req.query.unreadOnly === 'true') {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: userId, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      status: 'ok',
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1
        }
      },
      // Backward-compatible top-level fields for Module 3
      unreadCount,
      notifications
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    next(error);
  }
};

/**
 * Fetch total unread notifications count for current user
 * @route GET /api/notifications/unread-count
 */
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      status: 'ok',
      data: {
        unreadCount
      },
      unreadCount
    });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    next(error);
  }
};

/**
 * Mark a single notification as read (with recipient ownership validation)
 * @route PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid notification ID.'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        status: 'error',
        statusCode: 404,
        message: 'Notification not found or access forbidden.'
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      status: 'ok',
      message: 'Notification marked as read.',
      data: {
        notification,
        unreadCount
      },
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
    const userId = req.user._id || req.user.id;
    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      status: 'ok',
      message: 'All notifications marked as read.',
      data: {
        unreadCount: 0
      }
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    next(error);
  }
};

/**
 * Delete a notification (with recipient ownership validation)
 * @route DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid notification ID.'
      });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      recipientId: userId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        status: 'error',
        statusCode: 404,
        message: 'Notification not found or access forbidden.'
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      status: 'ok',
      message: 'Notification deleted successfully.',
      data: {
        deletedId: id,
        unreadCount
      }
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    next(error);
  }
};
