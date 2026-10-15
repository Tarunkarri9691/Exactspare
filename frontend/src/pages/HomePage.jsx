import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import CategoryCard from '../components/CategoryCard';
import SystemHealthWidget from '../components/SystemHealthWidget';
import './HomePage.css';

const CATEGORIES = [
  {
    id: 'bike',
    title: 'Bike',
    subtitle: 'Motorcycles, sports bikes, cruisers, and commuter two-wheelers.',
    commonParts: ['Brake Pads', 'Clutch Plates', 'Chain Sprocket', 'Air Filter', 'Engine Oil'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="17" r="3"/>
        <circle cx="19" cy="17" r="3"/>
        <path d="M12 17h4l3-9H9"/>
        <path d="M9 8l2-4h3"/>
        <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
      </svg>
    )
  },
  {
    id: 'car',
    title: 'Car',
    subtitle: 'Hatchbacks, sedans, compact SUVs, and luxury passenger cars.',
    commonParts: ['Oil Filters', 'Brake Rotors', 'Spark Plugs', 'Suspension Bush', 'Headlights'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
    )
  },
  {
    id: 'scooter',
    title: 'Scooter',
    subtitle: 'Automatic scooters, mopeds, gearless vehicles, and e-scooters.',
    commonParts: ['Drive Belts', 'Roller Weights', 'Battery', 'Brake Cables', 'Carburetor / Injector'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="2.5"/>
        <circle cx="18.5" cy="17.5" r="2.5"/>
        <path d="M8 17.5h7"/>
        <path d="M15 17.5V11l-3-4H9"/>
        <path d="M12 7l1-3h3"/>
      </svg>
    )
  },
  {
    id: 'bicycle',
    title: 'Bicycle',
    subtitle: 'Geared cycles, road bikes, mountain bikes (MTB), and hybrid commuters.',
    commonParts: ['Derailleur Cables', 'Brake Shoes', 'Tubes & Tires', 'Pedals', 'Chains'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5"/>
        <circle cx="18.5" cy="17.5" r="3.5"/>
        <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-3 3 5 4.5 3"/>
        <path d="M5.5 17.5L9 9"/>
      </svg>
    )
  },
  {
    id: 'other',
    title: 'Other',
    subtitle: 'Commercial vehicles, auto-rickshaws, pickups, light trucks, and machinery.',
    commonParts: ['Leaf Springs', 'Heavy Batteries', 'Fuel Injectors', 'Clutch Boosters', 'Radiators'],
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    )
  }
];

const HomePage = () => {
  const [selectedCategoryInfo, setSelectedCategoryInfo] = useState(null);

  const handleSelectCategory = (categoryTitle) => {
    setSelectedCategoryInfo(categoryTitle);
  };

  const closeCategoryModal = () => {
    setSelectedCategoryInfo(null);
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
              Find the Right Vehicle Spare Parts in Nearby Shops
            </h1>

            <p className="hero-description">
              Find the right vehicle spare parts in nearby shops.
            </p>

            <p className="hero-subtext">
              Directly match spare parts with verified local merchants across Bike, Car, Scooter, Bicycle, and Commercial categories.
            </p>
          </div>

          {/* Interactive Search Bar UI */}
          <div className="hero-search-wrapper">
            <SearchBar onCategorySelect={(cat) => console.log('Selected category filter:', cat)} />
          </div>
        </div>
      </section>

      {/* Vehicle Categories Section */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header">
            <div className="section-header-text">
              <span className="badge badge-orange">Vehicle Spectrum</span>
              <h2 className="section-title">Supported Vehicle Categories</h2>
              <p className="section-subtitle">
                Browse parts tailored specifically for your vehicle type across authentic local auto vendors.
              </p>
            </div>
          </div>

          <div className="categories-grid">
            {CATEGORIES.map((category) => (
              <CategoryCard 
                key={category.id}
                id={category.id}
                title={category.title}
                subtitle={category.subtitle}
                icon={category.icon}
                commonParts={category.commonParts}
                onSelectCategory={handleSelectCategory}
              />
            ))}
          </div>
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
                Search part numbers or names, view exact stock in nearby shops, compare rates, and reserve for pickup.
              </p>
              <ul className="role-feature-list">
                <li>Instant nearby radius discovery</li>
                <li>Verify compatibility before visiting</li>
                <li>Zero commission direct purchases</li>
              </ul>
              <Link to="/register" className="btn btn-outline role-card-btn">
                Customer Preview
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
                Apply to register your retail shop, upload parts inventory, manage price lists, and receive buyer inquiries.
              </p>
              <ul className="role-feature-list">
                <li>Local store profile & location pin</li>
                <li>Bulk spare parts inventory upload</li>
                <li>Direct customer order inquiries</li>
              </ul>
              <Link to="/shop-owner" className="btn btn-primary role-card-btn">
                Shop Registration Preview
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
                <span className="badge badge-info">Admin Console • Module 5</span>
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

      {/* Category Info Modal */}
      {selectedCategoryInfo && (
        <div className="modal-backdrop" onClick={closeCategoryModal}>
          <div className="modal-card fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedCategoryInfo} Spare Parts Catalog</h3>
              <button className="modal-close-btn" onClick={closeCategoryModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-info-badge">
                <span className="badge badge-orange">Module 1 Notice</span>
              </div>
              <p>
                You selected the <strong>{selectedCategoryInfo}</strong> category. In this Module 1 foundation release, the database schemas and backend endpoints are being initialized.
              </p>
              <p>
                Live filtered inventory lookup and shop-by-shop stock matching for {selectedCategoryInfo} will be connected in <strong>Module 3 (Spare Parts Catalog & Inventory API)</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={closeCategoryModal}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
