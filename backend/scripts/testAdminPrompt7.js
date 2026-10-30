import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Enquiry from '../models/Enquiry.js';
import Report from '../models/Report.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Notification from '../models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5077; // Dedicated test port for Prompt 7
const baseUrl = `http://127.0.0.1:${PORT}`;

const logPass = (num, desc) => {
  console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
};

const logFail = (num, desc, err) => {
  console.error(`\x1b[31m✖ [FAIL ${num}]\x1b[0m ${desc}: ${err}`);
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

async function runPrompt7Tests() {
  console.log('====================================================');
  console.log('  EXACTSPARE PROMPT 7 — ADMIN PLATFORM MANAGEMENT   ');
  console.log('====================================================\n');

  let server;
  const timestamp = Date.now();

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`Test server running at ${baseUrl}\n`);

    // Ensure documents upload directory exists for secure doc tests
    const docDir = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    const testDocFilename = `test_verification_doc_${timestamp}.pdf`;
    const testDocPath = path.join(docDir, testDocFilename);
    fs.writeFileSync(testDocPath, 'EXACTSPARE SECURE VERIFICATION CERTIFICATE TEST CONTENT');

    // ----------------------------------------------------
    // Seed test users: Admin, Customer, and 2 Shop Owners
    // ----------------------------------------------------
    const adminEmail = `admin_p7_${timestamp}@exactspare.com`;
    const customerEmail = `cust_p7_${timestamp}@gmail.com`;
    const ownerEmail = `owner_p7_${timestamp}@gmail.com`;
    const owner2Email = `owner2_p7_${timestamp}@gmail.com`;
    const password = 'Password@123';

    // 1. Create or register Admin
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = new User({
        name: 'Platform Administrator P7',
        email: adminEmail,
        phone: '+91 9811223344',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        isEmailVerified: true,
        passwordHash: await User.hashPassword(password)
      });
      await adminUser.save();
    }

    // 2. Register Customer via API
    const custRegRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Aarav Customer P7',
        email: customerEmail,
        password,
        confirmPassword: password,
        phone: '+91 9822334455',
        role: 'CUSTOMER'
      }
    });
    if (custRegRes.status !== 201 && custRegRes.status !== 200) {
      throw new Error(`Failed to register customer: ${JSON.stringify(custRegRes.data)}`);
    }

    // 3. Register Shop Owner 1 via API
    const ownerRegRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Ramesh Merchant P7',
        email: ownerEmail,
        password,
        confirmPassword: password,
        phone: '+91 9833445566',
        role: 'OWNER'
      }
    });
    if (ownerRegRes.status !== 201 && ownerRegRes.status !== 200) {
      throw new Error(`Failed to register owner: ${JSON.stringify(ownerRegRes.data)}`);
    }

    // 4. Register Shop Owner 2 via API
    const owner2RegRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Vikram Motors P7',
        email: owner2Email,
        password,
        confirmPassword: password,
        phone: '+91 9844332211',
        role: 'OWNER'
      }
    });
    if (owner2RegRes.status !== 201 && owner2RegRes.status !== 200) {
      throw new Error(`Failed to register owner 2: ${JSON.stringify(owner2RegRes.data)}`);
    }

    // Login each to obtain session cookies
    const loginUser = async (email) => {
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      return parseCookie(res);
    };

    const adminCookie = await loginUser(adminEmail);
    const customerCookie = await loginUser(customerEmail);
    const ownerCookie = await loginUser(ownerEmail);
    const owner2Cookie = await loginUser(owner2Email);

    const customerUser = await User.findOne({ email: customerEmail });
    const ownerUser = await User.findOne({ email: ownerEmail });
    const owner2User = await User.findOne({ email: owner2Email });

    // ----------------------------------------------------
    // TEST 1: Strict Admin-Only Route Protection
    // ----------------------------------------------------
    try {
      // 1.1 Unauthenticated request rejected with 401
      const unauthRes = await makeRequest('/api/admin/analytics/overview');
      if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
      }

      // 1.2 Customer accessing admin route rejected with 403
      const custAdminRes = await makeRequest('/api/admin/analytics/overview', {
        headers: { Cookie: customerCookie }
      });
      if (custAdminRes.status !== 403) {
        throw new Error(`Expected 403 for Customer accessing admin route, got ${custAdminRes.status}`);
      }

      // 1.3 Owner accessing admin route rejected with 403
      const ownerAdminRes = await makeRequest('/api/admin/users', {
        headers: { Cookie: ownerCookie }
      });
      if (ownerAdminRes.status !== 403) {
        throw new Error(`Expected 403 for Owner accessing admin route, got ${ownerAdminRes.status}`);
      }

      // 1.4 Admin successfully authenticated with 200
      const adminSuccessRes = await makeRequest('/api/admin/analytics/overview', {
        headers: { Cookie: adminCookie }
      });
      if (adminSuccessRes.status !== 200 || !adminSuccessRes.data.success) {
        throw new Error(`Expected 200 for Admin, got ${adminSuccessRes.status}`);
      }

      logPass(1, 'Strict Admin-only route protection rejects unauthenticated (401) and unauthorized roles (403)');
    } catch (err) {
      logFail(1, 'Admin route protection failed', err.message);
    }

    // ----------------------------------------------------
    // Seed Sample Records for Dashboard Queries
    // ----------------------------------------------------
    // Create an application for owner 1
    const app1 = await ShopApplication.create({
      ownerId: ownerUser._id,
      shopName: `Speedy Spares P7 ${timestamp}`,
      shopCategory: 'CAR',
      shopDescription: 'High quality genuine brake pads, clutches, and suspension units',
      ownerFullName: ownerUser.name,
      ownerPhone: ownerUser.phone,
      businessEmail: ownerEmail,
      addressLine: 'Plot 42, Sector 18 Automotive Zone',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122001',
      latitude: 28.4595,
      longitude: 77.0266,
      openingHours: 'Mon-Sat: 9:00 AM - 8:00 PM',
      status: 'PENDING',
      paymentStatus: 'PENDING_VERIFICATION',
      paymentAmount: 499,
      paymentUtr: `UTR${timestamp}123`,
      verificationDocumentPaths: [`uploads/documents/${testDocFilename}`]
    });

    // Create an application for owner 2 with NEEDS_CORRECTION
    const app2 = await ShopApplication.create({
      ownerId: owner2User._id,
      shopName: `Vikram Two Wheeler P7 ${timestamp}`,
      shopCategory: 'BIKE',
      shopDescription: 'Motorcycle performance spark plugs, sprockets and chains',
      ownerFullName: owner2User.name,
      ownerPhone: owner2User.phone,
      businessEmail: owner2Email,
      addressLine: 'Shop 12, Karol Bagh Bike Market',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110005',
      latitude: 28.6517,
      longitude: 77.1906,
      openingHours: 'Mon-Sun: 10:00 AM - 9:00 PM',
      status: 'NEEDS_CORRECTION',
      correctionMessage: 'Please provide clear front facade photograph showing street signboard.',
      paymentStatus: 'UNPAID',
      paymentAmount: 499
    });

    // Create an active approved Shop for owner 1
    const testShop = await Shop.create({
      ownerId: ownerUser._id,
      applicationId: app1._id,
      name: `Speedy Spares P7 ${timestamp}`,
      category: 'CAR',
      description: 'High quality genuine brake pads, clutches, and suspension units',
      address: {
        addressLine: 'Plot 42, Sector 18 Automotive Zone',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122001',
        location: {
          type: 'Point',
          coordinates: [77.0266, 28.4595]
        }
      },
      contact: {
        phone: ownerUser.phone,
        email: ownerEmail
      },
      openingHours: 'Mon-Sat: 9:00 AM - 8:00 PM',
      isApproved: true,
      isActive: true,
      approvedAt: new Date()
    });

    // Create 1 Published part and 1 Unpublished part
    const publishedPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: `Ceramic Front Brake Pads P7 ${timestamp}`,
      partNumber: `BP-CER-${timestamp}`,
      manufacturer: 'Brembo',
      description: 'Premium quality ceramic front brake pads for high performance braking',
      category: 'Brakes',
      vehicleType: 'Car',
      condition: 'NEW',
      price: 2499,
      stockQuantity: 15,
      isPublished: true,
      isModerated: false,
      isArchived: false
    });

    const unpublishedPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: `Performance Racing Clutch Disk P7 ${timestamp}`,
      partNumber: `CL-RAC-${timestamp}`,
      manufacturer: 'Exedy',
      description: 'Heavy duty performance racing clutch disk for smooth engagement',
      category: 'Clutch',
      vehicleType: 'Car',
      condition: 'NEW',
      price: 4999,
      stockQuantity: 5,
      isPublished: false,
      isModerated: false,
      isArchived: false
    });

    // Create a customer enquiry
    const testEnquiry = await Enquiry.create({
      customerId: customerUser._id,
      shopId: testShop._id,
      ownerId: ownerUser._id,
      sparePartId: publishedPart._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      customerPhone: customerUser.phone,
      subject: 'Inquiry on brake pad compatibility with Honda City 2021',
      message: 'Hello, are these ceramic pads directly compatible with 5th Gen Honda City ZX CVT?',
      status: 'NEW'
    });

    // Create an open report
    const testReport = await Report.create({
      reporterId: customerUser._id,
      targetType: 'PRODUCT',
      productId: publishedPart._id,
      shopId: testShop._id,
      category: 'INCORRECT_COMPATIBILITY',
      description: 'The listing does not specify if clips and shims are included in the box.',
      status: 'PENDING'
    });

    // ----------------------------------------------------
    // TEST 2: Dashboard Statistics Against Real MongoDB Records
    // ----------------------------------------------------
    try {
      const overviewRes = await makeRequest('/api/admin/analytics/overview', {
        headers: { Cookie: adminCookie }
      });
      if (overviewRes.status !== 200 || !overviewRes.data.success) {
        throw new Error(`Overview returned status ${overviewRes.status}`);
      }

      const d = overviewRes.data.data;

      // Verify each figure matches live MongoDB count
      const expectedCustomers = await User.countDocuments({ role: 'CUSTOMER' });
      const expectedOwners = await User.countDocuments({ role: 'OWNER' });
      const expectedApprovedShops = await Shop.countDocuments({ isApproved: true, isActive: true });
      const expectedPendingApps = await ShopApplication.countDocuments({ status: 'PENDING' });
      const expectedRejectedApps = await ShopApplication.countDocuments({ status: 'REJECTED' });
      const expectedCorrectionApps = await ShopApplication.countDocuments({ status: 'NEEDS_CORRECTION' });
      const expectedParts = await SparePart.countDocuments({ isArchived: false });
      const expectedPublished = await SparePart.countDocuments({ isArchived: false, isPublished: true });
      const expectedNewEnquiries = await Enquiry.countDocuments({ status: 'NEW' });
      const expectedOpenReports = await Report.countDocuments({ status: { $in: ['PENDING', 'INVESTIGATING'] } });

      if (d.users.customers !== expectedCustomers) {
        throw new Error(`Mismatch customers: expected ${expectedCustomers}, got ${d.users.customers}`);
      }
      if (d.users.shopOwners !== expectedOwners) {
        throw new Error(`Mismatch owners: expected ${expectedOwners}, got ${d.users.shopOwners}`);
      }
      if (d.shops.approvedAndActive !== expectedApprovedShops) {
        throw new Error(`Mismatch approved shops: expected ${expectedApprovedShops}, got ${d.shops.approvedAndActive}`);
      }
      if (d.shops.pendingApplications !== expectedPendingApps) {
        throw new Error(`Mismatch pending apps: expected ${expectedPendingApps}, got ${d.shops.pendingApplications}`);
      }
      if (d.shops.rejectedApplications !== expectedRejectedApps) {
        throw new Error(`Mismatch rejected apps: expected ${expectedRejectedApps}, got ${d.shops.rejectedApplications}`);
      }
      if (d.shops.needsCorrectionApplications !== expectedCorrectionApps) {
        throw new Error(`Mismatch corrections apps: expected ${expectedCorrectionApps}, got ${d.shops.needsCorrectionApplications}`);
      }
      if (d.inventory.total !== expectedParts) {
        throw new Error(`Mismatch parts total: expected ${expectedParts}, got ${d.inventory.total}`);
      }
      if (d.inventory.published !== expectedPublished) {
        throw new Error(`Mismatch published: expected ${expectedPublished}, got ${d.inventory.published}`);
      }
      if (d.inventory.unpublished !== (expectedParts - expectedPublished)) {
        throw new Error(`Mismatch unpublished: expected ${expectedParts - expectedPublished}, got ${d.inventory.unpublished}`);
      }
      if (d.enquiries.newEnquiries !== expectedNewEnquiries) {
        throw new Error(`Mismatch new enquiries: expected ${expectedNewEnquiries}, got ${d.enquiries.newEnquiries}`);
      }
      if (d.compliance.openReports !== expectedOpenReports) {
        throw new Error(`Mismatch open reports: expected ${expectedOpenReports}, got ${d.compliance.openReports}`);
      }

      logPass(2, 'Dashboard statistics 100% derived from real MongoDB records (customers, owners, approved shops, pending/rejected/corrections, inventory, enquiries, reports)');
    } catch (err) {
      logFail(2, 'Dashboard statistics verification failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 3: Prevention of Unauthorized Approval (Self-Approval Block)
    // ----------------------------------------------------
    try {
      // Owner tries to call decision API to approve their own application
      const selfApproveRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: ownerCookie },
        body: { decision: 'APPROVE' }
      });
      if (selfApproveRes.status !== 403) {
        throw new Error(`Expected 403 when shop owner attempts self-approval, got ${selfApproveRes.status}`);
      }

      logPass(3, 'Shop owners strictly forbidden from self-approving or modifying application approval status');
    } catch (err) {
      logFail(3, 'Prevention of unauthorized approval failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 4: Shop Application Review - Request Corrections & Rejection Validation
    // ----------------------------------------------------
    try {
      // 4.1 Request corrections requires explanation
      const emptyCorrRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: { decision: 'REQUEST_CORRECTIONS', correctionMessage: '' }
      });
      if (emptyCorrRes.status !== 400) {
        throw new Error(`Expected 400 when correctionMessage is empty, got ${emptyCorrRes.status}`);
      }

      // 4.2 Request corrections with clear explanation succeeds and logs audit
      const corrRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          decision: 'REQUEST_CORRECTIONS',
          correctionMessage: 'Please re-upload a clearer copy of GST certificate and shop signboard photo.'
        }
      });
      if (corrRes.status !== 200 || corrRes.data.application.status !== 'NEEDS_CORRECTION') {
        throw new Error(`Expected status NEEDS_CORRECTION, got ${JSON.stringify(corrRes.data)}`);
      }

      // Verify audit log created
      const corrAudit = await AdminAuditLog.findOne({
        entityId: app1._id,
        action: 'SHOP_APPLICATION_CORRECTIONS_REQUESTED'
      });
      if (!corrAudit) {
        throw new Error('Audit log for SHOP_APPLICATION_CORRECTIONS_REQUESTED was not created');
      }

      // 4.3 Rejection requires reason
      // Revert status to PENDING for rejection testing
      app1.status = 'PENDING';
      await app1.save();

      const emptyRejectRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: { decision: 'REJECT', reason: '' }
      });
      if (emptyRejectRes.status !== 400) {
        throw new Error(`Expected 400 when rejection reason is missing, got ${emptyRejectRes.status}`);
      }

      // 4.4 Valid rejection records status and audit history
      const rejectRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          decision: 'REJECT',
          reason: 'Physical premises address does not match municipal registration records.'
        }
      });
      if (rejectRes.status !== 200 || rejectRes.data.application.status !== 'REJECTED') {
        throw new Error(`Expected status REJECTED, got ${JSON.stringify(rejectRes.data)}`);
      }

      const rejectAudit = await AdminAuditLog.findOne({
        entityId: app1._id,
        action: 'SHOP_APPLICATION_REJECTED'
      });
      if (!rejectAudit) {
        throw new Error('Audit log for SHOP_APPLICATION_REJECTED was not created');
      }

      logPass(4, 'Shop application review enforces required explanations for corrections and rejections with backend audit logging');
    } catch (err) {
      logFail(4, 'Application review validation failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 5: Payment Verification Workflow
    // ----------------------------------------------------
    try {
      // Reset application to PENDING with PENDING_VERIFICATION payment
      app1.status = 'PENDING';
      app1.paymentStatus = 'PENDING_VERIFICATION';
      app1.paymentUtr = `UTR${timestamp}999`;
      await app1.save();

      // 5.1 Admin tries to approve before reconciling payment -> blocked with 400
      const prematureApproveRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: { decision: 'APPROVE' }
      });
      if (prematureApproveRes.status !== 400) {
        throw new Error(`Expected 400 approving application with unverified payment, got ${prematureApproveRes.status}`);
      }

      // 5.2 Admin verifies and reconciles genuine payment receipt
      const verifyPayRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/verify-payment`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie }
      });
      if (verifyPayRes.status !== 200 || verifyPayRes.data.application.paymentStatus !== 'PAID') {
        throw new Error(`Expected paymentStatus PAID, got ${JSON.stringify(verifyPayRes.data)}`);
      }

      // 5.3 Audit log recorded for payment reconciliation
      const payAudit = await AdminAuditLog.findOne({
        entityId: app1._id,
        action: 'SHOP_APPLICATION_PAYMENT_VERIFIED'
      });
      if (!payAudit) {
        throw new Error('Audit log for SHOP_APPLICATION_PAYMENT_VERIFIED was not created');
      }

      // 5.4 Now approval succeeds cleanly
      const approveRes = await makeRequest(`/api/admin/shop-applications/${app1._id}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: { decision: 'APPROVE' }
      });
      if (approveRes.status !== 200 || approveRes.data.application.status !== 'APPROVED') {
        throw new Error(`Expected status APPROVED, got ${JSON.stringify(approveRes.data)}`);
      }

      logPass(5, 'Payment verification workflow separates financial verification from shop legitimacy and requires reconciliation before approval');
    } catch (err) {
      logFail(5, 'Payment verification workflow failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 6: User and Shop Management with Lockout Protection
    // ----------------------------------------------------
    try {
      // 6.1 Search users by name/email/role
      const userSearchRes = await makeRequest(`/api/admin/users?search=${encodeURIComponent('Ramesh')}&role=OWNER`, {
        headers: { Cookie: adminCookie }
      });
      if (userSearchRes.status !== 200 || !userSearchRes.data.data.users.length) {
        throw new Error(`Failed to find user by search: ${JSON.stringify(userSearchRes.data)}`);
      }

      // 6.2 View user details with associated shop and application
      const userDetailsRes = await makeRequest(`/api/admin/users/${ownerUser._id}`, {
        headers: { Cookie: adminCookie }
      });
      if (userDetailsRes.status !== 200 || !userDetailsRes.data.data.user) {
        throw new Error(`Failed to fetch user details: ${JSON.stringify(userDetailsRes.data)}`);
      }
      if (!userDetailsRes.data.data.shop || !userDetailsRes.data.data.application) {
        throw new Error('Expected associated shop and application in user details response');
      }

      // 6.3 Suspend customer account with reason
      const suspendRes = await makeRequest(`/api/admin/users/${customerUser._id}/status`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          accountStatus: 'SUSPENDED',
          reason: 'Investigation of disputed chargebacks'
        }
      });
      if (suspendRes.status !== 200 || suspendRes.data.data.user.accountStatus !== 'SUSPENDED') {
        throw new Error(`Expected accountStatus SUSPENDED, got ${JSON.stringify(suspendRes.data)}`);
      }

      // 6.4 Reactivate customer account
      const reactivateRes = await makeRequest(`/api/admin/users/${customerUser._id}/status`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          accountStatus: 'ACTIVE',
          reason: 'Cleared by dispute investigation team'
        }
      });
      if (reactivateRes.status !== 200 || reactivateRes.data.data.user.accountStatus !== 'ACTIVE') {
        throw new Error(`Expected accountStatus ACTIVE, got ${JSON.stringify(reactivateRes.data)}`);
      }

      // 6.5 Self-lockout protection: Prevent suspending the last active administrator
      // Count active admins
      const activeAdminCount = await User.countDocuments({ role: 'ADMIN', accountStatus: 'ACTIVE' });
      if (activeAdminCount === 1) {
        const lockoutRes = await makeRequest(`/api/admin/users/${adminUser._id}/status`, {
          method: 'PATCH',
          headers: { Cookie: adminCookie },
          body: {
            accountStatus: 'SUSPENDED',
            reason: 'Testing accidental lockout'
          }
        });
        if (lockoutRes.status !== 400) {
          throw new Error(`Expected 400 preventing lockout of sole administrator, got ${lockoutRes.status}`);
        }
      }

      // 6.6 Shop deactivation with administrative reason
      const deactShopRes = await makeRequest(`/api/admin/shops/${testShop._id}/status`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          isActive: false,
          reason: 'Temporary suspension pending license renewal'
        }
      });
      if (deactShopRes.status !== 200 || deactShopRes.data.data.shop.isActive !== false) {
        throw new Error(`Expected shop isActive false, got ${JSON.stringify(deactShopRes.data)}`);
      }

      // 6.7 Shop reactivation
      const reactShopRes = await makeRequest(`/api/admin/shops/${testShop._id}/status`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          isActive: true,
          reason: 'License renewed and verified'
        }
      });
      if (reactShopRes.status !== 200 || reactShopRes.data.data.shop.isActive !== true) {
        throw new Error(`Expected shop isActive true, got ${JSON.stringify(reactShopRes.data)}`);
      }

      logPass(6, 'User and shop management successfully supports search, detail association, suspension/reactivation, deactivation, and administrator self-lockout protection');
    } catch (err) {
      logFail(6, 'User and shop management failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 7: Spare-Part Moderation
    // ----------------------------------------------------
    try {
      // 7.1 Search parts by name, category, shop, and status
      const partSearchRes = await makeRequest(`/api/admin/parts?search=${encodeURIComponent('Ceramic')}&category=Brakes&status=PUBLISHED`, {
        headers: { Cookie: adminCookie }
      });
      if (partSearchRes.status !== 200 || !partSearchRes.data.data.parts.length) {
        throw new Error(`Failed to find parts by query: ${JSON.stringify(partSearchRes.data)}`);
      }

      // 7.2 Unpublish / moderate listing with moderation reason
      const moderateRes = await makeRequest(`/api/admin/parts/${publishedPart._id}/moderate`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          isPublished: false,
          reason: 'Inaccurate vehicle trim compatibility statement'
        }
      });
      if (moderateRes.status !== 200 || moderateRes.data.data.part.isPublished !== false || moderateRes.data.data.part.isModerated !== true) {
        throw new Error(`Expected part hidden, got ${JSON.stringify(moderateRes.data)}`);
      }

      // Verify audit log for part moderation
      const partAudit = await AdminAuditLog.findOne({
        entityId: publishedPart._id,
        action: 'PART_MODERATED'
      });
      if (!partAudit) {
        throw new Error('Audit log for PART_MODERATED was not created');
      }

      // 7.3 Restore listing
      const restoreRes = await makeRequest(`/api/admin/parts/${publishedPart._id}/moderate`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          isPublished: true,
          reason: 'Corrected compatibility specifications confirmed'
        }
      });
      if (restoreRes.status !== 200 || restoreRes.data.data.part.isPublished !== true || restoreRes.data.data.part.isModerated !== false) {
        throw new Error(`Expected part restored, got ${JSON.stringify(restoreRes.data)}`);
      }

      logPass(7, 'Spare-part moderation allows taking down listings with reason, restoring them, and creating immutable audit logs');
    } catch (err) {
      logFail(7, 'Spare-part moderation failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 8: Immutable Audit Logs Access
    // ----------------------------------------------------
    try {
      // 8.1 Ordinary customer blocked from viewing audit logs
      const custAuditRes = await makeRequest('/api/admin/audit-logs', {
        headers: { Cookie: customerCookie }
      });
      if (custAuditRes.status !== 403) {
        throw new Error(`Expected 403 for Customer accessing audit logs, got ${custAuditRes.status}`);
      }

      // 8.2 Shop owner blocked from viewing audit logs
      const ownerAuditRes = await makeRequest('/api/admin/audit-logs', {
        headers: { Cookie: ownerCookie }
      });
      if (ownerAuditRes.status !== 403) {
        throw new Error(`Expected 403 for Owner accessing audit logs, got ${ownerAuditRes.status}`);
      }

      // 8.3 Admin views audit logs
      const adminAuditRes = await makeRequest('/api/admin/audit-logs', {
        headers: { Cookie: adminCookie }
      });
      if (adminAuditRes.status !== 200 || !Array.isArray(adminAuditRes.data.data.logs)) {
        throw new Error(`Expected 200 with logs array, got ${JSON.stringify(adminAuditRes.data)}`);
      }

      logPass(8, 'Audit log records are immutable and protected strictly against unauthorized access by customers and merchants');
    } catch (err) {
      logFail(8, 'Audit logs access test failed', err.message);
    }

    // ----------------------------------------------------
    // TEST 9: Private Verification Document Access Restrictions
    // ----------------------------------------------------
    try {
      const docEndpoint = `/api/shop-applications/${app1._id}/documents/${testDocFilename}`;

      // 9.1 Unauthenticated request rejected with 401
      const unauthDocRes = await makeRequest(docEndpoint);
      if (unauthDocRes.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated document access, got ${unauthDocRes.status}`);
      }

      // 9.2 Other owner rejected with 403 Forbidden
      const unauthorizedDocRes = await makeRequest(docEndpoint, {
        headers: { Cookie: owner2Cookie }
      });
      if (unauthorizedDocRes.status !== 403) {
        throw new Error(`Expected 403 when another merchant tries accessing private document, got ${unauthorizedDocRes.status}`);
      }

      // 9.3 Application owner can access their own document with 200
      const ownerDocRes = await makeRequest(docEndpoint, {
        headers: { Cookie: ownerCookie }
      });
      if (ownerDocRes.status !== 200) {
        throw new Error(`Expected 200 for application owner accessing private document, got ${ownerDocRes.status}`);
      }

      // 9.4 Platform Administrator can securely inspect document with 200
      const adminDocRes = await makeRequest(docEndpoint, {
        headers: { Cookie: adminCookie }
      });
      if (adminDocRes.status !== 200) {
        throw new Error(`Expected 200 for Admin inspecting private document, got ${adminDocRes.status}`);
      }

      logPass(9, 'Private verification documents are restricted strictly to authorized application owners and administrators (403 for others)');
    } catch (err) {
      logFail(9, 'Private document security failed', err.message);
    }

    // ----------------------------------------------------
    // Cleanup test artifacts
    // ----------------------------------------------------
    try {
      if (fs.existsSync(testDocPath)) {
        fs.unlinkSync(testDocPath);
      }
    } catch {
      // ignore
    }

  } catch (globalErr) {
    console.error('\nFatal test execution error:', globalErr);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('\nTest server shut down cleanly.');
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    }

    if (process.exitCode === 1) {
      console.log('\n\x1b[31mSOME PROMPT 7 TESTS FAILED.\x1b[0m\n');
      process.exit(1);
    } else {
      console.log('\n\x1b[32mALL 9 PROMPT 7 TESTS PASSED SUCCESSFULLY! ✔\x1b[0m\n');
      process.exit(0);
    }
  }
}

runPrompt7Tests();
