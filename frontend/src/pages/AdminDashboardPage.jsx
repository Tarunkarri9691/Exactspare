import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  fetchAdminDashboardData, 
  fetchAdminUsersList, 
  fetchAdminApplications 
} from '../services/api';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAdminData = async () => {
      setLoading(true);
      setError(null);

      const [statsRes, usersRes, appsRes] = await Promise.all([
        fetchAdminDashboardData(),
        fetchAdminUsersList(),
        fetchAdminApplications({ status: 'PENDING', limit: 1 })
      ]);

      if (statsRes.success) {
        setStats(statsRes.data?.stats);
      } else {
        setError(statsRes.error);
      }

      if (usersRes.success) {
        setUsersList(usersRes.data || []);
      }

      if (appsRes.success) {
        setPendingAppsCount(appsRes.data?.stats?.pending ?? 0);
      }

      setLoading(false);
    };

    loadAdminData();
  }, []);

  return (
    <div className="dashboard-page-root">
      <div className="container dashboard-container">
        {/* Welcome Header */}
        <div className="dashboard-welcome-card admin-welcome-card">
          <div className="welcome-info">
            <div className="welcome-badge-row">
              <span className="badge badge-info">Role: {user?.role}</span>
              <span className="badge badge-success">Security State: INITIALIZED VIA CLI</span>
            </div>
            <h1 className="welcome-title">Administrative Operations Center</h1>
            <p className="welcome-subtitle">
              Welcome, {user?.name}. Manage platform integrity, user roles, and vendor verification.
            </p>
          </div>
          <div className="user-contact-mini">
            <div className="contact-detail-item">
              <span className="contact-label">Admin Email:</span>
              <span className="contact-val">{user?.email}</span>
            </div>
            <div className="contact-detail-item">
              <span className="contact-label">Status:</span>
              <span className="contact-val">{user?.accountStatus || 'ACTIVE'}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="auth-alert error-alert">
            <span>{error}</span>
          </div>
        )}

        {/* Module 3 Active Hero Banner: Shop Application Reviews */}
        <div className="admin-governance-card active-module-banner fade-in">
          <div className="governance-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          </div>
          <div className="governance-content">
            <div className="governance-title-row">
              <h3>Shop-Owner Application Reviews & Compliance Center</h3>
              {pendingAppsCount > 0 ? (
                <span className="badge badge-orange">{pendingAppsCount} Awaiting Review</span>
              ) : (
                <span className="badge badge-success">All Applications Reviewed</span>
              )}
            </div>
            <p>
              Inspect submitted merchant applications, verify physical storefront photos and OpenStreetMap coordinates, download private trade license documents, and issue binding approvals, rejections, or correction requests.
            </p>
            <div className="governance-action-row">
              <Link to="/admin/applications" className="btn btn-primary" id="open-compliance-center-btn">
                Open Applications Review Queue →
              </Link>
              <span className="subtext">
                Approved merchants are automatically activated and made discoverable to customers.
              </span>
            </div>
          </div>
        </div>

        {/* Real Live Database Statistics */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Live User Spectrum Statistics</h2>
            <span className="badge badge-navy">MongoDB Real-Time</span>
          </div>

          <div className="stats-metric-grid">
            <div className="metric-card">
              <div className="metric-label">Total Accounts</div>
              <div className="metric-value">{loading ? '...' : stats?.totalUsers ?? usersList.length}</div>
              <div className="metric-footer">MongoDB Registered Entities</div>
            </div>

            <div className="metric-card customer-border">
              <div className="metric-label">Registered Customers</div>
              <div className="metric-value">{loading ? '...' : stats?.customers ?? 0}</div>
              <div className="metric-footer">Vehicle owners & parts buyers</div>
            </div>

            <div className="metric-card owner-border">
              <div className="metric-label">Registered Shop Owners</div>
              <div className="metric-value">{loading ? '...' : stats?.shopOwners ?? 0}</div>
              <div className="metric-footer">Retailers on platform</div>
            </div>

            <div className="metric-card admin-border">
              <div className="metric-label">Platform Admins</div>
              <div className="metric-value">{loading ? '...' : stats?.administrators ?? 1}</div>
              <div className="metric-footer">CLI-initialized governance accounts</div>
            </div>
          </div>
        </div>

        {/* Real Database Users Table */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>System Accounts Registry</h2>
            <span className="badge badge-orange">Authentic Database Records</span>
          </div>

          <div className="admin-table-container">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center-cell">Loading accounts...</td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center-cell">No users registered yet.</td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u._id}>
                      <td className="user-name-cell">
                        <strong>{u.name}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone}</td>
                      <td>
                        <span className={`badge-role-tag role-${u.role.toLowerCase()}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success status-pill">
                          {u.accountStatus || 'ACTIVE'}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
