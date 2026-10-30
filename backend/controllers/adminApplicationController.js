import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import PaymentConfig from '../models/PaymentConfig.js';
import emailService from '../services/emailService.js';
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
    const normalizedDecision = decision === 'NEEDS_CORRECTION' ? 'REQUEST_CORRECTIONS' : decision;
    if (!['APPROVE', 'REJECT', 'REQUEST_CORRECTIONS'].includes(normalizedDecision)) {
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
      // Payment verification eligibility check
      if (application.paymentStatus === 'PENDING_VERIFICATION') {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Cannot approve shop application: Registration fee payment is pending verification. Please reconcile and verify payment first before approving the shop.'
        });
      }

      if (application.paymentStatus === 'PAYMENT_FAILED') {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Cannot approve shop application: Registration fee payment verification failed. Valid payment is required before approval.'
        });
      }

      if (application.paymentStatus === 'UNPAID' && (application.paymentUtr || req.body.requirePayment === true)) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Cannot approve shop application: Registration fee payment is unpaid.'
        });
      }

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

      // Dispatch approval email to shop owner
      User.findById(application.ownerId).then((owner) => {
        if (owner && owner.email) {
          emailService.sendShopApplicationStatusEmail(
            owner.email,
            owner.name || application.businessInfo?.ownerName || 'Merchant',
            application.shopName,
            'APPROVED'
          ).catch((e) => logger.warn(`Failed to dispatch shop approval email: ${e.message}`));
        }
      }).catch(() => {});

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

      // Dispatch rejection email to shop owner
      User.findById(application.ownerId).then((owner) => {
        if (owner && owner.email) {
          emailService.sendShopApplicationStatusEmail(
            owner.email,
            owner.name || application.businessInfo?.ownerName || 'Merchant',
            application.shopName,
            'REJECTED',
            reason.trim()
          ).catch((e) => logger.warn(`Failed to dispatch shop rejection email: ${e.message}`));
        }
      }).catch(() => {});

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
    if (normalizedDecision === 'REQUEST_CORRECTIONS') {
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

      // Record Audit Log
      await recordAdminAuditLog({
        adminId: req.user._id,
        action: 'SHOP_APPLICATION_CORRECTIONS_REQUESTED',
        entityType: 'SHOP_APPLICATION',
        entityId: application._id,
        reason: correctionMessage.trim(),
        metadata: {
          shopName: application.shopName,
          ownerId: application.ownerId,
          correctionMessage: correctionMessage.trim()
        }
      });

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

/**
 * Get Admin Payment Scanner Details and Direct Activation Metrics
 * @route GET /api/admin/shop-applications/scanner/config
 */
export const getAdminScannerConfig = async (req, res, next) => {
  try {
    let config = await PaymentConfig.findOne({ key: 'ADMIN_SCANNER' });
    if (!config) {
      config = await PaymentConfig.create({
        key: 'ADMIN_SCANNER',
        upiId: 'exactspare.merchant@upi',
        payeeName: 'EXACTSPARE Merchant Services',
        registrationFee: 499,
        instructions: 'Scan this Admin QR code with Google Pay, PhonePe, Paytm, or BHIM. Enter your 12-digit UTR/Reference number below to activate your Shop Owner Portal immediately without waiting for admin approval.',
        isActive: true
      });
    }

    const [paidApplications, totalPaidVolume] = await Promise.all([
      ShopApplication.find({ paymentStatus: 'PAID' })
        .populate('ownerId', 'name email phone')
        .sort({ paidAt: -1 })
        .limit(20),
      ShopApplication.aggregate([
        { $match: { paymentStatus: 'PAID' } },
        { $group: { _id: null, totalAmount: { $sum: '$paymentAmount' }, count: { $sum: 1 } } }
      ])
    ]);

    const upiUri = `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payeeName)}&am=${config.registrationFee}&cu=INR&tn=${encodeURIComponent('Shop Registration Onboarding')}`;

    res.status(200).json({
      status: 'ok',
      config: {
        upiId: config.upiId,
        payeeName: config.payeeName,
        registrationFee: config.registrationFee,
        instructions: config.instructions,
        upiUri,
        qrCodeImage: config.qrCodeImage || null,
        isActive: config.isActive,
        updatedAt: config.updatedAt
      },
      stats: {
        totalPaidCount: totalPaidVolume[0]?.count || 0,
        totalPaidAmount: totalPaidVolume[0]?.totalAmount || 0
      },
      recentPayments: paidApplications
    });
  } catch (error) {
    logger.error('Error fetching admin scanner config:', error);
    next(error);
  }
};

/**
 * Update Admin Payment Scanner Configuration
 * @route PUT /api/admin/shop-applications/scanner/config
 */
export const updateAdminScannerConfig = async (req, res, next) => {
  try {
    const { upiId, payeeName, registrationFee, instructions, qrCodeImage, isActive } = req.body;

    let config = await PaymentConfig.findOne({ key: 'ADMIN_SCANNER' });
    if (!config) {
      config = new PaymentConfig({ key: 'ADMIN_SCANNER' });
    }

    if (upiId) config.upiId = upiId.trim();
    if (payeeName) config.payeeName = payeeName.trim();
    if (registrationFee !== undefined && !isNaN(Number(registrationFee))) {
      config.registrationFee = Math.max(0, Number(registrationFee));
    }
    if (instructions) config.instructions = instructions.trim();
    if (qrCodeImage !== undefined) config.qrCodeImage = qrCodeImage;
    if (isActive !== undefined) config.isActive = Boolean(isActive);
    config.updatedBy = req.user._id;

    await config.save();

    await recordAdminAuditLog({
      adminId: req.user._id,
      action: 'UPDATE_PAYMENT_SCANNER',
      targetType: 'SYSTEM_CONFIG',
      targetId: config._id,
      details: { upiId: config.upiId, registrationFee: config.registrationFee }
    });

    res.status(200).json({
      status: 'ok',
      message: 'Admin Payment Scanner configuration updated successfully.',
      config
    });
  } catch (error) {
    logger.error('Error updating admin scanner config:', error);
    next(error);
  }
};

/**
 * Administrator reconciles & confirms genuine payment receipt
 * @route PATCH /api/admin/shop-applications/:id/verify-payment
 */
export const verifyApplicationPayment = async (req, res, next) => {
  try {
    const application = await ShopApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    // Idempotent: already marked PAID
    if (application.paymentStatus === 'PAID') {
      return res.status(200).json({
        status: 'ok',
        message: 'Payment is already verified and marked as PAID.',
        application
      });
    }

    const now = new Date();
    application.paymentStatus = 'PAID';
    application.paidAt = application.paidAt || now;
    application.paymentVerifiedBy = req.user._id;
    application.paymentVerifiedAt = now;
    application.paymentRejectionReason = '';

    application.statusHistory.push({
      status: application.status,
      changedBy: req.user._id,
      note: `Registration payment verified and reconciled by administrator (${req.user.name || req.user.email}). Amount: ₹${application.paymentAmount}, UTR: ${application.paymentUtr || 'N/A'}`,
      timestamp: now
    });

    await application.save();

    // In-app notification to owner
    await Notification.create({
      recipientId: application.ownerId,
      title: 'Registration Payment Verified',
      message: `Your registration payment of ₹${application.paymentAmount} (UTR: ${application.paymentUtr || 'Confirmed'}) has been verified by the administrator. Your application is now queued for final compliance review.`,
      type: 'PAYMENT_VERIFIED',
      relatedId: application._id
    });

    await recordAdminAuditLog({
      adminId: req.user._id,
      action: 'SHOP_APPLICATION_PAYMENT_VERIFIED',
      entityType: 'SHOP_APPLICATION',
      entityId: application._id,
      reason: 'Payment verified and reconciled with bank records',
      metadata: {
        shopName: application.shopName,
        paymentUtr: application.paymentUtr,
        paymentAmount: application.paymentAmount
      }
    });

    logger.info(`Payment verified for shop application ${application._id} by admin ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: `Payment of ₹${application.paymentAmount} for "${application.shopName}" has been successfully verified.`,
      application
    });
  } catch (error) {
    logger.error('Error verifying application payment:', error);
    next(error);
  }
};

/**
 * Administrator rejects payment reference (e.g. counterfeit UTR or unreceived funds)
 * @route PATCH /api/admin/shop-applications/:id/reject-payment
 */
export const rejectApplicationPayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'A clear reason for rejecting the payment reference is required.'
      });
    }

    const application = await ShopApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    const now = new Date();
    application.paymentStatus = 'PAYMENT_FAILED';
    application.paymentRejectionReason = reason.trim();

    application.statusHistory.push({
      status: application.status,
      changedBy: req.user._id,
      note: `Payment reference rejected by administrator: ${reason.trim()}`,
      timestamp: now
    });

    await application.save();

    // Notification to owner
    await Notification.create({
      recipientId: application.ownerId,
      title: 'Payment Verification Failed',
      message: `Payment verification could not be confirmed: ${reason.trim()}. Please submit a valid payment reference or contact support.`,
      type: 'PAYMENT_FAILED',
      relatedId: application._id
    });

    await recordAdminAuditLog({
      adminId: req.user._id,
      action: 'SHOP_APPLICATION_PAYMENT_REJECTED',
      entityType: 'SHOP_APPLICATION',
      entityId: application._id,
      reason: reason.trim(),
      metadata: {
        shopName: application.shopName,
        paymentUtr: application.paymentUtr
      }
    });

    logger.info(`Payment rejected for shop application ${application._id} by admin ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: `Payment reference for "${application.shopName}" marked as failed.`,
      application
    });
  } catch (error) {
    logger.error('Error rejecting application payment:', error);
    next(error);
  }
};


