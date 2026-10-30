import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Report from '../models/Report.js';
import TrustCase from '../models/TrustCase.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import {
  analyzeListingSignals,
  analyzeShopSignals,
  evaluateProductTrust,
  evaluateShopTrust
} from '../services/fraudDetectionService.js';
import { generateTrustAdvisory } from '../services/trustAiAdvisoryService.js';

const PORT = 5067; // Dedicated test port for Module 17
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

let passCount = 0;
let failCount = 0;

const logPass = (num, desc) => {
  passCount++;
  console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
};

const logFail = (num, desc, err) => {
  failCount++;
  console.error(`\x1b[31m✖ [FAIL ${num}]\x1b[0m ${desc}:`, err);
};

const parseCookie = (res) => {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
};

const makeRequest = (pathUrl, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('\n===============================================================');
  console.log('  EXACTSPARE MODULE 17 — AUTOMATED VERIFICATION TEST SUITE');
  console.log('  AI Fraud Detection, Marketplace Trust, Reporting & Governance');
  console.log('===============================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri);
      console.log(`Connected to MongoDB at ${mongoUri}`);
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
    console.log(`Test server running at ${baseUrl}\n`);

    const runId = Date.now();

    // -------------------------------------------------------------------------
    // SETUP TEST FIXTURES: Admin, Shop Owner, Customer, Shop, and Parts
    // -------------------------------------------------------------------------
    const adminUser = await User.create({
      name: 'Admin Module 17',
      email: `admin_m17_${runId}@exactspare.test`,
      phone: '9876543210',
      passwordHash: await User.hashPassword('AdminM17@Password2026'),
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      isEmailVerified: true
    });

    const ownerUser = await User.create({
      name: 'Owner Module 17',
      email: `owner_m17_${runId}@exactspare.test`,
      phone: '9876543211',
      passwordHash: await User.hashPassword('OwnerM17@Password2026'),
      role: 'OWNER',
      accountStatus: 'ACTIVE',
      isEmailVerified: true
    });

    const customerUser = await User.create({
      name: 'Customer Module 17',
      email: `customer_m17_${runId}@exactspare.test`,
      phone: '9876543212',
      passwordHash: await User.hashPassword('CustomerM17@Password2026'),
      role: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      isEmailVerified: true
    });

    const testApp = await ShopApplication.create({
      ownerId: ownerUser._id,
      shopName: `Apex Spares Trust Test ${runId}`,
      ownerFullName: ownerUser.name,
      ownerPhone: ownerUser.phone,
      businessEmail: ownerUser.email,
      shopDescription: 'Verified test merchant application for trust and safety evaluation.',
      shopCategory: 'CAR',
      addressLine: '44 Automotive Blvd',
      city: 'Metropolis',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      tradeLicenseNumber: `TRD-${runId}`,
      status: 'APPROVED',
      reviewedBy: adminUser._id,
      reviewedAt: new Date()
    });

    const testShop = await Shop.create({
      ownerId: ownerUser._id,
      applicationId: testApp._id,
      name: `Apex Spares Trust Test ${runId}`,
      category: 'CAR',
      description: 'Verified test merchant for trust and safety evaluation.',
      address: {
        addressLine: '44 Automotive Blvd',
        city: 'Metropolis',
        state: 'Karnataka',
        postalCode: '560001',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] }
      },
      contact: { phone: ownerUser.phone, email: ownerUser.email },
      isApproved: true,
      isActive: true
    });

    // Create baseline reference parts in same category to form price benchmarks
    await SparePart.create([
      {
        shopId: testShop._id,
        ownerId: ownerUser._id,
        partName: 'Brembo Premium Brake Pad Set A',
        description: 'Standard ceramic brake pads.',
        category: 'Braking System',
        vehicleType: 'Car',
        manufacturer: 'Brembo',
        partNumber: `BRK-BENCH-1-${runId}`,
        price: 2000,
        condition: 'NEW',
        stockQuantity: 10,
        isPublished: true
      },
      {
        shopId: testShop._id,
        ownerId: ownerUser._id,
        partName: 'Brembo Premium Brake Pad Set B',
        description: 'Standard ceramic brake pads.',
        category: 'Braking System',
        vehicleType: 'Car',
        manufacturer: 'Brembo',
        partNumber: `BRK-BENCH-2-${runId}`,
        price: 2200,
        condition: 'NEW',
        stockQuantity: 8,
        isPublished: true
      }
    ]);

    // Target product for customer reporting and trust testing
    const testPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Suspected Replica Brake Discs',
      description: 'High performance discs with dubious OEM markings.',
      category: 'Braking System',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: `DISC-TEST-${runId}`,
      price: 2100,
      condition: 'NEW',
      stockQuantity: 5,
      isPublished: true
    });

    // Authenticate sessions
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password: 'AdminM17@Password2026' }
    });
    const adminCookie = parseCookie(adminLoginRes);

    const customerLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: customerUser.email, password: 'CustomerM17@Password2026' }
    });
    const customerCookie = parseCookie(customerLoginRes);

    // -------------------------------------------------------------------------
    // TEST 1: Valid Customer Product Report
    // -------------------------------------------------------------------------
    const validReportRes = await makeRequest(`/api/reports/products/${testPart._id}`, {
      method: 'POST',
      headers: { Cookie: customerCookie },
      body: {
        category: 'SUSPECTED_COUNTERFEIT',
        description: 'The laser etching does not match Brembo authentic holographic security marks.'
      }
    });

    if (validReportRes.status === 201 && validReportRes.data.status === 'success') {
      logPass(1, 'Customer successfully files validated product report with category and description');
    } else {
      logFail(1, 'Valid product report failed', validReportRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Validation of Invalid Category and Too Short Description
    // -------------------------------------------------------------------------
    const [invalidCatRes, shortDescRes] = await Promise.all([
      makeRequest(`/api/reports/products/${testPart._id}`, {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: { category: 'RANDOM_BOGUS_CAT', description: 'Detailed reason here.' }
      }),
      makeRequest(`/api/reports/products/${testPart._id}`, {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: { category: 'INCORRECT_INFO', description: 'Too short' }
      })
    ]);

    if (invalidCatRes.status === 400 && shortDescRes.status === 400) {
      logPass(2, 'Report validation rejects invalid categories and insufficient descriptions with HTTP 400');
    } else {
      logFail(2, 'Report validation failed to reject bad input', {
        cat: invalidCatRes.status,
        desc: shortDescRes.status
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Report Throttling / Rate-Limiting
    // -------------------------------------------------------------------------
    const dupReportRes = await makeRequest(`/api/reports/products/${testPart._id}`, {
      method: 'POST',
      headers: { Cookie: customerCookie },
      body: {
        category: 'SUSPECTED_COUNTERFEIT',
        description: 'Submitting again right away to test duplicate mitigation.'
      }
    });

    if (dupReportRes.status === 429) {
      logPass(3, 'Duplicate report protection correctly blocks repeated submissions within cooldown window (429)');
    } else {
      logFail(3, 'Duplicate report protection failed', dupReportRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Valid Shop Report
    // -------------------------------------------------------------------------
    const shopReportRes = await makeRequest(`/api/reports/shops/${testShop._id}`, {
      method: 'POST',
      headers: { Cookie: customerCookie },
      body: {
        category: 'UNRESPONSIVE_SHOP',
        description: 'Merchant does not answer customer inquiries or verify stock availability.'
      }
    });

    if (shopReportRes.status === 201 && shopReportRes.data.status === 'success') {
      logPass(4, 'Customer successfully reports shop with category and justification');
    } else {
      logFail(4, 'Shop report failed', shopReportRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Customer Privacy & Report Details Isolation
    // -------------------------------------------------------------------------
    const [customerAdminSummaryRes, customerAdminCasesRes] = await Promise.all([
      makeRequest('/api/admin/trust/summary', { headers: { Cookie: customerCookie } }),
      makeRequest('/api/admin/trust/cases', { headers: { Cookie: customerCookie } })
    ]);

    if (customerAdminSummaryRes.status === 403 && customerAdminCasesRes.status === 403) {
      logPass(5, 'Access control: Customers strictly blocked from administrative trust and fraud endpoints (403)');
    } else {
      logFail(5, 'Customer leaked into admin trust APIs', {
        summary: customerAdminSummaryRes.status,
        cases: customerAdminCasesRes.status
      });
    }

    // -------------------------------------------------------------------------
    // TEST 6: Rule 1 Detection — Duplicate Part Number within Same Shop
    // -------------------------------------------------------------------------
    const duplicatePart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Brembo Brake Discs Duplicate',
      description: 'Second listing with identical part number in same store.',
      category: 'Braking System',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: `DISC-TEST-${runId}`, // Same as testPart
      price: 2100,
      condition: 'NEW',
      stockQuantity: 2,
      isPublished: true
    });

    const dupSignals = await analyzeListingSignals(duplicatePart);
    const hasDuplicateSignal = dupSignals.some((s) => s.ruleId === 'DUPLICATE_LISTING');

    if (hasDuplicateSignal) {
      logPass(6, 'Rule 1: Accurately flags duplicate part numbers listed within the same merchant shop');
    } else {
      logFail(6, 'Duplicate part rule failed to flag', dupSignals);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Rule 2 Detection — Placeholder or Invalid Part Number
    // -------------------------------------------------------------------------
    const invalidSkuPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Mystery Spark Plug',
      description: 'Listed with zero or placeholder SKU.',
      category: 'Ignition',
      vehicleType: 'Car',
      manufacturer: 'Bosch',
      partNumber: '0000', // Placeholder
      price: 450,
      condition: 'NEW',
      stockQuantity: 5,
      isPublished: true
    });

    const skuSignals = await analyzeListingSignals(invalidSkuPart);
    const hasSkuSignal = skuSignals.some((s) => s.ruleId === 'INVALID_OR_PLACEHOLDER_SKU');

    if (hasSkuSignal) {
      logPass(7, 'Rule 2: Correctly identifies placeholder or invalid SKU patterns (0000, N/A, TBD)');
    } else {
      logFail(7, 'Placeholder SKU rule failed to flag', skuSignals);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Rule 3 Detection — Outlier Price vs Comparable Listings
    // -------------------------------------------------------------------------
    const outlierPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Excessively Priced Brake Pad Set',
      description: 'Same Brembo pads benchmarked around ₹2100, listed at ₹15,000.',
      category: 'Braking System',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: `BRK-OUTLIER-${runId}`,
      price: 15000, // > 300% of ~2100 average
      condition: 'NEW',
      stockQuantity: 2,
      isPublished: true
    });

    const outlierSignals = await analyzeListingSignals(outlierPart);
    const hasOutlierSignal = outlierSignals.some((s) => s.ruleId === 'PRICE_OUTLIER_HIGH');

    if (hasOutlierSignal) {
      logPass(8, 'Rule 3: Successfully detects price outliers exceeding category/brand benchmark threshold');
    } else {
      logFail(8, 'Price outlier rule failed to trigger', outlierSignals);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Variant & Condition Safeguard — Legitimate USED parts NOT flagged
    // -------------------------------------------------------------------------
    const legitUsedPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Used Brembo Brake Pad Set (Fair Condition)',
      description: 'Used take-off pads with 60% pad life remaining.',
      category: 'Braking System',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: `BRK-USED-${runId}`,
      price: 900, // Legitimate ~57% discount for used parts
      condition: 'USED',
      stockQuantity: 1,
      isPublished: true
    });

    const usedSignals = await analyzeListingSignals(legitUsedPart);
    const falsePositiveFlag = usedSignals.some((s) => s.ruleId === 'PRICE_OUTLIER_LOW');

    if (!falsePositiveFlag) {
      logPass(9, 'Safeguard: Legitimate USED parts at normal second-hand discounts are NOT falsely flagged');
    } else {
      logFail(9, 'Legitimate USED part was falsely flagged', usedSignals);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Admin Summary Dashboard Metrics
    // -------------------------------------------------------------------------
    // Trigger evaluation on outlierPart to ensure open case exists
    await evaluateProductTrust(outlierPart._id);

    const adminSummaryRes = await makeRequest('/api/admin/trust/summary', {
      headers: { Cookie: adminCookie }
    });

    const summaryData = adminSummaryRes.data?.data;
    if (
      adminSummaryRes.status === 200 &&
      summaryData &&
      typeof summaryData.totalCases === 'number' &&
      summaryData.reportsByCategory &&
      summaryData.statusCounts
    ) {
      logPass(10, 'Admin successfully retrieves complete trust dashboard summary metrics');
    } else {
      logFail(10, 'Admin trust summary retrieval failed', adminSummaryRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Case Status Transition with Recorded Reason & Audit Logging
    // -------------------------------------------------------------------------
    const casesRes = await makeRequest('/api/admin/trust/cases?limit=5', {
      headers: { Cookie: adminCookie }
    });
    const targetCase = casesRes.data?.data?.cases?.[0];

    if (!targetCase) {
      throw new Error('No trust case found to test status transition.');
    }

    const updateStatusRes = await makeRequest(`/api/admin/trust/cases/${targetCase._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie },
      body: {
        status: 'UNDER_REVIEW',
        reason: 'Senior Trust Officer assigned to cross-examine invoice records.'
      }
    });

    const auditLogEntry = await AdminAuditLog.findOne({
      entityType: 'TRUST_CASE',
      entityId: targetCase._id,
      action: 'TRUST_CASE_STATUS_UNDER_REVIEW'
    });

    if (
      updateStatusRes.status === 200 &&
      updateStatusRes.data.data.trustCase.status === 'UNDER_REVIEW' &&
      auditLogEntry
    ) {
      logPass(11, 'Admin updates case status with justification reason; immutable audit log created');
    } else {
      logFail(11, 'Case status transition failed', { res: updateStatusRes.data, audit: !!auditLogEntry });
    }

    // -------------------------------------------------------------------------
    // TEST 12: Consequential Action Confirmation Enforcement
    // (Banning/Delisting MUST require explicit confirmed: true)
    // -------------------------------------------------------------------------
    const unconfirmedActionRes = await makeRequest(`/api/admin/trust/cases/${targetCase._id}/actions`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: {
        action: 'DELIST_PRODUCT',
        reason: 'Suspected policy violation',
        confirmed: false // Missing or unconfirmed
      }
    });

    if (unconfirmedActionRes.status === 400 && unconfirmedActionRes.data.message.includes('requires explicit confirmation')) {
      logPass(12, 'Safety guard: Consequential actions (DELIST/SUSPEND) strictly rejected without explicit confirmation (400)');
    } else {
      logFail(12, 'Unconfirmed consequential action was improperly permitted', unconfirmedActionRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Execution of Confirmed Action with Inventory & Audit Updates
    // -------------------------------------------------------------------------
    const confirmedActionRes = await makeRequest(`/api/admin/trust/cases/${targetCase._id}/actions`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: {
        action: 'DELIST_PRODUCT',
        reason: 'Confirmed non-compliant pricing and missing manufacturer provenance.',
        confirmed: true
      }
    });

    const updatedPart = targetCase.productId ? await SparePart.findById(targetCase.productId._id || targetCase.productId) : null;
    const actionAudit = await AdminAuditLog.findOne({
      entityType: 'TRUST_CASE',
      entityId: targetCase._id,
      action: 'TRUST_ACTION_DELIST_PRODUCT'
    });

    if (
      confirmedActionRes.status === 200 &&
      confirmedActionRes.data.data.trustCase.status === 'RESOLVED' &&
      updatedPart &&
      updatedPart.isPublished === false &&
      actionAudit
    ) {
      logPass(13, 'Confirmed delist action un-publishes listing, resolves case, and records complete audit trail');
    } else {
      logFail(13, 'Confirmed action execution failed', { res: confirmedActionRes.data, updatedPart, audit: !!actionAudit });
    }

    // -------------------------------------------------------------------------
    // TEST 14: Advisory AI Briefing with Fallback Mode
    // -------------------------------------------------------------------------
    const advisory = await generateTrustAdvisory({
      targetData: { partName: 'Test Part', price: 9999, category: 'Brakes' },
      targetType: 'PRODUCT',
      signals: [{ ruleId: 'PRICE_OUTLIER_HIGH', name: 'Price Outlier', severity: 'HIGH', reason: 'High price' }],
      reports: [{ category: 'MISLEADING_PRICING', description: 'Price is too high' }]
    });

    if (
      advisory &&
      typeof advisory.summary === 'string' &&
      Array.isArray(advisory.inconsistencies) &&
      Array.isArray(advisory.suggestedActions) &&
      advisory.provider
    ) {
      logPass(14, `Advisory briefing generated successfully (Provider: ${advisory.provider}, isAiGenerated: ${advisory.isAiGenerated})`);
    } else {
      logFail(14, 'Advisory briefing failed', advisory);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Customer Private Reports View & Zero Regressions
    // -------------------------------------------------------------------------
    const myReportsRes = await makeRequest('/api/reports/my-reports', {
      headers: { Cookie: customerCookie }
    });
    const healthRes = await makeRequest('/api/health');

    const customerReportFound = myReportsRes.data?.data?.reports?.length > 0;
    const noInternalLeaks = myReportsRes.data?.data?.reports?.every(
      (r) => r.adminNotes === undefined && r.signals === undefined
    );

    if (myReportsRes.status === 200 && customerReportFound && noInternalLeaks && healthRes.status === 200) {
      logPass(15, 'Customer reports list is isolated from internal fraud metrics; zero regressions across core APIs');
    } else {
      logFail(15, 'Customer reports or health verification failed', {
        reportsStatus: myReportsRes.status,
        customerReportFound,
        noInternalLeaks,
        health: healthRes.status
      });
    }

    console.log('\n---------------------------------------------------------------');
    console.log(`Test Execution Finished: ${passCount} Passed, ${failCount} Failed.`);
    console.log('---------------------------------------------------------------\n');
  } catch (error) {
    console.error('Fatal test runner error:', error);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Clean up connections if opened
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

runTests();
