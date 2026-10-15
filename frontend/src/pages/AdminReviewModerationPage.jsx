import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import { fetchAdminReviews, moderateAdminReview } from '../services/api';
import './AdminReviewModerationPage.css';

const AdminReviewModerationPage = () => {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Moderation Action Modal State
  const [targetReview, setTargetReview] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const loadReviews = async (page = 1) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 10 };
    if (statusFilter) params.status = statusFilter;
    if (ratingFilter) params.rating = ratingFilter;

    const res = await fetchAdminReviews(params);
    if (res.success) {
      setReviews(res.data);
      setPagination(res.pagination);
    } else {
      setError(res.error || 'Failed to load reviews');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReviews(1);
  }, [statusFilter, ratingFilter]);

  const handleOpenModal = (review, newStatus) => {
    setTargetReview(review);
    setTargetStatus(newStatus);
    setActionReason('');
  };

  const handleConfirmModeration = async () => {
    if (!targetReview || !targetStatus) return;

    if (targetStatus === 'HIDDEN' && !actionReason.trim()) {
      setError('Please provide a reason for hiding this customer review.');
      return;
    }

    setActionSubmitting(true);
    const res = await moderateAdminReview(targetReview._id, targetStatus, actionReason.trim());

    if (res.success) {
      setSuccessMsg(`Review moderation status updated to "${targetStatus}". Part rating recalculated.`);
      setTargetReview(null);
      loadReviews(pagination.page);
    } else {
      setError(res.error || 'Failed to moderate review.');
    }
    setActionSubmitting(false);
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="admin-reviews-page">
      <AdminNav />

      <div className="container admin-reviews-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Product Review Moderation</h1>
            <p className="admin-page-subtitle">
              Audit customer feedback, remove abusive or spam reviews, and maintain genuine platform ratings.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => loadReviews(pagination.page)} disabled={loading}>
            🔄 Refresh Reviews
          </button>
        </div>

        {/* Alerts */}
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

        {/* Filter Controls */}
        <div className="admin-filter-bar">
          <div className="admin-filter-selectors">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Moderation Status</option>
              <option value="APPROVED">Approved (Visible)</option>
              <option value="FLAGGED">Flagged for Review</option>
              <option value="HIDDEN">Hidden (Removed)</option>
            </select>

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        {/* Reviews Table Card */}
        <div className="admin-card table-card">
          {loading ? (
            <div className="admin-loading-state">
              <span className="spinner">⌛</span> Loading customer reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="admin-empty-state">
              <span>⭐</span>
              <h3>No Reviews Found</h3>
              <p>No customer reviews matched your filter settings.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Spare Part</th>
                    <th>Rating & Feedback</th>
                    <th>Moderation Status</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((rev) => (
                    <tr key={rev._id}>
                      <td>
                        <div className="customer-info-cell">
                          <strong>{rev.userId?.name || 'Customer'}</strong>
                          <span className="subtext">{rev.userId?.email || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="part-link-cell">
                          <strong>{rev.sparePartId?.partName || 'Spare Part'}</strong>
                          <span className="subtext">
                            Part #: {rev.sparePartId?.partNumber || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="review-comment-col">
                        <div className="review-stars-wrap">
                          <span className="review-stars">{renderStars(rev.rating)}</span>
                          <span className="rating-num">({rev.rating}/5)</span>
                        </div>
                        <p className="review-text">"{rev.comment}"</p>
                        {rev.moderationReason && (
                          <span className="moderation-reason-tag">
                            Note: {rev.moderationReason}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`compliance-tag tag-${(rev.moderationStatus || 'APPROVED').toLowerCase()}`}>
                          {rev.moderationStatus || 'APPROVED'}
                        </span>
                      </td>
                      <td>
                        <span className="date-cell">
                          {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="review-actions-wrap">
                          {rev.moderationStatus !== 'APPROVED' && (
                            <button
                              className="btn btn-sm btn-success-outline"
                              onClick={() => handleOpenModal(rev, 'APPROVED')}
                            >
                              Approve
                            </button>
                          )}
                          {rev.moderationStatus !== 'FLAGGED' && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenModal(rev, 'FLAGGED')}
                            >
                              Flag
                            </button>
                          )}
                          {rev.moderationStatus !== 'HIDDEN' && (
                            <button
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleOpenModal(rev, 'HIDDEN')}
                            >
                              Hide
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

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="admin-pagination">
              <span className="pagination-info">
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total reviews)
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => loadReviews(pagination.page - 1)}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadReviews(pagination.page + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Confirmation Modal */}
        {targetReview && (
          <div className="modal-backdrop" onClick={() => setTargetReview(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Moderate Review Status: {targetStatus}</h3>
                <button className="modal-close-btn" onClick={() => setTargetReview(null)}>✕</button>
              </div>

              <div className="modal-body">
                <p>
                  Set review status by <strong>{targetReview.userId?.name}</strong> to{' '}
                  <span className={`compliance-tag tag-${targetStatus.toLowerCase()}`}>{targetStatus}</span>?
                </p>

                <div className="review-quote-box">
                  <span className="review-stars">{renderStars(targetReview.rating)}</span>
                  <p>"{targetReview.comment}"</p>
                </div>

                <div className="form-group">
                  <label htmlFor="review-mod-reason">
                    Moderation Note {targetStatus === 'HIDDEN' && <span className="required">*</span>}
                  </label>
                  <textarea
                    id="review-mod-reason"
                    rows="3"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      targetStatus === 'HIDDEN'
                        ? 'State the reason (e.g. offensive language, fake review, spam)...'
                        : 'Optional audit note...'
                    }
                    className="modal-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setTargetReview(null)}>
                  Cancel
                </button>
                <button
                  className={`btn ${targetStatus === 'HIDDEN' ? 'btn-danger' : targetStatus === 'APPROVED' ? 'btn-success' : 'btn-primary'}`}
                  onClick={handleConfirmModeration}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting ? 'Processing...' : `Confirm ${targetStatus}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviewModerationPage;
