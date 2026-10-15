import React from 'react';
import { NavLink } from 'react-router-dom';
import './AdminNav.css';

const AdminNav = () => {
  return (
    <nav className="admin-subnav-root">
      <div className="container admin-subnav-container">
        <div className="admin-subnav-links">
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
        </div>
      </div>
    </nav>
  );
};

export default AdminNav;
