import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ProtectedRoute.css';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Session verification loading screen
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner-card">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Verifying EXACTSPARE Session...</h3>
          <p>Checking authentication credentials with backend security</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated check -> Redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-based check -> Redirect to unauthorized page
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" state={{ attemptedRole: user.role, requiredRoles: allowedRoles }} replace />;
  }

  // 4. Authorized -> Render children or child routes
  return <Outlet />;
};

export default ProtectedRoute;
