import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import {
  fetchAdminUsers,
  fetchAdminUserDetails,
  updateAdminUserStatus
} from '../services/api';
import './AdminUsersPage.css';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Suspension / Reactivation Modal State
  const [targetUser, setTargetUser] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // User Details Modal State
  const [viewUser, setViewUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadUsers = async (page = 1) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 10 };
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.accountStatus = statusFilter;

    const res = await fetchAdminUsers(params);
    if (res.success) {
      setUsers(res.data);
      setPagination(res.pagination);
    } else {
      setError(res.error || 'Failed to load user accounts');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers(1);
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers(1);
  };

  const handleOpenStatusModal = (user) => {
    setTargetUser(user);
    setActionReason('');
  };

  const handleConfirmStatusToggle = async () => {
    if (!targetUser) return;
    const isSuspending = targetUser.accountStatus !== 'SUSPENDED';

    if (isSuspending && !actionReason.trim()) {
      setError('Please provide a reason for suspending this user account.');
      return;
    }

    setActionSubmitting(true);
    const newStatus = isSuspending ? 'SUSPENDED' : 'ACTIVE';
    const res = await updateAdminUserStatus(targetUser._id, newStatus, actionReason.trim());

    if (res.success) {
      setSuccessMsg(
        `User account "${targetUser.name}" was successfully ${isSuspending ? 'suspended' : 'reactivated'}.`
      );
      setTargetUser(null);
      loadUsers(pagination.page);
    } else {
      setError(res.error || 'Failed to update user account status.');
    }
    setActionSubmitting(false);
  };

  const handleInspectUser = async (user) => {
    setViewUser(user);
    setDetailsLoading(true);
    setUserDetails(null);

    const res = await fetchAdminUserDetails(user._id);
    if (res.success) {
      setUserDetails(res.data);
    } else {
      setError(res.error || 'Failed to fetch user details.');
    }
    setDetailsLoading(false);
  };

  return (
    <div className="admin-users-page">
      <AdminNav />

      <div className="container admin-users-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">User Account Management</h1>
            <p className="admin-page-subtitle">
              Manage platform customers, shop owners, and administrators with strict security & audit controls.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => loadUsers(pagination.page)} disabled={loading}>
            🔄 Refresh Users
          </button>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div className="admin-alert alert-error">
            <span>⚠️</span> {error}
            <button className="alert-close" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="admin-alert alert-success">
            <span>✅</span> {successMsg}
            <button className="alert-close" onClick={() => setSuccessMsg('')}>✕</button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="admin-filter-bar">
          <form className="admin-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by full name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Search
            </button>
          </form>

          <div className="admin-filter-selectors">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Platform Roles</option>
              <option value="CUSTOMER">Customers</option>
              <option value="OWNER">Shop Owners</option>
              <option value="ADMIN">Administrators</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Account Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* User Table Card */}
        <div className="admin-card table-card">
          {loading ? (
            <div className="admin-loading-state">
              <span className="spinner">⌛</span> Loading user profiles...
            </div>
          ) : users.length === 0 ? (
            <div className="admin-empty-state">
              <span>👥</span>
              <h3>No Users Found</h3>
              <p>No user accounts match your query parameters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User & Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSuspended = u.accountStatus === 'SUSPENDED';
                    return (
                      <tr key={u._id}>
                        <td>
                          <div className="user-name-cell">
                            <strong>{u.name}</strong>
                            <span className="subtext">{u.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className="phone-cell">{u.phone || '—'}</span>
                        </td>
                        <td>
                          <span className={`role-badge role-${(u.role || '').toLowerCase()}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isSuspended ? 'status-suspended' : 'status-active'}`}>
                            {u.accountStatus || 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <span className="date-cell">
                            {new Date(u.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="action-buttons-cell">
                            <button
                              className="btn btn-sm btn-ghost inspect-btn"
                              onClick={() => handleInspectUser(u)}
                              title="View Account Details"
                            >
                              👁️ Details
                            </button>

                            <button
                              className={`btn btn-sm ${isSuspended ? 'btn-success-outline' : 'btn-danger-outline'}`}
                              onClick={() => handleOpenStatusModal(u)}
                            >
                              {isSuspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="admin-pagination">
              <span className="pagination-info">
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total accounts)
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => loadUsers(pagination.page - 1)}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadUsers(pagination.page + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Suspend / Reactivate Modal */}
        {targetUser && (
          <div className="modal-backdrop" onClick={() => setTargetUser(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {targetUser.accountStatus === 'SUSPENDED'
                    ? 'Reactivate User Account'
                    : 'Suspend User Account'}
                </h3>
                <button className="modal-close-btn" onClick={() => setTargetUser(null)}>✕</button>
              </div>

              <div className="modal-body">
                <p>
                  Are you sure you want to{' '}
                  {targetUser.accountStatus === 'SUSPENDED' ? 'reactivate' : 'suspend'} the account of{' '}
                  <strong>"{targetUser.name}"</strong> ({targetUser.email})?
                </p>

                {targetUser.role === 'ADMIN' && (
                  <p className="warning-note">
                    ⚠️ You are performing an action on an Administrator. If this is the last active administrator on the platform, the action will be blocked by system security rules.
                  </p>
                )}

                {targetUser.accountStatus !== 'SUSPENDED' ? (
                  <p className="warning-note">
                    ⚠️ Suspending an account will revoke active access and invalidate login sessions. All historical orders and transactional receipts are preserved.
                  </p>
                ) : (
                  <p className="info-note">
                    ℹ️ Reactivating this account will allow the user to log in and use EXACTSPARE normally.
                  </p>
                )}

                <div className="form-group">
                  <label htmlFor="user-action-reason">
                    Reason for {targetUser.accountStatus === 'SUSPENDED' ? 'Reactivation' : 'Suspension'}{' '}
                    {targetUser.accountStatus !== 'SUSPENDED' && <span className="required">*</span>}
                  </label>
                  <textarea
                    id="user-action-reason"
                    rows="3"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      targetUser.accountStatus !== 'SUSPENDED'
                        ? 'State the reason (e.g., fraudulent transactions, terms of service violation)...'
                        : 'Optional clearance or resolution notes...'
                    }
                    className="modal-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setTargetUser(null)}>
                  Cancel
                </button>
                <button
                  className={`btn ${targetUser.accountStatus === 'SUSPENDED' ? 'btn-success' : 'btn-danger'}`}
                  onClick={handleConfirmStatusToggle}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting
                    ? 'Processing...'
                    : targetUser.accountStatus === 'SUSPENDED'
                    ? 'Confirm Reactivation'
                    : 'Confirm Suspension'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Account Details Modal */}
        {viewUser && (
          <div className="modal-backdrop" onClick={() => setViewUser(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>👤 Account Profile: {viewUser.name}</h3>
                <button className="modal-close-btn" onClick={() => setViewUser(null)}>✕</button>
              </div>

              <div className="modal-body">
                {detailsLoading ? (
                  <div className="inspect-loading">Loading account metadata...</div>
                ) : (
                  <div className="user-details-summary">
                    <div className="inspect-meta-grid">
                      <div className="meta-item">
                        <span className="meta-lbl">Full Name</span>
                        <span className="meta-val">{viewUser.name}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Email Address</span>
                        <span className="meta-val">{viewUser.email}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Role</span>
                        <span className="meta-val">{viewUser.role}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Account Status</span>
                        <span className="meta-val">{viewUser.accountStatus || 'ACTIVE'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Phone</span>
                        <span className="meta-val">{viewUser.phone || 'Not Provided'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Registered On</span>
                        <span className="meta-val">
                          {new Date(viewUser.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {viewUser.suspensionReason && (
                        <div className="meta-item full-width deactivation-notice">
                          <span className="meta-lbl">Suspension Reason:</span>
                          <span className="reason-val">{viewUser.suspensionReason}</span>
                        </div>
                      )}
                    </div>

                    {userDetails?.ordersCount !== undefined && (
                      <div className="user-activity-stat">
                        <span>📦 Total Platform Orders: <strong>{userDetails.ordersCount}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setViewUser(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
