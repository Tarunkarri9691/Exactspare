import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchProductReviews,
  submitProductReview,
  updateProductReview,
  deleteProductReview,
  fetchMyOrders
} from '../services/api';
import './ProductReviewsSection.css';

const ProductReviewsSection = ({ productId, partShopOwnerId }) => {
  const { user, isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    verifiedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Eligibility state
  const [eligibleOrderId, setEligibleOrderId] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Review Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Editing state
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchProductReviews(productId);
      if (res.success) {
        setReviews(res.reviews);
        setSummary(res.summary);
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // Check customer purchase eligibility: must have a DELIVERED order with this product
  useEffect(() => {
    const checkPurchaseEligibility = async () => {
      if (!isAuthenticated || !user || user.role !== 'CUSTOMER') {
        setEligibleOrderId(null);
        return;
      }

      // If user is owner of the shop selling this part
      if (partShopOwnerId && user._id === partShopOwnerId) {
        setEligibleOrderId(null);
        return;
      }

      try {
        setCheckingEligibility(true);
        const res = await fetchMyOrders({ status: 'DELIVERED' });
        if (res.success && res.data?.orders) {
          const deliveredOrders = res.data.orders;
          const matchingOrder = deliveredOrders.find((ord) =>
            ord.items?.some((item) => {
              const pid = item.productId?._id
                ? item.productId._id.toString()
                : item.productId?.toString();
              return pid === productId.toString();
            })
          );
          if (matchingOrder) {
            setEligibleOrderId(matchingOrder._id);
          } else {
            setEligibleOrderId(null);
          }
        }
      } catch {
        setEligibleOrderId(null);
      } finally {
        setCheckingEligibility(false);
      }
    };

    loadReviews();
    checkPurchaseEligibility();
  }, [productId, isAuthenticated, user, partShopOwnerId, loadReviews]);

  // Check if current user already submitted a review
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existing = reviews.find((r) => {
        const authorId = r.customerId?._id
          ? r.customerId._id.toString()
          : r.customerId?.toString();
        return authorId === user._id?.toString();
      });
      setHasReviewed(Boolean(existing));
    } else {
      setHasReviewed(false);
    }
  }, [reviews, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!eligibleOrderId) {
      setFeedback({ type: 'error', text: 'You need a verified delivered order to review this product.' });
      return;
    }
    if (!title.trim() || !comment.trim()) {
      setFeedback({ type: 'error', text: 'Please provide both a headline and detailed review comments.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await submitProductReview(productId, {
        orderId: eligibleOrderId,
        rating,
        title: title.trim(),
        comment: comment.trim()
      });

      if (res.success) {
        setFeedback({ type: 'success', text: 'Thank you! Your verified review has been published.' });
        setTitle('');
        setComment('');
        setRating(5);
        await loadReviews();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to submit review.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev._id);
    setEditRating(rev.rating);
    setEditTitle(rev.title || '');
    setEditComment(rev.comment || '');
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditRating(5);
    setEditTitle('');
    setEditComment('');
  };

  const handleSaveEdit = async (reviewId) => {
    if (!editTitle.trim() || !editComment.trim()) {
      setFeedback({ type: 'error', text: 'Title and comment cannot be empty.' });
      return;
    }

    try {
      setIsUpdating(true);
      const res = await updateProductReview(reviewId, {
        rating: editRating,
        title: editTitle.trim(),
        comment: editComment.trim()
      });

      if (res.success) {
        setFeedback({ type: 'success', text: 'Review updated successfully.' });
        setEditingReviewId(null);
        await loadReviews();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to update review.' });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;

    try {
      const res = await deleteProductReview(reviewId);
      if (res.success) {
        setFeedback({ type: 'success', text: 'Your review has been deleted.' });
        await loadReviews();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to delete review.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error deleting review.' });
    }
  };

  const renderStars = (score, interactive = false, onSelect = null, hoverScore = 0, onHover = null) => {
    const stars = [1, 2, 3, 4, 5];
    return (
      <div className={`star-rating-row ${interactive ? 'interactive' : ''}`}>
        {stars.map((star) => {
          const isFilled = (hoverScore || score) >= star;
          return (
            <span
              key={star}
              className={`star-icon ${isFilled ? 'filled' : 'empty'}`}
              onClick={() => interactive && onSelect && onSelect(star)}
              onMouseEnter={() => interactive && onHover && onHover(star)}
              onMouseLeave={() => interactive && onHover && onHover(0)}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              ★
            </span>
          );
        })}
      </div>
    );
  };

  const calculateDistributionPercent = (count) => {
    if (!summary.totalReviews) return 0;
    return Math.round((count / summary.totalReviews) * 100);
  };

  const isOwnerOfProduct = partShopOwnerId && user?._id === partShopOwnerId;

  return (
    <section className="product-reviews-section" id="product-reviews">
      <div className="reviews-section-header">
        <h2 className="reviews-section-title">Customer Reviews & Ratings</h2>
        <span className="reviews-section-badge">Verified Purchases</span>
      </div>

      {feedback && (
        <div className={`auth-alert ${feedback.type === 'success' ? 'success-alert' : 'error-alert'}`} style={{ marginBottom: '20px' }}>
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Rating Summary Breakdown */}
      <div className="reviews-summary-card">
        <div className="summary-score-col">
          <div className="overall-score">{summary.averageRating.toFixed(1)}</div>
          <div className="overall-stars">{renderStars(Math.round(summary.averageRating))}</div>
          <div className="overall-count">
            Based on <strong>{summary.totalReviews}</strong> verified review{summary.totalReviews !== 1 ? 's' : ''}
          </div>
          {summary.verifiedCount > 0 && (
            <div className="overall-verified-tag">
              ✓ {summary.verifiedCount} 100% verified order{summary.verifiedCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="summary-bars-col">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.ratingDistribution?.[stars] || 0;
            const percent = calculateDistributionPercent(count);
            return (
              <div key={stars} className="dist-row">
                <span className="dist-label">{stars} Star</span>
                <div className="dist-bar-track">
                  <div className="dist-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <span className="dist-percent">{count} ({percent}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Eligibility Banner & Submission Form */}
      <div className="review-submission-wrapper">
        {!isAuthenticated ? (
          <div className="review-auth-notice">
            <span className="notice-icon">🔒</span>
            <div>
              <h4>Have you purchased this spare part?</h4>
              <p>Sign in with your verified customer account to share your feedback and experience.</p>
            </div>
            <Link to={`/login?redirect=/parts/${productId}`} className="btn btn-outline-orange">
              Log in to Review
            </Link>
          </div>
        ) : isOwnerOfProduct ? (
          <div className="review-owner-notice">
            <span className="notice-icon">🏬</span>
            <p>You are the registered owner of this shop listing. Shop owners are prohibited from self-rating inventory.</p>
          </div>
        ) : user.role !== 'CUSTOMER' ? (
          <div className="review-ineligible-notice">
            <span className="notice-icon">ℹ</span>
            <p>Reviews can only be submitted by verified Customer accounts who have received this part.</p>
          </div>
        ) : checkingEligibility ? (
          <div className="review-checking-notice">
            <span>Verifying delivered purchase eligibility...</span>
          </div>
        ) : eligibleOrderId && !hasReviewed ? (
          <div className="review-form-card">
            <h3 className="form-card-title">Write a Verified Customer Review</h3>
            <p className="form-card-subtitle">
              Order Verified: You received this spare part. Help fellow drivers make confident repair decisions!
            </p>

            <form onSubmit={handleSubmitReview} className="review-form">
              <div className="form-group-rating">
                <label className="form-label">Overall Rating *</label>
                {renderStars(rating, true, setRating, hoverRating, setHoverRating)}
                <span className="rating-desc-text">
                  {rating === 5 && '5 Stars - Outstanding Quality & Fit'}
                  {rating === 4 && '4 Stars - Good Compatible Part'}
                  {rating === 3 && '3 Stars - Average / Acceptable'}
                  {rating === 2 && '2 Stars - Poor Quality / Fit Issues'}
                  {rating === 1 && '1 Star - Unsatisfactory Part'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="review-title">Review Headline *</label>
                <input
                  id="review-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Perfect OEM fit for my 2019 Swift ZXi"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="review-comment">Detailed Review Comments *</label>
                <textarea
                  id="review-comment"
                  className="form-input review-textarea"
                  rows={4}
                  placeholder="Share details about the packaging, build quality, fitment on your car, and overall performance..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  required
                />
                <span className="char-count">{comment.length} / 1000 characters</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary submit-review-btn"
                disabled={submitting}
              >
                {submitting ? 'Submitting Review...' : 'Publish Verified Review'}
              </button>
            </form>
          </div>
        ) : hasReviewed ? (
          <div className="review-already-submitted-notice">
            <span className="notice-icon">✓</span>
            <div>
              <h4>You've reviewed this product!</h4>
              <p>You can edit or delete your existing review below.</p>
            </div>
          </div>
        ) : (
          <div className="review-not-purchased-notice">
            <span className="notice-icon">🛡</span>
            <div>
              <h4>Verified Buyer Guarantee</h4>
              <p>
                To maintain 100% authentic feedback, only customers who have purchased and received this part (status: <strong>DELIVERED</strong>) can submit a review.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="reviews-list-container">
        <h3 className="reviews-list-title">All Customer Reviews ({reviews.length})</h3>

        {loading ? (
          <div className="reviews-loading">
            <p>Loading customer reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">
            <span className="empty-star-icon">☆</span>
            <h4>No customer reviews yet</h4>
            <p>Be the first verified customer to test and review this spare part!</p>
          </div>
        ) : (
          <div className="reviews-feed">
            {reviews.map((rev) => {
              const authorName = rev.customerId?.name || 'Verified Buyer';
              const isAuthor = user && (rev.customerId?._id?.toString() === user._id || rev.customerId?.toString() === user._id);
              const isEditing = editingReviewId === rev._id;

              return (
                <div key={rev._id} className="review-card">
                  {isEditing ? (
                    <div className="review-edit-form">
                      <h4>Edit Your Review</h4>
                      <div className="form-group-rating">
                        <label className="form-label">Rating</label>
                        {renderStars(editRating, true, setEditRating)}
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          className="form-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          className="form-input review-textarea"
                          rows={3}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          maxLength={1000}
                        />
                      </div>
                      <div className="edit-form-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSaveEdit(rev._id)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="review-card-top">
                        <div className="reviewer-info">
                          <div className="reviewer-avatar">
                            {authorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="reviewer-name-row">
                              <span className="reviewer-name">{authorName}</span>
                              {rev.isVerifiedPurchase && (
                                <span className="verified-badge">
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                  </svg>
                                  Verified Purchase
                                </span>
                              )}
                            </div>
                            <span className="review-date">
                              {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="review-stars-col">
                          {renderStars(rev.rating)}
                        </div>
                      </div>

                      <div className="review-card-content">
                        <h4 className="review-headline">{rev.title}</h4>
                        <p className="review-body">{rev.comment}</p>
                      </div>

                      {isAuthor && (
                        <div className="review-author-actions">
                          <button
                            type="button"
                            className="btn-review-text-action"
                            onClick={() => handleStartEdit(rev)}
                          >
                            Edit Review
                          </button>
                          <span className="action-sep">•</span>
                          <button
                            type="button"
                            className="btn-review-text-action delete"
                            onClick={() => handleDeleteReview(rev._id)}
                          >
                            Delete Review
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductReviewsSection;
