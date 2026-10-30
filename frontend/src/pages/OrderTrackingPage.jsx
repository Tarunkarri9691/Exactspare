import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchOrderTracking, getImageUrl } from '../services/api';
import './OrderTrackingPage.css';

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTracking = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrderTracking(orderId);
      if (res.success && res.data) {
        setTrackingData(res.data);
      } else {
        setError(res.error || 'Failed to retrieve order tracking information.');
      }
    } catch {
      setError('An unexpected error occurred while loading order tracking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracking();
  }, [orderId]);

  if (loading) {
    return (
      <div className="tracking-page-container">
        <div className="container">
          <div className="tracking-loading-state">
            <div className="tracking-spinner"></div>
            <p>Loading live order-status milestones...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="tracking-page-container">
        <div className="container">
          <div className="tracking-error-card">
            <div className="error-icon">⚠️</div>
            <h2>Unable to Track Order</h2>
            <p>{error || 'The requested order could not be found or you do not have permission to track it.'}</p>
            <div className="error-actions">
              <Link to="/orders" className="btn btn-primary">
                Return to My Orders
              </Link>
              <button type="button" className="btn btn-outline-navy" onClick={loadTracking}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    orderNumber,
    orderStatus,
    createdAt,
    updatedAt,
    isCancelled,
    cancellation,
    trackingDisclaimer,
    timeline = [],
    statusHistory = [],
    shippingAddress = {},
    shops = [],
    items = []
  } = trackingData;

  const orderDateFormatted = new Date(createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const lastUpdateFormatted = new Date(updatedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="tracking-page-container">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <div className="tracking-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/orders">My Orders</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to={`/orders/${orderId}`}>Order Details</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Tracking</span>
        </div>

        {/* Top Header Card */}
        <div className="tracking-header-card">
          <div className="tracking-header-left">
            <div className="tracking-title-wrap">
              <h1 className="tracking-main-title">Track Order #{orderNumber}</h1>
              <span className={`status-pill status-${orderStatus.toLowerCase()}`}>
                {orderStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="tracking-subtitle">
              Placed on {orderDateFormatted} • Last updated {lastUpdateFormatted}
            </p>
          </div>

          <div className="tracking-header-actions">
            <Link to={`/orders/${orderId}`} className="btn btn-outline-navy btn-sm">
              View Order Invoice
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/support?orderId=${orderId}&category=Order&subject=${encodeURIComponent(`Inquiry for Order #${orderNumber}`)}`)}
            >
              💬 Need Help? Contact Support
            </button>
          </div>
        </div>

        {/* Real-world Disclaimer Banner */}
        <div className="tracking-disclaimer-banner">
          <div className="disclaimer-badge">ℹ️ ORDER-STATUS TRACKING</div>
          <p className="disclaimer-text">
            {trackingDisclaimer || 'Milestone-based internal order tracking. Real-time GPS or third-party courier telemetry is not integrated.'}
          </p>
        </div>

        {/* Cancellation Notice if Applicable */}
        {isCancelled && (
          <div className="cancellation-alert-card">
            <div className="cancellation-icon">✕</div>
            <div className="cancellation-content">
              <h3>Order Cancelled</h3>
              <p className="cancel-reason">
                <strong>Reason:</strong> {cancellation?.reason || 'Cancelled upon customer request.'}
              </p>
              {cancellation?.cancelledAt && (
                <p className="cancel-time">
                  Recorded on {new Date(cancellation.cancelledAt).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Timeline Visualization Section */}
        <div className="tracking-card timeline-card">
          <div className="card-header-clean">
            <h2 className="card-heading">Fulfillment Progress Milestones</h2>
            <button type="button" className="refresh-btn" onClick={loadTracking} title="Check for updates">
              🔄 Refresh Status
            </button>
          </div>

          <div className="timeline-horizontal-track">
            {timeline.map((milestone, idx) => {
              const nodeClass = milestone.isCurrent
                ? 'milestone-current'
                : milestone.isCompleted
                ? 'milestone-completed'
                : 'milestone-pending';

              return (
                <div key={milestone.key} className={`milestone-node ${nodeClass}`}>
                  <div className="milestone-indicator">
                    {milestone.isCompleted ? '✓' : idx + 1}
                  </div>
                  <div className="milestone-info">
                    <span className="milestone-title">{milestone.title}</span>
                    <span className="milestone-desc">{milestone.description}</span>
                    {milestone.timestamp ? (
                      <span className="milestone-timestamp">
                        {new Date(milestone.timestamp).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    ) : (
                      <span className="milestone-timestamp pending-text">Pending</span>
                    )}
                  </div>
                  {idx < timeline.length - 1 && <div className="milestone-connector"></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-Column Grid: Shop Fulfillment Breakdown & Shipping Summary */}
        <div className="tracking-grid-two-col">
          {/* Shop Partner Fulfillment Breakdown */}
          <div className="tracking-card">
            <h2 className="card-heading">Partner Shop Fulfillment</h2>
            <p className="card-subhead">
              Spare parts are verified and dispatched by individual registered merchant stores.
            </p>

            <div className="shops-fulfillment-list">
              {shops.map((shop, sIdx) => (
                <div key={shop.shopId || sIdx} className="shop-fulfillment-item">
                  <div className="shop-item-top">
                    <div className="shop-name-block">
                      <span className="shop-icon">🏬</span>
                      <strong>{shop.shopName}</strong>
                    </div>
                    <span className={`status-pill status-${shop.fulfillmentStatus?.toLowerCase()}`}>
                      {shop.fulfillmentStatus?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {Array.isArray(shop.statusHistory) && shop.statusHistory.length > 0 && (
                    <div className="shop-history-snip">
                      <span className="snip-label">Latest store update:</span>{' '}
                      <span className="snip-text">
                        {shop.statusHistory[shop.statusHistory.length - 1]?.customerSafeMessage ||
                          shop.statusHistory[shop.statusHistory.length - 1]?.note ||
                          shop.fulfillmentStatus}
                      </span>
                      {shop.statusHistory[shop.statusHistory.length - 1]?.timestamp && (
                        <span className="snip-time">
                          ({new Date(shop.statusHistory[shop.statusHistory.length - 1].timestamp).toLocaleDateString('en-IN')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Destination Summary */}
          <div className="tracking-card">
            <h2 className="card-heading">Delivery Destination</h2>
            <div className="delivery-destination-content">
              <div className="dest-recipient">
                <strong>{shippingAddress.fullName || 'Recipient'}</strong>
              </div>
              <div className="dest-address">
                <p>{shippingAddress.addressLine}</p>
                <p>
                  {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postalCode}
                </p>
              </div>
              <div className="dest-meta-box">
                <span className="meta-label">Delivery Type:</span>
                <span className="meta-val">Local Store Partner Fulfillment / Standard Dispatch</span>
              </div>
              <div className="dest-meta-box">
                <span className="meta-label">Payment Mode:</span>
                <span className="meta-val">{trackingData.paymentMethod} ({trackingData.paymentStatus})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ordered Parts Included */}
        <div className="tracking-card">
          <h2 className="card-heading">Packages & Spare Parts Included</h2>
          <div className="tracking-items-grid">
            {items.map((item, idx) => (
              <div key={item._id || idx} className="tracking-item-card">
                <div className="item-thumbnail">
                  {item.imagePath ? (
                    <img src={getImageUrl(item.imagePath)} alt={item.partName} />
                  ) : (
                    <div className="item-placeholder">⚙️</div>
                  )}
                </div>
                <div className="item-details">
                  <h4 className="item-name">{item.partName}</h4>
                  <p className="item-partnum">Part #{item.partNumber}</p>
                  <p className="item-shop">Fulfiller: {item.shopName}</p>
                  <div className="item-qty-price">
                    <span>Qty: <strong>{item.quantity}</strong></span>
                    {item.subtotal && <span>₹{item.subtotal.toLocaleString('en-IN')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Status Audit History Log */}
        {statusHistory.length > 0 && (
          <div className="tracking-card">
            <h2 className="card-heading">Status Event Log</h2>
            <p className="card-subhead">
              Auditable chronological event log of status transitions verified on the server.
            </p>

            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Status Event</th>
                    <th>Timestamp</th>
                    <th>Message / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {statusHistory.map((h, hIdx) => (
                    <tr key={hIdx}>
                      <td>
                        <span className={`status-pill status-${h.status?.toLowerCase()}`}>
                          {h.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="time-col">
                        {h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="note-col">
                        {h.customerSafeMessage || 'Status recorded'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
