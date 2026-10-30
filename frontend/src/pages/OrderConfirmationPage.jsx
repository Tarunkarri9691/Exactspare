import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { fetchOrderDetails } from '../services/api';
import './OrderConfirmationPage.css';

const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const location = useLocation();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order && orderId) {
      const loadOrder = async () => {
        setLoading(true);
        const res = await fetchOrderDetails(orderId);
        if (res.success && res.data) {
          setOrder(res.data);
        } else {
          setError(res.error || 'Could not retrieve order details');
        }
        setLoading(false);
      };
      loadOrder();
    }
  }, [orderId, order]);

  if (loading) {
    return (
      <div className="confirmation-page-container">
        <div className="container">
          <div className="confirmation-loading-card">
            <div className="confirmation-spinner"></div>
            <p>Loading your order confirmation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="confirmation-page-container">
        <div className="container">
          <div className="confirmation-error-card">
            <h2>Order Details Unavailable</h2>
            <p>{error || 'The requested order could not be located.'}</p>
            <div className="confirm-actions-row">
              <Link to="/orders" className="btn btn-primary">
                View My Orders
              </Link>
              <Link to="/parts" className="btn btn-outline-navy">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shipping = order.shippingAddress || {};
  const items = order.items || [];
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="confirmation-page-container">
      <div className="container">
        {/* Success Header Banner */}
        <div className="confirmation-success-card">
          <div className="success-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h1 className="confirmation-title">Thank You for Your Order!</h1>
          <p className="confirmation-subtitle">
            Your vehicle spare parts order has been received and sent to the verified shop partners for processing.
          </p>

          <div className="order-number-banner">
            <span className="order-num-label">Order Number:</span>
            <span className="order-num-val">{order.orderNumber}</span>
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="confirmation-details-grid">
          {/* Left Column: Ordered Items */}
          <div className="confirmation-items-column">
            <div className="detail-card">
              <h2 className="detail-card-title">Ordered Spare Parts ({items.length})</h2>

              <div className="confirm-items-table">
                {items.map((item, index) => (
                  <div key={item._id || index} className="confirm-item-row">
                    <div className="confirm-item-main">
                      <h3 className="confirm-item-name">{item.partName}</h3>
                      <div className="confirm-item-subtags">
                        <span className="confirm-tag">Part #{item?.partNumber}</span>
                        {item?.vehicleType && <span className="confirm-tag">{item.vehicleType}</span>}
                        <span className="confirm-shop">Shop: {item?.shopName}</span>
                      </div>
                    </div>

                    <div className="confirm-item-pricing">
                      <span className="confirm-qty-calc">
                        {item.quantity} × ₹{item.unitPrice?.toLocaleString('en-IN')}
                      </span>
                      <span className="confirm-subtotal">₹{item.subtotal?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals */}
              <div className="confirm-totals-box">
                <div className="confirm-tot-row">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal?.toLocaleString('en-IN')}</span>
                </div>
                <div className="confirm-tot-row">
                  <span>Delivery Charges</span>
                  <span className="free-tag">Free (Local / Shop Direct)</span>
                </div>
                <div className="confirm-tot-row grand-total-row">
                  <span>Total Amount</span>
                  <span className="grand-total-val">₹{order.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Status, Delivery & Payment */}
          <div className="confirmation-info-column">
            {/* Status & Payment Card */}
            <div className="detail-card">
              <h2 className="detail-card-title">Order Status & Payment</h2>
              <div className="info-kv-list">
                <div className="info-kv-row">
                  <span className="kv-label">Current Status:</span>
                  <span className={`status-pill status-${order.orderStatus.toLowerCase()}`}>
                    {order.orderStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="info-kv-row">
                  <span className="kv-label">Order Date:</span>
                  <span className="kv-val">{orderDate}</span>
                </div>
                <div className="info-kv-row">
                  <span className="kv-label">Payment Method:</span>
                  <span className="kv-val">
                    {order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : order.paymentMethod}
                  </span>
                </div>
                <div className="info-kv-row">
                  <span className="kv-label">Payment Status:</span>
                  <span className={`payment-pill payment-${order.paymentStatus.toLowerCase()}`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Address Card */}
            <div className="detail-card">
              <h2 className="detail-card-title">Delivery Address</h2>
              <div className="delivery-address-box">
                <p className="address-name">{shipping.fullName}</p>
                <p className="address-phone">Phone: {shipping.phone}</p>
                <p className="address-line">{shipping.addressLine}</p>
                <p className="address-city-state">
                  {shipping.city}, {shipping.state} - {shipping.postalCode}
                </p>
                {shipping.instructions && (
                  <p className="address-instructions">
                    <strong>Instructions:</strong> {shipping.instructions}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="confirmation-action-buttons">
              <Link to="/orders" className="btn btn-primary full-width-btn">
                View My Orders
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link to="/parts" className="btn btn-outline-navy full-width-btn">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
