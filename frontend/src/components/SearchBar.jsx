import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { geocodeAddress } from '../services/api';
import './SearchBar.css';

const VEHICLE_OPTIONS = [
  { value: 'ALL', label: 'All Vehicles' },
  { value: 'Bike', label: 'Bike / Motorcycle' },
  { value: 'Car', label: 'Car / 4-Wheeler' },
  { value: 'Scooter', label: 'Scooter / Moped' },
  { value: 'Bicycle', label: 'Bicycle' },
  { value: 'Other', label: 'Commercial / Other' }
];

const SearchBar = ({ onSearch }) => {
  const [partQuery, setPartQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('ALL');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [radiusKm, setRadiusKm] = useState(25);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const navigate = useNavigate();

  // Handle GPS location request
  const handleUseGPS = () => {
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
        setCoords({ latitude: lat, longitude: lng });
        setLocationInput(`My Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`);
      },
      (err) => {
        setLoadingGeo(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('Location permission was denied. You can enter your city or PIN code manually.');
        } else {
          setErrorMsg('Could not detect location. Please type your city or PIN code.');
        }
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // If query, vehicle, and location are all empty, validate and alert
    if (!partQuery.trim() && vehicleType === 'ALL' && !make.trim() && !model.trim() && !locationInput.trim()) {
      setErrorMsg('Please enter a spare-part name, select a vehicle, or specify your location.');
      return;
    }

    let searchLat = coords?.latitude;
    let searchLng = coords?.longitude;

    // If customer entered location text but haven't geocoded yet, resolve it now
    if (locationInput.trim() && (!coords || !locationInput.startsWith('My Location'))) {
      setLoadingGeo(true);
      const geoRes = await geocodeAddress(locationInput.trim());
      setLoadingGeo(false);

      if (geoRes.success && geoRes.data) {
        searchLat = geoRes.data.latitude;
        searchLng = geoRes.data.longitude;
      } else {
        setErrorMsg(`Could not resolve coordinates for "${locationInput}". Searching without distance filter.`);
      }
    }

    const params = new URLSearchParams();
    if (partQuery.trim()) params.set('q', partQuery.trim());
    if (vehicleType && vehicleType !== 'ALL') params.set('vehicleType', vehicleType);
    if (make.trim()) params.set('make', make.trim());
    if (model.trim()) params.set('model', model.trim());

    if (searchLat && searchLng) {
      params.set('latitude', searchLat);
      params.set('longitude', searchLng);
      params.set('radiusKm', radiusKm);
      params.set('locationName', locationInput.trim());
    }

    if (onSearch) {
      onSearch(Object.fromEntries(params.entries()));
    } else {
      navigate(`/parts?${params.toString()}`);
    }
  };

  return (
    <div className="search-section-wrapper">
      <div className="search-badge-container">
        <span className="badge badge-orange">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Live Location-Based Discovery • Approved Spare Parts Dealers
        </span>
      </div>

      <form className="search-card-form" onSubmit={handleSearchSubmit}>
        {/* Row 1: Part query & Vehicle Type */}
        <div className="search-row-primary">
          {/* Input 1: Part Search */}
          <div className="search-input-group part-group">
            <label htmlFor="search-part-input" className="search-label">Spare Part Name / Number</label>
            <div className="input-with-icon">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                id="search-part-input"
                type="text"
                className="search-input"
                placeholder="e.g. Brake Pads, Oil Filter, Spark Plug, Clutch..."
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Input 2: Vehicle Type */}
          <div className="search-input-group category-group">
            <label htmlFor="search-category-select" className="search-label">Vehicle Type</label>
            <div className="input-with-icon">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
              <select
                id="search-category-select"
                className="search-select"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                {VEHICLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Input 3: Location */}
          <div className="search-input-group location-group">
            <label htmlFor="search-location-input" className="search-label">Customer Location</label>
            <div className="input-with-icon">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <input
                id="search-location-input"
                type="text"
                className="search-input"
                placeholder="City, PIN code or Area..."
                value={locationInput}
                onChange={(e) => {
                  setLocationInput(e.target.value);
                  setCoords(null);
                }}
              />
              <button
                type="button"
                className="btn-inline-gps"
                onClick={handleUseGPS}
                disabled={loadingGeo}
                title="Detect current GPS location"
              >
                {loadingGeo ? '...' : 'GPS'}
              </button>
            </div>
          </div>

          {/* Search Button */}
          <div className="search-action-group">
            <button type="submit" className="btn btn-primary search-submit-btn" id="find-parts-button">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Find Nearby Parts</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Toggle (Make, Model, Radius) */}
        <div className="search-secondary-bar">
          <button
            type="button"
            className="btn-toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>{showAdvanced ? 'Hide Vehicle Specs' : '+ Specific Make, Model & Radius'}</span>
          </button>

          {coords && (
            <span className="gps-active-badge">
              ✓ GPS Active ({radiusKm} km radius)
            </span>
          )}
        </div>

        {/* Collapsible Make / Model / Radius */}
        {showAdvanced && (
          <div className="search-advanced-grid fade-in">
            <div className="advanced-field">
              <label htmlFor="search-make-input" className="search-label">Make / Brand</label>
              <input
                id="search-make-input"
                type="text"
                className="search-input-sm"
                placeholder="e.g. Hyundai, Honda, Bajaj..."
                value={make}
                onChange={(e) => setMake(e.target.value)}
              />
            </div>

            <div className="advanced-field">
              <label htmlFor="search-model-input" className="search-label">Vehicle Model</label>
              <input
                id="search-model-input"
                type="text"
                className="search-input-sm"
                placeholder="e.g. Swift, Activa, Creta..."
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="advanced-field">
              <label htmlFor="search-radius-select" className="search-label">Search Radius</label>
              <select
                id="search-radius-select"
                className="search-select-sm"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km (Default)</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
              </select>
            </div>
          </div>
        )}

        {/* Error / Validation Banner */}
        {errorMsg && (
          <div className="search-error-banner fade-in">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default SearchBar;
