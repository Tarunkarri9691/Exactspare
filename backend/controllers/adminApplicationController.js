import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import Notification from '../models/Notification.js';
import { recordAdminAuditLog } from './adminManagementController.js';
import { logger } from '../utils/logger.js';

/**
 * Get all shop applications with filtering, search, sorting, and pagination
 * @route GET /api/admin/shop-applications
 */
export const getAdminApplications = async (req, res, next) => {
  try {
    const {
      status,
      search,
      sortBy = 'newest',
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Filter by status if provided and valid
    if (status && ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION'].includes(status)) {
      query.status = status;
    }

    // Search filter across shopName, ownerFullName, businessEmail, or ID
    if (search && search.trim() !== '') {
      const term = search.trim();
      const searchRegex = new RegExp(term, 'i');
      query.$or = [
        { shopName: searchRegex },
        { ownerFullName: searchRegex },
        { businessEmail: searchRegex },
        { city: searchRegex }
      ];
    }

    // Sorting
    const sort = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [applications, totalFiltered, pendingCount, approvedCount, rejectedCount, needsCorrectionCount, totalAll] = await Promise.all([
      ShopApplication.find(query)
        .populate('ownerId', 'name email phone accountStatus')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      ShopApplication.countDocuments(query),
      ShopApplication.countDocuments({ status: 'PENDING' }),
      ShopApplication.countDocuments({ status: 'APPROVED' }),
      ShopApplication.countDocuments({ status: 'REJECTED' }),
      ShopApplication.countDocuments({ status: 'NEEDS_CORRECTION' }),
      ShopApplication.countDocuments({})
    ]);

    res.status(200).json({
      status: 'ok',
      pagination: {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalFiltered / limitNum) || 1
      },
      stats: {
        totalAll,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        needsCorrection: needsCorrectionCount
      },
      applications
    });
  } catch (error) {
    logger.error('Error fetching admin applications:', error);
    next(error);
  }
};

/**
 * Get detailed shop application for admin inspection
 * @route GET /api/admin/shop-applications/:id
 */
export const getAdminApplicationById = async (req, res, next) => {
  try {
    const application = await ShopApplication.findById(req.params.id)
      .populate('ownerId', 'name email phone accountStatus createdAt')
      .populate('reviewedBy', 'name email')
      .populate('statusHistory.changedBy', 'name email role');

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    // Also check if a Shop record already exists for this owner
    const existingShop = await Shop.findOne({ applicationId: application._id });

    res.status(200).json({
      status: 'ok',
      application,
      shop: existingShop || null
    });
  } catch (error) {
    logger.error('Error fetching application for admin:', error);
    next(error);
  }
};

/**
 * Process administrator review decision (Approve, Reject, Request Corrections)
 * @route PATCH /api/admin/shop-applications/:id/decision
 */
export const decideApplication = async (req, res, next) => {
  try {
    const { decision, reason, correctionMessage } = req.body;
    const application = await ShopApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    // Validate allowed decisions
    if (!['APPROVE', 'REJECT', 'REQUEST_CORRECTIONS'].includes(decision)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Invalid review decision. Permitted choices: APPROVE, REJECT, or REQUEST_CORRECTIONS.'
      });
    }

    // Status transition rules:
    // Only PENDING applications can be evaluated. (DRAFT cannot be approved or rejected without submission)
    if (application.status === 'DRAFT') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Cannot review an application that is still in DRAFT status.'
      });
    }

    const now = new Date();
    application.reviewedBy = req.user._id;
    application.reviewedAt = now;

    // DECISION: APPROVE
    if (decision === 'APPROVE') {
      application.status = 'APPROVED';
      application.rejectionReason = '';
      application.correctionMessage = '';
      application.statusHistory.push({
        status: 'APPROVED',
        changedBy: req.user._id,
        note: 'Application reviewed and approved by administrator',
        timestamp: now
      });

      // Synchronize / create the active Shop record
      const shopPayload = {
        ownerId: application.ownerId,
        applicationId: application._id,
        name: application.shopName,
        category: application.shopCategory,
        description: application.shopDescription,
        address: {
          addressLine: application.addressLine,
          city: application.city,
          state: application.state,
          postalCode: application.postalCode,
          location: {
            type: 'Point',
            coordinates: [application.longitude, application.latitude]
          }
        },
        contact: {
          phone: application.ownerPhone,
          email: application.businessEmail
        },
        openingHours: application.openingHours,
        images: application.shopImagePaths,
        isApproved: true,
        isActive: true,
        approvedAt: now
      };

      // Upsert the Shop record atomically
      await Shop.findOneAndUpdate(
        { applicationId: application._id },
        shopPayload,
        { upsert: true, new: true, runValidators: true }
      );

      // Send in-app notification to merchant
      await Notification.create({
        recipientId: application.ownerId,
        title: 'Shop Application Approved!',
        message: `Congratulations! Your shop "${application.shopName}" has been verified and approved. Your store is now active on EXACTSPARE.`,
        type: 'APPLICATION_APPROVED',
        relatedId: application._id
      });

      await application.save();

      // Record Audit Log
      await recordAdminAuditLog({
        adminId: req.user._id,
        action: 'SHOP_APPLICATION_APPROVED',
        entityType: 'SHOP_APPLICATION',
        entityId: application._id,
        reason: 'Application approved and shop activated by administrator',
        metadata: {
          shopName: application.shopName,
          ownerId: application.ownerId
        }
      });

      logger.info(`Shop application ${application._id} APPROVED by admin ${req.user.email}`);

      return res.status(200).json({
        status: 'ok',
        message: `Shop application for "${application.shopName}" has been successfully APPROVED.`,
        application
      });
    }

    // DECISION: REJECT
    if (decision === 'REJECT') {
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'A specific rejection reason is required.'
        });
      }

      application.status = 'REJECTED';
      application.rejectionReason = reason.trim();
      application.statusHistory.push({
        status: 'REJECTED',
        changedBy: req.user._id,
        note: `Application rejected: ${reason.trim()}`,
        timestamp: now
      });

      // Deactivate associated Shop record if previously created
      await Shop.findOneAndUpdate(
        { applicationId: application._id },
        { isApproved: false, isActive: false }
      );

      // Send rejection notification
      await Notification.create({
        recipientId: application.ownerId,
        title: 'Shop Application Update: Rejected',
        message: `Your shop application was rejected. Reason: ${reason.trim()}`,
        type: 'APPLICATION_REJECTED',
        relatedId: application._id
      });

      await application.save();

      // Record Audit Log
      await recordAdminAuditLog({
        adminId: req.user._id,
        action: 'SHOP_APPLICATION_REJECTED',
        entityType: 'SHOP_APPLICATION',
        entityId: application._id,
        reason: reason.trim(),
        metadata: {
          shopName: application.shopName,
          ownerId: application.ownerId
        }
      });

      logger.info(`Shop application ${application._id} REJECTED by admin ${req.user.email}`);

      return res.status(200).json({
        status: 'ok',
        message: `Shop application for "${application.shopName}" has been REJECTED.`,
        application
      });
    }

    // DECISION: REQUEST_CORRECTIONS
    if (decision === 'REQUEST_CORRECTIONS') {
      if (!correctionMessage || correctionMessage.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'A correction message detailing the required changes is required.'
        });
      }

      application.status = 'NEEDS_CORRECTION';
      application.correctionMessage = correctionMessage.trim();
      application.statusHistory.push({
        status: 'NEEDS_CORRECTION',
        changedBy: req.user._id,
        note: `Corrections requested: ${correctionMessage.trim()}`,
        timestamp: now
      });

      // Send correction notification
      await Notification.create({
        recipientId: application.ownerId,
        title: 'Action Required: Corrections Requested',
        message: `The administrator requested modifications to your shop application: ${correctionMessage.trim()}`,
        type: 'CORRECTION_REQUESTED',
        relatedId: application._id
      });

      await application.save();
      logger.info(`Shop application ${application._id} flagged as NEEDS_CORRECTION by admin ${req.user.email}`);

      return res.status(200).json({
        status: 'ok',
        message: `Application marked as NEEDS_CORRECTION. The owner has been notified to make updates.`,
        application
      });
    }
  } catch (error) {
    logger.error('Error processing admin application decision:', error);
    next(error);
  }
};
