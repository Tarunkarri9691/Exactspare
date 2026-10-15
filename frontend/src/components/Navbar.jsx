import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';
import './Navbar.css';

const Navbar = ({ onOpenAi }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

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
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN': return '/admin/dashboard';
      case 'OWNER': return '/owner/dashboard';
      default: return '/customer/dashboard';
    }
  };

  return (
    <header className="navbar-header">
      <div className="container navbar-container">
        {/* Brand Logo */}
        <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
          <div className="brand-icon">
            <svg viewBox="0 0 32 32" fill="none" className="cog-icon">
              <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="currentColor"/>
              <path d="M16 2V6M16 26V30M2 16H6M26 16H30M6.1 6.1L8.9 8.9M23.1 23.1L25.9 25.9M6.1 25.9L8.9 23.1M23.1 8.9L25.9 6.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">EXACT<span className="brand-highlight">SPARE</span></span>
            <span className="brand-tagline">Vehicle Spare Parts Finder</span>
          </div>
        </Link>

        {/* Module Badge */}
        <div className="module-badge-nav">
          <span className="badge badge-orange">Module 10 • AI Assistant & Recommendations</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
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
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Find Shops
          </NavLink>

          <NavLink 
            to="/compare" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            ⚖️ Compare
          </NavLink>

          <button
            type="button"
            className="nav-ai-btn"
            onClick={onOpenAi}
            title="Ask AI Spare-Parts Assistant"
          >
            <span className="sparkle-icon">✨</span> AI Assistant
          </button>

          {/* Customer Wishlist Link */}
          {(!user || user.role === 'CUSTOMER') && (
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

          {/* Cart Link (for Customers / Guests) */}
          {(!user || user.role === 'CUSTOMER') && (
            <NavLink 
              to="/cart" 
              className={({ isActive }) => `nav-link nav-cart-btn ${isActive ? 'active' : ''}`}
              title="Shopping Cart"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-cart-icon">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span>Cart</span>
              {cartCount > 0 && <span className="nav-cart-badge">{cartCount}</span>}
            </NavLink>
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
                <NavLink 
                  to="/orders" 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  My Orders
                </NavLink>
              )}

              {user?.role === 'OWNER' && (
                <>
                  <NavLink 
                    to="/owner/orders" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    Orders
                  </NavLink>
                  <NavLink 
                    to="/owner/inventory" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    Inventory
                  </NavLink>
                  <NavLink 
                    to="/owner/shop" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    My Shop
                  </NavLink>
                </>
              )}

              {user?.role === 'ADMIN' && (
                <NavLink 
                  to="/admin/applications" 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Applications
                </NavLink>
              )}

              <NavLink 
                to={getDashboardPath()} 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>

              <div className="user-profile-badge">
                <span className="user-badge-name">{user.name}</span>
                <span className={`badge-role-tag role-${user.role.toLowerCase()}`}>{user.role}</span>
              </div>

              <button 
                type="button" 
                className="btn btn-outline-white nav-logout-btn" 
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink 
                to="/login" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Login
              </NavLink>
              <NavLink 
                to="/register" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Customer Register
              </NavLink>
              <NavLink 
                to="/register-owner" 
                className={({ isActive }) => `nav-link shop-owner-link ${isActive ? 'active' : ''}`}
              >
                <span className="shop-owner-badge">Partner</span>
                Shop Owner
              </NavLink>
            </>
          )}
        </nav>

        {/* Mobile Menu Toggle Button */}
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
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="container mobile-nav-links">
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
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
              onClick={closeMobileMenu}
            >
              Find Shops
            </NavLink>

            <NavLink 
              to="/compare" 
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
              onClick={closeMobileMenu}
            >
              ⚖️ Compare Parts
            </NavLink>

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
                <NavLink 
                  to="/cart" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Shopping Cart {cartCount > 0 ? `(${cartCount})` : ''}
                </NavLink>
              </>
            )}

            {isAuthenticated ? (
              <>
                <NavLink 
                  to="/notifications" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
                </NavLink>

                {user?.role === 'CUSTOMER' && (
                  <NavLink 
                    to="/orders" 
                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                    onClick={closeMobileMenu}
                  >
                    My Orders
                  </NavLink>
                )}

                {user?.role === 'OWNER' && (
                  <>
                    <NavLink 
                      to="/owner/orders" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      Shop Orders
                    </NavLink>
                    <NavLink 
                      to="/owner/inventory" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      My Inventory
                    </NavLink>
                    <NavLink 
                      to="/owner/shop" 
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                      onClick={closeMobileMenu}
                    >
                      My Shop Profile
                    </NavLink>
                  </>
                )}

                {user?.role === 'ADMIN' && (
                  <NavLink 
                    to="/admin/applications" 
                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                    onClick={closeMobileMenu}
                  >
                    Applications Review
                  </NavLink>
                )}

                <NavLink 
                  to={getDashboardPath()} 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Dashboard ({user.role})
                </NavLink>
                <div className="mobile-user-info">
                  Signed in as <strong>{user.name}</strong> ({user.email})
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary mobile-logout-btn" 
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink 
                  to="/login" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Login
                </NavLink>
                <NavLink 
                  to="/register" 
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Customer Register
                </NavLink>
                <NavLink 
                  to="/register-owner" 
                  className={({ isActive }) => `mobile-nav-link mobile-shop-owner ${isActive ? 'active' : ''}`} 
                  onClick={closeMobileMenu}
                >
                  Shop Owner Register
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
