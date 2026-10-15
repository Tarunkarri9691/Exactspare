import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import { fetchAdminParts, moderateAdminPart } from '../services/api';
import './AdminPartsModerationPage.css';

const AdminPartsModerationPage = () => {
  const [parts, setParts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Moderation Modal State
  const [targetPart, setTargetPart] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const loadParts = async (page = 1) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 10 };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;

    const res = await fetchAdminParts(params);
    if (res.success) {
      setParts(res.data);
      setPagination(res.pagination);
    } else {
      setError(res.error || 'Failed to load spare parts listings');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadParts(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadParts(1);
  };

  const handleOpenModerationModal = (part) => {
    setTargetPart(part);
    setActionReason('');
  };

  const handleConfirmModeration = async () => {
    if (!targetPart) return;
    const willHide = targetPart.isPublished;

    if (willHide && !actionReason.trim()) {
      setError('Please provide a reason for taking down/moderating this listing.');
      return;
    }

    setActionSubmitting(true);
    const newPublishedStatus = !willHide;
    const res = await moderateAdminPart(targetPart._id, newPublishedStatus, actionReason.trim());

    if (res.success) {
      setSuccessMsg(
        `Spare part "${targetPart.partName}" has been ${newPublishedStatus ? 'restored and published' : 'hidden from catalog'}.`
      );
      setTargetPart(null);
      loadParts(pagination.page);
    } else {
      setError(res.error || 'Failed to moderate spare part listing.');
    }
    setActionSubmitting(false);
  };

  return (
    <div className="admin-parts-page">
      <AdminNav />

      <div className="container admin-parts-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Spare-Part Listing Moderation</h1>
            <p className="admin-page-subtitle">
              Oversee marketplace catalog accuracy, prevent prohibited listings, and audit part pricing and compatibility.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => loadParts(pagination.page)} disabled={loading}>
            🔄 Refresh Listings
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

        {/* Search and Filters */}
        <div className="admin-filter-bar">
          <form className="admin-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by part name, part number, vehicle model or make..."
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Catalog Status</option>
              <option value="published">Published Listings</option>
              <option value="hidden">Hidden / Moderated</option>
            </select>
          </div>
        </div>

        {/* Listings Table Card */}
        <div className="admin-card table-card">
          {loading ? (
            <div className="admin-loading-state">
              <span className="spinner">⌛</span> Loading catalog listings...
            </div>
          ) : parts.length === 0 ? (
            <div className="admin-empty-state">
              <span>⚙️</span>
              <h3>No Listings Found</h3>
              <p>No spare-part listings match your current filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Part Details</th>
                    <th>Shop & Owner</th>
                    <th>Category</th>
                    <th>Price & Stock</th>
                    <th>Catalog Status</th>
                    <th>Rating</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part) => (
                    <tr key={part._id}>
                      <td>
                        <div className="part-info-cell">
                          <strong>{part.partName}</strong>
                          <span className="subtext">
                            OEM/Part: <code>{part.partNumber || 'N/A'}</code>
                          </span>
                          {part.isModerated && part.moderationReason && (
                            <span className="moderation-reason-tag">
                              Reason: {part.moderationReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="shop-owner-cell">
                          <strong>{part.shopId?.shopName || 'Shop'}</strong>
                          <span className="subtext">{part.shopId?.city || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="category-pill">{part.category}</span>
                      </td>
                      <td>
                        <div className="price-stock-cell">
                          <strong>₹{part.price?.toLocaleString('en-IN')}</strong>
                          <span className={part.stockQuantity > 0 ? 'subtext in-stock' : 'subtext out-of-stock'}>
                            {part.stockQuantity} in stock
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${part.isPublished ? 'status-active' : 'status-inactive'}`}>
                          {part.isPublished ? 'Published' : 'Hidden'}
                        </span>
                      </td>
                      <td>
                        <span className="rating-cell">
                          ⭐ {Number(part.averageRating || 0).toFixed(1)} ({part.totalReviews || 0})
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          className={`btn btn-sm ${part.isPublished ? 'btn-danger-outline' : 'btn-success-outline'}`}
                          onClick={() => handleOpenModerationModal(part)}
                        >
                          {part.isPublished ? 'Hide Listing' : 'Restore'}
                        </button>
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
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total listings)
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => loadParts(pagination.page - 1)}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadParts(pagination.page + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Moderation Confirmation Modal */}
        {targetPart && (
          <div className="modal-backdrop" onClick={() => setTargetPart(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{targetPart.isPublished ? 'Hide Listing from Catalog' : 'Restore & Publish Listing'}</h3>
                <button className="modal-close-btn" onClick={() => setTargetPart(null)}>✕</button>
              </div>

              <div className="modal-body">
                <p>
                  Are you sure you want to {targetPart.isPublished ? 'hide' : 'restore'} the listing{' '}
                  <strong>"{targetPart.partName}"</strong>?
                </p>

                {targetPart.isPublished ? (
                  <p className="warning-note">
                    ⚠️ Hiding this listing will immediately prevent customers from discovering and purchasing it. Past orders with this item remain completely intact for warranty and fulfillment records.
                  </p>
                ) : (
                  <p className="info-note">
                    ℹ️ Restoring this listing will make it visible in catalog searches again.
                  </p>
                )}

                <div className="form-group">
                  <label htmlFor="moderation-reason">
                    Moderation Reason {targetPart.isPublished && <span className="required">*</span>}
                  </label>
                  <textarea
                    id="moderation-reason"
                    rows="3"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      targetPart.isPublished
                        ? 'Explain why this listing is being taken down (e.g. counterfeit report, incorrect vehicle fitment, misleading price)...'
                        : 'Optional notes for restoration clearance...'
                    }
                    className="modal-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setTargetPart(null)}>
                  Cancel
                </button>
                <button
                  className={`btn ${targetPart.isPublished ? 'btn-danger' : 'btn-success'}`}
                  onClick={handleConfirmModeration}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting
                    ? 'Processing...'
                    : targetPart.isPublished
                    ? 'Confirm Hide Listing'
                    : 'Confirm Restore'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPartsModerationPage;
