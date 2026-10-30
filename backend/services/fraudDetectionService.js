import crypto from 'crypto';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import Order from '../models/Order.js';
import Report from '../models/Report.js';
import TrustCase from '../models/TrustCase.js';
import { logger } from '../utils/logger.js';

/**
 * Configurable thresholds for explainable heuristic fraud detection
 */
export const FRAUD_THRESHOLDS = {
  // Price outlier multipliers compared against comparable category & brand medians
  PRICE_MULTIPLIER_HIGH: 3.0,     // 300% above benchmark
  PRICE_MULTIPLIER_LOW_NEW: 0.25, // 75% below benchmark for NEW condition parts
  PRICE_MULTIPLIER_LOW_USED: 0.10, // 90% below benchmark for USED parts (used parts legitimately sell at deep discount)
  MIN_COMPARABLE_COUNT: 2,         // Minimum comparable parts needed to compute a reliable price benchmark
  
  // Shop cancellation anomaly threshold
  MIN_ORDERS_FOR_CANCELLATION_ANALYSIS: 5,
  MAX_ACCEPTABLE_CANCELLATION_RATE: 0.40, // 40% cancellation rate triggers review
  
  // Escalation thresholds
  REPORTS_THRESHOLD_FOR_CASE: 2 // 2 or more distinct customer reports trigger case
};

// Known placeholder patterns often used in fake or spam listings
const SUSPICIOUS_PART_NUMBER_REGEX = /^(0+|12345+|n\/?a|none|null|test|tbd|pending|sample|xxx+|unknown)$/i;

/**
 * Generate a friendly, collision-free Trust Case Number: TC-YYMMDD-XXXX
 */
export const generateCaseNumber = () => {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TC-${dateStr}-${rand}`;
};

/**
 * Analyze a single spare part listing using explainable heuristic rules
 * @param {Object} part - The SparePart mongoose doc or object
 * @returns {Array<Object>} List of triggered signals
 */
export const analyzeListingSignals = async (part) => {
  const signals = [];

  if (!part) return signals;

  // -------------------------------------------------------------
  // RULE 1: Missing or Inconsistent Product Identifiers (SKU / Part#)
  // -------------------------------------------------------------
  const cleanPartNum = (part.partNumber || '').trim();
  if (!cleanPartNum || cleanPartNum.length < 3 || SUSPICIOUS_PART_NUMBER_REGEX.test(cleanPartNum)) {
    signals.push({
      ruleId: 'INVALID_OR_PLACEHOLDER_SKU',
      name: 'Placeholder or Invalid Part Number',
      severity: 'HIGH',
      reason: `Part number "${cleanPartNum || 'EMPTY'}" matches placeholder or unverified format patterns. Authentic listings should carry legitimate OEM or manufacturer part identifiers.`,
      metadata: { partNumber: cleanPartNum }
    });
  }

  // -------------------------------------------------------------
  // RULE 2: Duplicate Listing within Same Shop
  // -------------------------------------------------------------
  if (cleanPartNum && part.shopId) {
    const duplicateInShop = await SparePart.countDocuments({
      shopId: part.shopId,
      _id: { $ne: part._id },
      partNumber: cleanPartNum,
      isArchived: false
    });

    if (duplicateInShop > 0) {
      signals.push({
        ruleId: 'DUPLICATE_LISTING',
        name: 'Repeated Identical Listing in Shop',
        severity: 'MEDIUM',
        reason: `Shop has ${duplicateInShop} other active listing(s) sharing identical part number "${cleanPartNum}". Duplicate listings may confuse buyers or artificially inflate store presence.`,
        metadata: { duplicateCount: duplicateInShop, partNumber: cleanPartNum }
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 3: Specification and Category Inconsistency
  // -------------------------------------------------------------
  const vehicleType = part.vehicleType;
  const engineDetails = (part.engineDetails || '').toLowerCase();
  
  if (vehicleType === 'Bicycle') {
    if (engineDetails.includes('cc') || engineDetails.includes('cylinder') || engineDetails.includes('turbo') || engineDetails.includes('v6') || engineDetails.includes('v8')) {
      signals.push({
        ruleId: 'SPECIFICATION_MISMATCH',
        name: 'Incompatible Vehicle Specs',
        severity: 'HIGH',
        reason: `Declared vehicle type is "Bicycle", but engine specification specifies "${part.engineDetails}". Contradictory vehicle specifications confuse compatibility matching.`,
        metadata: { vehicleType, engineDetails: part.engineDetails }
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 4: Outlier Price Comparison
  // Note: Only compare appropriate parts (same category, manufacturer, or compatible vehicleType).
  // Always consider condition: Legitimate USED parts are never flagged for lower price!
  // -------------------------------------------------------------
  if (part.price > 0 && part.category) {
    const query = {
      _id: { $ne: part._id },
      category: part.category,
      isArchived: false,
      price: { $gt: 0 }
    };

    // If manufacturer is present, compare within same manufacturer for accuracy
    if (part.manufacturer) {
      query.manufacturer = new RegExp(`^${part.manufacturer.trim()}$`, 'i');
    }

    const comparableParts = await SparePart.find(query)
      .select('price condition partName')
      .limit(20)
      .lean();

    if (comparableParts.length >= FRAUD_THRESHOLDS.MIN_COMPARABLE_COUNT) {
      const prices = comparableParts.map((p) => p.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Upper price outlier check (> 300% of comparable average)
      if (part.price > avgPrice * FRAUD_THRESHOLDS.PRICE_MULTIPLIER_HIGH) {
        signals.push({
          ruleId: 'PRICE_OUTLIER_HIGH',
          name: 'Significantly Higher Price Than Comparable Items',
          severity: 'MEDIUM',
          reason: `Listing price (₹${part.price.toFixed(2)}) is more than ${(FRAUD_THRESHOLDS.PRICE_MULTIPLIER_HIGH * 100).toFixed(0)}% above the benchmark average (₹${avgPrice.toFixed(2)}) for "${part.category}" (${part.manufacturer || 'General'}). Review for potential pricing error.`,
          metadata: { price: part.price, benchmarkAvg: avgPrice, sampleCount: comparableParts.length }
        });
      }

      // Lower price outlier check:
      // NEW parts < 25% of average trigger review.
      // Legitimate USED parts allow down to 10% before triggering to prevent false positives!
      const isUsed = part.condition === 'USED';
      const lowMultiplier = isUsed
        ? FRAUD_THRESHOLDS.PRICE_MULTIPLIER_LOW_USED
        : FRAUD_THRESHOLDS.PRICE_MULTIPLIER_LOW_NEW;

      if (part.price < avgPrice * lowMultiplier) {
        signals.push({
          ruleId: 'PRICE_OUTLIER_LOW',
          name: isUsed ? 'Extreme Price Drop (Used Condition)' : 'Unusually Low Price For New Part',
          severity: isUsed ? 'LOW' : 'MEDIUM',
          reason: `Listing price (₹${part.price.toFixed(2)}) is below ${(lowMultiplier * 100).toFixed(0)}% of category average (₹${avgPrice.toFixed(2)}). ${isUsed ? 'Used parts may carry normal wear, but extreme low pricing warrants inspection.' : 'Review to verify genuine product authenticity.'}`,
          metadata: { price: part.price, benchmarkAvg: avgPrice, condition: part.condition }
        });
      }
    }
  }

  return signals;
};

/**
 * Analyze shop-level trust and operational signals
 * @param {String|ObjectId} shopId
 * @returns {Array<Object>} List of triggered shop signals
 */
export const analyzeShopSignals = async (shopId) => {
  const signals = [];
  const shop = await Shop.findById(shopId).lean();
  if (!shop) return signals;

  // -------------------------------------------------------------
  // RULE 5: Abnormal Order Cancellation Rate (requires min 5 orders)
  // -------------------------------------------------------------
  const orders = await Order.find({ 'items.shopId': shopId })
    .select('orderStatus items')
    .lean();

  if (orders.length >= FRAUD_THRESHOLDS.MIN_ORDERS_FOR_CANCELLATION_ANALYSIS) {
    const cancelledCount = orders.filter((o) => o.orderStatus === 'CANCELLED').length;
    const cancellationRate = cancelledCount / orders.length;

    if (cancellationRate >= FRAUD_THRESHOLDS.MAX_ACCEPTABLE_CANCELLATION_RATE) {
      signals.push({
        ruleId: 'HIGH_CANCELLATION_RATE',
        name: 'Elevated Order Cancellation Frequency',
        severity: 'HIGH',
        reason: `Shop has a ${(cancellationRate * 100).toFixed(1)}% cancellation rate across ${orders.length} total orders (${cancelledCount} cancelled). Excessive cancellations can indicate inventory phantom listing or unfulfilled orders.`,
        metadata: { totalOrders: orders.length, cancelledCount, cancellationRate }
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 6: Customer Complaint Aggregation
  // -------------------------------------------------------------
  const pendingReportsCount = await Report.countDocuments({
    shopId,
    status: { $in: ['PENDING', 'INVESTIGATING'] }
  });

  if (pendingReportsCount >= FRAUD_THRESHOLDS.REPORTS_THRESHOLD_FOR_CASE) {
    signals.push({
      ruleId: 'MULTIPLE_CUSTOMER_REPORTS',
      name: 'Accumulated Customer Reports',
      severity: 'HIGH',
      reason: `Shop has accumulated ${pendingReportsCount} active complaints submitted by customers. Human administrative investigation is advised.`,
      metadata: { pendingReportsCount }
    });
  }

  return signals;
};

/**
 * Scan a product and create or update an associated TrustCase if signals exist
 */
export const evaluateProductTrust = async (partId) => {
  const part = await SparePart.findById(partId).lean();
  if (!part) return null;

  const signals = await analyzeListingSignals(part);

  // Also check if any reports exist for this product
  const reports = await Report.find({ productId: part._id }).lean();
  const reportIds = reports.map((r) => r._id);

  if (signals.length === 0 && reports.length === 0) {
    return null;
  }

  // Determine highest severity
  let severity = 'LOW';
  if (signals.some((s) => s.severity === 'CRITICAL')) severity = 'CRITICAL';
  else if (signals.some((s) => s.severity === 'HIGH') || reports.length >= 2) severity = 'HIGH';
  else if (signals.some((s) => s.severity === 'MEDIUM')) severity = 'MEDIUM';

  // Check if an existing open case is already tracking this product
  let trustCase = await TrustCase.findOne({
    productId: part._id,
    status: { $in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] }
  });

  if (!trustCase) {
    trustCase = new TrustCase({
      caseNumber: generateCaseNumber(),
      caseType: reports.length > 0 ? (signals.length > 0 ? 'COMPOSITE_ALERT' : 'USER_REPORT') : 'LISTING_ANOMALY',
      targetType: 'PRODUCT',
      productId: part._id,
      shopId: part.shopId,
      ownerId: part.ownerId,
      status: 'OPEN',
      severity,
      signals,
      reportIds,
      reportCount: reportIds.length
    });
  } else {
    // Update existing open case with fresh signals and reports
    trustCase.signals = signals;
    trustCase.reportIds = reportIds;
    trustCase.reportCount = reportIds.length;
    trustCase.severity = severity;
    if (reports.length > 0 && signals.length > 0) {
      trustCase.caseType = 'COMPOSITE_ALERT';
    }
  }

  await trustCase.save();

  // Link report caseId
  if (reportIds.length > 0) {
    await Report.updateMany({ _id: { $in: reportIds } }, { $set: { caseId: trustCase._id } });
  }

  return trustCase;
};

/**
 * Scan a shop and create or update an associated TrustCase if signals exist
 */
export const evaluateShopTrust = async (shopId) => {
  const shop = await Shop.findById(shopId).lean();
  if (!shop) return null;

  const signals = await analyzeShopSignals(shopId);
  const reports = await Report.find({ shopId: shop._id, targetType: 'SHOP' }).lean();
  const reportIds = reports.map((r) => r._id);

  if (signals.length === 0 && reports.length === 0) {
    return null;
  }

  let severity = 'MEDIUM';
  if (signals.some((s) => s.severity === 'HIGH') || reports.length >= 3) severity = 'HIGH';

  let trustCase = await TrustCase.findOne({
    shopId: shop._id,
    targetType: 'SHOP',
    status: { $in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] }
  });

  if (!trustCase) {
    trustCase = new TrustCase({
      caseNumber: generateCaseNumber(),
      caseType: reports.length > 0 ? (signals.length > 0 ? 'COMPOSITE_ALERT' : 'USER_REPORT') : 'SHOP_TRUST_ALERT',
      targetType: 'SHOP',
      shopId: shop._id,
      ownerId: shop.ownerId,
      status: 'OPEN',
      severity,
      signals,
      reportIds,
      reportCount: reportIds.length
    });
  } else {
    trustCase.signals = signals;
    trustCase.reportIds = reportIds;
    trustCase.reportCount = reportIds.length;
    trustCase.severity = severity;
  }

  await trustCase.save();

  if (reportIds.length > 0) {
    await Report.updateMany({ _id: { $in: reportIds } }, { $set: { caseId: trustCase._id } });
  }

  return trustCase;
};

/**
 * Batch scan active listings and shops across the platform
 */
export const runPlatformTrustScan = async () => {
  const results = {
    listingsScanned: 0,
    listingCasesCreatedOrUpdated: 0,
    shopsScanned: 0,
    shopCasesCreatedOrUpdated: 0
  };

  const activeParts = await SparePart.find({ isArchived: false, isPublished: true }).limit(200);
  results.listingsScanned = activeParts.length;

  for (const part of activeParts) {
    const c = await evaluateProductTrust(part._id);
    if (c) results.listingCasesCreatedOrUpdated++;
  }

  const approvedShops = await Shop.find({ isApproved: true, isActive: true }).limit(100);
  results.shopsScanned = approvedShops.length;

  for (const shop of approvedShops) {
    const c = await evaluateShopTrust(shop._id);
    if (c) results.shopCasesCreatedOrUpdated++;
  }

  return results;
};
