import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePassword, resendEmailVerification } from '../services/api';
import './ChangePasswordPage.css';

const ChangePasswordPage = () => {
  const { user } = useAuth();

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Email verification state
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState({ type: '', message: '' });
  const [verificationCooldown, setVerificationCooldown] = useState(0);

  // Validation
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isDifferent = currentPassword !== newPassword && newPassword.length > 0;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = currentPassword && hasMinLength && hasLetter && hasNumber && isDifferent && passwordsMatch;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setPasswordError('New password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setSubmittingPassword(true);
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (res.success) {
        setPasswordSuccess('Password has been changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Failed to update password. Please check your current password.');
      }
    } catch {
      setPasswordError('A network error occurred while updating your password. Please try again.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (verificationCooldown > 0 || sendingVerification) return;
    setVerificationFeedback({ type: '', message: '' });

    try {
      setSendingVerification(true);
      const res = await resendEmailVerification(user?.email);

      if (res.success) {
        setVerificationFeedback({
          type: 'success',
          message: 'Verification link sent! Check your email inbox (and spam folder).'
        });
        setVerificationCooldown(60);
        const timer = setInterval(() => {
          setVerificationCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setVerificationFeedback({
          type: 'error',
          message: res.error || 'Failed to send verification link.'
        });
      }
    } catch {
      setVerificationFeedback({
        type: 'error',
        message: 'Could not connect to the server. Please try again.'
      });
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="security-page-root">
      <div className="container security-container">
        <div className="security-page-header">
          <span className="badge badge-orange">Security & Credentials</span>
          <h1 className="security-title">Account Security</h1>
          <p className="security-subtitle">
            Manage your password, login credentials, and email verification status.
          </p>
        </div>

        <div className="security-grid">
          {/* Section 1: Email Verification Status */}
          <div className="security-card email-status-card">
            <div className="card-top-row">
              <div className="card-title-group">
                <div className="security-icon-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 className="card-title">Email Verification</h2>
                  <p className="card-subtitle">Confirm your email address for order notifications</p>
                </div>
              </div>
              <span className={`status-badge ${user?.isEmailVerified ? 'verified' : 'unverified'}`}>
                {user?.isEmailVerified ? '✓ Verified' : '● Unverified'}
              </span>
            </div>

            <div className="email-details-row">
              <span className="email-label">Registered Email:</span>
              <span className="email-value">{user?.email || '—'}</span>
            </div>

            {verificationFeedback.message && (
              <div className={`auth-alert ${verificationFeedback.type === 'success' ? 'success-alert' : 'error-alert'} fade-in`}>
                <span>{verificationFeedback.message}</span>
              </div>
            )}

            {!user?.isEmailVerified ? (
              <div className="verify-action-box">
                <p className="unverified-note">
                  Your email address has not been verified yet. Verifying your email helps protect your account and ensures you receive instant order status alerts.
                </p>
                <button
                  type="button"
                  className="btn btn-outline send-verify-btn"
                  onClick={handleResendVerification}
                  disabled={sendingVerification || verificationCooldown > 0}
                >
                  {sendingVerification
                    ? 'Sending Link...'
                    : verificationCooldown > 0
                    ? `Resend in ${verificationCooldown}s`
                    : 'Send Verification Link'}
                </button>
              </div>
            ) : (
              <div className="verified-note-box">
                <p className="verified-note">
                  ✓ Your email address is confirmed. You receive real-time dispatch updates and security alerts.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Change Password */}
          <div className="security-card change-password-card">
            <div className="card-top-row">
              <div className="card-title-group">
                <div className="security-icon-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="card-title">Change Password</h2>
                  <p className="card-subtitle">Update your password to keep your account safe</p>
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="auth-alert error-alert fade-in" role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="auth-alert success-alert fade-in" role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#16A34A" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form className="change-password-form" onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="current-password">Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? (
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
                <label htmlFor="new-password">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Minimum 8 characters with letters & numbers"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
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
                <label htmlFor="confirm-new-password">Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter new password"
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

              {/* Password Requirements List */}
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
                className="btn btn-primary submit-change-btn"
                disabled={submittingPassword || !isFormValid}
                id="change-password-submit-btn"
              >
                {submittingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
