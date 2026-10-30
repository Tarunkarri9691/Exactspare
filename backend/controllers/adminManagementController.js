import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Notification from '../models/Notification.js';
import { recalculateProductRatings } from './reviewController.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to record administrative actions into AdminAuditLog safely
 */
export const recordAdminAuditLog = async ({
  adminId,
  action,
  entityType,
  entityId,
  reason = '',
  metadata = {}
}) => {
  try {
    // Sanitize metadata to never include passwordHash, tokens, or private docs
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.password;
    delete sanitizedMetadata.passwordHash;
    delete sanitizedMetadata.token;
    delete sanitizedMetadata.secret;
    delete sanitizedMetadata.documents;

    await AdminAuditLog.create({
      adminId,
      action,
      entityType,
      entityId,
      reason: reason ? reason.trim() : '',
      metadata: sanitizedMetadata
    });
  } catch (err) {
    logger.warn('Failed to record admin audit log:', err.message);
  }
};

/* ========================================================
   1. SHOP MANAGEMENT CONTROLLERS
   ======================================================== */

/**
 * GET /api/admin/shops
 * List shops with filters (search, isApproved, isActive) & pagination
 */
export const getAdminShops = async (req, res, next) => {
  try {
    const {
      search = '',
      isApproved,
      isActive,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { 'contact.email': searchRegex },
        { 'contact.phone': searchRegex },
        { 'address.city': searchRegex },
        { 'address.state': searchRegex }
      ];
    }

    if (isApproved !== undefined && isApproved !== 'ALL') {
      query.isApproved = isApproved === 'true';
    }

    if (isActive !== undefined && isActive !== 'ALL') {
      query.isActive = isActive === 'true';
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [shops, total] = await Promise.all([
      Shop.find(query)
        .populate('ownerId', 'name email phone accountStatus createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Shop.countDocuments(query)
    ]);

    // Enhance with inventory & order counts
    const shopIds = shops.map((s) => s._id);
    const partCounts = await SparePart.aggregate([
      { $match: { shopId: { $in: shopIds }, isArchived: false } },
      { $group: { _id: '$shopId', count: { $sum: 1 } } }
    ]);

    const partCountMap = new Map();
    partCounts.forEach((p) => partCountMap.set(p._id.toString(), p.count));

    const enrichedShops = shops.map((s) => ({
      ...s,
      totalPartsListed: partCountMap.get(s._id.toString()) || 0
    }));

    return res.status(200).json({
      success: true,
      count: enrichedShops.length,
      data: {
        shops: enrichedShops,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin shops:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/shops/:id
 * Detailed shop view with owner info, application history, and inventory metrics
 */
export const getAdminShopDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID' });
    }

    const shop = await Shop.findById(id).populate('ownerId', '-passwordHash');
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const [application, partsCount, activePartsCount, ordersCount] = await Promise.all([
      ShopApplication.findOne({ shopId: shop._id }).select('-verificationDocuments'),
      SparePart.countDocuments({ shopId: shop._id, isArchived: false }),
      SparePart.countDocuments({ shopId: shop._id, isArchived: false, isPublished: true }),
      Order.countDocuments({ 'shops.shopId': shop._id })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        shop,
        application,
        stats: {
          totalParts: partsCount,
          activeParts: activePartsCount,
          totalOrders: ordersCount
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin shop details:', error.message);
    next(error);
  }
};

/**
 * PATCH /api/admin/shops/:id/status
 * Activate or deactivate a shop with reason, audit log, and owner notification
 */
export const updateAdminShopStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, reason = '' } = req.body;
    const adminId = req.user._id || req.user.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive boolean flag (true/false) is required'
      });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const previousState = shop.isActive;
    shop.isActive = isActive;

    if (!isActive) {
      shop.deactivationReason = reason.trim() || 'Administrative deactivation';
      shop.deactivatedBy = adminId;
      shop.deactivatedAt = new Date();
    } else {
      shop.deactivationReason = '';
      shop.deactivatedBy = undefined;
      shop.deactivatedAt = undefined;
    }

    await shop.save();

    // Record Audit Log
    const action = isActive ? 'SHOP_ACTIVATED' : 'SHOP_DEACTIVATED';
    await recordAdminAuditLog({
      adminId,
      action,
      entityType: 'SHOP',
      entityId: shop._id,
      reason: reason || (isActive ? 'Reactivated by admin' : 'Deactivated by admin'),
      metadata: {
        shopName: shop.name,
        previousState,
        newState: isActive
      }
    });

    // Notify the shop owner
    try {
      await Notification.create({
        recipientId: shop.ownerId,
        type: 'SHOP_STATUS_UPDATED',
        title: isActive ? 'Shop Listing Reactivated' : 'Shop Listing Suspended',
        message: isActive
          ? `Your shop "${shop.name}" has been reactivated by platform administration.`
          : `Your shop "${shop.name}" has been deactivated. Reason: ${reason || 'Terms of service compliance review'}.`,
        relatedShopId: shop._id
      });
    } catch (notifErr) {
      logger.warn('Failed to dispatch shop status notification:', notifErr.message);
    }

    logger.info(`Admin ${adminId} updated shop ${shop._id} isActive to ${isActive}`);

    return res.status(200).json({
      success: true,
      message: isActive ? 'Shop activated successfully' : 'Shop deactivated successfully',
      data: { shop }
    });
  } catch (error) {
    logger.error('Error updating shop status:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/shops/:id/parts
 * Inspect spare parts belonging to a specific shop
 */
export const getAdminShopParts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [parts, total] = await Promise.all([
      SparePart.find({ shopId: id, isArchived: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SparePart.countDocuments({ shopId: id, isArchived: false })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        parts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin shop parts:', error.message);
    next(error);
  }
};

/* ========================================================
   2. USER MANAGEMENT CONTROLLERS
   ======================================================== */

/**
 * GET /api/admin/users
 * Search and filter users by role and accountStatus with pagination
 */
export const getAdminUsers = async (req, res, next) => {
  try {
    const {
      search = '',
      role,
      status,
      accountStatus,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex }
      ];
    }

    if (role && role !== 'ALL') {
      query.role = role.toUpperCase();
    }

    const effectiveStatus = status || accountStatus;
    if (effectiveStatus && effectiveStatus !== 'ALL') {
      query.accountStatus = effectiveStatus.toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      status: 'ok',
      count: users.length,
      users,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin users:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/users/:id
 * View full user details, orders, and shop summary
 */
export const getAdminUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [ordersCount, shop, application] = await Promise.all([
      Order.countDocuments(user.role === 'CUSTOMER' ? { customerId: user._id } : { 'shops.ownerId': user._id }),
      user.role === 'OWNER' ? Shop.findOne({ ownerId: user._id }) : null,
      user.role === 'OWNER' ? ShopApplication.findOne({ ownerId: user._id }).select('shopName status paymentStatus submissionDate createdAt reviewedAt') : null
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          ordersCount
        },
        shop,
        application
      }
    });
  } catch (error) {
    logger.error('Error fetching user details:', error.message);
    next(error);
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Suspend or reactivate user account with strict security protections:
 * - Prevents suspending the last active ADMIN
 * - Prevents self-promotion or promotion to ADMIN via user management
 */
export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountStatus, reason = '' } = req.body;
    const adminId = req.user._id || req.user.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (!accountStatus || !['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid accountStatus. Allowed values: ACTIVE, SUSPENDED'
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protection: Prevent suspending the last active ADMIN
    if (targetUser.role === 'ADMIN' && accountStatus === 'SUSPENDED') {
      const activeAdminCount = await User.countDocuments({
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        _id: { $ne: targetUser._id }
      });

      if (activeAdminCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Security policy violation: Cannot suspend the last active platform administrator.'
        });
      }
    }

    const previousStatus = targetUser.accountStatus;
    targetUser.accountStatus = accountStatus;
    await targetUser.save();

    // Record Audit Log
    const action = accountStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED';
    await recordAdminAuditLog({
      adminId,
      action,
      entityType: 'USER',
      entityId: targetUser._id,
      reason: reason || (accountStatus === 'SUSPENDED' ? 'Account suspended by administrator' : 'Account reactivated by administrator'),
      metadata: {
        userName: targetUser.name,
        userEmail: targetUser.email,
        role: targetUser.role,
        previousStatus,
        newStatus: accountStatus
      }
    });

    // Notify user
    try {
      await Notification.create({
        recipientId: targetUser._id,
        type: 'ACCOUNT_STATUS_UPDATED',
        title: accountStatus === 'SUSPENDED' ? 'Account Suspended' : 'Account Reactivated',
        message: accountStatus === 'SUSPENDED'
          ? `Your EXACTSPARE account has been suspended. Reason: ${reason || 'Administrative review'}.`
          : 'Your EXACTSPARE account has been restored to active status.'
      });
    } catch (err) {
      // ignore
    }

    logger.info(`Admin ${adminId} updated user ${targetUser._id} status to ${accountStatus}`);

    return res.status(200).json({
      success: true,
      message: `User account successfully ${accountStatus === 'ACTIVE' ? 'reactivated' : 'suspended'}`,
      data: {
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          accountStatus: targetUser.accountStatus
        }
      }
    });
  } catch (error) {
    logger.error('Error updating user status:', error.message);
    next(error);
  }
};

/* ========================================================
   3. SPARE PART MODERATION CONTROLLERS
   ======================================================== */

/**
 * GET /api/admin/parts
 * Query listings across all shops with moderation filters
 */
export const getAdminParts = async (req, res, next) => {
  try {
    const {
      search = '',
      category,
      vehicleType,
      shop,
      shopId,
      status, // 'ALL', 'PUBLISHED', 'MODERATED', 'HIDDEN', 'UNPUBLISHED', 'OUT_OF_STOCK'
      page = 1,
      limit = 10
    } = req.query;

    const query = { isArchived: false };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { partName: regex },
        { partNumber: regex },
        { manufacturer: regex },
        { 'compatibility.model': regex },
        { 'compatibility.make': regex }
      ];
    }

    if (category && category !== 'ALL') query.category = category;
    if (vehicleType && vehicleType !== 'ALL') query.vehicleType = vehicleType;

    const targetShop = shop || shopId;
    if (targetShop && targetShop !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(targetShop)) {
        query.shopId = targetShop;
      } else {
        const matchingShops = await Shop.find({ name: new RegExp(targetShop.trim(), 'i') }).select('_id');
        query.shopId = { $in: matchingShops.map((s) => s._id) };
      }
    }

    const normStatus = (status || '').toUpperCase();
    if (normStatus === 'MODERATED' || normStatus === 'HIDDEN') {
      query.isModerated = true;
    } else if (normStatus === 'PUBLISHED') {
      query.isPublished = true;
      query.isModerated = false;
    } else if (normStatus === 'UNPUBLISHED') {
      query.isPublished = false;
    } else if (normStatus === 'OUT_OF_STOCK') {
      query.stockQuantity = { $lte: 0 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [parts, total] = await Promise.all([
      SparePart.find(query)
        .populate('shopId', 'name address.city isActive')
        .populate('ownerId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SparePart.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      count: parts.length,
      data: {
        parts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin parts:', error.message);
    next(error);
  }
};

/**
 * PATCH /api/admin/parts/:id/moderate
 * Hide or restore a spare part listing while preserving historical order integrity
 */
export const moderateAdminPart = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isPublished, reason = '' } = req.body;
    const adminId = req.user._id || req.user.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid part ID' });
    }

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPublished boolean flag (true/false) is required'
      });
    }

    const part = await SparePart.findById(id);
    if (!part || part.isArchived) {
      return res.status(404).json({ success: false, message: 'Spare part listing not found' });
    }

    const isModeratedAction = !isPublished;
    part.isPublished = isPublished;
    part.isModerated = isModeratedAction;
    part.moderationReason = isModeratedAction ? (reason.trim() || 'Hidden by admin moderation') : '';
    part.moderatedBy = adminId;
    part.moderatedAt = new Date();

    await part.save();

    // Record Audit Log
    const action = isModeratedAction ? 'PART_MODERATED' : 'PART_RESTORED';
    await recordAdminAuditLog({
      adminId,
      action,
      entityType: 'SPARE_PART',
      entityId: part._id,
      reason: reason || (isModeratedAction ? 'Listing hidden by administrator' : 'Listing restored to marketplace'),
      metadata: {
        partName: part.partName,
        partNumber: part.partNumber,
        shopId: part.shopId,
        isPublished
      }
    });

    // Notify the shop owner
    try {
      await Notification.create({
        recipientId: part.ownerId,
        type: 'LISTING_MODERATED',
        title: isModeratedAction ? 'Product Listing Moderated' : 'Product Listing Restored',
        message: isModeratedAction
          ? `Your spare part listing "${part.partName}" (#${part.partNumber}) has been unpublished by admin moderation. Reason: ${reason || 'Catalog policy review'}.`
          : `Your spare part listing "${part.partName}" has been restored to public search.`
      });
    } catch (notifErr) {
      // ignore
    }

    logger.info(`Admin ${adminId} moderated part ${part._id} (isPublished: ${isPublished})`);

    return res.status(200).json({
      success: true,
      message: isPublished ? 'Listing restored to marketplace' : 'Listing hidden by moderation',
      data: { part }
    });
  } catch (error) {
    logger.error('Error moderating part:', error.message);
    next(error);
  }
};

/* ========================================================
   4. REVIEW MODERATION CONTROLLERS
   ======================================================== */

/**
 * GET /api/admin/reviews
 * View all customer reviews with moderation filter & search
 */
export const getAdminReviews = async (req, res, next) => {
  try {
    const {
      status, // 'APPROVED', 'FLAGGED', 'HIDDEN', 'ALL'
      rating,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.moderationStatus = status.toUpperCase();
    }

    if (rating) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) query.rating = r;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('customerId', 'name email phone')
        .populate('productId', 'partName partNumber shopId price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: {
        reviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin reviews:', error.message);
    next(error);
  }
};

/**
 * PATCH /api/admin/reviews/:id/moderate
 * Approve, flag, or hide customer reviews; recalculates product rating automatically
 */
export const moderateAdminReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moderationStatus, reason = '' } = req.body;
    const adminId = req.user._id || req.user.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    if (!moderationStatus || !['APPROVED', 'FLAGGED', 'HIDDEN'].includes(moderationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid moderationStatus. Allowed values: APPROVED, FLAGGED, HIDDEN'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const previousStatus = review.moderationStatus;
    review.moderationStatus = moderationStatus;
    review.moderationReason = reason ? reason.trim() : '';
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();

    await review.save();

    // Recalculate average rating on SparePart document!
    await recalculateProductRatings(review.productId);

    // Record Audit Log
    await recordAdminAuditLog({
      adminId,
      action: 'REVIEW_MODERATED',
      entityType: 'REVIEW',
      entityId: review._id,
      reason: reason || `Review marked as ${moderationStatus}`,
      metadata: {
        productId: review.productId,
        rating: review.rating,
        previousStatus,
        newStatus: moderationStatus
      }
    });

    logger.info(`Admin ${adminId} moderated review ${review._id} to ${moderationStatus}`);

    return res.status(200).json({
      success: true,
      message: `Review successfully updated to ${moderationStatus}`,
      data: { review }
    });
  } catch (error) {
    logger.error('Error moderating review:', error.message);
    next(error);
  }
};

/* ========================================================
   5. AUDIT LOG CONTROLLERS
   ======================================================== */

/**
 * GET /api/admin/audit-logs
 * Paginated admin audit logs with filtering by action, entityType, and date range
 */
export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const {
      action,
      entityType,
      from,
      to,
      page = 1,
      limit = 15
    } = req.query;

    const query = {};

    if (action && action !== 'ALL') {
      query.action = action.trim();
    }

    if (entityType && entityType !== 'ALL') {
      query.entityType = entityType.trim();
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) query.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(query)
        .populate('adminId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AdminAuditLog.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin audit logs:', error.message);
    next(error);
  }
};
