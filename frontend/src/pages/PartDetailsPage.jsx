import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchPartByIdApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './PartDetailsPage.css';

const PartDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [part, setPart] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [cartFeedback, setCartFeedback] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const loadPart = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetchPartByIdApi(id);
        if (res.success && res.data?.part) {
          const p = res.data.part;
          setPart(p);
          if (p.imagePaths && p.imagePaths.length > 0) {
            setActivePhoto(p.imagePaths[0]);
          }
        } else {
          setError(res.error || 'Spare part not found or listing has been archived.');
        }
      } catch {
        setError('Error loading spare part specifications.');
      } finally {
        setLoading(false);
      }
    };

    loadPart();
  }, [id]);

  const handleAddToCart = async (goToCheckout = false) => {
    if (!user) {
      navigate(`/login?redirect=/parts/${id}`);
      return;
    }
    if (user.role !== 'CUSTOMER') {
      setCartFeedback({ type: 'error', text: 'Please sign in with a Customer account to buy parts.' });
      return;
    }

    setIsAdding(true);
    setCartFeedback(null);
    const res = await addItem(part._id, selectedQty);
    setIsAdding(false);

    if (res.success) {
      if (goToCheckout) {
        navigate('/checkout');
      } else {
        setCartFeedback({ type: 'success', text: `Added ${selectedQty} item(s) to your cart!` });
      }
    } else {
      setCartFeedback({ type: 'error', text: res.error || 'Failed to add item to cart' });
    }
  };

  if (loading) {
    return (
      <div className="part-details-page-root">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Spare Part Specifications...</h3>
        </div>
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="part-details-page-root">
        <div className="container app-status-loading">
          <div className="auth-alert error-alert">
            <span>{error || 'Listing not found.'}</span>
          </div>
          <Link to="/parts" className="btn btn-primary" style={{ marginTop: '20px' }}>
            ← Back to Spare Parts Catalog
          </Link>
        </div>
      </div>
    );
  }

  const isOutOfStock = part.stockQuantity <= 0;
  const shop = part.shopId;

  return (
    <div className="part-details-page-root">
      <div className="container part-details-container">
        {/* Navigation Breadcrumb */}
        <div className="part-details-breadcrumb">
          <Link to="/parts">← Back to Marketplace</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{part.category}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{part.partName}</span>
        </div>

        {/* Product Grid */}
        <div className="part-details-layout">
          {/* Left Column: Image Gallery */}
          <div className="part-gallery-column">
            <div className="main-image-viewport">
              {activePhoto ? (
                <img src={activePhoto} alt={part.partName} className="main-product-img" />
              ) : (
                <div className="main-image-placeholder">
                  <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>No Product Image Uploaded</span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {part.imagePaths && part.imagePaths.length > 1 && (
              <div className="thumbnail-strip">
                {part.imagePaths.map((imgPath, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`thumb-button ${activePhoto === imgPath ? 'thumb-active' : ''}`}
                    onClick={() => setActivePhoto(imgPath)}
                  >
                    <img src={imgPath} alt={`Thumb ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Specifications & Pricing */}
          <div className="part-info-column">
            <div className="part-category-badges">
              <span className="badge badge-navy">{part.vehicleType}</span>
              <span className="badge badge-orange">{part.category}</span>
              <span className="badge badge-navy">{part.condition}</span>
            </div>

            <h1 className="product-page-title">{part.partName}</h1>

            <div className="product-meta-subline">
              <span className="mfg-tag">Brand: <strong>{part.manufacturer}</strong></span>
              <span className="meta-divider">•</span>
              <span className="sku-tag">Part #: <code>{part.partNumber}</code></span>
            </div>

            {/* Price & Stock Card */}
            <div className="pricing-stock-card">
              <div className="price-tag-wrap">
                <span className="inr-label">Price:</span>
                <span className="inr-amount">₹{Number(part.price).toLocaleString('en-IN')}</span>
                <span className="tax-inclusive-tag">Inclusive of all local taxes</span>
              </div>

              <div className="stock-status-wrap">
                {isOutOfStock ? (
                  <div className="stock-alert-badge badge-out">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>CURRENTLY OUT OF STOCK</span>
                  </div>
                ) : (
                  <div className="stock-alert-badge badge-in">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>AVAILABLE IN STOCK ({part.stockQuantity} units available)</span>
                  </div>
                )}
              </div>

              {/* Cart Feedback Message */}
              {cartFeedback && (
                <div className={`cart-feedback-banner ${cartFeedback.type}`}>
                  <span>{cartFeedback.text}</span>
                  {cartFeedback.type === 'success' && (
                    <Link to="/cart" className="view-cart-link">
                      View Cart →
                    </Link>
                  )}
                </div>
              )}

              {/* Add to Cart Actions */}
              {!isOutOfStock && (
                <div className="cart-purchase-actions">
                  <div className="qty-selector-wrap">
                    <label className="qty-label">Quantity:</label>
                    <div className="qty-picker">
                      <button
                        type="button"
                        className="picker-btn"
                        onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                        disabled={selectedQty <= 1}
                      >
                        -
                      </button>
                      <span className="picker-num">{selectedQty}</span>
                      <button
                        type="button"
                        className="picker-btn"
                        onClick={() => setSelectedQty((q) => Math.min(part.stockQuantity, q + 1))}
                        disabled={selectedQty >= part.stockQuantity}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="pdp-cart-buttons">
                    <button
                      type="button"
                      className="btn btn-primary add-to-cart-btn"
                      onClick={() => handleAddToCart(false)}
                      disabled={isAdding}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                      {isAdding ? 'Adding...' : 'Add to Cart'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline-navy buy-now-btn"
                      onClick={() => handleAddToCart(true)}
                      disabled={isAdding}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Compatibility Specs Table */}
            <div className="compatibility-specs-card">
              <h3 className="specs-card-title">Vehicle Compatibility</h3>
              <div className="specs-table">
                <div className="spec-row">
                  <span className="spec-label">Target Vehicle Type</span>
                  <span className="spec-val"><strong>{part.vehicleType}</strong></span>
                </div>

                {part.compatibleMakes && part.compatibleMakes.length > 0 && (
                  <div className="spec-row">
                    <span className="spec-label">Compatible Makes</span>
                    <span className="spec-val">
                      {part.compatibleMakes.map((m, i) => (
                        <span key={i} className="compat-pill">{m}</span>
                      ))}
                    </span>
                  </div>
                )}

                {part.compatibleModels && part.compatibleModels.length > 0 && (
                  <div className="spec-row">
                    <span className="spec-label">Compatible Models</span>
                    <span className="spec-val">
                      {part.compatibleModels.map((m, i) => (
                        <span key={i} className="compat-pill">{m}</span>
                      ))}
                    </span>
                  </div>
                )}

                {part.compatibleYears && part.compatibleYears.length > 0 && (
                  <div className="spec-row">
                    <span className="spec-label">Supported Years</span>
                    <span className="spec-val">{part.compatibleYears.join(', ')}</span>
                  </div>
                )}

                {part.engineDetails && (
                  <div className="spec-row">
                    <span className="spec-label">Engine / Trim Details</span>
                    <span className="spec-val">{part.engineDetails}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="part-desc-card">
              <h3 className="specs-card-title">Product Description & Specs</h3>
              <p className="part-desc-body">{part.description}</p>
            </div>

            {/* Verified Seller Shop Card */}
            {shop && (
              <div className="verified-seller-card">
                <div className="seller-header">
                  <div className="seller-badge-icon">✔</div>
                  <div>
                    <span className="seller-subtitle">Verified Retail Partner</span>
                    <h4 className="seller-name">{shop.name}</h4>
                  </div>
                </div>

                <div className="seller-details-list">
                  <div className="seller-detail-row">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>{shop.address?.city}, {shop.address?.state}</span>
                  </div>

                  <div className="seller-detail-row">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>Store Phone: <strong>{shop.contact?.phone}</strong></span>
                  </div>

                  <div className="seller-detail-row">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Hours: {shop.openingHours || 'Mon-Sat 9AM-8PM'}</span>
                  </div>
                </div>

                <div className="seller-actions">
                  <Link to={`/shops/${shop._id}`} className="btn btn-outline btn-block">
                    Explore All Parts from {shop.name} →
                  </Link>

                  {shop.address?.location?.coordinates && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${shop.address.location.coordinates[1]},${shop.address.location.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-block"
                      style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                      </svg>
                      <span>Get Directions to Store ↗</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartDetailsPage;
