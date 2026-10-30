import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchSubscriptionConfig,
  fetchMySubscription,
  submitSubscriptionPayment,
  fetchMyApplication
} from '../services/api';
import './OwnerPaymentMethodPage.css';

const OwnerPaymentMethodPage = () => {
  const navigate = useNavigate();

  // State
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [overallStatus, setOverallStatus] = useState('NOT_SUBSCRIBED');
  const [expiryStageInfo, setExpiryStageInfo] = useState(null);
  const [appData, setAppData] = useState({ hasApp: false, application: null });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected Plan
  const [selectedPlanId, setSelectedPlanId] = useState('quarterly_partner');

  // Selected Payment Method & UTR Input
  const [selectedMethod, setSelectedMethod] = useState('UPI_QR');
  const [paymentUtrInput, setPaymentUtrInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [appLaunchNotice, setAppLaunchNotice] = useState('');

  // Load authoritative subscription status, application status & config
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [cfgRes, mySubRes, appRes] = await Promise.all([
        fetchSubscriptionConfig(),
        fetchMySubscription(),
        fetchMyApplication().catch(() => ({ success: false }))
      ]);

      if (cfgRes.success && cfgRes.config) {
        setConfig(cfgRes.config);
      }

      if (appRes?.success) {
        setAppData({
          hasApp: !!appRes.hasApplication,
          application: appRes.application || null
        });
      }

      if (mySubRes.success) {
        setOverallStatus(mySubRes.overallStatus);
        setSubscription(mySubRes.currentSubscription);
        setExpiryStageInfo(mySubRes.expiryStageInfo || null);
        setHistory(mySubRes.history || []);
        if (mySubRes.currentSubscription?.planId) {
          setSelectedPlanId(mySubRes.currentSubscription.planId);
        }
      } else {
        setErrorMsg(mySubRes.error || 'Failed to load subscription status.');
      }
    } catch {
      setErrorMsg('Network error while connecting to EXACTSPARE server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy UPI ID to clipboard
  const handleCopyUpi = () => {
    const upi = config?.upiId || 'exactspare.merchant@upi';
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2200);
  };

  // Launch UPI App Intent
  const handleLaunchApp = (appName, appScheme, methodCode) => {
    const upi = config?.upiId || 'exactspare.merchant@upi';
    navigator.clipboard.writeText(upi);
    setSelectedMethod(methodCode);
    setAppLaunchNotice(`Opening ${appName}... Complete your transfer and enter the 12-digit UTR below for verification.`);
    setTimeout(() => setAppLaunchNotice(''), 6000);
    window.location.href = appScheme;
  };

  // Handle Submission of Payment Reference (UTR) for Admin Verification
  const handleSubmitPayment = async (methodOverride) => {
    const methodToUse = methodOverride || selectedMethod || 'UPI_QR';

    if (!paymentUtrInput || paymentUtrInput.trim().length < 6) {
      setErrorMsg('Please enter a valid UPI Transaction Reference / UTR (at least 6 characters).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await submitSubscriptionPayment({
        planId: selectedPlanId,
        paymentMethod: methodToUse,
        paymentUtr: paymentUtrInput.trim()
      });

      if (res.success) {
        setSuccessMsg(
          res.data?.message ||
          'Payment reference submitted successfully! A notification has been sent to the administrator. Once the administrator reviews and accepts your subscription, your shop will be unlocked and ready to use.'
        );
        setPaymentUtrInput('');
        await loadData();
      } else {
        setErrorMsg(res.error || 'Failed to submit payment reference. Please verify your details.');
      }
    } catch {
      setErrorMsg('Unexpected network error occurred while submitting payment reference.');
    } finally {
      setSubmitting(false);
    }
  };

  // Determine current active plan
  const plans = config?.plans || [
    {
      planId: 'quarterly_partner',
      name: 'Merchant Partner Quarterly Plan',
      amount: 499,
      billingDurationDays: 90,
      badge: 'Most Popular',
      description: 'Quarterly subscription for verified shop owners with full catalog, location search, and customer enquiries.'
    },
    {
      planId: 'annual_pro',
      name: 'Merchant Partner Annual Pro',
      amount: 1499,
      billingDurationDays: 365,
      badge: 'Best Value',
      description: 'Full 1-year premium merchant subscription with priority search ranking and unlimited part listings.'
    }
  ];

  const selectedPlan = plans.find((p) => p.planId === selectedPlanId) || plans[0];
  const currentPlan = selectedPlan;
  const fee = selectedPlan?.amount || 499;
  const upiId = config?.upiId || 'exactspare.merchant@upi';
  const payeeName = config?.payeeName || 'EXACTSPARE Merchant Services';

  // Construct standard UPI intent link
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent(`Subscription-${currentPlan.planId}`)}`;
  const defaultQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}&margin=10`;
  const qrImageUrl = config?.qrCodeImage || defaultQrUrl;

  // Format Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="sub-badge sub-badge-active">✓ ACTIVE SUBSCRIPTION</span>;
      case 'PENDING_VERIFICATION':
        return <span className="sub-badge sub-badge-pending">⏳ PENDING VERIFICATION</span>;
      case 'EXPIRED':
        return <span className="sub-badge sub-badge-expired">⚠️ SUBSCRIPTION EXPIRED</span>;
      case 'PAYMENT_FAILED':
        return <span className="sub-badge sub-badge-failed">✕ PAYMENT FAILED</span>;
      default:
        return <span className="sub-badge sub-badge-none">○ NOT SUBSCRIBED</span>;
    }
  };

  // Calculate Days Remaining
  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div className="owner-payment-page-root">
        <div className="container payment-loading-container">
          <div className="payment-spinner"></div>
          <h2>Loading Subscription & Payment Details...</h2>
          <p>Connecting to verified payment channels...</p>
        </div>
      </div>
    );
  }

  const daysRemaining = subscription?.expiryDate ? getDaysRemaining(subscription.expiryDate) : null;

  return (
    <div className="owner-payment-page-root fade-in">
      <div className="container owner-payment-container">
        {/* Header Breadcrumb & Actions */}
        <div className="payment-page-header">
          <div className="header-text-group">
            <div className="header-badge-row">
              <span className="badge-category">Merchant Portal</span>
              {renderStatusBadge(overallStatus)}
              {daysRemaining !== null && overallStatus === 'ACTIVE' && (
                <span className="badge-days-left">{daysRemaining} Days Remaining</span>
              )}
            </div>
            <h1 className="payment-page-title">Subscription & Payment Method</h1>
            <p className="payment-page-subtitle">
              Manage your EXACTSPARE store subscription fee, review real-time payment verification status, and complete renewals using official UPI QR, Google Pay, or PhonePe channels.
            </p>
          </div>
          <div className="header-action-group">
            <button
              type="button"
              className="btn btn-outline refresh-btn"
              onClick={loadData}
              title="Refresh payment and subscription status"
            >
              ↻ Refresh Status
            </button>
            <Link to="/owner/dashboard" className="btn btn-outline back-dash-btn">
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Global Alert Banners */}
        {errorMsg && (
          <div className="payment-alert alert-error fade-in">
            <span className="alert-icon">⚠️</span>
            <div className="alert-body">
              <strong>Action Needed:</strong> {errorMsg}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="payment-alert alert-success fade-in">
            <span className="alert-icon">✓</span>
            <div className="alert-body">
              <strong>Submission Recorded:</strong> {successMsg}
            </div>
          </div>
        )}

        {/* SECTION 1: Current Subscription Status Card */}
        <div className="current-sub-card">
          <div className="sub-card-top">
            <div className="sub-card-info">
              <span className="info-label">Active Plan</span>
              <h2 className="info-title">
                {subscription ? subscription.planName : (config?.planName || 'Merchant Partner Subscription')}
              </h2>
              <p className="info-desc">
                {subscription
                  ? `Internal Payment Reference: ${subscription.internalRef} • Method: ${subscription.paymentMethod || 'UPI'}`
                  : 'Subscribe to access full spare-parts catalog search, customer enquiries, GPS location placement, and priority order processing.'}
              </p>
            </div>
            <div className="sub-card-status-pill">
              {renderStatusBadge(overallStatus)}
            </div>
          </div>

          <div className="sub-card-metrics-grid">
            <div className="metric-box">
              <span className="metric-label">Configured Fee</span>
              <span className="metric-val price-val">₹{subscription ? subscription.amount : (config?.subscriptionFee || 499)}</span>
              <span className="metric-sub">{config?.currency || 'INR'} (All inclusive)</span>
            </div>

            <div className="metric-box">
              <span className="metric-label">Billing Duration</span>
              <span className="metric-val">{subscription ? subscription.billingDurationDays : (config?.billingDurationDays || 90)} Days</span>
              <span className="metric-sub">Full merchant validity</span>
            </div>

            <div className="metric-box">
              <span className="metric-label">Subscription Start</span>
              <span className="metric-val">
                {subscription?.startDate ? new Date(subscription.startDate).toLocaleDateString() : '—'}
              </span>
              <span className="metric-sub">
                {subscription?.startDate ? 'Verified activation date' : 'Awaiting confirmation'}
              </span>
            </div>

            <div className="metric-box">
              <span className="metric-label">Subscription Expiry</span>
              <span className="metric-val">
                {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : '—'}
              </span>
              <span className="metric-sub">
                {daysRemaining !== null ? `${daysRemaining} days remaining` : 'Not yet active'}
              </span>
            </div>
          </div>

          {/* Verification / Active Notice */}
          {overallStatus === 'ACTIVE' && (
            <div className={`sub-notice-banner ${expiryStageInfo ? 'expired-banner' : 'active-banner'}`}>
              <span className="notice-icon">{expiryStageInfo ? '⚠️' : '✓'}</span>
              <div>
                <strong>{expiryStageInfo ? 'Subscription Expiry Notice:' : 'Subscription Active:'}</strong>{' '}
                {expiryStageInfo ? (
                  <span>
                    <strong>{expiryStageInfo.message}</strong> Actual Expiry Date:{' '}
                    {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'N/A'}. Select a renewal plan below to maintain active store visibility.
                  </span>
                ) : (
                  <span>
                    Your merchant partner subscription is active and verified! (Valid until{' '}
                    {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'Active'}).
                  </span>
                )}
              </div>
            </div>
          )}

          {overallStatus === 'PENDING_VERIFICATION' && (
            <div className="sub-notice-banner pending-banner">
              <span className="notice-icon">⏳</span>
              <div>
                <strong>Payment Pending Verification:</strong> Your submitted payment reference (UTR: <code>{subscription?.paymentUtr || '—'}</code>) for {subscription?.planName || 'Merchant Partner Plan'} (₹{subscription?.amount || 499}) is currently undergoing bank reconciliation by platform administrators. Click "Refresh Status" anytime to check verification progress.
              </div>
            </div>
          )}

          {overallStatus === 'EXPIRED' && (
            <div className="sub-notice-banner failed-banner">
              <span className="notice-icon">⚠️</span>
              <div>
                <strong>Subscription Expired:</strong> Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access. (Expired on: {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'Recently'}). Select a plan below and submit your payment reference to restore access.
              </div>
            </div>
          )}

          {overallStatus === 'PAYMENT_FAILED' && (
            <div className="sub-notice-banner failed-banner">
              <span className="notice-icon">✕</span>
              <div>
                <strong>Payment Verification Rejected:</strong> {subscription?.rejectionReason || 'The transaction reference could not be matched with bank records.'} Please review the reference number in your payment app and resubmit your 12-digit UTR below.
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Plan Selection & Payment Gateway Workflow */}
        <div className="payment-workflow-layout">
          {/* Left Column: Plan Selection & QR Display */}
          <div className="workflow-left-col">
            {/* Step 1: Select Plan */}
            <div className="workflow-card">
              <div className="card-step-header">
                <span className="step-number">1</span>
                <div>
                  <h3 className="card-title">Select Subscription Plan</h3>
                  <p className="card-subtitle">Choose your preferred store billing duration</p>
                </div>
              </div>

              <div className="plan-selection-grid">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.planId;
                  return (
                    <div
                      key={plan.planId}
                      className={`plan-option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPlanId(plan.planId)}
                    >
                      <div className="plan-top-row">
                        <span className="plan-name">{plan.name}</span>
                        {plan.badge && <span className="plan-badge-pill">{plan.badge}</span>}
                      </div>
                      <div className="plan-price-row">
                        <span className="plan-price">₹{plan.amount}</span>
                        <span className="plan-duration">/ {plan.billingDurationDays} Days</span>
                      </div>
                      <p className="plan-desc">{plan.description}</p>
                      <div className="plan-check-circle">
                        {isSelected ? '✓' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Scan UPI QR */}
            <div className="workflow-card qr-section-card">
              <div className="card-step-header">
                <span className="step-number">2</span>
                <div>
                  <h3 className="card-title">Scan UPI QR Code</h3>
                  <p className="card-subtitle">Open Google Pay, PhonePe, Paytm, or BHIM to scan</p>
                </div>
              </div>

              <div className="qr-scanner-box">
                <div className="qr-frame">
                  <div className="corner top-left"></div>
                  <div className="corner top-right"></div>
                  <div className="corner bottom-left"></div>
                  <div className="corner bottom-right"></div>

                  <img
                    src={qrImageUrl}
                    alt="EXACTSPARE Merchant UPI QR"
                    className="qr-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />

                  {/* Fallback SVG visual QR box */}
                  <div className="qr-fallback" style={{ display: 'none' }}>
                    <svg viewBox="0 0 100 100" width="180" height="180" fill="currentColor">
                      <rect width="30" height="30" rx="4" />
                      <rect x="70" width="30" height="30" rx="4" />
                      <rect y="70" width="30" height="30" rx="4" />
                      <rect x="8" y="8" width="14" height="14" fill="#ffffff" />
                      <rect x="78" y="8" width="14" height="14" fill="#ffffff" />
                      <rect x="8" y="78" width="14" height="14" fill="#ffffff" />
                      <circle cx="50" cy="50" r="10" />
                      <rect x="42" y="20" width="8" height="16" />
                      <rect x="20" y="42" width="16" height="8" />
                      <rect x="64" y="42" width="16" height="8" />
                      <rect x="42" y="64" width="8" height="16" />
                    </svg>
                  </div>
                </div>

                <div className="qr-meta-box">
                  <div className="qr-amount-badge">
                    <span>Payable Fee:</span>
                    <strong>₹{fee} INR</strong>
                  </div>
                  <div className="qr-trust-badge">
                    <span>🔒 Official EXACTSPARE Merchant Payee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Direct App Launch & UTR Submission Form */}
          <div className="workflow-right-col">
            {/* Step 3: Direct App Launch Buttons */}
            <div className="workflow-card">
              <div className="card-step-header">
                <span className="step-number">3</span>
                <div>
                  <h3 className="card-title">Pay via Supported UPI App</h3>
                  <p className="card-subtitle">Click to launch directly on your device</p>
                </div>
              </div>

              <div className="upi-app-buttons-list">
                {/* Google Pay */}
                <button
                  type="button"
                  className="upi-app-button gpay-app"
                  onClick={() =>
                    handleLaunchApp(
                      'Google Pay',
                      `gpay://upi/pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Subscription')}`,
                      'GOOGLE_PAY'
                    )
                  }
                >
                  <div className="app-icon-wrap">
                    <span className="app-logo-badge gpay-logo">GPay</span>
                  </div>
                  <div className="app-btn-text">
                    <strong>Pay with Google Pay</strong>
                    <span>Instant UPI intent on Android / iOS</span>
                  </div>
                  <span className="app-arrow">→</span>
                </button>

                {/* PhonePe */}
                <button
                  type="button"
                  className="upi-app-button phonepe-app"
                  onClick={() =>
                    handleLaunchApp(
                      'PhonePe',
                      `phonepe://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Subscription')}`,
                      'PHONEPE'
                    )
                  }
                >
                  <div className="app-icon-wrap">
                    <span className="app-logo-badge phonepe-logo">पे</span>
                  </div>
                  <div className="app-btn-text">
                    <strong>Pay with PhonePe</strong>
                    <span>Launch official PhonePe payment screen</span>
                  </div>
                  <span className="app-arrow">→</span>
                </button>

                {/* Paytm */}
                <button
                  type="button"
                  className="upi-app-button paytm-app"
                  onClick={() =>
                    handleLaunchApp(
                      'Paytm',
                      `paytmmp://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Subscription')}`,
                      'PAYTM'
                    )
                  }
                >
                  <div className="app-icon-wrap">
                    <span className="app-logo-badge paytm-logo">Paytm</span>
                  </div>
                  <div className="app-btn-text">
                    <strong>Pay with Paytm UPI</strong>
                    <span>Direct merchant settlement</span>
                  </div>
                  <span className="app-arrow">→</span>
                </button>

                {/* Any UPI / BHIM */}
                <button
                  type="button"
                  className="upi-app-button bhim-app"
                  onClick={() =>
                    handleLaunchApp(
                      'Default UPI App',
                      `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Subscription')}`,
                      'BHIM_UPI'
                    )
                  }
                >
                  <div className="app-icon-wrap">
                    <span className="app-logo-badge bhim-logo">UPI</span>
                  </div>
                  <div className="app-btn-text">
                    <strong>Any Other UPI / BHIM App</strong>
                    <span>Supports CRED, Navi, Amazon Pay, Axis, ICICI</span>
                  </div>
                  <span className="app-arrow">→</span>
                </button>
              </div>

              {appLaunchNotice && (
                <div className="launch-toast fade-in">
                  <span>✓ {appLaunchNotice}</span>
                </div>
              )}

              {/* Payee Verification Box */}
              <div className="payee-box">
                <div className="payee-row">
                  <span className="payee-label">Verified Payee:</span>
                  <span className="payee-val">{payeeName}</span>
                </div>
                <div className="payee-row">
                  <span className="payee-label">Merchant UPI ID:</span>
                  <code className="upi-code">{upiId}</code>
                  <button type="button" className="copy-btn" onClick={handleCopyUpi}>
                    {copiedUpi ? '✓ Copied' : 'Copy UPI'}
                  </button>
                </div>
                <p className="payee-help-text">
                  Note: UPI intent button availability varies across devices. If your browser does not open the app directly, copy the UPI ID above or scan the QR code from your mobile app.
                </p>
              </div>
            </div>

            {/* Step 4: Submit Transaction Reference (UTR) for Admin Verification */}
            <div className="workflow-card direct-activation-card">
              <div className="card-step-header">
                <span className="step-number">4</span>
                <div>
                  <h3 className="card-title">Submit Transaction Reference (UTR)</h3>
                  <p className="card-subtitle">Submit your UPI payment reference for administrator bank reconciliation</p>
                </div>
              </div>

              <div className="direct-pay-summary">
                <div className="summary-row">
                  <span className="summary-label">Selected Plan:</span>
                  <span className="summary-val">{selectedPlan?.name || 'Merchant Partner Plan'}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Duration & Access:</span>
                  <span className="summary-val">{selectedPlan?.billingDurationDays || 90} Days Access</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Payment Channel:</span>
                  <span className="summary-val method-badge-val">{selectedMethod.replace('_', ' ')}</span>
                </div>
                <div className="summary-row total-row">
                  <span className="summary-label">Payable Amount:</span>
                  <span className="summary-val price-highlight">₹{fee} INR</span>
                </div>
              </div>

              {/* UTR Input Form */}
              <div className="utr-form-group" style={{ marginBottom: '18px' }}>
                <label
                  htmlFor="subscription-utr-input"
                  style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '8px'
                  }}
                >
                  UPI Transaction Reference / UTR Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  id="subscription-utr-input"
                  className="form-control"
                  placeholder="e.g. 423456789012 (12-digit UTR)"
                  value={paymentUtrInput}
                  onChange={(e) => setPaymentUtrInput(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '1rem',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff'
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                  Enter the 12-digit UTR / Transaction ID generated by your UPI app (Google Pay, PhonePe, Paytm, or BHIM) after completing the transfer.
                </span>
              </div>

              {/* Verification & Reconciliation Policy Notice */}
              <div className="direct-approval-guarantee" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}>
                <span className="guarantee-icon">🛡️</span>
                <div>
                  <strong style={{ color: '#0f172a' }}>Reconciliation & Verification Policy:</strong>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                    Payments are initially recorded as <strong>PENDING VERIFICATION</strong>. Authorized platform administrators will verify the bank transaction before your subscription is activated. Duplicate references and unauthorized modifications are strictly prevented.
                  </p>
                </div>
              </div>

              {/* Submit Payment Reference Button */}
              <button
                type="button"
                className="btn btn-primary btn-block direct-pay-btn"
                onClick={() => handleSubmitPayment()}
                disabled={submitting}
                id="submit-subscription-utr-btn"
              >
                {submitting ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Submitting Reference to Admin...</span>
                  </>
                ) : (
                  <span>Submit Payment Reference for Verification →</span>
                )}
              </button>

              {/* Separate Shop Application Status Banner */}
              <div
                className="shop-app-notice-card"
                style={{
                  marginTop: '18px',
                  padding: '14px',
                  borderRadius: '8px',
                  background: appData.application?.status === 'APPROVED' ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${appData.application?.status === 'APPROVED' ? '#bbf7d0' : '#bfdbfe'}`,
                  fontSize: '0.84rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '800', color: appData.application?.status === 'APPROVED' ? '#166534' : '#1e40af' }}>
                    🏬 Physical Shop Status: Live & Active
                  </span>
                </div>
                <p style={{ margin: 0, color: '#334155', lineHeight: '1.45' }}>
                  Your store is active on EXACTSPARE. As soon as your subscription payment is verified, your products and store location will be active in public search.
                </p>
              </div>

              {overallStatus === 'ACTIVE' && (
                <div className="direct-active-quicklinks" style={{ marginTop: '16px' }}>
                  <Link to="/owner/inventory" className="btn btn-outline" id="active-go-inventory">
                    📦 Manage Spare Parts Inventory
                  </Link>
                  <Link to="/owner/dashboard" className="btn btn-outline" id="active-go-dashboard">
                    📊 Owner Dashboard
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Owner Payment History Table */}
        <div className="payment-history-card">
          <div className="history-header">
            <div>
              <h3 className="history-title">My Payment & Subscription History</h3>
              <p className="history-subtitle">
                Authoritative record of all subscription payment attempts and administrator verifications for your account.
              </p>
            </div>
            <span className="history-count-badge">{history.length} Record(s)</span>
          </div>

          {history.length === 0 ? (
            <div className="history-empty-state">
              <span className="empty-icon">🧾</span>
              <h4>No Payment Records Found</h4>
              <p>You have not submitted any subscription payments yet. Select a plan above to initiate your first merchant subscription.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Internal Ref</th>
                    <th>Plan & Duration</th>
                    <th>Amount</th>
                    <th>Payment Channel</th>
                    <th>UPI Reference (UTR)</th>
                    <th>Status</th>
                    <th>Admin Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record._id}>
                      <td>
                        <div className="date-cell">
                          <strong>{new Date(record.createdAt).toLocaleDateString()}</strong>
                          <span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td>
                        <code className="ref-code">{record.internalRef}</code>
                      </td>
                      <td>
                        <div className="plan-cell">
                          <strong>{record.planName}</strong>
                          <span>{record.billingDurationDays} Days</span>
                        </div>
                      </td>
                      <td>
                        <strong className="amount-cell">₹{record.amount}</strong>
                      </td>
                      <td>
                        <span className="method-pill">{record.paymentMethod || 'UPI'}</span>
                      </td>
                      <td>
                        <code className="utr-code">{record.paymentUtr || '—'}</code>
                      </td>
                      <td>
                        {renderStatusBadge(record.status)}
                      </td>
                      <td>
                        {record.status === 'ACTIVE' ? (
                          <div className="verified-cell">
                            <span className="check">✓ Reconciled</span>
                            <span className="date">{record.verifiedAt ? new Date(record.verifiedAt).toLocaleDateString() : 'Verified'}</span>
                          </div>
                        ) : record.status === 'PAYMENT_FAILED' ? (
                          <div className="rejected-cell" title={record.rejectionReason}>
                            <span className="fail">✕ Rejected</span>
                            <span className="reason">{record.rejectionReason || 'Unverified'}</span>
                          </div>
                        ) : (
                          <span className="pending-cell">⏳ Awaiting Bank Match</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerPaymentMethodPage;
