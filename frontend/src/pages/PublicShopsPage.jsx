import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicShops } from '../services/api';
import SearchResultsMapView from '../components/SearchResultsMapView';
import './PublicShopsPage.css';

const CATEGORIES = ['ALL', 'BIKE', 'CAR', 'SCOOTER', 'BICYCLE', 'MULTI_CATEGORY', 'OTHER'];
const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

const PublicShopsPage = () => {
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, pages: 1 });
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [partQuery, setPartQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  
  // Geolocation state
  const [userCoords, setUserCoords] = useState(null); // { latitude, longitude, name }
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState('');
  
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
      if (partQuery.trim()) params.partQuery = partQuery.trim();

      if (userCoords?.latitude && userCoords?.longitude) {
        params.latitude = userCoords.latitude;
        params.longitude = userCoords.longitude;
        params.radiusKm = radiusKm;
      }

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
  }, [currentPage, selectedCategory, searchQuery, cityQuery, partQuery, userCoords, radiusKm]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadShops();
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser. Please enter your city or postal code manually.');
      return;
    }

    setGeoLoading(true);
    setGeoNotice('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          name: 'My GPS Location'
        });
        setCurrentPage(1);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoNotice('Location permission was denied. You can filter shops by typing your city name or PIN code.');
        } else if (err.code === 2) {
          setGeoNotice('Location unavailable. Please enter your city manually.');
        } else {
          setGeoNotice('Could not retrieve location. Please search by city instead.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleClearLocation = () => {
    setUserCoords(null);
    setGeoNotice('');
    setCurrentPage(1);
  };

  return (
    <div className="public-shops-page-root">
      <div className="container public-shops-container">
        {/* Hero Banner */}
        <div className="shops-hero-banner">
          <span className="badge badge-orange">Verified Retail Network</span>
          <h1 className="shops-hero-title">Find Vehicle Spare Parts Shops Near You</h1>
          <p className="shops-hero-subtitle">
            Locate authenticated automotive retailers, OEM component dealers, and in-stock inventory hubs in your area with live interactive mapping.
          </p>

          {/* Search & Location Bar */}
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
                placeholder="City or PIN (e.g. Pune, 411001)..."
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
              />
            </div>

            <div className="search-input-group part-input-group">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              <input
                type="text"
                placeholder="Part in stock (e.g. Brake Pads)..."
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary search-btn">
              Search Retailers
            </button>
          </form>

          {/* Quick Location & Controls Strip */}
          <div className="shops-controls-strip">
            <div className="location-btn-group">
              {!userCoords ? (
                <button
                  type="button"
                  className="btn btn-outline btn-gps"
                  onClick={handleRequestLocation}
                  disabled={geoLoading}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="12 2 12 6 12 18 12 22"></polygon>
                    <polygon points="2 12 6 12 18 12 22 12"></polygon>
                  </svg>
                  {geoLoading ? 'Acquiring GPS...' : 'Use My GPS Location'}
                </button>
              ) : (
                <div className="active-location-pill">
                  <span className="gps-indicator-dot"></span>
                  <span>GPS Active (within {radiusKm} km)</span>
                  <select
                    className="radius-select"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    aria-label="Search Radius"
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r} km radius</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="clear-gps-btn"
                    onClick={handleClearLocation}
                    title="Clear GPS filter"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="view-toggle-group">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                title="Interactive Map View"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                  <line x1="8" y1="2" x2="8" y2="18"></line>
                  <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                <span>Live Map</span>
              </button>
            </div>
          </div>

          {/* Location Notice / Feedback */}
          {geoNotice && (
            <div className="geo-notice-banner fade-in">
              <span>ℹ️ {geoNotice}</span>
            </div>
          )}

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
            <button type="button" className="btn btn-sm btn-outline retry-btn" onClick={loadShops}>
              Retry
            </button>
          </div>
        )}

        {/* Interactive Map View */}
        {viewMode === 'map' && !loading && (
          <div className="shops-map-view-container fade-in">
            <SearchResultsMapView
              shops={shops}
              userLocation={userCoords}
              radiusKm={radiusKm}
              height="520px"
            />
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
            <p>No verified retail stores matched your search filters. Try expanding your search radius or clearing search filters.</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setSearchQuery(''); setCityQuery(''); setPartQuery(''); setSelectedCategory('ALL'); setUserCoords(null); }}
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="shops-grid">
            {shops.map((shop) => {
              const photo = shop.images && shop.images.length > 0
                ? shop.images[0]
                : null;

              const lat = shop.latitude || (Array.isArray(shop.coordinates) ? shop.coordinates[1] : null);
              const lng = shop.longitude || (Array.isArray(shop.coordinates) ? shop.coordinates[0] : null);
              const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
              const directionsUrl = hasCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                : null;

              return (
                <div key={shop._id} className="public-shop-card fade-in">
                  <div className="card-thumb-wrap">
                    {photo ? (
                      <img src={photo} alt={shop.name} loading="lazy" />
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
                    {shop.distanceKm !== null && shop.distanceKm !== undefined && (
                      <span className="card-dist-badge">
                        📍 {shop.distanceKm} km away
                      </span>
                    )}
                  </div>

                  <div className="card-body">
                    <div className="card-header-row">
                      <h3 className="card-shop-name" title={shop.name}>{shop.name}</h3>
                      <span className="verified-badge-mini" title="Verified Retail Partner">✔</span>
                    </div>

                    <p className="card-shop-desc" title={shop.description}>
                      {shop.description || 'Verified automotive spare parts retailer.'}
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
                        <strong>
                          {shop.matchingProductsCount !== undefined
                            ? `${shop.matchingProductsCount} Matching Parts`
                            : `${shop.availableProductsCount || 0} In-Stock Parts`}
                        </strong>
                      </div>
                    </div>

                    <div className="card-actions-grid">
                      <Link to={`/shops/${shop._id}`} className="btn btn-primary btn-block">
                        Browse Shop Parts
                      </Link>
                      <Link
                        to={
                          userCoords?.latitude && userCoords?.longitude
                            ? `/shops/${shop._id}/directions?originLat=${userCoords.latitude}&originLng=${userCoords.longitude}`
                            : `/shops/${shop._id}/directions`
                        }
                        className="btn btn-outline btn-directions"
                        title="Get in-app road directions to this shop"
                      >
                        📍 Directions
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

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
