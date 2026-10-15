import React, { useState } from 'react';
import { geocodeAddress } from '../services/api';
import './LocationSelector.css';

const RADIUS_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km (Default)' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' }
];

const LocationSelector = ({
  latitude,
  longitude,
  locationName = '',
  radiusKm = 25,
  onLocationChange,
  onClearLocation,
  compact = false
}) => {
  const [addressInput, setAddressInput] = useState(locationName || '');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);

  const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  // Request browser geolocation on user click
  const handleUseBrowserLocation = () => {
    setErrorMsg('');

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLoadingGeo(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingGeo(false);
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;
        const name = `GPS Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
        setAddressInput(name);
        if (onLocationChange) {
          onLocationChange({
            latitude: lat,
            longitude: lng,
            locationName: name,
            radiusKm
          });
        }
      },
      (err) => {
        setLoadingGeo(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorMsg('Location access was denied. You can enter a city or pincode manually below.');
            break;
          case err.POSITION_UNAVAILABLE:
            setErrorMsg('Location information is currently unavailable. Please enter your city manually.');
            break;
          case err.TIMEOUT:
            setErrorMsg('The request to determine your location timed out. Please try again or enter your city.');
            break;
          default:
            setErrorMsg('Could not determine current location. Please enter your city or postal code.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache for 1 minute, no continuous polling
      }
    );
  };

  // Resolve manual address / city / pincode via backend geocoding endpoint
  const handleResolveAddress = async (e) => {
    e?.preventDefault();
    if (!addressInput.trim()) {
      setErrorMsg('Please enter a city, area or postal code.');
      return;
    }

    setErrorMsg('');
    setLoadingGeo(true);

    const res = await geocodeAddress(addressInput.trim());
    setLoadingGeo(false);

    if (res.success && res.data) {
      const lat = res.data.latitude;
      const lng = res.data.longitude;
      const displayName = res.data.displayName?.split(',').slice(0, 3).join(',') || addressInput.trim();

      if (onLocationChange) {
        onLocationChange({
          latitude: lat,
          longitude: lng,
          locationName: displayName,
          radiusKm
        });
      }
    } else {
      setErrorMsg(res.error || `Could not resolve coordinates for "${addressInput}". Please verify the location spelling.`);
    }
  };

  const handleRadiusSelect = (newRadius) => {
    setShowRadiusMenu(false);
    if (onLocationChange) {
      onLocationChange({
        latitude,
        longitude,
        locationName,
        radiusKm: newRadius
      });
    }
  };

  const handleClear = () => {
    setAddressInput('');
    setErrorMsg('');
    if (onClearLocation) onClearLocation();
  };

  return (
    <div className={`location-selector-root ${compact ? 'compact' : ''}`}>
      <div className="location-control-row">
        {/* Address Search Form */}
        <form className="location-input-form" onSubmit={handleResolveAddress}>
          <div className="location-input-box">
            <svg className="loc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <input
              type="text"
              className="location-text-input"
              placeholder="Enter City, PIN code or Area..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
            />
            {addressInput && (
              <button
                type="button"
                className="btn-clear-loc-input"
                onClick={handleClear}
                title="Clear location"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-outline btn-locate"
            disabled={loadingGeo || !addressInput.trim()}
            title="Search this location"
          >
            {loadingGeo ? 'Resolving...' : 'Locate'}
          </button>
        </form>

        {/* GPS Button */}
        <button
          type="button"
          className="btn-gps-trigger"
          onClick={handleUseBrowserLocation}
          disabled={loadingGeo}
          title="Use browser GPS location"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          <span>Use Current Location</span>
        </button>

        {/* Radius Selector */}
        <div className="radius-picker-wrap">
          <label className="radius-label">Radius:</label>
          <select
            className="radius-select"
            value={radiusKm}
            onChange={(e) => handleRadiusSelect(Number(e.target.value))}
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="location-error-alert fade-in">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Location Info & Disclaimer */}
      {hasLocation ? (
        <div className="active-location-banner fade-in">
          <div className="active-location-badge">
            <span className="pulse-dot"></span>
            <strong>Active Search Center:</strong> {locationName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`} (Within {radiusKm} km)
          </div>
          <span className="distance-disclaimer-text">
            * Distances are straight-line measurements. Actual road travel distance may vary.
          </span>
        </div>
      ) : (
        <div className="no-location-banner">
          <span className="no-location-text">
            No location active. Showing parts across all verified shops. Set a location above to see real distance.
          </span>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
