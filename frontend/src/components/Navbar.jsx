import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
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
          <span className="badge badge-orange">Module 5 • Location Search</span>
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

          {isAuthenticated ? (
            <>
              {user?.role === 'OWNER' && (
                <>
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

            {isAuthenticated ? (
              <>
                {user?.role === 'OWNER' && (
                  <>
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
