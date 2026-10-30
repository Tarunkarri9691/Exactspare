import mongoose from 'mongoose';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { calculateDistanceKm, DISTANCE_DISCLAIMER } from '../utils/distance.js';
import { logger } from '../utils/logger.js';
import { analyzeImageForPart } from '../services/aiProvider.js';
import https from 'https';
import http from 'http';
import fs from 'fs';

/**
 * Escape special characters for safe regular expression querying
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * In-memory LRU-like cache for Nominatim geocoding requests (respect OSM usage policy)
 */
const geocodeCache = new Map();
const MAX_CACHE_SIZE = 200;

/**
 * Query Nominatim OpenStreetMap geocoding service securely with proper User-Agent
 */
const queryNominatim = (searchQuery) => {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(searchQuery);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&addressdetails=1&limit=5`;

    const options = {
      headers: {
        'User-Agent': 'EXACTSPARE-Vehicle-Parts-Finder/1.0 (contact: support@exactspare.com)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 6000
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Geocoding request timed out'));
    });
  });
};

/**
 * In-memory LRU cache for OSRM driving route requests
 */
const routeCache = new Map();
const MAX_ROUTE_CACHE_SIZE = 200;

/**
 * Query OSRM routing service for real driving route geometry, distance, and duration
 */
const queryOsrmRoute = (originLat, originLng, destLat, destLng) => {
  return new Promise((resolve, reject) => {
    // OSRM coordinates format: {lon1},{lat1};{lon2},{lat2}
    const osrmBase = process.env.OSRM_ROUTER_URL || 'https://router.project-osrm.org';
    const url = `${osrmBase}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'EXACTSPARE-Vehicle-Parts-Finder/1.0 (contact: support@exactspare.com)',
        'Accept': 'application/json'
      },
      timeout: 8000
    };

    const req = client.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Routing service request timed out'));
    });
  });
};

/**
 * Core Search Endpoint: Location-based spare-parts discovery
 * @route GET /api/search/nearby-parts
 */
export const searchNearbyParts = async (req, res) => {
  try {
    const {
      q,
      partNumber,
      vehicleType,
      make,
      model,
      year,
      category,
      latitude,
      longitude,
      radiusKm = 25,
      minPrice,
      maxPrice,
      inStock,
      sortBy = 'distance',
      page = 1,
      limit = 12
    } = req.query;

    // 1. Parameter Validation
    const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLng = longitude !== undefined && longitude !== null && longitude !== '';

    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude must be provided together for location-based search.'
      });
    }

    let userLat = null;
    let userLng = null;
    let hasLocation = false;

    if (hasLat && hasLng) {
      userLat = Number(latitude);
      userLng = Number(longitude);

      if (isNaN(userLat) || userLat < -90 || userLat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude. Must be a valid decimal number between -90 and 90.'
        });
      }

      if (isNaN(userLng) || userLng < -180 || userLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid longitude. Must be a valid decimal number between -180 and 180.'
        });
      }

      hasLocation = true;
    }

    const nRadiusKm = Number(radiusKm);
    if (isNaN(nRadiusKm) || nRadiusKm <= 0 || nRadiusKm > 500) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search radius. Radius must be between 1 and 500 kilometers.'
      });
    }

    let nMinPrice = undefined;
    let nMaxPrice = undefined;

    if (minPrice !== undefined && minPrice !== '') {
      nMinPrice = Number(minPrice);
      if (isNaN(nMinPrice) || nMinPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'minPrice cannot be negative or invalid.'
        });
      }
    }

    if (maxPrice !== undefined && maxPrice !== '') {
      nMaxPrice = Number(maxPrice);
      if (isNaN(nMaxPrice) || nMaxPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxPrice cannot be negative or invalid.'
        });
      }
    }

    if (nMinPrice !== undefined && nMaxPrice !== undefined && nMinPrice > nMaxPrice) {
      return res.status(400).json({
        success: false,
        message: 'minPrice cannot be greater than maxPrice.'
      });
    }

    const ALLOWED_VEHICLES = ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];
    if (vehicleType && vehicleType !== 'ALL' && !ALLOWED_VEHICLES.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid vehicleType. Allowed values: ${ALLOWED_VEHICLES.join(', ')}`
      });
    }

    // 2. Identify eligible approved & active shops (with geospatial filter when coordinates provided)
    const shopFilter = {
      isApproved: true,
      isActive: true
    };

    if (hasLocation) {
      // Earth radius in kilometers = ~6378.1
      const radiusRadians = nRadiusKm / 6378.1;
      shopFilter['address.location'] = {
        $geoWithin: {
          $centerSphere: [[userLng, userLat], radiusRadians]
        }
      };
    }

    // Strictly select only public shop fields (never leak private docs or credentials)
    const eligibleShops = await Shop.find(
      shopFilter,
      '_id name category description address contact openingHours images isApproved isActive'
    ).lean();

    // If coordinates were specified and no approved shops fall in radius, return 0 matches early
    if (hasLocation && eligibleShops.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          parts: [],
          pagination: {
            total: 0,
            page: Number(page) || 1,
            limit: Math.min(50, Math.max(1, Number(limit) || 12)),
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          locationContext: {
            hasLocation: true,
            userCoordinates: { latitude: userLat, longitude: userLng },
            radiusKm: nRadiusKm,
            distanceNote: DISTANCE_DISCLAIMER
          },
          shops: [],
          filterSummary: {
            appliedFiltersCount: 1,
            noNearbyShops: true
          }
        }
      });
    }

    const eligibleShopMap = new Map();
    const eligibleShopIds = eligibleShops.map((shop) => {
      eligibleShopMap.set(shop._id.toString(), shop);
      return shop._id;
    });

    // 3. Construct SparePart query
    const partQuery = {
      shopId: { $in: eligibleShopIds },
      isPublished: true,
      isArchived: false,
      isModerated: false
    };

    // In-stock availability
    const isInStockOnly = inStock === 'true' || inStock === true;
    if (isInStockOnly) {
      partQuery.availabilityStatus = 'IN_STOCK';
      partQuery.stockQuantity = { $gt: 0 };
    }

    // Barcode exact match
    if (req.query.barcode && req.query.barcode.trim()) {
      partQuery.barcode = req.query.barcode.trim();
    }

    // Vehicle Type
    if (vehicleType && vehicleType !== 'ALL') {
      partQuery.vehicleType = vehicleType;
    }

    // Category
    if (category && category !== 'ALL') {
      partQuery.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }

    // Subcategory
    if (req.query.subcategory && req.query.subcategory.trim()) {
      partQuery.subcategory = new RegExp(escapeRegex(req.query.subcategory.trim()), 'i');
    }

    // Manufacturer / Brand
    const mfg = req.query.manufacturer || req.query.brand;
    if (mfg && mfg.trim() && mfg !== 'ALL') {
      partQuery.manufacturer = new RegExp(escapeRegex(mfg.trim()), 'i');
    }

    // Condition
    if (req.query.condition && req.query.condition !== 'ALL') {
      partQuery.condition = req.query.condition.toUpperCase();
    }

    // Customer Rating
    const minRating = req.query.minRating || req.query.rating;
    if (minRating && !isNaN(Number(minRating)) && Number(minRating) > 0) {
      partQuery.averageRating = { $gte: Number(minRating) };
    }

    // Exact or Prefix Part Number
    if (partNumber && partNumber.trim() !== '') {
      partQuery.partNumber = new RegExp(escapeRegex(partNumber.trim()), 'i');
    }

    // Vehicle Make
    if (make && make.trim() !== '' && make !== 'ALL') {
      partQuery.compatibleMakes = new RegExp(escapeRegex(make.trim()), 'i');
    }

    // Vehicle Model
    if (model && model.trim() !== '' && model !== 'ALL') {
      partQuery.compatibleModels = new RegExp(escapeRegex(model.trim()), 'i');
    }

    // Year
    if (year && year.trim() !== '' && year !== 'ALL') {
      partQuery.compatibleYears = String(year).trim();
    }

    // Price Range
    if (nMinPrice !== undefined || nMaxPrice !== undefined) {
      partQuery.price = {};
      if (nMinPrice !== undefined) partQuery.price.$gte = nMinPrice;
      if (nMaxPrice !== undefined) partQuery.price.$lte = nMaxPrice;
    }

    // General text search 'q' across relevant fields (support multi-term and exact phrases)
    if (q && q.trim() !== '') {
      const cleanQ = q.trim();
      const tokens = cleanQ.split(/\s+/).filter(Boolean);

      if (tokens.length > 1) {
        // Multi-word search: all tokens must match at least one relevant field
        partQuery.$and = tokens.map((token) => {
          const tRegex = new RegExp(escapeRegex(token), 'i');
          return {
            $or: [
              { partName: tRegex },
              { partNumber: tRegex },
              { barcode: tRegex },
              { manufacturerPartNumber: tRegex },
              { manufacturer: tRegex },
              { category: tRegex },
              { subcategory: tRegex },
              { description: tRegex },
              { compatibleMakes: tRegex },
              { compatibleModels: tRegex }
            ]
          };
        });
      } else {
        const qRegex = new RegExp(escapeRegex(cleanQ), 'i');
        partQuery.$or = [
          { partName: qRegex },
          { partNumber: qRegex },
          { barcode: qRegex },
          { manufacturerPartNumber: qRegex },
          { manufacturer: qRegex },
          { category: qRegex },
          { subcategory: qRegex },
          { description: qRegex },
          { compatibleMakes: qRegex },
          { compatibleModels: qRegex }
        ];
      }
    }

    // 4. Retrieve parts from database
    const matchingParts = await SparePart.find(partQuery)
      .select('-__v')
      .lean();

    // 5. Augment parts with real shop data and straight-line distance
    const partsWithDistance = [];
    const shopMatchesCounter = new Map();

    for (const part of matchingParts) {
      const shop = eligibleShopMap.get(part.shopId.toString());
      if (!shop) continue;

      let distanceKm = null;
      const shopCoords = shop.address?.location?.coordinates; // [lng, lat]
      if (hasLocation && Array.isArray(shopCoords) && shopCoords.length === 2) {
        const shopLng = shopCoords[0];
        const shopLat = shopCoords[1];
        distanceKm = calculateDistanceKm(userLat, userLng, shopLat, shopLng);
      }

      // Filter out if distance exceeds radiusKm (safety check on Haversine distance)
      if (hasLocation && distanceKm !== null && distanceKm > nRadiusKm) {
        continue;
      }

      // Track matching parts count per shop
      const shopIdStr = shop._id.toString();
      shopMatchesCounter.set(shopIdStr, (shopMatchesCounter.get(shopIdStr) || 0) + 1);

      partsWithDistance.push({
        ...part,
        distanceKm,
        shop: {
          _id: shop._id,
          name: shop.name,
          category: shop.category,
          address: shop.address,
          contact: {
            phone: shop.contact?.phone,
            email: shop.contact?.email
          },
          openingHours: shop.openingHours,
          images: shop.images || []
        }
      });
    }

    // 6. Sorting logic
    const resolvedSortBy = !hasLocation && sortBy === 'distance' ? 'newest' : sortBy;

    partsWithDistance.sort((a, b) => {
      if (resolvedSortBy === 'distance' && hasLocation) {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      }
      if (resolvedSortBy === 'price_asc') {
        return a.price - b.price;
      }
      if (resolvedSortBy === 'price_desc') {
        return b.price - a.price;
      }
      if (resolvedSortBy === 'rating' || resolvedSortBy === 'rating_desc') {
        return (b.averageRating || 0) - (a.averageRating || 0);
      }
      if (resolvedSortBy === 'relevance' && q) {
        const cleanQ = q.toLowerCase().trim();
        const aExact = (a.partNumber && a.partNumber.toLowerCase() === cleanQ) || (a.barcode && a.barcode.toLowerCase() === cleanQ);
        const bExact = (b.partNumber && b.partNumber.toLowerCase() === cleanQ) || (b.barcode && b.barcode.toLowerCase() === cleanQ);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      // Default: newest
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 7. Pagination
    const totalCount = partsWithDistance.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const totalPages = Math.ceil(totalCount / limitNum) || 0;
    const skip = (pageNum - 1) * limitNum;
    const paginatedParts = partsWithDistance.slice(skip, skip + limitNum);

    // 8. Generate shop markers for the interactive map
    const distinctShopsForMap = [];
    const seenShopIds = new Set();

    for (const item of partsWithDistance) {
      const sId = item.shop._id.toString();
      if (!seenShopIds.has(sId)) {
        seenShopIds.add(sId);
        const shopCoords = item.shop.address?.location?.coordinates;
        if (Array.isArray(shopCoords) && shopCoords.length === 2) {
          distinctShopsForMap.push({
            _id: item.shop._id,
            name: item.shop.name,
            category: item.shop.category,
            address: item.shop.address,
            coordinates: [shopCoords[0], shopCoords[1]], // [lng, lat]
            latitude: shopCoords[1],
            longitude: shopCoords[0],
            distanceKm: item.distanceKm,
            matchingPartsCount: shopMatchesCounter.get(sId) || 0,
            contactPhone: item.shop.contact?.phone,
            openingHours: item.shop.openingHours,
            images: item.shop.images
          });
        }
      }
    }

    // Sort map markers by distance if location provided
    if (hasLocation) {
      distinctShopsForMap.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        parts: paginatedParts,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        locationContext: {
          hasLocation,
          userCoordinates: hasLocation ? { latitude: userLat, longitude: userLng } : null,
          radiusKm: hasLocation ? nRadiusKm : null,
          sortBy: resolvedSortBy,
          distanceNote: hasLocation
            ? DISTANCE_DISCLAIMER
            : 'No location coordinates supplied. Displaying all matching parts without distance filtering.'
        },
        shops: distinctShopsForMap,
        filterSummary: {
          q: q || null,
          partNumber: partNumber || null,
          vehicleType: vehicleType || 'ALL',
          category: category || 'ALL',
          make: make || null,
          model: model || null,
          year: year || null,
          minPrice: nMinPrice ?? null,
          maxPrice: nMaxPrice ?? null,
          inStockOnly: isInStockOnly
        }
      }
    });
  } catch (error) {
    logger.error('Error during nearby parts search:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete nearby spare parts search. Please try again.'
    });
  }
};

/**
 * Return real database metadata for dynamic search filters (categories, makes, models)
 * @route GET /api/search/meta
 */
export const getSearchMetadata = async (req, res) => {
  try {
    // 1. Approved and active shops only
    const activeShops = await Shop.find({ isApproved: true, isActive: true }, '_id').lean();
    const activeShopIds = activeShops.map((s) => s._id);

    const baseFilter = {
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false
    };

    // Aggregate category counts from real database data
    const categoryStats = await SparePart.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Aggregate vehicleType counts from real database data
    const vehicleTypeStats = await SparePart.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Distinct makes and models from real database data
    const [distinctMakes, distinctModels, distinctManufacturers] = await Promise.all([
      SparePart.distinct('compatibleMakes', baseFilter),
      SparePart.distinct('compatibleModels', baseFilter),
      SparePart.distinct('manufacturer', baseFilter)
    ]);

    // Clean and sort arrays
    const cleanMakes = distinctMakes.filter(Boolean).sort();
    const cleanModels = distinctModels.filter(Boolean).sort();
    const cleanManufacturers = distinctManufacturers.filter(Boolean).sort();

    return res.status(200).json({
      success: true,
      data: {
        categories: categoryStats.map((c) => ({ name: c._id, count: c.count })),
        vehicleTypes: vehicleTypeStats.map((v) => ({ name: v._id, count: v.count })),
        makes: cleanMakes,
        models: cleanModels,
        manufacturers: cleanManufacturers
      }
    });
  } catch (error) {
    logger.error('Error fetching search metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not load search metadata.'
    });
  }
};

/**
 * Return real recently added available parts from active, approved shops
 * @route GET /api/search/recent-parts
 */
export const getRecentAvailableParts = async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

    const activeShops = await Shop.find({ isApproved: true, isActive: true }, '_id name address').lean();
    const shopMap = new Map();
    activeShops.forEach((s) => shopMap.set(s._id.toString(), s));
    const activeShopIds = activeShops.map((s) => s._id);

    const parts = await SparePart.find({
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false,
      stockQuantity: { $gt: 0 },
      availabilityStatus: 'IN_STOCK'
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('partName partNumber category vehicleType price stockQuantity imagePaths manufacturer compatibleMakes compatibleModels shopId createdAt')
      .lean();

    const formatted = parts.map((part) => {
      const shop = shopMap.get(part.shopId.toString());
      return {
        ...part,
        shop: shop
          ? {
              _id: shop._id,
              name: shop.name,
              city: shop.address?.city,
              state: shop.address?.state
            }
          : null
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    logger.error('Error fetching recent available parts:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not load recent parts.'
    });
  }
};

/**
 * Geocode an address, city, or postal code using Nominatim with caching
 * @route GET /api/search/geocode
 */
export const geocodeAddress = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Location query parameter "q" is required.'
      });
    }

    const cleanQuery = q.trim().toLowerCase();

    // Check in-memory cache
    if (geocodeCache.has(cleanQuery)) {
      return res.status(200).json({
        success: true,
        data: geocodeCache.get(cleanQuery)
      });
    }

    try {
      const results = await queryNominatim(q.trim());
      if (!Array.isArray(results) || results.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Could not resolve geographical coordinates for "${q}". Please verify the location name or pick on the interactive map.`
        });
      }

      const top = results[0];
      const lat = parseFloat(top.lat);
      const lon = parseFloat(top.lon);

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(404).json({
          success: false,
          message: 'Received invalid coordinates from geocoding provider.'
        });
      }

      const locationData = {
        displayName: top.display_name,
        latitude: lat,
        longitude: lon,
        type: top.type,
        address: top.address || {}
      };

      // Store in cache
      if (geocodeCache.size >= MAX_CACHE_SIZE) {
        const firstKey = geocodeCache.keys().next().value;
        geocodeCache.delete(firstKey);
      }
      geocodeCache.set(cleanQuery, locationData);

      return res.status(200).json({
        success: true,
        data: locationData
      });
    } catch (apiErr) {
      logger.warn('Nominatim geocoding error or timeout:', apiErr.message);
      return res.status(502).json({
        success: false,
        message: 'Geocoding service is temporarily unreachable. Please try again or use browser location.'
      });
    }
  } catch (error) {
    logger.error('Geocoding route exception:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while resolving location.'
    });
  }
};

/**
 * Real Road Driving Route Calculator
 * @route GET /api/search/route
 */
export const getDirectionsRoute = async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    const oLat = parseFloat(originLat);
    const oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    // Strict coordinate validation
    if (
      isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng) ||
      oLat < -90 || oLat > 90 || dLat < -90 || dLat > 90 ||
      oLng < -180 || oLng > 180 || dLng < -180 || dLng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid origin and destination coordinates (originLat, originLng, destLat, destLng) are required.'
      });
    }

    const cacheKey = `${oLat.toFixed(4)},${oLng.toFixed(4)}-${dLat.toFixed(4)},${dLng.toFixed(4)}`;
    if (routeCache.has(cacheKey)) {
      return res.status(200).json({
        success: true,
        cached: true,
        data: routeCache.get(cacheKey)
      });
    }

    let osrmResponse;
    try {
      osrmResponse = await queryOsrmRoute(oLat, oLng, dLat, dLng);
    } catch (osrmErr) {
      logger.warn('OSRM routing service error or timeout:', osrmErr.message);
      return res.status(502).json({
        success: false,
        message: 'Routing service is temporarily unreachable. Please check connection and retry.'
      });
    }

    if (!osrmResponse || osrmResponse.code !== 'Ok' || !Array.isArray(osrmResponse.routes) || osrmResponse.routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No road route could be calculated between these coordinates. The destinations may be separated by water or off-road terrain.'
      });
    }

    const primaryRoute = osrmResponse.routes[0];
    const distanceMeters = primaryRoute.distance;
    const durationSeconds = primaryRoute.duration;
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationMinutes = Math.round(durationSeconds / 60);

    const routeData = {
      provider: 'OSRM (Open Source Routing Machine)',
      distanceKm,
      distanceMeters: Math.round(distanceMeters),
      durationMinutes,
      durationSeconds: Math.round(durationSeconds),
      geometry: primaryRoute.geometry, // GeoJSON LineString: { type: 'LineString', coordinates: [[lng, lat], ...] }
      waypoints: osrmResponse.waypoints || [],
      steps: primaryRoute.legs?.[0]?.steps?.map(step => ({
        name: step.name || 'Road',
        distanceMeters: Math.round(step.distance),
        durationSeconds: Math.round(step.duration),
        instruction: step.maneuver?.type || 'turn',
        modifier: step.maneuver?.modifier
      })) || []
    };

    if (routeCache.size >= MAX_ROUTE_CACHE_SIZE) {
      const firstKey = routeCache.keys().next().value;
      routeCache.delete(firstKey);
    }
    routeCache.set(cacheKey, routeData);

    return res.status(200).json({
      success: true,
      data: routeData
    });
  } catch (error) {
    logger.error('Directions route exception:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate directions route.'
    });
  }
};

/**
 * Search auto-complete suggestions from verified catalog
 * @route GET /api/search/suggestions
 */
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(200).json({
        success: true,
        data: { suggestions: [] }
      });
    }

    const cleanQ = q.trim();
    if (cleanQ.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Search query cannot exceed 80 characters.'
      });
    }

    const activeShops = await Shop.find({ isApproved: true, isActive: true }).select('_id').lean();
    const activeShopIds = activeShops.map((s) => s._id);

    const regex = new RegExp(escapeRegex(cleanQ), 'i');

    const matchingParts = await SparePart.find({
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false,
      isModerated: false,
      $or: [
        { partName: regex },
        { partNumber: regex },
        { manufacturer: regex },
        { category: regex },
        { barcode: regex }
      ]
    })
      .select('partName partNumber manufacturer category barcode vehicleType price stockQuantity imagePaths')
      .limit(20)
      .lean();

    const suggestions = [];
    const seen = new Set();

    for (const part of matchingParts) {
      if (part.partName && !seen.has(`part:${part.partName.toLowerCase()}`)) {
        seen.add(`part:${part.partName.toLowerCase()}`);
        suggestions.push({
          type: 'part',
          title: part.partName,
          text: part.partName,
          subtitle: `${part.manufacturer || 'OEM'} • ₹${part.price} (${part.vehicleType})`,
          value: part.partName,
          partId: part._id
        });
      }

      if (part.partNumber && part.partNumber.toLowerCase().includes(cleanQ.toLowerCase()) && !seen.has(`pn:${part.partNumber.toLowerCase()}`)) {
        seen.add(`pn:${part.partNumber.toLowerCase()}`);
        suggestions.push({
          type: 'part_number',
          title: part.partNumber,
          text: part.partNumber,
          subtitle: `Part # for ${part.partName}`,
          value: part.partNumber,
          partId: part._id
        });
      }

      if (part.barcode && part.barcode.toLowerCase().includes(cleanQ.toLowerCase()) && !seen.has(`bc:${part.barcode.toLowerCase()}`)) {
        seen.add(`bc:${part.barcode.toLowerCase()}`);
        suggestions.push({
          type: 'barcode',
          title: part.barcode,
          text: part.barcode,
          subtitle: `Barcode for ${part.partName}`,
          value: part.barcode,
          partId: part._id
        });
      }

      if (part.manufacturer && part.manufacturer.toLowerCase().includes(cleanQ.toLowerCase()) && !seen.has(`brand:${part.manufacturer.toLowerCase()}`)) {
        seen.add(`brand:${part.manufacturer.toLowerCase()}`);
        suggestions.push({
          type: 'brand',
          title: part.manufacturer,
          text: part.manufacturer,
          subtitle: 'Manufacturer / Brand',
          value: part.manufacturer
        });
      }

      if (part.category && part.category.toLowerCase().includes(cleanQ.toLowerCase()) && !seen.has(`cat:${part.category.toLowerCase()}`)) {
        seen.add(`cat:${part.category.toLowerCase()}`);
        suggestions.push({
          type: 'category',
          title: part.category,
          text: part.category,
          subtitle: 'Category',
          value: part.category
        });
      }

      if (suggestions.length >= 10) break;
    }

    return res.status(200).json({
      success: true,
      data: {
        query: cleanQ,
        total: suggestions.length,
        suggestions: suggestions.slice(0, 10)
      }
    });
  } catch (error) {
    logger.error('Error in getSearchSuggestions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve search suggestions.'
    });
  }
};

/**
 * Identifier search: Barcode, Part Number, or Alternate Part Number
 * @route GET /api/search/identifier
 */
export const searchByIdentifier = async (req, res) => {
  try {
    const rawCode = req.query.code || req.query.identifier || req.query.barcode || req.query.partNumber;
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Identifier code is required.'
      });
    }

    const cleanCode = rawCode.trim();
    if (cleanCode.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Identifier code cannot exceed 80 characters.'
      });
    }

    const activeShops = await Shop.find({ isApproved: true, isActive: true })
      .select('_id name category address contact images isApproved isActive')
      .lean();
    const activeShopIds = activeShops.map((s) => s._id);
    const shopMap = new Map();
    activeShops.forEach((s) => shopMap.set(s._id.toString(), s));

    const baseFilter = {
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false,
      isModerated: false
    };

    let matchedParts = [];
    let matchType = 'none';

    // 0. Check if code is a valid MongoDB Product ID (from QR code)
    if (mongoose.isValidObjectId(cleanCode)) {
      matchedParts = await SparePart.find({
        ...baseFilter,
        _id: cleanCode
      }).lean();
      if (matchedParts.length > 0) {
        matchType = 'product_id';
      }
    }

    // 1. Check exact barcode match
    if (matchedParts.length === 0) {
      matchedParts = await SparePart.find({
        ...baseFilter,
        barcode: cleanCode
      }).lean();
      if (matchedParts.length > 0) {
        matchType = 'barcode';
      }
    }

    // 2. If no barcode match, check partNumber
    if (matchedParts.length === 0) {
      matchedParts = await SparePart.find({
        ...baseFilter,
        partNumber: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i')
      }).lean();
      matchType = 'part_number';
    }

    // 3. If still no match, check manufacturerPartNumber
    if (matchedParts.length === 0) {
      matchedParts = await SparePart.find({
        ...baseFilter,
        manufacturerPartNumber: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i')
      }).lean();
      matchType = 'manufacturer_part_number';
    }

    // 4. If still no match, check alternatePartNumbers
    if (matchedParts.length === 0) {
      matchedParts = await SparePart.find({
        ...baseFilter,
        alternatePartNumbers: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i')
      }).lean();
      matchType = 'alternate_part_number';
    }

    if (matchedParts.length === 0) {
      return res.status(404).json({
        success: false,
        matched: false,
        matchType: 'none',
        query: cleanCode,
        message: `No active spare part found matching identifier "${cleanCode}".`,
        parts: []
      });
    }

    const populatedParts = matchedParts.map((p) => {
      const shop = shopMap.get(p.shopId.toString()) || null;
      return {
        ...p,
        shop
      };
    });

    const primaryPart = populatedParts[0];

    return res.status(200).json({
      success: true,
      matched: true,
      matchType,
      query: cleanCode,
      count: populatedParts.length,
      parts: populatedParts,
      data: {
        ...primaryPart,
        matchedBy: matchType,
        parts: populatedParts
      }
    });
  } catch (error) {
    logger.error('Error in searchByIdentifier:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search by identifier.'
    });
  }
};

/**
 * Image-based Spare Part Identification & Search
 * @route POST /api/search/image
 */
export const searchByImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file uploaded. Please upload a valid image (JPEG, PNG, WebP).'
    });
  }

  const uploadedPath = req.file.path;

  try {
    const analysis = await analyzeImageForPart({
      filePath: uploadedPath,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    const activeShops = await Shop.find({ isApproved: true, isActive: true }).select('_id').lean();
    const activeShopIds = activeShops.map((s) => s._id);

    const orClauses = [];
    if (analysis.probablePartName) {
      orClauses.push({ partName: new RegExp(escapeRegex(analysis.probablePartName), 'i') });
    }
    if (analysis.suggestedCategory && analysis.suggestedCategory !== 'Other') {
      orClauses.push({ category: new RegExp(escapeRegex(analysis.suggestedCategory), 'i') });
    }
    if (Array.isArray(analysis.keywords)) {
      analysis.keywords.forEach((kw) => {
        if (kw && kw.trim()) {
          orClauses.push({ partName: new RegExp(escapeRegex(kw.trim()), 'i') });
          orClauses.push({ category: new RegExp(escapeRegex(kw.trim()), 'i') });
        }
      });
    }

    if (orClauses.length === 0) {
      orClauses.push({ partName: /.*/ });
    }

    const query = {
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false,
      isModerated: false,
      $or: orClauses
    };

    if (analysis.vehicleType) {
      query.vehicleType = analysis.vehicleType;
    }

    const matchedParts = await SparePart.find(query)
      .populate('shopId', 'name category address.city address.state contact.phone images')
      .limit(12)
      .lean();

    return res.status(200).json({
      success: true,
      isAiPowered: analysis.isAiPowered,
      providerMode: analysis.providerMode,
      analysis: {
        probablePartName: analysis.probablePartName,
        suggestedCategory: analysis.suggestedCategory,
        vehicleType: analysis.vehicleType,
        keywords: analysis.keywords
      },
      count: matchedParts.length,
      parts: matchedParts,
      data: {
        parts: matchedParts,
        analysis,
        suggestedTerms: analysis.keywords || [],
        count: matchedParts.length
      }
    });
  } catch (error) {
    logger.error('Error in searchByImage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process image search.'
    });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      try {
        fs.unlinkSync(uploadedPath);
        logger.debug(`Deleted temp search image: ${uploadedPath}`);
      } catch (cleanupErr) {
        logger.warn(`Could not delete temp search image: ${cleanupErr.message}`);
      }
    }
  }
};
