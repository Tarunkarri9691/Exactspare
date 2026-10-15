import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchNotifications as apiFetchNotifications,
  fetchUnreadNotificationCount as apiFetchUnreadCount,
  markNotificationAsRead as apiMarkRead,
  markAllNotificationsAsRead as apiMarkAllRead,
  deleteNotificationApi as apiDeleteNotification
} from '../services/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await apiFetchUnreadCount();
      if (res.success) {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated, user]);

  const loadNotifications = useCallback(async (params = {}) => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetchNotifications(params);
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUnreadCount();
      loadNotifications({ limit: 10 });

      // Poll unread notification count every 45 seconds
      const interval = setInterval(() => {
        loadUnreadCount();
      }, 45000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, user, loadUnreadCount, loadNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      const res = await apiMarkRead(notificationId);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        return { success: true };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await apiMarkAllRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        return { success: true };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const res = await apiDeleteNotification(notificationId);
      if (res.success) {
        const deleted = notifications.find((n) => n._id === notificationId);
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        if (deleted && !deleted.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return { success: true };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        pagination,
        refreshNotifications: loadNotifications,
        refreshUnreadCount: loadUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
