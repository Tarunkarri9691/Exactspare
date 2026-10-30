import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationPickerMap.css';

// Custom Automotive Pin SVG Icon for Leaflet
const createCustomIcon = (readOnly) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div class="marker-pin ${readOnly ? 'admin-marker' : ''}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="${readOnly ? '#8B5CF6' : '#FF6500'}"></path>
          <circle cx="12" cy="10" r="3" fill="#FFFFFF"></circle>
        </svg>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -40]
  });
};

const LocationPickerMap = ({
  latitude = 28.6139,
  longitude = 77.2090,
  onChange,
  readOnly = false,
  height = '320px'
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [geoNotice, setGeoNotice] = useState('');
  const initialLat = Number(latitude) || 28.6139;
  const initialLng = Number(longitude) || 77.2090;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map instance
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: !readOnly,
      attributionControl: true
    });

    mapInstanceRef.current = map;

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create marker
    const marker = L.marker([initialLat, initialLng], {
      icon: createCustomIcon(readOnly),
      draggable: !readOnly
    }).addTo(map);

    markerRef.current = marker;

    if (!readOnly && onChange) {
      // Map click event updates marker position & parent coordinates
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onChange({
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6))
        });
      });

      // Drag event updates coordinates
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onChange({
          latitude: parseFloat(position.lat.toFixed(6)),
          longitude: parseFloat(position.lng.toFixed(6))
        });
      });
    }

    // Leaflet container invalidation after mount for correct tiles rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync marker position when props change from manual inputs
  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!isNaN(lat) && !isNaN(lng) && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (readOnly) {
        mapInstanceRef.current.setView([lat, lng], 14);
      }
    }
  }, [latitude, longitude, readOnly]);

  const handleDetectLocation = () => {
    setGeoNotice('');
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));

        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 15);
        }

        if (onChange) {
          onChange({ latitude: lat, longitude: lng });
        }
      },
      (error) => {
        setGeoNotice(`Location detection failed: ${error.message}. Please click on the map or enter coordinates manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="location-picker-component">
      {geoNotice && (
        <div className="auth-alert error-alert fade-in" style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
          <span>{geoNotice}</span>
        </div>
      )}
      {!readOnly && (
        <div className="map-toolbar">
          <span className="map-hint">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Click anywhere on the map or drag the pin to set your shop location.
          </span>
          <button
            type="button"
            className="btn btn-outline detect-location-btn"
            onClick={handleDetectLocation}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            <span>Detect Current Location</span>
          </button>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="map-leaflet-box"
        style={{ height }}
      />
    </div>
  );
};

export default LocationPickerMap;
