import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import { fetchCustomerDashboardData } from '../services/api';
import './CustomerDashboardPage.css';

const CATEGORIES = [
  { id: 'Bike', title: 'Bike', icon: '🏍️', desc: 'Motorcycles & commuter 2-wheelers' },
  { id: 'Car', title: 'Car', icon: '🚗', desc: 'Hatchbacks, sedans, SUVs' },
  { id: 'Scooter', title: 'Scooter', icon: '🛵', desc: 'Gearless mopeds & e-scooters' },
  { id: 'Bicycle', title: 'Bicycle', icon: '🚲', desc: 'Geared, road & MTB bicycles' },
  { id: 'Other', title: 'Other', icon: '🚚', desc: 'Commercial & three-wheelers' }
];

const CustomerDashboardPage = () => {
  const { user, logout } = useAuth();
  const { vehicle, isVehicleSelected, displayLabel, openVehicleModal, updateVehicle } = useVehicle();
  const [backendData, setBackendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const dashRes = await fetchCustomerDashboardData();
        if (dashRes.success) {
          setBackendData(dashRes.data);
        }
      } catch {
        // Safe fallback
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const handleSelectCategory = (catId) => {
    updateVehicle({ vehicleType: catId });
    navigate(`/parts?vehicleType=${catId}`);
  };

  return (
    <div className="dashboard-page-root">
      <div className="container dashboard-container">
        {/* Welcome Header */}
        <div className="dashboard-welcome-card">
          <div className="welcome-info">
            <div className="welcome-badge-row">
              <span className="badge badge-info">Role: {user?.role}</span>
              <span className="badge badge-success">Status: {user?.accountStatus || 'ACTIVE'}</span>
            </div>
            <h1 className="welcome-title">Welcome back, {user?.name}!</h1>
            <p className="welcome-subtitle">
              Your customer hub for discovering genuine vehicle spare parts and finding verified local retail shops.
            </p>
          </div>
          <div className="user-contact-mini">
            <div className="contact-detail-item">
              <span className="contact-label">Email:</span>
              <span className="contact-val">
                {user?.email} {user?.isEmailVerified ? <span style={{ color: '#16a34a' }}>✓</span> : <span style={{ color: '#d97706', fontSize: '0.75rem' }}>(Unverified)</span>}
              </span>
            </div>
            <div className="contact-detail-item">
              <span className="contact-label">Phone:</span>
              <span className="contact-val">{user?.phone || 'Not provided'}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <Link to="/settings" className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '4px 10px', textAlign: 'center', flex: 1 }}>
                ⚙️ Settings
              </Link>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleLogout}
                style={{ fontSize: '0.78rem', padding: '4px 10px', textAlign: 'center', borderColor: '#ef4444', color: '#fca5a5' }}
                id="customer-dash-logout-btn"
                title="Sign out of Customer Portal"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {/* Active Garage & Vehicle Card */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Your Active Vehicle</h2>
            <button
              type="button"
              className="badge badge-orange"
              onClick={openVehicleModal}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              {isVehicleSelected ? 'Change Vehicle ▾' : '+ Select Vehicle'}
            </button>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  fontSize: '2.4rem',
                  background: '#FFF7ED',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #FFEDD5'
                }}
              >
                {vehicle?.vehicleType === 'Bike' ? '🏍️' :
                 vehicle?.vehicleType === 'Scooter' ? '🛵' :
                 vehicle?.vehicleType === 'Bicycle' ? '🚲' :
                 vehicle?.vehicleType === 'Other' ? '🚚' : '🚗'}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: 'var(--color-navy-primary)' }}>
                  {isVehicleSelected ? displayLabel : 'No Vehicle Configured'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                  {isVehicleSelected
                    ? `Compatible parts for ${vehicle?.vehicleType || 'vehicle'} are filtered automatically.`
                    : 'Select your vehicle to filter matching components and check verified fitment.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openVehicleModal}
              >
                {isVehicleSelected ? 'Modify Vehicle' : 'Set Up Vehicle'}
              </button>
              {isVehicleSelected && (
                <Link to={`/parts?vehicleType=${vehicle?.vehicleType || ''}`} className="btn btn-outline btn-sm">
                  Browse Matching Parts →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Quick Discovery Actions Banner */}
        <div className="search-shortcut-banner">
          <div className="shortcut-text">
            <h3>Find Vehicle Spare Parts Shops Near You</h3>
            <p>Locate approved local retailers, check live in-stock availability, and get direct directions to the store.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/shops" className="btn btn-primary shortcut-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>Find Nearby Shops</span>
            </Link>
            <Link to="/parts" className="btn btn-outline shortcut-btn" style={{ background: '#FFFFFF' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Search All Parts</span>
            </Link>
          </div>
        </div>

        {/* Vehicle Categories Spectrum */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Vehicle Categories Spectrum</h2>
            <span className="badge badge-orange">Quick Discovery</span>
          </div>

          <div className="customer-categories-grid">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="customer-category-tile"
                onClick={() => handleSelectCategory(cat.id)}
                style={{ cursor: 'pointer' }}
              >
                <span className="tile-icon">{cat.icon}</span>
                <div className="tile-body">
                  <h4>{cat.title}</h4>
                  <p>{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Shortcuts: Saved Wishlist & Find Shops */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Quick Shortcuts</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-navy-primary)' }}>
                💖 Saved Wishlist
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                Keep track of spare parts you want to buy from local retailers.
              </p>
              <Link to="/wishlist" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                View Saved Parts →
              </Link>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-navy-primary)' }}>
                📍 Verified Retail Network
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                Browse verified automotive spare parts shops, phone contacts, and directions on the live map.
              </p>
              <Link to="/shops" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                Open Shops Map →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerDashboardPage;
