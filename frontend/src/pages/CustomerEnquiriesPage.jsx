import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCustomerEnquiries, replyToEnquiryApi } from '../services/api';
import './CustomerEnquiriesPage.css';

const CustomerEnquiriesPage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [error, setError] = useState('');
  
  // Active thread reply
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState('');
  const [replyError, setReplyError] = useState('');

  const loadMyEnquiries = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchCustomerEnquiries({ page: targetPage, limit: 10 });
      if (res.success) {
        setEnquiries(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.error || 'Failed to fetch your submitted enquiries.');
      }
    } catch (err) {
      console.error('Error fetching customer enquiries:', err);
      setError('Error connecting to enquiries server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyEnquiries(1);
  }, [loadMyEnquiries]);

  const handleSendCustomerReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedEnquiry) return;

    try {
      setSubmittingReply(true);
      setReplyError('');
      const res = await replyToEnquiryApi(selectedEnquiry._id, replyText.trim());
      if (res.success) {
        setReplySuccess('Reply sent to shop owner!');
        setReplyText('');
        setSelectedEnquiry(res.data);
        // refresh list
        loadMyEnquiries(pagination.page);
        setTimeout(() => setReplySuccess(''), 3000);
      } else {
        setReplyError(res.error || 'Failed to post reply.');
      }
    } catch (err) {
      setReplyError('Error posting reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

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
    <div className="customer-enquiries-root">
      <div className="container customer-enquiries-container">
        {/* Header Breadcrumb & Titles */}
        <div className="customer-enquiries-header">
          <div className="customer-enquiries-badge">
            <span className="badge badge-navy">Merchant Direct Messaging</span>
          </div>
          <h1 className="customer-enquiries-title">My Spare Part Enquiries</h1>
          <p className="customer-enquiries-subtitle">
            Track inquiries, fitment questions, and availability messages sent to verified automotive spare part shops.
          </p>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="cust-alert alert-danger" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="cust-loading-state">
            <div className="cust-spinner"></div>
            <p>Loading your enquiries...</p>
          </div>
        ) : enquiries.length === 0 ? (
          /* Empty State */
          <div className="cust-empty-state">
            <div className="cust-empty-icon">📫</div>
            <h3>No Enquiries Sent Yet</h3>
            <p className="cust-empty-desc">
              When you find a spare part or local shop and have questions about vehicle fitment, stock condition, or in-store pickup, click <strong>"Contact Shop / Send Enquiry"</strong> to message the merchant directly.
            </p>
            <div className="cust-empty-actions">
              <Link to="/parts" className="btn btn-primary">
                Browse Spare Parts Catalog
              </Link>
              <Link to="/shops" className="btn btn-outline">
                Find Nearby Partner Shops
              </Link>
            </div>
          </div>
        ) : (
          /* Enquiries List */
          <div className="cust-enquiries-list">
            {enquiries.map((item) => {
              const shop = item.shopId;
              const part = item.sparePartId;
              const vehicle = item.vehicleInfo;
              const hasReplies = item.replies && item.replies.length > 0;
              const latestOwnerReply = hasReplies
                ? [...item.replies].reverse().find((r) => r.senderRole === 'OWNER')
                : null;

              return (
                <div key={item._id} className={`cust-enquiry-card status-border-${item.status.toLowerCase()}`}>
                  {/* Top Bar: Shop info & Status badge */}
                  <div className="cust-card-header">
                    <div className="cust-shop-meta">
                      <span className="cust-shop-icon">🏬</span>
                      <div>
                        <strong className="cust-shop-name">
                          {shop?.name || 'Verified Auto Parts Store'}
                        </strong>
                        <span className="cust-shop-addr">
                          {shop?.addressLine ? `${shop.addressLine}, ${shop.city}` : 'Physical Store'}
                        </span>
                      </div>
                    </div>

                    <div className="cust-status-wrap">
                      <span className={`cust-status-badge badge-${item.status.toLowerCase()}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="cust-date-label">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Referenced Part (if any) */}
                  {part && (
                    <div className="cust-part-reference-box">
                      <span className="cust-part-icon">⚙️</span>
                      <div className="cust-part-details">
                        <strong className="cust-part-title">{part.partName}</strong>
                        <span className="cust-part-sku">
                          Part #: <code>{part.partNumber || 'N/A'}</code> | Brand: {part.manufacturer || 'OEM'} | ₹{Number(part.price || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <Link to={`/parts/${part._id}`} className="cust-part-view-link">
                        View Product ↗
                      </Link>
                    </div>
                  )}

                  {/* Vehicle details (if any) */}
                  {vehicle && (vehicle.make || vehicle.model || vehicle.year || vehicle.compatibilityQuestion) && (
                    <div className="cust-vehicle-box">
                      <span className="cust-vehicle-icon">🚗</span>
                      <div>
                        <span className="cust-vehicle-heading">Vehicle Compatibility Checked:</span>{' '}
                        <strong>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}</strong>
                        {vehicle.compatibilityQuestion && (
                          <div className="cust-vehicle-q">
                            Question: "{vehicle.compatibilityQuestion}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enquiry Subject & Initial Message */}
                  <div className="cust-message-box">
                    <h4 className="cust-subject-title">{item.subject}</h4>
                    <p className="cust-message-body">{item.message}</p>
                  </div>

                  {/* Latest Merchant Response Preview if available */}
                  {latestOwnerReply && (
                    <div className="cust-latest-reply-box">
                      <div className="reply-merchant-header">
                        <span className="merchant-tag">🏪 Shop Owner Response:</span>
                        <span className="reply-timestamp">{formatDate(latestOwnerReply.createdAt)}</span>
                      </div>
                      <p className="reply-text-preview">{latestOwnerReply.message}</p>
                    </div>
                  )}

                  {/* Footer Action */}
                  <div className="cust-card-footer">
                    <span className="thread-count-meta">
                      💬 <strong>{item.replies?.length || 0}</strong> reply message{item.replies?.length !== 1 ? 's' : ''} in thread
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setSelectedEnquiry(item);
                        setReplyText('');
                        setReplySuccess('');
                        setReplyError('');
                      }}
                    >
                      {hasReplies ? 'View Complete Thread & Reply' : 'Add Follow-up Message'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="cust-pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => loadMyEnquiries(pagination.page - 1)}
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadMyEnquiries(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        )}

        {/* Complete Thread Modal */}
        {selectedEnquiry && (
          <div className="enquiry-modal-backdrop" onClick={() => setSelectedEnquiry(null)}>
            <div className="enquiry-thread-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="thread-modal-header">
                <div>
                  <span className="badge badge-navy">Conversation Thread</span>
                  <h3 className="thread-modal-title">{selectedEnquiry.subject}</h3>
                  <span className="thread-modal-customer">
                    Shop: <strong>{selectedEnquiry.shopId?.name || 'Store'}</strong>
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
                {/* Referenced Part */}
                {selectedEnquiry.sparePartId && (
                  <div className="thread-part-preview">
                    <strong>Referenced Spare Part:</strong> {selectedEnquiry.sparePartId.partName} (
                    <code>{selectedEnquiry.sparePartId.partNumber || 'N/A'}</code>)
                  </div>
                )}

                {/* Feedback alerts */}
                {replySuccess && <div className="cust-alert alert-success">{replySuccess}</div>}
                {replyError && <div className="cust-alert alert-danger">{replyError}</div>}

                {/* Initial customer message */}
                <div className="thread-message message-customer">
                  <div className="message-meta">
                    <strong>You (Customer)</strong>
                    <span>{formatDate(selectedEnquiry.createdAt)}</span>
                  </div>
                  <div className="message-bubble-content">
                    <p>{selectedEnquiry.message}</p>
                  </div>
                </div>

                {/* Message replies */}
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
                          ? `🏪 ${selectedEnquiry.shopId?.name || 'Shop Owner'} [Verified Merchant]`
                          : 'You (Customer)'}
                      </strong>
                      <span>{formatDate(reply.createdAt)}</span>
                    </div>
                    <div className="message-bubble-content">
                      <p>{reply.message}</p>
                    </div>
                  </div>
                ))}

                {/* Follow up reply form */}
                <form onSubmit={handleSendCustomerReply} className="thread-reply-form">
                  <label htmlFor="cust-thread-reply-textarea" className="reply-label">
                    Send a follow-up message to {selectedEnquiry.shopId?.name || 'the shop owner'}:
                  </label>
                  <textarea
                    id="cust-thread-reply-textarea"
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply or additional question..."
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
                      {submittingReply ? 'Sending...' : 'Send Message ➔'}
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

export default CustomerEnquiriesPage;
