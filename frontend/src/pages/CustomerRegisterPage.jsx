import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CustomerRegisterPage.css';

const CustomerRegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAgreed: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear field-specific error when user modifies it
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }
    const phoneRegex = /^[0-9+()\- ]{7,20}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      errors.phone = 'Please provide a valid phone number (7-20 digits).';
    }
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one letter and one number.';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!formData.termsAgreed) {
      errors.termsAgreed = 'You must acknowledge the terms to register.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: 'CUSTOMER'
      });

      if (res.success && res.user) {
        navigate('/customer/dashboard', { replace: true });
      } else {
        setErrorMessage(res.error || 'Registration failed. Please check inputs.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred during registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page-root">
      <div className="container register-container">
        <div className="register-card">
          <div className="register-card-header">
            <span className="badge badge-navy">Customer Portal</span>
            <h1 className="register-title">Create Customer Account</h1>
            <p className="register-subtitle">
              Sign up to discover vehicle spare parts in nearby shops and compare availability.
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

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="customer-name">Full Name</label>
              <input
                id="customer-name"
                name="name"
                type="text"
                className={`form-input ${fieldErrors.name ? 'input-error' : ''}`}
                placeholder="e.g. Rahul Sharma"
                value={formData.name}
                onChange={handleChange}
                required
              />
              {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="customer-email">Email Address</label>
                <input
                  id="customer-email"
                  name="email"
                  type="email"
                  className={`form-input ${fieldErrors.email ? 'input-error' : ''}`}
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
                {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="customer-phone">Phone Number</label>
                <input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  className={`form-input ${fieldErrors.phone ? 'input-error' : ''}`}
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                {fieldErrors.phone && <span className="field-error-text">{fieldErrors.phone}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="customer-password">Password (min 8 chars)</label>
                <div className="password-input-wrapper">
                  <input
                    id="customer-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${fieldErrors.password ? 'input-error' : ''}`}
                    placeholder="At least 1 letter & 1 digit"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && <span className="field-error-text">{fieldErrors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="customer-confirm-password">Confirm Password</label>
                <input
                  id="customer-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                {fieldErrors.confirmPassword && <span className="field-error-text">{fieldErrors.confirmPassword}</span>}
              </div>
            </div>

            <div className="terms-checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="termsAgreed"
                  checked={formData.termsAgreed}
                  onChange={handleChange}
                  required
                />
                <span>I acknowledge and agree to the EXACTSPARE platform policies and customer terms.</span>
              </label>
              {fieldErrors.termsAgreed && <span className="field-error-text">{fieldErrors.termsAgreed}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary register-submit-btn"
              disabled={submitting}
              id="customer-register-button"
            >
              {submitting ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>

          <div className="register-card-footer">
            <p>
              Already have an account? <Link to="/login" className="auth-link highlight-link">Sign in here →</Link>
            </p>
            <p className="owner-register-callout">
              Looking to register an auto spare-parts shop? <Link to="/register-owner" className="auth-link">Shop Owner Registration →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegisterPage;
