import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyApprovedShop, updateMyShopLocationApi } from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import './OwnerLocationPage.css';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry', 'Jammu & Kashmir', 'Ladakh'
];

const OwnerLocationPage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [shop, setShop] = useState(null);
  const [hasShop, setHasShop] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [formData, setFormData] = useState({
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    latitude: 28.6139,
    longitude: 77.2090
  });

  const [geoNotice, setGeoNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [successNotice, setSuccessNotice] = useState('');

  const loadLocationData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setValidationErrors([]);

      const res = await fetchMyApprovedShop();
      if (res.success && res.data) {
        setHasShop(!!res.data.hasShop);
        setIsApproved(!!res.data.isApproved);
        setApplicationStatus(res.data.applicationStatus || '');
        setStatusMessage(res.data.message || '');

        if (res.data.shop) {
          const s = res.data.shop;
          setShop(s);
          const rawLat = s.address?.location?.coordinates?.[1] ?? s.latitude ?? 28.6139;
          const rawLng = s.address?.location?.coordinates?.[0] ?? s.longitude ?? 77.2090;

          setFormData({
            addressLine: s.address?.addressLine || s.addressLine || '',
            city: s.address?.city || s.city || '',
            state: s.address?.state || s.state || '',
            postalCode: s.address?.postalCode || s.postalCode || '',
            latitude: Number(rawLat) || 28.6139,
            longitude: Number(rawLng) || 77.2090
          });
        }
      } else {
        setErrorMessage(res.error || 'Failed to retrieve shop location records.');
      }
    } catch {
      setErrorMessage('A network communication error occurred while loading shop location.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocationData();
  }, []);

  const handleCoordinateChange = ({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: Number(latitude),
      longitude: Number(longitude)
    }));
  };

  const handleDetectCurrentLocation = () => {
    setGeoNotice('');
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser. Please select your position on the map.');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));
        setGeoNotice(`✓ Acquired current browser position: ${lat}, ${lng}`);
        setDetecting(false);
        setTimeout(() => setGeoNotice(''), 4000);
      },
      (error) => {
        setDetecting(false);
        let msg = 'Failed to retrieve location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Location permission denied by user. Please adjust the map marker manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Location information is currently unavailable. Please select your location on the map.';
            break;
          case error.TIMEOUT:
            msg = 'Location request timed out. Please try again or adjust the map marker.';
            break;
          default:
            msg = error.message || 'Unable to detect position.';
        }
        setGeoNotice(`⚠️ ${msg}`);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setValidationErrors([]);
    setSuccessNotice('');

    const errors = [];
    if (!formData.addressLine.trim()) errors.push('Street address is required.');
    if (!formData.city.trim()) errors.push('City is required.');
    if (!formData.state.trim()) errors.push('State is required.');
    if (!formData.postalCode.trim()) errors.push('Postal code is required.');

    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('Latitude must be a valid number between -90 and 90.');
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('Longitude must be a valid number between -180 and 180.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const res = await updateMyShopLocationApi({
        addressLine: formData.addressLine.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        latitude: lat,
        longitude: lng
      });

      if (res.success) {
        setSuccessNotice('Shop location and GPS coordinates saved successfully!');
        if (res.data?.shop) {
          setShop(res.data.shop);
        }
        setTimeout(() => setSuccessNotice(''), 5000);
      } else {
        setErrorMessage(res.error || 'Failed to save shop location.');
        if (res.errors && Array.isArray(res.errors)) {
          setValidationErrors(res.errors);
        }
      }
    } catch {
      setErrorMessage('An unexpected server error occurred while updating shop location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="owner-location-root">
      <div className="container owner-location-container">
        {/* Navigation Breadcrumb */}
        <div className="location-breadcrumb">
          <Link to="/owner/dashboard">← Back to Owner Dashboard</Link>
          <span className="crumb-sep">/</span>
          <span>Shop Location</span>
        </div>

        {/* Header Banner */}
        <div className="location-header-card">
          <div className="header-icon-wrap">
            <span className="header-icon">📍</span>
          </div>
          <div className="header-info">
            <div className="badge-row">
              <span className="badge badge-orange">Location Management</span>
              {isApproved && <span className="badge badge-green">✓ Approved Store</span>}
              {!isApproved && applicationStatus && (
                <span className="badge badge-navy">Status: {applicationStatus}</span>
              )}
            </div>
            <h1 className="location-title">Physical Store Location & GPS Mapping</h1>
            <p className="location-subtitle">
              Configure your exact retail store address and map coordinates. Customers discover nearby spare parts using these exact GPS coordinates.
            </p>
          </div>
        </div>

        {/* Alerts & Notifications */}
        {successNotice && (
          <div className="auth-alert success-alert fade-in" style={{ marginBottom: '18px' }}>
            <span>✓ {successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-alert error-alert fade-in" style={{ marginBottom: '18px' }}>
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="auth-alert error-alert fade-in" style={{ marginBottom: '18px' }}>
            <strong>Please correct the following:</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="location-loading-state">
            <div className="auth-spinner">
              <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
              </svg>
            </div>
            <p>Loading shop location from database...</p>
          </div>
        ) : !hasShop || !isApproved ? (
          <div className="location-restricted-card">
            <div className="restricted-icon">🔒</div>
            <h3>Location Modification Locked</h3>
            <p>
              {applicationStatus === 'PENDING'
                ? 'Your shop registration application is currently under administrative verification. Location changes cannot be saved until the application is reviewed and approved.'
                : statusMessage || 'Only approved, active shop owners can modify live customer-facing store coordinates.'}
            </p>
            <div className="restricted-actions">
              <Link to="/owner/shop" className="btn btn-primary">
                View Shop Profile →
              </Link>
              <Link to="/owner/dashboard" className="btn btn-outline">
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="location-content-grid">
            {/* Form Column */}
            <div className="location-form-col">
              <div className="card location-card">
                <div className="card-head">
                  <h3>🏬 Physical Store Address</h3>
                  <p>Vehicle owners will see this address in search results and driving directions.</p>
                </div>

                <form onSubmit={handleSubmit} className="location-form">
                  <div className="form-group">
                    <label htmlFor="loc-address-line">Street Address / Shop No. / Building *</label>
                    <input
                      type="text"
                      id="loc-address-line"
                      value={formData.addressLine}
                      onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                      placeholder="e.g. Shop 14, Auto Spares Market, G.T. Road"
                      required
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="loc-city">City *</label>
                      <input
                        type="text"
                        id="loc-city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. New Delhi"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="loc-state">State *</label>
                      <select
                        id="loc-state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                      >
                        <option value="">Select State</option>
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="loc-postal-code">PIN / Postal Code *</label>
                    <input
                      type="text"
                      id="loc-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="e.g. 110006"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="coordinates-panel">
                    <div className="coords-header">
                      <strong>GPS Coordinates (GeoJSON Point)</strong>
                      <span className="coords-sub">Validated [Lng, Lat] format</span>
                    </div>

                    <div className="coords-inputs-row">
                      <div className="coord-field">
                        <label htmlFor="loc-lat">Latitude (°N)</label>
                        <input
                          type="number"
                          step="any"
                          id="loc-lat"
                          value={formData.latitude}
                          onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>
                      <div className="coord-field">
                        <label htmlFor="loc-lng">Longitude (°E)</label>
                        <input
                          type="number"
                          step="any"
                          id="loc-lng"
                          value={formData.longitude}
                          onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline detect-btn"
                      onClick={handleDetectCurrentLocation}
                      disabled={detecting}
                    >
                      {detecting ? 'Detecting...' : '📡 Use My Browser Location'}
                    </button>

                    {geoNotice && (
                      <div className="geo-notice-badge">
                        <span>{geoNotice}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary btn-save-location"
                      disabled={saving}
                      id="save-shop-location-btn"
                    >
                      {saving ? 'Saving Coordinates...' : '💾 Save Store Location'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Map Column */}
            <div className="location-map-col">
              <div className="card map-display-card">
                <div className="card-head">
                  <h3>🗺️ Interactive Map Placement</h3>
                  <p>Click anywhere on the map or drag the orange pin to set the exact storefront entrance.</p>
                </div>

                <div className="map-wrapper">
                  <LocationPickerMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    onChange={handleCoordinateChange}
                    height="420px"
                  />
                </div>

                <div className="map-guidance-footer">
                  <div className="guidance-item">
                    <span className="g-icon">📍</span>
                    <span><strong>Marker Position:</strong> Lat {formData.latitude.toFixed(6)}, Lng {formData.longitude.toFixed(6)}</span>
                  </div>
                  <div className="guidance-item">
                    <span className="g-icon">🚗</span>
                    <span><strong>Customer Discovery:</strong> Nearest parts searches use these coordinates for distance calculations.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerLocationPage;
