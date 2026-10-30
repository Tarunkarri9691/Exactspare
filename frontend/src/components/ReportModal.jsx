import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitProductReportApi, submitShopReportApi } from '../services/api';
import './ReportModal.css';

const REPORT_CATEGORIES = [
  { value: 'INCORRECT_INFO', label: 'Incorrect Information or Specs' },
  { value: 'SUSPECTED_COUNTERFEIT', label: 'Suspected Counterfeit / Fake Part' },
  { value: 'MISLEADING_PRICING', label: 'Misleading or Irregular Pricing' },
  { value: 'INCORRECT_COMPATIBILITY', label: 'Wrong Vehicle Compatibility' },
  { value: 'UNRESPONSIVE_SHOP', label: 'Merchant Not Responding / Out of Stock' },
  { value: 'OTHER', label: 'Other Marketplace Trust Concern' }
];

const ReportModal = ({ isOpen, onClose, targetType = 'PRODUCT', targetId, targetTitle = '', shopId }) => {
  const { user, isAuthenticated } = useAuth();
  const [category, setCategory] = useState('INCORRECT_INFO');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 10) {
      setFeedback({ type: 'error', text: 'Please provide at least 10 characters explaining your concern.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        category,
        description: description.trim()
      };

      const res =
        targetType === 'PRODUCT'
          ? await submitProductReportApi(targetId, payload)
          : await submitShopReportApi(targetId, payload);

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit report.');
      }

      setFeedback({
        type: 'success',
        text: 'Thank you for helping maintain marketplace integrity. Your report has been submitted to the EXACTSPARE Trust & Safety team.'
      });
      setDescription('');
      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 2500);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div className="report-modal-title">
            <span className="report-flag-icon">🚩</span>
            <div>
              <h3>Report {targetType === 'PRODUCT' ? 'Listing' : 'Store'}</h3>
              <p className="report-target-subtitle">{targetTitle}</p>
            </div>
          </div>
          <button type="button" className="report-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="report-modal-body text-center">
            <div className="report-auth-notice">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <h4>Authentication Required</h4>
              <p>Please sign in with your customer account to file a marketplace report.</p>
              <Link to="/login" className="btn btn-primary" onClick={onClose} style={{ marginTop: '1rem' }}>
                Sign In to Continue
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal-body">
            {feedback && (
              <div className={`report-feedback-alert ${feedback.type === 'success' ? 'success' : 'error'}`}>
                {feedback.type === 'success' ? '✓ ' : '⚠ '}
                {feedback.text}
              </div>
            )}

            <div className="report-form-group">
              <label htmlFor="reportCategory">Reason for Reporting</label>
              <select
                id="reportCategory"
                className="report-select-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
              >
                {REPORT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="report-form-group">
              <div className="report-desc-header">
                <label htmlFor="reportDescription">Detailed Explanation</label>
                <span className="report-char-count">{description.length} / 2000</span>
              </div>
              <textarea
                id="reportDescription"
                className="report-textarea-input"
                rows="4"
                placeholder="Describe why you believe this listing or merchant violates catalog accuracy, authenticity, or pricing standards..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                disabled={submitting}
                required
              />
            </div>

            <div className="report-privacy-disclaimer">
              <span className="shield-icon">🛡️</span>
              <small>
                Your report is confidential and inspected by platform administrators. Unverified reports are investigated factually before any marketplace actions are taken.
              </small>
            </div>

            <div className="report-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary submit-report-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
