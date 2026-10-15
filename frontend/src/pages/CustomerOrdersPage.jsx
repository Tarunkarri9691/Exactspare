import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrders } from '../services/api';
import './CustomerOrdersPage.css';

const ORDER_STATUS_FILTERS = [
  { label: 'All Orders', value: '' },
  { label: 'Placed', value: 'PLACED' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready for Dispatch', value: 'READY_FOR_DISPATCH' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' }
];

const CustomerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

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

      const res = await fetchMyOrders(params);
      if (res.success && res.data) {
        setOrders(res.data.orders || []);
        setPagination({
          page: res.data.page || 1,
          pages: res.data.pages || 1,
          total: res.data.total || 0
        });
      } else {
        setError(res.error || 'Failed to retrieve your orders');
      }
    } catch {
      setError('An error occurred while loading your orders.');
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

  return (
    <div className="orders-page-container">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <div className="orders-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">My Orders</span>
        </div>

        <div className="orders-header-row">
          <div>
            <h1 className="orders-page-title">My Orders</h1>
            <p className="orders-page-subtitle">
              Track and manage your vehicle spare parts purchases and dispatch status.
            </p>
          </div>
          <Link to="/parts" className="btn btn-outline-navy">
            Browse Spare Parts
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="orders-filter-card">
          <form onSubmit={handleSearchSubmit} className="orders-search-form">
            <div className="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search by order number (e.g. EXS-20261015)..."
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
              Search
            </button>
          </form>

          {/* Status filter pills */}
          <div className="status-filter-pills">
            {ORDER_STATUS_FILTERS.map((f) => (
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
          <div className="orders-loading-state">
            <div className="orders-spinner"></div>
            <p>Retrieving your order history...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty-card">
            <div className="empty-orders-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h2>No Orders Found</h2>
            <p>
              {searchQuery || statusFilter
                ? 'No orders match your search criteria. Try clearing the filter or search text.'
                : "You haven't placed any spare part orders yet."}
            </p>
            <div className="empty-actions">
              {searchQuery || statusFilter ? (
                <button
                  type="button"
                  className="btn btn-outline-navy"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('');
                  }}
                >
                  Reset Filters
                </button>
              ) : (
                <Link to="/parts" className="btn btn-primary">
                  Start Shopping
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
              const itemCount = order.items?.reduce((acc, i) => acc + i.quantity, 0) || 0;

              return (
                <div key={order._id} className="order-history-card">
                  {/* Card Header */}
                  <div className="order-card-header">
                    <div className="header-left">
                      <div className="order-num-group">
                        <span className="order-lbl">Order</span>
                        <span className="order-num-text">{order.orderNumber}</span>
                      </div>
                      <span className="order-date-text">Placed on {orderDate}</span>
                    </div>

                    <div className="header-right">
                      <span className={`status-badge badge-${order.orderStatus.toLowerCase()}`}>
                        {order.orderStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Items Preview */}
                  <div className="order-card-body">
                    <div className="order-items-preview">
                      {order.items?.map((item, idx) => (
                        <div key={item._id || idx} className="order-item-chip">
                          <span className="item-name">{item.partName}</span>
                          <span className="item-qty">×{item.quantity}</span>
                          <span className="item-shop">({item.shopName})</span>
                        </div>
                      ))}
                    </div>

                    <div className="order-card-meta-row">
                      <div className="meta-left">
                        <span className="meta-item">
                          <strong>Items:</strong> {itemCount}
                        </span>
                        <span className="meta-item">
                          <strong>Payment:</strong> {order.paymentMethod} ({order.paymentStatus})
                        </span>
                      </div>

                      <div className="meta-right">
                        <div className="order-total-price">
                          <span className="total-lbl">Total Amount:</span>
                          <span className="total-val">₹{order.totalAmount?.toLocaleString('en-IN')}</span>
                        </div>
                        <Link to={`/orders/${order._id}`} className="btn btn-primary btn-sm view-details-btn">
                          View Order Details
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </Link>
                      </div>
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
      </div>
    </div>
  );
};

export default CustomerOrdersPage;
