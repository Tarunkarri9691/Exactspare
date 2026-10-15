import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import { useCart } from '../context/CartContext';
import { compareProducts } from '../services/api';
import './ComparePage.css';

const ComparePage = () => {
  const { compareItems, removeFromCompare, clearCompare } = useCompare();
  const { addToCart } = useCart();
  const [comparedData, setComparedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cartAlert, setCartAlert] = useState('');

  useEffect(() => {
    if (compareItems.length < 2) {
      setComparedData(null);
      return;
    }

    const loadComparison = async () => {
      setLoading(true);
      const ids = compareItems.map((item) => item._id);
      const res = await compareProducts(ids);
      if (res.success) {
        setComparedData(res);
      }
      setLoading(false);
    };

    loadComparison();
  }, [compareItems.length]);

  const handleAddToCart = async (product) => {
    const res = await addToCart(product._id, 1);
    if (res.success) {
      setCartAlert(`Added "${product.partName}" to cart!`);
      setTimeout(() => setCartAlert(''), 3000);
    } else {
      setCartAlert(res.error || 'Failed to add item to cart');
      setTimeout(() => setCartAlert(''), 3000);
    }
  };

  const productsToDisplay = comparedData?.products || compareItems;
  const metrics = comparedData?.metrics || {};

  return (
    <div className="compare-page">
      <div className="container compare-container">
        {/* Header */}
        <div className="compare-page-header">
          <div>
            <div className="compare-header-badge">
              <span>⚖️</span> SPECIFICATION MATRIX
            </div>
            <h1 className="compare-title">Spare Parts Comparison</h1>
            <p className="compare-subtitle">
              Evaluate specifications, vehicle fitment, real stock availability, and retail pricing side by side.
            </p>
          </div>
          {compareItems.length > 0 && (
            <button className="btn btn-outline" onClick={clearCompare}>
              🗑️ Clear All ({compareItems.length})
            </button>
          )}
        </div>

        {cartAlert && (
          <div className="compare-page-alert">
            {cartAlert}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="compare-page-loading">
            <span className="spinner">⌛</span> Compiling side-by-side specifications...
          </div>
        ) : compareItems.length < 2 ? (
          <div className="compare-empty-card">
            <span className="empty-icon">⚖️</span>
            <h3>Add at least 2 spare parts to compare</h3>
            <p>
              You currently have {compareItems.length} item{compareItems.length === 1 ? '' : 's'} in your comparison tray.
              Browse our inventory or consult the AI Assistant to select parts for comparison.
            </p>
            <div className="empty-actions">
              <Link to="/parts" className="btn btn-primary">
                Browse Spare Parts
              </Link>
            </div>
          </div>
        ) : (
          <div className="compare-table-card">
            <div className="table-responsive">
              <table className="compare-page-table">
                <thead>
                  <tr>
                    <th className="feature-th">Feature / Attribute</th>
                    {productsToDisplay.map((p) => {
                      const isBestPrice = metrics.lowestPricedPartId === p._id;
                      return (
                        <th key={p._id} className="part-col-header">
                          <div className="part-header-wrapper">
                            <button
                              className="part-remove-btn"
                              onClick={() => removeFromCompare(p._id)}
                              title="Remove from comparison"
                            >
                              ✕
                            </button>
                            {isBestPrice && (
                              <span className="lowest-price-tag">🏆 Best Price</span>
                            )}
                            <div className="part-header-img-box">
                              {p.image ? (
                                <img
                                  src={`http://localhost:5000${p.image}`}
                                  alt={p.partName}
                                  className="part-header-img"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="no-img">⚙️</div>
                              )}
                            </div>
                            <h3 className="part-header-title">{p.partName}</h3>
                            <div className="part-header-price">
                              ₹{p.price?.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="row-label">Brand / Manufacturer</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <strong>{p.manufacturer || 'Not provided'}</strong>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Part / OEM Number</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <code>{p.partNumber || 'Not provided'}</code>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Category</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>{p.category || 'General'}</td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Vehicle Type</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <span className="vtype-pill">{p.vehicleType || 'Any'}</span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Compatible Vehicles</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        {p.compatibleModels?.length > 0 ? (
                          <div className="compat-block">
                            <strong>{p.compatibleModels.join(', ')}</strong>
                            {p.compatibleMakes?.length > 0 && (
                              <span className="sub-make">Make: {p.compatibleMakes.join(', ')}</span>
                            )}
                          </div>
                        ) : (
                          <span className="muted-txt">Universal / Consult part number</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Condition</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <span className={`cond-pill cond-${p.condition?.toLowerCase()}`}>
                          {p.condition || 'NEW'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Stock Status</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        {p.stockQuantity > 0 ? (
                          <span className="stock-ok">
                            ● In Stock ({p.stockQuantity} units)
                          </span>
                        ) : (
                          <span className="stock-out">● Out of Stock</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Partner Shop & City</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <div className="shop-info-block">
                          <strong>{p.shopName}</strong>
                          <span>📍 {p.shopCity}</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="row-label">Customer Rating</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        {p.averageRating > 0 ? (
                          <span className="rating-pill">
                            ⭐ {p.averageRating.toFixed(1)} ({p.totalReviews} reviews)
                          </span>
                        ) : (
                          <span className="muted-txt">Not yet reviewed</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr className="action-row">
                    <td className="row-label">Actions</td>
                    {productsToDisplay.map((p) => (
                      <td key={p._id}>
                        <div className="compare-actions-cell">
                          <button
                            className="btn btn-primary btn-sm btn-block"
                            onClick={() => handleAddToCart(p)}
                            disabled={p.stockQuantity <= 0}
                          >
                            🛒 Add to Cart
                          </button>
                          <Link
                            to={`/parts/${p._id}`}
                            className="btn btn-outline btn-sm btn-block"
                          >
                            View Product
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
