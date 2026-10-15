import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import { logger } from '../utils/logger.js';
import { cleanupUploadedFiles, deleteUploadedFile } from '../utils/upload.js';

/**
 * Public listing of approved and active shops only
 * Excludes pending, draft, and rejected shops
 * Includes available products count
 * @route GET /api/shops
 */
export const getPublicShops = async (req, res, next) => {
  try {
    const { category, city, search, page = 1, limit = 12 } = req.query;

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

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [rawShops, total] = await Promise.all([
      Shop.find(query)
        .populate('ownerId', 'name') // Only expose owner's display name, NOT private email or phone
        .sort({ approvedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Shop.countDocuments(query)
    ]);

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

    const shops = rawShops.map((shop) => ({
      ...shop,
      availableProductsCount: countMap.get(shop._id.toString()) || 0
    }));

    res.status(200).json({
      status: 'ok',
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      shops
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
    const shop = await Shop.findOne({ ownerId: req.user._id });
    const application = await ShopApplication.findOne({ ownerId: req.user._id });

    if (!shop) {
      return res.status(200).json({
        status: 'ok',
        hasShop: false,
        isApproved: false,
        applicationStatus: application ? application.status : 'NOT_SUBMITTED',
        message: application
          ? `Your shop application status is currently ${application.status}. Once approved by an administrator, your shop dashboard will become fully operational.`
          : 'You have not submitted a shop owner application yet. Please complete registration to start listing spare parts.',
        application
      });
    }

    if (!shop.isApproved) {
      return res.status(200).json({
        status: 'ok',
        hasShop: true,
        isApproved: false,
        isActive: shop.isActive,
        applicationStatus: application ? application.status : 'PENDING',
        message: 'Your shop is currently pending admin approval or has been suspended.',
        shop,
        application
      });
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
      isActive: shop.isActive,
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
    const shop = await Shop.findOne({ ownerId: req.user._id });

    if (!shop) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'No shop record found for your account. Please submit a shop owner application first.'
      });
    }

    if (!shop.isApproved) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Only approved shop owners are permitted to update shop details.'
      });
    }

    // Security guard: Disallow modification of administrative and tenant fields
    const disallowedFields = ['isApproved', 'isActive', 'ownerId', 'applicationId', 'approvedAt', '_id'];
    disallowedFields.forEach((field) => {
      delete req.body[field];
    });

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

    // Geolocation coordinates update
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        shop.address.location = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      }
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
