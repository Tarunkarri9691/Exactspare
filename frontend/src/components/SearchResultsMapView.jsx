import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SearchResultsMapView.css';

// Custom Automotive Pin SVG Icon for Retail Shops
const createShopMarkerIcon = (matchingCount = 1) => {
  return L.divIcon({
    className: 'custom-shop-map-marker',
    html: `
      <div class="shop-pin-badge">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#FF6500"></path>
          <circle cx="12" cy="10" r="3" fill="#FFFFFF"></circle>
        </svg>
        <span class="pin-count-bubble">${matchingCount}</span>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -40]
  });
};

// Customer User Location Icon
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'custom-user-map-marker',
    html: `
      <div class="user-pulse-marker">
        <div class="user-center-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
};

const SearchResultsMapView = ({
  shops = [],
  userLocation = null,
  radiusKm = 25,
  height = '480px',
  onSelectShop
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userCircleRef = useRef(null);
  const navigate = useNavigate();

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter = userLocation?.latitude && userLocation?.longitude
      ? [userLocation.latitude, userLocation.longitude]
      : shops.length > 0 && shops[0].latitude && shops[0].longitude
        ? [shops[0].latitude, shops[0].longitude]
        : [19.0760, 72.8777]; // Default to Mumbai

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      attributionControl: true
    });

    mapInstanceRef.current = map;

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Feature group for markers
    markersLayerRef.current = L.featureGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize Markers & Radius Circle when shops or location change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (userCircleRef.current) {
      map.removeLayer(userCircleRef.current);
      userCircleRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Plot user location if available
    if (userLocation?.latitude && userLocation?.longitude) {
      const userLatLng = [userLocation.latitude, userLocation.longitude];
      const userMarker = L.marker(userLatLng, {
        icon: createUserLocationIcon()
      }).bindPopup(`
        <div class="map-popup-card user-popup">
          <strong>Your Active Search Location</strong>
          <p>${userLocation.name || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}</p>
        </div>
      `);
      markersLayer.addLayer(userMarker);
      bounds.extend(userLatLng);

      // Draw search radius circle
      if (radiusKm) {
        userCircleRef.current = L.circle(userLatLng, {
          radius: radiusKm * 1000,
          color: '#FF6500',
          fillColor: '#FF6500',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4 4'
        }).addTo(map);
      }
    }

    // 2. Plot shop markers
    shops.forEach((shop) => {
      const lat = shop.latitude || (Array.isArray(shop.coordinates) ? shop.coordinates[1] : null);
      const lng = shop.longitude || (Array.isArray(shop.coordinates) ? shop.coordinates[0] : null);

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const shopLatLng = [lat, lng];
        const marker = L.marker(shopLatLng, {
          icon: createShopMarkerIcon(shop.matchingPartsCount || 1)
        });

        const distText = shop.distanceKm !== null && shop.distanceKm !== undefined
          ? `<span class="popup-dist-badge">📍 ${shop.distanceKm} km away</span>`
          : '';

        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

        const popupContent = document.createElement('div');
        popupContent.className = 'map-popup-card shop-popup';
        popupContent.innerHTML = `
          <div class="popup-header">
            <span class="popup-category-tag">${shop.category || 'Retail Store'}</span>
            ${distText}
          </div>
          <h4 class="popup-shop-name">${shop.name}</h4>
          <p class="popup-shop-address">${shop.address?.addressLine || ''}, ${shop.address?.city || ''}</p>
          <div class="popup-meta-row">
            <span class="popup-parts-count">📦 <strong>${shop.matchingPartsCount || 1}</strong> matching spare parts</span>
          </div>
          <div class="popup-actions-grid">
            <button class="btn-popup-view" id="btn-view-shop-${shop._id}">View Store</button>
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn-popup-directions">Get Directions</a>
          </div>
        `;

        // Handle navigation inside Leaflet popup DOM
        popupContent.querySelector(`#btn-view-shop-${shop._id}`)?.addEventListener('click', () => {
          if (onSelectShop) {
            onSelectShop(shop._id);
          } else {
            navigate(`/shops/${shop._id}`);
          }
        });

        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
        bounds.extend(shopLatLng);
      }
    });

    // Adjust map viewport to fit all points
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14
      });
    }
  }, [shops, userLocation, radiusKm, navigate, onSelectShop]);

  if (shops.length === 0 && !userLocation?.latitude) {
    return (
      <div className="map-empty-state-box" style={{ height }}>
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
        <h4>No Geolocated Shops in Current View</h4>
        <p>No verified retail shops with matching spare parts were found in this area. Try increasing the search radius or clearing vehicle filters.</p>
      </div>
    );
  }

  return (
    <div className="search-results-map-wrapper">
      <div
        ref={mapContainerRef}
        className="search-map-container"
        style={{ height }}
      />
    </div>
  );
};

export default SearchResultsMapView;
