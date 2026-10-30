import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import {
  fetchAdminSubscriptions,
  verifyAdminSubscription,
  rejectAdminSubscription,
  runAdminManualExpiryCheck
} from '../services/api';
import './AdminSubscriptionsPage.css';

const AdminSubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({ totalAll: 0, pending: 0, active: 0, expiringSoon: 0, expired: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal / Action states
  const [selectedSub, setSelectedSub] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [runningExpiryCheck, setRunningExpiryCheck] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Load subscriptions from backend
  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminSubscriptions({
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        limit: 15
      });

      if (res.success) {
        setSubscriptions(res.subscriptions);
        setPagination(res.pagination);
        setStats(res.stats);
      } else {
        setError(res.error || 'Failed to load subscription payments');
      }
    } catch {
      setError('Network error while querying subscription records');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Handle Verify Payment Action
  const handleVerify = async (subId) => {
    try {
      setVerifying(true);
      setActionNotice('');
      const res = await verifyAdminSubscription(subId);
      if (res.success) {
        setActionNotice(res.data?.message || 'Subscription successfully verified and activated!');
        setShowRejectBox(false);
        loadSubscriptions();
        if (selectedSub && selectedSub._id === subId) {
          setSelectedSub(res.data?.subscription || { ...selectedSub, status: 'ACTIVE' });
        }
      } else {
        setActionNotice(res.error || 'Verification failed');
      }
    } catch {
      setActionNotice('Network error while verifying subscription');
    } finally {
      setVerifying(false);
    }
  };

  // Handle Reject Payment Action
  const handleReject = async () => {
    if (!selectedSub) return;
    if (!rejectReason.trim()) {
      setActionNotice('A specific reason for rejection is required.');
      return;
    }
    try {
      setRejecting(true);
      setActionNotice('');
      const res = await rejectAdminSubscription(selectedSub._id, rejectReason.trim());
      if (res.success) {
        setActionNotice(res.data?.message || 'Payment reference rejected.');
        setShowRejectBox(false);
        setRejectReason('');
        loadSubscriptions();
        setSelectedSub(res.data?.subscription || { ...selectedSub, status: 'PAYMENT_FAILED' });
      } else {
        setActionNotice(res.error || 'Rejection failed');
      }
    } catch {
      setActionNotice('Network error while rejecting payment reference');
    } finally {
      setRejecting(false);
    }
  };

  const handleTriggerExpiryCheck = async () => {
    try {
      setRunningExpiryCheck(true);
      setActionNotice('');
      const res = await runAdminManualExpiryCheck();
      if (res.success) {
        setActionNotice(
          `Subscription expiry tracker executed: Expired ${res.data?.stats?.expiredTransitions || 0}, ` +
          `Reminders dispatched (7d: ${res.data?.stats?.remindersSent?.stage7Days || 0}, ` +
          `3d: ${res.data?.stats?.remindersSent?.stage3Days || 0}, ` +
          `1d: ${res.data?.stats?.remindersSent?.stage1Day || 0}, ` +
          `Exp: ${res.data?.stats?.remindersSent?.stageExpired || 0}), ` +
          `Skipped duplicates: ${res.data?.stats?.skippedDuplicates || 0}`
        );
        loadSubscriptions();
      } else {
        setActionNotice(res.error || 'Failed to run expiry tracker');
      }
    } catch {
      setActionNotice('Network error while running expiry tracker');
    } finally {
      setRunningExpiryCheck(false);
    }
  };

  const openDetailModal = (sub) => {
    setSelectedSub(sub);
    setDetailModalOpen(true);
    setShowRejectBox(false);
    setRejectReason('');
    setActionNotice('');
  };

  // Format Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="admin-status-badge badge-active">✓ ACTIVE</span>;
      case 'PENDING_VERIFICATION':
        return <span className="admin-status-badge badge-pending">⏳ PENDING REVIEW</span>;
      case 'EXPIRED':
        return <span className="admin-status-badge badge-expired">⚠️ EXPIRED</span>;
      case 'PAYMENT_FAILED':
        return <span className="admin-status-badge badge-failed">✕ REJECTED</span>;
      default:
        return <span className="admin-status-badge badge-none">{status}</span>;
    }
  };

  return (
    <div className="admin-subscriptions-root">
      <AdminNav />

      <main className="container admin-subscriptions-container">
        {/* Page Title & Stats */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-title">Shop Owner Subscription Payments</h1>
            <p className="admin-subtitle">
              Inspect, verify, and reconcile shop owner subscription payments, monitor expiring accounts, and track reminder delivery.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleTriggerExpiryCheck}
              disabled={runningExpiryCheck}
              title="Run background subscription expiry tracker and dispatch stage reminders"
              id="admin-run-expiry-check-btn"
            >
              {runningExpiryCheck ? '⏳ Tracking...' : '⚡ Run Expiry Tracker'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={loadSubscriptions}
              title="Refresh database records"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="admin-stats-grid">
          <div
            className={`admin-stat-card ${statusFilter === '' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter(''); setCurrentPage(1); }}
          >
            <span className="stat-label">Total Submissions</span>
            <span className="stat-number">{stats.totalAll}</span>
            <span className="stat-foot">All records in database</span>
          </div>

          <div
            className={`admin-stat-card card-pending ${statusFilter === 'PENDING_VERIFICATION' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter('PENDING_VERIFICATION'); setCurrentPage(1); }}
          >
            <span className="stat-label">Pending Verification</span>
            <span className="stat-number stat-orange">{stats.pending}</span>
            <span className="stat-foot">Awaiting bank reconciliation</span>
          </div>

          <div
            className={`admin-stat-card card-active ${statusFilter === 'ACTIVE' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
          >
            <span className="stat-label">Active Subscriptions</span>
            <span className="stat-number stat-green">{stats.active}</span>
            <span className="stat-foot">Currently live stores</span>
          </div>

          <div
            className={`admin-stat-card card-warning ${statusFilter === 'EXPIRING_SOON' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter('EXPIRING_SOON'); setCurrentPage(1); }}
            style={{ cursor: 'pointer' }}
          >
            <span className="stat-label">Expiring Soon (7d)</span>
            <span className="stat-number stat-orange">{stats.expiringSoon || 0}</span>
            <span className="stat-foot">Expiring within 7 days</span>
          </div>

          <div
            className={`admin-stat-card card-expired ${statusFilter === 'EXPIRED' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter('EXPIRED'); setCurrentPage(1); }}
          >
            <span className="stat-label">Expired</span>
            <span className="stat-number">{stats.expired}</span>
            <span className="stat-foot">Requires renewal</span>
          </div>

          <div
            className={`admin-stat-card card-failed ${statusFilter === 'PAYMENT_FAILED' ? 'active-filter' : ''}`}
            onClick={() => { setStatusFilter('PAYMENT_FAILED'); setCurrentPage(1); }}
          >
            <span className="stat-label">Rejected / Failed</span>
            <span className="stat-number stat-red">{stats.rejected}</span>
            <span className="stat-foot">Invalid or unverified UTR</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="admin-filter-bar">
          <div className="search-input-wrap">
            <input
              type="text"
              className="form-control"
              placeholder="Search by owner name, internal ref, or 12-digit UPI UTR..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="filter-select-wrap">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING_VERIFICATION">Pending Verification Only</option>
              <option value="ACTIVE">Active Subscriptions</option>
              <option value="EXPIRING_SOON">Expiring Soon (Within 7 Days)</option>
              <option value="EXPIRED">Expired Subscriptions</option>
              <option value="PAYMENT_FAILED">Payment Failed / Rejected</option>
            </select>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="admin-action-notice fade-in">
            <span>📢 {actionNotice}</span>
          </div>
        )}

        {/* Subscriptions Table */}
        <div className="admin-table-card">
          {loading ? (
            <div className="admin-table-loading">
              <div className="spinner"></div>
              <p>Querying subscription records...</p>
            </div>
          ) : error ? (
            <div className="admin-table-error">
              <p>⚠️ {error}</p>
              <button type="button" className="btn btn-outline" onClick={loadSubscriptions}>
                Retry
              </button>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="admin-table-empty">
              <span className="empty-icon">💳</span>
              <h3>No Subscription Payments Found</h3>
              <p>No records match your selected filter criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Date & Ref</th>
                    <th>Shop & Owner</th>
                    <th>Plan & Claimed Amount</th>
                    <th>Payment Channel</th>
                    <th>UPI UTR (12 Digits)</th>
                    <th>Current Status</th>
                    <th>Existing Active Sub?</th>
                    <th>Review Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub._id} className={sub.status === 'PENDING_VERIFICATION' ? 'row-pending' : ''}>
                      <td>
                        <div className="date-block">
                          <strong>{new Date(sub.createdAt).toLocaleDateString()}</strong>
                          <code className="table-ref-code">{sub.internalRef}</code>
                        </div>
                      </td>

                      <td>
                        <div className="owner-block">
                          <strong>{sub.shopId?.name || 'Unassigned Shop'}</strong>
                          <span className="owner-email">{sub.ownerId?.email || 'Unknown Owner'}</span>
                          <span className="owner-name">{sub.ownerId?.name || ''}</span>
                        </div>
                      </td>

                      <td>
                        <div className="plan-block">
                          <span className="plan-title">{sub.planName}</span>
                          <strong className="plan-amt">₹{sub.amount} INR</strong>
                          <span className="plan-dur">{sub.billingDurationDays} Days</span>
                        </div>
                      </td>

                      <td>
                        <span className="channel-pill">{sub.paymentMethod || 'UPI_QR'}</span>
                      </td>

                      <td>
                        <code className="utr-block">{sub.paymentUtr || '—'}</code>
                      </td>

                      <td>
                        {renderStatusBadge(sub.status)}
                        {sub.expiryDate && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.3 }}>
                            <div>Exp: <strong>{new Date(sub.expiryDate).toLocaleDateString()}</strong></div>
                            {sub.expiryStageInfo?.isExpiringSoon && (
                              <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
                                ⏳ {sub.expiryStageInfo.daysRemaining === 1 ? 'Expires tomorrow' : `${sub.expiryStageInfo.daysRemaining}d left`}
                              </span>
                            )}
                            {sub.status === 'EXPIRED' && (
                              <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 6px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
                                ✕ Expired
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        {sub.ownerHasActiveSubscription ? (
                          <span className="active-sub-tag">Yes (Active Sub on File)</span>
                        ) : (
                          <span className="no-sub-tag">No (Not active)</span>
                        )}
                      </td>

                      <td>
                        <div className="action-buttons-cell">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => openDetailModal(sub)}
                          >
                            Inspect & Review
                          </button>

                          {sub.status === 'PENDING_VERIFICATION' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-success quick-verify-btn"
                              onClick={() => handleVerify(sub._id)}
                              disabled={verifying}
                              title="Accept payment and unlock shop"
                            >
                              ✓ Accept & Unlock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="admin-pagination-bar">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="page-indicator">
                Page {pagination.page} of {pagination.pages} ({pagination.total} records)
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={currentPage >= pagination.pages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* MODAL: Detailed Inspection & Manual Verification Fallback */}
        {detailModalOpen && selectedSub && (
          <div className="admin-modal-backdrop" onClick={() => setDetailModalOpen(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="modal-category">Payment Inspection</span>
                  <h2 className="modal-title">Subscription Ref: {selectedSub.internalRef}</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setDetailModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {/* Status & Timing summary */}
                <div className="detail-meta-grid">
                  <div className="meta-item">
                    <span className="meta-k">Status:</span>
                    <span className="meta-v">{renderStatusBadge(selectedSub.status)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Plan:</span>
                    <span className="meta-v"><strong>{selectedSub.planName}</strong></span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Claimed Amount:</span>
                    <span className="meta-v"><strong className="price-text">₹{selectedSub.amount} INR</strong></span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Billing Duration:</span>
                    <span className="meta-v">{selectedSub.billingDurationDays} Days</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">UPI Reference (UTR):</span>
                    <span className="meta-v"><code className="utr-code-lg">{selectedSub.paymentUtr}</code></span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Payment Channel:</span>
                    <span className="meta-v">{selectedSub.paymentMethod}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Submission Timestamp:</span>
                    <span className="meta-v">{new Date(selectedSub.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Verification Mode:</span>
                    <span className="meta-v">{selectedSub.verificationMethod || 'MANUAL_ADMIN'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Start Date:</span>
                    <span className="meta-v">{selectedSub.startDate ? new Date(selectedSub.startDate).toLocaleString() : 'Not activated'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Expiry Date:</span>
                    <span className="meta-v"><strong>{selectedSub.expiryDate ? new Date(selectedSub.expiryDate).toLocaleString() : 'Not set'}</strong></span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-k">Expiry Reminders Sent:</span>
                    <span className="meta-v">
                      {selectedSub.remindersSent && selectedSub.remindersSent.length > 0
                        ? selectedSub.remindersSent.map(r => <span key={r} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '1px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}>{r}</span>)
                        : <span style={{ color: '#94a3b8' }}>None dispatched</span>}
                    </span>
                  </div>
                </div>

                {/* Owner & Shop Profile */}
                <div className="detail-section">
                  <h4 className="section-title">Store & Owner Details</h4>
                  <div className="detail-meta-grid">
                    <div className="meta-item">
                      <span className="meta-k">Store Name:</span>
                      <span className="meta-v">{selectedSub.shopId?.name || 'Shop in onboarding'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-k">Owner Name:</span>
                      <span className="meta-v">{selectedSub.ownerId?.name || '—'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-k">Owner Email:</span>
                      <span className="meta-v">{selectedSub.ownerId?.email || '—'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-k">Owner Phone:</span>
                      <span className="meta-v">{selectedSub.ownerId?.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Audit & Transition History */}
                <div className="detail-section">
                  <h4 className="section-title">Transaction Status & Audit History</h4>
                  {selectedSub.history && selectedSub.history.length > 0 ? (
                    <div className="audit-timeline">
                      {selectedSub.history.map((h, i) => (
                        <div key={i} className="audit-timeline-item">
                          <span className="timeline-dot">•</span>
                          <div className="timeline-content">
                            <span className="timeline-status">{h.status}</span>
                            <p className="timeline-note">{h.note}</p>
                            <span className="timeline-time">{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No prior status transitions recorded.</p>
                  )}
                </div>

                {/* Rejection Form Box */}
                {showRejectBox && (
                  <div className="reject-box fade-in">
                    <label className="form-label">
                      Rejection Reason (Required — dispatched directly to store owner) *
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="e.g. UTR number not found in merchant bank statement for the stated date and amount. Please verify your receipt."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="reject-actions">
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={rejecting}
                        onClick={handleReject}
                      >
                        {rejecting ? 'Processing Rejection...' : 'Confirm Payment Rejection'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setShowRejectBox(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setDetailModalOpen(false)}
                >
                  Close
                </button>

                {selectedSub.status === 'PENDING_VERIFICATION' && !showRejectBox && (
                  <div className="modal-cta-group">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setShowRejectBox(true)}
                    >
                      ✕ Reject Payment
                    </button>

                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={verifying}
                      onClick={() => handleVerify(selectedSub._id)}
                    >
                      {verifying ? 'Accepting...' : '✓ Accept Subscription & Unlock Shop'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminSubscriptionsPage;
