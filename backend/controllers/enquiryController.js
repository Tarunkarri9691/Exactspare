import mongoose from 'mongoose';
import Enquiry from '../models/Enquiry.js';
import Shop from '../models/Shop.js';
import SparePart from '../models/SparePart.js';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Customer creates an enquiry for a shop and optional spare part
 * @route POST /api/enquiries
 */
export const createEnquiry = async (req, res, next) => {
  try {
    const {
      shopId,
      sparePartId,
      subject,
      message,
      customerName,
      customerEmail,
      customerPhone,
      vehicleInfo
    } = req.body;

    const errors = [];

    if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
      errors.push('A valid shop ID is required.');
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length < 2) {
      errors.push('Subject must be at least 2 characters.');
    } else if (subject.trim().length > 200) {
      errors.push('Subject cannot exceed 200 characters.');
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      errors.push('Enquiry message must be at least 5 characters long.');
    } else if (message.trim().length > 2000) {
      errors.push('Message cannot exceed 2000 characters.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Validation failed for enquiry.',
        errors
      });
    }

    // Validate shop exists and is approved and active
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        status: 'error',
        statusCode: 404,
        message: 'Referenced shop does not exist.'
      });
    }

    if (!shop.isApproved || !shop.isActive) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Referenced shop is not active on the marketplace.'
      });
    }

    // If sparePartId is supplied, validate it belongs to this shop
    let sparePart = null;
    if (sparePartId) {
      if (!mongoose.Types.ObjectId.isValid(sparePartId)) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Invalid spare part ID provided.'
        });
      }

      sparePart = await SparePart.findById(sparePartId);
      if (!sparePart || sparePart.isArchived) {
        return res.status(404).json({
          status: 'error',
          statusCode: 404,
          message: 'The requested spare part was not found or has been removed.'
        });
      }

      if (sparePart.shopId.toString() !== shop._id.toString()) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Referenced spare part does not belong to the selected shop.'
        });
      }
    }

    const cleanName = (customerName && typeof customerName === 'string' && customerName.trim()) 
      || req.user.name 
      || 'Valued Customer';

    const cleanEmail = (customerEmail && typeof customerEmail === 'string' && customerEmail.trim()) 
      || req.user.email;

    const cleanPhone = (customerPhone && typeof customerPhone === 'string') 
      ? customerPhone.trim() 
      : (req.user.phone || '');

    const cleanVehicle = (vehicleInfo && typeof vehicleInfo === 'object') ? {
      make: (vehicleInfo.make || '').trim().slice(0, 60),
      model: (vehicleInfo.model || '').trim().slice(0, 60),
      year: (vehicleInfo.year || '').trim().slice(0, 20),
      variant: (vehicleInfo.variant || '').trim().slice(0, 60),
      compatibilityQuestion: (vehicleInfo.compatibilityQuestion || '').trim().slice(0, 500)
    } : {};

    const newEnquiry = new Enquiry({
      customerId: req.user._id,
      shopId: shop._id,
      ownerId: shop.ownerId,
      sparePartId: sparePart ? sparePart._id : null,
      customerName: cleanName,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      subject: subject.trim(),
      message: message.trim(),
      vehicleInfo: cleanVehicle,
      status: 'NEW',
      isReadByOwner: false,
      isReadByCustomer: true,
      replies: []
    });

    await newEnquiry.save();

    // Create real persistent notification for the shop owner
    try {
      const partNotice = sparePart ? ` regarding "${sparePart.partName}"` : '';
      await Notification.create({
        recipientId: shop.ownerId,
        title: 'New Customer Enquiry',
        message: `${cleanName} submitted an enquiry${partNotice}: "${subject.trim().slice(0, 80)}"`,
        type: 'CUSTOMER_ENQUIRY',
        relatedShopId: shop._id,
        relatedPartId: sparePart ? sparePart._id : null,
        relatedId: newEnquiry._id
      });
    } catch (notifErr) {
      logger.warn('Failed to emit notification on enquiry creation:', notifErr.message);
    }

    logger.info(`New enquiry created by customer ${req.user.email} for shop ${shop.name} (Enquiry ID: ${newEnquiry._id})`);

    res.status(201).json({
      success: true,
      status: 'ok',
      message: 'Your enquiry has been sent to the shop owner.',
      data: newEnquiry,
      enquiry: newEnquiry
    });
  } catch (error) {
    logger.error('Error creating enquiry:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner fetches their shop's enquiries with search, filters, pagination, and stats
 * @route GET /api/enquiries/owner
 */
export const getOwnerEnquiries = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;

    const query = { ownerId: req.user._id };

    if (status && status !== 'ALL') {
      const validStatuses = ['NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.status = status.toUpperCase();
      }
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { subject: searchRegex },
        { message: searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [enquiries, total, statsAgg] = await Promise.all([
      Enquiry.find(query)
        .populate('sparePartId', 'partName partNumber category imagePaths price condition availabilityStatus')
        .populate('shopId', 'name category address.city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Enquiry.countDocuments(query),
      Enquiry.aggregate([
        { $match: { ownerId: req.user._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newCount: { $sum: { $cond: [{ $eq: ['$status', 'NEW'] }, 1, 0] } },
            inProgressCount: { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
            repliedCount: { $sum: { $cond: [{ $eq: ['$status', 'REPLIED'] }, 1, 0] } },
            closedCount: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
            unreadCount: { $sum: { $cond: [{ $eq: ['$isReadByOwner', false] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = statsAgg[0] || {
      total: 0,
      newCount: 0,
      inProgressCount: 0,
      repliedCount: 0,
      closedCount: 0,
      unreadCount: 0
    };

    const formattedStats = {
      total: stats.total || 0,
      new: stats.newCount || 0,
      inProgress: stats.inProgressCount || 0,
      replied: stats.repliedCount || 0,
      closed: stats.closedCount || 0,
      unread: stats.unreadCount || 0
    };

    const formattedPagination = {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
      totalPages: Math.ceil(total / limitNum) || 1
    };

    res.status(200).json({
      success: true,
      status: 'ok',
      data: enquiries,
      enquiries,
      stats: formattedStats,
      pagination: formattedPagination
    });
  } catch (error) {
    logger.error('Error fetching owner enquiries:', error);
    next(error);
  }
};

/**
 * Authenticated Customer fetches their own submitted enquiries
 * @route GET /api/enquiries/my
 */
export const getCustomerEnquiries = async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find({ customerId: req.user._id })
      .populate('shopId', 'name category address contact images')
      .populate('sparePartId', 'partName partNumber category price imagePaths')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      status: 'ok',
      data: enquiries,
      enquiries,
      total: enquiries.length
    });
  } catch (error) {
    logger.error('Error fetching customer enquiries:', error);
    next(error);
  }
};

/**
 * View one enquiry with strict authorization checks
 * @route GET /api/enquiries/:id
 */
export const getEnquiryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Invalid enquiry ID.'
      });
    }

    const enquiry = await Enquiry.findById(id)
      .populate('shopId', 'name category address contact openingHours images')
      .populate('sparePartId', 'partName partNumber category price imagePaths condition availabilityStatus');

    if (!enquiry) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Enquiry not found.'
      });
    }

    // Authorization: Must be the customer who submitted or the shop owner who received it (or admin)
    const isOwner = enquiry.ownerId.toString() === req.user._id.toString();
    const isCustomer = enquiry.customerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isCustomer && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Access forbidden: You do not have permission to view this enquiry.'
      });
    }

    // Mark as read by owner if viewed by owner
    if (isOwner && !enquiry.isReadByOwner) {
      enquiry.isReadByOwner = true;
      if (enquiry.status === 'NEW') {
        enquiry.status = 'IN_PROGRESS';
      }
      await enquiry.save();
    }

    // Mark as read by customer if viewed by customer
    if (isCustomer && !enquiry.isReadByCustomer) {
      enquiry.isReadByCustomer = true;
      await enquiry.save();
    }

    res.status(200).json({
      success: true,
      status: 'ok',
      data: enquiry,
      enquiry
    });
  } catch (error) {
    logger.error('Error fetching enquiry by ID:', error);
    next(error);
  }
};

/**
 * Authenticated Shop Owner updates enquiry status (NEW, IN_PROGRESS, REPLIED, CLOSED)
 * @route PATCH /api/enquiries/:id/status
 */
export const updateEnquiryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Invalid enquiry ID.'
      });
    }

    const validStatuses = ['NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}.`
      });
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!enquiry) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Enquiry not found or access forbidden.'
      });
    }

    enquiry.status = status.toUpperCase();
    await enquiry.save();

    logger.info(`Enquiry ${enquiry._id} status updated to ${enquiry.status} by owner ${req.user.email}`);

    res.status(200).json({
      success: true,
      status: 'ok',
      message: `Enquiry status updated to ${enquiry.status}.`,
      data: enquiry,
      enquiry
    });
  } catch (error) {
    logger.error('Error updating enquiry status:', error);
    next(error);
  }
};

/**
 * Authenticated Owner or Customer replies to an existing enquiry
 * @route POST /api/enquiries/:id/reply
 */
export const replyToEnquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Invalid enquiry ID.'
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Reply message cannot be empty (minimum 2 characters).'
      });
    }

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Enquiry not found.'
      });
    }

    const isOwner = enquiry.ownerId.toString() === req.user._id.toString();
    const isCustomer = enquiry.customerId.toString() === req.user._id.toString();

    if (!isOwner && !isCustomer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Access forbidden: You cannot reply to another user\'s enquiry.'
      });
    }

    const senderRole = isOwner ? 'OWNER' : (isCustomer ? 'CUSTOMER' : 'ADMIN');

    const replyObj = {
      senderId: req.user._id,
      senderRole,
      senderName: req.user.name,
      message: message.trim(),
      createdAt: new Date()
    };

    enquiry.replies.push(replyObj);

    if (isOwner) {
      enquiry.status = 'REPLIED';
      enquiry.isReadByCustomer = false;
      enquiry.isReadByOwner = true;

      // Notify Customer
      try {
        await Notification.create({
          recipientId: enquiry.customerId,
          title: 'Shop Owner Replied to Your Enquiry',
          message: `The merchant responded regarding "${enquiry.subject}": "${message.trim().slice(0, 80)}"`,
          type: 'CUSTOMER_ENQUIRY',
          relatedShopId: enquiry.shopId,
          relatedPartId: enquiry.sparePartId || null,
          relatedId: enquiry._id
        });
      } catch (notifErr) {
        logger.warn('Failed to notify customer on reply:', notifErr.message);
      }
    } else {
      enquiry.status = 'IN_PROGRESS';
      enquiry.isReadByOwner = false;
      enquiry.isReadByCustomer = true;

      // Notify Owner
      try {
        await Notification.create({
          recipientId: enquiry.ownerId,
          title: 'Customer Reply Received',
          message: `${req.user.name} sent a follow-up on "${enquiry.subject}": "${message.trim().slice(0, 80)}"`,
          type: 'CUSTOMER_ENQUIRY',
          relatedShopId: enquiry.shopId,
          relatedPartId: enquiry.sparePartId || null,
          relatedId: enquiry._id
        });
      } catch (notifErr) {
        logger.warn('Failed to notify owner on reply:', notifErr.message);
      }
    }

    await enquiry.save();
    logger.info(`Reply appended to enquiry ${enquiry._id} by ${req.user.email} [${senderRole}]`);

    res.status(200).json({
      success: true,
      status: 'ok',
      message: 'Reply sent successfully.',
      data: enquiry,
      enquiry
    });
  } catch (error) {
    logger.error('Error replying to enquiry:', error);
    next(error);
  }
};
