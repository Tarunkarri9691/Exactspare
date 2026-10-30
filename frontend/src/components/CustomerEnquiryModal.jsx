import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createEnquiryApi } from '../services/api';
import './CustomerEnquiryModal.css';

const CustomerEnquiryModal = ({ isOpen, onClose, shop, part = null, onSuccess }) => {
  const { user, isAuthenticated } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  // Vehicle details (optional)
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [compatibilityQuestion, setCompatibilityQuestion] = useState('');
  const [showVehicleFields, setShowVehicleFields] = useState(!!part);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [submittedData, setSubmittedData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setCustomerName(user.name || '');
        setCustomerEmail(user.email || '');
        setCustomerPhone(user.phone || '');
      }
      if (part) {
        setSubject(`Enquiry: ${part.partName} (Ref: ${part.partNumber || part._id})`);
        setShowVehicleFields(true);
      } else if (shop) {
        setSubject(`General Enquiry for ${shop.name}`);
      }
      setErrorMessage('');
      setValidationErrors({});
      setSubmittedData(null);
    }
  }, [isOpen, user, part, shop]);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!customerName.trim()) {
      errors.customerName = 'Please provide your name.';
    }
    if (!customerEmail.trim()) {
      errors.customerEmail = 'Please provide your contact email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      errors.customerEmail = 'Please provide a valid email address.';
    }
    if (!subject.trim()) {
      errors.subject = 'Enquiry subject is required.';
    } else if (subject.trim().length > 150) {
      errors.subject = 'Subject cannot exceed 150 characters.';
    }
    if (!message.trim()) {
      errors.message = 'Please write your message to the shop owner.';
    } else if (message.trim().length < 5) {
      errors.message = 'Message must be at least 5 characters long.';
    } else if (message.trim().length > 2000) {
      errors.message = 'Message cannot exceed 2000 characters.';
    }
    if (year && (isNaN(Number(year)) || Number(year) < 1950 || Number(year) > 2030)) {
      errors.year = 'Please enter a valid model year (1950 - 2030).';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isAuthenticated) {
      setErrorMessage('You must be signed in as a customer to send an enquiry.');
      return;
    }

    if (!validate()) return;

    try {
      setSubmitting(true);
      const payload = {
        shopId: shop?._id || shop?.id,
        sparePartId: part?._id || part?.id || null,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        vehicleInfo: {
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          year: year.trim() || undefined,
          compatibilityQuestion: compatibilityQuestion.trim() || undefined
        }
      };

      const res = await createEnquiryApi(payload);
      if (res.success) {
        setSubmittedData(res.data);
        if (onSuccess) onSuccess(res.data);
      } else {
        setErrorMessage(res.error || 'Failed to submit enquiry. Please check your inputs.');
        if (res.errors) {
          setValidationErrors(res.errors);
        }
      }
    } catch (err) {
      console.error('Submit enquiry error:', err);
      setErrorMessage('An unexpected error occurred while submitting your enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="enquiry-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="enquiry-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="enquiry-modal-header">
          <div className="header-titles">
            <span className="modal-category-badge">
              {part ? 'Spare Part In-Store Enquiry' : 'Direct Merchant Communication'}
            </span>
            <h2 className="modal-title">
              Contact {shop?.name || 'Shop Owner'}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Enquiry Dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="enquiry-modal-body">
          {submittedData ? (
            /* Success Confirmation State */
            <div className="enquiry-success-view">
              <div className="success-icon-wrap">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 className="success-heading">Enquiry Sent to {shop?.name}!</h3>
              <p className="success-lead">
                Your message has been delivered directly to the shop owner's enquiries inbox. They will review your enquiry and provide a response.
              </p>

              <div className="enquiry-summary-box">
                <div className="summary-row">
                  <span className="summary-label">Reference ID:</span>
                  <span className="summary-val font-mono">{submittedData._id}</span>
                </div>
                {part && (
                  <div className="summary-row">
                    <span className="summary-label">Referenced Part:</span>
                    <span className="summary-val font-semibold">{part.partName}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-label">Subject:</span>
                  <span className="summary-val">{submittedData.subject}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Status:</span>
                  <span className="enquiry-status-badge badge-new">NEW</span>
                </div>
              </div>

              <div className="success-actions-row">
                <Link
                  to="/customer/enquiries"
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  View My Enquiries & Responses →
                </Link>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="enquiry-form" noValidate>
              {/* Context Summary Card */}
              <div className="enquiry-context-card">
                <div className="shop-ref-item">
                  <span className="ref-icon">🏬</span>
                  <div>
                    <strong>{shop?.name || 'Verified Merchant'}</strong>
                    <span className="shop-addr-sub">
                      {shop?.addressLine ? `${shop.addressLine}, ${shop.city}` : 'Physical Auto Spares Store'}
                    </span>
                  </div>
                </div>

                {part && (
                  <div className="part-ref-item">
                    <span className="ref-icon">⚙️</span>
                    <div>
                      <strong>{part.partName}</strong>
                      <span className="part-sub-meta">
                        Brand: {part.manufacturer || 'OEM'} | SKU: {part.partNumber || 'N/A'} | ₹{Number(part.price || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="enquiry-alert alert-danger" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Customer Contact Details (Read/Editable) */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="customer-name-input">
                    Your Name <span className="req">*</span>
                  </label>
                  <input
                    id="customer-name-input"
                    type="text"
                    className={`form-input ${validationErrors.customerName ? 'input-error' : ''}`}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    maxLength={70}
                    required
                  />
                  {validationErrors.customerName && (
                    <span className="field-err">{validationErrors.customerName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="customer-email-input">
                    Contact Email <span className="req">*</span>
                  </label>
                  <input
                    id="customer-email-input"
                    type="email"
                    className={`form-input ${validationErrors.customerEmail ? 'input-error' : ''}`}
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="name@example.com"
                    maxLength={100}
                    required
                  />
                  {validationErrors.customerEmail && (
                    <span className="field-err">{validationErrors.customerEmail}</span>
                  )}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="customer-phone-input">
                    Contact Phone <span className="opt-tag">(Optional)</span>
                  </label>
                  <input
                    id="customer-phone-input"
                    type="tel"
                    className="form-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    maxLength={20}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="enquiry-subject-input">
                    Enquiry Subject <span className="req">*</span>
                  </label>
                  <input
                    id="enquiry-subject-input"
                    type="text"
                    className={`form-input ${validationErrors.subject ? 'input-error' : ''}`}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Availability for pickup this weekend"
                    maxLength={150}
                    required
                  />
                  {validationErrors.subject && (
                    <span className="field-err">{validationErrors.subject}</span>
                  )}
                </div>
              </div>

              {/* Customer's Message */}
              <div className="form-group">
                <div className="label-with-counter">
                  <label htmlFor="enquiry-message-input">
                    Your Message / Question <span className="req">*</span>
                  </label>
                  <span className={`char-counter ${message.length > 1900 ? 'counter-warn' : ''}`}>
                    {message.length} / 2000
                  </span>
                </div>
                <textarea
                  id="enquiry-message-input"
                  className={`form-textarea ${validationErrors.message ? 'input-error' : ''}`}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about part condition, availability, fitment compatibility with your vehicle, or store pickup timing..."
                  maxLength={2000}
                  required
                />
                {validationErrors.message && (
                  <span className="field-err">{validationErrors.message}</span>
                )}
              </div>

              {/* Optional Vehicle Compatibility Accordion / Toggle */}
              <div className="vehicle-toggle-section">
                <button
                  type="button"
                  className="vehicle-toggle-btn"
                  onClick={() => setShowVehicleFields(!showVehicleFields)}
                >
                  <span>🚗 Optional Vehicle Compatibility Details</span>
                  <span className="toggle-arrow">{showVehicleFields ? '▲' : '▼'}</span>
                </button>

                {showVehicleFields && (
                  <div className="vehicle-fields-box">
                    <p className="vehicle-fields-hint">
                      Provide your vehicle details so the shop owner can verify exact fitment before you visit the store.
                    </p>
                    <div className="form-grid-3">
                      <div className="form-group">
                        <label htmlFor="vehicle-make-input">Make</label>
                        <input
                          id="vehicle-make-input"
                          type="text"
                          className="form-input"
                          value={make}
                          onChange={(e) => setMake(e.target.value)}
                          placeholder="e.g. Maruti Suzuki"
                          maxLength={50}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="vehicle-model-input">Model</label>
                        <input
                          id="vehicle-model-input"
                          type="text"
                          className="form-input"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="e.g. Swift VXI"
                          maxLength={50}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="vehicle-year-input">Year</label>
                        <input
                          id="vehicle-year-input"
                          type="number"
                          className={`form-input ${validationErrors.year ? 'input-error' : ''}`}
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          placeholder="e.g. 2019"
                          min="1950"
                          max="2030"
                        />
                        {validationErrors.year && (
                          <span className="field-err">{validationErrors.year}</span>
                        )}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label htmlFor="compatibility-question-input">
                        Specific Compatibility Question
                      </label>
                      <input
                        id="compatibility-question-input"
                        type="text"
                        className="form-input"
                        value={compatibilityQuestion}
                        onChange={(e) => setCompatibilityQuestion(e.target.value)}
                        placeholder="e.g. Does this brake disc fit the ABS or non-ABS variant?"
                        maxLength={250}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Footer Action Buttons */}
              <div className="enquiry-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="btn-loading-flex">
                      <span className="spinner-dots"></span> Submitting...
                    </span>
                  ) : (
                    <span>💬 Send Enquiry to Shop</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerEnquiryModal;
