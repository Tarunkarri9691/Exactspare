import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminNav.css';

const AdminNav = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navScrollRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Automatically center active tab on mobile/small screens
  useEffect(() => {
    if (navScrollRef.current) {
      const activeEl = navScrollRef.current.querySelector('.admin-subnav-tab.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, []);

  return (
    <nav className="admin-subnav-root" aria-label="Admin portal sub-navigation">
      <div className="container admin-subnav-container">
        <div className="admin-subnav-links" ref={navScrollRef}>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
            end
          >
            <span className="tab-icon">📊</span>
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/admin/analytics"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">📈</span>
            <span>Sales & Reports</span>
          </NavLink>

          <NavLink
            to="/admin/applications"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">📑</span>
            <span>Applications</span>
          </NavLink>

          <NavLink
            to="/admin/subscriptions"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">💳</span>
            <span>Subscriptions</span>
          </NavLink>

          <NavLink
            to="/admin/shops"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">🏬</span>
            <span>Shops</span>
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">👥</span>
            <span>Users</span>
          </NavLink>

          <NavLink
            to="/admin/moderation/parts"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">⚙️</span>
            <span>Parts Moderation</span>
          </NavLink>

          <NavLink
            to="/admin/moderation/reviews"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">⭐</span>
            <span>Reviews</span>
          </NavLink>

          <NavLink
            to="/admin/audit-logs"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">🛡️</span>
            <span>Audit Logs</span>
          </NavLink>

          <NavLink
            to="/admin/support"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">🎧</span>
            <span>Support Tickets</span>
          </NavLink>

          <NavLink
            to="/admin/trust-safety"
            className={({ isActive }) => `admin-subnav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">🛡️</span>
            <span>Trust & Safety</span>
          </NavLink>
        </div>

        <button
          type="button"
          className="admin-subnav-logout-btn"
          onClick={handleLogout}
          id="admin-subnav-logout-btn"
          title="Sign out of Admin Portal"
        >
          <span className="tab-icon">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminNav;
