import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicParts } from '../services/api';
import './PublicPartsPage.css';

const VEHICLE_TYPES = ['ALL', 'Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];

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

const PublicPartsPage = () => {
  const [parts, setParts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, pages: 1 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCondition, setSelectedCondition] = useState('ALL');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadParts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 12,
        sortBy
      };

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedVehicleType !== 'ALL') params.vehicleType = selectedVehicleType;
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedCondition !== 'ALL') params.condition = selectedCondition;
      if (inStockOnly) params.inStockOnly = true;

      const res = await fetchPublicParts(params);
      if (res.success) {
        setParts(res.data.parts || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 12, pages: 1 });
      } else {
        setError(res.error || 'Failed to load spare parts marketplace.');
      }
    } catch {
      setError('An error occurred while connecting to the spare parts marketplace.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, selectedVehicleType, selectedCategory, selectedCondition, inStockOnly, sortBy]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadParts();
  };

  return (
    <div className="public-parts-page-root">
      <div className="container public-parts-container">
        {/* Marketplace Header */}
        <div className="parts-hero-banner">
          <span className="badge badge-orange">Verified Spare Parts Directory</span>
          <h1 className="parts-hero-title">Browse Vehicle Spare Parts & OEM Components</h1>
          <p className="parts-hero-subtitle">
            Find authentic replacement parts, brake components, engine systems, and electrical spares directly from verified local shops.
          </p>

          {/* Search Form */}
          <form className="parts-search-form" onSubmit={handleSearchSubmit}>
            <div className="search-field-wrap">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search part name, OEM SKU (e.g. Brembo P 28 076N), brand, or vehicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary search-submit-btn">
              Search Parts
            </button>
          </form>

          {/* Vehicle Type Tabs */}
          <div className="vehicle-tabs-row">
            {VEHICLE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`vehicle-tab-btn ${selectedVehicleType === type ? 'active' : ''}`}
                onClick={() => { setSelectedVehicleType(type); setCurrentPage(1); }}
              >
                {type === 'ALL' ? 'All Vehicles' : `${type} Parts`}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="parts-filters-bar">
          <div className="filter-dropdown-item">
            <label htmlFor="parts-cat-select">Category:</label>
            <select
              id="parts-cat-select"
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label htmlFor="parts-cond-select">Condition:</label>
            <select
              id="parts-cond-select"
              className="filter-select"
              value={selectedCondition}
              onChange={(e) => { setSelectedCondition(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Conditions</option>
              <option value="NEW">New (OEM / Aftermarket)</option>
              <option value="USED">Used / Refurbished</option>
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label htmlFor="parts-sort-select">Sort By:</label>
            <select
              id="parts-sort-select"
              className="filter-select"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="stock_desc">Highest Stock</option>
            </select>
          </div>

          <label className="checkbox-filter-label">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); }}
            />
            <span>In Stock Only</span>
          </label>
        </div>

        {/* Feedback Alert */}
        {error && (
          <div className="auth-alert error-alert fade-in">
            <span>{error}</span>
          </div>
        )}

        {/* Parts Grid */}
        {loading ? (
          <div className="parts-loading-state">
            <div className="auth-spinner">
              <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
              </svg>
            </div>
            <p>Scanning certified spare-part inventory...</p>
          </div>
        ) : parts.length === 0 ? (
          <div className="parts-empty-state">
            <div className="empty-icon-wrap">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h3>No Spare Parts Found</h3>
            <p>We could not find any parts matching your selected search and filters.</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedVehicleType('ALL');
                setSelectedCategory('ALL');
                setSelectedCondition('ALL');
                setInStockOnly(false);
              }}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="parts-catalog-grid">
            {parts.map((part) => {
              const thumbUrl = part.imagePaths && part.imagePaths.length > 0
                ? part.imagePaths[0]
                : null;
              const isOutOfStock = part.stockQuantity <= 0;
              const shopInfo = part.shopId;

              return (
                <div key={part._id} className="marketplace-part-card fade-in">
                  <div className="part-card-thumb">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={part.partName} />
                    ) : (
                      <div className="no-part-thumb-placeholder">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                    )}
                    <span className="card-veh-badge">{part.vehicleType}</span>
                    <span className="card-cond-badge">{part.condition}</span>
                  </div>

                  <div className="part-card-body">
                    <div className="mfg-sku-row">
                      <span className="part-mfg-text">{part.manufacturer}</span>
                      <code className="part-sku-code">{part.partNumber}</code>
                    </div>

                    <h3 className="part-name-title" title={part.partName}>
                      {part.partName}
                    </h3>

                    {/* Compatibility Preview */}
                    {part.compatibleMakes && part.compatibleMakes.length > 0 && (
                      <div className="compatibility-chips-preview">
                        <span className="compat-label">Fits:</span>
                        {part.compatibleMakes.slice(0, 2).map((make, idx) => (
                          <span key={idx} className="compat-chip">{make}</span>
                        ))}
                        {part.compatibleMakes.length > 2 && (
                          <span className="compat-more">+{part.compatibleMakes.length - 2} more</span>
                        )}
                      </div>
                    )}

                    {/* Shop Seller Meta */}
                    {shopInfo && (
                      <div className="seller-shop-row">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        <span className="shop-name-text">{shopInfo.name}</span>
                        <span className="shop-city-text">({shopInfo.address?.city || 'Pune'})</span>
                      </div>
                    )}

                    <div className="card-price-availability-row">
                      <span className="card-price-inr">₹{Number(part.price).toLocaleString('en-IN')}</span>
                      {isOutOfStock ? (
                        <span className="badge badge-danger">OUT OF STOCK</span>
                      ) : (
                        <span className="badge badge-green">IN STOCK ({part.stockQuantity})</span>
                      )}
                    </div>

                    <div className="part-card-cta">
                      <Link to={`/parts/${part._id}`} className="btn btn-primary btn-block">
                        View Details & Specifications
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="inv-pagination-bar">
            <span className="pagination-info">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} catalog parts)
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
  );
};

export default PublicPartsPage;
