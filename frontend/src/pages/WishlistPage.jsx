import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import './WishlistPage.css';

const WishlistPage = () => {
  const navigate = useNavigate();
  const { wishlistItems, wishlistCount, loading, removeFromWishlist, moveItemToCart } = useWishlist();
  const { refreshCart } = useCart();

  const [movingId, setMovingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleMoveToCart = async (productId) => {
    setMovingId(productId);
    setFeedback(null);
    const res = await moveItemToCart(productId, 1);
    setMovingId(null);

    if (res.success) {
      setFeedback({ type: 'success', text: 'Item successfully moved to your shopping cart!' });
      if (refreshCart) refreshCart();
      setTimeout(() => setFeedback(null), 3500);
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to move item to cart.' });
    }
  };

  const handleRemove = async (productId) => {
    const res = await removeFromWishlist(productId);
    if (res.success) {
      setFeedback({ type: 'success', text: 'Item removed from wishlist.' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="wishlist-page-root">
      <div className="container wishlist-container">
        {/* Breadcrumb */}
        <div className="wishlist-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">My Wishlist</span>
        </div>

        {/* Header */}
        <div className="wishlist-header">
          <div>
            <h1 className="wishlist-title">
              My Saved Wishlist
              <span className="wishlist-count-tag">{wishlistCount} item{wishlistCount !== 1 ? 's' : ''}</span>
            </h1>
            <p className="wishlist-subtitle">
              Keep track of compatible vehicle spare parts, monitor pricing, and transfer items straight to checkout.
            </p>
          </div>

          {wishlistCount > 0 && (
            <Link to="/cart" className="btn btn-outline-navy">
              View Shopping Cart →
            </Link>
          )}
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`auth-alert ${feedback.type === 'success' ? 'success-alert' : 'error-alert'}`} style={{ marginBottom: '20px' }}>
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Content */}
        {loading && wishlistItems.length === 0 ? (
          <div className="wishlist-loading-state">
            <div className="auth-spinner">
              <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
              </svg>
            </div>
            <h3>Loading your saved parts...</h3>
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="wishlist-empty-card">
            <div className="empty-heart-icon">♥</div>
            <h2>Your Wishlist is Empty</h2>
            <p>
              Explore our marketplace of verified auto parts. Save items you're interested in for quick access anytime!
            </p>
            <div className="empty-actions">
              <Link to="/parts" className="btn btn-primary">
                Browse Spare Parts Catalog
              </Link>
              <Link to="/shops" className="btn btn-outline">
                Find Nearby Partner Shops
              </Link>
            </div>
          </div>
        ) : (
          <div className="wishlist-grid">
            {wishlistItems.map((item) => {
              const part = item.productId;
              if (!part) return null;

              const isOutOfStock = part.stockQuantity <= 0;
              const isUnavailable = !part.isAvailable;
              const imageSrc =
                part.imagePaths && part.imagePaths.length > 0
                  ? `http://localhost:5000${part.imagePaths[0]}`
                  : null;

              return (
                <div key={part._id} className="wishlist-item-card">
                  {/* Product Image */}
                  <div className="wishlist-card-media">
                    {imageSrc ? (
                      <img src={imageSrc} alt={part.partName} className="wishlist-part-img" />
                    ) : (
                      <div className="wishlist-placeholder-img">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <circle cx="8" cy="10" r="2"></circle>
                          <line x1="21" y1="15" x2="16" y2="10"></line>
                          <line x1="11" y1="15" x2="14" y2="12"></line>
                        </svg>
                        <span>No Image</span>
                      </div>
                    )}
                    <span className="wishlist-category-badge">{part.category}</span>
                  </div>

                  {/* Card Content */}
                  <div className="wishlist-card-body">
                    <div className="wishlist-title-row">
                      <Link to={`/parts/${part._id}`} className="wishlist-part-link">
                        <h3 className="wishlist-part-title">{part.partName}</h3>
                      </Link>
                    </div>

                    <div className="wishlist-part-oem">
                      Part #: <strong>{part.partNumber}</strong>
                    </div>

                    {/* Compatibility Tag */}
                    <div className="wishlist-compat-badge">
                      <span className="compat-icon">🚗</span>
                      <span>
                        {part.compatibleBrand} {part.compatibleModel} ({part.vehicleType})
                        {part.compatibleYears && part.compatibleYears.length > 0 && ` [${part.compatibleYears.join(', ')}]`}
                      </span>
                    </div>

                    {/* Seller Shop */}
                    {part.shopId && (
                      <div className="wishlist-seller-info">
                        <span className="seller-label">Store:</span>
                        <span className="seller-name">{part.shopId.name}</span>
                        {part.shopId.address?.city && (
                          <span className="seller-city">• {part.shopId.address.city}</span>
                        )}
                      </div>
                    )}

                    {/* Price and Stock Status */}
                    <div className="wishlist-price-status">
                      <div className="wishlist-price-col">
                        <span className="wishlist-price">{formatPrice(part.price)}</span>
                      </div>
                      <div className="wishlist-stock-col">
                        {isUnavailable ? (
                          <span className="status-badge status-unavailable">Unavailable</span>
                        ) : isOutOfStock ? (
                          <span className="status-badge status-out">Out of Stock</span>
                        ) : (
                          <span className="status-badge status-in">In Stock ({part.stockQuantity})</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="wishlist-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary move-cart-btn"
                        onClick={() => handleMoveToCart(part._id)}
                        disabled={isOutOfStock || isUnavailable || movingId === part._id}
                      >
                        {movingId === part._id ? 'Moving...' : 'Move to Cart'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-danger remove-wishlist-btn"
                        onClick={() => handleRemove(part._id)}
                        title="Remove from wishlist"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
