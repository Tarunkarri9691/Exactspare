import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import {
  fetchAdminShops,
  fetchAdminShopDetails,
  updateAdminShopStatus,
  fetchAdminShopParts
} from '../services/api';
import './AdminShopsPage.css';

const AdminShopsPage = () => {
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Status Change Confirmation Modal State
  const [targetShop, setTargetShop] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Shop Inspection Drawer / Modal State
  const [inspectShop, setInspectShop] = useState(null);
  const [inspectDetails, setInspectDetails] = useState(null);
  const [inspectParts, setInspectParts] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadShops = async (page = 1) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 10 };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (approvalFilter) params.approvalStatus = approvalFilter;

    const res = await fetchAdminShops(params);
    if (res.success) {
      setShops(res.data);
      setPagination(res.pagination);
    } else {
      setError(res.error || 'Failed to load shops');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadShops(1);
  }, [statusFilter, approvalFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadShops(1);
  };

  const handleOpenStatusModal = (shop) => {
    setTargetShop(shop);
    setActionReason('');
  };

  const handleConfirmStatusToggle = async () => {
    if (!targetShop) return;
    if (!targetShop.isActive && !actionReason.trim()) {
      // Activating can have default reason or optional, but deactivation should have a reason
    }
    if (targetShop.isActive && !actionReason.trim()) {
      setError('Please provide a reason for deactivating this shop.');
      return;
    }

    setActionSubmitting(true);
    const newStatus = !targetShop.isActive;
    const res = await updateAdminShopStatus(targetShop._id, newStatus, actionReason.trim());

    if (res.success) {
      setSuccessMsg(
        `Shop "${targetShop.shopName}" was successfully ${newStatus ? 'activated' : 'deactivated'}.`
      );
      setTargetShop(null);
      loadShops(pagination.page);
    } else {
      setError(res.error || 'Failed to update shop status.');
    }
    setActionSubmitting(false);
  };

  const handleInspectShop = async (shop) => {
    setInspectShop(shop);
    setInspectLoading(true);
    setInspectDetails(null);
    setInspectParts([]);

    try {
      const [detailsRes, partsRes] = await Promise.all([
        fetchAdminShopDetails(shop._id),
        fetchAdminShopParts(shop._id, { limit: 15 })
      ]);

      if (detailsRes.success) {
        setInspectDetails(detailsRes.data);
      }
      if (partsRes.success) {
        setInspectParts(partsRes.data);
      }
    } catch (err) {
      setError('Failed to fetch shop details.');
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="admin-shops-page">
      <AdminNav />

      <div className="container admin-shops-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Shop Management</h1>
            <p className="admin-page-subtitle">
              Inspect partner spare-parts dealerships, audit inventory listings, and manage operational status.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => loadShops(pagination.page)} disabled={loading}>
            🔄 Refresh List
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

        {/* Filters and Search Bar */}
        <div className="admin-filter-bar">
          <form className="admin-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by shop name, owner name or email..."
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
              <option value="">All Operating Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="admin-select"
            >
              <option value="">All Compliance Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="admin-card table-card">
          {loading ? (
            <div className="admin-loading-state">
              <span className="spinner">⌛</span> Loading registered shops...
            </div>
          ) : shops.length === 0 ? (
            <div className="admin-empty-state">
              <span>🏬</span>
              <h3>No Shops Found</h3>
              <p>No partner shops matched your search and filter criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Shop & Location</th>
                    <th>Shop Owner</th>
                    <th>Compliance</th>
                    <th>Status</th>
                    <th>Inventory</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop._id}>
                      <td>
                        <div className="shop-name-cell">
                          <strong>{shop.shopName}</strong>
                          <span className="shop-location-text">
                            📍 {shop.address?.city || shop.city || '—'}, {shop.address?.state || shop.state || ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="owner-cell">
                          <strong>{shop.ownerId?.name || 'Owner'}</strong>
                          <span className="subtext">{shop.ownerId?.email || '—'}</span>
                          {shop.ownerId?.phone && <span className="subtext">📞 {shop.ownerId.phone}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`compliance-tag tag-${(shop.approvalStatus || 'PENDING').toLowerCase()}`}>
                          {shop.approvalStatus || 'PENDING'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${shop.isActive ? 'status-active' : 'status-inactive'}`}>
                          {shop.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="inventory-badge">
                          📦 {shop.inventoryCount || 0} listings
                        </span>
                      </td>
                      <td>
                        <span className="date-cell">
                          {new Date(shop.createdAt).toLocaleDateString('en-IN', {
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
                            onClick={() => handleInspectShop(shop)}
                            title="Inspect Details & Inventory"
                          >
                            👁️ Inspect
                          </button>

                          <button
                            className={`btn btn-sm ${shop.isActive ? 'btn-danger-outline' : 'btn-success-outline'}`}
                            onClick={() => handleOpenStatusModal(shop)}
                          >
                            {shop.isActive ? 'Deactivate' : 'Activate'}
                          </button>
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
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total shops)
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => loadShops(pagination.page - 1)}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadShops(pagination.page + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Deactivation / Activation Confirmation Modal */}
        {targetShop && (
          <div className="modal-backdrop" onClick={() => setTargetShop(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {targetShop.isActive ? 'Deactivate Shop' : 'Activate Shop'}
                </h3>
                <button className="modal-close-btn" onClick={() => setTargetShop(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to {targetShop.isActive ? 'deactivate' : 'activate'}{' '}
                  <strong>"{targetShop.shopName}"</strong>?
                </p>
                {targetShop.isActive ? (
                  <p className="warning-note">
                    ⚠️ Deactivating will immediately hide this shop and its spare parts from public search and discovery. Past orders and sales records are safely preserved.
                  </p>
                ) : (
                  <p className="info-note">
                    ℹ️ Activating this approved shop will make its listings visible to customers searching in their vicinity.
                  </p>
                )}

                <div className="form-group">
                  <label htmlFor="shop-action-reason">
                    Reason for {targetShop.isActive ? 'Deactivation' : 'Activation'}{' '}
                    {targetShop.isActive && <span className="required">*</span>}
                  </label>
                  <textarea
                    id="shop-action-reason"
                    rows="3"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      targetShop.isActive
                        ? 'State the reason (e.g., Policy violation, license expired, owner request)...'
                        : 'Optional reason or compliance clearance note...'
                    }
                    className="modal-textarea"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setTargetShop(null)}>
                  Cancel
                </button>
                <button
                  className={`btn ${targetShop.isActive ? 'btn-danger' : 'btn-success'}`}
                  onClick={handleConfirmStatusToggle}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting ? 'Processing...' : targetShop.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shop Inspection Modal / Drawer */}
        {inspectShop && (
          <div className="modal-backdrop" onClick={() => setInspectShop(null)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 className="inspect-modal-title">🏬 {inspectShop.shopName}</h3>
                  <span className="inspect-subtitle">
                    Owner: {inspectShop.ownerId?.name} ({inspectShop.ownerId?.email})
                  </span>
                </div>
                <button className="modal-close-btn" onClick={() => setInspectShop(null)}>✕</button>
              </div>

              <div className="modal-body">
                {inspectLoading ? (
                  <div className="inspect-loading">Fetching shop dossier and inventory...</div>
                ) : (
                  <div className="inspect-layout">
                    {/* Shop Meta Info */}
                    <div className="inspect-meta-grid">
                      <div className="meta-item">
                        <span className="meta-lbl">Operating Status</span>
                        <span className={`status-pill ${inspectShop.isActive ? 'status-active' : 'status-inactive'}`}>
                          {inspectShop.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Compliance</span>
                        <span className={`compliance-tag tag-${(inspectShop.approvalStatus || 'PENDING').toLowerCase()}`}>
                          {inspectShop.approvalStatus}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Location</span>
                        <span className="meta-val">
                          {inspectShop.address?.city || inspectShop.city}, {inspectShop.address?.state || inspectShop.state}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-lbl">Phone</span>
                        <span className="meta-val">{inspectShop.ownerId?.phone || inspectShop.phone || '—'}</span>
                      </div>
                      {inspectShop.deactivationReason && (
                        <div className="meta-item full-width deactivation-notice">
                          <span className="meta-lbl">Last Deactivation Reason:</span>
                          <span className="reason-val">{inspectShop.deactivationReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Inventory Items Preview */}
                    <div className="inspect-inventory-section">
                      <h4 className="inspect-subhead">
                        Inventory Listings ({inspectParts.length} loaded)
                      </h4>

                      {inspectParts.length === 0 ? (
                        <div className="empty-inventory">This shop has no spare parts listings.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="inspect-table">
                            <thead>
                              <tr>
                                <th>Part Name</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Published</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inspectParts.map((part) => (
                                <tr key={part._id}>
                                  <td>
                                    <strong>{part.partName}</strong>
                                    <div className="subtext">#{part.partNumber || '—'}</div>
                                  </td>
                                  <td>{part.category}</td>
                                  <td>₹{part.price?.toLocaleString('en-IN')}</td>
                                  <td>
                                    <span className={part.stockQuantity > 0 ? 'stock-ok' : 'stock-out'}>
                                      {part.stockQuantity} in stock
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-pill ${part.isPublished ? 'status-active' : 'status-inactive'}`}>
                                      {part.isPublished ? 'Published' : 'Hidden'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setInspectShop(null)}>
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

export default AdminShopsPage;
