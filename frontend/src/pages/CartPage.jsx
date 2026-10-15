import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './CartPage.css';

const CartPage = () => {
  const { cart, loading, updateQty, removeItem, clearAll } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const totalItems = cart?.totalItems || 0;
  const unavailableCount = cart?.unavailableCount || 0;

  const handleQtyChange = async (productId, currentQty, delta, maxStock) => {
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > maxStock) return;

    setUpdatingId(productId);
    setErrorMessage(null);
    const res = await updateQty(productId, newQty);
    setUpdatingId(null);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update quantity');
    }
  };

  const handleRemove = async (productId) => {
    setUpdatingId(productId);
    setErrorMessage(null);
    const res = await removeItem(productId);
    setUpdatingId(null);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to remove item');
    }
  };

  const handleClearCart = async () => {
    setErrorMessage(null);
    const res = await clearAll();
    setConfirmClearOpen(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to clear cart');
    }
  };

  const handleProceedToCheckout = () => {
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };

  return (
    <div className="cart-page-container">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <div className="cart-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/parts">Spare Parts</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Shopping Cart</span>
        </div>

        {/* Page Header */}
        <div className="cart-header-row">
          <div>
            <h1 className="cart-title">Your Shopping Cart</h1>
            <p className="cart-subtitle">
              {totalItems > 0
                ? `You have ${totalItems} item${totalItems > 1 ? 's' : ''} in your cart`
                : 'Your shopping cart is currently empty'}
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm clear-cart-btn"
              onClick={() => setConfirmClearOpen(true)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear Cart
            </button>
          )}
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="alert-banner alert-banner-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unavailable items warning */}
        {unavailableCount > 0 && (
          <div className="alert-banner alert-banner-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>
              {unavailableCount} item(s) in your cart are currently out of stock or have changed in price. Please review before proceeding.
            </span>
          </div>
        )}

        {items.length === 0 ? (
          /* Empty Cart State */
          <div className="cart-empty-card">
            <div className="empty-cart-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
            </div>
            <h2 className="empty-cart-title">Your Cart is Empty</h2>
            <p className="empty-cart-desc">
              Explore thousands of OEM and aftermarket vehicle spare parts from verified shops across India.
            </p>
            <div className="empty-cart-actions">
              <Link to="/parts" className="btn btn-primary">
                Explore Spare Parts
              </Link>
              <Link to="/shops" className="btn btn-outline-navy">
                Find Nearby Shops
              </Link>
            </div>
          </div>
        ) : (
          /* Active Cart Layout */
          <div className="cart-layout-grid">
            {/* Items List Column */}
            <div className="cart-items-column">
              <div className="cart-items-card">
                <div className="cart-table-header">
                  <span className="th-product">Part Details</span>
                  <span className="th-price">Unit Price</span>
                  <span className="th-qty">Quantity</span>
                  <span className="th-subtotal">Subtotal</span>
                  <span className="th-action"></span>
                </div>

                <div className="cart-items-list">
                  {items.map((item) => {
                    const product = item.productId;
                    if (!product) return null;

                    const isOutOfStock = !item.isAvailable || product.stockQuantity === 0;
                    const isExceedingStock = item.quantity > product.stockQuantity;
                    const maxStock = product.stockQuantity || 0;
                    const itemSubtotal = (product.price || 0) * item.quantity;

                    return (
                      <div
                        key={product._id}
                        className={`cart-item-row ${!item.isAvailable ? 'item-unavailable' : ''}`}
                      >
                        {/* Product Info */}
                        <div className="cart-product-info">
                          <div className="cart-item-img-box">
                            {product.imagePath ? (
                              <img
                                src={`http://localhost:5000${product.imagePath}`}
                                alt={product.partName}
                                className="cart-item-thumb"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                }}
                              />
                            ) : (
                              <div className="cart-item-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="cart-item-meta">
                            <Link to={`/parts/${product._id}`} className="cart-item-title">
                              {product.partName}
                            </Link>
                            <div className="cart-item-tags">
                              <span className="meta-tag part-num">Part #{product.partNumber}</span>
                              {product.category && (
                                <span className="meta-tag category-tag">{product.category}</span>
                              )}
                              {product.vehicleType && (
                                <span className="meta-tag vehicle-tag">{product.vehicleType}</span>
                              )}
                            </div>
                            <div className="cart-item-shop">
                              <span className="shop-label">Shop:</span>{' '}
                              <span className="shop-name">{product.shopId?.name || 'Authorized Shop'}</span>
                            </div>

                            {/* Stock warning status */}
                            {isOutOfStock ? (
                              <div className="stock-alert-text out-of-stock">
                                Currently Out of Stock (0 Available)
                              </div>
                            ) : isExceedingStock ? (
                              <div className="stock-alert-text low-stock">
                                Only {maxStock} in stock. Please reduce quantity.
                              </div>
                            ) : maxStock <= 3 ? (
                              <div className="stock-alert-text limited-stock">
                                Only {maxStock} left in stock!
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div className="cart-col-price">
                          <span className="mobile-col-label">Price:</span>
                          <span className="currency-val">₹{product.price?.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="cart-col-qty">
                          <span className="mobile-col-label">Qty:</span>
                          <div className="quantity-control">
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => handleQtyChange(product._id, item.quantity, -1, maxStock)}
                              disabled={item.quantity <= 1 || updatingId === product._id}
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="qty-number">{item.quantity}</span>
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => handleQtyChange(product._id, item.quantity, 1, maxStock)}
                              disabled={item.quantity >= maxStock || updatingId === product._id}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="cart-col-subtotal">
                          <span className="mobile-col-label">Subtotal:</span>
                          <span className="subtotal-val">₹{itemSubtotal.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Remove Action */}
                        <div className="cart-col-remove">
                          <button
                            type="button"
                            className="remove-btn"
                            title="Remove item"
                            onClick={() => handleRemove(product._id)}
                            disabled={updatingId === product._id}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="cart-card-footer">
                  <Link to="/parts" className="btn btn-outline-navy continue-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>

            {/* Order Summary Column */}
            <div className="cart-summary-column">
              <div className="order-summary-card">
                <h2 className="summary-title">Order Summary</h2>

                <div className="summary-details">
                  <div className="summary-row">
                    <span className="summary-label">Items Subtotal ({totalItems})</span>
                    <span className="summary-val">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Delivery Charges</span>
                    <span className="summary-val free-delivery">Free / To Be Confirmed</span>
                  </div>

                  <div className="summary-row total-row">
                    <span className="total-label">Estimated Payable Total</span>
                    <span className="total-val">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="summary-guarantees">
                  <div className="guarantee-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="guarantee-icon">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    <span>100% Genuine OEM / OES Parts</span>
                  </div>
                  <div className="guarantee-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="guarantee-icon">
                      <rect x="1" y="3" width="15" height="13"></rect>
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                      <circle cx="5.5" cy="18.5" r="2.5"></circle>
                      <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                    <span>Direct Shop Pickup or Local Dispatch</span>
                  </div>
                  <div className="guarantee-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="guarantee-icon">
                      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                      <line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                    <span>Cash on Delivery (COD) Available</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary checkout-btn"
                  onClick={handleProceedToCheckout}
                  disabled={items.length === 0 || loading || unavailableCount > 0}
                >
                  Proceed to Checkout
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>

                {unavailableCount > 0 && (
                  <p className="checkout-disabled-note">
                    * Please remove or adjust out-of-stock items to proceed to checkout.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clear Cart Confirmation Modal */}
        {confirmClearOpen && (
          <div className="modal-overlay">
            <div className="modal-dialog-box">
              <div className="modal-header">
                <h3>Clear Shopping Cart?</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to remove all {totalItems} items from your shopping cart? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline-navy"
                  onClick={() => setConfirmClearOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClearCart}
                >
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
