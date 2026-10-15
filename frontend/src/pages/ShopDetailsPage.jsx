import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicShopById, fetchPublicParts } from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import './ShopDetailsPage.css';

const ShopDetailsPage = () => {
  const { id } = useParams();
  const [shop, setShop] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Parts filter within shop
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState('ALL');

  useEffect(() => {
    const loadShopAndParts = async () => {
      try {
        setLoading(true);
        setError('');

        const [shopRes, partsRes] = await Promise.all([
          fetchPublicShopById(id),
          fetchPublicParts({ shopId: id, limit: 20 })
        ]);

        if (shopRes.success && shopRes.data?.shop) {
          setShop(shopRes.data.shop);
        } else {
          setError(shopRes.error || 'Shop details not found or shop is suspended.');
        }

        if (partsRes.success && partsRes.data?.parts) {
          setParts(partsRes.data.parts);
        }
      } catch {
        setError('Error loading shop catalog.');
      } finally {
        setLoading(false);
      }
    };

    loadShopAndParts();
  }, [id]);

  if (loading) {
    return (
      <div className="shop-details-page-root">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Store Details...</h3>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="shop-details-page-root">
        <div className="container app-status-loading">
          <div className="auth-alert error-alert">
            <span>{error || 'Store profile not found.'}</span>
          </div>
          <Link to="/shops" className="btn btn-primary" style={{ marginTop: '20px' }}>
            ← Back to All Retail Shops
          </Link>
        </div>
      </div>
    );
  }

  const coordinates = shop.address?.location?.coordinates || [73.8567, 18.5204]; // [lng, lat]
  const shopLng = coordinates[0];
  const shopLat = coordinates[1];

  // Client-side filtered parts
  const filteredParts = parts.filter((part) => {
    const matchSearch = searchQuery.trim() === '' ||
      part.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchVehicle = selectedVehicleType === 'ALL' || part.vehicleType === selectedVehicleType;
    return matchSearch && matchVehicle;
  });

  return (
    <div className="shop-details-page-root">
      <div className="container shop-details-container">
        {/* Navigation Breadcrumb */}
        <div className="details-breadcrumb">
          <Link to="/shops">← Back to Verified Retailers</Link>
        </div>

        {/* Hero Storefront Banner */}
        <div className="shop-hero-card">
          <div className="shop-hero-content">
            <div className="hero-badges-row">
              <span className="badge badge-green">VERIFIED RETAILER</span>
              <span className="badge badge-navy">{shop.category}</span>
              <span className="badge badge-orange">{shop.availableProductsCount || parts.length} Listed Parts</span>
            </div>

            <h1 className="hero-shop-title">{shop.name}</h1>
            <p className="hero-shop-desc">{shop.description}</p>

            <div className="hero-meta-grid">
              <div className="hero-meta-item">
                <span className="meta-label">Location</span>
                <span className="meta-val">
                  {shop.address?.addressLine}, {shop.address?.city}, {shop.address?.state} - {shop.address?.postalCode}
                </span>
              </div>

              <div className="hero-meta-item">
                <span className="meta-label">Store Contact</span>
                <span className="meta-val">{shop.contact?.phone}</span>
              </div>

              <div className="hero-meta-item">
                <span className="meta-label">Operating Schedule</span>
                <span className="meta-val">{shop.openingHours || 'Mon-Sat 9AM-8PM'}</span>
              </div>
            </div>
          </div>

          {/* Storefront Photo Preview */}
          <div className="shop-hero-photo-wrap">
            {shop.images && shop.images.length > 0 ? (
              <img src={shop.images[0]} alt={shop.name} className="hero-main-photo" />
            ) : (
              <div className="hero-no-photo">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Storefront Image Pending</span>
              </div>
            )}
          </div>
        </div>

        {/* Map Location Section */}
        <div className="shop-location-section">
          <h3 className="section-title">Physical Store Location</h3>
          <p className="section-subtitle">
            Visit this verified retailer directly or use the coordinates below for navigation.
          </p>
          <div className="shop-map-card">
            <LocationPickerMap
              latitude={shopLat}
              longitude={shopLng}
              readOnly={true}
              height="280px"
            />
          </div>
        </div>

        {/* Store Catalog Section */}
        <div className="shop-catalog-section">
          <div className="catalog-header-row">
            <div>
              <h2 className="section-title">Available Spare Parts in this Store</h2>
              <p className="section-subtitle">
                Browse genuine components, replacement kits, and accessories currently stocked by {shop.name}.
              </p>
            </div>

            {/* In-Shop Filters */}
            <div className="catalog-filters-bar">
              <div className="catalog-search-wrap">
                <input
                  type="text"
                  placeholder="Search parts in this shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                value={selectedVehicleType}
                onChange={(e) => setSelectedVehicleType(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Vehicles</option>
                <option value="Car">Car</option>
                <option value="Bike">Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {filteredParts.length === 0 ? (
            <div className="catalog-empty-box">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <h4>No Parts Found</h4>
              <p>No spare parts matched your filter criteria in this store.</p>
            </div>
          ) : (
            <div className="parts-cards-grid">
              {filteredParts.map((part) => {
                const partThumb = part.imagePaths && part.imagePaths.length > 0
                  ? part.imagePaths[0]
                  : null;
                const isOutOfStock = part.stockQuantity <= 0;

                return (
                  <div key={part._id} className="public-part-card fade-in">
                    <div className="part-card-img-wrap">
                      {partThumb ? (
                        <img src={partThumb} alt={part.partName} />
                      ) : (
                        <div className="no-part-img">
                          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        </div>
                      )}
                      <span className="part-veh-tag">{part.vehicleType}</span>
                    </div>

                    <div className="part-card-content">
                      <div className="part-mfg-row">
                        <span className="mfg-name">{part.manufacturer}</span>
                        <code className="sku-tag">{part.partNumber}</code>
                      </div>

                      <h4 className="part-title" title={part.partName}>{part.partName}</h4>

                      <div className="part-price-row">
                        <span className="part-price">₹{Number(part.price).toLocaleString('en-IN')}</span>
                        {isOutOfStock ? (
                          <span className="badge badge-danger">OUT OF STOCK</span>
                        ) : (
                          <span className="badge badge-green">IN STOCK</span>
                        )}
                      </div>

                      <div className="part-card-action">
                        <Link to={`/parts/${part._id}`} className="btn btn-outline btn-block">
                          View Part Specifications
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopDetailsPage;
