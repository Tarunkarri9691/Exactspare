import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    refreshNotifications({ limit: 50 });
  }, [refreshNotifications]);

  const displayedNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const handleMarkRead = async (id) => {
    const res = await markAsRead(id);
    if (res.success) {
      setActionFeedback({ type: 'success', text: 'Notification marked as read.' });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllAsRead();
    if (res.success) {
      setActionFeedback({ type: 'success', text: 'All notifications marked as read.' });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleDelete = async (id) => {
    const res = await deleteNotification(id);
    if (res.success) {
      setActionFeedback({ type: 'success', text: 'Notification removed.' });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ORDER_DELIVERED':
        return '✓';
      case 'ORDER_SHIPPED':
        return '🚚';
      case 'ORDER_CANCELLED':
        return '✕';
      case 'NEW_ORDER_RECEIVED':
      case 'ORDER_PLACED':
        return '📦';
      case 'SHOP_APPROVED':
        return '🏬';
      case 'SHOP_REJECTED':
      case 'SHOP_CORRECTIONS_REQUIRED':
        return '⚠️';
      case 'NEW_REVIEW_RECEIVED':
        return '⭐';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="notifications-page-root">
      <div className="container notifications-container">
        {/* Page Header */}
        <div className="notifications-header">
          <div className="notif-header-info">
            <h1 className="notif-page-title">
              Notifications
              {unreadCount > 0 && <span className="notif-count-pill">{unreadCount} unread</span>}
            </h1>
            <p className="notif-page-desc">
              Stay informed about order statuses, store updates, and marketplace activities.
            </p>
          </div>

          <div className="notif-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-outline-orange"
                onClick={handleMarkAllRead}
              >
                Mark All as Read
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className={`auth-alert ${actionFeedback.type === 'success' ? 'success-alert' : 'error-alert'}`} style={{ marginBottom: '16px' }}>
            <span>{actionFeedback.text}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="notif-filter-tabs">
          <button
            type="button"
            className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={`notif-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <div className="notif-page-loading">
            <div className="auth-spinner">
              <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
              </svg>
            </div>
            <p>Loading your notifications...</p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="notif-page-empty">
            <span className="notif-big-icon">🔔</span>
            <h3>No {filter === 'unread' ? 'unread ' : ''}notifications found</h3>
            <p>
              {filter === 'unread'
                ? "You're completely caught up! No unread notifications right now."
                : "You don't have any notifications yet. Place an order or update your store to receive updates."}
            </p>
            {user?.role === 'CUSTOMER' && (
              <Link to="/parts" className="btn btn-primary" style={{ marginTop: '16px' }}>
                Browse Spare Parts Catalog
              </Link>
            )}
          </div>
        ) : (
          <div className="notif-cards-list">
            {displayedNotifications.map((n) => (
              <div
                key={n._id}
                className={`notif-card ${n.isRead ? 'read' : 'unread'}`}
              >
                <div className="notif-card-icon-col">
                  <div className="notif-badge-icon">{getNotificationIcon(n.type)}</div>
                </div>

                <div className="notif-card-content">
                  <div className="notif-card-top">
                    <h3 className="notif-card-title">{n.title}</h3>
                    <span className="notif-card-date">{formatDate(n.createdAt)}</span>
                  </div>

                  <p className="notif-card-message">{n.message}</p>

                  {/* Resource action links */}
                  <div className="notif-card-links">
                    {n.relatedOrderId && (
                      <button
                        type="button"
                        className="btn-link-action"
                        onClick={() => {
                          if (!n.isRead) markAsRead(n._id);
                          navigate(`/orders/${n.relatedOrderId}`);
                        }}
                      >
                        View Order Details →
                      </button>
                    )}
                    {n.type.includes('SHOP') && (
                      <button
                        type="button"
                        className="btn-link-action"
                        onClick={() => {
                          if (!n.isRead) markAsRead(n._id);
                          navigate('/owner/shop');
                        }}
                      >
                        View Shop Profile →
                      </button>
                    )}
                  </div>
                </div>

                <div className="notif-card-actions">
                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn-card-action read-action"
                      onClick={() => handleMarkRead(n._id)}
                      title="Mark as read"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-card-action delete-action"
                    onClick={() => handleDelete(n._id)}
                    title="Delete notification"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
