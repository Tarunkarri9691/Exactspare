import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCustomerDashboardData, fetchMyOrders } from '../services/api';
import './CustomerDashboardPage.css';

const CATEGORIES = [
  { id: 'bike', title: 'Bike', icon: '🏍️', desc: 'Motorcycles & two-wheelers' },
  { id: 'car', title: 'Car', icon: '🚗', desc: 'Hatchbacks, sedans, SUVs' },
  { id: 'scooter', title: 'Scooter', icon: '🛵', desc: 'Mopeds & e-scooters' },
  { id: 'bicycle', title: 'Bicycle', icon: '🚲', desc: 'Geared & road cycles' },
  { id: 'other', title: 'Other', icon: '🚚', desc: 'Commercial & three-wheelers' }
];

const CustomerDashboardPage = () => {
  const { user } = useAuth();
  const [backendData, setBackendData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const [dashRes, ordersRes] = await Promise.all([
        fetchCustomerDashboardData(),
        fetchMyOrders({ limit: 3 })
      ]);
      if (dashRes.success) {
        setBackendData(dashRes.data);
      }
      if (ordersRes.success && ordersRes.data?.orders) {
        setRecentOrders(ordersRes.data.orders);
      }
      setLoading(false);
    };
    loadDashboard();
  }, []);

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
              Your customer dashboard for discovering vehicle spare parts and tracking nearby shop reservations.
            </p>
          </div>
          <div className="user-contact-mini">
            <div className="contact-detail-item">
              <span className="contact-label">Email:</span>
              <span className="contact-val">{user?.email}</span>
            </div>
            <div className="contact-detail-item">
              <span className="contact-label">Phone:</span>
              <span className="contact-val">{user?.phone}</span>
            </div>
          </div>
        </div>

        {/* Quick Search Shortcut Banner */}
        <div className="search-shortcut-banner">
          <div className="shortcut-text">
            <h3>Need a specific vehicle spare part right now?</h3>
            <p>Search OEM part codes, brake pads, filters, or engine fluids available in nearby shops.</p>
          </div>
          <Link to="/" className="btn btn-primary shortcut-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Search Nearby Parts</span>
          </Link>
        </div>

        {/* Vehicle Categories Quick Links */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Vehicle Categories Spectrum</h2>
            <span className="badge badge-orange">Quick Browse</span>
          </div>

          <div className="customer-categories-grid">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="customer-category-tile">
                <span className="tile-icon">{cat.icon}</span>
                <div className="tile-body">
                  <h4>{cat.title}</h4>
                  <p>{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orders Section */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>My Spare Part Orders</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/cart" className="badge badge-orange" style={{ textDecoration: 'none' }}>
                Shopping Cart
              </Link>
              <Link to="/orders" className="badge badge-navy" style={{ textDecoration: 'none' }}>
                View All Orders →
              </Link>
            </div>
          </div>

          {recentOrders.length === 0 ? (
            <div className="orders-placeholder-card">
              <div className="empty-orders-icon">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
              <h3>No Active Orders Yet</h3>
              <p>
                Browse spare parts from verified local shops, add them to your cart, and place Cash on Delivery orders directly.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Link to="/parts" className="btn btn-primary">
                  Explore Spare Parts
                </Link>
                <Link to="/cart" className="btn btn-outline">
                  View Shopping Cart
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentOrders.map((ord) => (
                <div
                  key={ord._id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--color-navy-primary)' }}>
                        {ord.orderNumber}
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: ord.orderStatus === 'DELIVERED' ? '#DCFCE7' : '#E0F2FE',
                          color: ord.orderStatus === 'DELIVERED' ? '#15803D' : '#0369A1'
                        }}
                      >
                        {ord.orderStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {ord.items?.length} items • ₹{ord.totalAmount?.toLocaleString('en-IN')} • {ord.paymentMethod}
                    </div>
                  </div>
                  <Link to={`/orders/${ord._id}`} className="btn btn-outline btn-sm">
                    Track Order →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboardPage;
