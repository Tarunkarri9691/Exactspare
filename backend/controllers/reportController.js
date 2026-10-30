import Report from '../models/Report.js';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { evaluateProductTrust, evaluateShopTrust } from '../services/fraudDetectionService.js';
import { logger } from '../utils/logger.js';

const ALLOWED_CATEGORIES = [
  'INCORRECT_INFO',
  'SUSPECTED_COUNTERFEIT',
  'MISLEADING_PRICING',
  'INCORRECT_COMPATIBILITY',
  'UNRESPONSIVE_SHOP',
  'OTHER'
];

/**
 * Submit a report for a spare part product
 * POST /api/reports/products/:productId
 */
export const reportProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { category, description, orderId, evidenceUrls } = req.body;
    const userId = req.user._id;

    // 1. Validate category
    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Invalid report category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    // 2. Validate description
    const cleanDesc = (description || '').trim();
    if (cleanDesc.length < 10) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Report description must be at least 10 characters long explaining your concern.'
      });
    }
    if (cleanDesc.length > 2000) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Report description cannot exceed 2000 characters.'
      });
    }

    // 3. Verify product exists
    const part = await SparePart.findById(productId);
    if (!part) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Target spare part not found.'
      });
    }

    // 4. Duplicate report prevention: Check if user reported this exact product in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingReport = await Report.findOne({
      reporterId: userId,
      productId: part._id,
      createdAt: { $gte: oneDayAgo }
    });

    if (existingReport) {
      return res.status(429).json({
        status: 'error',
        statusCode: 429,
        message: 'You have already submitted a report for this product recently. Our Trust & Safety team is reviewing the matter.'
      });
    }

    // 5. Create report
    const report = new Report({
      reporterId: userId,
      targetType: 'PRODUCT',
      productId: part._id,
      shopId: part.shopId,
      orderId: orderId || null,
      category,
      description: cleanDesc,
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : []
    });

    await report.save();

    // 6. Asynchronously update/trigger trust case evaluation
    evaluateProductTrust(part._id).catch((err) => {
      logger.error(`Error evaluating product trust after report: ${err.message}`);
    });

    return res.status(201).json({
      status: 'success',
      statusCode: 201,
      message: 'Thank you for your report. Our marketplace trust team will investigate your feedback.',
      data: {
        reportId: report._id,
        category: report.category,
        createdAt: report.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit a report for a shop
 * POST /api/reports/shops/:shopId
 */
export const reportShop = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    const { category, description, orderId, evidenceUrls } = req.body;
    const userId = req.user._id;

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Invalid report category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    const cleanDesc = (description || '').trim();
    if (cleanDesc.length < 10) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Report description must be at least 10 characters long explaining your concern.'
      });
    }
    if (cleanDesc.length > 2000) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Report description cannot exceed 2000 characters.'
      });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Target shop not found.'
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingReport = await Report.findOne({
      reporterId: userId,
      shopId: shop._id,
      targetType: 'SHOP',
      createdAt: { $gte: oneDayAgo }
    });

    if (existingReport) {
      return res.status(429).json({
        status: 'error',
        statusCode: 429,
        message: 'You have already submitted a report for this shop recently. Our Trust & Safety team is reviewing the matter.'
      });
    }

    const report = new Report({
      reporterId: userId,
      targetType: 'SHOP',
      shopId: shop._id,
      orderId: orderId || null,
      category,
      description: cleanDesc,
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : []
    });

    await report.save();

    evaluateShopTrust(shop._id).catch((err) => {
      logger.error(`Error evaluating shop trust after report: ${err.message}`);
    });

    return res.status(201).json({
      status: 'success',
      statusCode: 201,
      message: 'Thank you for your report. Our marketplace trust team will investigate your feedback.',
      data: {
        reportId: report._id,
        category: report.category,
        createdAt: report.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get reports submitted by current authenticated user
 * GET /api/reports/my-reports
 * Note: Reporter identity is private, and internal fraud scores/admin notes are excluded
 */
export const getMyReports = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const reports = await Report.find({ reporterId: userId })
      .populate('productId', 'partName partNumber price category')
      .populate('shopId', 'name category address')
      .select('targetType category description status createdAt resolvedAt productId shopId')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      data: {
        reports,
        total: reports.length
      }
    });
  } catch (err) {
    next(err);
  }
};
