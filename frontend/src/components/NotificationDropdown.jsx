import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import './NotificationDropdown.css';

const NotificationDropdown = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    onClose();

    // Navigate to related resource
    if (notif.relatedOrderId) {
      if (user?.role === 'SHOP_OWNER') {
        navigate('/owner/orders');
      } else {
        navigate('/notifications');
      }
    } else if (notif.type.includes('SHOP')) {
      navigate('/owner/shop');
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

  const formatRelativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="notif-dropdown" ref={dropdownRef}>
      <div className="notif-dropdown-header">
        <div className="notif-header-title">
          <h4>Notifications</h4>
          {unreadCount > 0 && <span className="notif-unread-tag">{unreadCount} new</span>}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-mark-all-btn"
            onClick={markAllAsRead}
            title="Mark all as read"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="notif-dropdown-body">
        {notifications.length === 0 ? (
          <div className="notif-empty-state">
            <span className="notif-empty-icon">🔔</span>
            <p className="notif-empty-text">No notifications yet</p>
            <span className="notif-empty-sub">We'll alert you about order status and updates</span>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.slice(0, 5).map((notif) => (
              <li
                key={notif._id}
                className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
              >
                <div
                  className="notif-item-content"
                  onClick={() => handleNotificationClick(notif)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="notif-type-icon">{getNotificationIcon(notif.type)}</span>
                  <div className="notif-text-wrap">
                    <div className="notif-title-row">
                      <strong className="notif-title">{notif.title}</strong>
                      <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                    </div>
                    <p className="notif-message">{notif.message}</p>
                  </div>
                  {!notif.isRead && <span className="notif-unread-dot" title="Unread" />}
                </div>

                <div className="notif-item-actions">
                  {!notif.isRead && (
                    <button
                      type="button"
                      className="notif-action-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif._id);
                      }}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-action-icon-btn delete-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif._id);
                    }}
                    title="Delete notification"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="notif-dropdown-footer">
        <Link to="/notifications" onClick={onClose} className="notif-view-all-link">
          View All Notifications →
        </Link>
      </div>
    </div>
  );
};

export default NotificationDropdown;
