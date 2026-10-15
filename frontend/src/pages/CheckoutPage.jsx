import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { placeOrder } from '../services/api';
import './CheckoutPage.css';

const CheckoutPage = () => {
  const { cart, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    instructions: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const items = cart?.items || [];
  const totalAmount = cart?.subtotal || 0;
  const totalItems = cart?.totalItems || 0;

  // Re-verify cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Autofill if user profile loads
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        phone: prev.phone || user.phone || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[0-9+()\- ]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number (7-20 digits)';
    }

    if (!formData.addressLine.trim()) newErrors.addressLine = 'Street address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    } else if (!/^[0-9]{5,10}$/.test(formData.postalCode.trim())) {
      newErrors.postalCode = 'Please enter a valid postal / PIN code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (items.length === 0) {
      setSubmitError('Your cart is empty. Please add items before checking out.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        shippingAddress: {
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          addressLine: formData.addressLine.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
          instructions: formData.instructions.trim()
        },
        paymentMethod: paymentMethod
      };

      const res = await placeOrder(payload);

      if (res.success && res.data?.order) {
        // Refresh customer's cart state to empty
        await refreshCart();
        // Redirect to order confirmation page
        navigate(`/orders/${res.data.order._id}/confirmation`, {
          state: { order: res.data.order }
        });
      } else {
        setSubmitError(res.error || 'Failed to place order. Please review your details and try again.');
        // Re-sync cart in case stock changed
        await refreshCart();
      }
    } catch {
      setSubmitError('An unexpected network error occurred while processing your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="checkout-page-container">
        <div className="container">
          <div className="empty-checkout-card">
            <h2>Your Shopping Cart is Empty</h2>
            <p>You need items in your cart to proceed with checkout.</p>
            <Link to="/parts" className="btn btn-primary">
              Browse Spare Parts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page-container">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <div className="checkout-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/cart">Cart</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Secure Checkout</span>
        </div>

        <h1 className="checkout-page-title">Secure Order Checkout</h1>
        <p className="checkout-page-subtitle">
          Confirm your delivery address and choose your preferred payment option.
        </p>

        {submitError && (
          <div className="checkout-alert-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div>
              <strong>Order Placement Failed:</strong> {submitError}
            </div>
          </div>
        )}

        <div className="checkout-layout-grid">
          {/* Left Column: Delivery Details & Payment */}
          <div className="checkout-form-column">
            <form onSubmit={handleSubmitOrder} id="checkout-form">
              {/* 1. Delivery Details Section */}
              <div className="checkout-card">
                <div className="checkout-card-header">
                  <div className="step-num">1</div>
                  <div>
                    <h2 className="step-title">Delivery Information</h2>
                    <p className="step-desc">Enter the address where the spare parts should be delivered</p>
                  </div>
                </div>

                <div className="form-fields-grid">
                  <div className="form-group col-span-2">
                    <label htmlFor="fullName" className="form-label required">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      className={`form-input ${errors.fullName ? 'input-error' : ''}`}
                      placeholder="e.g. Arjun Sharma"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                    {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                  </div>

                  <div className="form-group col-span-2">
                    <label htmlFor="phone" className="form-label required">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className={`form-input ${errors.phone ? 'input-error' : ''}`}
                      placeholder="e.g. +91 98765 43210"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                    {errors.phone && <span className="error-text">{errors.phone}</span>}
                  </div>

                  <div className="form-group col-span-2">
                    <label htmlFor="addressLine" className="form-label required">
                      Street Address / Flat / Building
                    </label>
                    <input
                      type="text"
                      id="addressLine"
                      name="addressLine"
                      className={`form-input ${errors.addressLine ? 'input-error' : ''}`}
                      placeholder="e.g. Flat 302, Sai Residency, FC Road"
                      value={formData.addressLine}
                      onChange={handleChange}
                    />
                    {errors.addressLine && <span className="error-text">{errors.addressLine}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="city" className="form-label required">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      className={`form-input ${errors.city ? 'input-error' : ''}`}
                      placeholder="e.g. Pune"
                      value={formData.city}
                      onChange={handleChange}
                    />
                    {errors.city && <span className="error-text">{errors.city}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="state" className="form-label required">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      className={`form-input ${errors.state ? 'input-error' : ''}`}
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={handleChange}
                    />
                    {errors.state && <span className="error-text">{errors.state}</span>}
                  </div>

                  <div className="form-group col-span-2">
                    <label htmlFor="postalCode" className="form-label required">
                      Postal / PIN Code
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      className={`form-input ${errors.postalCode ? 'input-error' : ''}`}
                      placeholder="e.g. 411004"
                      value={formData.postalCode}
                      onChange={handleChange}
                    />
                    {errors.postalCode && <span className="error-text">{errors.postalCode}</span>}
                  </div>

                  <div className="form-group col-span-2">
                    <label htmlFor="instructions" className="form-label">
                      Delivery Instructions (Optional)
                    </label>
                    <textarea
                      id="instructions"
                      name="instructions"
                      rows="2"
                      className="form-input"
                      placeholder="e.g. Landmark near Hanuman Temple, call before dispatching"
                      value={formData.instructions}
                      onChange={handleChange}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* 2. Payment Method Section */}
              <div className="checkout-card payment-method-card">
                <div className="checkout-card-header">
                  <div className="step-num">2</div>
                  <div>
                    <h2 className="step-title">Payment Method</h2>
                    <p className="step-desc">Select how you would like to pay for your order</p>
                  </div>
                </div>

                <div className="payment-options-list">
                  {/* Option 1: Cash on Delivery (Active) */}
                  <label className={`payment-radio-option ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                    />
                    <div className="payment-option-body">
                      <div className="option-header-row">
                        <span className="payment-title">Cash on Delivery (COD)</span>
                        <span className="payment-badge-active">Ready</span>
                      </div>
                      <p className="payment-desc">
                        Pay with cash or UPI directly to the shop / courier partner upon receiving your vehicle parts.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Online Payment (Disabled placeholder) */}
                  <label className="payment-radio-option disabled-option">
                    <input type="radio" name="paymentMethod" value="ONLINE" disabled />
                    <div className="payment-option-body">
                      <div className="option-header-row">
                        <span className="payment-title">Online Payment (UPI, Cards, NetBanking)</span>
                        <span className="payment-badge-soon">Gateway Config Pending</span>
                      </div>
                      <p className="payment-desc">
                        Direct server-verified payment gateway is undergoing configuration. Please use Cash on Delivery.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Order Summary & Place Order Button */}
          <div className="checkout-summary-column">
            <div className="checkout-summary-box">
              <h3 className="summary-box-title">Order Overview ({totalItems} items)</h3>

              {/* Compact item list */}
              <div className="summary-items-list">
                {items.map((item) => {
                  const product = item.productId;
                  if (!product) return null;
                  return (
                    <div key={product._id} className="summary-item-tile">
                      <div className="summary-item-info">
                        <span className="summary-item-name">{product.partName}</span>
                        <span className="summary-item-sub">
                          Shop: {product.shopId?.name || 'Authorized Shop'} • Qty: {item.quantity}
                        </span>
                      </div>
                      <span className="summary-item-price">
                        ₹{((product.price || 0) * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Price Calculations */}
              <div className="checkout-calc-rows">
                <div className="calc-row">
                  <span>Items Subtotal</span>
                  <span className="val">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="calc-row">
                  <span>Delivery Charges</span>
                  <span className="val free-val">Free Dispatch (Confirmed at Shop)</span>
                </div>
                <div className="calc-row total-calc-row">
                  <span>Payable Total</span>
                  <span className="val-total">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Security info */}
              <div className="security-notice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Stock is checked and reserved on server upon submission.</span>
              </div>

              {/* Place Order CTA */}
              <button
                type="submit"
                form="checkout-form"
                className="btn btn-primary place-order-btn"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border-sm"></span>
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order (COD) • ₹{totalAmount.toLocaleString('en-IN')}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </>
                )}
              </button>

              <div className="checkout-terms">
                By placing this order, you agree to EXACTSPARE's terms of service and genuine part guarantee.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
