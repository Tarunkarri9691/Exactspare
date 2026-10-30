import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail, resendEmailVerification } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './EmailVerificationPage.css';

const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error' | 'no_token'
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no_token');
      return;
    }

    let isMounted = true;

    const performVerification = async () => {
      try {
        setStatus('verifying');
        const res = await verifyEmail(token);
        if (!isMounted) return;

        if (res.success) {
          setStatus('success');
          setMessage(res.data?.message || 'Your email address has been successfully verified!');
        } else {
          setStatus('error');
          setMessage(res.error || 'Verification link is invalid or has expired.');
        }
      } catch {
        if (!isMounted) return;
        setStatus('error');
        setMessage('Network error during verification. Please try again.');
      }
    };

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    const targetEmail = resendEmail.trim() || user?.email;
    if (!targetEmail) {
      setResendStatus('Please enter an email address.');
      return;
    }

    try {
      setResending(true);
      setResendStatus('');
      const res = await resendEmailVerification(targetEmail);
      if (res.success) {
        setResendStatus('If an account exists, a new verification link has been sent!');
      } else {
        setResendStatus(res.error || 'Failed to resend verification link.');
      }
    } catch {
      setResendStatus('Network error while resending link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page-root">
      <div className="container auth-container">
        <div className="auth-card verification-card">
          <div className="auth-card-header">
            <span className="badge badge-orange">Account Security</span>
            <h1 className="auth-title">Email Verification</h1>
          </div>

          {status === 'verifying' && (
            <div className="verification-state verifying-state">
              <div className="spinner-orange"></div>
              <p className="state-message">Verifying your security token with EXACTSPARE...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="verification-state success-state fade-in">
              <div className="verify-icon-wrapper success">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#16A34A" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2 className="state-title">Verification Successful!</h2>
              <p className="state-desc">{message}</p>
              <p className="state-sub">
                Your email address is now confirmed. You can enjoy uninterrupted order tracking, security updates, and notifications.
              </p>
              <div className="action-buttons-row">
                {user ? (
                  <Link to="/customer/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
                    Go to Dashboard →
                  </Link>
                ) : (
                  <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                    Proceed to Sign In →
                  </Link>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="verification-state error-state fade-in">
              <div className="verify-icon-wrapper error">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#DC2626" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h2 className="state-title">Verification Failed</h2>
              <p className="state-desc">{message}</p>
              <p className="state-sub">
                Email verification links expire after 24 hours and can only be used once. You can request a fresh verification link below.
              </p>

              {resendStatus && (
                <div className="auth-alert info-alert fade-in">
                  <span>{resendStatus}</span>
                </div>
              )}

              <form className="resend-inline-form" onSubmit={handleResend}>
                <div className="form-group">
                  <label htmlFor="resend-email-input">Your Email Address</label>
                  <input
                    id="resend-email-input"
                    type="email"
                    className="form-input"
                    placeholder="Enter registered email"
                    defaultValue={user?.email || ''}
                    value={resendEmail || (user?.email ? undefined : '')}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={resending}>
                  {resending ? 'Sending...' : 'Request New Verification Link'}
                </button>
              </form>

              <div className="back-link-wrapper">
                <Link to="/login" className="auth-link">
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {status === 'no_token' && (
            <div className="verification-state no-token-state fade-in">
              <div className="verify-icon-wrapper info">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#FF6B00" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h2 className="state-title">Missing Verification Token</h2>
              <p className="state-desc">
                To verify your email address, please click the link sent to your inbox.
              </p>

              {resendStatus && (
                <div className="auth-alert info-alert fade-in">
                  <span>{resendStatus}</span>
                </div>
              )}

              <form className="resend-inline-form" onSubmit={handleResend}>
                <div className="form-group">
                  <label htmlFor="no-token-email">Need a new link? Enter your email:</label>
                  <input
                    id="no-token-email"
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={resending}>
                  {resending ? 'Sending...' : 'Send Verification Link'}
                </button>
              </form>

              <div className="back-link-wrapper">
                <Link to="/" className="auth-link">
                  Return to Home
                </Link>
              </div>
            </div>
          )}

          <div className="auth-security-note">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Verified accounts protect against unauthorized orders and spoofing</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
