import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import SearchResultCard from '../components/SearchResultCard';
import SystemHealthWidget from '../components/SystemHealthWidget';
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
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCategoryInfo, setSelectedCategoryInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadHomeData = async () => {
      setLoadingData(true);
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
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadHomeData();
  }, []);

  const handleSelectVehicle = (vType) => {
    navigate(`/parts?vehicleType=${vType}`);
  };

  const handleSelectCategory = (catName) => {
    navigate(`/parts?category=${encodeURIComponent(catName)}`);
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
          </div>

          {/* Prominent Search Bar with Vehicle & Location Selectors */}
          <div className="hero-search-wrapper">
            <SearchBar />
          </div>
        </div>
      </section>

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
              return (
                <div
                  key={veh.id}
                  className="home-vehicle-card"
                  onClick={() => handleSelectVehicle(veh.id)}
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
                      <img src={shop.images[0]} alt={shop.name} />
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

      {/* Platform Architecture & Three Roles */}
      <section className="roles-section">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge badge-navy">Ecosystem Roles</span>
            <h2 className="section-title">Three Roles, One Unified Marketplace</h2>
            <p className="section-subtitle">
              EXACTSPARE bridges vehicle owners and local parts retailers with full administrative trust verification.
            </p>
          </div>

          <div className="roles-grid">
            {/* Customer Role */}
            <div className="role-card">
              <div className="role-icon-box customer">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 className="role-title">1. Customer</h3>
              <p className="role-description">
                Search part numbers or names, view exact stock in nearby shops, compare rates, and get turn-by-turn directions.
              </p>
              <ul className="role-feature-list">
                <li>Instant nearby radius discovery</li>
                <li>Verify compatibility before visiting</li>
                <li>Zero commission direct purchases</li>
              </ul>
              <Link to="/parts" className="btn btn-outline role-card-btn">
                Search Spare Parts
              </Link>
            </div>

            {/* Shop Owner Role */}
            <div className="role-card featured-role">
              <div className="role-featured-badge">Partner</div>
              <div className="role-icon-box shop-owner">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <h3 className="role-title">2. Shop Owner</h3>
              <p className="role-description">
                Apply for store verification, upload storefront photos, manage live catalog inventory, and connect with customers.
              </p>
              <ul className="role-feature-list">
                <li>Upload trade license & storefront</li>
                <li>Track stock levels & OEM numbers</li>
                <li>Automatic geolocation store pin</li>
              </ul>
              <Link to="/register-owner" className="btn btn-primary role-card-btn">
                Register as Merchant
              </Link>
            </div>

            {/* Admin Role */}
            <div className="role-card">
              <div className="role-icon-box admin">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="role-title">3. Admin</h3>
              <p className="role-description">
                Review and approve shop owner registration applications, verify trade licenses, and maintain platform trust.
              </p>
              <ul className="role-feature-list">
                <li>Shop verification & KYC review</li>
                <li>Platform catalog curation</li>
                <li>Dispute & security oversight</li>
              </ul>
              <div className="admin-status-note">
                <span className="badge badge-info">Admin Console Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System Health Diagnostics Section */}
      <section className="diagnostics-section">
        <div className="container">
          <SystemHealthWidget />
        </div>
      </section>
    </div>
  );
};

export default HomePage;
