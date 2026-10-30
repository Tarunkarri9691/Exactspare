import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import { compareProducts, getImageUrl } from '../services/api';
import './ProductCompareModal.css';

const ProductCompareModal = () => {
  const {
    compareItems,
    compareCount,
    removeFromCompare,
    clearCompare,
    isCompareModalOpen,
    openCompareModal,
    closeCompareModal
  } = useCompare();

  const [comparedData, setComparedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState('');

  // Fetch verified comparison from server when modal opens or items change
  useEffect(() => {
    if (!isCompareModalOpen || compareItems.length < 2) {
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      const ids = compareItems.map((item) => item._id);
      const res = await compareProducts(ids);
      if (res.success) {
        setComparedData(res);
      }
      setLoading(false);
    };

    fetchComparison();
  }, [isCompareModalOpen, compareItems.length]);

  if (compareCount === 0) return null;

  const productsToDisplay = comparedData?.products || compareItems;
  const metrics = comparedData?.metrics || {};

  return (
    <>
      {/* Floating Bottom Comparison Tray */}
      {!isCompareModalOpen && (
        <div className="compare-floating-tray">
          <div className="compare-tray-content">
            <div className="tray-info">
              <span className="tray-icon">⚖️</span>
              <div>
                <strong>{compareCount} Part{compareCount > 1 ? 's' : ''} Selected</strong>
                <p>Compare specifications, compatibility & pricing</p>
              </div>
            </div>

            <div className="tray-items-preview">
              {compareItems.map((item) => (
                <div key={item._id} className="tray-thumb-item" title={item.partName}>
                  <span>{item.partName.substring(0, 14)}...</span>
                  <button
                    className="tray-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromCompare(item._id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="tray-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={openCompareModal}
                disabled={compareCount < 2}
              >
                {compareCount < 2 ? 'Select 1 More to Compare' : `Compare Now (${compareCount})`}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearCompare}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Full Modal */}
      {isCompareModalOpen && (
        <div className="modal-backdrop" onClick={closeCompareModal}>
          <div className="modal-content compare-modal-large" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h3 className="modal-title">⚖️ Vehicle Spare Parts Comparison</h3>
                <span className="modal-subtitle">
                  Comparing {productsToDisplay.length} verified listings from active retail shops
                </span>
              </div>
              <button className="modal-close-btn" onClick={closeCompareModal}>✕</button>
            </div>

            {/* Modal Body */}
            <div className="modal-body compare-modal-body">
              {actionAlert && (
                <div className="compare-alert">
                  {actionAlert}
                </div>
              )}

              {loading ? (
                <div className="compare-loading">
                  <span className="spinner">⌛</span> Compiling verified specifications...
                </div>
              ) : productsToDisplay.length < 2 ? (
                <div className="compare-insufficient-items">
                  <span>⚖️</span>
                  <h4>Add at least 2 parts to compare</h4>
                  <p>Browse our catalog or use the AI Assistant to select parts for comparison.</p>
                </div>
              ) : (
                <div className="compare-table-wrapper">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th className="feature-col">Feature / Specification</th>
                        {productsToDisplay.map((p) => {
                          const isBestPrice = metrics.lowestPricedPartId === p._id;
                          return (
                            <th key={p._id} className="product-col">
                              <div className="product-col-header">
                                <button
                                  className="remove-col-btn"
                                  onClick={() => removeFromCompare(p._id)}
                                  title="Remove from comparison"
                                >
                                  ✕
                                </button>
                                {isBestPrice && (
                                  <span className="best-price-badge">🏆 Lowest Price</span>
                                )}
                                <div className="product-col-img-wrap">
                                  {p.image ? (
                                    <img
                                      src={getImageUrl(p.image)}
                                      alt={p.partName}
                                      className="product-col-img"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="no-img-box">⚙️</div>
                                  )}
                                </div>
                                <h4 className="product-col-name">{p.partName}</h4>
                                <div className="product-col-price">
                                  ₹{p.price?.toLocaleString('en-IN')}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Brand / Manufacturer */}
                      <tr>
                        <td className="feature-label">Brand / Manufacturer</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            <strong>{p.manufacturer || 'Not provided'}</strong>
                          </td>
                        ))}
                      </tr>

                      {/* Part Number */}
                      <tr>
                        <td className="feature-label">Part / OEM Number</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            <code>{p.partNumber || 'Not provided'}</code>
                          </td>
                        ))}
                      </tr>

                      {/* Category */}
                      <tr>
                        <td className="feature-label">Category</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>{p.category || 'General'}</td>
                        ))}
                      </tr>

                      {/* Vehicle Type */}
                      <tr>
                        <td className="feature-label">Vehicle Type</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            <span className="tag-pill">{p.vehicleType || 'Any'}</span>
                          </td>
                        ))}
                      </tr>

                      {/* Compatible Makes & Models */}
                      <tr>
                        <td className="feature-label">Compatible Vehicles</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id} className="compat-cell">
                            {p.compatibleModels?.length > 0 ? (
                              <div>
                                <span className="compat-models-list">
                                  {p.compatibleModels.join(', ')}
                                </span>
                                {p.compatibleMakes?.length > 0 && (
                                  <div className="compat-make-sub">
                                    Make: {p.compatibleMakes.join(', ')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="muted-txt">Universal / Check Part #</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Condition */}
                      <tr>
                        <td className="feature-label">Condition</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            <span className={`condition-tag cond-${p.condition?.toLowerCase()}`}>
                              {p.condition || 'NEW'}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Stock Availability */}
                      <tr>
                        <td className="feature-label">Stock Status</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            {p.stockQuantity > 0 ? (
                              <span className="stock-in-txt">
                                In Stock ({p.stockQuantity} available)
                              </span>
                            ) : (
                              <span className="stock-out-txt">Out of Stock</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Shop Name & City */}
                      <tr>
                        <td className="feature-label">Dealer / Shop</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            <div className="shop-cell-info">
                              <strong>{p.shopName}</strong>
                              <span>📍 {p.shopCity}</span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Customer Ratings */}
                      <tr>
                        <td className="feature-label">Customer Rating</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id}>
                            {p.averageRating > 0 ? (
                              <span className="rating-badge">
                                ⭐ {p.averageRating.toFixed(1)} ({p.totalReviews} reviews)
                              </span>
                            ) : (
                              <span className="muted-txt">No reviews yet</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Purchase Actions */}
                      <tr className="actions-row">
                        <td className="feature-label">Store Availability & Details</td>
                        {productsToDisplay.map((p) => (
                          <td key={p._id} className="action-cell">
                            <div className="compare-cell-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <Link
                                to={`/parts/${p._id}`}
                                className="btn btn-primary btn-sm btn-block"
                                onClick={closeCompareModal}
                                style={{ textDecoration: 'none', textAlign: 'center' }}
                              >
                                View Details
                              </Link>
                              {p.shopId && (
                                <Link
                                  to={`/shops/${p.shopId}`}
                                  className="btn btn-outline btn-sm btn-block"
                                  onClick={closeCompareModal}
                                  style={{ textDecoration: 'none', textAlign: 'center' }}
                                >
                                  View Store
                                </Link>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={clearCompare}>
                Clear All
              </button>
              <button className="btn btn-primary" onClick={closeCompareModal}>
                Done Comparing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCompareModal;
