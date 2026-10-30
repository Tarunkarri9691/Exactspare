import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyApplication, fetchMyApprovedShop } from '../services/api';
import './LoginPage.css';

/**
 * EXACTSPARE PORTAL LOGIN
 * Professional single-page compact sign-in terminal.
 * No picture inside the card, zero vertical scrolling, with dedicated Change Portal button.
 */
const LoginPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPortal = searchParams.get('portal') || 'customer';
  const [selectedPortal, setSelectedPortal] = useState(initialPortal);
  const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);
  const portalMenuRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close portal dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (portalMenuRef.current && !portalMenuRef.current.contains(event.target)) {
        setIsPortalMenuOpen(false);
      }
    };
    if (isPortalMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPortalMenuOpen]);

  // If already authenticated, redirect to destination, dashboard, or home
  useEffect(() => {
    if (user) {
      const fromPath = location.state?.from?.pathname;
      if (fromPath && !fromPath.startsWith('/unauthorized') && fromPath !== '/login') {
        navigate(fromPath, { replace: true });
      } else {
        switch (user.role) {
          case 'ADMIN':
            navigate('/admin/dashboard', { replace: true });
            break;
          case 'OWNER':
            navigate('/owner/dashboard', { replace: true });
            break;
          default:
            navigate('/', { replace: true });
            break;
        }
      }
    }
  }, [user, navigate, location]);

  // Sync selected portal from URL parameter if changed
  useEffect(() => {
    const portalParam = searchParams.get('portal');
    if (portalParam && ['customer', 'owner', 'admin'].includes(portalParam)) {
      setSelectedPortal(portalParam);
    }
  }, [searchParams]);

  const handleSelectPortal = (portalKey) => {
    setSelectedPortal(portalKey);
    setSearchParams({ portal: portalKey }, { replace: true });
    setErrorMessage('');
    setIsPortalMenuOpen(false);
    setEmail('');
    setPassword('');
  };

  // Quick Autofill helper for demo & testing (Customer and Merchant only)
  const handleQuickFill = (portalKey) => {
    setSelectedPortal(portalKey);
    setSearchParams({ portal: portalKey }, { replace: true });
    setErrorMessage('');
    setIsPortalMenuOpen(false);

    if (portalKey === 'owner') {
      setEmail('owner.demo@exactspare.com');
      setPassword('OwnerExactSpare@2026');
    } else if (portalKey === 'customer') {
      setEmail('customer@exactspare.com');
      setPassword('CustomerExactSpare@2026');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await login({ email: trimmedEmail, password });

      if (res.success && res.user) {
        if (selectedPortal === 'admin' && res.user.role !== 'ADMIN') {
          setErrorMessage('Access denied: This account does not possess administrator privileges.');
          return;
        }

        const fromPath = location.state?.from?.pathname;
        if (fromPath && !fromPath.startsWith('/unauthorized')) {
          navigate(fromPath, { replace: true });
        } else if (res.user.role === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else if (res.user.role === 'OWNER') {
          navigate('/owner/dashboard', { replace: true });
        } else {
          navigate('/customer/dashboard', { replace: true });
        }
      } else {
        setErrorMessage(res.error || 'Invalid email or password.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred during sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const portalConfig = {
    customer: {
      badge: 'Vehicle Owner',
      badgeClass: 'badge-blue',
      title: 'Customer Sign In',
      subtitle: 'Access vehicle garage, wishlist & track orders',
      emailPlaceholder: 'customer@example.com',
      passwordPlaceholder: 'Enter your security credentials',
      registerText: 'New vehicle owner?',
      registerLinkText: 'Create Account →',
      registerLink: '/register'
    },
    owner: {
      badge: 'Merchant Partner',
      badgeClass: 'badge-orange',
      title: 'Shop Owner Sign In',
      subtitle: 'Manage store inventory, stock & customer orders',
      emailPlaceholder: 'shopowner@example.com',
      passwordPlaceholder: 'Enter your security credentials',
      registerText: 'Own an auto parts store?',
      registerLinkText: 'Apply as Partner →',
      registerLink: '/register-owner'
    },
    admin: {
      badge: 'Platform Administrator',
      badgeClass: 'badge-purple',
      title: 'Admin Console Access',
      subtitle: 'Platform governance, merchant audit & telemetry',
      emailPlaceholder: 'admin@exactspare.com',
      passwordPlaceholder: 'Enter your security credentials',
      registerText: 'Admin access restricted',
      registerLinkText: 'Authorized Only',
      registerLink: null
    }
  };

  const portalsList = [
    {
      key: 'customer',
      name: 'Customer Portal',
      role: 'Vehicle Owner',
      desc: 'Buy parts, track repairs & orders',
      badgeClass: 'badge-blue',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
          <circle cx="7" cy="17" r="2"></circle>
          <path d="M9 17h6"></path>
          <circle cx="17" cy="17" r="2"></circle>
        </svg>
      )
    },
    {
      key: 'owner',
      name: 'Shop Owner Portal',
      role: 'Merchant Partner',
      desc: 'Manage inventory, stock & sales',
      badgeClass: 'badge-orange',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
    {
      key: 'admin',
      name: 'Admin Console',
      role: 'Governance & Ops',
      desc: 'Store verification & audit control',
      badgeClass: 'badge-purple',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      )
    }
  ];

  const currentConfig = portalConfig[selectedPortal] || portalConfig.customer;

  return (
    <div className="auth-page-root">
      <div className="auth-ambient-glow auth-ambient-top"></div>
      <div className="auth-ambient-glow auth-ambient-bottom"></div>

      <div className="auth-container">
        {/* Single Centered Sign-in Card - No Picture, Perfectly Compact */}
        <div className={`auth-terminal-card portal-theme-${selectedPortal}`}>

          {/* Integrated Portal Header Row with "Change Portal" Button */}
          <div className="terminal-header-row" ref={portalMenuRef}>
            <div className="terminal-title-block">
              <div className="terminal-badge-wrap">
                <span className={`badge ${currentConfig.badgeClass}`}>{currentConfig.badge}</span>
                <span className="live-dot-indicator" title="Gateway Online"></span>
              </div>
              <h1 className="terminal-title">{currentConfig.title}</h1>
              <p className="terminal-subtitle">{currentConfig.subtitle}</p>
            </div>

            {/* The One Dedicated Change Portal Button */}
            <div className="change-portal-btn-wrapper">
              <button
                type="button"
                className={`btn-change-portal ${isPortalMenuOpen ? 'active' : ''}`}
                onClick={() => setIsPortalMenuOpen((prev) => !prev)}
                aria-expanded={isPortalMenuOpen}
                aria-haspopup="true"
                id="btn-change-portal"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="20" x2="21" y2="3"></line>
                  <polyline points="21 16 21 21 16 21"></polyline>
                  <line x1="15" y1="15" x2="21" y2="21"></line>
                  <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
                <span>Change Portal</span>
                <svg 
                  viewBox="0 0 24 24" 
                  width="12" 
                  height="12" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5"
                  className={`chevron-icon ${isPortalMenuOpen ? 'chevron-rotated' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Dropdown Menu when clicked */}
              {isPortalMenuOpen && (
                <div className="portal-dropdown-menu fade-in" role="menu">
                  <div className="dropdown-menu-header">
                    <span>Select Portal Workspace</span>
                  </div>
                  <div className="dropdown-menu-list">
                    {portalsList.map((portal) => (
                      <button
                        key={portal.key}
                        type="button"
                        className={`portal-menu-item ${selectedPortal === portal.key ? 'selected' : ''}`}
                        onClick={() => handleSelectPortal(portal.key)}
                        role="menuitem"
                      >
                        <div className={`portal-menu-icon portal-icon-${portal.key}`}>
                          {portal.icon}
                        </div>
                        <div className="portal-menu-text">
                          <div className="portal-menu-title-row">
                            <span className="portal-menu-title">{portal.name}</span>
                            <span className={`portal-menu-role ${portal.badgeClass}`}>{portal.role}</span>
                          </div>
                          <span className="portal-menu-desc">{portal.desc}</span>
                        </div>
                        {selectedPortal === portal.key && (
                          <span className="portal-menu-check">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="auth-alert error-alert fade-in" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">
                <span className="label-icon">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder={currentConfig.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <div className="password-label-row">
                <label htmlFor="login-password">
                  <span className="label-icon">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  Password
                </label>
                <Link to="/forgot-password" className="forgot-password-link">
                  Forgot?
                </Link>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={currentConfig.passwordPlaceholder || 'Enter your security credentials'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={submitting}
              id="login-submit-button"
            >
              {submitting ? (
                <span className="submitting-inline">
                  <span className="spinner-dot"></span>
                  Authenticating...
                </span>
              ) : (
                <span className="submit-btn-content">
                  Sign In to {selectedPortal === 'admin' ? 'Admin Console' : selectedPortal === 'owner' ? 'Merchant Workspace' : 'Customer Account'}
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Autofill Bar - Customer & Merchant only */}
          <div className="quick-fill-bar">
            <span className="quick-fill-label">⚡ Demo:</span>
            <div className="quick-fill-buttons">
              <button
                type="button"
                className={`btn-quick-fill ${selectedPortal === 'customer' ? 'btn-quick-active' : ''}`}
                onClick={() => handleQuickFill('customer')}
              >
                👤 Customer
              </button>
              <button
                type="button"
                className={`btn-quick-fill ${selectedPortal === 'owner' ? 'btn-quick-active' : ''}`}
                onClick={() => handleQuickFill('owner')}
              >
                🏬 Merchant
              </button>
            </div>
          </div>

          {/* Compact Terminal Footer */}
          <div className="terminal-footer">
            <div className="register-links-block">
              <span className="register-prompt">{currentConfig.registerText}</span>
              {currentConfig.registerLink ? (
                <Link to={currentConfig.registerLink} className="auth-link highlight-link">
                  {currentConfig.registerLinkText}
                </Link>
              ) : (
                <span className="auth-link-admin-note">
                  🔒 Restricted Platform Access
                </span>
              )}
            </div>

            <div className="terminal-security-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>256-Bit SSL • HttpOnly Session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
