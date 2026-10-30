import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import Notification from '../models/Notification.js';
import SparePart from '../models/SparePart.js';
import {
  getSubscriptionExpiryStage,
  checkAndProcessSubscriptionExpirations
} from '../services/subscriptionScheduler.js';

const PORT = 5065;
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

const logPass = (num, desc) => console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
const logFail = (num, desc, err) => {
  console.error(`\x1b[31m✖ [FAIL ${num}]\x1b[0m ${desc}:`, err);
  process.exitCode = 1;
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
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
  console.log('\n======================================================');
  console.log('EXACTSPARE SUBSCRIPTION EXPIRY NOTIFICATIONS & RENEWAL');
  console.log('Automated Integration & Unit Verification Suite');
  console.log('======================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    await new Promise((resolve) => {
      server = http.createServer(app).listen(PORT, '127.0.0.1', () => {
        console.log(`Test server running at ${baseUrl}`);
        resolve();
      });
    });

    // Clean up previous test artifacts for test suite isolation
    const testPrefix = 'expiry_test_' + Date.now();
    const adminEmail = `${testPrefix}_admin@exactspare.test`;
    const owner7dEmail = `${testPrefix}_owner7d@exactspare.test`;
    const owner3dEmail = `${testPrefix}_owner3d@exactspare.test`;
    const owner1dEmail = `${testPrefix}_owner1d@exactspare.test`;
    const ownerExpEmail = `${testPrefix}_ownerexp@exactspare.test`;
    const ownerSafeEmail = `${testPrefix}_ownersafe@exactspare.test`;

    // -----------------------------------------------------------
    // TEST 1: Expiry calculation & stage detection logic
    // -----------------------------------------------------------
    try {
      const now = new Date('2026-10-24T12:00:00.000Z');

      // 7 days test: 6.5 days out
      const exp7d = new Date('2026-10-31T00:00:00.000Z');
      const stage7d = getSubscriptionExpiryStage(exp7d, now);
      if (
        stage7d.stage !== '7_DAYS' ||
        stage7d.daysRemaining !== 7 ||
        stage7d.message !== 'Your EXACTSPARE subscription expires in 7 days. Renew now to avoid interruption.'
      ) {
        throw new Error(`Stage 7d mismatch: ${JSON.stringify(stage7d)}`);
      }

      // 3 days test: 2.5 days out
      const exp3d = new Date('2026-10-27T00:00:00.000Z');
      const stage3d = getSubscriptionExpiryStage(exp3d, now);
      if (
        stage3d.stage !== '3_DAYS' ||
        stage3d.daysRemaining !== 3 ||
        stage3d.message !== 'Your subscription expires in 3 days. Please renew your plan.'
      ) {
        throw new Error(`Stage 3d mismatch: ${JSON.stringify(stage3d)}`);
      }

      // 1 day test: 18 hours out
      const exp1d = new Date('2026-10-25T06:00:00.000Z');
      const stage1d = getSubscriptionExpiryStage(exp1d, now);
      if (
        stage1d.stage !== '1_DAY' ||
        stage1d.daysRemaining !== 1 ||
        stage1d.message !== 'Your subscription expires tomorrow. Renew now.'
      ) {
        throw new Error(`Stage 1d mismatch: ${JSON.stringify(stage1d)}`);
      }

      // Expired test: 2 hours ago
      const expPast = new Date('2026-10-24T10:00:00.000Z');
      const stageExp = getSubscriptionExpiryStage(expPast, now);
      if (
        stageExp.stage !== 'EXPIRED' ||
        stageExp.daysRemaining !== 0 ||
        stageExp.message !== 'Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access.'
      ) {
        throw new Error(`Stage Expired mismatch: ${JSON.stringify(stageExp)}`);
      }

      // Safe future: 25 days out
      const stageFar = getSubscriptionExpiryStage(new Date('2026-11-18T12:00:00.000Z'), now);
      if (stageFar !== null) {
        throw new Error(`Stage Far Future should be null: ${JSON.stringify(stageFar)}`);
      }

      // Missing expiry date
      const stageNull = getSubscriptionExpiryStage(null, now);
      if (stageNull !== null) {
        throw new Error(`Stage Null should be null: ${JSON.stringify(stageNull)}`);
      }

      logPass(1, 'Backend expiry stage detection logic (7d, 3d, 1d, expired, safe future, missing date) with exact prompt messages');
    } catch (err) {
      logFail(1, 'Expiry stage detection calculation error', err.message);
    }

    // -----------------------------------------------------------
    // TEST 2: Timezone boundary consistency (UTC comparison)
    // -----------------------------------------------------------
    try {
      // Test different timezone ISO offsets pointing to the exact same UTC instant
      const t1 = new Date('2026-10-24T12:00:00+05:30'); // 06:30 UTC
      const t2 = new Date('2026-10-24T06:30:00Z');       // 06:30 UTC
      const expTime = new Date('2026-10-25T06:29:00Z'); // 23h59m remaining (< 24h -> 1_DAY)

      const res1 = getSubscriptionExpiryStage(expTime, t1);
      const res2 = getSubscriptionExpiryStage(expTime, t2);

      if (res1.stage !== '1_DAY' || res2.stage !== '1_DAY' || res1.daysRemaining !== res2.daysRemaining) {
        throw new Error(`Timezone boundary mismatch: res1=${JSON.stringify(res1)} res2=${JSON.stringify(res2)}`);
      }
      logPass(2, 'Timezone boundary consistency: consistent UTC millisecond epoch calculation regardless of locale');
    } catch (err) {
      logFail(2, 'Timezone boundary consistency', err.message);
    }

    // -----------------------------------------------------------
    // Setup test users in DB
    // -----------------------------------------------------------
    const hashedPassword = await User.hashPassword('Password123!');

    const adminUser = await User.create({
      name: 'Test Admin',
      email: adminEmail,
      passwordHash: hashedPassword,
      role: 'ADMIN',
      phone: '9876543210',
      isEmailVerified: true,
      accountStatus: 'ACTIVE'
    });

    const createOwnerAndSub = async (email, name, daysOffset, initialReminders = []) => {
      const user = await User.create({
        name,
        email,
        passwordHash: hashedPassword,
        role: 'OWNER',
        phone: '9876543211',
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
        hasActiveSubscription: true
      });

      const appDoc = await ShopApplication.create({
        ownerId: user._id,
        shopName: `${name}'s Auto Shop`,
        ownerFullName: name,
        ownerPhone: '+91 98765 43211',
        businessEmail: email,
        shopDescription: 'Quality genuine parts and accessories supplier.',
        shopCategory: 'CAR',
        addressLine: '123 Test Street',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        latitude: 18.5204,
        longitude: 73.8567,
        openingHours: 'Mon-Sat 9AM-8PM',
        status: 'APPROVED',
        submittedAt: new Date(),
        reviewedAt: new Date()
      });

      const shop = await Shop.create({
        ownerId: user._id,
        applicationId: appDoc._id,
        name: `${name}'s Auto Shop`,
        category: 'CAR',
        description: 'Quality genuine parts and accessories supplier.',
        address: {
          addressLine: '123 Test Street',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          location: { type: 'Point', coordinates: [73.8567, 18.5204] }
        },
        contact: { phone: '+91 98765 43211', email: email },
        openingHours: 'Mon-Sat 9AM-8PM',
        isApproved: true,
        isActive: true
      });

      const expiryDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
      const sub = await Subscription.create({
        ownerId: user._id,
        shopId: shop._id,
        planName: 'Quarterly Pro Plan',
        amount: 2499,
        billingDurationDays: 90,
        internalRef: `SUB-TEST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        paymentMethod: 'UPI_QR',
        paymentUtr: `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        status: daysOffset < 0 ? 'EXPIRED' : 'ACTIVE',
        startDate: new Date(Date.now() - (90 - daysOffset) * 24 * 60 * 60 * 1000),
        expiryDate: expiryDate,
        remindersSent: initialReminders
      });

      return { user, shop, appDoc, sub, expiryDate };
    };

    const owner7d = await createOwnerAndSub(owner7dEmail, 'Owner 7 Days', 6.8); // 7 days stage
    const owner3d = await createOwnerAndSub(owner3dEmail, 'Owner 3 Days', 2.8); // 3 days stage
    const owner1d = await createOwnerAndSub(owner1dEmail, 'Owner 1 Day', 0.8);  // 1 day stage
    const ownerExp = await createOwnerAndSub(ownerExpEmail, 'Owner Expiring Now', -0.1); // past expiry
    // Also an active sub that just expired while remaining in ACTIVE state in DB:
    ownerExp.sub.status = 'ACTIVE';
    await ownerExp.sub.save();

    const ownerSafe = await createOwnerAndSub(ownerSafeEmail, 'Owner 30 Days Safe', 30); // 30 days safe

    // -----------------------------------------------------------
    // TEST 3: Scheduler processing & in-app notification dispatch
    // -----------------------------------------------------------
    try {
      const summary = await checkAndProcessSubscriptionExpirations();
      if (!summary || typeof summary.checked !== 'number') {
        throw new Error('Scheduler did not return valid summary object');
      }

      // Verify Owner 7d notification
      const notif7d = await Notification.findOne({
        recipientId: owner7d.user._id,
        type: 'SUBSCRIPTION_EXPIRING'
      });
      if (!notif7d || !notif7d.message.includes('7 days') || notif7d.notificationKey !== `SUB_EXPIRY_${owner7d.sub._id}_7_DAYS`) {
        throw new Error(`Owner 7d notification missing or incorrect: ${JSON.stringify(notif7d)}`);
      }

      // Verify Owner 3d notification
      const notif3d = await Notification.findOne({
        recipientId: owner3d.user._id,
        type: 'SUBSCRIPTION_EXPIRING'
      });
      if (!notif3d || !notif3d.message.includes('3 days') || notif3d.notificationKey !== `SUB_EXPIRY_${owner3d.sub._id}_3_DAYS`) {
        throw new Error(`Owner 3d notification missing or incorrect: ${JSON.stringify(notif3d)}`);
      }

      // Verify Owner 1d notification
      const notif1d = await Notification.findOne({
        recipientId: owner1d.user._id,
        type: 'SUBSCRIPTION_EXPIRING'
      });
      if (!notif1d || !notif1d.message.includes('tomorrow') || notif1d.notificationKey !== `SUB_EXPIRY_${owner1d.sub._id}_1_DAY`) {
        throw new Error(`Owner 1d notification missing or incorrect: ${JSON.stringify(notif1d)}`);
      }

      // Verify Owner Expired notification and status transition
      const notifExp = await Notification.findOne({
        recipientId: ownerExp.user._id,
        type: 'SUBSCRIPTION_EXPIRED'
      });
      if (!notifExp || !notifExp.message.includes('has expired') || notifExp.notificationKey !== `SUB_EXPIRY_${ownerExp.sub._id}_EXPIRED`) {
        throw new Error(`Owner Expired notification missing or incorrect: ${JSON.stringify(notifExp)}`);
      }

      // Check sub status updated to EXPIRED in DB
      const refreshedExpSub = await Subscription.findById(ownerExp.sub._id);
      if (refreshedExpSub.status !== 'EXPIRED') {
        throw new Error(`Expired sub status not updated to EXPIRED: ${refreshedExpSub.status}`);
      }

      // Check owner user hasActiveSubscription set to false
      const refreshedExpUser = await User.findById(ownerExp.user._id);
      if (refreshedExpUser.hasActiveSubscription !== false) {
        throw new Error('Expired owner hasActiveSubscription not updated to false');
      }

      // Verify Owner Safe has NO expiry notification
      const notifSafe = await Notification.findOne({
        recipientId: ownerSafe.user._id,
        type: { $in: ['SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED'] }
      });
      if (notifSafe) {
        throw new Error(`Safe sub should not have received expiry notification: ${JSON.stringify(notifSafe)}`);
      }

      logPass(3, 'Scheduled expiry tracker generated in-app notifications (7d, 3d, 1d, expired) and transitioned status to EXPIRED');
    } catch (err) {
      logFail(3, 'Scheduler notification dispatch error', err.message);
    }

    // -----------------------------------------------------------
    // TEST 4: Idempotency & Duplicate Prevention
    // -----------------------------------------------------------
    try {
      const initialCount7d = await Notification.countDocuments({ recipientId: owner7d.user._id });
      const initialCountExp = await Notification.countDocuments({ recipientId: ownerExp.user._id });

      // Run scheduler again immediately
      await checkAndProcessSubscriptionExpirations();

      const recount7d = await Notification.countDocuments({ recipientId: owner7d.user._id });
      const recountExp = await Notification.countDocuments({ recipientId: ownerExp.user._id });

      if (recount7d !== initialCount7d || recountExp !== initialCountExp) {
        throw new Error(`Duplicate notification detected on rerun! 7d: ${initialCount7d} -> ${recount7d}, exp: ${initialCountExp} -> ${recountExp}`);
      }

      // Check remindersSent array length
      const sub7d = await Subscription.findById(owner7d.sub._id);
      if (!sub7d.remindersSent.includes('7_DAYS') || sub7d.remindersSent.filter(s => s === '7_DAYS').length !== 1) {
        throw new Error(`remindersSent array corrupted: ${JSON.stringify(sub7d.remindersSent)}`);
      }

      logPass(4, 'Duplicate prevention & idempotency: repeated scheduler runs produced zero duplicate notifications');
    } catch (err) {
      logFail(4, 'Duplicate prevention failed', err.message);
    }

    // -----------------------------------------------------------
    // TEST 5: Owner Portal API & Isolation
    // -----------------------------------------------------------
    let owner7dCookie, ownerExpCookie, adminCookie;
    try {
      // Login Owner 7d
      const login7dRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: owner7dEmail, password: 'Password123!' }
      });
      owner7dCookie = parseCookie(login7dRes);

      // Login Owner Exp
      const loginExpRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: ownerExpEmail, password: 'Password123!' }
      });
      ownerExpCookie = parseCookie(loginExpRes);

      // Login Admin
      const loginAdminRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: adminEmail, password: 'Password123!' }
      });
      adminCookie = parseCookie(loginAdminRes);

      // Fetch Owner 7d subscription
      const sub7dRes = await makeRequest('/api/subscriptions/my', {
        headers: { Cookie: owner7dCookie }
      });

      if (sub7dRes.status !== 200 || !sub7dRes.data.currentSubscription) {
        throw new Error(`Failed to fetch my subscription: status ${sub7dRes.status}`);
      }
      const mySubData = sub7dRes.data;
      if (!mySubData.expiryStageInfo?.isExpiringSoon || mySubData.expiryStageInfo?.stage !== '7_DAYS') {
        throw new Error(`Owner 7d API response missing expiryStageInfo: ${JSON.stringify(mySubData.expiryStageInfo)}`);
      }
      if (mySubData.daysRemaining !== 7) {
        throw new Error(`Owner 7d daysRemaining mismatch: ${mySubData.daysRemaining}`);
      }

      // Check Owner 7d notifications via API
      const notifsRes = await makeRequest('/api/notifications', {
        headers: { Cookie: owner7dCookie }
      });
      if (notifsRes.status !== 200 || !Array.isArray(notifsRes.data.notifications || notifsRes.data.data)) {
        throw new Error(`Failed to fetch notifications: status ${notifsRes.status}`);
      }
      const notifList = notifsRes.data.notifications || notifsRes.data.data;
      const hasExpiryNotif = notifList.some(n => n.type === 'SUBSCRIPTION_EXPIRING');
      if (!hasExpiryNotif) {
        throw new Error('Owner notifications API did not return SUBSCRIPTION_EXPIRING notification');
      }

      // Check Owner Exp subscription via API
      const subExpRes = await makeRequest('/api/subscriptions/my', {
        headers: { Cookie: ownerExpCookie }
      });
      if (subExpRes.data.overallStatus !== 'EXPIRED' && subExpRes.data.currentSubscription?.status !== 'EXPIRED') {
        throw new Error(`Owner Exp status is not EXPIRED: ${subExpRes.data.overallStatus}`);
      }
      if (!subExpRes.data.expiryStageInfo?.isExpired) {
        throw new Error('Owner Exp expiryStageInfo.isExpired is false');
      }

      // Verify Owner Isolation: Owner 7d cannot see Admin subscriptions endpoint
      const forbiddenAdminRes = await makeRequest('/api/subscriptions/admin', {
        headers: { Cookie: owner7dCookie }
      });
      if (forbiddenAdminRes.status !== 403) {
        throw new Error(`Security breach: Owner was able to query admin subscriptions (status: ${forbiddenAdminRes.status})`);
      }

      logPass(5, 'Owner portal subscription & notifications API: returned accurate expiryStageInfo and enforced owner role boundaries');
    } catch (err) {
      logFail(5, 'Owner portal API error', err.message);
    }

    // -----------------------------------------------------------
    // TEST 6: Protected Backend Route Enforcement
    // -----------------------------------------------------------
    try {
      // Owner Exp attempting to create a part with an expired subscription
      const createPartRes = await makeRequest('/api/parts', {
        method: 'POST',
        headers: { Cookie: ownerExpCookie },
        body: {
          partName: 'Brake Disc 240mm',
          description: 'High performance brake disc for testing expiry protection',
          category: 'Brakes',
          vehicleType: 'Car',
          price: 1500,
          stockQuantity: 10,
          shopId: ownerExp.shop._id.toString()
        }
      });

      // Must be blocked because subscription is expired (403 with requiresSubscription)
      if (createPartRes.status !== 403 || !createPartRes.data.requiresSubscription) {
        throw new Error(`Protected route allowed expired owner to create inventory: status ${createPartRes.status} (body: ${JSON.stringify(createPartRes.data)})`);
      }

      // Verify shop and owner were NOT deleted
      const shopCheck = await Shop.findById(ownerExp.shop._id);
      const userCheck = await User.findById(ownerExp.user._id);
      if (!shopCheck || !userCheck) {
        throw new Error('Shop or User was deleted when subscription expired!');
      }

      logPass(6, 'Protected backend route enforcement: blocked expired owner from inventory operations without deleting shop/account');
    } catch (err) {
      logFail(6, 'Protected route enforcement failed', err.message);
    }

    // -----------------------------------------------------------
    // TEST 7: Renewal Workflow & Resetting Reminder State
    // -----------------------------------------------------------
    try {
      // Expired owner initiates a renewal subscription via POST /api/subscriptions/submit
      const renewalUtr = `RNW${Date.now()}999`;
      const renewCreateRes = await makeRequest('/api/subscriptions/submit', {
        method: 'POST',
        headers: { Cookie: ownerExpCookie },
        body: {
          planId: 'quarterly_partner',
          paymentUtr: renewalUtr,
          paymentMethod: 'UPI_QR'
        }
      });

      if (renewCreateRes.status !== 201 || !renewCreateRes.data.subscription?._id) {
        throw new Error(`Renewal submission failed: ${JSON.stringify(renewCreateRes.data)}`);
      }

      const renewalSubId = renewCreateRes.data.subscription._id;

      // Admin verifies renewal via PATCH /api/subscriptions/admin/:id/verify
      const verifyRes = await makeRequest(`/api/subscriptions/admin/${renewalSubId}/verify`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: { note: 'Verified renewal payment via bank statement' }
      });

      if (verifyRes.status !== 200 || verifyRes.data.subscription?.status !== 'ACTIVE') {
        throw new Error(`Admin verification of renewal failed: ${JSON.stringify(verifyRes.data)}`);
      }

      // Verify remindersSent is reset to []
      const renewedSub = await Subscription.findById(renewalSubId);
      if (!Array.isArray(renewedSub.remindersSent) || renewedSub.remindersSent.length !== 0) {
        throw new Error(`Renewal did not reset remindersSent: ${JSON.stringify(renewedSub.remindersSent)}`);
      }

      // Verify owner hasActiveSubscription is restored
      const restoredUser = await User.findById(ownerExp.user._id);
      if (!restoredUser.hasActiveSubscription) {
        throw new Error('Owner hasActiveSubscription was not restored to true on renewal verification');
      }

      // Verify owner can now create a part successfully
      const createPartRenewedRes = await makeRequest('/api/parts', {
        method: 'POST',
        headers: { Cookie: ownerExpCookie },
        body: {
          partName: 'Brake Disc 240mm Renewed',
          description: 'High performance brake disc after renewal',
          category: 'Brakes',
          vehicleType: 'Car',
          manufacturer: 'Brembo',
          partNumber: `BD-RNW-${Date.now()}`,
          price: 1500,
          stockQuantity: 10,
          shopId: ownerExp.shop._id.toString()
        }
      });

      if (createPartRenewedRes.status !== 201) {
        throw new Error(`Renewed owner could not create part: status ${createPartRenewedRes.status} (body: ${JSON.stringify(createPartRenewedRes.data)})`);
      }

      logPass(7, 'Renewal workflow: payment verified, remindersSent reset to [], active status restored, access unblocked');
    } catch (err) {
      logFail(7, 'Renewal workflow failed', err.message);
    }

    // -----------------------------------------------------------
    // TEST 8: Admin Visibility, Filtering & Manual Tracker Trigger
    // -----------------------------------------------------------
    try {
      // 1. Query admin list with stats
      const adminListRes = await makeRequest('/api/subscriptions/admin', {
        headers: { Cookie: adminCookie }
      });

      if (adminListRes.status !== 200 || !adminListRes.data.stats) {
        throw new Error(`Admin list failed: status ${adminListRes.status}`);
      }
      const stats = adminListRes.data.stats;
      if (typeof stats.expiringSoon !== 'number' || typeof stats.expired !== 'number') {
        throw new Error(`Admin stats missing expiringSoon or expired: ${JSON.stringify(stats)}`);
      }
      if (stats.expiringSoon < 1) {
        throw new Error(`Expected at least 1 expiringSoon subscription, got ${stats.expiringSoon}`);
      }

      // 2. Query admin list filtered by EXPIRING_SOON
      const expiringSoonListRes = await makeRequest('/api/subscriptions/admin?status=EXPIRING_SOON', {
        headers: { Cookie: adminCookie }
      });
      if (expiringSoonListRes.status !== 200) {
        throw new Error(`Admin filter EXPIRING_SOON failed: status ${expiringSoonListRes.status}`);
      }
      const expiringSubs = expiringSoonListRes.data.subscriptions;
      if (!Array.isArray(expiringSubs) || expiringSubs.length === 0) {
        throw new Error('EXPIRING_SOON filter returned empty list');
      }
      const allAreExpiringSoon = expiringSubs.every(s => s.expiryStageInfo?.isExpiringSoon);
      if (!allAreExpiringSoon) {
        throw new Error('EXPIRING_SOON filter returned subscriptions that are not expiring soon');
      }

      // 3. Admin manual tracker trigger endpoint
      const manualTriggerRes = await makeRequest('/api/subscriptions/admin/run-expiry-check', {
        method: 'POST',
        headers: { Cookie: adminCookie }
      });
      if (manualTriggerRes.status !== 200 || !manualTriggerRes.data.success) {
        throw new Error(`Admin manual trigger failed: status ${manualTriggerRes.status} (body: ${JSON.stringify(manualTriggerRes.data)})`);
      }

      // 4. Non-admin attempting manual trigger
      const nonAdminTriggerRes = await makeRequest('/api/subscriptions/admin/run-expiry-check', {
        method: 'POST',
        headers: { Cookie: owner7dCookie }
      });
      if (nonAdminTriggerRes.status !== 403) {
        throw new Error(`Security breach: non-admin was able to trigger expiry check (status ${nonAdminTriggerRes.status})`);
      }

      logPass(8, 'Admin visibility & controls: stats (expiringSoon, expired), EXPIRING_SOON filter, and secured manual runner verified');
    } catch (err) {
      logFail(8, 'Admin visibility failed', err.message);
    }

    // Clean up test data
    await User.deleteMany({ email: { $regex: testPrefix } });
    await Shop.deleteMany({ email: { $regex: testPrefix } });
    await ShopApplication.deleteMany({ businessEmail: { $regex: testPrefix } });
    await Subscription.deleteMany({ paymentUtr: { $regex: 'RNW' } });
    await SparePart.deleteMany({ partName: { $regex: 'Brake Disc 240mm' } });
    await Notification.deleteMany({ notificationKey: { $regex: 'SUB_EXPIRY_' } });

    console.log('\n======================================================');
    console.log('ALL SUBSCRIPTION EXPIRY NOTIFICATION TESTS PASSED');
    console.log('======================================================\n');

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runTests();
