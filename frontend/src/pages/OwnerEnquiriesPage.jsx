import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyApprovedShop,
  fetchOwnerEnquiries,
  updateEnquiryStatusApi,
  replyToEnquiryApi
} from '../services/api';
import './OwnerEnquiriesPage.css';

const OwnerEnquiriesPage = () => {
  const { user } = useAuth();
  const outletContext = useOutletContext() || {};

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(outletContext.shop || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, NEW, IN_PROGRESS, REPLIED, CLOSED
  const [enquiries, setEnquiries] = useState([]);
  const [stats, setStats] = useState({ total: 0, new: 0, inProgress: 0, replied: 0, closed: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  
  // Modal states
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadEnquiries = useCallback(async (targetPage = 1, currentTab = activeTab, search = searchQuery) => {
    try {
      setLoading(true);
      setActionError('');
      const params = {
        page: targetPage,
        limit: 10
      };
      if (currentTab !== 'ALL') {
        params.status = currentTab;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await fetchOwnerEnquiries(params);
      if (res.success) {
        setEnquiries(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
        if (res.stats) {
          setStats(res.stats);
        }
      } else {
        setActionError(res.error || 'Failed to retrieve shop enquiries.');
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      setActionError('Error connecting to enquiries server.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    const init = async () => {
      if (!shop) {
        const shopRes = await fetchMyApprovedShop();
        if (shopRes.success && shopRes.data?.shop) {
          setShop(shopRes.data.shop);
        }
      }
      loadEnquiries(1, activeTab, searchQuery);
    };
    init();
  }, [shop]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadEnquiries(1, tab, searchQuery);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadEnquiries(1, activeTab, searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadEnquiries(1, activeTab, '');
  };

  const handleStatusChange = async (enquiryId, newStatus) => {
    try {
      setActionError('');
      const res = await updateEnquiryStatusApi(enquiryId, newStatus);
      if (res.success) {
        setActionSuccess(`Enquiry status updated to ${newStatus}.`);
        setTimeout(() => setActionSuccess(''), 3000);
        // Update item locally
        setEnquiries((prev) =>
          prev.map((item) => (item._id === enquiryId ? { ...item, status: newStatus } : item))
        );
        if (selectedEnquiry && selectedEnquiry._id === enquiryId) {
          setSelectedEnquiry((prev) => ({ ...prev, status: newStatus }));
        }
        // Refresh counts
        loadEnquiries(pagination.page, activeTab, searchQuery);
      } else {
        setActionError(res.error || 'Failed to update status.');
      }
    } catch (err) {
      setActionError('Error updating status.');
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedEnquiry) return;

    try {
      setSubmittingReply(true);
      setActionError('');
      const res = await replyToEnquiryApi(selectedEnquiry._id, replyText.trim());
      if (res.success) {
        setActionSuccess('Reply sent to customer successfully!');
        setReplyText('');
        // Update selected enquiry thread
        setSelectedEnquiry(res.data);
        // Refresh list
        loadEnquiries(pagination.page, activeTab, searchQuery);
        setTimeout(() => setActionSuccess(''), 3000);
      } else {
        setActionError(res.error || 'Failed to send reply to customer.');
      }
    } catch (err) {
      setActionError('Error sending reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const isStoreApproved = outletContext.isApproved || shop?.isApproved;

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="owner-enquiries-root">
      <div className="container owner-enquiries-container">
        {/* Header Section */}
        <div className="enquiries-header-card">
          <div className="enquiries-header-text">
            <div className="enquiries-badge-row">
              <span className="badge badge-navy">Direct Customer Communication</span>
              {isStoreApproved ? (
                <span className="badge badge-success">✓ Channel Active</span>
              ) : (
                <span className="badge badge-warning">Awaiting Store Approval</span>
              )}
            </div>
            <h1 className="enquiries-title">Customer Enquiries & Compatibility Inquiries</h1>
            <p className="enquiries-subtitle">
              Respond directly to vehicle owners asking about spare part availability, vehicle fitment compatibility, and store pickup options.
            </p>
          </div>
          <div className="enquiries-header-stats-group">
            <div className="enquiries-header-stat stat-new">
              <span className="stat-number">{stats.new || 0}</span>
              <span className="stat-label">New Inquiries</span>
            </div>
            <div className="enquiries-header-stat stat-total">
              <span className="stat-number">{stats.total || 0}</span>
              <span className="stat-label">Total Inquiries</span>
            </div>
          </div>
        </div>

        {/* Action feedback banners */}
        {actionSuccess && (
          <div className="owner-action-alert alert-success" role="alert">
            <span>✓ {actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="owner-action-alert alert-danger" role="alert">
            <span>⚠️ {actionError}</span>
          </div>
        )}

        {/* Verification Alert if not approved */}
        {!isStoreApproved && (
          <div className="enquiries-approval-notice">
            <div className="notice-icon">ℹ️</div>
            <div className="notice-text">
              <strong>Shop Profile:</strong> You can manage your shop details and operating hours anytime.
              <Link to="/owner/shop" className="notice-link">
                View Shop Profile →
              </Link>
            </div>
          </div>
        )}

        {/* Search & Filters Toolbar */}
        <div className="enquiries-toolbar">
          <div className="enquiries-tabs" role="tablist">
            <button
              type="button"
              className={`enquiries-tab ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => handleTabChange('ALL')}
            >
              All ({stats.total || 0})
            </button>
            <button
              type="button"
              className={`enquiries-tab ${activeTab === 'NEW' ? 'active' : ''}`}
              onClick={() => handleTabChange('NEW')}
            >
              New ({stats.new || 0})
            </button>
            <button
              type="button"
              className={`enquiries-tab ${activeTab === 'IN_PROGRESS' ? 'active' : ''}`}
              onClick={() => handleTabChange('IN_PROGRESS')}
            >
              In Progress ({stats.inProgress || 0})
            </button>
            <button
              type="button"
              className={`enquiries-tab ${activeTab === 'REPLIED' ? 'active' : ''}`}
              onClick={() => handleTabChange('REPLIED')}
            >
              Replied ({stats.replied || 0})
            </button>
            <button
              type="button"
              className={`enquiries-tab ${activeTab === 'CLOSED' ? 'active' : ''}`}
              onClick={() => handleTabChange('CLOSED')}
            >
              Closed ({stats.closed || 0})
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="enquiries-search-form">
            <div className="enquiries-search-wrap">
              <input
                type="text"
                placeholder="Search subject, part, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="enquiries-search-input"
                id="enquiries-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              <button type="submit" className="search-submit-btn">
                🔍
              </button>
            </div>
          </form>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="enquiries-loading-state">
            <div className="enquiries-spinner"></div>
            <p>Loading customer enquiries...</p>
          </div>
        ) : enquiries.length === 0 ? (
          /* Empty State */
          <div className="enquiries-empty-state">
            <div className="empty-icon-wrap">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>
              {searchQuery || activeTab !== 'ALL'
                ? 'No matching enquiries found'
                : 'No Customer Enquiries Yet'}
            </h3>
            <p className="empty-desc">
              {searchQuery || activeTab !== 'ALL'
                ? 'Try broadening your search term or selecting a different status filter tab.'
                : 'When vehicle owners browse your shop profile or search for spare parts in your catalog, their compatibility questions and availability requests will appear here in real time.'}
            </p>
            {searchQuery || activeTab !== 'ALL' ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSearchQuery('');
                  handleTabChange('ALL');
                }}
              >
                Reset All Filters
              </button>
            ) : (
              <div className="empty-actions">
                <Link to="/owner/inventory" className="btn btn-outline">
                  Review Inventory Catalog
                </Link>
                <Link to="/owner/dashboard" className="btn btn-primary">
                  Return to Owner Dashboard
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Inquiries Cards Grid / List */
          <div className="enquiries-grid">
            {enquiries.map((item) => {
              const part = item.sparePartId;
              const hasReplies = item.replies && item.replies.length > 0;
              const vehicle = item.vehicleInfo;

              return (
                <div key={item._id} className={`owner-enquiry-card status-${item.status.toLowerCase()}`}>
                  <div className="card-top-row">
                    <div className="card-customer-info">
                      <div className="customer-avatar-initials">
                        {item.customerName ? item.customerName.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div>
                        <strong className="customer-name-heading">{item.customerName}</strong>
                        <div className="customer-contact-subline">
                          {item.customerEmail && (
                            <span className="contact-chip">✉️ {item.customerEmail}</span>
                          )}
                          {item.customerPhone && (
                            <a href={`tel:${item.customerPhone}`} className="contact-chip phone-chip">
                              📞 {item.customerPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="card-status-badge-wrap">
                      <span className={`status-pill pill-${item.status.toLowerCase()}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="card-date-sub">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Referenced Spare Part Box */}
                  {part && (
                    <div className="enquiry-referenced-part-card">
                      <span className="part-icon">⚙️</span>
                      <div className="part-info-inline">
                        <strong className="part-name-text">{part.partName}</strong>
                        <span className="part-meta-text">
                          Part #: <code>{part.partNumber || 'N/A'}</code> | Brand: {part.manufacturer || 'OEM'} | Price: ₹{Number(part.price || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <Link to={`/parts/${part._id}`} target="_blank" className="view-part-link" title="Open spare part listing">
                        View Part Listing ↗
                      </Link>
                    </div>
                  )}

                  {/* Optional Vehicle Compatibility Info */}
                  {vehicle && (vehicle.make || vehicle.model || vehicle.year || vehicle.compatibilityQuestion) && (
                    <div className="enquiry-vehicle-card">
                      <span className="vehicle-icon">🚗</span>
                      <div className="vehicle-details-inline">
                        <span className="vehicle-title">Customer's Vehicle:</span>
                        <span className="vehicle-spec">
                          {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unspecified'}
                        </span>
                        {vehicle.compatibilityQuestion && (
                          <div className="vehicle-question-sub">
                            <strong>Compatibility Question:</strong> "{vehicle.compatibilityQuestion}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subject & Message */}
                  <div className="enquiry-content-box">
                    <h4 className="enquiry-subject-heading">{item.subject}</h4>
                    <p className="enquiry-message-text">{item.message}</p>
                  </div>

                  {/* Replies Preview Badge */}
                  {hasReplies && (
                    <div className="replies-summary-line">
                      💬 <strong>{item.replies.length}</strong> message{item.replies.length !== 1 ? 's' : ''} in thread
                      <span className="last-reply-time">
                        Last reply: {formatDate(item.replies[item.replies.length - 1].createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="enquiry-card-actions">
                    <div className="status-dropdown-group">
                      <label htmlFor={`status-select-${item._id}`} className="status-select-label">
                        Status:
                      </label>
                      <select
                        id={`status-select-${item._id}`}
                        value={item.status}
                        onChange={(e) => handleStatusChange(item._id, e.target.value)}
                        className="status-dropdown"
                      >
                        <option value="NEW">NEW</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="REPLIED">REPLIED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedEnquiry(item);
                          setReplyText('');
                        }}
                      >
                        {hasReplies ? '💬 View Thread & Reply' : '✉️ Reply to Customer'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Toolbar */}
        {pagination.totalPages > 1 && (
          <div className="enquiries-pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => loadEnquiries(pagination.page - 1, activeTab, searchQuery)}
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} enquiries)
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadEnquiries(pagination.page + 1, activeTab, searchQuery)}
            >
              Next →
            </button>
          </div>
        )}

        {/* Thread & Reply Modal */}
        {selectedEnquiry && (
          <div className="enquiry-modal-backdrop" onClick={() => setSelectedEnquiry(null)}>
            <div className="enquiry-thread-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="thread-modal-header">
                <div>
                  <span className="badge badge-navy">Enquiry Thread</span>
                  <h3 className="thread-modal-title">{selectedEnquiry.subject}</h3>
                  <span className="thread-modal-customer">
                    From <strong>{selectedEnquiry.customerName}</strong> ({selectedEnquiry.customerEmail})
                  </span>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedEnquiry(null)}
                >
                  ✕
                </button>
              </div>

              <div className="thread-modal-body">
                {/* Part Details summary if present */}
                {selectedEnquiry.sparePartId && (
                  <div className="thread-part-preview">
                    <strong>Referenced Part:</strong> {selectedEnquiry.sparePartId.partName} (
                    <code>{selectedEnquiry.sparePartId.partNumber || 'N/A'}</code>)
                  </div>
                )}

                {/* Original Customer Message Bubble */}
                <div className="thread-message message-customer">
                  <div className="message-meta">
                    <strong>{selectedEnquiry.customerName}</strong>
                    <span>{formatDate(selectedEnquiry.createdAt)}</span>
                  </div>
                  <div className="message-bubble-content">
                    <p>{selectedEnquiry.message}</p>
                  </div>
                </div>

                {/* Replies Thread */}
                {selectedEnquiry.replies && selectedEnquiry.replies.map((reply, idx) => (
                  <div
                    key={idx}
                    className={`thread-message ${
                      reply.senderRole === 'OWNER' ? 'message-owner' : 'message-customer'
                    }`}
                  >
                    <div className="message-meta">
                      <strong>
                        {reply.senderRole === 'OWNER'
                          ? `${reply.senderName || 'You (Shop Owner)'} [Verified Merchant]`
                          : `${reply.senderName || 'Customer'}`}
                      </strong>
                      <span>{formatDate(reply.createdAt)}</span>
                    </div>
                    <div className="message-bubble-content">
                      <p>{reply.message}</p>
                    </div>
                  </div>
                ))}

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="thread-reply-form">
                  <label htmlFor="thread-reply-textarea" className="reply-label">
                    Write your response to {selectedEnquiry.customerName}:
                  </label>
                  <textarea
                    id="thread-reply-textarea"
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Provide availability details, compatibility confirmation, pickup hours, or store contact..."
                    className="form-textarea"
                    required
                  />
                  <div className="thread-form-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedEnquiry(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submittingReply || !replyText.trim()}
                    >
                      {submittingReply ? 'Sending...' : 'Send Reply ➔'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerEnquiriesPage;
