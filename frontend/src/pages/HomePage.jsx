import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import SearchResultCard from '../components/SearchResultCard';
import SmartRecommendations from '../components/SmartRecommendations';
import { useVehicle } from '../context/VehicleContext';
import { fetchSearchMetadata, fetchRecentAvailableParts, fetchPublicShops } from '../services/api';
import './HomePage.css';

const STATIC_VEHICLE_CATEGORIES = [
  { id: 'Bike', title: 'Bike', subtitle: 'Motorcycles & commuter 2-wheelers.', icon: '🏍️' },
  { id: 'Car', title: 'Car', subtitle: 'Hatchbacks, sedans, compact SUVs.', icon: '🚗' },
  { id: 'Scooter', title: 'Scooter', subtitle: 'Gearless mopeds & e-scooters.', icon: '🛵' },
  { id: 'Bicycle', title: 'Bicycle', subtitle: 'Geared, road & MTB bicycles.', icon: '🚲' },
  { id: 'Other', title: 'Other', subtitle: 'Commercial, 3-wheelers & pickups.', icon: '🚚' }
];

const HomePage = () => {
  const [metadata, setMetadata] = useState(null);
  const [recentParts, setRecentParts] = useState([]);
  const [featuredShops, setFeaturedShops] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  const { vehicle, isVehicleSelected, displayLabel, openVehicleModal, updateVehicle } = useVehicle();
  const navigate = useNavigate();

  const loadHomeData = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      const [metaRes, recentRes, shopsRes] = await Promise.all([
        fetchSearchMetadata(),
        fetchRecentAvailableParts(8),
        fetchPublicShops({ limit: 4 })
      ]);

      if (metaRes.success && metaRes.data) {
        setMetadata(metaRes.data);
      }

      if (recentRes.success && recentRes.data) {
        setRecentParts(recentRes.data);
      }

      if (shopsRes.success && shopsRes.data?.shops) {
        setFeaturedShops(shopsRes.data.shops);
      }
    } catch {
      setLoadError('Failed to load marketplace catalog. Please check your connection and retry.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();

    // Load actual recently viewed history from local storage
    try {
      const raw = localStorage.getItem('exactspare_recently_viewed_parts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentlyViewed(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [loadHomeData]);

  const handleSelectVehicle = (vType) => {
    updateVehicle({ vehicleType: vType });
    navigate(`/parts?vehicleType=${vType}`);
  };

  const handleSelectCategory = (catName) => {
    const params = new URLSearchParams();
    params.set('category', catName);
    if (vehicle?.vehicleType && vehicle.vehicleType !== 'ALL') {
      params.set('vehicleType', vehicle.vehicleType);
    }
    navigate(`/parts?${params.toString()}`);
  };

  return (
    <div className="home-page-root">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container">
          <div className="hero-content">
            <div className="hero-badge-wrap">
              <span className="badge badge-navy">
                <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-orange-primary)' }}></span>
                EXACTSPARE • Vehicle Spare Parts Finder
              </span>
            </div>
            
            <h1 className="hero-title">
              Find Genuine Vehicle Spare Parts in Nearby Approved Shops
            </h1>

            <p className="hero-description">
              Directly match spare parts with verified local merchants across Bike, Car, Scooter, Bicycle, and Commercial categories.
            </p>

            {/* Quick Hero Actions: Prominent Find Shops CTA */}
            <div className="hero-cta-actions">
              <Link to="/shops" className="btn btn-primary hero-btn-shops">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Find Nearby Shops</span>
              </Link>
              <button
                type="button"
                className="btn btn-outline hero-btn-vehicle"
                onClick={openVehicleModal}
              >
                <span>🚘 {isVehicleSelected ? displayLabel : 'Select Your Vehicle'}</span>
              </button>
            </div>
          </div>

          {/* Prominent Search Bar with Vehicle & Location Selectors */}
          <div className="hero-search-wrapper">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Network Failure / Retry Banner */}
      {loadError && (
        <div className="container" style={{ marginTop: '24px' }}>
          <div className="auth-alert error-alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{loadError}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={loadHomeData}>
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Vehicle Spectrum Selector */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header">
            <div className="section-header-text">
              <span className="badge badge-orange">Vehicle Types</span>
              <h2 className="section-title">Select Your Vehicle Category</h2>
              <p className="section-subtitle">
                Filter compatible components specifically built for your vehicle class.
              </p>
            </div>
          </div>

          <div className="home-vehicle-grid">
            {STATIC_VEHICLE_CATEGORIES.map((veh) => {
              const matchedCount = metadata?.vehicleTypes?.find((v) => v.name === veh.id)?.count || 0;
              const isCurrent = vehicle?.vehicleType === veh.id;

              return (
                <div
                  key={veh.id}
                  className={`home-vehicle-card ${isCurrent ? 'active-vehicle-card' : ''}`}
                  onClick={() => handleSelectVehicle(veh.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelectVehicle(veh.id); }}
                >
                  <span className="veh-icon">{veh.icon}</span>
                  <div className="veh-info">
                    <h4>{veh.title}</h4>
                    <p>{veh.subtitle}</p>
                    <span className="veh-count-badge">
                      {matchedCount > 0 ? `${matchedCount} Parts Available` : 'Explore Catalog'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Categories Section (Real Database Data) */}
      <section className="popular-categories-section">
        <div className="container">
          <div className="section-header">
            <div className="section-header-text">
              <span className="badge badge-navy">Platform Catalog</span>
              <h2 className="section-title">Popular Part Categories</h2>
              <p className="section-subtitle">
                Based on active stock across verified local auto spare retailers.
              </p>
            </div>
            <Link to="/parts" className="btn btn-outline">
              View All Parts →
            </Link>
          </div>

          {metadata?.categories && metadata.categories.length > 0 ? (
            <div className="popular-categories-grid">
              {metadata.categories.slice(0, 8).map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  className="popular-cat-chip"
                  onClick={() => handleSelectCategory(cat.name)}
                >
                  <span className="chip-name">{cat.name}</span>
                  <span className="chip-count">{cat.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-catalog-notice">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>No inventory categories published yet. Approved shop owners will populate the live catalog.</p>
            </div>
          )}
        </div>
      </section>

      {/* Recently Viewed Products (Shown ONLY if genuine customer history exists) */}
      {recentlyViewed.length > 0 && (
        <section className="recent-parts-section recently-viewed-section">
          <div className="container">
            <div className="section-header">
              <div className="section-header-text">
                <span className="badge badge-navy">Your Browsing History</span>
                <h2 className="section-title">Recently Viewed Parts</h2>
                <p className="section-subtitle">
                  Continue where you left off from your previous product searches.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  localStorage.removeItem('exactspare_recently_viewed_parts');
                  setRecentlyViewed([]);
                }}
              >
                Clear History
              </button>
            </div>

            <div className="recent-parts-grid">
              {recentlyViewed.map((part) => (
                <SearchResultCard key={`rv-${part._id}`} part={part} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently Added Available Parts (Real Database Data) */}
      <section className="recent-parts-section">
        <div className="container">
          <div className="section-header">
            <div className="section-header-text">
              <span className="badge badge-green">Fresh Arrivals</span>
              <h2 className="section-title">Recently Added Available Parts</h2>
              <p className="section-subtitle">
                Live available inventory directly from approved auto spare merchants.
              </p>
            </div>
            <Link to="/parts?sortBy=newest" className="btn btn-outline">
              Explore All Parts →
            </Link>
          </div>

          {recentParts.length > 0 ? (
            <div className="recent-parts-grid">
              {recentParts.map((part) => (
                <SearchResultCard key={part._id} part={part} />
              ))}
            </div>
          ) : (
            <div className="empty-catalog-notice">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <h4>No Published Products Yet</h4>
              <p>Once approved shop owners publish spare parts with images, pricing, and compatibility, they will appear here in real time.</p>
            </div>
          )}
        </div>
      </section>

      {/* Module 10: Smart Recommendations & Top Verified Picks */}
      <section className="home-recommendations-wrapper">
        <div className="container">
          <SmartRecommendations
            title="Smart Recommendations & Top Picks"
            subtitle="Verified, in-stock components from approved local shops."
          />
        </div>
      </section>

      {/* Nearby Verified Retail Shops */}
      <section className="featured-shops-section">
        <div className="container">
          <div className="section-header">
            <div className="section-header-text">
              <span className="badge badge-orange">Verified Retailers</span>
              <h2 className="section-title">Verified Nearby Auto Spare Shops</h2>
              <p className="section-subtitle">
                Authorized spare-part vendors with verified legal licenses and physical shopfronts.
              </p>
            </div>
            <Link to="/shops" className="btn btn-outline">
              Browse All Stores →
            </Link>
          </div>

          {featuredShops.length > 0 ? (
            <div className="home-shops-grid">
              {featuredShops.map((shop) => (
                <div key={shop._id} className="home-shop-card fade-in">
                  <div className="shop-card-banner">
                    {shop.images && shop.images.length > 0 ? (
                      <img src={shop.images[0]} alt={shop.name} loading="lazy" />
                    ) : (
                      <div className="shop-no-photo">Storefront Photo Pending</div>
                    )}
                    <span className="shop-cat-pill">{shop.category}</span>
                  </div>
                  <div className="shop-card-body">
                    <h4 className="shop-name-title">{shop.name}</h4>
                    <p className="shop-location-sub">
                      📍 {shop.address?.city}, {shop.address?.state}
                    </p>
                    <p className="shop-hours-sub">
                      🕒 {shop.openingHours || 'Mon-Sat 9AM-8PM'}
                    </p>
                    <div className="shop-card-actions">
                      <Link to={`/shops/${shop._id}`} className="btn btn-outline btn-sm">
                        View Store Catalog
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-catalog-notice">
              <p>No verified retail shops online yet. Shop owners can apply via the merchant portal.</p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default HomePage;
