import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Subscription from '../models/Subscription.js';
import { logger } from '../utils/logger.js';
import { cleanupUploadedFiles, deleteUploadedFile } from '../utils/upload.js';
import { calculateDistanceKm } from '../utils/distance.js';

/**
 * Public listing of approved and active shops only
 * Excludes pending, draft, and rejected shops
 * Includes available products count, distance calculation, and part availability
 * @route GET /api/shops
 */
export const getPublicShops = async (req, res, next) => {
  try {
    const { category, city, search, partQuery, latitude, longitude, radiusKm, page = 1, limit = 12 } = req.query;

    // Strict filter: only approved and active shops are listed publicly
    const query = {
      isApproved: true,
      isActive: true
    };

    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }

    if (city && city.trim() !== '') {
      query['address.city'] = new RegExp(city.trim(), 'i');
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { 'address.city': searchRegex },
        { 'address.addressLine': searchRegex }
      ];
    }

    // Optional Part Search Filter: find shop IDs that stock the matching spare part
    let matchingShopIds = null;
    if (partQuery && partQuery.trim()) {
      const partRegex = new RegExp(partQuery.trim(), 'i');
      const parts = await SparePart.find({
        isPublished: true,
        isArchived: false,
        stockQuantity: { $gt: 0 },
        $or: [
          { partName: partRegex },
          { partNumber: partRegex },
          { category: partRegex },
          { manufacturer: partRegex }
        ]
      }).select('shopId').lean();

      matchingShopIds = [...new Set(parts.map((p) => p.shopId.toString()))];
      query._id = { $in: matchingShopIds };
    }

    const hasCoords =
      latitude !== undefined &&
      longitude !== undefined &&
      latitude !== '' &&
      longitude !== '' &&
      !isNaN(Number(latitude)) &&
      !isNaN(Number(longitude));

    const userLat = hasCoords ? Number(latitude) : null;
    const userLng = hasCoords ? Number(longitude) : null;
    const maxRadius = radiusKm ? Number(radiusKm) : null;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    let rawShops = await Shop.find(query)
      .populate('ownerId', 'name') // Only expose owner's display name, NOT private email or phone
      .sort({ approvedAt: -1, createdAt: -1 })
      .lean();

    // Attach published & in-stock product count for each shop
    const shopIds = rawShops.map((s) => s._id);
    const partCounts = await SparePart.aggregate([
      {
        $match: {
          shopId: { $in: shopIds },
          isPublished: true,
          isArchived: false,
          availabilityStatus: 'IN_STOCK'
        }
      },
      {
        $group: {
          _id: '$shopId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = new Map();
    partCounts.forEach((pc) => countMap.set(pc._id.toString(), pc.count));

    let shops = rawShops.map((shop) => {
      const shopLng = shop.address?.location?.coordinates?.[0] ?? shop.longitude ?? null;
      const shopLat = shop.address?.location?.coordinates?.[1] ?? shop.latitude ?? null;

      let distanceKm = null;
      if (hasCoords && shopLat !== null && shopLng !== null) {
        distanceKm = calculateDistanceKm(userLat, userLng, shopLat, shopLng);
      }

      return {
        ...shop,
        latitude: shopLat,
        longitude: shopLng,
        distanceKm,
        availableProductsCount: countMap.get(shop._id.toString()) || 0
      };
    });

    // If coordinates were supplied, filter by radius if requested and sort by nearest distance
    if (hasCoords) {
      if (maxRadius && !isNaN(maxRadius)) {
        shops = shops.filter((s) => s.distanceKm === null || s.distanceKm <= maxRadius);
      }
      shops.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    const total = shops.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedShops = shops.slice(skip, skip + limitNum);

    res.status(200).json({
      status: 'ok',
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      userLocation: hasCoords ? { latitude: userLat, longitude: userLng } : null,
      shops: paginatedShops
    });
  } catch (error) {
    logger.error('Error fetching public shops:', error);
    next(error);
  }
};

/**
 * Public retrieval of a single approved shop with catalog stats
 * @route GET /api/shops/:id
 */
export const getPublicShopById = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({
      _id: req.params.id,
      isApproved: true,
      isActive: true
    })
      .populate('ownerId', 'name') // Safe projection: only owner name
      .lean();

    if (!shop) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop not found or not approved for public discovery.'
      });
    }

    // Get active part count for this shop
    const availableProductsCount = await SparePart.countDocuments({
      shopId: shop._id,
      isPublished: true,
      isArchived: false,
      availabilityStatus: 'IN_STOCK'
    });

    res.status(200).json({
      status: 'ok',
      shop: {
        ...shop,
        availableProductsCount
      }
    });
  } catch (error) {
    logger.error('Error fetching single public shop:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner views their own shop profile and status
 * @route GET /api/shops/my
 */
export const getMyApprovedShop = async (req, res, next) => {
  try {
    let shop = await Shop.findOne({ ownerId: req.user._id });
    let application = await ShopApplication.findOne({ ownerId: req.user._id });

    // Check if owner has an active subscription accepted by admin
    const activeSub = await Subscription.findOne({
      ownerId: req.user._id,
      status: 'ACTIVE',
      expiryDate: { $gt: new Date() }
    });
    const hasActiveSub = !!activeSub;

    if (!application) {
      application = await ShopApplication.create({
        ownerId: req.user._id,
        shopName: req.user?.name ? `${req.user.name}'s Auto Spares` : 'Auto Spares Shop',
        ownerFullName: req.user?.name || 'Store Owner',
        ownerPhone: req.user?.phone || '9999999999',
        businessEmail: req.user?.email || 'shop@exactspare.com',
        shopDescription: 'Automotive spare parts retail shop and accessories.',
        addressLine: 'Main Road',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500001',
        country: 'India',
        latitude: 17.3850,
        longitude: 78.4867,
        openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
        shopCategory: 'MULTI_CATEGORY',
        status: 'APPROVED',
        directActivated: true,
        submittedAt: new Date(),
        reviewedAt: new Date()
      });
    }

    if (!shop) {
      // Auto-create shop for owner if not already present
      const defaultName = application?.shopName || (req.user?.name ? `${req.user.name}'s Auto Spares` : 'Auto Spares Shop');
      const defaultDesc = application?.shopDescription || `${defaultName} - genuine spare parts and accessories.`;
      const defaultPhone = application?.ownerPhone || req.user?.phone || '9999999999';
      const defaultEmail = application?.businessEmail || req.user?.email || 'shop@exactspare.com';
      const defaultCity = application?.city || 'Hyderabad';
      const defaultState = application?.state || 'Telangana';
      const defaultAddress = application?.addressLine || 'Main Road';
      const defaultPostal = application?.postalCode || '500001';
      const defaultCategory = application?.shopCategory || 'MULTI_CATEGORY';
      const lat = application?.latitude || 17.3850;
      const lng = application?.longitude || 78.4867;

      shop = await Shop.create({
        ownerId: req.user._id,
        applicationId: application._id,
        name: defaultName,
        category: defaultCategory,
        description: defaultDesc,
        address: {
          addressLine: defaultAddress,
          city: defaultCity,
          state: defaultState,
          postalCode: defaultPostal,
          location: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        },
        contact: {
          phone: defaultPhone,
          email: defaultEmail
        },
        openingHours: application?.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: application?.shopImagePaths || [],
        isApproved: true,
        isActive: hasActiveSub,
        approvedAt: new Date()
      });
    } else {
      let changed = false;
      if (!shop.applicationId && application?._id) {
        shop.applicationId = application._id;
        changed = true;
      }
      if (!shop.isApproved) {
        shop.isApproved = true;
        if (!shop.approvedAt) shop.approvedAt = new Date();
        changed = true;
      }
      if (shop.isActive !== hasActiveSub) {
        shop.isActive = hasActiveSub;
        changed = true;
      }
      if (changed) {
        await shop.save();
      }
    }

    if (application && application.status !== 'APPROVED') {
      application.status = 'APPROVED';
      await application.save();
    }

    // Compute inventory count for owner
    const totalParts = await SparePart.countDocuments({
      shopId: shop._id,
      isArchived: false
    });

    res.status(200).json({
      status: 'ok',
      hasShop: true,
      isApproved: true,
      isActive: hasActiveSub,
      hasActiveSubscription: hasActiveSub,
      applicationStatus: application?.status || 'APPROVED',
      shop,
      totalParts,
      application
    });
  } catch (error) {
    logger.error('Error fetching owner approved shop:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner updates their own shop profile details
 * @route PATCH /api/shops/my
 */
export const updateMyShop = async (req, res, next) => {
  try {
    let shop = await Shop.findOne({ ownerId: req.user._id });

    // Check if owner has an active subscription accepted by admin
    const activeSub = await Subscription.findOne({
      ownerId: req.user._id,
      status: 'ACTIVE',
      expiryDate: { $gt: new Date() }
    });
    const hasActiveSub = !!activeSub;

    const {
      name,
      shopName,
      description,
      category,
      phone,
      email,
      addressLine,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      openingHours,
      images,
      imagePaths
    } = req.body;

    if (!shop) {
      let app = await ShopApplication.findOne({ ownerId: req.user._id });
      if (!app) {
        app = await ShopApplication.create({
          ownerId: req.user._id,
          shopName: (name || shopName || req.user.name || 'Auto Spares Shop').trim(),
          ownerFullName: req.user.name || 'Store Owner',
          ownerPhone: phone || req.user.phone || '9999999999',
          businessEmail: email || req.user.email,
          shopDescription: description || 'Automotive spare parts retail shop and accessories.',
          addressLine: addressLine || 'Main Road',
          city: city || 'Hyderabad',
          state: state || 'Telangana',
          postalCode: postalCode || '500001',
          country: 'India',
          latitude: Number(latitude) || 17.3850,
          longitude: Number(longitude) || 78.4867,
          openingHours: openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
          shopCategory: category || 'MULTI_CATEGORY',
          status: 'APPROVED',
          directActivated: true,
          submittedAt: new Date(),
          reviewedAt: new Date()
        });
      }

      shop = await Shop.create({
        ownerId: req.user._id,
        applicationId: app._id,
        name: (name || shopName || req.user.name || 'Auto Spares Shop').trim(),
        category: category || 'MULTI_CATEGORY',
        description: description || 'Automotive spare parts retail shop',
        address: {
          addressLine: addressLine || 'Main Road',
          city: city || 'Hyderabad',
          state: state || 'Telangana',
          postalCode: postalCode || '500001',
          location: {
            type: 'Point',
            coordinates: [Number(longitude) || 78.4867, Number(latitude) || 17.3850]
          }
        },
        contact: {
          phone: phone || req.user.phone || '9999999999',
          email: email || req.user.email
        },
        openingHours: openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: images || imagePaths || [],
        isApproved: true,
        isActive: hasActiveSub,
        approvedAt: new Date()
      });
    }

    // Security guard: Disallow modification of administrative and tenant fields
    const disallowedFields = ['isApproved', 'isActive', 'ownerId', 'applicationId', 'approvedAt', '_id'];
    disallowedFields.forEach((field) => {
      delete req.body[field];
    });

    shop.isApproved = true;
    shop.isActive = hasActiveSub;

    // Field updates with validation
    if (name || shopName) {
      shop.name = (name || shopName).trim();
    }

    if (description) {
      shop.description = description.trim();
    }

    if (category) {
      shop.category = category;
    }

    if (phone) {
      if (!shop.contact) shop.contact = {};
      shop.contact.phone = phone.trim();
    }

    if (email) {
      if (!shop.contact) shop.contact = {};
      shop.contact.email = email.trim();
    }

    if (!shop.address) shop.address = {};

    if (addressLine) shop.address.addressLine = addressLine.trim();
    if (city) shop.address.city = city.trim();
    if (state) shop.address.state = state.trim();
    if (postalCode) shop.address.postalCode = postalCode.trim();

    // Geolocation coordinates update with strict validation
    if (latitude !== undefined || longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Invalid coordinates. Latitude must be between -90 and 90, and Longitude between -180 and 180.'
        });
      }
      shop.address.location = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }

    if (openingHours) {
      shop.openingHours = openingHours.trim();
    }

    if (images || imagePaths) {
      const imgList = Array.isArray(images || imagePaths) ? images || imagePaths : [];
      shop.images = imgList.slice(0, 5);
    }

    await shop.save();
    logger.info(`Shop updated successfully by owner ${req.user.email} (Shop ID: ${shop._id})`);

    res.status(200).json({
      status: 'ok',
      message: 'Shop information updated successfully.',
      shop
    });
  } catch (error) {
    logger.error('Error updating owner shop:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner updates shop location and GPS coordinates
 * @route PATCH /api/shops/my/location
 */
export const updateMyShopLocation = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });

    if (!shop) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'No shop record found for your account.'
      });
    }

    if (!shop.isApproved || !shop.isActive) {
      shop.isApproved = true;
      shop.isActive = true;
      await shop.save();
    }

    const { latitude, longitude, addressLine, city, state, postalCode } = req.body;
    const errors = [];

    if (latitude === undefined || latitude === null || latitude === '' || isNaN(Number(latitude))) {
      errors.push('Valid numerical latitude is required.');
    } else {
      const lat = Number(latitude);
      if (lat < -90 || lat > 90) {
        errors.push('Latitude must be between -90.0 and 90.0 degrees.');
      }
    }

    if (longitude === undefined || longitude === null || longitude === '' || isNaN(Number(longitude))) {
      errors.push('Valid numerical longitude is required.');
    } else {
      const lng = Number(longitude);
      if (lng < -180 || lng > 180) {
        errors.push('Longitude must be between -180.0 and 180.0 degrees.');
      }
    }

    if (addressLine !== undefined && typeof addressLine === 'string' && !addressLine.trim()) {
      errors.push('Address line cannot be empty.');
    }
    if (city !== undefined && typeof city === 'string' && !city.trim()) {
      errors.push('City cannot be empty.');
    }
    if (state !== undefined && typeof state === 'string' && !state.trim()) {
      errors.push('State cannot be empty.');
    }
    if (postalCode !== undefined && typeof postalCode === 'string' && !postalCode.trim()) {
      errors.push('Postal code cannot be empty.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Location validation failed.',
        errors
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!shop.address) shop.address = {};
    if (addressLine && typeof addressLine === 'string') shop.address.addressLine = addressLine.trim();
    if (city && typeof city === 'string') shop.address.city = city.trim();
    if (state && typeof state === 'string') shop.address.state = state.trim();
    if (postalCode && typeof postalCode === 'string') shop.address.postalCode = postalCode.trim();

    // Store in GeoJSON format: [longitude, latitude]
    shop.address.location = {
      type: 'Point',
      coordinates: [lng, lat]
    };

    await shop.save();
    logger.info(`Shop location updated for shop ${shop._id} by owner ${req.user.email} (Coordinates: [${lng}, ${lat}])`);

    res.status(200).json({
      status: 'ok',
      message: 'Shop location and GPS coordinates saved successfully.',
      data: {
        address: shop.address,
        latitude: lat,
        longitude: lng
      },
      shop
    });
  } catch (error) {
    logger.error('Error updating shop location:', error);
    next(error);
  }
};

/**
 * Upload additional/replacement shop photographs
 * @route POST /api/shops/my/images
 */
export const uploadMyShopImages = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id, isApproved: true });

    if (!shop) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Only approved shop owners can upload shop photographs.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'No image files provided.'
      });
    }

    const newPaths = req.files.map((file) => `/uploads/shops/${file.filename}`);
    const combinedImages = [...(shop.images || []), ...newPaths].slice(0, 5);

    shop.images = combinedImages;
    await shop.save();

    logger.info(`Uploaded ${newPaths.length} photographs for shop ${shop._id}`);

    res.status(200).json({
      status: 'ok',
      message: 'Shop photographs uploaded successfully.',
      images: shop.images
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    logger.error('Error uploading shop images:', error);
    next(error);
  }
};

/**
 * Delete a specific shop photograph
 * @route DELETE /api/shops/my/images
 */
export const deleteMyShopImage = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id, isApproved: true });

    if (!shop) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Only approved shop owners can manage shop photographs.'
      });
    }

    const imagePath = req.body?.imagePath || req.query?.imagePath;
    if (!imagePath) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Image path or filename is required for deletion.'
      });
    }

    shop.images = (shop.images || []).filter(img => img !== imagePath && !img.endsWith(imagePath));
    await shop.save();

    logger.info(`Deleted image ${imagePath} from shop ${shop._id}`);

    res.status(200).json({
      status: 'ok',
      message: 'Shop photograph removed successfully.',
      images: shop.images
    });
  } catch (error) {
    logger.error('Error deleting shop image:', error);
    next(error);
  }
};

/**
 * Admin endpoint: suspend or reactivate a shop
 * Suspending removes shop from public discovery without deleting records or orders
 * @route PATCH /api/admin/shops/:id/status
 */
export const updateShopStatusAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Field "isActive" must be a boolean value.'
      });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop not found.'
      });
    }

    shop.isActive = isActive;
    await shop.save();

    logger.info(`Admin ${req.user.email} changed shop ${shop._id} isActive to ${isActive}`);

    res.status(200).json({
      status: 'ok',
      message: `Shop has been ${isActive ? 'activated' : 'suspended'} successfully.`,
      shop
    });
  } catch (error) {
    logger.error('Error updating shop status by admin:', error);
    next(error);
  }
};
