import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyInventory, deletePartApi, updatePartApi } from '../services/api';
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
    publishedCount: 0,
    draftCount: 0,
    inStockCount: 0,
    outOfStockCount: 0,
    lowStockCount: 0
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedVehicleType, setSelectedVehicleType] = useState('ALL');
  const [selectedCondition, setSelectedCondition] = useState('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState('ALL');
  const [selectedPublication, setSelectedPublication] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete modal state
  const [deletingPart, setDeletingPart] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Quick Price & Stock Edit state
  const [quickEditPart, setQuickEditPart] = useState(null);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickStock, setQuickStock] = useState('');
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);

  // View Part modal & Toggle Publish state
  const [viewingPart, setViewingPart] = useState(null);
  const [togglingPublishId, setTogglingPublishId] = useState(null);

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
      if (selectedCondition !== 'ALL') params.condition = selectedCondition;
      if (selectedAvailability !== 'ALL') params.availability = selectedAvailability;
      if (selectedPublication !== 'ALL') params.publication = selectedPublication;
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
  }, [currentPage, searchQuery, selectedCategory, selectedVehicleType, selectedCondition, selectedAvailability, selectedPublication, selectedStatus, sortBy]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadInventory();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedVehicleType('ALL');
    setSelectedCondition('ALL');
    setSelectedAvailability('ALL');
    setSelectedPublication('ALL');
    setSelectedStatus('ALL');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleOpenQuickEdit = (part) => {
    setQuickEditPart(part);
    setQuickPrice(String(part.price ?? ''));
    setQuickStock(String(part.stockQuantity ?? '0'));
    setError('');
  };

  const handleSaveQuickEdit = async (e) => {
    e.preventDefault();
    if (!quickEditPart) return;

    const numPrice = parseFloat(quickPrice);
    const numStock = parseInt(quickStock, 10);

    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid non-negative selling price in INR.');
      return;
    }
    if (isNaN(numStock) || numStock < 0) {
      setError('Please enter a valid non-negative stock quantity.');
      return;
    }

    try {
      setSavingQuickEdit(true);
      setError('');
      const res = await updatePartApi(quickEditPart._id, {
        price: numPrice,
        stockQuantity: numStock
      });

      if (res.success) {
        setParts((prev) =>
          prev.map((p) =>
            p._id === quickEditPart._id
              ? {
                  ...p,
                  price: numPrice,
                  stockQuantity: numStock,
                  availabilityStatus: numStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'
                }
              : p
          )
        );
        setSuccessMessage(`Updated price to ₹${numPrice.toLocaleString('en-IN')} and stock to ${numStock} for "${quickEditPart.partName}".`);
        setTimeout(() => setSuccessMessage(''), 4000);
        setQuickEditPart(null);
        loadInventory();
      } else {
        setError(res.error || 'Failed to update price and stock.');
      }
    } catch {
      setError('An error occurred while updating price and stock.');
    } finally {
      setSavingQuickEdit(false);
    }
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

  const handleTogglePublish = async (part) => {
    try {
      setTogglingPublishId(part._id);
      setError('');
      const newStatus = !part.isPublished;
      const res = await updatePartApi(part._id, { isPublished: newStatus });
      if (res.success) {
        setParts((prev) =>
          prev.map((p) => (p._id === part._id ? { ...p, isPublished: newStatus } : p))
        );
        setSuccessMessage(`Listing "${part.partName}" is now ${newStatus ? 'Published to marketplace' : 'saved as Draft'}.`);
        setTimeout(() => setSuccessMessage(''), 3500);
      } else {
        setError(res.error || 'Failed to update publication status.');
      }
    } catch {
      setError('An error occurred while updating publication status.');
    } finally {
      setTogglingPublishId(null);
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
            <Link to="/owner/inventory/add" className="btn btn-primary add-part-cta" id="owner-add-part-btn">
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

        {/* Overview Metric Cards (Exact 5 Categories from Module Requirements) */}
        <div className="inventory-stats-grid">
          <div
            className={`stat-card ${selectedStatus === 'ALL' && selectedAvailability === 'ALL' && selectedPublication === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedAvailability('ALL');
              setSelectedPublication('ALL');
              setCurrentPage(1);
            }}
          >
            <div className="stat-icon-wrap icon-navy">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Parts</span>
              <span className="stat-number">{stats.totalParts || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedPublication === 'PUBLISHED' ? 'active-filter' : ''}`}
            onClick={() => {
              setSelectedPublication('PUBLISHED');
              setSelectedStatus('ALL');
              setSelectedAvailability('ALL');
              setCurrentPage(1);
            }}
          >
            <div className="stat-icon-wrap icon-green">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Published Parts</span>
              <span className="stat-number stat-green">{stats.publishedCount || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedPublication === 'DRAFT' ? 'active-filter' : ''}`}
            onClick={() => {
              setSelectedPublication('DRAFT');
              setSelectedStatus('ALL');
              setSelectedAvailability('ALL');
              setCurrentPage(1);
            }}
          >
            <div className="stat-icon-wrap icon-gray">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Unpublished Parts</span>
              <span className="stat-number">{stats.draftCount || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedAvailability === 'LOW_STOCK' ? 'active-filter' : ''}`}
            onClick={() => {
              setSelectedAvailability('LOW_STOCK');
              setSelectedStatus('ALL');
              setSelectedPublication('ALL');
              setCurrentPage(1);
            }}
          >
            <div className="stat-icon-wrap icon-orange">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Low-Stock (≤ 3)</span>
              <span className="stat-number stat-orange">{stats.lowStockCount || 0}</span>
            </div>
          </div>

          <div
            className={`stat-card ${selectedAvailability === 'OUT_OF_STOCK' ? 'active-filter' : ''}`}
            onClick={() => {
              setSelectedAvailability('OUT_OF_STOCK');
              setSelectedStatus('ALL');
              setSelectedPublication('ALL');
              setCurrentPage(1);
            }}
          >
            <div className="stat-icon-wrap icon-red">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Out-of-Stock</span>
              <span className="stat-number stat-red">{stats.outOfStockCount || 0}</span>
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
                placeholder="Search by part name or part number..."
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
              <label htmlFor="inv-cond-filter">Condition:</label>
              <select
                id="inv-cond-filter"
                className="filter-select"
                value={selectedCondition}
                onChange={(e) => { setSelectedCondition(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Conditions</option>
                <option value="NEW">New</option>
                <option value="USED">Used</option>
              </select>
            </div>

            <div className="dropdown-control">
              <label htmlFor="inv-avail-filter">Availability:</label>
              <select
                id="inv-avail-filter"
                className="filter-select"
                value={selectedAvailability}
                onChange={(e) => { setSelectedAvailability(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock (≤ 3)</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>

            <div className="dropdown-control">
              <label htmlFor="inv-pub-filter">Publication:</label>
              <select
                id="inv-pub-filter"
                className="filter-select"
                value={selectedPublication}
                onChange={(e) => { setSelectedPublication(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="DRAFT">Draft / Unpublished</option>
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

            {(searchQuery || selectedCategory !== 'ALL' || selectedVehicleType !== 'ALL' || selectedCondition !== 'ALL' || selectedAvailability !== 'ALL' || selectedPublication !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                type="button"
                className="btn btn-outline reset-filters-btn"
                onClick={handleResetFilters}
                title="Reset all search filters"
              >
                Reset Filters
              </button>
            )}
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
              <Link to="/owner/inventory/add" className="btn btn-primary">
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="price-tag">₹{Number(part.price).toLocaleString('en-IN')}</span>
                            <button
                              type="button"
                              className="quick-edit-icon-btn"
                              title="Quick update price & stock"
                              onClick={() => handleOpenQuickEdit(part)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              ✎
                            </button>
                          </div>
                        </td>

                        {/* Stock Quantity */}
                        <td>
                          <div className="stock-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`stock-count ${isOutOfStock ? 'stock-zero' : isLowStock ? 'stock-low' : 'stock-ok'}`}>
                              {part.stockQuantity} units
                            </span>
                            {isLowStock && <span className="low-stock-pill">Low Stock</span>}
                            <button
                              type="button"
                              className="quick-edit-icon-btn"
                              title="Quick update stock"
                              onClick={() => handleOpenQuickEdit(part)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              ✎
                            </button>
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
                          <button
                            type="button"
                            className={`publish-toggle-btn ${part.isPublished ? 'pub-active' : 'pub-draft'}`}
                            title={part.isPublished ? 'Click to unpublish (switch to Draft)' : 'Click to publish on marketplace'}
                            disabled={togglingPublishId === part._id}
                            onClick={() => handleTogglePublish(part)}
                          >
                            {togglingPublishId === part._id ? 'Updating...' : part.isPublished ? '● Published' : '○ Draft'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="action-btn-view"
                              title="View Full Part Details"
                              onClick={() => setViewingPart(part)}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="13" r="3"></circle>
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="action-btn-quick"
                              title="Quick Update Price & Stock"
                              onClick={() => handleOpenQuickEdit(part)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-orange-primary)',
                                cursor: 'pointer'
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                              </svg>
                            </button>

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

      {/* View Spare Part Modal */}
      {viewingPart && (
        <div className="modal-backdrop fade-in" onClick={() => setViewingPart(null)}>
          <div className="modal-card view-part-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head-row">
              <div>
                <span className="badge badge-orange">{viewingPart.category}</span>
                <span className="badge badge-navy" style={{ marginLeft: '6px' }}>{viewingPart.vehicleType}</span>
                <h3>{viewingPart.partName}</h3>
                <span className="part-subhead">{viewingPart.manufacturer} • SKU: {viewingPart.partNumber}</span>
              </div>
              <button
                type="button"
                className="close-modal-x"
                onClick={() => setViewingPart(null)}
              >
                ×
              </button>
            </div>

            <div className="view-part-body">
              {/* Product Photos */}
              {viewingPart.imagePaths && viewingPart.imagePaths.length > 0 ? (
                <div className="modal-part-gallery">
                  {viewingPart.imagePaths.map((img, idx) => (
                    <div key={idx} className="gallery-thumb">
                      <img src={img} alt={`Part ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-images-notice">No product photographs uploaded for this item.</p>
              )}

              {/* Specifications Matrix */}
              <div className="specs-grid">
                <div className="spec-item">
                  <span className="spec-label">Selling Price (Owner Set)</span>
                  <span className="spec-val price-val">₹{Number(viewingPart.price).toLocaleString('en-IN')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Available Stock</span>
                  <span className="spec-val">{viewingPart.stockQuantity} units ({viewingPart.availabilityStatus || 'IN_STOCK'})</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Condition</span>
                  <span className="spec-val">{viewingPart.condition || 'NEW'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Marketplace Status</span>
                  <span className="spec-val">{viewingPart.isPublished ? '● Published' : '○ Draft'}</span>
                </div>
                {viewingPart.barcode && (
                  <div className="spec-item">
                    <span className="spec-label">Barcode / UPC</span>
                    <span className="spec-val">{viewingPart.barcode}</span>
                  </div>
                )}
                {viewingPart.subcategory && (
                  <div className="spec-item">
                    <span className="spec-label">Subcategory</span>
                    <span className="spec-val">{viewingPart.subcategory}</span>
                  </div>
                )}
              </div>

              {/* Compatibility info */}
              {(viewingPart.compatibleMakes?.length > 0 || viewingPart.compatibleModels?.length > 0) && (
                <div className="compatibility-block">
                  <strong>Vehicle Compatibility:</strong>
                  <p>
                    Makes: {viewingPart.compatibleMakes?.join(', ') || 'Any'} | Models: {viewingPart.compatibleModels?.join(', ') || 'Any'}
                    {viewingPart.compatibleYears?.length > 0 && ` | Years: ${viewingPart.compatibleYears.join(', ')}`}
                  </p>
                </div>
              )}

              {/* Description */}
              {viewingPart.description && (
                <div className="description-block">
                  <strong>Description & Specifications:</strong>
                  <p>{viewingPart.description}</p>
                </div>
              )}

              {/* Notes */}
              {viewingPart.notes && (
                <div className="notes-block">
                  <strong>Dealer & Warehouse Notes:</strong>
                  <p>{viewingPart.notes}</p>
                </div>
              )}
            </div>

            <div className="modal-actions-row" style={{ marginTop: '20px' }}>
              {viewingPart.isPublished && (
                <Link
                  to={`/parts/${viewingPart._id}`}
                  className="btn btn-outline"
                  target="_blank"
                >
                  View Marketplace Listing ↗
                </Link>
              )}
              <Link
                to={`/owner/inventory/${viewingPart._id}/edit`}
                className="btn btn-primary"
              >
                Edit Spare Part Listing
              </Link>
              <button
                type="button"
                className="btn btn-outline-navy"
                onClick={() => setViewingPart(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Quick Price & Stock Edit Modal */}
      {quickEditPart && (
        <div className="modal-backdrop fade-in" onClick={() => setQuickEditPart(null)}>
          <div className="modal-card quick-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head-row">
              <div>
                <span className="badge badge-orange">Quick Adjustment</span>
                <h3 style={{ margin: '6px 0 2px' }}>Update Price & Stock</h3>
                <span className="part-subhead" style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {quickEditPart.partName} • SKU: {quickEditPart.partNumber}
                </span>
              </div>
              <button
                type="button"
                className="close-modal-x"
                onClick={() => setQuickEditPart(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} className="quick-edit-form" style={{ marginTop: '16px' }}>
              <div
                style={{
                  background: 'rgba(255, 101, 0, 0.08)',
                  border: '1px solid rgba(255, 101, 0, 0.25)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  lineHeight: '1.45',
                  color: 'var(--color-navy-primary)'
                }}
              >
                <strong>Owner-Controlled Pricing:</strong> The store owner manually sets and controls all spare-part prices. AI never decides, overrides, or predicts your pricing.
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="quick-price" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                  Selling Price (₹ INR) *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>₹</span>
                  <input
                    id="quick-price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    style={{ paddingLeft: '28px', width: '100%' }}
                    value={quickPrice}
                    onChange={(e) => setQuickPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="quick-stock" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                  Available Stock Quantity *
                </label>
                <input
                  id="quick-stock"
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={quickStock}
                  onChange={(e) => setQuickStock(e.target.value)}
                  required
                />
                <span className="field-hint" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                  Items with 0 quantity automatically show as OUT OF STOCK on customer search.
                </span>
              </div>

              <div className="modal-actions-row" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={savingQuickEdit}
                  onClick={() => setQuickEditPart(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingQuickEdit}
                >
                  {savingQuickEdit ? 'Saving...' : 'Save Price & Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerInventoryPage;
