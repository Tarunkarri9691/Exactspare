import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPublicShopById, fetchDirectionsRoute, geocodeAddress } from '../services/api';
import './ShopDirectionsPage.css';

// Custom Marker Icons for Leaflet
const createShopMarkerIcon = (shopName) => {
  return L.divIcon({
    className: 'directions-shop-marker',
    html: `
      <div class="shop-marker-wrapper">
        <div class="shop-marker-pin">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#0F172A"></path>
            <circle cx="12" cy="10" r="3" fill="#FF6500"></circle>
          </svg>
        </div>
        <div class="shop-marker-title">${shopName || 'Store'}</div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 50],
    popupAnchor: [0, -48]
  });
};

const createCustomerMarkerIcon = (label) => {
  return L.divIcon({
    className: 'directions-user-marker',
    html: `
      <div class="user-marker-wrapper">
        <div class="user-pulse-ring"></div>
        <div class="user-marker-dot">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#FFFFFF">
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        </div>
        <div class="user-marker-title">${label || 'You'}</div>
      </div>
    `,
    iconSize: [36, 48],
    iconAnchor: [18, 24],
    popupAnchor: [0, -22]
  });
};

const ShopDirectionsPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Shop state
  const [shop, setShop] = useState(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [shopError, setShopError] = useState('');

  // Origin location state
  const paramOriginLat = searchParams.get('originLat') ? parseFloat(searchParams.get('originLat')) : null;
  const paramOriginLng = searchParams.get('originLng') ? parseFloat(searchParams.get('originLng')) : null;
  const paramOriginName = searchParams.get('originName') || '';

  const [originLat, setOriginLat] = useState(paramOriginLat);
  const [originLng, setOriginLng] = useState(paramOriginLng);
  const [originName, setOriginName] = useState(paramOriginName);
  const [manualInput, setManualInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');

  // Route state
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const shopMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);

  // 1. Load shop details from MongoDB backend
  useEffect(() => {
    let isMounted = true;
    const loadShop = async () => {
      try {
        setLoadingShop(true);
        setShopError('');
        const res = await fetchPublicShopById(id);
        if (!isMounted) return;

        if (res.success && res.data?.shop) {
          setShop(res.data.shop);
        } else {
          setShopError(res.error || 'Verified automotive shop not found or is currently inactive.');
        }
      } catch {
        if (isMounted) setShopError('Error loading shop profile for directions.');
      } finally {
        if (isMounted) setLoadingShop(false);
      }
    };

    loadShop();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Derive coordinates
  const shopLng = shop?.address?.location?.coordinates?.[0] ?? (Array.isArray(shop?.coordinates) ? shop.coordinates[0] : null);
  const shopLat = shop?.address?.location?.coordinates?.[1] ?? (Array.isArray(shop?.coordinates) ? shop.coordinates[1] : null);
  const hasValidShopCoords =
    shopLat !== null &&
    shopLng !== null &&
    !isNaN(shopLat) &&
    !isNaN(shopLng) &&
    shopLat >= -90 &&
    shopLat <= 90 &&
    shopLng >= -180 &&
    shopLng <= 180;

  const hasValidOrigin =
    originLat !== null &&
    originLng !== null &&
    !isNaN(originLat) &&
    !isNaN(originLng) &&
    originLat >= -90 &&
    originLat <= 90 &&
    originLng >= -180 &&
    originLng <= 180;

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = hasValidShopCoords ? shopLat : (hasValidOrigin ? originLat : 19.0760);
    const defaultLng = hasValidShopCoords ? shopLng : (hasValidOrigin ? originLng : 72.8777);

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    mapInstanceRef.current = map;

    // Standard OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasValidShopCoords, shopLat, shopLng]);

  // 3. Request route calculation from routing service (OSRM / backend proxy)
  const calculateRoute = useCallback(async (oLat, oLng, sLat, sLng) => {
    if (oLat === null || oLng === null || sLat === null || sLng === null) return;
    if (isNaN(oLat) || isNaN(oLng) || isNaN(sLat) || isNaN(sLng)) return;

    try {
      setRouteLoading(true);
      setRouteError('');
      const res = await fetchDirectionsRoute({
        originLat: oLat,
        originLng: oLng,
        destLat: sLat,
        destLng: sLng
      });

      if (res.success && res.data) {
        setRouteData(res.data);
      } else {
        setRouteData(null);
        setRouteError(res.error || 'Could not calculate a road driving route between your location and this shop.');
      }
    } catch (err) {
      setRouteData(null);
      setRouteError(err.message || 'Network error while contacting routing provider. Please retry.');
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Trigger route calculation whenever both origin and shop coordinates are valid
  useEffect(() => {
    if (hasValidOrigin && hasValidShopCoords) {
      calculateRoute(originLat, originLng, shopLat, shopLng);
    }
  }, [hasValidOrigin, hasValidShopCoords, originLat, originLng, shopLat, shopLng, calculateRoute]);

  // 4. Update Leaflet Map Markers & Route Geometry
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing shop marker
    if (shopMarkerRef.current) {
      map.removeLayer(shopMarkerRef.current);
      shopMarkerRef.current = null;
    }

    // Remove existing user marker
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    // Remove existing route line
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // Plot Shop Marker
    if (hasValidShopCoords) {
      const shopLatLng = [shopLat, shopLng];
      const sMarker = L.marker(shopLatLng, {
        icon: createShopMarkerIcon(shop.name),
        title: shop.name
      }).bindPopup(`
        <div class="dir-map-popup">
          <div class="popup-tag">Destination Store</div>
          <strong class="popup-title">${shop.name}</strong>
          <p class="popup-desc">${shop.address?.addressLine || ''}, ${shop.address?.city || ''}</p>
          ${shop.contact?.phone ? `<p class="popup-phone">📞 ${shop.contact.phone}</p>` : ''}
        </div>
      `);

      sMarker.addTo(map);
      shopMarkerRef.current = sMarker;
      bounds.extend(shopLatLng);
    }

    // Plot User / Customer Origin Marker
    if (hasValidOrigin) {
      const userLatLng = [originLat, originLng];
      const uMarker = L.marker(userLatLng, {
        icon: createCustomerMarkerIcon(originName || 'Starting Point'),
        title: originName || 'Your Location'
      }).bindPopup(`
        <div class="dir-map-popup">
          <div class="popup-tag user-tag">Starting Origin</div>
          <strong class="popup-title">${originName || 'Current Location'}</strong>
          <p class="popup-desc">${originLat.toFixed(4)}, ${originLng.toFixed(4)}</p>
        </div>
      `);

      uMarker.addTo(map);
      userMarkerRef.current = uMarker;
      bounds.extend(userLatLng);
    }

    // Plot Real Road Route Geometry
    if (routeData && routeData.geometry) {
      // Draw outer glow/casing line for high readability on dark/light maps
      const casingLayer = L.geoJSON(routeData.geometry, {
        style: {
          color: '#0F172A',
          weight: 7,
          opacity: 0.6,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });

      // Draw primary energetic orange route line
      const activeRouteLayer = L.geoJSON(routeData.geometry, {
        style: {
          color: '#FF6500',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });

      const routeGroup = L.featureGroup([casingLayer, activeRouteLayer]).addTo(map);
      routeLayerRef.current = routeGroup;

      // Extend bounds to encompass entire route geometry
      try {
        const routeBounds = routeGroup.getBounds();
        if (routeBounds.isValid()) {
          bounds.extend(routeBounds);
        }
      } catch {
        // safety fallback
      }
    }

    // Adjust viewport to fit all relevant elements
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16
      });
    }
  }, [hasValidShopCoords, hasValidOrigin, shop, shopLat, shopLng, originLat, originLng, originName, routeData]);

  // 5. Customer Action: Locate Me via Browser Geolocation
  const handleLocateMe = () => {
    setLocationNotice('');
    setRouteError('');

    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser. Please enter your origin location manually.');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setOriginLat(lat);
        setOriginLng(lng);
        setOriginName('My Current Location (GPS)');
        setLocationNotice('Location detected successfully.');
        setTimeout(() => setLocationNotice(''), 3000);
      },
      (err) => {
        setIsLocatingUser(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationNotice('Location permission was denied. You can enter your city, area, or postal code manually below.');
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationNotice('Location information is currently unavailable from your device. Please enter your address manually.');
            break;
          case err.TIMEOUT:
            setLocationNotice('Geolocation request timed out. Please try again or type your city.');
            break;
          default:
            setLocationNotice('Unable to acquire current location. Please use the manual origin search.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  // 6. Customer Action: Manual Origin Search via Geocoder
  const handleManualOriginSubmit = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    try {
      setGeocoding(true);
      setLocationNotice('');
      setRouteError('');

      const res = await geocodeAddress(manualInput.trim());
      if (res.success && res.data) {
        const lat = parseFloat(res.data.latitude.toFixed(6));
        const lng = parseFloat(res.data.longitude.toFixed(6));
        const resolvedLabel = res.data.displayName?.split(',').slice(0, 2).join(',') || manualInput.trim();
        setOriginLat(lat);
        setOriginLng(lng);
        setOriginName(resolvedLabel);
        setManualInput('');
        setLocationNotice(`Origin set to: ${resolvedLabel}`);
        setTimeout(() => setLocationNotice(''), 3500);
      } else {
        setLocationNotice(res.error || `Could not find coordinates for "${manualInput}". Try a broader city or postal code.`);
      }
    } catch {
      setLocationNotice('Error resolving address. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  // 7. Navigation & External Fallbacks
  const handleOpenGoogleMaps = () => {
    if (!hasValidShopCoords) return;
    const dest = `${shopLat},${shopLng}`;
    const origin = hasValidOrigin ? `&origin=${originLat},${originLng}` : '';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRetryRoute = () => {
    if (hasValidOrigin && hasValidShopCoords) {
      calculateRoute(originLat, originLng, shopLat, shopLng);
    }
  };

  if (loadingShop) {
    return (
      <div className="shop-directions-page">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Store & Navigation Coordinates...</h3>
        </div>
      </div>
    );
  }

  if (shopError || !shop) {
    return (
      <div className="shop-directions-page">
        <div className="container app-status-loading">
          <div className="auth-alert error-alert">
            <span>{shopError || 'Store not found.'}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => navigate('/shops')}
          >
            ← Back to Shops Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-directions-page">
      <div className="container directions-main-container">
        {/* Breadcrumb Navigation */}
        <nav className="directions-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="breadcrumb-back-btn"
            onClick={() => navigate(-1)}
            title="Go back to previous page"
          >
            ← Back
          </button>
          <span className="breadcrumb-sep">/</span>
          <Link to="/shops" className="breadcrumb-link">Find Shops</Link>
          <span className="breadcrumb-sep">/</span>
          <Link to={`/shops/${shop._id}`} className="breadcrumb-link">{shop.name}</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">In-App Directions</span>
        </nav>

        {/* Page Header */}
        <div className="directions-header-row">
          <div>
            <div className="directions-badge">
              <span>📍</span> IN-APP ROAD NAVIGATION
            </div>
            <h1 className="directions-page-title">Directions to {shop.name}</h1>
            <p className="directions-page-subtitle">
              Interactive map with real turn-by-turn driving route, road distance, and contact details.
            </p>
          </div>

          <div className="header-quick-actions">
            <button
              type="button"
              className="btn btn-outline-navy"
              onClick={() => navigate('/shops')}
              title="Return to shops directory with active filters preserved"
            >
              Back to Shops
            </button>
            {hasValidShopCoords && (
              <button
                type="button"
                className="btn btn-primary btn-gmaps-link"
                onClick={handleOpenGoogleMaps}
                title="Open destination coordinates in external Google Maps"
              >
                Open in Google Maps ↗
              </button>
            )}
          </div>
        </div>

        {/* Missing Shop Coordinates Notice */}
        {!hasValidShopCoords && (
          <div className="directions-alert warning-alert fade-in">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Map Directions Unavailable for this Shop</strong>
              <p>
                This shop's verified physical GPS coordinates are pending verification. You can still reach the shop using the full address and phone number listed in the shop card below.
              </p>
            </div>
          </div>
        )}

        {/* Route Loading State */}
        {routeLoading && (
          <div className="directions-alert info-alert fade-in">
            <span className="spinner-icon">⌛</span>
            <span>Calculating real road route and driving distance from routing provider...</span>
          </div>
        )}

        {/* Route Error Notification */}
        {routeError && !routeLoading && (
          <div className="directions-alert error-alert fade-in">
            <span className="alert-icon">✕</span>
            <div style={{ flex: 1 }}>
              <strong>Route Calculation Error:</strong> {routeError}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline btn-retry-route"
              onClick={handleRetryRoute}
            >
              🔄 Retry Route
            </button>
          </div>
        )}

        {/* Location Notice Message */}
        {locationNotice && (
          <div className="directions-alert info-alert fade-in">
            <span>ℹ️ {locationNotice}</span>
          </div>
        )}

        {/* Main Two-Column Layout: Controls & Information Panel + Interactive Map */}
        <div className="directions-grid-layout">
          {/* Left Column: Origin Selection & Shop Card */}
          <aside className="directions-sidebar">
            {/* 1. Origin Location Controller */}
            <div className="directions-panel-card">
              <h3 className="panel-card-title">1. Starting Point (Origin)</h3>

              {hasValidOrigin ? (
                <div className="active-origin-card">
                  <div className="origin-status-row">
                    <span className="origin-pulse-indicator">●</span>
                    <div>
                      <strong className="origin-title">{originName || 'Custom Location'}</strong>
                      <span className="origin-coords">
                        {originLat.toFixed(4)}, {originLng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="origin-btn-row">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={handleLocateMe}
                      disabled={isLocatingUser}
                      title="Update location using device GPS"
                    >
                      {isLocatingUser ? 'Locating...' : '📍 Refresh GPS'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setOriginLat(null);
                        setOriginLng(null);
                        setOriginName('');
                        setRouteData(null);
                      }}
                    >
                      Change Origin
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-origin-box">
                  <p className="no-origin-hint">
                    Select your starting point to calculate the road route to this shop.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-locate-me"
                    onClick={handleLocateMe}
                    disabled={isLocatingUser}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                    </svg>
                    <span>{isLocatingUser ? 'Acquiring GPS Location...' : 'Use My Current Location'}</span>
                  </button>

                  <div className="divider-or"><span>OR ENTER MANUALLY</span></div>

                  <form onSubmit={handleManualOriginSubmit} className="manual-origin-form">
                    <input
                      type="text"
                      className="origin-text-input"
                      placeholder="e.g. Pune Station, Kothrud, 411038"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn btn-outline btn-block"
                      disabled={geocoding || !manualInput.trim()}
                    >
                      {geocoding ? 'Resolving Location...' : 'Set Origin'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* 2. Route Metrics Card (When Route is available) */}
            {routeData && (
              <div className="directions-panel-card route-metrics-card fade-in">
                <h3 className="panel-card-title">2. Road Driving Summary</h3>
                <div className="metrics-summary-row">
                  <div className="metric-box">
                    <span className="metric-label">Driving Distance</span>
                    <strong className="metric-value">{routeData.distanceKm} km</strong>
                  </div>
                  {routeData.durationMinutes > 0 && (
                    <div className="metric-box">
                      <span className="metric-label">Estimated Time</span>
                      <strong className="metric-value">
                        {routeData.durationMinutes >= 60
                          ? `${Math.floor(routeData.durationMinutes / 60)}h ${routeData.durationMinutes % 60}m`
                          : `${routeData.durationMinutes} mins`}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="routing-provider-subtext">
                  <span>Routing Service: <strong>{routeData.provider}</strong></span>
                </div>

                {/* Turn-by-Turn Maneuvers Preview */}
                {routeData.steps && routeData.steps.length > 0 && (
                  <details className="route-steps-details">
                    <summary className="route-steps-summary">
                      View Turn-by-Turn Steps ({routeData.steps.length})
                    </summary>
                    <ol className="steps-list">
                      {routeData.steps.map((st, i) => (
                        <li key={i} className="step-item">
                          <span className="step-road">{st.name}</span>
                          <span className="step-dist">({st.distanceMeters >= 1000 ? `${(st.distanceMeters / 1000).toFixed(1)} km` : `${st.distanceMeters} m`})</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            )}

            {/* 3. Destination Shop Card */}
            <div className="directions-panel-card shop-info-panel">
              <div className="shop-info-header">
                <span className="verified-shop-tag">✔ Verified Retail Partner</span>
                <span className="shop-category-tag">{shop.category || 'Automotive Shop'}</span>
              </div>

              <h2 className="shop-panel-name">{shop.name}</h2>

              <div className="shop-panel-details">
                <div className="shop-detail-item">
                  <span className="detail-icon">📍</span>
                  <div>
                    <strong>Store Address:</strong>
                    <p>{shop.address?.addressLine || 'Address line pending'}</p>
                    <p>{shop.address?.city}, {shop.address?.state} - {shop.address?.postalCode}</p>
                  </div>
                </div>

                {shop.contact?.phone && (
                  <div className="shop-detail-item">
                    <span className="detail-icon">📞</span>
                    <div>
                      <strong>Store Phone:</strong>
                      <p>
                        <a href={`tel:${shop.contact.phone}`} className="phone-link">
                          {shop.contact.phone}
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {shop.openingHours && (
                  <div className="shop-detail-item">
                    <span className="detail-icon">🕒</span>
                    <div>
                      <strong>Counter Hours:</strong>
                      <p>{shop.openingHours}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="shop-panel-actions">
                <Link to={`/shops/${shop._id}`} className="btn btn-outline btn-block">
                  Browse {shop.name}'s Spare Parts Catalog →
                </Link>
                {shop.contact?.phone && (
                  <a href={`tel:${shop.contact.phone}`} className="btn btn-primary btn-block" style={{ marginTop: '8px' }}>
                    Call Shop ({shop.contact.phone})
                  </a>
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Interactive Map View */}
          <main className="directions-map-column">
            <div className="map-frame-card">
              <div
                ref={mapContainerRef}
                className="interactive-directions-map"
                id="shop-directions-map"
                role="region"
                aria-label={`Interactive directions map for ${shop.name}`}
              />

              {/* In-Map Route Legend Overlay */}
              <div className="map-legend-overlay">
                <div className="legend-row">
                  <span className="legend-indicator origin-indicator"></span>
                  <span><strong>Start:</strong> {originName || (hasValidOrigin ? 'Your Coordinates' : 'Choose Origin')}</span>
                </div>
                <div className="legend-row">
                  <span className="legend-indicator shop-indicator"></span>
                  <span><strong>End:</strong> {shop.name}</span>
                </div>
                {routeData && (
                  <div className="legend-row">
                    <span className="legend-indicator route-indicator"></span>
                    <span><strong>Route:</strong> {routeData.distanceKm} km driving path</span>
                  </div>
                )}
              </div>

              {/* Floating Quick Action Overlays on Map */}
              <div className="map-quick-bar">
                <button
                  type="button"
                  className="map-float-btn"
                  onClick={handleLocateMe}
                  title="Locate me using GPS"
                  disabled={isLocatingUser}
                >
                  📍 {isLocatingUser ? 'Locating...' : 'My Location'}
                </button>
                {routeData && (
                  <button
                    type="button"
                    className="map-float-btn"
                    onClick={handleRetryRoute}
                    title="Recalculate route"
                  >
                    🔄 Recalculate
                  </button>
                )}
                {hasValidShopCoords && (
                  <button
                    type="button"
                    className="map-float-btn"
                    onClick={handleOpenGoogleMaps}
                    title="Open in Google Maps"
                  >
                    External Map ↗
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ShopDirectionsPage;
