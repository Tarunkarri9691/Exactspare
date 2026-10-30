import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPaymentScannerConfig, payAndActivateShop } from '../services/api';
import './AdminPaymentScannerCard.css';

const AdminPaymentScannerCard = ({ applicationId, shopName, onActivated, mode = 'owner' }) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [appLaunchNotice, setAppLaunchNotice] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      const res = await fetchPaymentScannerConfig();
      if (res.success && res.config) {
        setConfig(res.config);
      }
      setLoading(false);
    };
    loadConfig();
  }, []);

  const handleCopyUpi = () => {
    if (config?.upiId) {
      navigator.clipboard.writeText(config.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleLaunchUpiApp = (appName, appScheme) => {
    if (config?.upiId) {
      navigator.clipboard.writeText(config.upiId);
    }
    setAppLaunchNotice(`Opening ${appName}... (Admin UPI ID: ${config?.upiId || 'exactspare.merchant@upi'} copied)`);
    setTimeout(() => setAppLaunchNotice(''), 4500);
    window.location.href = appScheme;
  };

  const handleDirectPayment = async () => {
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await payAndActivateShop({
        applicationId,
        paymentAmount: config?.registrationFee ?? 1,
        paymentMethod: 'DIRECT_PAYMENT'
      });

      if (res.success) {
        setSuccessMsg(res.data?.message || 'Payment confirmed! Store directly approved and access is now active.');
        if (onActivated) {
          onActivated(res.data);
        }
      } else {
        setErrorMsg(res.error || 'Failed to complete direct payment. Please try again.');
      }
    } catch {
      setErrorMsg('Network error while processing direct payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="scanner-card-loading">
        <div className="scanner-spinner"></div>
        <p>Loading Admin Payment Scanner...</p>
      </div>
    );
  }

  const upiId = config?.upiId || 'exactspare.merchant@upi';
  const payeeName = config?.payeeName || 'EXACTSPARE Merchant Services';
  const fee = config?.registrationFee ?? 1;
  const appRef = applicationId ? applicationId.slice(-8).toUpperCase() : 'EXS-APP';
  const qrUri = config?.upiUri || `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent(`Shop Reg Ref ${appRef}`)}`;
  const defaultQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUri)}&margin=10`;
  const qrImageUrl = config?.qrCodeImage || defaultQrUrl;

  return (
    <div className="admin-payment-scanner-card fade-in">
      <div className="scanner-card-header">
        <div className="scanner-header-badge-row">
          <span className="scanner-badge-fast">⚡ Instant Approval</span>
          <span className="scanner-badge-direct">✓ Direct Store Activation</span>
          <span className="scanner-badge-no-wait">Ref: #{appRef}</span>
        </div>
        <h2 className="scanner-card-title">Admin Payment Scanner — Direct Transaction</h2>
        <p className="scanner-card-subtitle">
          Submit your one-time onboarding registration fee of ₹{fee} for <strong>{shopName || 'your store'}</strong>. Payment is directly approved with zero wait time — no UTR submission required.
        </p>
      </div>

      {successMsg ? (
        <div className="scanner-success-box fade-in">
          <div className="success-check-icon">✓</div>
          <h3>Payment Successful — Shop Directly Approved!</h3>
          <p>{successMsg}</p>
          <div className="verification-wait-notice" style={{ margin: '16px 0', padding: '16px', background: 'rgba(22, 101, 52, 0.35)', borderRadius: '10px', border: '1px solid rgba(74, 222, 128, 0.4)', textAlign: 'left' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#86efac', fontSize: '1rem' }}>
              ✓ Store Status: Active & Access Unlocked
            </p>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.5 }}>
              Your store has been directly approved. You can now immediately upload spare parts, configure your shop location on Google Maps, and manage orders.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => navigate('/owner/inventory')}
            >
              📦 Manage Spare Parts Inventory →
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/owner/dashboard')}
            >
              📊 Open Owner Dashboard
            </button>
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => navigate('/owner/shop')}
              style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              🏬 View My Shop
            </button>
          </div>
        </div>
      ) : (
        <div className="scanner-card-body-grid">
          {/* Left: QR Code Scanner Display */}
          <div className="scanner-display-col">
            <div className="scanner-frame">
              <div className="scanner-corner top-left"></div>
              <div className="scanner-corner top-right"></div>
              <div className="scanner-corner bottom-left"></div>
              <div className="scanner-corner bottom-right"></div>
              
              <img
                src={qrImageUrl}
                alt="Admin Payment Scanner UPI QR"
                className="scanner-qr-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }}
              />

              {/* Fallback SVG visual QR box */}
              <div className="scanner-qr-fallback" style={{ display: 'none' }}>
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

            <div className="scanner-amount-tag">
              <span className="amount-label">Registration Amount:</span>
              <span className="amount-value">₹{fee}</span>
            </div>
            <div className="scanner-supported-apps">
              <span>Supports GPay • PhonePe • Paytm • BHIM UPI</span>
            </div>
          </div>

          {/* Right: Payment Instructions & Direct Activation */}
          <div className="scanner-action-col">
            <div className="scanner-instructions">
              <div className="step-item">
                <span className="step-num">1</span>
                <div>
                  <strong>Scan QR Code or Open UPI App Directly</strong>
                  <p>Scan with your phone camera or click your preferred app below to pay the admin directly:</p>
                  
                  <div className="upi-app-button-grid">
                    <button
                      type="button"
                      className="upi-app-btn phonepe-btn"
                      onClick={() => handleLaunchUpiApp('PhonePe', `phonepe://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Shop Registration')}`)}
                      title="Open PhonePe App"
                    >
                      <span className="app-dot dot-phonepe"></span>
                      <span>PhonePe</span>
                    </button>

                    <button
                      type="button"
                      className="upi-app-btn paytm-btn"
                      onClick={() => handleLaunchUpiApp('Paytm', `paytmmp://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Shop Registration')}`)}
                      title="Open Paytm App"
                    >
                      <span className="app-dot dot-paytm"></span>
                      <span>Paytm</span>
                    </button>

                    <button
                      type="button"
                      className="upi-app-btn gpay-btn"
                      onClick={() => handleLaunchUpiApp('Google Pay', `gpay://upi/pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Shop Registration')}`)}
                      title="Open Google Pay"
                    >
                      <span className="app-dot dot-gpay"></span>
                      <span>Google Pay</span>
                    </button>

                    <button
                      type="button"
                      className="upi-app-btn navi-btn"
                      onClick={() => handleLaunchUpiApp('Navi UPI', `navi://upi/pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Shop Registration')}`)}
                      title="Open Navi UPI App"
                    >
                      <span className="app-dot dot-navi"></span>
                      <span>Navi UPI</span>
                    </button>

                    <button
                      type="button"
                      className="upi-app-btn bhim-btn"
                      onClick={() => handleLaunchUpiApp('BHIM / Any UPI App', `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('Shop Registration')}`)}
                      title="Open in BHIM or Default UPI App"
                    >
                      <span className="app-dot dot-bhim"></span>
                      <span>Any UPI / BHIM</span>
                    </button>
                  </div>

                  {appLaunchNotice && (
                    <div className="upi-launch-toast fade-in">
                      <span>✓ {appLaunchNotice}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="step-item">
                <span className="step-num">2</span>
                <div>
                  <strong>Verify Payee Details</strong>
                  <div className="payee-detail-row">
                    <span>Payee: <strong>{payeeName}</strong></span>
                  </div>
                  <div className="payee-upi-row">
                    <code>{upiId}</code>
                    <button type="button" className="copy-btn" onClick={handleCopyUpi}>
                      {copiedUpi ? '✓ Copied' : 'Copy UPI'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <span className="step-num">3</span>
                <div>
                  <strong>Direct Approval & Instant Access</strong>
                  <p>No 12-digit UTR input required. Click below to confirm direct payment and instantly open full owner access.</p>
                </div>
              </div>
            </div>

            {/* Direct Activation Card */}
            <div className="direct-pay-action-box">
              <div className="direct-pay-summary-row">
                <div className="summary-item">
                  <span className="summary-lbl">Store Name</span>
                  <strong className="summary-val">{shopName || 'Retail Store'}</strong>
                </div>
                <div className="summary-item">
                  <span className="summary-lbl">Fee Payable</span>
                  <strong className="summary-val price-val">₹{fee}</strong>
                </div>
                <div className="summary-item">
                  <span className="summary-lbl">Approval Type</span>
                  <span className="summary-tag">⚡ Direct Instant Approval</span>
                </div>
              </div>

              {errorMsg && (
                <div className="scanner-error-text" style={{ marginTop: '10px' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block activate-portal-btn"
                onClick={handleDirectPayment}
                disabled={submitting}
                id="confirm-payment-activate-portal-btn"
                style={{
                  marginTop: '12px',
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  padding: '14px 20px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  boxShadow: '0 6px 20px rgba(234, 88, 12, 0.45)',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Approving & Opening Access...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Pay ₹{fee} & Directly Open Access</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span style={{ color: '#22c55e' }}>✓</span>
                <span>Direct transaction • No UTR required • Instant storefront activation</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentScannerCard;
