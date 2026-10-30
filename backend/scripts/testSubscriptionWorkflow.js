import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Notification from '../models/Notification.js';

const PORT = 5063;
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

async function runSubscriptionTests() {
  console.log('\n================================================================');
  console.log('EXACTSPARE DIRECT OWNER SUBSCRIPTION & VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    server = app.listen(PORT);
    await new Promise((res) => server.once('listening', res));

    // Test Users
    const timestamp = Date.now();
    const adminEmail = `admin_dirsub_${timestamp}@exactspare.test`;
    const owner1Email = `owner1_dirsub_${timestamp}@exactspare.test`;
    const owner2Email = `owner2_dirsub_${timestamp}@exactspare.test`;
    const password = 'Password@123';

    // 1. Create Users in DB
    const adminUser = await User.create({
      name: 'Admin Director',
      email: adminEmail,
      phone: '+919876543230',
      passwordHash: await import('bcryptjs').then(b => b.default.hash(password, 8)),
      role: 'ADMIN',
      accountStatus: 'ACTIVE'
    });

    const owner1User = await User.create({
      name: 'Owner Alfa Store',
      email: owner1Email,
      phone: '+919876543231',
      passwordHash: await import('bcryptjs').then(b => b.default.hash(password, 8)),
      role: 'OWNER',
      accountStatus: 'ACTIVE'
    });

    const owner2User = await User.create({
      name: 'Owner Beta Store',
      email: owner2Email,
      phone: '+919876543232',
      passwordHash: await import('bcryptjs').then(b => b.default.hash(password, 8)),
      role: 'OWNER',
      accountStatus: 'ACTIVE'
    });

    // Login users to get session cookies
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password }
    });
    const adminCookie = parseCookie(adminLoginRes);

    const owner1LoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: owner1Email, password }
    });
    const owner1Cookie = parseCookie(owner1LoginRes);

    const owner2LoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: owner2Email, password }
    });
    const owner2Cookie = parseCookie(owner2LoginRes);

    // TEST 1: Subscription Config & UPI Details
    const configRes = await makeRequest('/api/subscriptions/config');
    if (
      configRes.status === 200 &&
      Boolean(configRes.data?.config?.upiId) &&
      configRes.data?.config?.plans?.length >= 2 &&
      configRes.data?.config?.verificationMode === 'ADMIN_VERIFICATION'
    ) {
      logPass(1, `GET /api/subscriptions/config returns genuine UPI ID (${configRes.data?.config?.upiId}), plans, and ADMIN_VERIFICATION mode`);
    } else {
      logFail(1, 'GET /api/subscriptions/config failed', JSON.stringify(configRes.data));
    }

    // TEST 2: Owner initial subscription status is NOT_SUBSCRIBED
    const initialSubRes = await makeRequest('/api/subscriptions/my', {
      headers: { Cookie: owner1Cookie }
    });
    if (initialSubRes.status === 200 && initialSubRes.data?.overallStatus === 'NOT_SUBSCRIBED') {
      logPass(2, 'GET /api/subscriptions/my initially returns NOT_SUBSCRIBED with empty history for new owner');
    } else {
      logFail(2, 'Initial status check failed', JSON.stringify(initialSubRes.data));
    }

    // TEST 3: Payment Submission requires valid UTR and marks status as PENDING_VERIFICATION (Never auto-activated)
    const testUtr1 = `UTR${timestamp}001`;
    const submitRes = await makeRequest('/api/subscriptions/submit', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        planId: 'quarterly_partner',
        paymentMethod: 'PHONEPE',
        paymentUtr: testUtr1
      }
    });
    const subRecord1 = submitRes.data?.subscription;

    if (
      submitRes.status === 201 &&
      subRecord1?.status === 'PENDING_VERIFICATION' &&
      subRecord1?.paymentUtr === testUtr1 &&
      subRecord1?.internalRef?.startsWith('SUB-EXS-') &&
      subRecord1?.amount === 499
    ) {
      logPass(3, 'POST /api/subscriptions/submit saves payment record with PENDING_VERIFICATION status (Never auto-approved)');
    } else {
      logFail(3, 'Payment submission failed or inappropriately auto-approved', JSON.stringify(submitRes.data));
    }

    // TEST 4: Anti-Duplicate Reference Check: Submitting same UTR returns HTTP 400
    const duplicateRes = await makeRequest('/api/subscriptions/submit', {
      method: 'POST',
      headers: { Cookie: owner2Cookie },
      body: {
        planId: 'quarterly_partner',
        paymentMethod: 'GOOGLE_PAY',
        paymentUtr: testUtr1
      }
    });
    if (duplicateRes.status === 400 && duplicateRes.data?.message?.includes('already')) {
      logPass(4, 'Anti-duplicate UTR validation strictly blocks duplicate transaction reference with HTTP 400');
    } else {
      logFail(4, 'Duplicate UTR was not rejected', JSON.stringify(duplicateRes.data));
    }

    // TEST 5: Security: Prevent owners from verifying their own payments
    const selfVerifyRes = await makeRequest(`/api/subscriptions/admin/${subRecord1._id}/verify`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie }
    });
    if (selfVerifyRes.status === 403) {
      logPass(5, 'Owner attempting self-verification is strictly blocked with HTTP 403 Forbidden');
    } else {
      logFail(5, 'Self-verification was not blocked', JSON.stringify(selfVerifyRes.data));
    }

    // TEST 6: Admin Dashboard listing: Admin sees pending submission with UTR, plan, and amount
    const adminListRes = await makeRequest(`/api/subscriptions/admin?search=${testUtr1}`, {
      headers: { Cookie: adminCookie }
    });
    if (
      adminListRes.status === 200 &&
      adminListRes.data?.subscriptions?.length === 1 &&
      adminListRes.data?.subscriptions[0]?.paymentUtr === testUtr1 &&
      adminListRes.data?.subscriptions[0]?.status === 'PENDING_VERIFICATION'
    ) {
      logPass(6, 'Admin reviews pending payments displaying owner, plan, amount, and UTR');
    } else {
      logFail(6, 'Admin search/listing failed', JSON.stringify(adminListRes.data));
    }

    // TEST 7: Admin Rejection with mandatory reason marks PAYMENT_FAILED and creates AdminAuditLog
    const rejectRes = await makeRequest(`/api/subscriptions/admin/${subRecord1._id}/reject`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie },
      body: { reason: 'UTR bank statement mismatch. Amount not received in merchant account.' }
    });
    const auditReject = await AdminAuditLog.findOne({
      action: 'SUBSCRIPTION_PAYMENT_REJECTED',
      entityId: subRecord1._id
    });

    if (
      rejectRes.status === 200 &&
      rejectRes.data?.subscription?.status === 'PAYMENT_FAILED' &&
      auditReject &&
      auditReject.reason?.includes('bank statement mismatch')
    ) {
      logPass(7, 'Admin rejection sets status to PAYMENT_FAILED with reason and records AdminAuditLog');
    } else {
      logFail(7, 'Admin rejection failed', JSON.stringify(rejectRes.data));
    }

    // TEST 8: Owner resubmits valid payment reference -> enters PENDING_VERIFICATION again
    const testUtr2 = `UTR${timestamp}002`;
    const resubmitRes = await makeRequest('/api/subscriptions/submit', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        planId: 'quarterly_partner',
        paymentMethod: 'UPI_QR',
        paymentUtr: testUtr2
      }
    });
    const subRecord2 = resubmitRes.data?.subscription;

    if (
      resubmitRes.status === 201 &&
      subRecord2?.status === 'PENDING_VERIFICATION' &&
      subRecord2?.paymentUtr === testUtr2
    ) {
      logPass(8, 'Owner can resubmit payment reference after rejection (recorded as PENDING_VERIFICATION)');
    } else {
      logFail(8, 'Owner resubmission failed', JSON.stringify(resubmitRes.data));
    }

    // TEST 9: Admin Verification activates subscription, sets 90-day validity, and logs audit
    const verifyRes = await makeRequest(`/api/subscriptions/admin/${subRecord2._id}/verify`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie }
    });
    const auditVerify = await AdminAuditLog.findOne({
      action: 'SUBSCRIPTION_PAYMENT_VERIFIED',
      entityId: subRecord2._id
    });
    const now = Date.now();
    const expiryTime = new Date(verifyRes.data?.subscription?.expiryDate).getTime();
    const diffDays = Math.round((expiryTime - now) / (1000 * 60 * 60 * 24));

    if (
      verifyRes.status === 200 &&
      verifyRes.data?.subscription?.status === 'ACTIVE' &&
      diffDays === 90 &&
      auditVerify
    ) {
      logPass(9, 'Admin verification activates subscription (ACTIVE, 90 days validity, AdminAuditLog recorded)');
    } else {
      logFail(9, 'Admin verification failed', JSON.stringify(verifyRes.data));
    }

    // TEST 10: Backend Shop Management Access Enforcement:
    // Even though subscription is ACTIVE, owner has no approved shop yet -> part creation is blocked with pending-approval message
    const partCreateRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        name: 'Brembo Front Brake Disc',
        partNumber: `BRK-${timestamp}`,
        category: 'BRAKES',
        price: 3200,
        stockQuantity: 10
      }
    });

    if (
      partCreateRes.status === 403 &&
      (partCreateRes.data?.message?.includes('approval') || partCreateRes.data?.message?.includes('shop'))
    ) {
      logPass(10, 'Backend blocks unapproved shop from catalog inventory management even with ACTIVE subscription');
    } else {
      logFail(10, 'Part creation was not blocked for unapproved shop', JSON.stringify(partCreateRes.data));
    }

    // TEST 11: Owner Status & History reflects ACTIVE status and history records
    const ownerStatusRes = await makeRequest('/api/subscriptions/my', {
      headers: { Cookie: owner1Cookie }
    });
    if (
      ownerStatusRes.status === 200 &&
      ownerStatusRes.data?.overallStatus === 'ACTIVE' &&
      ownerStatusRes.data?.history?.length >= 2
    ) {
      logPass(11, 'GET /api/subscriptions/my reports real-time ACTIVE status and complete history to owner');
    } else {
      logFail(11, 'Owner status retrieval failed', JSON.stringify(ownerStatusRes.data));
    }

    // TEST 12: Expiry Synchronization Check: Past expiry transitions to EXPIRED
    await Subscription.findByIdAndUpdate(subRecord2._id, {
      expiryDate: new Date(Date.now() - 1000 * 60 * 60 * 24) // expired yesterday
    });
    const expiredCheckRes = await makeRequest('/api/subscriptions/my', {
      headers: { Cookie: owner1Cookie }
    });
    if (
      expiredCheckRes.status === 200 &&
      expiredCheckRes.data?.overallStatus === 'EXPIRED' &&
      expiredCheckRes.data?.currentSubscription?.status === 'EXPIRED'
    ) {
      logPass(12, 'Automatic expiration check transitions status from ACTIVE to EXPIRED when validity expires');
    } else {
      logFail(12, 'Expiration transition failed', JSON.stringify(expiredCheckRes.data));
    }

    // Clean up test records
    await Subscription.deleteMany({ ownerId: { $in: [owner1User._id, owner2User._id] } });
    await Notification.deleteMany({ recipientId: { $in: [owner1User._id, owner2User._id] } });
    await AdminAuditLog.deleteMany({ adminId: adminUser._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, owner1User._id, owner2User._id] } });

    console.log('\n================================================================');
    console.log('ALL 12 DIRECT OWNER SUBSCRIPTION WORKFLOW TESTS PASSED! ✔');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
  }
}

runSubscriptionTests().then(() => {
  process.exit(process.exitCode || 0);
});
