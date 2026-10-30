import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useVehicle } from '../context/VehicleContext';
import NotificationDropdown from './NotificationDropdown';
import './Navbar.css';

const Navbar = ({ onOpenAi }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const { displayLabel, openVehicleModal, hasVehicle } = useVehicle();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
    setNotifDropdownOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setNotifDropdownOpen(false);
  };

  const toggleNotifDropdown = () => {
    setNotifDropdownOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN': return '/admin/dashboard';
      case 'OWNER': return '/owner/dashboard';
      default: return '/customer/dashboard';
    }
  };

  const getPortalInfo = () => {
    if (!user) return { name: 'Customer Portal', path: '/customer/dashboard' };
    switch (user.role) {
      case 'ADMIN': return { name: 'Admin Portal', path: '/admin/dashboard' };
      case 'OWNER': return { name: 'Shop Owner Portal', path: '/owner/dashboard' };
      default: return { name: 'Customer Portal', path: '/customer/dashboard' };
    }
  };

  return (
    <header className="navbar-header">
      <div className="container navbar-container">
        {/* Brand Logo with Official Project Logo */}
        <Link 
          to={isAuthenticated ? "/" : "/login"} 
          className="navbar-brand" 
          onClick={closeMobileMenu}
          title="EXACTSPARE — Vehicle Spare Parts Finder"
        >
          <img 
            src="/images/exactspare-logo.png" 
            alt="EXACTSPARE" 
            className="navbar-brand-logo-img" 
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          {/* Main Discoverability Links - Hidden on login page and unauthenticated state */}
          {isAuthenticated && (
            <div className="nav-main-links">
              <NavLink 
                to="/" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                end
              >
                Home
              </NavLink>

              <NavLink 
                to="/parts" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Browse Parts
              </NavLink>

              <NavLink 
                to="/shops" 
                className={({ isActive }) => `nav-link nav-find-shops-highlight ${isActive ? 'active' : ''}`}
                title="Find approved vehicle spare parts shops nearby"
              >
                📍 Find Shops
              </NavLink>

              {/* Vehicle Selection trigger button */}
              <button
                type="button"
                className={`nav-vehicle-selector-btn ${hasVehicle ? 'has-vehicle' : ''}`}
                onClick={openVehicleModal}
                title="Configure active vehicle for compatibility matching"
              >
                <span className="veh-icon">🚗</span>
                <span className="veh-label">{displayLabel}</span>
                <span className="veh-arrow">▾</span>
              </button>

              {/* If merchant or admin, show their portal link */}
              {user?.role === 'OWNER' && (
                <NavLink 
                  to="/owner/dashboard" 
                  className={({ isActive }) => `nav-link nav-portal-highlight-link ${isActive ? 'active' : ''}`}
                >
                  Shop Owner Portal
                </NavLink>
              )}

              {user?.role === 'ADMIN' && (
                <NavLink 
                  to="/admin/dashboard" 
                  className={({ isActive }) => `nav-link nav-portal-highlight-link ${isActive ? 'active' : ''}`}
                >
                  Admin Portal
                </NavLink>
              )}
            </div>
          )}

          {/* Right Action Tools & Profile Section */}
          <div className="nav-actions-group">
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  className="nav-ai-btn"
                  onClick={onOpenAi}
                  title="Ask AI Spare-Parts Assistant"
                >
                  <span className="sparkle-icon">✨</span> AI Assistant
                </button>

                {/* Customer Wishlist Link */}
                {user?.role === 'CUSTOMER' && (
                  <NavLink 
                    to="/wishlist" 
                    className={({ isActive }) => `nav-link nav-wishlist-btn ${isActive ? 'active' : ''}`}
                    title="Saved Wishlist"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className="nav-wishlist-icon">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>Wishlist</span>
                    {wishlistCount > 0 && <span className="nav-wishlist-badge">{wishlistCount}</span>}
                  </NavLink>
                )}
              </>
            )}

            {isAuthenticated ? (
              <>
                {/* Notification Bell Button with Unread Badge */}
                <div className="nav-notif-container">
                  <button
                    type="button"
                    className="nav-notif-btn"
                    onClick={toggleNotifDropdown}
                    title="Notifications"
                    aria-label="View notifications"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-notif-icon">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    {unreadCount > 0 && (
                      <span className="nav-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </button>

                  <NotificationDropdown
                    isOpen={notifDropdownOpen}
                    onClose={() => setNotifDropdownOpen(false)}
                  />
                </div>

                {user?.role === 'CUSTOMER' && (
                  <>
                    <NavLink 
                      to="/customer/enquiries" 
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      title="My Spare Part Enquiries"
                    >
                      My Enquiries
                    </NavLink>
                    <NavLink 
                      to="/settings" 
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      title="Account & Vehicle Preferences Settings"
                    >
                      Settings
                    </NavLink>
                  </>
                )}




                {/* User Profile Badge */}
                <div className="user-profile-badge">
                  <span className="user-badge-name">{user.name}</span>
                  <span className={`badge-role-tag role-${user.role.toLowerCase()}`}>{user.role}</span>
                </div>

                <button 
                  type="button" 
                  className="btn nav-logout-btn" 
                  onClick={handleLogout}
                  id="nav-logout-btn"
                  title="Sign out of EXACTSPARE"
                >
                  <span className="logout-icon">🚪</span>
                  <span>Logout</span>
                </button>
              </>
            ) : !isLoginPage ? (
              /* ONLY SIGN IN when not authenticated and not on login page */
              <NavLink 
                to="/login" 
                className="btn btn-primary nav-signin-btn"
              >
                Sign In
              </NavLink>
            ) : null}
          </div>
        </nav>

        {/* Mobile Menu Toggle Button */}
        {isAuthenticated && (
          <button 
            className="mobile-toggle-btn" 
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="container mobile-nav-links">
            {isAuthenticated ? (
              <>
                <NavLink 
                  to="/" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                  end
                >
                  Home
                </NavLink>

                <NavLink 
                  to="/parts" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Browse Parts
                </NavLink>

                <NavLink 
                  to="/shops" 
                  className={({ isActive }) => `mobile-nav-link nav-find-shops-highlight ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  📍 Find Shops (Nearby)
                </NavLink>

                {/* Mobile Vehicle Selection */}
                <button 
                  type="button"
                  className="mobile-nav-link mobile-veh-btn" 
                  onClick={() => {
                    closeMobileMenu();
                    openVehicleModal();
                  }}
                >
                  🚗 Vehicle: <strong>{displayLabel}</strong>
                </button>

                {user?.role === 'OWNER' && (
                  <NavLink 
                    to="/owner/dashboard" 
                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                    onClick={closeMobileMenu}
                  >
                    Shop Owner Portal
                  </NavLink>
                )}

                {user?.role === 'ADMIN' && (
                  <NavLink 
                    to="/admin/dashboard" 
                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                    onClick={closeMobileMenu}
                  >
                    Admin Portal
                  </NavLink>
                )}

                <button 
                  type="button"
                  className="mobile-nav-link mobile-ai-btn" 
                  onClick={() => {
                    closeMobileMenu();
                    if (onOpenAi) onOpenAi();
                  }}
                >
                  ✨ Ask AI Assistant
                </button>

                {(!user || user.role === 'CUSTOMER') && (
                  <>
                    <NavLink 
                      to="/wishlist" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      My Saved Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ''}
                    </NavLink>
                  </>
                )}

                <NavLink 
                  to="/notifications" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
                </NavLink>

                {user?.role === 'CUSTOMER' && (
                  <>
                    <NavLink 
                      to="/customer/enquiries" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      💬 My Enquiries
                    </NavLink>
                    <NavLink 
                      to="/settings" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      Settings & Profile
                    </NavLink>
                    <NavLink 
                      to="/support" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      Customer Support
                    </NavLink>
                  </>
                )}

                {user?.role === 'OWNER' && (
                  <NavLink 
                    to="/owner/dashboard" 
                    className={({ isActive }) => `mobile-nav-link nav-portal-highlight-link ${isActive ? 'active' : ''}`} 
                    onClick={closeMobileMenu}
                  >
                    🏬 Open Shop Owner Portal →
                  </NavLink>
                )}

                {user?.role === 'ADMIN' && (
                  <div className="mobile-admin-section">
                    <div className="mobile-section-divider">
                      <span>Platform Operations</span>
                    </div>
                    <NavLink 
                      to="/admin/dashboard" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      📊 Admin Dashboard
                    </NavLink>
                    <NavLink 
                      to="/admin/analytics" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      📈 Sales & Reports
                    </NavLink>
                    <NavLink 
                      to="/admin/applications" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      📑 Shop Applications
                    </NavLink>
                    <NavLink 
                      to="/admin/subscriptions" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      💳 Subscriptions
                    </NavLink>
                    <NavLink 
                      to="/admin/shops" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      🏬 Verified Shops
                    </NavLink>
                    <NavLink 
                      to="/admin/users" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      👥 User Management
                    </NavLink>
                    <NavLink 
                      to="/admin/support" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      🎧 Support Tickets
                    </NavLink>
                    <NavLink 
                      to="/admin/trust-safety" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      🛡️ Trust & Safety
                    </NavLink>
                  </div>
                )}

                <NavLink 
                  to="/account/security" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Account Security
                </NavLink>
                <div className="mobile-user-info">
                  Signed in as <strong>{user.name}</strong> ({user.email})
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary mobile-logout-btn" 
                  onClick={handleLogout}
                  id="mobile-logout-btn"
                  title="Sign out of EXACTSPARE"
                >
                  <span className="logout-icon">🚪</span>
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <NavLink 
                to="/login" 
                className="btn btn-primary mobile-signin-btn" 
                onClick={closeMobileMenu}
              >
                Sign In
              </NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
