import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/api';
import './ResetPasswordPage.css';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password rule tests
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Reset token is missing from the URL. Please request a new link.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!hasLetter || !hasNumber) {
      setErrorMessage('Password must contain at least one letter and one number.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await resetPassword({
        token,
        password,
        confirmPassword
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMessage(res.error || 'Failed to reset password. The link may have expired or already been used.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-root">
      <div className="auth-ambient-glow auth-ambient-top"></div>
      <div className="auth-ambient-glow auth-ambient-bottom"></div>
      <div className="auth-container">
        <div className="reset-password-card">
          <div className="auth-card-header">
            <span className="badge badge-orange">Account Security</span>
            <h1 className="auth-title">Create New Password</h1>
            <p className="auth-subtitle">
              Choose a strong, unique password to secure your EXACTSPARE account.
            </p>
          </div>

          {!token && (
            <div className="auth-alert error-alert fade-in">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Invalid password reset link: Missing security token.</span>
            </div>
          )}

          {errorMessage && (
            <div className="auth-alert error-alert fade-in" role="alert">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {success ? (
            <div className="reset-success-box fade-in">
              <div className="success-icon-wrapper">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16A34A" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2 className="success-title">Password Reset Complete!</h2>
              <p className="success-desc">
                Your password has been securely updated. You can now log in using your new credentials.
              </p>
              <div className="reset-actions">
                <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                  Log In Now →
                </Link>
              </div>
            </div>
          ) : !token ? (
            <div className="invalid-token-box">
              <p>This password reset link is invalid or incomplete.</p>
              <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                Request a New Reset Link
              </Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password (min. 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Password Requirement Checklist */}
              <div className="password-requirements-card">
                <p className="requirements-title">Password Requirements:</p>
                <ul className="requirements-list">
                  <li className={hasMinLength ? 'met' : 'unmet'}>
                    <span className="check-icon">{hasMinLength ? '✓' : '○'}</span>
                    At least 8 characters
                  </li>
                  <li className={hasLetter ? 'met' : 'unmet'}>
                    <span className="check-icon">{hasLetter ? '✓' : '○'}</span>
                    Contains at least one letter
                  </li>
                  <li className={hasNumber ? 'met' : 'unmet'}>
                    <span className="check-icon">{hasNumber ? '✓' : '○'}</span>
                    Contains at least one number
                  </li>
                  {confirmPassword.length > 0 && (
                    <li className={passwordsMatch ? 'met' : 'unmet'}>
                      <span className="check-icon">{passwordsMatch ? '✓' : '○'}</span>
                      Passwords match
                    </li>
                  )}
                </ul>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={submitting || !isFormValid}
                id="reset-submit-btn"
              >
                {submitting ? 'Resetting Password...' : 'Save New Password'}
              </button>

              <div className="form-footer-link">
                <Link to="/login" className="auth-link back-link">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}

          <div className="auth-security-note">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Password is encrypted using industry standard bcrypt with salt rounds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
