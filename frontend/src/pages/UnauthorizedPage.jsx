import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './UnauthorizedPage.css';

const UnauthorizedPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const requiredRoles = location.state?.requiredRoles || [];

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
            You do not have the required permissions to access this page or endpoint on EXACTSPARE.
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
                <span className="context-label">Required Role(s):</span>
                <span className="required-roles-text">{requiredRoles.join(' or ')}</span>
              </div>
            )}
          </div>

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
            <Link to="/" className="btn btn-outline">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
