import TrustCase from '../models/TrustCase.js';
import Report from '../models/Report.js';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Notification from '../models/Notification.js';
import { runPlatformTrustScan } from '../services/fraudDetectionService.js';
import { generateTrustAdvisory } from '../services/trustAiAdvisoryService.js';
import { logger } from '../utils/logger.js';

/**
 * Get high-level summary metrics for the Admin Trust Dashboard
 * GET /api/admin/trust/summary
 */
export const getTrustSummary = async (req, res, next) => {
  try {
    const [caseCounts, reportsByCategory, severityCounts, totalCases] = await Promise.all([
      TrustCase.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Report.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ]),
      TrustCase.aggregate([
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]),
      TrustCase.countDocuments()
    ]);

    const statusMap = {
      OPEN: 0,
      UNDER_REVIEW: 0,
      ACTION_REQUIRED: 0,
      RESOLVED: 0,
      DISMISSED: 0
    };
    caseCounts.forEach((c) => {
      if (statusMap[c._id] !== undefined) statusMap[c._id] = c.count;
    });

    const categoryMap = {};
    reportsByCategory.forEach((r) => {
      categoryMap[r._id] = r.count;
    });

    const severityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    severityCounts.forEach((s) => {
      if (severityMap[s._id] !== undefined) severityMap[s._id] = s.count;
    });

    const flaggedListingsCount = await SparePart.countDocuments({ isModerated: true });
    const suspendedShopsCount = await Shop.countDocuments({ isActive: false });
    const totalReports = await Report.countDocuments();

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      data: {
        totalCases,
        statusCounts: statusMap,
        severityCounts: severityMap,
        reportsByCategory: categoryMap,
        totalReports,
        flaggedListingsCount,
        suspendedShopsCount
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List trust review cases with filtering & pagination
 * GET /api/admin/trust/cases
 */
export const getTrustCases = async (req, res, next) => {
  try {
    const { status, severity, targetType, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }
    if (targetType && targetType !== 'ALL') {
      query.targetType = targetType;
    }
    if (search) {
      query.caseNumber = new RegExp(search.trim(), 'i');
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      TrustCase.find(query)
        .populate('productId', 'partName partNumber price category condition isPublished isModerated imagePaths')
        .populate('shopId', 'name category contact address isActive isApproved')
        .populate('ownerId', 'name email phone accountStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      TrustCase.countDocuments(query)
    ]);

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      data: {
        cases,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get detailed trust case by ID
 * GET /api/admin/trust/cases/:caseId
 */
export const getTrustCaseDetails = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const trustCase = await TrustCase.findById(caseId)
      .populate('productId')
      .populate('shopId')
      .populate('ownerId', 'name email phone accountStatus createdAt')
      .populate({
        path: 'reportIds',
        populate: {
          path: 'reporterId',
          select: 'name email phone'
        }
      })
      .populate('adminActions.adminId', 'name email')
      .lean();

    if (!trustCase) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Trust case not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      data: { trustCase }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update case status (OPEN, UNDER_REVIEW, ACTION_REQUIRED, RESOLVED, DISMISSED)
 * PATCH /api/admin/trust/cases/:caseId/status
 */
export const updateTrustCaseStatus = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { status, reason } = req.body;
    const admin = req.user;

    const ALLOWED_STATUSES = ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'DISMISSED'];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const trustCase = await TrustCase.findById(caseId);
    if (!trustCase) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Trust case not found.'
      });
    }

    const previousStatus = trustCase.status;
    trustCase.status = status;

    if (status === 'RESOLVED' || status === 'DISMISSED') {
      trustCase.resolvedBy = admin._id;
      trustCase.resolvedAt = new Date();
      trustCase.resolutionNotes = reason || `Case transitioned from ${previousStatus} to ${status}`;
    }

    trustCase.adminActions.push({
      action: 'STATUS_CHANGE',
      adminId: admin._id,
      adminName: admin.name,
      reason: reason || `Updated status from ${previousStatus} to ${status}`,
      confirmed: true,
      timestamp: new Date()
    });

    await trustCase.save();

    // Log to AdminAuditLog
    await AdminAuditLog.create({
      adminId: admin._id,
      action: `TRUST_CASE_STATUS_${status}`,
      entityType: 'TRUST_CASE',
      entityId: trustCase._id,
      reason: reason || `Status changed from ${previousStatus} to ${status}`,
      metadata: { previousStatus, newStatus: status, caseNumber: trustCase.caseNumber }
    });

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: `Trust case status successfully updated to ${status}.`,
      data: { trustCase }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Execute confirmed consequential administrative action on a trust case
 * POST /api/admin/trust/cases/:caseId/actions
 */
export const executeTrustAction = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { action, reason, confirmed } = req.body;
    const admin = req.user;

    const ALLOWED_ACTIONS = [
      'REQUEST_CORRECTION',
      'FLAG_LISTING',
      'DELIST_PRODUCT',
      'RESTORE_PRODUCT',
      'SUSPEND_SHOP',
      'RESTORE_SHOP',
      'DISMISS_ALERT'
    ];

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}`
      });
    }

    const cleanReason = (reason || '').trim();
    if (!cleanReason || cleanReason.length < 5) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'A mandatory justification reason of at least 5 characters is required for all administrative actions.'
      });
    }

    // REQUIRE CONFIRMATION FOR CONSEQUENTIAL ACTIONS
    const CONSEQUENTIAL_ACTIONS = ['DELIST_PRODUCT', 'SUSPEND_SHOP'];
    if (CONSEQUENTIAL_ACTIONS.includes(action) && confirmed !== true) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Consequential action "${action}" requires explicit confirmation (confirmed: true) before execution.`
      });
    }

    const trustCase = await TrustCase.findById(caseId);
    if (!trustCase) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Trust case not found.'
      });
    }

    let actionSummary = '';

    // 1. REQUEST_CORRECTION
    if (action === 'REQUEST_CORRECTION') {
      trustCase.status = 'ACTION_REQUIRED';
      actionSummary = 'Requested corrections from merchant.';
      
      // Send notification to owner if present
      if (trustCase.ownerId) {
        await Notification.create({
          userId: trustCase.ownerId,
          title: 'Action Required: Listing Review Notice',
          message: `EXACTSPARE Trust & Safety has reviewed your listing/shop: "${cleanReason}". Please make the requested updates promptly.`,
          type: 'SYSTEM',
          referenceId: trustCase._id
        });
      }
    }

    // 2. FLAG_LISTING
    if (action === 'FLAG_LISTING') {
      if (trustCase.productId) {
        await SparePart.findByIdAndUpdate(trustCase.productId, {
          isModerated: true,
          moderationReason: cleanReason,
          moderatedBy: admin._id,
          moderatedAt: new Date()
        });
        trustCase.status = 'ACTION_REQUIRED';
        actionSummary = 'Listing flagged for moderation review.';
      }
    }

    // 3. DELIST_PRODUCT (Consequential)
    if (action === 'DELIST_PRODUCT') {
      if (trustCase.productId) {
        await SparePart.findByIdAndUpdate(trustCase.productId, {
          isPublished: false,
          isModerated: true,
          moderationReason: cleanReason,
          moderatedBy: admin._id,
          moderatedAt: new Date()
        });
        trustCase.status = 'RESOLVED';
        trustCase.resolvedBy = admin._id;
        trustCase.resolvedAt = new Date();
        trustCase.resolutionNotes = cleanReason;
        actionSummary = 'Listing un-published and de-listed from active marketplace catalog.';
      }
    }

    // 4. RESTORE_PRODUCT
    if (action === 'RESTORE_PRODUCT') {
      if (trustCase.productId) {
        await SparePart.findByIdAndUpdate(trustCase.productId, {
          isPublished: true,
          isModerated: false,
          moderationReason: '',
          moderatedBy: admin._id,
          moderatedAt: new Date()
        });
        trustCase.status = 'RESOLVED';
        actionSummary = 'Listing restored to active marketplace catalog.';
      }
    }

    // 5. SUSPEND_SHOP (Consequential)
    if (action === 'SUSPEND_SHOP') {
      await Shop.findByIdAndUpdate(trustCase.shopId, {
        isActive: false,
        deactivationReason: cleanReason,
        deactivatedBy: admin._id,
        deactivatedAt: new Date()
      });
      if (trustCase.ownerId) {
        await User.findByIdAndUpdate(trustCase.ownerId, {
          accountStatus: 'SUSPENDED'
        });
      }
      trustCase.status = 'RESOLVED';
      trustCase.resolvedBy = admin._id;
      trustCase.resolvedAt = new Date();
      trustCase.resolutionNotes = cleanReason;
      actionSummary = 'Shop and associated merchant account suspended pending verification.';
    }

    // 6. RESTORE_SHOP
    if (action === 'RESTORE_SHOP') {
      await Shop.findByIdAndUpdate(trustCase.shopId, {
        isActive: true,
        deactivationReason: '',
        deactivatedBy: null,
        deactivatedAt: null
      });
      if (trustCase.ownerId) {
        await User.findByIdAndUpdate(trustCase.ownerId, {
          accountStatus: 'ACTIVE'
        });
      }
      trustCase.status = 'RESOLVED';
      actionSummary = 'Shop and associated merchant account restored to active status.';
    }

    // 7. DISMISS_ALERT
    if (action === 'DISMISS_ALERT') {
      trustCase.status = 'DISMISSED';
      trustCase.resolvedBy = admin._id;
      trustCase.resolvedAt = new Date();
      trustCase.resolutionNotes = cleanReason;
      actionSummary = 'Alert dismissed as false positive or within normal operational variance.';
    }

    // Record action in case history
    trustCase.adminActions.push({
      action,
      adminId: admin._id,
      adminName: admin.name,
      reason: cleanReason,
      confirmed: !!confirmed,
      timestamp: new Date()
    });

    await trustCase.save();

    // Log to AdminAuditLog
    await AdminAuditLog.create({
      adminId: admin._id,
      action: `TRUST_ACTION_${action}`,
      entityType: 'TRUST_CASE',
      entityId: trustCase._id,
      reason: cleanReason,
      metadata: {
        caseNumber: trustCase.caseNumber,
        action,
        actionSummary,
        targetType: trustCase.targetType,
        productId: trustCase.productId,
        shopId: trustCase.shopId
      }
    });

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: actionSummary,
      data: { trustCase }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate or refresh AI advisory briefing for a case
 * POST /api/admin/trust/cases/:caseId/generate-ai-advisory
 */
export const generateAiAdvisoryForCase = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const trustCase = await TrustCase.findById(caseId)
      .populate('productId')
      .populate('shopId')
      .populate('reportIds')
      .lean();

    if (!trustCase) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Trust case not found.'
      });
    }

    const targetData = trustCase.targetType === 'PRODUCT' ? trustCase.productId : trustCase.shopId;

    const advisory = await generateTrustAdvisory({
      targetData,
      targetType: trustCase.targetType,
      signals: trustCase.signals || [],
      reports: trustCase.reportIds || []
    });

    await TrustCase.findByIdAndUpdate(caseId, {
      $set: { aiAdvisory: advisory }
    });

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Advisory analysis generated successfully.',
      data: { aiAdvisory: advisory }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Trigger platform-wide automated trust scan
 * POST /api/admin/trust/scan
 */
export const triggerPlatformScan = async (req, res, next) => {
  try {
    const results = await runPlatformTrustScan();

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Platform trust scan completed successfully.',
      data: { results }
    });
  } catch (err) {
    next(err);
  }
};
