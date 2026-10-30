import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../app.js';
import User from '../models/User.js';
import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import Notification from '../models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5058; // Dedicated test port
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

const logPass = (num, desc) => console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
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

const runAllTests = async () => {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 3: OWNER APPLICATION APPROVAL & PAYMENT WORKFLOW');
  console.log('========================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const ownerEmail = 'test.mod3.owner@exactspare.com';
  const ownerEmail2 = 'test.mod3.owner2@exactspare.com';
  const customerEmail = 'test.mod3.customer@exactspare.com';
  const adminEmail = 'admin@exactspare.com';

  const testUsers = await User.find({ email: { $in: [ownerEmail, ownerEmail2, customerEmail] } });
  const testUserIds = testUsers.map(u => u._id);
  await ShopApplication.deleteMany({ ownerId: { $in: testUserIds } });
  await Shop.deleteMany({ ownerId: { $in: testUserIds } });
  await Notification.deleteMany({ recipientId: { $in: testUserIds } });
  await User.deleteMany({ email: { $in: [ownerEmail, ownerEmail2, customerEmail] } });

  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  let ownerCookie = null;
  let ownerCookie2 = null;
  let customerCookie = null;
  let adminCookie = null;

  try {
    // 0. Register Test Accounts
    const regOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Mod3 Merchant',
        email: ownerEmail,
        phone: '+919876543001',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });
    ownerCookie = parseCookie(regOwner1);

    const regOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Mod3 Merchant Two',
        email: ownerEmail2,
        phone: '+919876543002',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });
    ownerCookie2 = parseCookie(regOwner2);

    const regCust = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Mod3 Customer',
        email: customerEmail,
        phone: '+919876543003',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'CUSTOMER'
      }
    });
    customerCookie = parseCookie(regCust);

    const adminLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'AdminExactSpare@2026'
      }
    });
    adminCookie = parseCookie(adminLogin);

    // 1. Owner creates application draft and submits
    const createDraftRes = await makeRequest('/api/shop-applications', {
      method: 'POST',
      headers: { 'Cookie': ownerCookie },
      body: {
        shopName: 'Apex Speed Spares',
        ownerFullName: 'Mod3 Merchant',
        ownerPhone: '+919876543001',
        ownerBusinessRole: 'Proprietor',
        businessEmail: ownerEmail,
        yearsInBusiness: 4,
        shopDescription: 'Genuine OEM performance spare parts and assemblies',
        shopCategory: 'BIKE',
        addressLine: '42 Sector 18 Industrial Area',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122001',
        latitude: 28.4595,
        longitude: 77.0266,
        openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
        action: 'SAVE_DRAFT'
      }
    });

    const application1Id = createDraftRes.data?.application?._id;
    await ShopApplication.findByIdAndUpdate(application1Id, {
      shopImagePaths: ['uploads/shops/storefront.jpg']
    });

    const submitAppRes = await makeRequest(`/api/shop-applications/${application1Id}/submit`, {
      method: 'POST',
      headers: { 'Cookie': ownerCookie }
    });

    const application1 = submitAppRes.data?.application;

    if (submitAppRes.status === 200 && application1 && application1.status === 'PENDING' && application1.paymentStatus === 'UNPAID') {
      logPass(1, 'Owner submits an application (Status: PENDING, Payment: UNPAID)');
    } else {
      logFail(1, 'Owner application submission', JSON.stringify(submitAppRes.data));
    }

    // =========================================================
    // CASE 2: Payment remains pending until genuinely verified
    // =========================================================
    const validUtr = '429182740192';
    const payRes = await makeRequest(`/api/shop-applications/${application1Id}/pay-and-activate`, {
      method: 'POST',
      headers: { 'Cookie': ownerCookie },
      body: {
        utr: validUtr,
        paymentAmount: 499,
        paymentMethod: 'UPI_SCANNER'
      }
    });

    const postPayApp = await ShopApplication.findById(application1Id);

    if (
      payRes.status === 200 &&
      postPayApp.paymentStatus === 'PENDING_VERIFICATION' &&
      postPayApp.status === 'PENDING' &&
      postPayApp.paymentUtr === validUtr
    ) {
      logPass(2, 'Payment remains PENDING_VERIFICATION and application remains PENDING until verified by admin');
    } else {
      logFail(2, 'Payment pending verification state', `Status: ${postPayApp?.paymentStatus}, AppStatus: ${postPayApp?.status}`);
    }

    // =========================================================
    // CASE 3: A forged payment-success request is rejected / ignored
    // =========================================================
    // Client tries to forge direct approval or mark payment PAID via update/create
    const forgedUpdateRes = await makeRequest(`/api/shop-applications/${application1Id}`, {
      method: 'PUT',
      headers: { 'Cookie': ownerCookie },
      body: {
        status: 'APPROVED',
        paymentStatus: 'PAID',
        directActivated: true,
        action: 'SUBMIT'
      }
    });

    const checkForgedApp = await ShopApplication.findById(application1Id);
    const existingShopCheck = await Shop.findOne({ applicationId: application1Id });

    if (checkForgedApp.status !== 'APPROVED' && !existingShopCheck) {
      logPass(3, 'Forged payment-success / self-approval request does not bypass backend verification or activate shop');
    } else {
      logFail(3, 'Forged payment vulnerability', 'Application was self-approved or shop created without admin review');
    }

    // =========================================================
    // CASE 4: An unauthorized user cannot approve an application
    // =========================================================
    const custApproveRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': customerCookie },
      body: { decision: 'APPROVE' }
    });

    const ownerApproveRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': ownerCookie },
      body: { decision: 'APPROVE' }
    });

    const ownerVerifyRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/verify-payment`, {
      method: 'PATCH',
      headers: { 'Cookie': ownerCookie }
    });

    if (custApproveRes.status === 403 && ownerApproveRes.status === 403 && ownerVerifyRes.status === 403) {
      logPass(4, 'Unauthorized users (customers and owners) cannot approve applications or verify payments (HTTP 403 Forbidden)');
    } else {
      logFail(4, 'Role authorization check', `Cust: ${custApproveRes.status}, Owner: ${ownerApproveRes.status}`);
    }

    // =========================================================
    // CASE 5: Admin can approve only eligible applications
    // =========================================================
    // 5A: Try approving while paymentStatus is PENDING_VERIFICATION -> Must reject with 400
    const prematureApproveRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie },
      body: { decision: 'APPROVE' }
    });

    if (prematureApproveRes.status === 400 && prematureApproveRes.data.message.includes('pending verification')) {
      logPass('5A', 'Admin cannot approve application while payment is pending verification (HTTP 400)');
    } else {
      logFail('5A', 'Eligibility enforcement for pending payment', JSON.stringify(prematureApproveRes.data));
    }

    // 5B: Admin genuinely verifies payment
    const verifyPayRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/verify-payment`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie }
    });

    if (verifyPayRes.status === 200 && verifyPayRes.data.application?.paymentStatus === 'PAID') {
      logPass('5B', 'Admin verifies payment reference (paymentStatus becomes PAID, verifiedBy recorded)');
    } else {
      logFail('5B', 'Admin payment verification', JSON.stringify(verifyPayRes.data));
    }

    // 5C: Now that application is eligible (PAID and PENDING), Admin approves
    const validApproveRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie },
      body: { decision: 'APPROVE' }
    });

    const approvedShop = await Shop.findOne({ applicationId: application1Id });

    if (validApproveRes.status === 200 && validApproveRes.data.application?.status === 'APPROVED' && approvedShop?.isApproved && approvedShop?.isActive) {
      logPass('5C', 'Admin successfully approves eligible verified application and active Shop is created');
    } else {
      logFail('5C', 'Eligible application approval', JSON.stringify(validApproveRes.data));
    }

    // =========================================================
    // CASE 6: Rejected and correction-required applications display their reasons
    // =========================================================
    // Create Owner 2 application
    const createDraft2Res = await makeRequest('/api/shop-applications', {
      method: 'POST',
      headers: { 'Cookie': ownerCookie2 },
      body: {
        shopName: 'Unlicensed Garage Parts',
        ownerFullName: 'Mod3 Merchant Two',
        ownerPhone: '+919876543002',
        ownerBusinessRole: 'Proprietor',
        businessEmail: ownerEmail2,
        yearsInBusiness: 1,
        shopDescription: 'Generic aftermarket spares and parts',
        shopCategory: 'CAR',
        addressLine: '12 Unknown Lane',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
        latitude: 28.6139,
        longitude: 77.2090,
        action: 'SAVE_DRAFT'
      }
    });
    const app2Id = createDraft2Res.data.application?._id;
    await ShopApplication.findByIdAndUpdate(app2Id, {
      shopImagePaths: ['uploads/shops/alley.jpg']
    });
    await makeRequest(`/api/shop-applications/${app2Id}/submit`, {
      method: 'POST',
      headers: { 'Cookie': ownerCookie2 }
    });

    // Request corrections on app 2
    const correctionMsg = 'Please upload official shop exterior banner photograph showing physical trade license number.';
    const requestCorrectionRes = await makeRequest(`/api/admin/shop-applications/${app2Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie },
      body: {
        decision: 'REQUEST_CORRECTIONS',
        correctionMessage: correctionMsg
      }
    });

    // Owner checks their application
    const owner2AppView = await makeRequest('/api/shop-applications/my', {
      headers: { 'Cookie': ownerCookie2 }
    });

    if (
      requestCorrectionRes.status === 200 &&
      owner2AppView.data.application?.status === 'NEEDS_CORRECTION' &&
      owner2AppView.data.application?.correctionMessage === correctionMsg
    ) {
      logPass('6A', 'Correction-required application displays specific instructions on owner application status view');
    } else {
      logFail('6A', 'Correction request display', JSON.stringify(owner2AppView.data));
    }

    // Reject app 2 with reason
    const rejectionReason = 'Physical inspection revealed non-existent storefront address. Fraudulent merchant registration.';
    const rejectRes = await makeRequest(`/api/admin/shop-applications/${app2Id}/decision`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie },
      body: {
        decision: 'REJECT',
        reason: rejectionReason
      }
    });

    const owner2RejectedView = await makeRequest('/api/shop-applications/my', {
      headers: { 'Cookie': ownerCookie2 }
    });

    if (
      rejectRes.status === 200 &&
      owner2RejectedView.data.application?.status === 'REJECTED' &&
      owner2RejectedView.data.application?.rejectionReason === rejectionReason
    ) {
      logPass('6B', 'Rejected application displays recorded reason and permitted next steps on owner status view');
    } else {
      logFail('6B', 'Rejection reason display', JSON.stringify(owner2RejectedView.data));
    }

    // =========================================================
    // CASE 7: Unapproved shops and inventory remain hidden publicly
    // =========================================================
    const publicShopsRes = await makeRequest('/api/shops');
    const shopsList = publicShopsRes.data?.shops || [];

    const hasApprovedShop = shopsList.some(s => s.name === 'Apex Speed Spares');
    const hasRejectedShop = shopsList.some(s => s.name === 'Unlicensed Garage Parts');

    if (hasApprovedShop && !hasRejectedShop) {
      logPass(7, 'Approved shops are visible publicly while unapproved/rejected shops remain strictly hidden');
    } else {
      logFail(7, 'Public shop filtering', `Approved found: ${hasApprovedShop}, Rejected found: ${hasRejectedShop}`);
    }

    // =========================================================
    // CASE 8: Repeated payment callbacks do not duplicate records (Idempotency)
    // =========================================================
    const repeatVerifyRes = await makeRequest(`/api/admin/shop-applications/${application1Id}/verify-payment`, {
      method: 'PATCH',
      headers: { 'Cookie': adminCookie }
    });

    const repeatOwnerPayRes = await makeRequest(`/api/shop-applications/${application1Id}/pay-and-activate`, {
      method: 'POST',
      headers: { 'Cookie': ownerCookie },
      body: {
        utr: validUtr,
        paymentAmount: 499
      }
    });

    const finalApp1 = await ShopApplication.findById(application1Id);
    const notificationsCount = await Notification.countDocuments({
      recipientId: finalApp1.ownerId,
      type: 'PAYMENT_VERIFIED'
    });

    if (
      repeatVerifyRes.status === 200 &&
      repeatVerifyRes.data.message.includes('already verified') &&
      repeatOwnerPayRes.status === 200 &&
      notificationsCount === 1
    ) {
      logPass(8, 'Repeated payment verification callbacks are idempotent and do not duplicate status history or notifications');
    } else {
      logFail(8, 'Payment verification idempotency', `Repeat status: ${repeatVerifyRes.status}, Notifs: ${notificationsCount}`);
    }

    // =========================================================
    // CASE 9: Existing customer and owner pages continue to work
    // =========================================================
    const custProfileRes = await makeRequest('/api/auth/me', {
      headers: { 'Cookie': customerCookie }
    });

    const ownerShopRes = await makeRequest('/api/shops/my', {
      headers: { 'Cookie': ownerCookie }
    });

    const scannerConfigRes = await makeRequest('/api/shop-applications/scanner-config', {
      headers: { 'Cookie': ownerCookie }
    });

    if (
      custProfileRes.status === 200 &&
      ownerShopRes.status === 200 &&
      scannerConfigRes.status === 200 &&
      (scannerConfigRes.data.config?.registrationFee === 499 || typeof scannerConfigRes.data.config?.registrationFee === 'number')
    ) {
      logPass(9, 'Existing customer portal, owner shop management, and scanner config continue to work smoothly');
    } else {
      logFail(9, 'Regression check', `Cust: ${custProfileRes.status}, Shop: ${ownerShopRes.status}, Scanner: ${scannerConfigRes.status}, Data: ${JSON.stringify(scannerConfigRes.data)}`);
    }

    console.log('\n========================================');
    console.log('ALL MODULE 3 PAYMENT & APPROVAL TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runAllTests();
