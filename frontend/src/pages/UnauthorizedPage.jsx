import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { upgradeToOwnerApi } from '../services/api';
import './UnauthorizedPage.css';

const UnauthorizedPage = () => {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const requiredRoles = location.state?.requiredRoles || ['OWNER'];

  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  const isCustomerNeedingOwner = user?.role === 'CUSTOMER' && requiredRoles.includes('OWNER');

  const handleSwitchToOwner = async () => {
    try {
      setSwitching(true);
      setSwitchError('');
      const res = await upgradeToOwnerApi();
      if (res.success && res.data?.user) {
        if (updateUser) {
          updateUser(res.data.user);
        }
        navigate('/owner/dashboard', { replace: true });
      } else {
        setSwitchError(res.error || 'Failed to switch account role to Shop Owner.');
      }
    } catch {
      setSwitchError('Network error while switching account role.');
    } finally {
      setSwitching(false);
    }
  };

  const handleLogoutAndLogin = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN': return '/admin/dashboard';
      case 'OWNER': return '/owner/dashboard';
      default: return '/customer/dashboard';
    }
  };

  return (
    <div className="unauthorized-page-root">
      <div className="container unauthorized-container">
        <div className="unauthorized-card">
          <div className="unauthorized-icon-box">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <line x1="8" y1="11" x2="16" y2="17"></line>
            </svg>
          </div>

          <div className="unauthorized-code-tag">403 • ACCESS FORBIDDEN</div>
          <h1 className="unauthorized-title">Role Authorization Restricted</h1>

          <p className="unauthorized-desc">
            {isCustomerNeedingOwner
              ? 'You are signed in with an active Customer account. The Shop Owner Portal is strictly reserved for auto parts merchants who manage store listings and inventory.'
              : 'You do not have the required permissions to access this page or endpoint on EXACTSPARE.'}
          </p>

          <div className="role-context-box">
            <div className="context-row">
              <span className="context-label">Your Current Role:</span>
              <span className={`badge-role-tag role-${user?.role?.toLowerCase() || 'unauthenticated'}`}>
                {user?.role || 'Guest'}
              </span>
            </div>
            {requiredRoles.length > 0 && (
              <div className="context-row">
                <span className="context-label">Required Role:</span>
                <span className="required-roles-text">{requiredRoles.join(' or ')}</span>
              </div>
            )}
          </div>

          {switchError && (
            <div className="error-notice-card" style={{ marginBottom: '16px', color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem' }}>
              ⚠️ {switchError}
            </div>
          )}

          {isCustomerNeedingOwner ? (
            <div className="unauthorized-actions-stacked" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              {/* Primary Customer Actions */}
              <Link
                to="/customer/dashboard"
                className="btn btn-primary"
                style={{ padding: '13px 20px', fontSize: '1rem', fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}
                id="unauth-customer-dash-btn"
              >
                👤 Continue to Customer Dashboard →
              </Link>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Link
                  to="/parts"
                  className="btn btn-outline"
                  style={{ padding: '11px 14px', fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}
                >
                  🔍 Browse Parts
                </Link>
                <Link
                  to="/shops"
                  className="btn btn-outline"
                  style={{ padding: '11px 14px', fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}
                >
                  📍 Find Shops
                </Link>
              </div>

              {/* Merchant Options Divider */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                  Are you an auto spare parts vendor?
                </span>

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '10px 16px', fontSize: '0.9rem', borderColor: '#f97316', color: '#ea580c' }}
                  onClick={handleSwitchToOwner}
                  disabled={switching}
                  id="switch-to-owner-btn"
                >
                  {switching ? 'Upgrading Account...' : '⚡ Switch This Account to Shop Owner'}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.88rem', color: '#64748b' }}
                  onClick={handleLogoutAndLogin}
                  id="signout-to-owner-login-btn"
                >
                  🚪 Sign Out & Log In as Another User
                </button>
              </div>
            </div>
          ) : (
            <div className="unauthorized-actions">
              {user ? (
                <Link to={getDashboardLink()} className="btn btn-primary">
                  Return to My {user.role} Dashboard
                </Link>
              ) : (
                <Link to="/login" className="btn btn-primary">
                  Log In with Appropriate Role
                </Link>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleLogoutAndLogin}
              >
                Sign Out & Switch Account
              </button>
              <Link to="/" className="btn btn-outline">
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
