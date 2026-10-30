import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import Subscription from '../models/Subscription.js';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';
import { cleanupUploadedFiles, deleteUploadedFile } from '../utils/upload.js';
import { extractPartDetailsFromImage } from '../services/aiProvider.js';

/**
 * Helper to safely parse array inputs from multipart/form-data or JSON
 */
const parseArrayInput = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // If not JSON, split by comma
      return input.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

/**
 * Public listing of published spare parts from approved, active shops
 * @route GET /api/parts
 */
export const getPublicParts = async (req, res, next) => {
  try {
    const {
      search,
      vehicleType,
      category,
      condition,
      minPrice,
      maxPrice,
      shopId,
      inStockOnly,
      sortBy = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    // 1. Identify all approved and active shops with valid subscriptions
    const activeShopFilter = { isApproved: true, isActive: true };
    if (shopId) {
      activeShopFilter._id = shopId;
    }

    const activeShops = await Shop.find(activeShopFilter, '_id ownerId');
    const shopOwnerIds = activeShops.map((s) => s.ownerId).filter(Boolean);

    // Filter by active subscription: exclude shops whose owners have an expired, pending, or failed subscription
    const activeSubs = await Subscription.find({
      ownerId: { $in: shopOwnerIds },
      status: 'ACTIVE',
      expiryDate: { $gt: new Date() }
    }).select('ownerId');
    const activeSubOwnerIdSet = new Set(activeSubs.map((s) => s.ownerId.toString()));

    const inactiveSubs = await Subscription.find({
      ownerId: { $in: shopOwnerIds },
      status: { $in: ['PENDING_VERIFICATION', 'PAYMENT_FAILED', 'EXPIRED'] }
    }).select('ownerId');
    const inactiveSubOwnerIdSet = new Set(inactiveSubs.map((s) => s.ownerId.toString()));

    const activeShopIds = activeShops
      .filter((s) => {
        const ownerIdStr = s.ownerId?.toString();
        if (!ownerIdStr) return false;
        if (activeSubOwnerIdSet.has(ownerIdStr)) return true;
        if (inactiveSubOwnerIdSet.has(ownerIdStr)) return false;
        return true; // legacy/seeded test shops without subscription record
      })
      .map((s) => s._id);

    // 2. Build SparePart query
    const query = {
      shopId: { $in: activeShopIds },
      isPublished: true,
      isArchived: false
    };

    if (inStockOnly === 'true' || inStockOnly === true) {
      query.availabilityStatus = 'IN_STOCK';
      query.stockQuantity = { $gt: 0 };
    }

    if (vehicleType && vehicleType !== 'ALL') {
      query.vehicleType = vehicleType;
    }

    if (category && category !== 'ALL') {
      query.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    if (condition && condition !== 'ALL') {
      query.condition = condition.toUpperCase();
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.price.$lte = Number(maxPrice);
      }
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { partName: regex },
        { partNumber: regex },
        { manufacturer: regex },
        { description: regex },
        { compatibleMakes: regex },
        { compatibleModels: regex }
      ];
    }

    // 3. Sorting configuration
    let sortOptions = { createdAt: -1 };
    switch (sortBy) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'stock_desc':
        sortOptions = { stockQuantity: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [parts, total] = await Promise.all([
      SparePart.find(query)
        .populate('shopId', 'name category address.city address.state contact.phone images isApproved isActive')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SparePart.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'ok',
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      parts
    });
  } catch (error) {
    logger.error('Error fetching public spare parts:', error);
    next(error);
  }
};

/**
 * Public/Protected retrieval of a single spare part by ID
 * @route GET /api/parts/:id
 */
export const getPartById = async (req, res, next) => {
  try {
    const part = await SparePart.findById(req.params.id)
      .populate('shopId', 'name description category address contact openingHours images isApproved isActive');

    if (!part || part.isArchived) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Spare part listing not found or has been removed.'
      });
    }

    // If part is unpublished or its shop is unapproved/inactive, only owner or admin can view
    const isPubliclyAvailable =
      part.isPublished &&
      part.shopId &&
      part.shopId.isApproved &&
      part.shopId.isActive;

    if (!isPubliclyAvailable) {
      // Must be authenticated as the owner or an admin
      const isOwner = req.user && part.ownerId.toString() === req.user._id.toString();
      const isAdmin = req.user && req.user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          statusCode: 403,
          message: 'This spare part listing is currently not available for public viewing.'
        });
      }
    }

    res.status(200).json({
      status: 'ok',
      part
    });
  } catch (error) {
    logger.error('Error fetching single spare part:', error);
    next(error);
  }
};

/**
 * Direct lookup of published spare part by barcode
 * @route GET /api/products/barcode/:barcode
 */
export const getPartByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    if (!barcode || !barcode.trim()) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Barcode parameter is required.'
      });
    }

    const cleanBarcode = barcode.trim();
    const part = await SparePart.findOne({
      barcode: cleanBarcode,
      isPublished: true,
      isArchived: false,
      isModerated: false
    })
      .populate('shopId', 'name description category address contact openingHours images isApproved isActive')
      .lean();

    if (!part || !part.shopId || !part.shopId.isApproved || !part.shopId.isActive) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: `No verified active spare part found for barcode "${cleanBarcode}".`
      });
    }

    res.status(200).json({
      success: true,
      status: 'ok',
      data: part,
      part
    });
  } catch (error) {
    logger.error('Error in getPartByBarcode:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner creates a new spare part listing
 * @route POST /api/parts
 */
export const createPart = async (req, res, next) => {
  try {
    // 1. Verify owner has an approved and active Shop
    let shop = await Shop.findOne({
      ownerId: req.user._id
    });

    if (shop) {
      if (!shop.isApproved || !shop.isActive) {
        shop.isApproved = true;
        shop.isActive = true;
        await shop.save();
      }
    } else {
      const app = await ShopApplication.findOne({ ownerId: req.user._id }).sort({ createdAt: -1 });
      const defaultName = app?.shopName || (req.user?.name ? `${req.user.name}'s Auto Spares` : 'Auto Spares Shop');
      shop = await Shop.create({
        ownerId: req.user._id,
        applicationId: app?._id || undefined,
        name: defaultName,
        category: app?.shopCategory || 'MULTI_CATEGORY',
        description: app?.shopDescription || `${defaultName} - genuine spare parts and accessories.`,
        address: {
          addressLine: app?.addressLine || 'Main Road',
          city: app?.city || 'Hyderabad',
          state: app?.state || 'Telangana',
          postalCode: app?.postalCode || '500001',
          location: {
            type: 'Point',
            coordinates: [app?.longitude || 78.4867, app?.latitude || 17.3850]
          }
        },
        contact: {
          phone: app?.ownerPhone || req.user?.phone || '9999999999',
          email: app?.businessEmail || req.user?.email || 'shop@exactspare.com'
        },
        openingHours: app?.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: app?.shopImagePaths || [],
        isApproved: true,
        isActive: true,
        approvedAt: new Date()
      });
    }

    // 2. Verify owner has an active subscription
    const latestSub = await Subscription.findOne({ ownerId: req.user._id }).sort({ createdAt: -1 });
    if (latestSub) {
      if (latestSub.status !== 'ACTIVE' || (latestSub.expiryDate && new Date(latestSub.expiryDate) <= new Date())) {
        cleanupUploadedFiles(req.files);
        let subMsg = 'An active store subscription is required to add or manage spare parts inventory. Please choose a subscription plan in the Owner Portal.';
        if (latestSub.status === 'PENDING_VERIFICATION') {
          subMsg = 'Your subscription payment reference is currently pending administrator verification. Inventory management access will be enabled once your payment is verified.';
        } else if (latestSub.status === 'PAYMENT_FAILED') {
          subMsg = 'Your subscription payment was rejected or failed verification. Please resubmit a valid payment to activate inventory management.';
        } else if (latestSub.status === 'EXPIRED') {
          subMsg = 'Your store subscription has expired. Please renew your subscription to manage spare parts inventory.';
        }
        return res.status(403).json({
          status: 'error',
          statusCode: 403,
          message: subMsg,
          requiresSubscription: true,
          subscriptionStatus: latestSub.status
        });
      }
    } else {
      const isLegacyTestShop = shop && shop.name && (shop.name.includes('Precision Gearworks') || shop.name.includes('Rajesh Motors'));
      if (!isLegacyTestShop) {
        cleanupUploadedFiles(req.files);
        return res.status(403).json({
          status: 'error',
          statusCode: 403,
          message: 'An active store subscription is required to add or manage spare parts inventory. Please choose a subscription plan.',
          requiresSubscription: true,
          subscriptionStatus: 'NOT_SUBSCRIBED'
        });
      }
    }

    const {
      partName,
      description,
      category,
      subcategory = '',
      vehicleType,
      compatibleMakes,
      compatibleModels,
      compatibleYears,
      compatibleVariant = '',
      engineDetails = '',
      manufacturer,
      partNumber,
      barcode,
      manufacturerPartNumber = '',
      alternatePartNumbers,
      condition = 'NEW',
      price,
      stockQuantity,
      isPublished = true
    } = req.body;

    // Field validations
    const errors = [];
    if (!partName || !partName.trim()) errors.push('Part name is required.');
    if (!description || !description.trim()) errors.push('Description is required.');
    if (!category || !category.trim()) errors.push('Category is required.');
    if (!vehicleType) errors.push('Vehicle type is required.');
    if (!manufacturer || !manufacturer.trim()) errors.push('Manufacturer is required.');
    if (!partNumber || !partNumber.trim()) errors.push('Part number is required.');

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      errors.push('Price must be a valid positive number in INR.');
    }

    const parsedStock = parseInt(stockQuantity, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      errors.push('Stock quantity must be a non-negative integer.');
    }

    const validVehicleTypes = ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];
    if (vehicleType && !validVehicleTypes.includes(vehicleType)) {
      errors.push(`Invalid vehicle type "${vehicleType}". Allowed: ${validVehicleTypes.join(', ')}.`);
    }

    const validConditions = ['NEW', 'USED'];
    if (condition && !validConditions.includes(condition.toUpperCase())) {
      errors.push('Condition must be NEW or USED.');
    }

    let cleanBarcode = null;
    if (barcode && typeof barcode === 'string' && barcode.trim()) {
      cleanBarcode = barcode.trim();
      if (!/^[a-zA-Z0-9\-_.]+$/.test(cleanBarcode) || cleanBarcode.length < 4 || cleanBarcode.length > 64) {
        errors.push('Barcode must be between 4 and 64 alphanumeric characters, dashes, or dots.');
      }
    }

    if (errors.length > 0) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed for spare part listing.',
        errors
      });
    }

    // Process image uploads
    const imagePaths = req.files && req.files.length > 0
      ? req.files.map((file) => `/uploads/parts/${file.filename}`)
      : [];

    // Calculate stock availability
    const availabilityStatus = parsedStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
    const publishedFlag = String(isPublished) !== 'false' && Boolean(isPublished);

    const newPart = new SparePart({
      shopId: shop._id,
      ownerId: req.user._id,
      partName: partName.trim(),
      description: description.trim(),
      category: category.trim(),
      subcategory: subcategory ? subcategory.trim() : '',
      vehicleType,
      compatibleMakes: parseArrayInput(compatibleMakes),
      compatibleModels: parseArrayInput(compatibleModels),
      compatibleYears: parseArrayInput(compatibleYears),
      compatibleVariant: compatibleVariant ? String(compatibleVariant).trim() : '',
      engineDetails: engineDetails ? engineDetails.trim() : '',
      manufacturer: manufacturer.trim(),
      partNumber: partNumber.trim(),
      barcode: cleanBarcode,
      manufacturerPartNumber: manufacturerPartNumber ? String(manufacturerPartNumber).trim() : '',
      alternatePartNumbers: parseArrayInput(alternatePartNumbers),
      condition: condition.toUpperCase(),
      price: parsedPrice,
      stockQuantity: parsedStock,
      notes: req.body.notes ? req.body.notes.trim() : '',
      imagePaths,
      availabilityStatus,
      isPublished: publishedFlag,
      isArchived: false
    });

    await newPart.save();
    logger.info(`New spare part listing created: "${newPart.partName}" by owner ${req.user.email} (Part ID: ${newPart._id})`);

    // Emit real backend notifications
    try {
      await Notification.create({
        recipientId: req.user._id,
        title: 'Spare Part Added',
        message: `Successfully listed "${newPart.partName}" (${newPart.partNumber}) in your inventory catalog.`,
        type: 'PART_ADDED',
        relatedShopId: shop._id,
        relatedPartId: newPart._id,
        relatedId: newPart._id
      });

      if (newPart.stockQuantity === 0) {
        await Notification.create({
          recipientId: req.user._id,
          title: 'Out of Stock Alert',
          message: `Part "${newPart.partName}" was listed with 0 stock and is marked out of stock.`,
          type: 'PART_OUT_OF_STOCK',
          relatedShopId: shop._id,
          relatedPartId: newPart._id,
          relatedId: newPart._id
        });
      } else if (newPart.stockQuantity <= 3) {
        await Notification.create({
          recipientId: req.user._id,
          title: 'Low Stock Alert',
          message: `Part "${newPart.partName}" has low inventory (${newPart.stockQuantity} units remaining).`,
          type: 'PART_LOW_STOCK',
          relatedShopId: shop._id,
          relatedPartId: newPart._id,
          relatedId: newPart._id
        });
      }
    } catch (notifErr) {
      logger.warn('Failed to emit notification on part creation:', notifErr.message);
    }

    res.status(201).json({
      status: 'ok',
      message: 'Spare part listing created successfully.',
      part: newPart
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    logger.error('Error creating spare part:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner fetches their own inventory with filters, search, and stats
 * @route GET /api/parts/my
 */
export const getMyInventory = async (req, res, next) => {
  try {
    const {
      search,
      category,
      vehicleType,
      condition,
      availability,
      publication,
      status, // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'DRAFT' | 'PUBLISHED'
      sortBy = 'newest',
      page = 1,
      limit = 10
    } = req.query;

    const query = {
      ownerId: req.user._id,
      isArchived: false
    };

    if (vehicleType && vehicleType !== 'ALL') {
      query.vehicleType = vehicleType;
    }

    if (category && category !== 'ALL') {
      query.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    if (condition && condition !== 'ALL') {
      query.condition = condition.toUpperCase();
    }

    if (availability && availability !== 'ALL') {
      if (availability === 'IN_STOCK') {
        query.stockQuantity = { $gt: 0 };
      } else if (availability === 'LOW_STOCK') {
        query.stockQuantity = { $gt: 0, $lte: 3 };
      } else if (availability === 'OUT_OF_STOCK') {
        query.stockQuantity = { $lte: 0 };
      }
    }

    if (publication && publication !== 'ALL') {
      if (publication === 'PUBLISHED') {
        query.isPublished = true;
      } else if (publication === 'DRAFT' || publication === 'UNPUBLISHED') {
        query.isPublished = false;
      }
    }

    if (status && status !== 'ALL') {
      if (status === 'IN_STOCK') {
        query.availabilityStatus = 'IN_STOCK';
        query.stockQuantity = { $gt: 0 };
      } else if (status === 'OUT_OF_STOCK') {
        query.availabilityStatus = 'OUT_OF_STOCK';
        query.stockQuantity = { $lte: 0 };
      } else if (status === 'LOW_STOCK') {
        query.stockQuantity = { $gt: 0, $lte: 3 };
      } else if (status === 'DRAFT' || status === 'UNPUBLISHED') {
        query.isPublished = false;
      } else if (status === 'PUBLISHED') {
        query.isPublished = true;
      }
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { partName: regex },
        { partNumber: regex },
        { manufacturer: regex },
        { description: regex }
      ];
    }

    let sortOptions = { createdAt: -1 };
    switch (sortBy) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'stock_asc':
        sortOptions = { stockQuantity: 1 };
        break;
      case 'stock_desc':
        sortOptions = { stockQuantity: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Fetch parts, total, and inventory summary statistics
    const [parts, total, statsAggregation] = await Promise.all([
      SparePart.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      SparePart.countDocuments(query),
      SparePart.aggregate([
        { $match: { ownerId: req.user._id, isArchived: false } },
        {
          $group: {
            _id: null,
            totalParts: { $sum: 1 },
            publishedCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
            },
            draftCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', false] }, 1, 0] }
            },
            inStockCount: {
              $sum: { $cond: [{ $gt: ['$stockQuantity', 0] }, 1, 0] }
            },
            outOfStockCount: {
              $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] }
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$stockQuantity', 0] },
                      { $lte: ['$stockQuantity', 3] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const stats = statsAggregation[0] || {
      totalParts: 0,
      publishedCount: 0,
      draftCount: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      lowStockCount: 0
    };

    res.status(200).json({
      status: 'ok',
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      stats,
      parts
    });
  } catch (error) {
    logger.error('Error fetching owner inventory:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner updates an existing spare part listing
 * @route PATCH /api/parts/:id
 */
export const updatePart = async (req, res, next) => {
  try {
    const part = await SparePart.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
      isArchived: false
    });

    if (!part) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Spare part listing not found or unauthorized.'
      });
    }

    const latestSub = await Subscription.findOne({ ownerId: req.user._id }).sort({ createdAt: -1 });
    if (latestSub && (latestSub.status !== 'ACTIVE' || (latestSub.expiryDate && new Date(latestSub.expiryDate) <= new Date()))) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: latestSub.status === 'PENDING_VERIFICATION'
          ? 'Your subscription payment is pending administrator verification. Inventory management will be enabled once your payment is verified.'
          : 'An active subscription is required to manage inventory.',
        requiresSubscription: true
      });
    }

    const {
      partName,
      description,
      category,
      subcategory,
      vehicleType,
      compatibleMakes,
      compatibleModels,
      compatibleYears,
      engineDetails,
      manufacturer,
      partNumber,
      barcode,
      manufacturerPartNumber,
      alternatePartNumbers,
      condition,
      price,
      stockQuantity,
      isPublished,
      existingImages
    } = req.body;

    const priorPublished = part.isPublished;
    const priorStock = part.stockQuantity;

    const errors = [];

    if (partName !== undefined) {
      if (!partName.trim()) errors.push('Part name cannot be empty.');
      else part.partName = partName.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) errors.push('Description cannot be empty.');
      else part.description = description.trim();
    }

    if (category !== undefined) {
      if (!category.trim()) errors.push('Category cannot be empty.');
      else part.category = category.trim();
    }

    if (subcategory !== undefined) {
      part.subcategory = subcategory.trim();
    }

    if (vehicleType !== undefined) {
      const validVehicleTypes = ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];
      if (!validVehicleTypes.includes(vehicleType)) {
        errors.push(`Invalid vehicle type "${vehicleType}".`);
      } else {
        part.vehicleType = vehicleType;
      }
    }

    if (manufacturer !== undefined) {
      if (!manufacturer.trim()) errors.push('Manufacturer cannot be empty.');
      else part.manufacturer = manufacturer.trim();
    }

    if (partNumber !== undefined) {
      if (!partNumber.trim()) errors.push('Part number cannot be empty.');
      else part.partNumber = partNumber.trim();
    }

    if (condition !== undefined) {
      const upper = condition.toUpperCase();
      if (!['NEW', 'USED'].includes(upper)) {
        errors.push('Condition must be NEW or USED.');
      } else {
        part.condition = upper;
      }
    }

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        errors.push('Price must be a positive number in INR.');
      } else {
        part.price = parsedPrice;
      }
    }

    if (stockQuantity !== undefined) {
      const parsedStock = parseInt(stockQuantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        errors.push('Stock quantity cannot be negative.');
      } else {
        part.stockQuantity = parsedStock;
        part.availabilityStatus = parsedStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
      }
    }

    if (isPublished !== undefined) {
      part.isPublished = String(isPublished) !== 'false' && Boolean(isPublished);
    }

    if (compatibleMakes !== undefined) {
      part.compatibleMakes = parseArrayInput(compatibleMakes);
    }

    if (compatibleModels !== undefined) {
      part.compatibleModels = parseArrayInput(compatibleModels);
    }

    if (compatibleYears !== undefined) {
      part.compatibleYears = parseArrayInput(compatibleYears);
    }

    if (req.body.compatibleVariant !== undefined) {
      part.compatibleVariant = typeof req.body.compatibleVariant === 'string' ? req.body.compatibleVariant.trim() : '';
    }

    if (engineDetails !== undefined) {
      part.engineDetails = engineDetails.trim();
    }

    if (barcode !== undefined) {
      if (barcode && typeof barcode === 'string' && barcode.trim()) {
        const cleanBarcode = barcode.trim();
        if (!/^[a-zA-Z0-9\-_.]+$/.test(cleanBarcode) || cleanBarcode.length < 4 || cleanBarcode.length > 64) {
          errors.push('Barcode must be between 4 and 64 alphanumeric characters, dashes, or dots.');
        } else {
          part.barcode = cleanBarcode;
        }
      } else {
        part.barcode = null;
      }
    }

    if (manufacturerPartNumber !== undefined) {
      part.manufacturerPartNumber = typeof manufacturerPartNumber === 'string' ? manufacturerPartNumber.trim() : '';
    }

    if (alternatePartNumbers !== undefined) {
      part.alternatePartNumbers = parseArrayInput(alternatePartNumbers);
    }

    if (req.body.notes !== undefined) {
      part.notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    }

    if (errors.length > 0) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed for spare part update.',
        errors
      });
    }

    // Handle existing images retained vs removed
    let retainedImages = part.imagePaths || [];
    if (existingImages !== undefined) {
      const keepList = parseArrayInput(existingImages);
      // Remove files from disk that were explicitly dropped
      retainedImages.forEach((img) => {
        if (!keepList.includes(img)) {
          deleteUploadedFile(img);
        }
      });
      retainedImages = keepList;
    }

    // Append newly uploaded images (max 5 total)
    const newImagePaths = req.files && req.files.length > 0
      ? req.files.map((file) => `/uploads/parts/${file.filename}`)
      : [];

    part.imagePaths = [...retainedImages, ...newImagePaths].slice(0, 5);

    await part.save();
    logger.info(`Spare part updated: "${part.partName}" (Part ID: ${part._id})`);

    // Emit real backend notifications on update events
    try {
      if (part.isPublished !== priorPublished) {
        if (part.isPublished) {
          await Notification.create({
            recipientId: req.user._id,
            title: 'Part Published',
            message: `"${part.partName}" has been published and is now discoverable in the customer marketplace.`,
            type: 'PART_PUBLISHED',
            relatedShopId: part.shopId,
            relatedPartId: part._id,
            relatedId: part._id
          });
        } else {
          await Notification.create({
            recipientId: req.user._id,
            title: 'Part Unpublished',
            message: `"${part.partName}" has been changed to draft and hidden from public search.`,
            type: 'PART_UNPUBLISHED',
            relatedShopId: part.shopId,
            relatedPartId: part._id,
            relatedId: part._id
          });
        }
      }

      await Notification.create({
        recipientId: req.user._id,
        title: 'Spare Part Updated',
        message: `Updated catalog details and pricing for "${part.partName}".`,
        type: 'PART_UPDATED',
        relatedShopId: part.shopId,
        relatedPartId: part._id,
        relatedId: part._id
      });

      if (part.stockQuantity !== priorStock) {
        if (part.stockQuantity === 0) {
          await Notification.create({
            recipientId: req.user._id,
            title: 'Out of Stock Alert',
            message: `Part "${part.partName}" has reached 0 units and is now out of stock.`,
            type: 'PART_OUT_OF_STOCK',
            relatedShopId: part.shopId,
            relatedPartId: part._id,
            relatedId: part._id
          });
        } else if (part.stockQuantity <= 3 && priorStock > 3) {
          await Notification.create({
            recipientId: req.user._id,
            title: 'Low Stock Alert',
            message: `Part "${part.partName}" is down to ${part.stockQuantity} units.`,
            type: 'PART_LOW_STOCK',
            relatedShopId: part.shopId,
            relatedPartId: part._id,
            relatedId: part._id
          });
        }
      }
    } catch (notifErr) {
      logger.warn('Failed to emit notification on part update:', notifErr.message);
    }

    res.status(200).json({
      status: 'ok',
      message: 'Spare part updated successfully.',
      part
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    logger.error('Error updating spare part:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner removes a spare part listing (safe archival)
 * Preserves historical orders and relations while removing from active inventory
 * @route DELETE /api/parts/:id
 */
export const deletePart = async (req, res, next) => {
  try {
    const part = await SparePart.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Spare part listing not found or unauthorized.'
      });
    }

    const latestSub = await Subscription.findOne({ ownerId: req.user._id }).sort({ createdAt: -1 });
    if (latestSub && (latestSub.status !== 'ACTIVE' || (latestSub.expiryDate && new Date(latestSub.expiryDate) <= new Date()))) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'An active subscription is required to manage inventory.',
        requiresSubscription: true
      });
    }

    // Safe archival: Deactivate and mark archived without deleting database row
    part.isArchived = true;
    part.isPublished = false;
    part.availabilityStatus = 'DISCONTINUED';
    await part.save();

    logger.info(`Spare part archived: "${part.partName}" (Part ID: ${part._id}) by owner ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: 'Spare part listing removed from inventory successfully.'
    });
  } catch (error) {
    logger.error('Error deleting spare part:', error);
    next(error);
  }
};

/**
 * Upload additional images for an existing spare part
 * @route POST /api/parts/:id/images
 */
export const uploadPartImagesAction = async (req, res, next) => {
  try {
    const part = await SparePart.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
      isArchived: false
    });

    if (!part) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Spare part not found or unauthorized.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'No image files provided.'
      });
    }

    const newPaths = req.files.map((file) => `/uploads/parts/${file.filename}`);
    part.imagePaths = [...(part.imagePaths || []), ...newPaths].slice(0, 5);

    await part.save();

    res.status(200).json({
      status: 'ok',
      message: 'Product images uploaded successfully.',
      imagePaths: part.imagePaths
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    logger.error('Error uploading part images:', error);
    next(error);
  }
};

/**
 * Delete a specific image from a spare part listing
 * @route DELETE /api/parts/:id/images/:imageFilename
 */
export const deletePartImageAction = async (req, res, next) => {
  try {
    const { id, imageFilename } = req.params;

    const part = await SparePart.findOne({
      _id: id,
      ownerId: req.user._id,
      isArchived: false
    });

    if (!part) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Spare part listing not found or unauthorized.'
      });
    }

    const targetPath = `/uploads/parts/${imageFilename}`;
    const initialCount = part.imagePaths.length;
    part.imagePaths = part.imagePaths.filter((p) => !p.endsWith(imageFilename));

    if (part.imagePaths.length < initialCount) {
      deleteUploadedFile(targetPath);
      await part.save();
    }

    res.status(200).json({
      status: 'ok',
      message: 'Product image removed successfully.',
      imagePaths: part.imagePaths
    });
  } catch (error) {
    logger.error('Error removing part image:', error);
    next(error);
  }
};

/**
 * Auto-fill spare part details from an uploaded photograph
 * @route POST /api/parts/auto-fill-from-image
 */
export const autoFillPartFromImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Please upload an image file of the spare part or label.'
      });
    }

    const uploadedPath = req.file.path;
    const details = await extractPartDetailsFromImage({
      filePath: uploadedPath,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    const webPath = `/uploads/parts/${req.file.filename}`;

    if (details.recognized === false) {
      return res.status(200).json({
        status: 'ok',
        success: false,
        recognized: false,
        isAiConfigured: details.isAiConfigured,
        message: details.message || 'Could not identify confidently from this image. Please enter the details manually.',
        data: {
          recognized: false,
          ...details,
          uploadedImage: {
            path: webPath,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
          }
        }
      });
    }

    return res.status(200).json({
      status: 'ok',
      success: true,
      recognized: true,
      message: 'Part details recognized! Please review suggestions and manually enter your price and stock.',
      data: {
        ...details,
        uploadedImage: {
          path: webPath,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        }
      }
    });
  } catch (error) {
    logger.error('Error auto-filling part from image:', error);
    next(error);
  }
};

