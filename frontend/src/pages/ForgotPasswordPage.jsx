import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import './ForgotPasswordPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await forgotPassword(trimmed);

      if (res.success) {
        setSubmitted(true);
        if (res.data?.devResetUrl) {
          setDevResetUrl(res.data.devResetUrl);
        }
        // Set 60-second cooldown on resending
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMessage(res.error || 'Failed to submit password reset request. Please try again.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please verify your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = (e) => {
    if (resendCooldown > 0) return;
    handleSubmit(e);
  };

  return (
    <div className="auth-page-root">
      <div className="auth-ambient-glow auth-ambient-top"></div>
      <div className="auth-ambient-glow auth-ambient-bottom"></div>
      <div className="auth-container">
        <div className="forgot-password-card">
          <div className="auth-card-header">
            <span className="badge badge-orange">Password Recovery</span>
            <h1 className="auth-title">Forgot Your Password?</h1>
            <p className="auth-subtitle">
              Enter your registered email address and we'll send you a secure link to reset your password.
            </p>
          </div>

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

          {submitted ? (
            <div className="reset-success-box fade-in">
              <div className="success-icon-wrapper">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#FF6B00" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h2 className="success-title">Check Your Inbox</h2>
              <p className="success-desc">
                If an account exists for <strong>{email}</strong>, you will receive an email containing a secure single-use password reset link shortly.
              </p>
              <div className="instructions-box">
                <p>• The reset link is valid for <strong>15 minutes</strong>.</p>
                <p>• Be sure to check your <em>Spam</em> or <em>Junk</em> folder if it does not appear within 2 minutes.</p>
              </div>

              {devResetUrl && (
                <div className="dev-reset-box">
                  <div className="dev-reset-header">
                    <span>⚡ Development Mode Link</span>
                  </div>
                  <p className="dev-reset-desc">
                    SMTP server is in local mock mode. You can open your password reset link directly:
                  </p>
                  <a href={devResetUrl} className="btn-dev-reset">
                    Open Password Reset Form →
                  </a>
                </div>
              )}

              <div className="reset-actions">
                <button
                  type="button"
                  className="btn btn-outline resend-btn"
                  onClick={handleResend}
                  disabled={submitting || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Link'}
                </button>
                <Link to="/login" className="btn btn-primary return-login-btn">
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="forgot-email">Registered Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={submitting}
                id="forgot-submit-btn"
              >
                {submitting ? 'Sending Reset Link...' : 'Send Password Reset Link'}
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
            <span>Secured with cryptographic single-use hashing & rate-limiting protection</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
