import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyApprovedShop,
  updateMyApprovedShop,
  uploadShopImagesApi,
  deleteShopImageApi,
  getImageUrl
} from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import './OwnerShopPage.css';

const CATEGORIES = [
  { value: 'MULTI_CATEGORY', label: 'All Vehicles / Multi-Category Spares' },
  { value: 'BIKE', label: 'Motorcycles & Sports Bikes' },
  { value: 'CAR', label: 'Cars & 4-Wheelers' },
  { value: 'SCOOTER', label: 'Scooters & E-Scooters' },
  { value: 'BICYCLE', label: 'Bicycles & Geared Cycles' },
  { value: 'OTHER', label: 'Commercial & Other Vehicles' }
];

const OwnerShopPage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [hasShop, setHasShop] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'MULTI_CATEGORY',
    phone: '',
    email: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    openingHours: '',
    latitude: 28.6139,
    longitude: 77.2090
  });

  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageIdx, setDeletingImageIdx] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [geoNotice, setGeoNotice] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  const loadShopData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const res = await fetchMyApprovedShop();
      if (res.success && res.data) {
        setHasShop(res.data.hasShop);
        setIsApproved(res.data.isApproved);
        setApplicationStatus(res.data.applicationStatus || res.data.application?.status || 'APPROVED');
        setStatusMessage(res.data.message || '');

        if (res.data.shop) {
          const s = res.data.shop;
          setShop(s);
          const rawLat = s.address?.location?.coordinates?.[1] ?? s.latitude ?? 28.6139;
          const rawLng = s.address?.location?.coordinates?.[0] ?? s.longitude ?? 77.2090;

          setFormData({
            name: s.name || s.shopName || '',
            description: s.description || '',
            category: s.category || 'MULTI_CATEGORY',
            phone: s.contact?.phone || s.phone || '',
            email: s.contact?.email || s.email || '',
            addressLine: s.address?.addressLine || s.addressLine || '',
            city: s.address?.city || s.city || '',
            state: s.address?.state || s.state || '',
            postalCode: s.address?.postalCode || s.postalCode || '',
            openingHours: s.openingHours || '',
            latitude: Number(rawLat) || 28.6139,
            longitude: Number(rawLng) || 77.2090
          });
        } else if (user) {
          setFormData((prev) => ({
            ...prev,
            name: user.name ? `${user.name}'s Auto Spares` : 'Auto Spares Shop',
            email: user.email || '',
            phone: user.phone || ''
          }));
        }
      } else {
        setErrorMessage(res.error || 'Failed to load shop details.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while communicating with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShopData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = ({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude
    }));
    setGeoNotice(`Coordinates pinned: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    setTimeout(() => setGeoNotice(''), 3500);
  };

  // Browser Geolocation
  const handleDetectBrowserLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setDetectingLocation(true);
    setErrorMessage('');
    setGeoNotice('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData((prev) => ({
          ...prev,
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6))
        }));
        setDetectingLocation(false);
        setGeoNotice(`GPS location captured: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`);
        setTimeout(() => setGeoNotice(''), 4500);
      },
      (err) => {
        setDetectingLocation(false);
        setErrorMessage(
          err.code === 1
            ? 'Location permission was denied. You can manually adjust the map pin or enter coordinates.'
            : 'Unable to retrieve location coordinates. Please pin location manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveShopDetails = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessNotice('');

    if (!formData.name.trim() || !formData.description.trim() || !formData.phone.trim() || !formData.city.trim()) {
      setErrorMessage('Please fill in all mandatory shop information fields.');
      return;
    }

    try {
      setSaving(true);
      const res = await updateMyApprovedShop(formData);
      if (res.success) {
        setSuccessNotice('Shop details, address, and coordinates updated successfully.');
        setIsEditing(false);
        loadShopData();
        setTimeout(() => setSuccessNotice(''), 4500);
      } else {
        setErrorMessage(res.error || 'Failed to update shop details.');
      }
    } catch {
      setErrorMessage('An error occurred while saving changes.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if ((shop?.images?.length || 0) + files.length > 5) {
      setErrorMessage('A shop can have a maximum of 5 storefront photographs.');
      return;
    }

    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        setErrorMessage('All uploaded files must be valid images (JPG, PNG, WebP).');
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setErrorMessage('Each image file must be smaller than 5 MB.');
        return;
      }
    }

    try {
      setUploadingImages(true);
      setErrorMessage('');
      const data = new FormData();
      files.forEach((file) => {
        data.append('shopImages', file);
      });

      const res = await uploadShopImagesApi(data);
      if (res.success) {
        setSuccessNotice('New storefront photograph(s) uploaded successfully.');
        loadShopData();
        setTimeout(() => setSuccessNotice(''), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to upload photographs.');
      }
    } catch {
      setErrorMessage('Error uploading storefront photographs.');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (imgPath, idx) => {
    if (!window.confirm('Are you sure you want to remove this storefront photograph?')) {
      return;
    }

    try {
      setDeletingImageIdx(idx);
      setErrorMessage('');
      const res = await deleteShopImageApi(imgPath);
      if (res.success) {
        setSuccessNotice('Photograph removed successfully.');
        loadShopData();
        setTimeout(() => setSuccessNotice(''), 3500);
      } else {
        setErrorMessage(res.error || 'Failed to delete photograph.');
      }
    } catch {
      setErrorMessage('Error deleting photograph.');
    } finally {
      setDeletingImageIdx(null);
    }
  };

  const handleInitializeShop = async () => {
    try {
      setSaving(true);
      setErrorMessage('');
      const payload = {
        name: formData.name || (user?.name ? `${user.name}'s Auto Spares` : 'Auto Spares Shop'),
        description: formData.description || 'Automotive genuine spare parts retail shop.',
        category: formData.category || 'MULTI_CATEGORY',
        phone: formData.phone || user?.phone || '9999999999',
        email: formData.email || user?.email || 'shop@exactspare.com',
        addressLine: formData.addressLine || 'Main Road',
        city: formData.city || 'Hyderabad',
        state: formData.state || 'Telangana',
        postalCode: formData.postalCode || '500001',
        latitude: formData.latitude || 17.3850,
        longitude: formData.longitude || 78.4867,
        openingHours: formData.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM'
      };
      const res = await updateMyApprovedShop(payload);
      if (res.success) {
        setSuccessNotice('Shop profile initialized successfully!');
        loadShopData();
      } else {
        setErrorMessage(res.error || 'Failed to initialize shop profile.');
      }
    } catch {
      setErrorMessage('Error connecting to server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="owner-shop-page-root">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Shop Information...</h3>
        </div>
      </div>
    );
  }

  // If unapproved or no shop
  if (!hasShop || !isApproved) {
    return (
      <div className="owner-shop-page-root">
        <div className="container unapproved-shop-notice-container">
          <div className="app-status-card warning-card fade-in">
            <div className="status-large-icon warning-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2>Shop Profile Not Available</h2>
            <p>{statusMessage || 'Your shop registration is currently being verified.'}</p>
            <div className="status-explanation-box">
              <span className="badge badge-orange">Application Status: {applicationStatus || 'NONE'}</span>
              <p>Once your merchant application is verified and approved by administration, your shop profile, geolocation controls, and inventory features will activate here.</p>
            </div>
            <div className="status-action-btns">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleInitializeShop}
                disabled={saving}
              >
                {saving ? 'Activating Shop...' : 'Set Up & Activate Shop Profile Now →'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={loadShopData}
              >
                Reload Shop Details ↻
              </button>
              <Link to="/owner/dashboard" className="btn btn-outline">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-shop-page-root">
      <div className="container owner-shop-container">
        {/* Header */}
        <div className="shop-header">
          <div>
            <div className="shop-badges-row">
              <span className="badge badge-green">✓ VERIFIED RETAILER</span>
              <span className="badge badge-navy">
                {CATEGORIES.find(c => c.value === shop?.category)?.label || shop?.category}
              </span>
              {shop?.isActive ? (
                <span className="badge badge-green">● LIVE ON MARKETPLACE</span>
              ) : (
                <span className="badge badge-danger">TEMPORARILY SUSPENDED</span>
              )}
            </div>
            <h1 className="shop-title">{shop?.name}</h1>
            <p className="shop-subtitle">
              Manage your verified automotive retail shop details, public operating schedule, verified map coordinates, and storefront photographs.
            </p>
          </div>

          <div className="shop-header-actions">
            <Link to="/owner/location" className="btn btn-outline" id="manage-location-btn">
              📍 Shop Location
            </Link>
            <Link to="/owner/inventory" className="btn btn-outline" id="manage-inventory-btn">
              📦 Manage Inventory
            </Link>
            <Link to={`/shops/${shop?._id}`} className="btn btn-outline-navy" target="_blank" rel="noreferrer" id="preview-public-shop-btn">
              👁️ Preview Public Storefront ↗
            </Link>
            {!isEditing && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsEditing(true)}
                id="edit-shop-btn"
              >
                ✎ Edit Shop Details
              </button>
            )}
          </div>
        </div>

        {/* Global Feedback Banners */}
        {successNotice && (
          <div className="auth-alert success-alert fade-in">
            <span>✓ {successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-alert error-alert fade-in">
            <span>⚠ {errorMessage}</span>
          </div>
        )}

        {/* Storefront Photos Showcase & Management */}
        <div className="shop-photos-section form-card-section">
          <div className="photos-header">
            <div>
              <h3>Storefront & Facility Photographs ({shop?.images?.length || 0}/5)</h3>
              <p>Upload genuine storefront photos showing your commercial signage board, parts shelves, and service counter.</p>
            </div>
            {(shop?.images?.length || 0) < 5 && (
              <label className="btn btn-outline btn-upload-photo" id="upload-storefront-photo-btn">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="file-input-hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingImages}
                />
                {uploadingImages ? 'Uploading...' : '+ Upload Photos'}
              </label>
            )}
          </div>

          <div className="shop-gallery-grid">
            {shop?.images && shop.images.length > 0 ? (
              shop.images.map((img, idx) => (
                <div key={idx} className="shop-photo-card">
                  <img
                    src={getImageUrl(img)}
                    alt={`${shop.name} photo ${idx + 1}`}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="photo-card-overlay">
                    <button
                      type="button"
                      className="btn-delete-photo"
                      onClick={() => handleDeletePhoto(img, idx)}
                      disabled={deletingImageIdx === idx}
                      title="Remove photograph"
                    >
                      {deletingImageIdx === idx ? '...' : '✕ Remove'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-photos-box">
                <p>No storefront photos uploaded yet. Upload genuine photographs to build customer trust and improve marketplace visibility.</p>
              </div>
            )}
          </div>
        </div>

        {/* Shop Details View or Edit Form */}
        {isEditing ? (
          <form className="edit-shop-form form-card-section fade-in" onSubmit={handleSaveShopDetails}>
            <div className="section-head">
              <h3>Edit Shop Information & Location</h3>
              <p>Update permitted shop information, operating schedule, and pinpoint store location on the map.</p>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="shopNameInput">Shop Name *</label>
                <input
                  id="shopNameInput"
                  name="name"
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopCategoryInput">Specialization Category *</label>
                <select
                  id="shopCategoryInput"
                  name="category"
                  className="form-input form-select"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shopDescInput">Shop Description *</label>
              <textarea
                id="shopDescInput"
                name="description"
                rows="4"
                className="form-input form-textarea"
                value={formData.description}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="shopPhoneInput">Public Contact Phone *</label>
                <input
                  id="shopPhoneInput"
                  name="phone"
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopEmailInput">Public Business Email *</label>
                <input
                  id="shopEmailInput"
                  name="email"
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shopAddressLineInput">Address Line / Premise *</label>
              <input
                id="shopAddressLineInput"
                name="addressLine"
                type="text"
                className="form-input"
                value={formData.addressLine}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="shopCityInput">City *</label>
                <input
                  id="shopCityInput"
                  name="city"
                  type="text"
                  className="form-input"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopStateInput">State *</label>
                <input
                  id="shopStateInput"
                  name="state"
                  type="text"
                  className="form-input"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopPostalCodeInput">PIN Code *</label>
                <input
                  id="shopPostalCodeInput"
                  name="postalCode"
                  type="text"
                  className="form-input"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shopHoursInput">Opening Days & Hours *</label>
              <input
                id="shopHoursInput"
                name="openingHours"
                type="text"
                className="form-input"
                placeholder="e.g. Mon-Sat: 09:00 AM - 08:30 PM (Sun Closed)"
                value={formData.openingHours}
                onChange={handleInputChange}
                required
              />
            </div>

            {/* Interactive Geolocation Map */}
            <div className="shop-location-picker-wrap" style={{ marginTop: '20px' }}>
              <div className="picker-head-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--color-navy-primary)' }}>Store Geolocation Pin (Interactive Map)</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    Drag the orange marker or click the map to accurately place your storefront pin for nearby customer search.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleDetectBrowserLocation}
                  disabled={detectingLocation}
                  id="use-browser-gps-btn"
                >
                  {detectingLocation ? '📍 Detecting GPS...' : '📍 Use Browser Location'}
                </button>
              </div>

              {geoNotice && (
                <div className="geo-success-banner fade-in" style={{ marginBottom: '10px' }}>
                  <span>✓ {geoNotice}</span>
                </div>
              )}

              <LocationPickerMap
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={handleLocationChange}
                height="320px"
              />

              <div className="coordinates-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label htmlFor="editLat">Latitude (Decimal)</label>
                  <input
                    type="number"
                    id="editLat"
                    name="latitude"
                    step="0.000001"
                    className="form-input"
                    value={formData.latitude}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editLng">Longitude (Decimal)</label>
                  <input
                    type="number"
                    id="editLng"
                    name="longitude"
                    step="0.000001"
                    className="form-input"
                    value={formData.longitude}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className="edit-form-actions" style={{ marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => setIsEditing(false)}
                id="cancel-edit-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                id="save-shop-btn"
              >
                {saving ? 'Saving Changes...' : '💾 Save Shop Information'}
              </button>
            </div>
          </form>
        ) : (
          <div className="shop-details-display form-card-section fade-in">
            <div className="section-head">
              <h3>Shop Details & Verified Location</h3>
            </div>

            <div className="details-info-grid">
              <div className="detail-item">
                <span className="detail-label">Store Description</span>
                <p className="detail-text">{shop?.description}</p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Store Contact Details</span>
                <p className="detail-text">
                  Phone: <strong>{shop?.contact?.phone || shop?.phone}</strong>
                  <br />
                  Email: <strong>{shop?.contact?.email || shop?.email}</strong>
                </p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Physical Address</span>
                <p className="detail-text">
                  {shop?.address?.addressLine || shop?.addressLine}
                  <br />
                  {shop?.address?.city || shop?.city}, {shop?.address?.state || shop?.state} - {shop?.address?.postalCode || shop?.postalCode}
                </p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Operating Schedule</span>
                <p className="detail-text">{shop?.openingHours || 'Not configured'}</p>
              </div>

              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="detail-label">Verified Coordinates</span>
                <p className="detail-text">
                  Latitude: <strong>{shop?.address?.location?.coordinates?.[1] ?? shop?.latitude ?? 'Not set'}° N</strong>, 
                  Longitude: <strong>{shop?.address?.location?.coordinates?.[0] ?? shop?.longitude ?? 'Not set'}° E</strong>
                </p>
                <div style={{ marginTop: '12px' }}>
                  <LocationPickerMap
                    latitude={Number(shop?.address?.location?.coordinates?.[1] ?? shop?.latitude ?? 28.6139)}
                    longitude={Number(shop?.address?.location?.coordinates?.[0] ?? shop?.longitude ?? 77.2090)}
                    readOnly={true}
                    height="240px"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerShopPage;
