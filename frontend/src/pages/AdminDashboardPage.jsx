import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchAdminAnalyticsOverview } from '../services/api';
import AdminNav from '../components/AdminNav';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAnalyticsOverview();
      if (res.success && res.data) {
        setData(res.data);
        setLastRefreshTime(new Date());
      } else {
        setError(res.error || 'Failed to fetch platform analytics overview.');
      }
    } catch {
      setError('Network communication error while loading overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const formatPrice = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const users = data?.users || {};
  const shops = data?.shops || {};
  const inventory = data?.inventory || {};
  const orders = data?.orders || {};
  const revenue = data?.revenue || {};

  return (
    <div className="admin-page-root">
      {/* Top Admin Sub-navigation */}
      <AdminNav />

      <div className="container admin-container">
        {/* Welcome Header */}
        <div className="admin-header-card">
          <div className="admin-header-main">
            <div className="admin-badge-row">
              <span className="badge badge-navy">Platform Administrator</span>
              <span className="badge badge-success">CLI Authenticated</span>
              <span className="badge badge-orange">Module 8 • Analytics & Management</span>
            </div>
            <h1 className="admin-header-title">Platform Operations Dashboard</h1>
            <p className="admin-header-subtitle">
              Live enterprise overview of user spectrum, merchant shops, inventory catalog, order status pipelines, and confirmed revenues.
            </p>
          </div>

          <div className="admin-header-refresh">
            <button
              type="button"
              className="btn btn-outline-white refresh-btn"
              onClick={loadOverview}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'spin-icon' : ''}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
            {lastRefreshTime && (
              <span className="last-refreshed-text">
                Last refreshed: {lastRefreshTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="auth-alert error-alert" style={{ marginBottom: '24px' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Financial Revenue Callout Banner */}
        <div className="revenue-hero-grid">
          <div className="revenue-hero-card completed-revenue">
            <div className="rev-card-top">
              <span className="rev-label">Completed Sales Revenue</span>
              <span className="rev-icon">💰</span>
            </div>
            <div className="rev-amount">{loading ? '...' : formatPrice(revenue.completedRevenue)}</div>
            <p className="rev-desc">
              Confirmed collected funds from <strong>DELIVERED</strong> orders and verified online payments.
            </p>
          </div>

          <div className="revenue-hero-card gross-order-value">
            <div className="rev-card-top">
              <span className="rev-label">Total Active Order Value (GMV)</span>
              <span className="rev-icon">📊</span>
            </div>
            <div className="rev-amount">{loading ? '...' : formatPrice(revenue.totalGrossValue)}</div>
            <p className="rev-desc">
              Gross merchandise value of all active orders (excludes cancellations).
            </p>
          </div>

          <div className="revenue-hero-card pending-cod">
            <div className="rev-card-top">
              <span className="rev-label">Pending COD Uncollected</span>
              <span className="rev-icon">🚚</span>
            </div>
            <div className="rev-amount">{loading ? '...' : formatPrice(revenue.pendingCodRevenue)}</div>
            <p className="rev-desc">
              Orders dispatched or in fulfillment awaiting customer payment on delivery.
            </p>
          </div>
        </div>

        {/* Section 1: Orders Pipeline Metrics */}
        <div className="admin-section-block">
          <div className="section-head">
            <h2>Order Fulfillment Pipeline</h2>
            <Link to="/admin/analytics" className="section-link">View Sales & Order Trends →</Link>
          </div>

          <div className="metrics-quad-grid">
            <div className="quad-card">
              <span className="quad-title">Total Orders Placed</span>
              <div className="quad-num">{loading ? '...' : orders.total || 0}</div>
              <span className="quad-sub">All-time customer checkouts</span>
            </div>

            <div className="quad-card card-warning">
              <span className="quad-title">Awaiting Processing</span>
              <div className="quad-num text-orange">{loading ? '...' : orders.awaitingProcessing || 0}</div>
              <span className="quad-sub">PLACED, CONFIRMED or PACKING</span>
            </div>

            <div className="quad-card card-success">
              <span className="quad-title">Delivered Orders</span>
              <div className="quad-num text-green">{loading ? '...' : orders.delivered || 0}</div>
              <span className="quad-sub">Successfully handed over to buyers</span>
            </div>

            <div className="quad-card card-danger">
              <span className="quad-title">Cancelled Orders</span>
              <div className="quad-num text-red">{loading ? '...' : orders.cancelled || 0}</div>
              <span className="quad-sub">Cancelled prior to dispatch</span>
            </div>
          </div>
        </div>

        {/* Section 2: Shops & Compliance Metrics */}
        <div className="admin-section-block">
          <div className="section-head">
            <h2>Merchant Shops & Application Compliance</h2>
            <div className="section-actions-inline">
              <Link to="/admin/applications" className="section-link">Review Applications →</Link>
              <span className="sep">•</span>
              <Link to="/admin/shops" className="section-link">Manage Shops →</Link>
            </div>
          </div>

          <div className="metrics-quad-grid">
            <div className="quad-card">
              <span className="quad-title">Total Registered Shops</span>
              <div className="quad-num">{loading ? '...' : shops.total || 0}</div>
              <span className="quad-sub">Platform vendor storefronts</span>
            </div>

            <div className="quad-card card-success">
              <span className="quad-title">Approved & Active Shops</span>
              <div className="quad-num text-green">{loading ? '...' : shops.approvedAndActive || 0}</div>
              <span className="quad-sub">Discoverable in location search</span>
            </div>

            <div className="quad-card card-warning">
              <span className="quad-title">Pending Applications</span>
              <div className="quad-num text-orange">{loading ? '...' : shops.pendingApplications || 0}</div>
              <span className="quad-sub">Awaiting admin compliance review</span>
            </div>

            <div className="quad-card card-danger">
              <span className="quad-title">Rejected Applications</span>
              <div className="quad-num text-red">{loading ? '...' : shops.rejectedApplications || 0}</div>
              <span className="quad-sub">Failed verification criteria</span>
            </div>
          </div>
        </div>

        {/* Section 3: Inventory & Users Spectrum */}
        <div className="admin-split-sections">
          {/* Inventory Breakdown */}
          <div className="split-column">
            <div className="section-head">
              <h2>Spare-Parts Inventory</h2>
              <Link to="/admin/moderation/parts" className="section-link">Catalog Moderation →</Link>
            </div>

            <div className="metrics-double-grid">
              <div className="quad-card">
                <span className="quad-title">Total Part Listings</span>
                <div className="quad-num">{loading ? '...' : inventory.total || 0}</div>
                <span className="quad-sub">Catalog spare parts</span>
              </div>

              <div className="quad-card card-info">
                <span className="quad-title">Published & Live</span>
                <div className="quad-num text-navy">{loading ? '...' : inventory.published || 0}</div>
                <span className="quad-sub">Active in marketplace search</span>
              </div>
            </div>
          </div>

          {/* User Spectrum */}
          <div className="split-column">
            <div className="section-head">
              <h2>Registered Users Spectrum</h2>
              <Link to="/admin/users" className="section-link">Manage Users →</Link>
            </div>

            <div className="metrics-double-grid">
              <div className="quad-card">
                <span className="quad-title">Registered Customers</span>
                <div className="quad-num">{loading ? '...' : users.customers || 0}</div>
                <span className="quad-sub">Vehicle owners & buyers</span>
              </div>

              <div className="quad-card card-warning">
                <span className="quad-title">Shop Owners</span>
                <div className="quad-num text-orange">{loading ? '...' : users.shopOwners || 0}</div>
                <span className="quad-sub">Merchant vendor accounts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Management Shortcuts */}
        <div className="admin-shortcuts-grid">
          <Link to="/admin/analytics" className="admin-shortcut-card">
            <span className="shortcut-icon">📈</span>
            <h4>Sales & Revenue Analytics</h4>
            <p>Inspect timeline trends, top-selling parts, and shop volume comparisons.</p>
          </Link>

          <Link to="/admin/shops" className="admin-shortcut-card">
            <span className="shortcut-icon">🏬</span>
            <h4>Shop Management</h4>
            <p>Search retail partners, inspect store inventories, and toggle active status.</p>
          </Link>

          <Link to="/admin/users" className="admin-shortcut-card">
            <span className="shortcut-icon">👥</span>
            <h4>User Account Governance</h4>
            <p>Filter customer and owner accounts, view order activity, or suspend violators.</p>
          </Link>

          <Link to="/admin/moderation/parts" className="admin-shortcut-card">
            <span className="shortcut-icon">⚙️</span>
            <h4>Spare-Parts Moderation</h4>
            <p>Review listings, take down prohibited parts, and preserve historical order integrity.</p>
          </Link>

          <Link to="/admin/moderation/reviews" className="admin-shortcut-card">
            <span className="shortcut-icon">⭐</span>
            <h4>Customer Reviews Moderation</h4>
            <p>Moderate verified buyer ratings and recalculate product review scores.</p>
          </Link>

          <Link to="/admin/audit-logs" className="admin-shortcut-card">
            <span className="shortcut-icon">🛡️</span>
            <h4>Platform Audit Log</h4>
            <p>Review immutable security timestamps and records of administrative interventions.</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
