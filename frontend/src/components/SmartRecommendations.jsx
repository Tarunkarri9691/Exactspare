import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecommendations } from '../services/api';
import { useCart } from '../context/CartContext';
import { useCompare } from '../context/CompareContext';
import './SmartRecommendations.css';

const SmartRecommendations = ({
  productId = null,
  category = '',
  vehicleType = '',
  make = '',
  model = '',
  title = 'Smart Recommendations & Compatible Alternatives',
  subtitle = 'Verified inventory suggestions matching your vehicle requirements from active local dealers.'
}) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartAlert, setCartAlert] = useState('');
  const { addToCart } = useCart();
  const { addToCompare, isInCompare, openCompareModal } = useCompare();

  useEffect(() => {
    const loadRecs = async () => {
      setLoading(true);
      const res = await fetchRecommendations({
        productId,
        category,
        vehicleType,
        make,
        model,
        limit: 4
      });

      if (res.success) {
        setRecommendations(res.recommendations);
      }
      setLoading(false);
    };

    loadRecs();
  }, [productId, category, vehicleType, make, model]);

  const handleAddToCart = async (product) => {
    const res = await addToCart(product._id, 1);
    if (res.success) {
      setCartAlert(`Added "${product.partName}" to cart!`);
      setTimeout(() => setCartAlert(''), 3000);
    } else {
      setCartAlert(res.error || 'Could not add to cart');
      setTimeout(() => setCartAlert(''), 3000);
    }
  };

  const handleCompareClick = (product) => {
    const res = addToCompare(product);
    if (res.success) {
      openCompareModal();
    } else {
      setCartAlert(res.message);
      setTimeout(() => setCartAlert(''), 3000);
    }
  };

  if (!loading && recommendations.length === 0) {
    return null; // Don't render empty section
  }

  return (
    <section className="smart-recommendations-section">
      <div className="recommendations-header">
        <div>
          <div className="recommendations-badge">
            <span>✨</span> SMART DISCOVERY
          </div>
          <h2 className="recommendations-title">{title}</h2>
          <p className="recommendations-subtitle">{subtitle}</p>
        </div>
      </div>

      {cartAlert && (
        <div className="recommendations-alert">
          {cartAlert}
        </div>
      )}

      {loading ? (
        <div className="recommendations-loading">
          <span className="spinner">⌛</span> Finding verified compatible parts...
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map((part) => {
            const inCompare = isInCompare(part._id);
            return (
              <div key={part._id} className="rec-card">
                {/* Reason Tag */}
                <div className="rec-reason-badge">
                  {part.recommendationReason || 'Verified Alternative'}
                </div>

                {/* Part Image */}
                <div className="rec-image-box">
                  <Link to={`/parts/${part._id}`}>
                    {part.image ? (
                      <img
                        src={`http://localhost:5000${part.image}`}
                        alt={part.partName}
                        className="rec-img"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="rec-no-img">⚙️</div>
                    )}
                  </Link>
                </div>

                {/* Content */}
                <div className="rec-content">
                  <div className="rec-meta-row">
                    <span className="rec-brand">{part.manufacturer}</span>
                    <span className="rec-stock-status">
                      {part.stockQuantity > 0 ? (
                        <span className="in-stock-txt">● In Stock ({part.stockQuantity})</span>
                      ) : (
                        <span className="out-stock-txt">● Out of Stock</span>
                      )}
                    </span>
                  </div>

                  <h3 className="rec-name">
                    <Link to={`/parts/${part._id}`} title={part.partName}>
                      {part.partName}
                    </Link>
                  </h3>

                  <div className="rec-compatibility-preview">
                    {part.vehicleType && <span className="vtype-pill">{part.vehicleType}</span>}
                    {part.compatibleModels?.length > 0 && (
                      <span className="compat-models-txt">
                        Fits: {part.compatibleModels.slice(0, 2).join(', ')}
                        {part.compatibleModels.length > 2 && ' +more'}
                      </span>
                    )}
                  </div>

                  <div className="rec-shop-row">
                    <span className="shop-name">🏬 {part.shopName}</span>
                    <span className="shop-city">📍 {part.shopCity}</span>
                  </div>

                  <div className="rec-price-row">
                    <div className="price-box">
                      <span className="currency-symbol">₹</span>
                      <span className="price-val">{part.price?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="rec-rating">
                      {part.averageRating > 0 ? (
                        <span>⭐ {part.averageRating.toFixed(1)} ({part.totalReviews})</span>
                      ) : (
                        <span className="unrated-txt">No reviews yet</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="rec-actions">
                    <button
                      className="btn btn-sm btn-primary rec-cart-btn"
                      onClick={() => handleAddToCart(part)}
                      disabled={part.stockQuantity <= 0}
                    >
                      🛒 Add to Cart
                    </button>

                    <button
                      className={`btn btn-sm ${inCompare ? 'btn-active-compare' : 'btn-outline'} rec-compare-btn`}
                      onClick={() => handleCompareClick(part)}
                      title="Compare specifications"
                    >
                      {inCompare ? '✓ Compared' : '⚖️ Compare'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SmartRecommendations;
