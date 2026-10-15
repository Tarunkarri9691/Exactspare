import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { logger } from '../utils/logger.js';
import { cleanupUploadedFiles, deleteUploadedFile } from '../utils/upload.js';

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

    // 1. Identify all approved and active shops
    const activeShopFilter = { isApproved: true, isActive: true };
    if (shopId) {
      activeShopFilter._id = shopId;
    }

    const activeShops = await Shop.find(activeShopFilter, '_id');
    const activeShopIds = activeShops.map((s) => s._id);

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
 * Authenticated Shop Owner creates a new spare part listing
 * @route POST /api/parts
 */
export const createPart = async (req, res, next) => {
  try {
    // 1. Verify owner has an approved and active Shop
    const shop = await Shop.findOne({
      ownerId: req.user._id,
      isApproved: true,
      isActive: true
    });

    if (!shop) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Your shop must be verified and approved by an administrator before publishing spare part inventory.'
      });
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
      engineDetails = '',
      manufacturer,
      partNumber,
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
      engineDetails: engineDetails ? engineDetails.trim() : '',
      manufacturer: manufacturer.trim(),
      partNumber: partNumber.trim(),
      condition: condition.toUpperCase(),
      price: parsedPrice,
      stockQuantity: parsedStock,
      imagePaths,
      availabilityStatus,
      isPublished: publishedFlag,
      isArchived: false
    });

    await newPart.save();
    logger.info(`New spare part listing created: "${newPart.partName}" by owner ${req.user.email} (Part ID: ${newPart._id})`);

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
      status, // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'DRAFT' | 'PUBLISHED'
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

    if (status) {
      if (status === 'IN_STOCK') {
        query.availabilityStatus = 'IN_STOCK';
        query.stockQuantity = { $gt: 0 };
      } else if (status === 'OUT_OF_STOCK') {
        query.availabilityStatus = 'OUT_OF_STOCK';
      } else if (status === 'DRAFT') {
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
            },
            draftCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', false] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const stats = statsAggregation[0] || {
      totalParts: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      draftCount: 0
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
      condition,
      price,
      stockQuantity,
      isPublished,
      existingImages
    } = req.body;

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

    if (engineDetails !== undefined) {
      part.engineDetails = engineDetails.trim();
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
