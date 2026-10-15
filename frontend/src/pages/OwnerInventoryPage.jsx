import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyInventory, deletePartApi } from '../services/api';
import './OwnerInventoryPage.css';

const CATEGORIES = [
  'ALL',
  'Engine',
  'Brakes',
  'Transmission',
  'Suspension',
  'Electrical',
  'Body & Panels',
  'Steering',
  'Exhaust',
  'Lighting',
  'Cooling',
  'Fuel System',
  'Maintenance & Fluids',
  'Accessories',
  'Other'
];

const VEHICLE_TYPES = ['ALL', 'Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];

const OwnerInventoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [parts, setParts] = useState([]);
  const [stats, setStats] = useState({
    totalParts: 0,
    inStockCount: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    draftCount: 0
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedVehicleType, setSelectedVehicleType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete modal state
  const [deletingPart, setDeletingPart] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 10,
        sortBy
      };

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedVehicleType !== 'ALL') params.vehicleType = selectedVehicleType;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const res = await fetchMyInventory(params);
      if (res.success) {
        setParts(res.data.parts || []);
        setStats(res.data.stats || {});
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
      } else {
        setError(res.error || 'Failed to load inventory.');
      }
    } catch {
      setError('An error occurred while connecting to the server.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, selectedCategory, selectedVehicleType, selectedStatus, sortBy]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadInventory();
  };

  const handleConfirmDelete = async () => {
    if (!deletingPart) return;
    try {
      setSubmittingDelete(true);
      const res = await deletePartApi(deletingPart._id);
      if (res.success) {
        setSuccessMessage(`"${deletingPart.partName}" has been safely removed from your active inventory.`);
        setDeletingPart(null);
        loadInventory();
      } else {
        setError(res.error || 'Failed to delete spare part.');
      }
    } catch {
      setError('An error occurred while attempting to delete.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="inventory-page-root">
      <div className="container inventory-container">
        {/* Page Top Header */}
        <div className="inventory-header">
          <div className="header-meta">
            <span className="badge badge-orange">Merchant Hub</span>
            <h1 className="inventory-title">Spare-Part Inventory Management</h1>
            <p className="inventory-subtitle">
              Manage your automotive listings, monitor real-time stock levels, update pricing, and publish new genuine parts.
            </p>
          </div>
          <div className="header-actions">
            <Link to="/owner/shop" className="btn btn-outline-navy">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              My Shop Profile
            </Link>
            <Link to="/owner/inventory/new" className="btn btn-primary add-part-cta">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add New Spare Part
            </Link>
          </div>
        </div>

        {/* Global Alert Banners */}
        {successMessage && (
          <div className="auth-alert success-alert fade-in" style={{ borderColor: 'var(--color-status-approved)', color: 'var(--color-status-approved)' }}>
            <span>{successMessage}</span>
            <button type="button" className="close-notice-btn" onClick={() => setSuccessMessage('')}>×</button>
          </div>
        )}

        {error && (
          <div className="auth-alert error-alert fade-in">
            <span>{error}</span>
            <button type="button" className="close-notice-btn" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Overview Metric Cards */}
        <div className="inventory-stats-grid">
          <div
            className={`stat-card ${selectedStatus === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => { setSelectedStatus('ALL'); setCurrentPage(1); }}
          >
            <div className="stat-icon-wrap icon-navy">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Catalog</span>
              <span className="stat-number">{stats.totalParts || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedStatus === 'IN_STOCK' ? 'active-filter' : ''}`}
            onClick={() => { setSelectedStatus('IN_STOCK'); setCurrentPage(1); }}
          >
            <div className="stat-icon-wrap icon-green">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">In Stock</span>
              <span className="stat-number stat-green">{stats.inStockCount || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedStatus === 'OUT_OF_STOCK' ? 'active-filter' : ''}`}
            onClick={() => { setSelectedStatus('OUT_OF_STOCK'); setCurrentPage(1); }}
          >
            <div className="stat-icon-wrap icon-red">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Out of Stock</span>
              <span className="stat-number stat-red">{stats.outOfStockCount || 0}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap icon-orange">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Low Stock (≤ 3)</span>
              <span className="stat-number stat-orange">{stats.lowStockCount || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedStatus === 'DRAFT' ? 'active-filter' : ''}`}
            onClick={() => { setSelectedStatus('DRAFT'); setCurrentPage(1); }}
          >
            <div className="stat-icon-wrap icon-gray">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Drafts</span>
              <span className="stat-number">{stats.draftCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="inventory-filters-card">
          <form className="inv-search-form" onSubmit={handleSearchSubmit}>
            <div className="search-wrap">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by part name, SKU, or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-outline filter-search-btn">
              Search
            </button>
          </form>

          <div className="inv-dropdowns-row">
            <div className="dropdown-control">
              <label htmlFor="inv-cat-filter">Category:</label>
              <select
                id="inv-cat-filter"
                className="filter-select"
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>

            <div className="dropdown-control">
              <label htmlFor="inv-veh-filter">Vehicle Type:</label>
              <select
                id="inv-veh-filter"
                className="filter-select"
                value={selectedVehicleType}
                onChange={(e) => { setSelectedVehicleType(e.target.value); setCurrentPage(1); }}
              >
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>{v === 'ALL' ? 'All Vehicles' : v}</option>
                ))}
              </select>
            </div>

            <div className="dropdown-control">
              <label htmlFor="inv-sort-filter">Sort By:</label>
              <select
                id="inv-sort-filter"
                className="filter-select"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="stock_asc">Stock: Low to High</option>
                <option value="stock_desc">Stock: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Data Table Card */}
        <div className="inventory-table-card">
          {loading ? (
            <div className="inv-loading-state">
              <div className="auth-spinner">
                <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                  <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                  <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
                </svg>
              </div>
              <p>Loading inventory catalogue...</p>
            </div>
          ) : parts.length === 0 ? (
            <div className="inv-empty-state">
              <div className="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </div>
              <h3>No Spare Parts Found</h3>
              <p>
                {searchQuery || selectedCategory !== 'ALL' || selectedVehicleType !== 'ALL' || selectedStatus !== 'ALL'
                  ? 'No spare parts matched your selected filter criteria. Try clearing search filters.'
                  : 'You have not added any spare parts to your inventory catalogue yet.'}
              </p>
              <Link to="/owner/inventory/new" className="btn btn-primary">
                Add Your First Spare Part
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Part Number</th>
                    <th>Category & Vehicle</th>
                    <th>Price (₹)</th>
                    <th>Available Stock</th>
                    <th>Status</th>
                    <th>Publication</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part) => {
                    const isOutOfStock = part.stockQuantity <= 0;
                    const isLowStock = part.stockQuantity > 0 && part.stockQuantity <= 3;
                    const thumbUrl = part.imagePaths && part.imagePaths.length > 0
                      ? part.imagePaths[0]
                      : null;

                    return (
                      <tr key={part._id} className="inventory-row">
                        {/* Product Thumbnail & Name */}
                        <td>
                          <div className="product-cell">
                            <div className="product-thumb">
                              {thumbUrl ? (
                                <img src={thumbUrl} alt={part.partName} />
                              ) : (
                                <div className="no-thumb-placeholder">
                                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="product-title-wrap">
                              <span className="product-name" title={part.partName}>{part.partName}</span>
                              <span className="product-mfg">{part.manufacturer} • {part.condition}</span>
                            </div>
                          </div>
                        </td>

                        {/* Part Number / SKU */}
                        <td>
                          <code className="part-sku-badge">{part.partNumber}</code>
                        </td>

                        {/* Category & Vehicle */}
                        <td>
                          <div className="cat-cell">
                            <span className="cat-name">{part.category}</span>
                            <span className="badge badge-navy veh-badge">{part.vehicleType}</span>
                          </div>
                        </td>

                        {/* Price in INR */}
                        <td>
                          <span className="price-tag">₹{Number(part.price).toLocaleString('en-IN')}</span>
                        </td>

                        {/* Stock Quantity */}
                        <td>
                          <div className="stock-cell">
                            <span className={`stock-count ${isOutOfStock ? 'stock-zero' : isLowStock ? 'stock-low' : 'stock-ok'}`}>
                              {part.stockQuantity} units
                            </span>
                            {isLowStock && <span className="low-stock-pill">Low Stock</span>}
                          </div>
                        </td>

                        {/* Availability Status */}
                        <td>
                          {isOutOfStock ? (
                            <span className="badge badge-danger">OUT OF STOCK</span>
                          ) : (
                            <span className="badge badge-green">IN STOCK</span>
                          )}
                        </td>

                        {/* Publication Status */}
                        <td>
                          {part.isPublished ? (
                            <span className="publish-badge pub-active">Published</span>
                          ) : (
                            <span className="publish-badge pub-draft">Draft</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="row-actions">
                            <Link
                              to={`/parts/${part._id}`}
                              className="action-btn-view"
                              title="View Public Listing"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </Link>

                            <Link
                              to={`/owner/inventory/${part._id}/edit`}
                              className="action-btn-edit"
                              title="Edit Spare Part"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </Link>

                            <button
                              type="button"
                              className="action-btn-delete"
                              title="Remove Part Listing"
                              onClick={() => setDeletingPart(part)}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
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

          {/* Pagination Bar */}
          {pagination.pages > 1 && (
            <div className="inv-pagination-bar">
              <span className="pagination-info">
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total items)
              </span>
              <div className="pagination-btns">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={currentPage >= pagination.pages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPart && (
        <div className="modal-backdrop fade-in">
          <div className="modal-card confirm-delete-modal">
            <div className="modal-icon-danger">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>Remove Spare Part Listing?</h3>
            <p>
              Are you sure you want to remove <strong>"{deletingPart.partName}"</strong> (Part #{deletingPart.partNumber}) from active inventory?
            </p>
            <p className="modal-subtext">
              This action safely archives the item so historical customer orders and reservation logs remain unbroken.
            </p>
            <div className="modal-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                disabled={submittingDelete}
                onClick={() => setDeletingPart(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={submittingDelete}
                onClick={handleConfirmDelete}
              >
                {submittingDelete ? 'Archiving Listing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerInventoryPage;
