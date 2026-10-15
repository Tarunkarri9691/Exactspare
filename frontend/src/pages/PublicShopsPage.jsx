import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicShops } from '../services/api';
import './PublicShopsPage.css';

const CATEGORIES = ['ALL', 'BIKE', 'CAR', 'SCOOTER', 'BICYCLE', 'MULTI_CATEGORY', 'OTHER'];

const PublicShopsPage = () => {
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, pages: 1 });
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadShops = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: currentPage,
        limit: 12
      };

      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (cityQuery.trim()) params.city = cityQuery.trim();

      const res = await fetchPublicShops(params);
      if (res.success) {
        setShops(res.data.shops || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 12, pages: 1 });
      } else {
        setError(res.error || 'Failed to load verified retail shops.');
      }
    } catch {
      setError('An error occurred while connecting to the marketplace.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory, searchQuery, cityQuery]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadShops();
  };

  return (
    <div className="public-shops-page-root">
      <div className="container public-shops-container">
        {/* Hero Banner */}
        <div className="shops-hero-banner">
          <span className="badge badge-orange">Verified Retail Network</span>
          <h1 className="shops-hero-title">Find Vehicle Spare Parts Shops Near You</h1>
          <p className="shops-hero-subtitle">
            Browse authenticated automotive spare parts retailers, OEM component dealers, and certified service inventory hubs.
          </p>

          {/* Search & Filters */}
          <form className="shops-search-bar-form" onSubmit={handleSearchSubmit}>
            <div className="search-input-group">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search shop name, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="search-input-group city-input-group">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <input
                type="text"
                placeholder="Filter by city (e.g. Pune, Mumbai)..."
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary search-btn">
              Search Retailers
            </button>
          </form>

          {/* Category Filter Pills */}
          <div className="category-pills-row">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-pill-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
              >
                {cat === 'ALL' ? 'All Retailers' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Alert */}
        {error && (
          <div className="auth-alert error-alert fade-in">
            <span>{error}</span>
          </div>
        )}

        {/* Shop Cards Grid */}
        {loading ? (
          <div className="shops-loading-state">
            <div className="auth-spinner">
              <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
              </svg>
            </div>
            <p>Locating verified spare parts retailers...</p>
          </div>
        ) : shops.length === 0 ? (
          <div className="shops-empty-state">
            <div className="empty-icon-wrap">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h3>No Verified Shops Found</h3>
            <p>No verified retail stores matched your current search filters. Try clearing your search query or city.</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setSearchQuery(''); setCityQuery(''); setSelectedCategory('ALL'); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="shops-grid">
            {shops.map((shop) => {
              const photo = shop.images && shop.images.length > 0
                ? shop.images[0]
                : null;

              return (
                <div key={shop._id} className="public-shop-card fade-in">
                  <div className="card-thumb-wrap">
                    {photo ? (
                      <img src={photo} alt={shop.name} />
                    ) : (
                      <div className="no-photo-box">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>No Photo</span>
                      </div>
                    )}
                    <span className="card-category-tag">{shop.category}</span>
                  </div>

                  <div className="card-body">
                    <div className="card-header-row">
                      <h3 className="card-shop-name" title={shop.name}>{shop.name}</h3>
                      <span className="verified-badge-mini" title="Verified Retail Partner">✔</span>
                    </div>

                    <p className="card-shop-desc" title={shop.description}>
                      {shop.description}
                    </p>

                    <div className="card-meta-list">
                      <div className="meta-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>{shop.address?.city || 'Pune'}, {shop.address?.state || 'MH'}</span>
                      </div>

                      <div className="meta-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span className="hours-truncate">{shop.openingHours || 'Mon-Sat 9AM-8PM'}</span>
                      </div>

                      <div className="meta-item catalog-count-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                        <strong>{shop.availableProductsCount || 0} In-Stock Parts</strong>
                      </div>
                    </div>

                    <div className="card-footer">
                      <Link to={`/shops/${shop._id}`} className="btn btn-primary btn-block">
                        Browse Shop Parts
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
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} verified shops)
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

export default PublicShopsPage;
