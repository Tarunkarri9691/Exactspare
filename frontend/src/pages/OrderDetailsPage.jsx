import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchOrderDetails, cancelCustomerOrder, getImageUrl } from '../services/api';
import './OrderDetailsPage.css';

const TIMELINE_STEPS = [
  { key: 'PLACED', label: 'Order Placed', icon: 'check' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: 'thumb' },
  { key: 'PROCESSING', label: 'Processing', icon: 'package' },
  { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', icon: 'truck' },
  { key: 'SHIPPED', label: 'Shipped', icon: 'shipping' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'home' }
];

const OrderDetailsPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrderDetails(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError(res.error || 'Failed to retrieve order details.');
      }
    } catch {
      setError('An error occurred while loading this order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelError(null);
    setIsCancelling(true);

    try {
      const res = await cancelCustomerOrder(orderId, cancelReason);
      if (res.success && res.data) {
        setOrder(res.data);
        setCancelModalOpen(false);
        setActionSuccess('Order cancelled successfully. Any reserved stock has been released.');
      } else {
        setCancelError(res.error || 'Failed to cancel order.');
      }
    } catch {
      setCancelError('Network error while requesting cancellation.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="order-details-container">
        <div className="container">
          <div className="details-loading-state">
            <div className="details-spinner"></div>
            <p>Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-details-container">
        <div className="container">
          <div className="details-error-card">
            <h2>Order Not Found</h2>
            <p>{error || 'The requested order does not exist or you do not have permission to view it.'}</p>
            <Link to="/orders" className="btn btn-primary">
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const shipping = order.shippingAddress || {};
  const isCancelled = order.orderStatus === 'CANCELLED';
  const canCancel = ['PLACED', 'CONFIRMED'].includes(order.orderStatus) && !isCancelled;

  // Determine active step index in timeline
  const statusOrder = ['PLACED', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED'];
  const currentStepIndex = statusOrder.indexOf(order.orderStatus);

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="order-details-container">
      <div className="container">
        {/* Breadcrumb */}
        <div className="details-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/orders">My Orders</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{order.orderNumber}</span>
        </div>

        {/* Top Header Card */}
        <div className="order-title-bar">
          <div className="bar-left">
            <h1 className="order-main-heading">Order {order.orderNumber}</h1>
            <p className="order-placed-on">Placed on {orderDate}</p>
          </div>

          <div className="bar-right">
            <span className={`status-badge-lg badge-${order.orderStatus.toLowerCase()}`}>
              {order.orderStatus.replace('_', ' ')}
            </span>
            <Link to={`/orders/${order._id}/track`} className="btn btn-outline-navy btn-sm">
              📍 Track Milestones
            </Link>
            <Link
              to={`/support?orderId=${order._id}&category=Order&subject=${encodeURIComponent(`Inquiry for Order #${order.orderNumber}`)}`}
              className="btn btn-outline-navy btn-sm"
            >
              💬 Get Support
            </Link>
            {canCancel && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setCancelModalOpen(true)}
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* Success / Alert notification */}
        {actionSuccess && (
          <div className="alert-banner alert-banner-success">
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Order Status Timeline Visualization */}
        <div className="status-timeline-card">
          <h2 className="timeline-title">Fulfillment Progress</h2>

          {isCancelled ? (
            <div className="cancelled-timeline-notice">
              <div className="cancel-icon">✕</div>
              <div>
                <strong>Order Cancelled</strong>
                <p>
                  This order was cancelled on{' '}
                  {order.cancellation?.cancelledAt
                    ? new Date(order.cancellation.cancelledAt).toLocaleString('en-IN')
                    : 'record'}{' '}
                  • Reason: {order.cancellation?.reason || 'Customer request'}
                </p>
              </div>
            </div>
          ) : (
            <div className="timeline-steps-track">
              {TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={step.key}
                    className={`timeline-step-node ${isCompleted ? 'step-completed' : ''} ${
                      isCurrent ? 'step-current' : ''
                    }`}
                  >
                    <div className="node-marker">
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className="node-label">{step.label}</span>
                    {idx < TIMELINE_STEPS.length - 1 && <div className="node-connector"></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2-Column Content Layout */}
        <div className="details-content-grid">
          {/* Left Column: Items Breakdown */}
          <div className="details-left-col">
            <div className="details-section-card">
              <h2 className="section-card-title">Ordered Spare Parts ({order.items?.length})</h2>

              <div className="details-items-table">
                {order.items?.map((item, idx) => (
                  <div key={item._id || idx} className="details-item-row">
                    <div className="item-thumb-box">
                      {item.imagePath ? (
                        <img
                          src={getImageUrl(item.imagePath)}
                          alt={item.partName}
                          className="item-thumb"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                          }}
                        />
                      ) : (
                        <div className="thumb-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="item-meta-col">
                      <h3 className="item-title">{item.partName}</h3>
                      <div className="item-specs-line">
                        <span className="spec-badge">Part #{item?.partNumber}</span>
                        {item?.manufacturer && <span className="spec-badge">{item.manufacturer}</span>}
                        {item?.vehicleType && <span className="spec-badge">{item.vehicleType}</span>}
                      </div>
                      <div className="item-shop-info">
                        Fulfilled by: <strong>{item.shopName}</strong>
                      </div>
                    </div>

                    <div className="item-calc-col">
                      <span className="unit-calc">
                        {item.quantity} × ₹{item.unitPrice?.toLocaleString('en-IN')}
                      </span>
                      <span className="item-total">₹{item.subtotal?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Totals */}
              <div className="order-totals-breakdown">
                <div className="breakdown-row">
                  <span>Items Subtotal</span>
                  <span>₹{order.subtotal?.toLocaleString('en-IN')}</span>
                </div>
                <div className="breakdown-row">
                  <span>Delivery Charges</span>
                  <span className="free-tag">Free / Confirmed with Shop</span>
                </div>
                <div className="breakdown-row total-row">
                  <span>Grand Total</span>
                  <span className="total-val">₹{order.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Shop fulfillment grouping (if multiple shops) */}
            {order.shops && order.shops.length > 0 && (
              <div className="details-section-card">
                <h2 className="section-card-title">Shop Fulfillment Breakdown</h2>
                <div className="shops-fulfillment-list">
                  {order.shops.map((s, index) => (
                    <div key={s.shopId || index} className="shop-suborder-card">
                      <div className="suborder-header">
                        <span className="suborder-shop-name">{s.shopName}</span>
                        <span className={`status-pill status-${s.fulfillmentStatus.toLowerCase()}`}>
                          {s.fulfillmentStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="suborder-subtotal">
                        Items Subtotal from this shop: <strong>₹{s.itemsSubtotal?.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Delivery & Payment Details */}
          <div className="details-right-col">
            {/* Delivery Card */}
            <div className="details-section-card">
              <h2 className="section-card-title">Shipping Address</h2>
              <div className="address-display-box">
                <p className="addr-recipient">{shipping.fullName}</p>
                <p className="addr-phone">Phone: {shipping.phone}</p>
                <p className="addr-line">{shipping.addressLine}</p>
                <p className="addr-city">
                  {shipping.city}, {shipping.state} - {shipping.postalCode}
                </p>
                {shipping.instructions && (
                  <div className="addr-instructions">
                    <strong>Note:</strong> {shipping.instructions}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="details-section-card">
              <h2 className="section-card-title">Payment Information</h2>
              <div className="info-kv-list">
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

            {/* Actions */}
            <div className="details-side-actions">
              <Link to="/orders" className="btn btn-outline-navy full-btn">
                ← Back to My Orders
              </Link>
              <Link to="/parts" className="btn btn-primary full-btn">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* Cancellation Modal Dialog */}
        {cancelModalOpen && (
          <div className="modal-overlay">
            <div className="modal-dialog-box">
              <div className="modal-header">
                <h3>Cancel Order {order.orderNumber}?</h3>
              </div>
              <form onSubmit={handleCancelSubmit}>
                <div className="modal-body">
                  <p>
                    Are you sure you want to cancel this order? Cancelling will notify the shop and release any reserved inventory back into stock.
                  </p>

                  {cancelError && (
                    <div className="alert-banner alert-banner-danger modal-alert">
                      <span>{cancelError}</span>
                    </div>
                  )}

                  <div className="form-group modal-form-group">
                    <label htmlFor="cancelReason" className="form-label">
                      Reason for Cancellation (Optional)
                    </label>
                    <textarea
                      id="cancelReason"
                      rows="2"
                      className="form-input"
                      placeholder="e.g. Purchased locally, ordered wrong part number"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline-navy"
                    onClick={() => setCancelModalOpen(false)}
                    disabled={isCancelling}
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={isCancelling}
                  >
                    {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsPage;
