import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { calculateDistanceKm, DISTANCE_DISCLAIMER } from '../utils/distance.js';
import { logger } from '../utils/logger.js';
import https from 'https';

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
      isArchived: false
    };

    // In-stock availability
    const isInStockOnly = inStock === 'true' || inStock === true;
    if (isInStockOnly) {
      partQuery.availabilityStatus = 'IN_STOCK';
      partQuery.stockQuantity = { $gt: 0 };
    }

    // Vehicle Type
    if (vehicleType && vehicleType !== 'ALL') {
      partQuery.vehicleType = vehicleType;
    }

    // Category
    if (category && category !== 'ALL') {
      partQuery.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
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

    // General text search 'q' across relevant fields
    if (q && q.trim() !== '') {
      const qRegex = new RegExp(escapeRegex(q.trim()), 'i');
      partQuery.$or = [
        { partName: qRegex },
        { partNumber: qRegex },
        { manufacturer: qRegex },
        { category: qRegex },
        { description: qRegex },
        { compatibleMakes: qRegex },
        { compatibleModels: qRegex }
      ];
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
