import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './SearchResultCard.css';

const SearchResultCard = ({ part, userLocation }) => {
  if (!part) return null;

  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(`/login?redirect=/parts/${part._id}`);
      return;
    }
    if (user.role !== 'CUSTOMER') {
      alert('Only customer accounts can add items to cart.');
      return;
    }
    setAdding(true);
    const res = await addItem(part._id, 1);
    setAdding(false);
    if (res.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    }
  };

  const partThumb = Array.isArray(part.imagePaths) && part.imagePaths.length > 0
    ? part.imagePaths[0]
    : null;

  const isOutOfStock = part.stockQuantity <= 0 || part.availabilityStatus === 'OUT_OF_STOCK';
  const distanceKm = part.distanceKm !== null && part.distanceKm !== undefined ? part.distanceKm : null;

  const shopName = part.shop?.name || 'Verified Retailer';
  const shopCity = part.shop?.address?.city || '';
  const shopState = part.shop?.address?.state || '';
  const shopLocationText = [shopCity, shopState].filter(Boolean).join(', ');

  // External directions URL
  const shopCoords = part.shop?.address?.location?.coordinates;
  const hasCoords = Array.isArray(shopCoords) && shopCoords.length === 2;
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${shopCoords[1]},${shopCoords[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shopName} ${shopCity}`)}`;

  // Compatibility badges
  const makesList = Array.isArray(part.compatibleMakes) ? part.compatibleMakes : [];
  const modelsList = Array.isArray(part.compatibleModels) ? part.compatibleModels : [];
  const yearsList = Array.isArray(part.compatibleYears) ? part.compatibleYears : [];

  return (
    <div className="search-result-card fade-in">
      {/* Product Image Wrap */}
      <div className="card-thumb-wrap">
        {partThumb ? (
          <img src={partThumb} alt={part.partName} className="card-thumb-img" loading="lazy" />
        ) : (
          <div className="card-no-thumb">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Photo Pending</span>
          </div>
        )}

        <div className="card-overlay-tags">
          <span className="badge-veh-type">{part.vehicleType}</span>
          {distanceKm !== null && (
            <span className="badge-distance" title="Straight-line distance (road travel distance may vary)">
              📍 {distanceKm} km
            </span>
          )}
        </div>
      </div>

      {/* Main Card Content */}
      <div className="card-body">
        {/* Manufacturer & SKU Row */}
        <div className="card-mfg-row">
          <span className="card-mfg-name">{part.manufacturer || 'OEM / Genuine'}</span>
          {part.partNumber && (
            <code className="card-sku-code" title={`Part Number: ${part.partNumber}`}>
              {part.partNumber}
            </code>
          )}
        </div>

        {/* Part Title */}
        <h3 className="card-part-title" title={part.partName}>
          <Link to={`/parts/${part._id}`}>{part.partName}</Link>
        </h3>

        {/* Category & Condition */}
        <div className="card-cat-row">
          <span className="card-cat-tag">{part.category}</span>
          <span className="card-cond-tag">{part.condition || 'NEW'}</span>
        </div>

        {/* Compatibility Snippet */}
        {(makesList.length > 0 || modelsList.length > 0) && (
          <div className="card-compatibility-box">
            <span className="compat-label">Fits:</span>
            <div className="compat-tags-wrap">
              {makesList.slice(0, 2).map((make) => (
                <span key={make} className="compat-tag make">{make}</span>
              ))}
              {modelsList.slice(0, 2).map((model) => (
                <span key={model} className="compat-tag model">{model}</span>
              ))}
              {yearsList.length > 0 && (
                <span className="compat-tag year">{yearsList.join(', ')}</span>
              )}
              {(makesList.length > 2 || modelsList.length > 2) && (
                <span className="compat-more">+more</span>
              )}
            </div>
          </div>
        )}

        {/* Pricing & Stock Status */}
        <div className="card-pricing-row">
          <div className="price-box">
            <span className="price-currency">₹</span>
            <span className="price-amount">{Number(part.price).toLocaleString('en-IN')}</span>
          </div>

          <div className="stock-box">
            {isOutOfStock ? (
              <span className="badge badge-danger">OUT OF STOCK</span>
            ) : (
              <span className="badge badge-green" title={`${part.stockQuantity} units currently stocked`}>
                IN STOCK ({part.stockQuantity})
              </span>
            )}
          </div>
        </div>

        {/* Shop Info Footer */}
        <div className="card-shop-footer">
          <div className="shop-info-wrap">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <div className="shop-text-col">
              <Link to={`/shops/${part.shop?._id}`} className="shop-name-link" title={shopName}>
                {shopName}
              </Link>
              {shopLocationText && (
                <span className="shop-loc-subtext">{shopLocationText}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card-actions-row">
            <Link to={`/parts/${part._id}`} className="btn btn-outline btn-details">
              View Details
            </Link>
            {!isOutOfStock && (
              <button
                type="button"
                className={`btn btn-quick-cart ${added ? 'btn-success' : 'btn-orange-subtle'}`}
                onClick={handleQuickAdd}
                disabled={adding}
                title="Add 1 unit to shopping cart"
              >
                {adding ? (
                  '...'
                ) : added ? (
                  '✔ In Cart'
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <span>+ Cart</span>
                  </>
                )}
              </button>
            )}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-directions"
              title="Open directions in external map"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
              <span>Map</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
