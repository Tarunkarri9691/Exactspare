/**
 * EXACTSPARE — Distance & Geocoding Utilities
 * Computes exact great-circle straight-line distance on Earth sphere
 */

/**
 * Calculate straight-line distance between two coordinates in kilometers using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number|null} Distance in kilometers rounded to 1 decimal place, or null if coordinates are invalid.
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2) ||
    nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180
  ) {
    return null;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const EARTH_RADIUS_KM = 6371; // Mean Earth radius

  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place (e.g. 4.2 km)
};

/**
 * Standard note explaining straight-line distance vs road travel distance
 */
export const DISTANCE_DISCLAIMER =
  'Distances displayed are approximate straight-line measurements. Actual road travel distance may vary.';
