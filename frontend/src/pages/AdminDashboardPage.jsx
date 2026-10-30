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
  const [selectedPreset, setSelectedPreset] = useState('all');

  const loadOverview = useCallback(async (preset = selectedPreset) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (preset && preset !== 'all') {
        params.preset = preset;
      }
      const res = await fetchAdminAnalyticsOverview(params);
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
  }, [selectedPreset]);

  useEffect(() => {
    loadOverview(selectedPreset);
  }, [loadOverview, selectedPreset]);

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    loadOverview(preset);
  };

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
  const enquiries = data?.enquiries || {};
  const compliance = data?.compliance || {};

  // Compute shop application breakdown percentages for simple visual chart
  const totalApps = (shops.approvedAndActive || 0) + (shops.pendingApplications || 0) + (shops.needsCorrectionApplications || 0) + (shops.rejectedApplications || 0);
  const approvedPct = totalApps > 0 ? Math.round(((shops.approvedAndActive || 0) / totalApps) * 100) : 0;
  const pendingPct = totalApps > 0 ? Math.round(((shops.pendingApplications || 0) / totalApps) * 100) : 0;
  const correctionPct = totalApps > 0 ? Math.round(((shops.needsCorrectionApplications || 0) / totalApps) * 100) : 0;
  const rejectedPct = totalApps > 0 ? Math.round(((shops.rejectedApplications || 0) / totalApps) * 100) : 0;

  // Inventory published vs unpublished percentages
  const totalParts = inventory.total || 0;
  const publishedCount = inventory.published || 0;
  const unpublishedCount = inventory.unpublished !== undefined ? inventory.unpublished : Math.max(0, totalParts - publishedCount);
  const publishedPct = totalParts > 0 ? Math.round((publishedCount / totalParts) * 100) : 0;
  const unpublishedPct = totalParts > 0 ? 100 - publishedPct : 0;

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
              <span className="badge badge-orange">Module 7 & 8 • Admin Operations</span>
            </div>
            <h1 className="admin-header-title">Platform Operations Dashboard</h1>
            <p className="admin-header-subtitle">
              Live enterprise overview of user spectrum, shop applications, catalog moderation, order fulfillment, customer enquiries, and compliance.
            </p>
          </div>

          <div className="admin-header-refresh">
            <button
              type="button"
              className="btn btn-outline-white refresh-btn"
              onClick={() => loadOverview(selectedPreset)}
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

        {/* Date Filter Toolbar */}
        <div className="admin-date-filter-bar">
          <div className="date-filter-label">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Time Window Filter:</span>
          </div>
          <div className="date-filter-pills">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: '90days', label: 'Last 90 Days' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`filter-pill-btn ${selectedPreset === p.id ? 'active' : ''}`}
                onClick={() => handlePresetChange(p.id)}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
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

        {/* Section 1: Merchant Shops & Application Compliance (5-column cards) */}
        <div className="admin-section-block">
          <div className="section-head">
            <div>
              <h2>Merchant Shops & Application Compliance</h2>
              <span className="section-subtitle">Real-time status breakdown from verified MongoDB records</span>
            </div>
            <div className="section-actions-inline">
              <Link to="/admin/applications" className="section-link">Review Applications →</Link>
              <span className="sep">•</span>
              <Link to="/admin/subscriptions" className="section-link">Verify Subscriptions →</Link>
              <span className="sep">•</span>
              <Link to="/admin/shops" className="section-link">Manage Shops →</Link>
            </div>
          </div>

          <div className="metrics-five-grid">
            <div className="quad-card">
              <span className="quad-title">Total Registered Shops</span>
              <div className="quad-num">{loading ? '...' : shops.total || 0}</div>
              <span className="quad-sub">All platform storefronts</span>
            </div>

            <div className="quad-card card-success">
              <span className="quad-title">Approved & Active Shops</span>
              <div className="quad-num text-green">{loading ? '...' : shops.approvedAndActive || 0}</div>
              <span className="quad-sub">Discoverable in location search</span>
            </div>

            <div className="quad-card card-warning">
              <span className="quad-title">Pending Applications</span>
              <div className="quad-num text-orange">{loading ? '...' : shops.pendingApplications || 0}</div>
              <span className="quad-sub">Awaiting compliance review</span>
            </div>

            <div className="quad-card card-info">
              <span className="quad-title">Requires Corrections</span>
              <div className="quad-num text-purple">{loading ? '...' : shops.needsCorrectionApplications || 0}</div>
              <span className="quad-sub">Returned to merchant for edits</span>
            </div>

            <div className="quad-card card-danger">
              <span className="quad-title">Rejected Applications</span>
              <div className="quad-num text-red">{loading ? '...' : shops.rejectedApplications || 0}</div>
              <span className="quad-sub">Non-compliant applications</span>
            </div>
          </div>

          {/* Simple Visual Chart for Shop Statuses */}
          {totalApps > 0 && (
            <div className="visual-meter-card">
              <div className="meter-header">
                <span className="meter-label">Application Pipeline Ratio</span>
                <span className="meter-total">{totalApps} Applications Total</span>
              </div>
              <div className="meter-bar">
                <div className="bar-segment bar-green" style={{ width: `${approvedPct}%` }} title={`Approved: ${approvedPct}%`}></div>
                <div className="bar-segment bar-orange" style={{ width: `${pendingPct}%` }} title={`Pending: ${pendingPct}%`}></div>
                <div className="bar-segment bar-purple" style={{ width: `${correctionPct}%` }} title={`Needs Correction: ${correctionPct}%`}></div>
                <div className="bar-segment bar-red" style={{ width: `${rejectedPct}%` }} title={`Rejected: ${rejectedPct}%`}></div>
              </div>
              <div className="meter-legend">
                <span className="legend-item"><span className="legend-dot dot-green"></span> Approved ({approvedPct}%)</span>
                <span className="legend-item"><span className="legend-dot dot-orange"></span> Pending ({pendingPct}%)</span>
                <span className="legend-item"><span className="legend-dot dot-purple"></span> Needs Correction ({correctionPct}%)</span>
                <span className="legend-item"><span className="legend-dot dot-red"></span> Rejected ({rejectedPct}%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Spare-Parts Inventory & User Spectrum Split */}
        <div className="admin-split-sections">
          {/* Inventory Breakdown */}
          <div className="split-column">
            <div className="section-head">
              <div>
                <h2>Spare-Parts Catalog</h2>
                <span className="section-subtitle">Real-time marketplace listings</span>
              </div>
              <Link to="/admin/moderation/parts" className="section-link">Catalog Moderation →</Link>
            </div>

            <div className="metrics-tri-grid">
              <div className="quad-card">
                <span className="quad-title">Total Part Listings</span>
                <div className="quad-num">{loading ? '...' : totalParts}</div>
                <span className="quad-sub">Total spare parts</span>
              </div>

              <div className="quad-card card-success">
                <span className="quad-title">Published Listings</span>
                <div className="quad-num text-green">{loading ? '...' : publishedCount}</div>
                <span className="quad-sub">Active in buyer search</span>
              </div>

              <div className="quad-card card-warning">
                <span className="quad-title">Unpublished Parts</span>
                <div className="quad-num text-orange">{loading ? '...' : unpublishedCount}</div>
                <span className="quad-sub">Drafts or unlisted</span>
              </div>
            </div>

            {totalParts > 0 && (
              <div className="visual-meter-card mini-meter">
                <div className="meter-bar">
                  <div className="bar-segment bar-green" style={{ width: `${publishedPct}%` }} title={`Published: ${publishedPct}%`}></div>
                  <div className="bar-segment bar-orange" style={{ width: `${unpublishedPct}%` }} title={`Unpublished: ${unpublishedPct}%`}></div>
                </div>
                <div className="meter-legend">
                  <span className="legend-item"><span className="legend-dot dot-green"></span> Published ({publishedPct}%)</span>
                  <span className="legend-item"><span className="legend-dot dot-orange"></span> Unpublished ({unpublishedPct}%)</span>
                </div>
              </div>
            )}
          </div>

          {/* User Spectrum */}
          <div className="split-column">
            <div className="section-head">
              <div>
                <h2>Registered Users Spectrum</h2>
                <span className="section-subtitle">Database authenticated accounts</span>
              </div>
              <Link to="/admin/users" className="section-link">Manage Users →</Link>
            </div>

            <div className="metrics-tri-grid">
              <div className="quad-card">
                <span className="quad-title">Registered Customers</span>
                <div className="quad-num">{loading ? '...' : users.customers || 0}</div>
                <span className="quad-sub">Vehicle owners & buyers</span>
              </div>

              <div className="quad-card card-warning">
                <span className="quad-title">Shop Owners</span>
                <div className="quad-num text-orange">{loading ? '...' : users.shopOwners || 0}</div>
                <span className="quad-sub">Merchant accounts</span>
              </div>

              <div className="quad-card card-info">
                <span className="quad-title">Administrators</span>
                <div className="quad-num text-navy">{loading ? '...' : users.administrators || 0}</div>
                <span className="quad-sub">Operations team</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Customer Enquiries & Platform Trust/Compliance */}
        <div className="admin-split-sections">
          {/* Customer Enquiries */}
          <div className="split-column">
            <div className="section-head">
              <div>
                <h2>Customer Enquiries</h2>
                <span className="section-subtitle">Direct communication between buyers & shops</span>
              </div>
              <Link to="/admin/support" className="section-link">Support & Enquiries →</Link>
            </div>

            <div className="metrics-double-grid">
              <div className="quad-card card-warning">
                <span className="quad-title">New Enquiries</span>
                <div className="quad-num text-orange">{loading ? '...' : enquiries.newEnquiries || 0}</div>
                <span className="quad-sub">Awaiting shop response</span>
              </div>

              <div className="quad-card">
                <span className="quad-title">Total Enquiries</span>
                <div className="quad-num">{loading ? '...' : enquiries.total || 0}</div>
                <span className="quad-sub">Lifetime customer queries</span>
              </div>
            </div>
          </div>

          {/* Trust, Safety & Reports */}
          <div className="split-column">
            <div className="section-head">
              <div>
                <h2>Trust, Safety & Complaints</h2>
                <span className="section-subtitle">Customer reports & compliance disputes</span>
              </div>
              <Link to="/admin/trust-safety" className="section-link">Trust & Safety →</Link>
            </div>

            <div className="metrics-double-grid">
              <div className="quad-card card-danger">
                <span className="quad-title">Open Reports & Complaints</span>
                <div className="quad-num text-red">{loading ? '...' : compliance.openReports || 0}</div>
                <span className="quad-sub">Pending or investigating</span>
              </div>

              <div className="quad-card">
                <span className="quad-title">Total Filed Reports</span>
                <div className="quad-num">{loading ? '...' : compliance.totalReports || 0}</div>
                <span className="quad-sub">All-time customer reports</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Orders Pipeline Metrics */}
        <div className="admin-section-block">
          <div className="section-head">
            <div>
              <h2>Order Fulfillment Pipeline</h2>
              <span className="section-subtitle">Order volume & fulfillment pipeline</span>
            </div>
            <Link to="/admin/analytics" className="section-link">View Sales & Order Trends →</Link>
          </div>

          <div className="metrics-quad-grid">
            <div className="quad-card">
              <span className="quad-title">Total Orders Placed</span>
              <div className="quad-num">{loading ? '...' : orders.total || 0}</div>
              <span className="quad-sub">Customer checkouts</span>
            </div>

            <div className="quad-card card-warning">
              <span className="quad-title">Awaiting Processing</span>
              <div className="quad-num text-orange">{loading ? '...' : orders.awaitingProcessing || 0}</div>
              <span className="quad-sub">PLACED, CONFIRMED or PACKING</span>
            </div>

            <div className="quad-card card-success">
              <span className="quad-title">Delivered Orders</span>
              <div className="quad-num text-green">{loading ? '...' : orders.delivered || 0}</div>
              <span className="quad-sub">Successfully handed over</span>
            </div>

            <div className="quad-card card-danger">
              <span className="quad-title">Cancelled Orders</span>
              <div className="quad-num text-red">{loading ? '...' : orders.cancelled || 0}</div>
              <span className="quad-sub">Cancelled prior to dispatch</span>
            </div>
          </div>
        </div>

        {/* Quick Management Shortcuts */}
        <div className="admin-shortcuts-grid">
          <Link to="/admin/applications" className="admin-shortcut-card">
            <span className="shortcut-icon">📝</span>
            <h4>Shop Application Review</h4>
            <p>Inspect merchant documents, locations, approve or request corrections.</p>
          </Link>

          <Link to="/admin/subscriptions" className="admin-shortcut-card">
            <span className="shortcut-icon">💳</span>
            <h4>Subscription Payments</h4>
            <p>Verify shop-owner subscription fees, inspect UPI UTR references, and reconcile bank statements.</p>
          </Link>

          <Link to="/admin/shops" className="admin-shortcut-card">
            <span className="shortcut-icon">🏬</span>
            <h4>Shop Management</h4>
            <p>Search retail partners, inspect store inventories, and toggle active status.</p>
          </Link>

          <Link to="/admin/users" className="admin-shortcut-card">
            <span className="shortcut-icon">👥</span>
            <h4>User Account Governance</h4>
            <p>Filter customer and owner accounts, view activity, or suspend violators.</p>
          </Link>

          <Link to="/admin/moderation/parts" className="admin-shortcut-card">
            <span className="shortcut-icon">⚙️</span>
            <h4>Spare-Parts Moderation</h4>
            <p>Review listings, take down prohibited parts, and preserve order integrity.</p>
          </Link>

          <Link to="/admin/trust-safety" className="admin-shortcut-card">
            <span className="shortcut-icon">⚖️</span>
            <h4>Reports & Complaints</h4>
            <p>Investigate counterfeit claims, inaccurate compatibility, and customer reports.</p>
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
