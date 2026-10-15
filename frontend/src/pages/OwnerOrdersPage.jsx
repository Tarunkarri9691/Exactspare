import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchOwnerOrders, updateOwnerOrderStatus } from '../services/api';
import './OwnerOrdersPage.css';

const OWNER_STATUS_FILTERS = [
  { label: 'All Orders', value: '' },
  { label: 'Placed', value: 'PLACED' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready for Dispatch', value: 'READY_FOR_DISPATCH' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' }
];

const NEXT_STATUS_ACTIONS = {
  PLACED: [
    { target: 'CONFIRMED', label: 'Confirm Order', btnClass: 'btn-success' },
    { target: 'CANCELLED', label: 'Reject / Cancel', btnClass: 'btn-outline-danger' }
  ],
  CONFIRMED: [
    { target: 'PROCESSING', label: 'Start Packing (Processing)', btnClass: 'btn-primary' },
    { target: 'CANCELLED', label: 'Cancel Order', btnClass: 'btn-outline-danger' }
  ],
  PROCESSING: [
    { target: 'READY_FOR_DISPATCH', label: 'Ready for Courier Pickup', btnClass: 'btn-primary' }
  ],
  READY_FOR_DISPATCH: [
    { target: 'SHIPPED', label: 'Mark as Dispatched (Shipped)', btnClass: 'btn-success' }
  ],
  SHIPPED: [
    { target: 'DELIVERED', label: 'Mark as Delivered', btnClass: 'btn-success' }
  ],
  DELIVERED: [],
  CANCELLED: []
};

const OwnerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Status update modal / action state
  const [statusModal, setStatusModal] = useState({
    open: false,
    orderId: null,
    orderNumber: null,
    targetStatus: null,
    note: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchOwnerOrders(params);
      if (res.success && res.data) {
        setOrders(res.data.orders || []);
        setPagination({
          page: res.data.page || 1,
          pages: res.data.pages || 1,
          total: res.data.total || 0
        });
      } else {
        setError(res.error || 'Failed to retrieve shop orders');
      }
    } catch {
      setError('An error occurred while loading shop orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders(1);
  }, [loadOrders]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders(1);
  };

  const openStatusDialog = (order, targetStatus) => {
    setUpdateError(null);
    setStatusModal({
      open: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      targetStatus,
      note: ''
    });
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const res = await updateOwnerOrderStatus(
        statusModal.orderId,
        statusModal.targetStatus,
        statusModal.note
      );

      if (res.success) {
        setActionSuccess(`Order ${statusModal.orderNumber} successfully updated to ${statusModal.targetStatus.replace('_', ' ')}.`);
        setStatusModal({ open: false, orderId: null, orderNumber: null, targetStatus: null, note: '' });
        await loadOrders(pagination.page);
      } else {
        setUpdateError(res.error || 'Failed to update order status');
      }
    } catch {
      setUpdateError('Network error while updating status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="owner-orders-container">
      <div className="container">
        {/* Breadcrumb */}
        <div className="owner-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/owner/dashboard">Owner Dashboard</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Customer Orders</span>
        </div>

        {/* Header */}
        <div className="owner-header-row">
          <div>
            <h1 className="owner-page-title">Shop Orders & Fulfillment</h1>
            <p className="owner-page-subtitle">
              Manage incoming customer orders, confirm stock readiness, and progress dispatch states.
            </p>
          </div>
          <Link to="/owner/inventory" className="btn btn-outline-navy">
            Manage Inventory
          </Link>
        </div>

        {/* Success alert */}
        {actionSuccess && (
          <div className="alert-banner alert-banner-success">
            <span>{actionSuccess}</span>
            <button
              type="button"
              className="alert-dismiss-btn"
              onClick={() => setActionSuccess(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="owner-filter-card">
          <form onSubmit={handleSearchSubmit} className="owner-search-form">
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search orders by order number (e.g. EXS-20261015)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input-field"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary search-btn">
              Search Orders
            </button>
          </form>

          {/* Status filter pills */}
          <div className="status-filter-pills">
            {OWNER_STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-banner-danger">
            <span>{error}</span>
          </div>
        )}

        {/* Orders Content */}
        {loading ? (
          <div className="owner-loading-state">
            <div className="owner-spinner"></div>
            <p>Loading shop orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="owner-empty-card">
            <div className="empty-box-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h2>No Shop Orders Found</h2>
            <p>
              {searchQuery || statusFilter
                ? 'No orders match your filter criteria.'
                : 'Your shop has not received any customer orders yet.'}
            </p>
          </div>
        ) : (
          <div className="owner-orders-list">
            {orders.map((order) => {
              const currentStatus = order.shopFulfillment?.fulfillmentStatus || order.orderStatus;
              const nextActions = NEXT_STATUS_ACTIONS[currentStatus] || [];
              const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              const shipping = order.shippingAddress || {};

              return (
                <div key={order._id} className="owner-order-card">
                  {/* Top Bar */}
                  <div className="card-top-bar">
                    <div className="top-left">
                      <span className="order-num-badge">{order.orderNumber}</span>
                      <span className="order-time">{orderDate}</span>
                    </div>

                    <div className="top-right">
                      <span className="shop-name-indicator">
                        Shop: {order.shopFulfillment?.shopName || 'Your Shop'}
                      </span>
                      <span className={`status-pill status-${currentStatus.toLowerCase()}`}>
                        {currentStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="card-body-content">
                    {/* Left: Ordered Items from this shop */}
                    <div className="owner-items-table-col">
                      <h3 className="section-mini-heading">
                        Your Shop Items ({order.items?.length})
                      </h3>
                      <div className="owner-items-rows">
                        {order.items?.map((item, idx) => (
                          <div key={item._id || idx} className="owner-item-line">
                            <div className="item-name-specs">
                              <span className="name">{item.partName}</span>
                              <span className="spec">Part #{item.partNumber}</span>
                            </div>
                            <div className="item-calc">
                              <span>
                                {item.quantity} × ₹{item.unitPrice?.toLocaleString('en-IN')}
                              </span>
                              <span className="line-total">₹{item.subtotal?.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="owner-subtotal-bar">
                        <span>Items Total for Your Shop:</span>
                        <span className="subtotal-amount">
                          ₹{order.ownerItemsSubtotal?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Right: Delivery Address & Payment */}
                    <div className="owner-delivery-info-col">
                      <h3 className="section-mini-heading">Delivery Information</h3>
                      <div className="recipient-info-box">
                        <p className="r-name">{shipping.fullName}</p>
                        <p className="r-phone">Phone: {shipping.phone}</p>
                        <p className="r-address">{shipping.addressLine}</p>
                        <p className="r-city">
                          {shipping.city}, {shipping.state} - {shipping.postalCode}
                        </p>
                        {shipping.instructions && (
                          <div className="r-instructions">
                            <strong>Note:</strong> {shipping.instructions}
                          </div>
                        )}
                      </div>

                      <div className="order-pay-method-badge">
                        <span>Payment: <strong>{order.paymentMethod}</strong></span>
                        <span className={`payment-pill payment-${order.paymentStatus.toLowerCase()}`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer: Status Progression Buttons */}
                  <div className="card-actions-footer">
                    <div className="footer-left-status">
                      Current Fulfillment State:{' '}
                      <strong>{currentStatus.replace('_', ' ')}</strong>
                    </div>

                    <div className="footer-action-buttons">
                      {nextActions.length > 0 ? (
                        nextActions.map((action) => (
                          <button
                            key={action.target}
                            type="button"
                            className={`btn btn-sm ${action.btnClass}`}
                            onClick={() => openStatusDialog(order, action.target)}
                          >
                            {action.label}
                          </button>
                        ))
                      ) : (
                        <span className="no-actions-text">
                          {currentStatus === 'DELIVERED'
                            ? '✔ Order Delivered Successfully'
                            : '✕ Order Cancelled'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="orders-pagination-row">
                <button
                  type="button"
                  className="btn btn-outline-navy btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadOrders(pagination.page - 1)}
                >
                  Previous
                </button>
                <span className="page-indicator">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} orders)
                </span>
                <button
                  type="button"
                  className="btn btn-outline-navy btn-sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadOrders(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status Transition Confirmation Modal */}
        {statusModal.open && (
          <div className="modal-overlay">
            <div className="modal-dialog-box">
              <div className="modal-header">
                <h3>Update Order Status</h3>
                <p className="modal-sub">
                  Order {statusModal.orderNumber} → Transition to{' '}
                  <strong>{statusModal.targetStatus?.replace('_', ' ')}</strong>
                </p>
              </div>

              <form onSubmit={handleStatusSubmit}>
                <div className="modal-body">
                  {updateError && (
                    <div className="alert-banner alert-banner-danger modal-alert">
                      <span>{updateError}</span>
                    </div>
                  )}

                  <div className="form-group modal-form-group">
                    <label htmlFor="statusNote" className="form-label">
                      Fulfillment Note (Optional)
                    </label>
                    <textarea
                      id="statusNote"
                      rows="2"
                      className="form-input"
                      placeholder="e.g. Parts verified against OEM catalog; handed over to courier"
                      value={statusModal.note}
                      onChange={(e) =>
                        setStatusModal((prev) => ({ ...prev, note: e.target.value }))
                      }
                    ></textarea>
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline-navy"
                    onClick={() =>
                      setStatusModal({
                        open: false,
                        orderId: null,
                        orderNumber: null,
                        targetStatus: null,
                        note: ''
                      })
                    }
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : `Confirm → ${statusModal.targetStatus?.replace('_', ' ')}`}
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

export default OwnerOrdersPage;
