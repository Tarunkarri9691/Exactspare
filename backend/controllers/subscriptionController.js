import Subscription from '../models/Subscription.js';
import PaymentConfig from '../models/PaymentConfig.js';
import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { recordAdminAuditLog } from './adminManagementController.js';
import { validateStrictUtr } from './shopApplicationController.js';
import { logger } from '../utils/logger.js';
import {
  checkAndProcessSubscriptionExpirations,
  getSubscriptionExpiryStage
} from '../services/subscriptionScheduler.js';

/**
 * Helper to ensure a default PaymentConfig exists with valid subscription plans
 */
export const getAuthoritativePaymentConfig = async () => {
  let config = await PaymentConfig.findOne({ key: 'ADMIN_SCANNER' });
  if (!config) {
    config = await PaymentConfig.create({
      key: 'ADMIN_SCANNER',
      upiId: 'exactspare.merchant@upi',
      payeeName: 'EXACTSPARE Merchant Services',
      registrationFee: 499,
      subscriptionFee: 499,
      billingDurationDays: 90,
      planName: 'Merchant Partner Subscription',
      currency: 'INR'
    });
  }
  return config;
};

/**
 * Check and transition any expired subscriptions and send stage reminders
 */
export const syncSubscriptionExpirations = async (filter = {}) => {
  return await checkAndProcessSubscriptionExpirations(filter);
};

/**
 * Get Subscription and Payment Configuration
 * @route GET /api/subscriptions/config
 */
export const getSubscriptionConfig = async (req, res, next) => {
  try {
    const config = await getAuthoritativePaymentConfig();

    const upiId = config.upiId || 'exactspare.merchant@upi';
    const payeeName = config.payeeName || 'EXACTSPARE Merchant Services';
    const amount = config.subscriptionFee || config.registrationFee || 499;

    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('EXACTSPARE Merchant Subscription')}`;

    res.status(200).json({
      status: 'ok',
      config: {
        upiId: config.upiId,
        payeeName: config.payeeName,
        subscriptionFee: config.subscriptionFee || config.registrationFee || 499,
        billingDurationDays: config.billingDurationDays || 90,
        planName: config.planName || 'Merchant Partner Subscription',
        currency: config.currency || 'INR',
        plans: config.plans && config.plans.length > 0 ? config.plans : [
          {
            planId: 'quarterly_partner',
            name: 'Merchant Partner Quarterly Plan',
            amount: 499,
            billingDurationDays: 90,
            badge: 'Most Popular',
            description: 'Quarterly subscription for verified shop owners with full catalog, location search, and customer enquiries.',
            features: [
              'Full spare parts catalog listing & search indexing',
              'Customer enquiries & direct phone contacts',
              'Shop location map placement & GPS directions',
              'Order tracking & merchant fulfillment portal',
              'Admin verified trust badge & safety assurance'
            ]
          },
          {
            planId: 'annual_pro',
            name: 'Merchant Partner Annual Pro',
            amount: 1499,
            billingDurationDays: 365,
            badge: 'Best Value',
            description: 'Full 1-year premium merchant subscription with priority search ranking and unlimited part listings.',
            features: [
              'All Quarterly Plan features included for 365 days',
              'Priority placement in local area search results',
              'Unlimited spare parts catalog capacity',
              'Direct customer enquiry SMS / Email dispatch',
              'Dedicated platform merchant support'
            ]
          }
        ],
        qrCodeImage: config.qrCodeImage || '',
        instructions: config.instructions || '',
        upiUri,
        verificationMode: 'ADMIN_VERIFICATION',
        verificationNotice: 'Payment references submitted via UPI QR or supported UPI apps require administrator verification before subscription activation.'
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription config:', error);
    next(error);
  }
};

/**
 * Get Logged-in Owner's Subscription Status & Payment History
 * @route GET /api/subscriptions/my
 */
export const getMySubscription = async (req, res, next) => {
  try {
    const ownerId = req.user._id;

    // First, sync any expired subscriptions for this owner
    await syncSubscriptionExpirations({ ownerId });

    // Fetch all subscription records belonging exclusively to this owner
    const history = await Subscription.find({ ownerId })
      .sort({ createdAt: -1 })
      .populate('verifiedBy', 'name email');

    // Find the latest active or pending subscription
    const currentSubscription = history.find(s => s.status === 'ACTIVE') ||
                                history.find(s => s.status === 'PENDING_VERIFICATION') ||
                                history[0] ||
                                null;

    let overallStatus = 'NOT_SUBSCRIBED';
    let expiryStageInfo = null;
    let daysRemaining = null;

    if (currentSubscription) {
      overallStatus = currentSubscription.status;
      if (currentSubscription.expiryDate) {
        expiryStageInfo = getSubscriptionExpiryStage(currentSubscription.expiryDate);
        if (expiryStageInfo) {
          daysRemaining = expiryStageInfo.daysRemaining;
        } else if (currentSubscription.status === 'ACTIVE') {
          const diffMs = new Date(currentSubscription.expiryDate).getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }
      }
    }

    const config = await getAuthoritativePaymentConfig();

    res.status(200).json({
      status: 'ok',
      overallStatus,
      currentSubscription,
      expiryStageInfo,
      daysRemaining,
      history,
      config: {
        upiId: config.upiId,
        payeeName: config.payeeName,
        subscriptionFee: config.subscriptionFee || config.registrationFee || 499,
        billingDurationDays: config.billingDurationDays || 90,
        planName: config.planName || 'Merchant Partner Subscription',
        plans: config.plans,
        qrCodeImage: config.qrCodeImage
      }
    });
  } catch (error) {
    logger.error('Error fetching owner subscription:', error);
    next(error);
  }
};

/**
 * Shop Owner Submits Subscription Payment Reference for Admin Verification
 * @route POST /api/subscriptions/submit
 */
export const submitSubscriptionPayment = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const { planId, utr, paymentUtr, paymentMethod } = req.body;

    // Fetch authoritative plans
    const config = await getAuthoritativePaymentConfig();
    const plans = config.plans && config.plans.length > 0 ? config.plans : [
      {
        planId: 'quarterly_partner',
        name: 'Merchant Partner Quarterly Plan',
        amount: 499,
        billingDurationDays: 90
      },
      {
        planId: 'annual_pro',
        name: 'Merchant Partner Annual Pro',
        amount: 1499,
        billingDurationDays: 365
      }
    ];

    const selectedPlan = plans.find(p => p.planId === planId) || plans[0];

    // Validate transaction reference / UTR
    const rawUtr = (paymentUtr || utr || '').trim();
    if (!rawUtr || rawUtr.length < 6) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'A valid UPI transaction reference / UTR number (at least 6 characters) is required.'
      });
    }

    // Strict anti-duplicate check: prevent duplicate transaction references across active/pending subscriptions
    const duplicateUtr = await Subscription.findOne({
      paymentUtr: new RegExp(`^${rawUtr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      status: { $in: ['PENDING_VERIFICATION', 'ACTIVE'] }
    });

    if (duplicateUtr) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `This transaction reference (${rawUtr}) has already been submitted for another subscription. Duplicate references are strictly rejected.`
      });
    }

    // Find linked shop if any exists
    const shop = await Shop.findOne({ ownerId });

    // Generate unique internal payment reference
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const internalRef = `SUB-EXS-${timestampPart}-${randomPart}`;

    const now = new Date();
    const validPaymentMethods = ['UPI_QR', 'GOOGLE_PAY', 'PHONEPE', 'PAYTM', 'BHIM_UPI', 'OTHER_UPI', 'DIRECT_PAY'];
    const chosenMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'UPI_QR';

    const durationDays = selectedPlan.billingDurationDays || 90;

    // Create subscription record initially marked as PENDING_VERIFICATION
    // Payment must never be marked successful merely because owner submitted a UTR
    const newSubscription = await Subscription.create({
      ownerId,
      shopId: shop?._id || null,
      planId: selectedPlan.planId,
      planName: selectedPlan.name,
      amount: selectedPlan.amount,
      currency: 'INR',
      billingDurationDays: durationDays,
      internalRef,
      paymentMethod: chosenMethod,
      paymentUtr: rawUtr,
      status: 'PENDING_VERIFICATION',
      verificationMethod: 'MANUAL_ADMIN',
      startDate: null,
      expiryDate: null,
      submittedAt: now,
      verifiedAt: null,
      verifiedBy: null,
      history: [
        {
          status: 'PENDING_VERIFICATION',
          changedBy: ownerId,
          note: `Payment reference (${rawUtr}) submitted via ${chosenMethod}. Awaiting administrator verification.`,
          timestamp: now
        }
      ]
    });

    // Send in-app notification to the owner confirming submission
    await Notification.create({
      recipientId: ownerId,
      title: 'Subscription Payment Submitted',
      message: `Your payment reference (${rawUtr}) for "${selectedPlan.name}" (₹${selectedPlan.amount}) has been submitted and is pending administrator verification.`,
      type: 'SUBSCRIPTION_PENDING_VERIFICATION',
      relatedId: newSubscription._id
    }).catch(err => logger.error('Error creating subscription notification:', err));

    // Send in-app notification to all platform administrators
    const adminUsers = await User.find({ role: 'ADMIN' });
    for (const admin of adminUsers) {
      await Notification.create({
        recipientId: admin._id,
        title: 'New Subscription Payment to Review',
        message: `Shop owner ${req.user.name || req.user.email} (${shop?.name || 'Store'}) submitted a subscription payment reference (UTR: ${rawUtr}) for "${selectedPlan.name}". Review and accept to unlock their shop.`,
        type: 'SUBSCRIPTION_PENDING_ADMIN',
        relatedId: newSubscription._id
      }).catch(err => logger.error('Error creating admin subscription notification:', err));
    }

    logger.info(`Subscription payment submitted for verification by ${req.user.email} (Internal Ref: ${internalRef}, Plan: ${selectedPlan.name}, UTR: ${rawUtr})`);

    res.status(201).json({
      status: 'ok',
      message: 'Payment reference submitted successfully. Your subscription is pending administrator verification.',
      subscription: newSubscription
    });
  } catch (error) {
    logger.error('Error submitting subscription payment:', error);
    next(error);
  }
};

/**
 * Administrator: List all subscription payments with search and filtering
 * @route GET /api/admin/subscriptions
 */
export const getAdminSubscriptions = async (req, res, next) => {
  try {
    // First, sync any expired subscriptions
    await syncSubscriptionExpirations();

    const { status, search, page = 1, limit = 15 } = req.query;
    const query = {};
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (status && status.trim()) {
      const cleanStatus = status.trim().toUpperCase();
      if (cleanStatus === 'EXPIRING_SOON') {
        query.status = 'ACTIVE';
        query.expiryDate = { $gt: now, $lte: sevenDaysFromNow };
      } else {
        query.status = cleanStatus;
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s, 'i');
      query.$or = [
        { internalRef: regex },
        { paymentUtr: regex },
        { planName: regex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [total, subscriptions, totalAll, pending, active, expiringSoon, expired, rejected] = await Promise.all([
      Subscription.countDocuments(query),
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('ownerId', 'name email phone')
        .populate('shopId', 'name')
        .populate('verifiedBy', 'name email'),
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'PENDING_VERIFICATION' }),
      Subscription.countDocuments({ status: 'ACTIVE' }),
      Subscription.countDocuments({
        status: 'ACTIVE',
        expiryDate: { $gt: now, $lte: sevenDaysFromNow }
      }),
      Subscription.countDocuments({ status: 'EXPIRED' }),
      Subscription.countDocuments({ status: 'PAYMENT_FAILED' })
    ]);

    // Check if each owner has an existing active subscription
    const ownerIds = [...new Set(subscriptions.map(s => s.ownerId?._id).filter(Boolean))];
    const activeSubsForOwners = await Subscription.find({
      ownerId: { $in: ownerIds },
      status: 'ACTIVE'
    }).select('ownerId _id expiryDate');

    const activeMap = {};
    activeSubsForOwners.forEach(as => {
      activeMap[as.ownerId.toString()] = as;
    });

    const enriched = subscriptions.map(s => {
      const doc = s.toObject();
      const activeForOwner = doc.ownerId?._id ? activeMap[doc.ownerId._id.toString()] : null;
      doc.ownerHasActiveSubscription = !!activeForOwner && activeForOwner._id.toString() !== doc._id.toString();
      doc.expiryStageInfo = doc.expiryDate ? getSubscriptionExpiryStage(doc.expiryDate, now) : null;
      return doc;
    });

    res.status(200).json({
      status: 'ok',
      subscriptions: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      },
      stats: {
        totalAll,
        pending,
        active,
        expiringSoon,
        expired,
        rejected
      }
    });
  } catch (error) {
    logger.error('Error fetching admin subscriptions:', error);
    next(error);
  }
};

/**
 * Administrator: Verify and Activate a Subscription Payment
 * @route PATCH /api/admin/subscriptions/:id/verify
 */
export const verifyAdminSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Subscription record not found.'
      });
    }

    // Prevent shop owners from verifying their own payments
    if (subscription.ownerId.toString() === req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Unauthorized: Shop owners cannot verify their own subscription payments.'
      });
    }

    // Idempotent: already active
    if (subscription.status === 'ACTIVE') {
      return res.status(200).json({
        status: 'ok',
        message: 'Subscription is already active and verified.',
        subscription
      });
    }

    const now = new Date();
    const durationDays = subscription.billingDurationDays || 90;
    const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    subscription.status = 'ACTIVE';
    subscription.startDate = now;
    subscription.expiryDate = expiryDate;
    subscription.verifiedBy = req.user._id;
    subscription.verifiedAt = now;
    subscription.verificationMethod = 'MANUAL_ADMIN';
    subscription.rejectionReason = '';
    subscription.remindersSent = [];
    subscription.lastReminderAt = null;

    subscription.history.push({
      status: 'ACTIVE',
      changedBy: req.user._id,
      note: `Subscription payment verified and reconciled with bank records by administrator (${req.user.name || req.user.email}). Valid for ${durationDays} days until ${expiryDate.toLocaleDateString()}.`,
      timestamp: now
    });

    await subscription.save();

    // Mark owner user hasActiveSubscription to true
    await User.findByIdAndUpdate(subscription.ownerId, { hasActiveSubscription: true });

    // Ensure the owner's Shop record exists and is active
    let shop = await Shop.findOne({ ownerId: subscription.ownerId });
    if (!shop) {
      const ownerUser = await User.findById(subscription.ownerId);
      let app = await ShopApplication.findOne({ ownerId: subscription.ownerId });
      if (!app) {
        app = await ShopApplication.create({
          ownerId: subscription.ownerId,
          shopName: ownerUser?.name ? `${ownerUser.name}'s Auto Spares` : 'Auto Spares Shop',
          ownerFullName: ownerUser?.name || 'Store Owner',
          ownerPhone: ownerUser?.phone || '9999999999',
          businessEmail: ownerUser?.email || 'shop@exactspare.com',
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
          submittedAt: now,
          reviewedAt: now
        });
      }

      shop = await Shop.create({
        ownerId: subscription.ownerId,
        applicationId: app._id,
        name: app.shopName || `${ownerUser?.name || 'Auto'}'s Spares`,
        category: app.shopCategory || 'MULTI_CATEGORY',
        description: app.shopDescription || 'Automotive spare parts retail shop',
        address: {
          addressLine: app.addressLine || 'Main Road',
          city: app.city || 'Hyderabad',
          state: app.state || 'Telangana',
          postalCode: app.postalCode || '500001',
          location: {
            type: 'Point',
            coordinates: [app.longitude || 78.4867, app.latitude || 17.3850]
          }
        },
        contact: {
          phone: app.ownerPhone || ownerUser?.phone || '9999999999',
          email: app.businessEmail || ownerUser?.email
        },
        openingHours: app.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: app.shopImagePaths || [],
        isApproved: true,
        isActive: true,
        approvedAt: now
      });
    } else {
      shop.isActive = true;
      shop.isApproved = true;
      if (!shop.approvedAt) shop.approvedAt = now;
      await shop.save();
    }

    if (shop?._id && !subscription.shopId) {
      subscription.shopId = shop._id;
      await subscription.save();
    }

    // In-app notification to the owner
    await Notification.create({
      recipientId: subscription.ownerId,
      title: 'Subscription Accepted by Admin! Shop is Now Active',
      message: `Your payment of ₹${subscription.amount} (UTR: ${subscription.paymentUtr || 'Confirmed'}) has been accepted. Your "${subscription.planName}" is now active until ${expiryDate.toLocaleDateString()}. Your shop is unlocked and ready to use!`,
      type: 'SUBSCRIPTION_ACTIVATED',
      relatedId: subscription._id
    });

    // Record Administrator Audit Log
    await recordAdminAuditLog({
      adminId: req.user._id,
      action: 'SUBSCRIPTION_PAYMENT_VERIFIED',
      entityType: 'SUBSCRIPTION',
      entityId: subscription._id,
      reason: 'Reconciled payment with bank records and activated owner subscription',
      metadata: {
        internalRef: subscription.internalRef,
        planName: subscription.planName,
        amount: subscription.amount,
        paymentUtr: subscription.paymentUtr,
        ownerId: subscription.ownerId,
        expiryDate
      }
    });

    logger.info(`Subscription ${subscription.internalRef} verified by admin ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: `Subscription "${subscription.planName}" for ₹${subscription.amount} verified and active until ${expiryDate.toLocaleDateString()}.`,
      subscription
    });
  } catch (error) {
    logger.error('Error verifying subscription payment:', error);
    next(error);
  }
};

/**
 * Administrator: Reject a Subscription Payment Submission
 * @route PATCH /api/admin/subscriptions/:id/reject
 */
export const rejectAdminSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'A clear reason for rejecting the payment reference is required.'
      });
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Subscription record not found.'
      });
    }

    // Prevent shop owners from rejecting their own payments
    if (subscription.ownerId.toString() === req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Unauthorized: Shop owners cannot modify or reject their own subscription payments.'
      });
    }

    const now = new Date();
    subscription.status = 'PAYMENT_FAILED';
    subscription.rejectionReason = reason.trim();

    subscription.history.push({
      status: 'PAYMENT_FAILED',
      changedBy: req.user._id,
      note: `Payment reference rejected by administrator: ${reason.trim()}`,
      timestamp: now
    });

    await subscription.save();

    // Mark owner user hasActiveSubscription to false and deactivate Shop
    await User.findByIdAndUpdate(subscription.ownerId, { hasActiveSubscription: false });
    await Shop.findOneAndUpdate(
      { ownerId: subscription.ownerId },
      { isActive: false }
    );

    // In-app notification to the owner
    await Notification.create({
      recipientId: subscription.ownerId,
      title: 'Subscription Payment Verification Failed',
      message: `Payment verification could not be confirmed: ${reason.trim()}. Please submit a valid payment reference or contact support to activate your shop.`,
      type: 'SUBSCRIPTION_REJECTED',
      relatedId: subscription._id
    });

    // Record Administrator Audit Log
    await recordAdminAuditLog({
      adminId: req.user._id,
      action: 'SUBSCRIPTION_PAYMENT_REJECTED',
      entityType: 'SUBSCRIPTION',
      entityId: subscription._id,
      reason: reason.trim(),
      metadata: {
        internalRef: subscription.internalRef,
        amount: subscription.amount,
        paymentUtr: subscription.paymentUtr,
        ownerId: subscription.ownerId
      }
    });

    logger.info(`Subscription ${subscription.internalRef} rejected by admin ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: `Subscription payment marked as failed: ${reason.trim()}`,
      subscription
    });
  } catch (error) {
    logger.error('Error rejecting subscription payment:', error);
    next(error);
  }
};

/**
 * Administrator: Manually Trigger Subscription Expiry Check & Reminder Dispatch
 * @route POST /api/subscriptions/admin/run-expiry-check
 */
export const runAdminManualExpiryCheck = async (req, res, next) => {
  try {
    const stats = await checkAndProcessSubscriptionExpirations();
    res.status(200).json({
      status: 'ok',
      success: true,
      message: 'Subscription expiry and reminder check executed successfully.',
      stats
    });
  } catch (error) {
    logger.error('Error running manual expiry check:', error);
    next(error);
  }
};

