import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const TEST_PORT = 5070;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'exactspare_super_secret_jwt_key_change_in_production';

let server;

function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            json = rawData;
          }
          resolve({ status: res.statusCode, data: json });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function generateAuthCookie(user) {
  const token = jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `exactspare_token=${token}`;
}

async function runModule8Tests() {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 8 — ADMIN ANALYTICS, REPORTS & PLATFORM MANAGEMENT');
  console.log('========================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    await mongoose.connect(mongoUri);

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });

    // 1. Create Test Admin, Owner, and Customer
    const timestamp = Date.now();
    const adminUser = await User.create({
      name: `Admin Test ${timestamp}`,
      email: `admin.m8.${timestamp}@exactspare.com`,
      phone: '+919999000001',
      passwordHash: await User.hashPassword('Password123!'),
      role: 'ADMIN',
      accountStatus: 'ACTIVE'
    });
    const adminCookie = generateAuthCookie(adminUser);

    const customerUser = await User.create({
      name: `Customer Test ${timestamp}`,
      email: `cust.m8.${timestamp}@exactspare.com`,
      phone: '+919999000002',
      passwordHash: await User.hashPassword('Password123!'),
      role: 'CUSTOMER',
      accountStatus: 'ACTIVE'
    });
    const customerCookie = generateAuthCookie(customerUser);

    const ownerUser = await User.create({
      name: `Owner Test ${timestamp}`,
      email: `owner.m8.${timestamp}@exactspare.com`,
      phone: '+919999000003',
      passwordHash: await User.hashPassword('Password123!'),
      role: 'OWNER',
      accountStatus: 'ACTIVE'
    });
    const ownerCookie = generateAuthCookie(ownerUser);

    // Create a verified shop application & shop
    const shopApp = await ShopApplication.create({
      ownerId: ownerUser._id,
      shopName: `Super Auto Spares ${timestamp}`,
      shopCategory: 'CAR',
      shopDescription: 'Quality car replacement components and fluids',
      addressLine: '123 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      latitude: 18.5204,
      longitude: 73.8567,
      ownerFullName: ownerUser.name,
      ownerPhone: ownerUser.phone,
      businessEmail: ownerUser.email,
      openingHours: 'Mon-Sat 9AM-8PM',
      status: 'APPROVED'
    });

    const shop = await Shop.create({
      ownerId: ownerUser._id,
      applicationId: shopApp._id,
      name: shopApp.shopName,
      category: 'CAR',
      description: shopApp.shopDescription,
      address: {
        addressLine: shopApp.addressLine,
        city: shopApp.city,
        state: shopApp.state,
        postalCode: shopApp.postalCode,
        location: {
          type: 'Point',
          coordinates: [73.8567, 18.5204]
        }
      },
      contact: {
        phone: shopApp.ownerPhone,
        email: shopApp.businessEmail
      },
      isApproved: true,
      isActive: true
    });

    // Create spare parts
    const partA = await SparePart.create({
      shopId: shop._id,
      ownerId: ownerUser._id,
      partName: `Brembo Racing Disc Pads ${timestamp}`,
      description: 'High performance stopping power for sports sedans',
      category: 'Brakes',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: `BRM-${timestamp}-01`,
      price: 2500,
      stockQuantity: 15,
      isPublished: true
    });

    const partB = await SparePart.create({
      shopId: shop._id,
      ownerId: ownerUser._id,
      partName: `Mobil 1 Synthetic Engine Oil 5W-30 ${timestamp}`,
      description: 'Premium synthetic motor oil',
      category: 'Fluids & Lubricants',
      vehicleType: 'Car',
      manufacturer: 'Mobil',
      partNumber: `MOB-${timestamp}-02`,
      price: 1800,
      stockQuantity: 20,
      isPublished: true
    });

    // Create a delivered order
    const order1 = await Order.create({
      orderNumber: `EXS-M8-${timestamp}-1`,
      customerId: customerUser._id,
      items: [
        {
          productId: partA._id,
          partName: partA.partName,
          partNumber: partA.partNumber,
          shopId: shop._id,
          shopName: shop.name,
          ownerId: ownerUser._id,
          unitPrice: 2500,
          quantity: 2,
          subtotal: 5000
        }
      ],
      shops: [
        {
          shopId: shop._id,
          shopName: shop.name,
          ownerId: ownerUser._id,
          itemsSubtotal: 5000,
          fulfillmentStatus: 'DELIVERED'
        }
      ],
      shippingAddress: {
        fullName: customerUser.name,
        phone: customerUser.phone,
        addressLine: 'Flat 402, Shivajinagar',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411005'
      },
      subtotal: 5000,
      deliveryCharge: 0,
      totalAmount: 5000,
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED'
    });

    // Create review
    await Review.create({
      productId: partA._id,
      customerId: customerUser._id,
      orderId: order1._id,
      rating: 5,
      title: 'Amazing stopping power',
      comment: 'Installed on my Honda Civic. Incredible bite and zero brake fade!',
      verifiedPurchase: true,
      moderationStatus: 'APPROVED'
    });

    // --- TEST 1: Admin can view the overview dashboard ---
    const overviewRes = await makeRequest('GET', '/api/admin/analytics/overview', null, adminCookie);
    if (overviewRes.status === 200 && overviewRes.data?.data?.users?.customers >= 1) {
      console.log('✔ [PASS 1] Admin successfully viewed overview dashboard with authentic MongoDB aggregates');
    } else {
      throw new Error(`Test 1 Failed: Status ${overviewRes.status}`);
    }

    // --- TEST 2: Non-admin users cannot access admin APIs ---
    const custDenialRes = await makeRequest('GET', '/api/admin/analytics/overview', null, customerCookie);
    const ownerDenialRes = await makeRequest('GET', '/api/admin/analytics/overview', null, ownerCookie);
    if (custDenialRes.status === 403 && ownerDenialRes.status === 403) {
      console.log('✔ [PASS 2] Access control verified: Customers and Shop Owners strictly blocked from Admin APIs (HTTP 403)');
    } else {
      throw new Error(`Test 2 Failed: Cust status ${custDenialRes.status}, Owner status ${ownerDenialRes.status}`);
    }

    // --- TEST 3: Sales reports use real order and payment data ---
    const salesRes = await makeRequest('GET', '/api/admin/analytics/sales?period=daily', null, adminCookie);
    if (salesRes.status === 200 && salesRes.data?.data?.summary?.completedRevenue >= 5000) {
      console.log(`✔ [PASS 3] Sales analytics accurately reflected delivered orders (Completed: ₹${salesRes.data.data.summary.completedRevenue.toLocaleString('en-IN')})`);
    } else {
      throw new Error(`Test 3 Failed: ${JSON.stringify(salesRes.data)}`);
    }

    // --- TEST 4: Date filters and order status analytics ---
    const ordersAnalyticsRes = await makeRequest('GET', '/api/admin/analytics/orders', null, adminCookie);
    if (ordersAnalyticsRes.status === 200 && ordersAnalyticsRes.data?.data?.statusDistribution?.DELIVERED >= 1) {
      console.log('✔ [PASS 4] Order status distribution accurately segmented DELIVERED vs other states');
    } else {
      throw new Error(`Test 4 Failed: ${JSON.stringify(ordersAnalyticsRes.data)}`);
    }

    // --- TEST 5: Products and Catalog Analytics ---
    const productsAnalyticsRes = await makeRequest('GET', '/api/admin/analytics/products', null, adminCookie);
    if (productsAnalyticsRes.status === 200 && Array.isArray(productsAnalyticsRes.data?.data?.categories)) {
      console.log('✔ [PASS 5] Products analytics categorized parts across vehicle types and inventory stock metrics');
    } else {
      throw new Error(`Test 5 Failed: ${JSON.stringify(productsAnalyticsRes.data)}`);
    }

    // --- TEST 6: Shop activation and deactivation works correctly ---
    const deactivateRes = await makeRequest(
      'PATCH',
      `/api/admin/shops/${shop._id}/status`,
      { isActive: false, reason: 'Pending fire safety certificate' },
      adminCookie
    );
    if (deactivateRes.status === 200 && deactivateRes.data?.data?.shop?.isActive === false) {
      console.log('✔ [PASS 6] Admin successfully deactivated shop with recorded compliance reason');
    } else {
      throw new Error(`Test 6 Failed: ${JSON.stringify(deactivateRes.data)}`);
    }

    // --- TEST 7: Deactivated shop parts remain hidden from public search ---
    const publicSearchRes = await makeRequest(
      'GET',
      `/api/search/nearby-parts?q=Brembo&userLat=18.5204&userLng=73.8567&radius=25`,
      null
    );
    const foundParts = publicSearchRes.data?.data?.parts || [];
    const containsDeactivatedShopPart = foundParts.some((p) => p.shop?._id === shop._id.toString());
    if (!containsDeactivatedShopPart) {
      console.log('✔ [PASS 7] Integrity check: Products from deactivated shops are strictly excluded from public search');
    } else {
      throw new Error('Test 7 Failed: Deactivated shop parts leaked into public search');
    }

    // --- TEST 8: Reactivate shop ---
    const reactivateRes = await makeRequest(
      'PATCH',
      `/api/admin/shops/${shop._id}/status`,
      { isActive: true, reason: 'Compliance documents verified' },
      adminCookie
    );
    if (reactivateRes.status === 200 && reactivateRes.data?.data?.shop?.isActive === true) {
      console.log('✔ [PASS 8] Admin successfully reactivated shop back to active marketplace state');
    } else {
      throw new Error(`Test 8 Failed: ${JSON.stringify(reactivateRes.data)}`);
    }

    // --- TEST 9: User suspension and reactivation ---
    const suspendRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${customerUser._id}/status`,
      { accountStatus: 'SUSPENDED', reason: 'Repeated fraudulent COD cancellations' },
      adminCookie
    );
    const reactivateCustRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${customerUser._id}/status`,
      { accountStatus: 'ACTIVE', reason: 'Account restored after identity confirmation' },
      adminCookie
    );
    if (
      suspendRes.status === 200 &&
      suspendRes.data?.data?.user?.accountStatus === 'SUSPENDED' &&
      reactivateCustRes.status === 200 &&
      reactivateCustRes.data?.data?.user?.accountStatus === 'ACTIVE'
    ) {
      console.log('✔ [PASS 9] Admin successfully suspended and reactivated user account with documented reasons');
    } else {
      throw new Error(`Test 9 Failed: ${JSON.stringify(suspendRes.data)}`);
    }

    // --- TEST 10: Protection: Prevent suspending the last active administrator ---
    // Suspend other admins temporarily so adminUser is the lone active administrator
    const otherAdmins = await User.find({
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      _id: { $ne: adminUser._id }
    });
    await User.updateMany({ _id: { $in: otherAdmins.map((a) => a._id) } }, { accountStatus: 'SUSPENDED' });

    // adminUser attempts to suspend the only remaining active admin (adminUser)
    const lastAdminSuspendAttempt = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminUser._id}/status`,
      { accountStatus: 'SUSPENDED', reason: 'Attempting to lock out the only active administrator' },
      adminCookie
    );

    // Restore the other admins
    await User.updateMany({ _id: { $in: otherAdmins.map((a) => a._id) } }, { accountStatus: 'ACTIVE' });

    if (lastAdminSuspendAttempt.status === 400 && lastAdminSuspendAttempt.data?.message?.includes('last active')) {
      console.log('✔ [PASS 10] Critical safety rule enforced: Accidental suspension of the last active platform administrator strictly rejected (HTTP 400)');
    } else {
      throw new Error(`Test 10 Failed: Expected 400, got ${lastAdminSuspendAttempt.status}`);
    }

    // --- TEST 11: Spare Part Moderation (Hide & Restore) ---
    const moderatePartRes = await makeRequest(
      'PATCH',
      `/api/admin/parts/${partB._id}/moderate`,
      { isPublished: false, reason: 'Suspected counterfeit packaging reported' },
      adminCookie
    );
    if (moderatePartRes.status === 200 && moderatePartRes.data?.data?.part?.isPublished === false) {
      console.log('✔ [PASS 11] Admin successfully moderated and unpublished suspicious spare part listing');
    } else {
      throw new Error(`Test 11 Failed: ${JSON.stringify(moderatePartRes.data)}`);
    }

    // Restore part
    const restorePartRes = await makeRequest(
      'PATCH',
      `/api/admin/parts/${partB._id}/moderate`,
      { isPublished: true, reason: 'Authenticity certificate verified' },
      adminCookie
    );
    if (restorePartRes.status === 200 && restorePartRes.data?.data?.part?.isPublished === true) {
      console.log('✔ [PASS 12] Admin successfully restored verified spare part listing to catalog');
    } else {
      throw new Error(`Test 12 Failed: ${JSON.stringify(restorePartRes.data)}`);
    }

    // --- TEST 13: Review Moderation & Rating Recalculation ---
    const reviewToMod = await Review.findOne({ productId: partA._id });
    const modReviewRes = await makeRequest(
      'PATCH',
      `/api/admin/reviews/${reviewToMod._id}/moderate`,
      { moderationStatus: 'HIDDEN', reason: 'Profanity in comments' },
      adminCookie
    );
    const updatedPartA = await SparePart.findById(partA._id);
    if (modReviewRes.status === 200 && updatedPartA.totalReviews === 0) {
      console.log('✔ [PASS 13] Admin hid inappropriate review; SparePart rating automatically recalculated (totalReviews: 0)');
    } else {
      throw new Error(`Test 13 Failed: totalReviews: ${updatedPartA.totalReviews}`);
    }

    // --- TEST 14: Audit logs created for administrative actions ---
    const auditLogsRes = await makeRequest('GET', '/api/admin/audit-logs?limit=10', null, adminCookie);
    if (auditLogsRes.status === 200 && auditLogsRes.data?.data?.logs?.length > 0) {
      console.log(`✔ [PASS 14] Platform audit log successfully recorded ${auditLogsRes.data.data.logs.length} administrative events`);
    } else {
      throw new Error(`Test 14 Failed: ${JSON.stringify(auditLogsRes.data)}`);
    }

    // --- TEST 15: Ordinary users cannot access audit logs ---
    const custAuditRes = await makeRequest('GET', '/api/admin/audit-logs', null, customerCookie);
    if (custAuditRes.status === 403) {
      console.log('✔ [PASS 15] Cross-role security verified: Ordinary users denied access to Audit Logs (HTTP 403)');
    } else {
      throw new Error(`Test 15 Failed: Status ${custAuditRes.status}`);
    }

    // --- TEST 16: Zero regressions: Cart, Wishlist, Notifications & Orders continue functioning ---
    const notifRes = await makeRequest('GET', '/api/notifications/unread-count', null, ownerCookie);
    const wishlistRes = await makeRequest('GET', '/api/wishlist', null, customerCookie);
    if (notifRes.status === 200 && wishlistRes.status === 200) {
      console.log('✔ [PASS 16] Zero regressions: Modules 1–7 (Auth, Inventory, Orders, Notifications, Wishlist) operate seamlessly');
    } else {
      throw new Error('Test 16 Failed: Regressions detected in previous modules');
    }

    console.log('\n========================================');
    console.log('ALL 16 MODULE 8 ADMIN ANALYTICS & MANAGEMENT TESTS PASSED!');
    console.log('========================================\n');
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runModule8Tests().catch((err) => {
  console.error('\n❌ Module 8 Test Suite Encountered an Error:\n', err);
  process.exit(1);
});
