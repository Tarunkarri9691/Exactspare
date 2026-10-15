import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyApprovedShop,
  updateMyApprovedShop,
  uploadShopImagesApi
} from '../services/api';
import './OwnerShopPage.css';

const CATEGORIES = ['BIKE', 'CAR', 'SCOOTER', 'BICYCLE', 'MULTI_CATEGORY', 'OTHER'];

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
    openingHours: ''
  });

  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const loadShopData = async () => {
    try {
      setLoading(true);
      setErrorState('');

      const res = await fetchMyApprovedShop();
      if (res.success) {
        setHasShop(res.data.hasShop);
        setIsApproved(res.data.isApproved);
        setApplicationStatus(res.data.applicationStatus);
        setStatusMessage(res.data.message || '');

        if (res.data.shop) {
          const s = res.data.shop;
          setShop(s);
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
            openingHours: s.openingHours || ''
          });
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

  const setErrorState = (msg) => {
    setErrorMessage(msg);
  };

  useEffect(() => {
    loadShopData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        setSuccessNotice('Shop information updated successfully.');
        setIsEditing(false);
        loadShopData();
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
      setErrorMessage('A shop can have a maximum of 5 photographs.');
      return;
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
        setSuccessNotice('New storefront photographs uploaded successfully.');
        loadShopData();
      } else {
        setErrorMessage(res.error || 'Failed to upload photographs.');
      }
    } catch {
      setErrorMessage('Error uploading storefront photographs.');
    } finally {
      setUploadingImages(false);
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
            <p>{statusMessage}</p>
            <div className="status-explanation-box">
              <span className="badge badge-orange">Application Status: {applicationStatus || 'NONE'}</span>
              <p>Once your merchant application is verified and approved, your shop profile and storefront controls will activate here.</p>
            </div>
            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-primary">
                Return to Owner Dashboard
              </Link>
              <Link to="/owner/application" className="btn btn-outline">
                Check Application
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
              <span className="badge badge-green">VERIFIED RETAILER</span>
              <span className="badge badge-navy">{shop?.category}</span>
              {shop?.isActive ? (
                <span className="badge badge-green">LIVE ON MARKETPLACE</span>
              ) : (
                <span className="badge badge-danger">TEMPORARILY SUSPENDED</span>
              )}
            </div>
            <h1 className="shop-title">{shop?.name}</h1>
            <p className="shop-subtitle">
              Manage your verified automotive retail shop details, public operating hours, and storefront photos.
            </p>
          </div>

          <div className="shop-header-actions">
            <Link to="/owner/inventory" className="btn btn-outline">
              Manage Inventory
            </Link>
            <Link to={`/shops/${shop?._id}`} className="btn btn-outline-navy" target="_blank" rel="noreferrer">
              Preview Public View ↗
            </Link>
            {!isEditing && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Shop Details
              </button>
            )}
          </div>
        </div>

        {/* Global Feedback Banners */}
        {successNotice && (
          <div className="auth-alert success-alert fade-in" style={{ borderColor: 'var(--color-status-approved)', color: 'var(--color-status-approved)' }}>
            <span>{successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-alert error-alert fade-in">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Storefront Photos Showcase */}
        <div className="shop-photos-section form-card-section">
          <div className="photos-header">
            <div>
              <h3>Storefront & Facility Photographs</h3>
              <p>Showcase your physical storefront and inventory counters to customers.</p>
            </div>
            {(shop?.images?.length || 0) < 5 && (
              <label className="btn btn-outline btn-upload-photo">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="file-input-hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingImages}
                />
                {uploadingImages ? 'Uploading...' : '+ Add Storefront Photos'}
              </label>
            )}
          </div>

          <div className="shop-gallery-grid">
            {shop?.images && shop.images.length > 0 ? (
              shop.images.map((img, idx) => (
                <div key={idx} className="shop-photo-card">
                  <img src={img} alt={`${shop.name} photo ${idx + 1}`} />
                </div>
              ))
            ) : (
              <div className="no-photos-box">
                <p>No storefront photos uploaded yet. Add photos to boost customer trust.</p>
              </div>
            )}
          </div>
        </div>

        {/* Shop Details View or Edit Form */}
        {isEditing ? (
          <form className="edit-shop-form form-card-section fade-in" onSubmit={handleSaveShopDetails}>
            <div className="section-head">
              <h3>Edit Shop Information</h3>
              <p>Update contact information, physical location, and operating hours.</p>
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
                <label htmlFor="shopCategoryInput">Category *</label>
                <select
                  id="shopCategoryInput"
                  name="category"
                  className="form-input form-select"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
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
              <label htmlFor="shopAddressLineInput">Address Line *</label>
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
                <label htmlFor="shopPostalCodeInput">Postal Code *</label>
                <input
                  id="shopPostalCodeInput"
                  name="postalCode"
                  type="text"
                  className="form-input"
                  value={formData.postalCode}
                  onChange={handleInputChange}
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
                value={formData.openingHours}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="edit-form-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving Changes...' : 'Save Shop Information'}
              </button>
            </div>
          </form>
        ) : (
          <div className="shop-details-display form-card-section fade-in">
            <div className="section-head">
              <h3>Shop Information & Address</h3>
            </div>

            <div className="details-info-grid">
              <div className="detail-item">
                <span className="detail-label">Store Description</span>
                <p className="detail-text">{shop?.description}</p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Store Contact</span>
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
                <p className="detail-text">{shop?.openingHours}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerShopPage;
