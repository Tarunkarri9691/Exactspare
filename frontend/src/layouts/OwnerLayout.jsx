import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchMyApprovedShop, fetchMyApplication, fetchMySubscription } from '../services/api';
import './OwnerLayout.css';

const OwnerLayout = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopData, setShopData] = useState({
    loading: true,
    hasShop: false,
    shop: null,
    isApproved: false,
    isActive: false,
    application: null,
    applicationStatus: 'NOT_SUBMITTED',
    subscription: null,
    subscriptionStatus: 'NOT_SUBSCRIBED'
  });

  // Load authoritative backend shop, application, and subscription status
  const loadOwnerPortalStatus = useCallback(async () => {
    try {
      setShopData((prev) => ({ ...prev, loading: true }));
      const [shopRes, appRes, subRes] = await Promise.all([
        fetchMyApprovedShop().catch(() => ({ success: false })),
        fetchMyApplication().catch(() => ({ success: false })),
        fetchMySubscription().catch(() => ({ success: false }))
      ]);

      const app = appRes?.success ? appRes.application : null;
      const appStatus = app ? app.status : 'NOT_SUBMITTED';

      let hasShop = false;
      let shop = null;
      let isApproved = false;
      let isActive = false;

      if (shopRes?.success && shopRes.data) {
        hasShop = !!shopRes.data.hasShop;
        shop = shopRes.data.shop || null;
        isApproved = !!shopRes.data.isApproved;
        isActive = !!shopRes.data.isActive;
      }

      const subscription = subRes?.success ? subRes.currentSubscription : null;
      const subscriptionStatus = subRes?.success ? (subRes.overallStatus || 'NOT_SUBSCRIBED') : 'NOT_SUBSCRIBED';

      setShopData({
        loading: false,
        hasShop,
        shop,
        isApproved,
        isActive,
        application: app,
        applicationStatus: appStatus,
        subscription,
        subscriptionStatus
      });
    } catch {
      setShopData((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadOwnerPortalStatus();
  }, [loadOwnerPortalStatus]);

  // Close mobile navigation drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/owner/dashboard');
    }
  };

  // Determine breadcrumb context label
  const getBreadcrumbLabel = (path) => {
    if (path === '/owner/dashboard') return 'Overview Dashboard';
    if (path.startsWith('/owner/subscription') || path.startsWith('/owner/payment')) return 'Store Subscription & Plan';
    if (path.startsWith('/owner/shop')) return 'My Shop Profile';
    if (path.startsWith('/owner/location') || path.startsWith('/owner/shop-location')) return 'Shop Location & Coordinates';
    if (path.startsWith('/owner/inventory/add') || path.startsWith('/owner/inventory/new')) return 'Add Spare Part';
    if (path.includes('/edit')) return 'Edit Spare Part';
    if (path.startsWith('/owner/inventory')) return 'Spare Parts Inventory';
    if (path.startsWith('/owner/enquiries')) return 'Customer Enquiries';
    if (path.startsWith('/owner/notifications')) return 'Notifications';
    if (path.startsWith('/owner/settings')) return 'Settings';
    if (path.startsWith('/owner/orders')) return 'Customer Orders';
    return 'Shop Owner Portal';
  };

  const isDashboard = location.pathname === '/owner/dashboard';
  const shopNameDisplay = shopData.shop?.name || shopData.shop?.shopName || shopData.application?.shopName || user?.name;

  // Status badge styling
  const renderStatusBadge = () => {
    if (shopData.loading) {
      return <span className="owner-status-pill pill-loading">Checking status...</span>;
    }
    if (shopData.isActive) {
      return <span className="owner-status-pill pill-active">✓ Shop: Active & Live</span>;
    }
    return <span className="owner-status-pill pill-active" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>✓ Details: Directly Approved</span>;
  };

  // Subscription badge styling
  const renderSubBadge = () => {
    if (shopData.loading) return null;
    switch (shopData.subscriptionStatus) {
      case 'ACTIVE':
        return <span className="owner-status-pill pill-active" style={{ background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }}>✓ Plan: Active & Accepted</span>;
      case 'PENDING_VERIFICATION':
        return <span className="owner-status-pill pill-pending" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>⏳ Plan: Pending Admin Acceptance</span>;
      case 'PAYMENT_FAILED':
        return <span className="owner-status-pill pill-rejected" style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}>✕ Plan: Payment Rejected</span>;
      case 'EXPIRED':
        return <span className="owner-status-pill pill-correction" style={{ background: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa' }}>⚠️ Plan: Expired</span>;
      default:
        return <span className="owner-status-pill pill-none">💳 Plan: Awaiting Subscription</span>;
    }
  };

  return (
    <div className="owner-layout-root">
      <a href="#owner-main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Main Top Header */}
      <header className="owner-header" role="banner">
        <div className="container owner-header-container">
          {/* Brand Logo & Portal Tag */}
          <div className="owner-brand-group">
            <Link
              to="/owner/dashboard"
              className="owner-brand-link"
              title="EXACTSPARE Shop Owner Portal"
              id="owner-brand-home"
            >
              <img
                src="/images/exactspare-logo.png"
                alt="EXACTSPARE Logo"
                className="owner-logo-img"
              />
            </Link>
            <div className="owner-portal-badge-wrap">
              <span className="owner-portal-badge">Shop Owner Portal</span>
              {renderStatusBadge()}
              {renderSubBadge()}
            </div>
          </div>

          {/* Store & Owner Identity Badge + Actions */}
          <div className="owner-identity-group">
            <div className="owner-identity-card">
              <div className="owner-avatar-frame" title={shopNameDisplay || user?.name || 'Owner Profile'}>
                {shopData.shop?.images?.[0] ? (
                  <img
                    src={shopData.shop.images[0]}
                    alt={shopNameDisplay || 'Shop'}
                    className="owner-avatar-img"
                  />
                ) : (
                  <span className="owner-avatar-fallback">
                    {(shopNameDisplay || user?.name || 'S').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="owner-identity-text">
                <div className="owner-shop-name" title={shopNameDisplay || 'No store registered yet'}>
                  <span className="identity-icon">🏬</span>
                  <span className="shop-name-label">{shopNameDisplay || 'Unregistered Shop'}</span>
                </div>
                <div className="owner-user-name" title={user?.email || ''}>
                  <span className="identity-icon">👤</span>
                  <span className="user-name-label">{user?.name || 'Store Owner'}</span>
                </div>
              </div>
            </div>

            {/* Notifications Bell Quick Link */}
            <NavLink
              to="/owner/notifications"
              className={({ isActive }) => `owner-quick-notif-btn ${isActive ? 'active' : ''}`}
              title="View notifications"
              id="owner-quick-notifications-btn"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="owner-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>

            {/* Direct Header Logout Button */}
            <button
              type="button"
              className="owner-header-logout-btn"
              onClick={handleLogout}
              id="owner-header-logout-btn"
              title="Sign out of Shop Owner Portal"
            >
              <span className="logout-icon">🚪</span>
              <span className="logout-label">Logout</span>
            </button>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              type="button"
              className="owner-mobile-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle owner navigation menu"
              aria-expanded={mobileMenuOpen}
              id="owner-mobile-toggle-btn"
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Dedicated Owner Navigation Bar (Only the 9 specified items) */}
      <nav className={`owner-navbar ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Shop owner navigation">
        <div className="container owner-nav-container">
          <div className="owner-nav-list">
            {/* 1. Owner Dashboard */}
            <NavLink
              to="/owner/dashboard"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              end
              id="owner-nav-dashboard"
            >
              <span className="nav-item-icon">📊</span>
              <span>Owner Dashboard</span>
            </NavLink>

            {/* 2. Subscription */}
            <NavLink
              to="/owner/subscription"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-subscription"
            >
              <span className="nav-item-icon">💳</span>
              <span>Subscription</span>
              {shopData.subscriptionStatus === 'ACTIVE' && (
                <span className="nav-chip-badge chip-success" style={{ background: '#dcfce7', color: '#15803d' }}>Active</span>
              )}
              {shopData.subscriptionStatus === 'PENDING_VERIFICATION' && (
                <span className="nav-chip-badge chip-pending">Pending</span>
              )}
              {shopData.subscriptionStatus === 'PAYMENT_FAILED' && (
                <span className="nav-chip-badge chip-warning" style={{ background: '#fee2e2', color: '#b91c1c' }}>Failed</span>
              )}
              {shopData.subscriptionStatus === 'EXPIRED' && (
                <span className="nav-chip-badge chip-warning" style={{ background: '#ffedd5', color: '#c2410c' }}>Expired</span>
              )}
            </NavLink>

            {/* 4. My Shop */}
            <NavLink
              to="/owner/shop"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-shop"
            >
              <span className="nav-item-icon">🏬</span>
              <span>My Shop</span>
            </NavLink>

            {/* 4. Shop Location */}
            <NavLink
              to="/owner/location"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-location"
            >
              <span className="nav-item-icon">📍</span>
              <span>Shop Location</span>
            </NavLink>

            {/* 5. Spare Parts Inventory */}
            <NavLink
              to="/owner/inventory"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              end
              id="owner-nav-inventory"
            >
              <span className="nav-item-icon">📦</span>
              <span>Spare Parts Inventory</span>
            </NavLink>

            {/* 6. Add Spare Part */}
            <NavLink
              to="/owner/inventory/add"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-inventory-add"
            >
              <span className="nav-item-icon">➕</span>
              <span>Add Spare Part</span>
            </NavLink>

            {/* 7. Customer Enquiries */}
            <NavLink
              to="/owner/enquiries"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-enquiries"
            >
              <span className="nav-item-icon">💬</span>
              <span>Customer Enquiries</span>
            </NavLink>

            {/* 8. Orders */}
            <NavLink
              to="/owner/orders"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-orders"
            >
              <span className="nav-item-icon">🛍️</span>
              <span>Orders</span>
            </NavLink>

            {/* 7. Notifications */}
            <NavLink
              to="/owner/notifications"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-notifications"
            >
              <span className="nav-item-icon">🔔</span>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="nav-chip-badge chip-orange">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>

            {/* 8. Settings */}
            <NavLink
              to="/owner/settings"
              className={({ isActive }) => `owner-nav-link ${isActive ? 'active' : ''}`}
              id="owner-nav-settings"
            >
              <span className="nav-item-icon">⚙️</span>
              <span>Settings</span>
            </NavLink>

            {/* 10. Logout */}
            <button
              type="button"
              className="owner-nav-link owner-logout-link"
              onClick={handleLogout}
              id="owner-nav-logout"
              title="Sign out of Shop Owner Portal"
            >
              <span className="nav-item-icon">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Consistent Back Button & Breadcrumbs for Nested Pages */}
      {!isDashboard && (
        <aside className="owner-back-bar" role="navigation" aria-label="Page navigation back bar">
          <div className="container owner-back-container">
            <button
              type="button"
              className="owner-back-btn"
              onClick={handleBack}
              id="owner-back-button"
              title="Return to previous page"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>
            <div className="owner-breadcrumbs">
              <Link to="/owner/dashboard" className="owner-crumb-link">
                Owner Portal
              </Link>
              <span className="owner-crumb-sep">/</span>
              <span className="owner-crumb-current">{getBreadcrumbLabel(location.pathname)}</span>
            </div>
          </div>
        </aside>
      )}

      {/* Main Outlet for Owner Pages */}
      <main id="owner-main-content" className="owner-main-content">
        <Outlet
          context={{
            shop: shopData.shop,
            hasShop: shopData.hasShop,
            isApproved: shopData.isApproved,
            isActive: shopData.isActive,
            application: shopData.application,
            applicationStatus: shopData.applicationStatus,
            subscription: shopData.subscription,
            subscriptionStatus: shopData.subscriptionStatus,
            loading: shopData.loading,
            reloadStatus: loadOwnerPortalStatus
          }}
        />
      </main>

      {/* Owner Portal Footer */}
      <footer className="owner-footer" role="contentinfo">
        <div className="container owner-footer-container">
          <div className="owner-footer-left">
            <span className="footer-brand-title">EXACTSPARE</span>
            <span className="footer-portal-subtitle">Shop Owner Partner Network</span>
          </div>
          <div className="owner-footer-right">
            <span>Verified Automotive Spares Platform · Secure Merchant Operations</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OwnerLayout;
