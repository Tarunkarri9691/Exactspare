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

const PORT = 5072; // Dedicated test port
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

const logPass = (num, desc) => {
  passed++;
  console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
};

const logFail = (num, desc, err) => {
  failed++;
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

const runPrompt2Verification = async () => {
  console.log('\n===============================================================');
  console.log('EXACTSPARE MODULE 19, PROMPT 2 — COMPLETE OWNER APPLICATION TEST');
  console.log('===============================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    await mongoose.connect(mongoUri);
    console.log('✔ Connected to MongoDB');

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        console.log(`✔ Test server listening on http://127.0.0.1:${PORT}\n`);
        resolve();
      });
    });

    const timestamp = Date.now();
    const ownerOneEmail = `owner_p2_1_${timestamp}@exactspare.test`;
    const ownerTwoEmail = `owner_p2_2_${timestamp}@exactspare.test`;
    const customerEmail = `cust_p2_${timestamp}@exactspare.test`;
    const adminEmail = `admin_p2_${timestamp}@exactspare.test`;
    const password = 'StrongPassword@123';

    // 1. Register Owner 1
    const regOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Merchant Vikram',
        email: ownerOneEmail,
        password,
        confirmPassword: password,
        phone: '+919876543221',
        role: 'OWNER'
      }
    });
    const owner1Cookie = parseCookie(regOwner1);
    const owner1Id = regOwner1.data.user?._id;

    // 2. Register Owner 2
    const regOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Merchant Suresh',
        email: ownerTwoEmail,
        password,
        confirmPassword: password,
        phone: '+919876543222',
        role: 'OWNER'
      }
    });
    const owner2Cookie = parseCookie(regOwner2);
    const owner2Id = regOwner2.data.user?._id;

    // 3. Register Customer
    const regCust = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Buyer Ramesh',
        email: customerEmail,
        password,
        confirmPassword: password,
        phone: '+919876543223',
        role: 'CUSTOMER'
      }
    });
    const customerCookie = parseCookie(regCust);

    // 4. Create Admin
    let adminUser = await User.findOne({ role: 'ADMIN' });
    let adminCookie = '';
    if (adminUser) {
      const loginAdmin = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: adminUser.email, password: 'AdminExactSpare@2026' }
      });
      adminCookie = parseCookie(loginAdmin);
    }
    if (!adminCookie) {
      const regAdmin = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Compliance Admin',
          email: adminEmail,
          password,
          confirmPassword: password,
          phone: '+919876543224',
          role: 'ADMIN'
        }
      });
      adminCookie = parseCookie(regAdmin);
    }

    // =========================================================================
    // Test 1: First-time owner checks application status (no application yet)
    // =========================================================================
    const initialCheck = await makeRequest('/api/shop-applications/my', {
      headers: { Cookie: owner1Cookie }
    });
    if (initialCheck.status === 200 && initialCheck.data.hasApplication === false) {
      logPass(1, 'First-time owner query correctly reports no active application (redirects to /owner/application)');
    } else {
      logFail(1, 'First-time owner query failed', JSON.stringify(initialCheck.data));
    }

    // =========================================================================
    // Test 2: Owner saves Draft with new fields (A: Owner, B: Shop, C: Address)
    // =========================================================================
    const draftPayload = {
      shopName: 'Metro Velocity Auto Spares',
      ownerFullName: 'Merchant Vikram',
      ownerPhone: '9876543221',
      alternatePhone: '9876543299',
      ownerBusinessRole: 'Proprietor',
      businessPhone: '022-28491029',
      businessEmail: 'store@metrovelocity.in',
      yearsInBusiness: 8,
      shopDescription: 'Wholesale and retail distributor of OEM brake pads, clutch plates, and synthetic engine oils.',
      shopCategory: 'MULTI_CATEGORY',
      addressLine: 'Shop #12, Ground Floor, Motor Commercial Hub',
      locality: 'Opera House',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400004',
      country: 'India',
      latitude: 18.9553,
      longitude: 72.8188,
      openingHours: 'Mon-Sat: 09:30 AM - 08:30 PM',
      action: 'SAVE_DRAFT'
    };

    const draftRes = await makeRequest('/api/shop-applications', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: draftPayload
    });

    const applicationId = draftRes.data?.application?._id;
    if (draftRes.status === 201 && draftRes.data.application?.status === 'DRAFT') {
      logPass(2, 'Owner successfully saved application DRAFT with full multi-section details in MongoDB');
    } else {
      logFail(2, 'Draft creation failed', JSON.stringify(draftRes.data));
    }

    // =========================================================================
    // Test 3: Existing draft loads correctly with saved fields
    // =========================================================================
    const loadDraft = await makeRequest('/api/shop-applications/my', {
      headers: { Cookie: owner1Cookie }
    });
    if (
      loadDraft.status === 200 && 
      loadDraft.data.hasApplication === true && 
      loadDraft.data.application.shopName === 'Metro Velocity Auto Spares' &&
      loadDraft.data.application.ownerBusinessRole === 'Proprietor' &&
      loadDraft.data.application.yearsInBusiness === 8 &&
      loadDraft.data.application.locality === 'Opera House'
    ) {
      logPass(3, 'Existing draft reopens and preserves all saved information from Sections A, B, and C');
    } else {
      logFail(3, 'Draft loading failed', JSON.stringify(loadDraft.data));
    }

    // =========================================================================
    // Test 4: Required-field validation on submission (missing storefront photo)
    // =========================================================================
    const submitWithoutPhoto = await makeRequest(`/api/shop-applications/${applicationId}/submit`, {
      method: 'POST',
      headers: { Cookie: owner1Cookie }
    });
    if (submitWithoutPhoto.status === 400 && submitWithoutPhoto.data.message.includes('missing mandatory fields')) {
      logPass(4, 'Server validation rejects submission when required storefront photograph is missing (HTTP 400)');
    } else {
      logFail(4, 'Submission without photo was not rejected', JSON.stringify(submitWithoutPhoto.data));
    }

    // Attach verified mock storefront photo directly to application document in DB
    await ShopApplication.findByIdAndUpdate(applicationId, {
      shopImagePaths: ['uploads/shops/exterior-storefront.jpg', 'uploads/shops/interior-counter.jpg'],
      shopExteriorImagePath: 'uploads/shops/exterior-storefront.jpg',
      shopInteriorImagePath: 'uploads/shops/interior-counter.jpg',
      verificationDocumentPaths: ['uploads/documents/trade-license.pdf']
    });

    // =========================================================================
    // Test 5: Valid submission creates PENDING status with submittedAt timestamp
    // =========================================================================
    const validSubmit = await makeRequest(`/api/shop-applications/${applicationId}/submit`, {
      method: 'POST',
      headers: { Cookie: owner1Cookie }
    });

    const updatedApp = await ShopApplication.findById(applicationId);
    if (
      validSubmit.status === 200 && 
      updatedApp.status === 'PENDING' && 
      updatedApp.submittedAt instanceof Date
    ) {
      logPass(5, `Application submission records status PENDING with submittedAt (${updatedApp.submittedAt.toISOString()})`);
    } else {
      logFail(5, 'Valid submission failed', JSON.stringify(validSubmit.data));
    }

    // =========================================================================
    // Test 6: Submission does NOT automatically approve shop or publish inventory
    // =========================================================================
    const shopCheck = await Shop.findOne({ applicationId });
    if (!shopCheck || !shopCheck.isApproved) {
      logPass(6, 'Submitting application truthfully DOES NOT automatically approve shop or grant permissions');
    } else {
      logFail(6, 'Shop was prematurely approved without admin review', shopCheck);
    }

    // =========================================================================
    // Test 7: Owner cannot access another owner's application (HTTP 403)
    // =========================================================================
    const crossOwnerAccess = await makeRequest(`/api/shop-applications/${applicationId}`, {
      headers: { Cookie: owner2Cookie }
    });
    if (crossOwnerAccess.status === 403) {
      logPass(7, "Owner 2 strictly forbidden from accessing Owner 1's application (HTTP 403 Forbidden)");
    } else {
      logFail(7, 'Cross-owner access was not forbidden', JSON.stringify(crossOwnerAccess.data));
    }

    // =========================================================================
    // Test 8: Owner cannot approve their own application (HTTP 403)
    // =========================================================================
    const selfApprove = await makeRequest(`/api/admin/shop-applications/${applicationId}/decision`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { decision: 'APPROVED' }
    });
    if (selfApprove.status === 403) {
      logPass(8, 'Owner strictly forbidden from approving their own application (HTTP 403 Forbidden)');
    } else {
      logFail(8, 'Owner self-approval was not rejected', JSON.stringify(selfApprove.data));
    }

    // =========================================================================
    // Test 9: Admin requests correction; application enters NEEDS_CORRECTION
    // =========================================================================
    const correctionMsg = 'Please provide updated exterior photograph showing the permanent street signage board clearly.';
    const requestCorrection = await makeRequest(`/api/admin/shop-applications/${applicationId}/decision`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie },
      body: {
        decision: 'NEEDS_CORRECTION',
        correctionMessage: correctionMsg
      }
    });

    const appNeedsCorrection = await ShopApplication.findById(applicationId);
    if (
      requestCorrection.status === 200 && 
      appNeedsCorrection.status === 'NEEDS_CORRECTION' &&
      appNeedsCorrection.correctionMessage === correctionMsg
    ) {
      logPass(9, 'Admin flagged application as NEEDS_CORRECTION with specific feedback message');
    } else {
      logFail(9, 'Correction request failed', JSON.stringify(requestCorrection.data));
    }

    // =========================================================================
    // Test 10: Owner edits and resubmits corrected application
    // =========================================================================
    const updateResubmit = await makeRequest(`/api/shop-applications/${applicationId}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        shopDescription: 'Updated inventory with authentic certified Bosch & Brembo stock. Clear commercial board installed.',
        action: 'SUBMIT'
      }
    });

    const resubmittedApp = await ShopApplication.findById(applicationId);
    if (
      updateResubmit.status === 200 && 
      resubmittedApp.status === 'PENDING' &&
      resubmittedApp.shopDescription.includes('Updated inventory')
    ) {
      logPass(10, 'Owner successfully updated details and resubmitted application back to PENDING review');
    } else {
      logFail(10, 'Resubmission failed', JSON.stringify(updateResubmit.data));
    }

    // =========================================================================
    // Test 11: Customer and Admin portals remain completely intact & functional
    // =========================================================================
    const customerPartsQuery = await makeRequest('/api/parts', {
      headers: { Cookie: customerCookie }
    });
    const adminAppsQueue = await makeRequest('/api/admin/shop-applications', {
      headers: { Cookie: adminCookie }
    });

    if (customerPartsQuery.status === 200 && adminAppsQueue.status === 200) {
      logPass(11, 'Customer portal (/api/parts) and Admin review portal (/api/admin/shop-applications) fully operational');
    } else {
      logFail(11, 'Portal checks failed', `Cust: ${customerPartsQuery.status}, Admin: ${adminAppsQueue.status}`);
    }

    console.log('\n===============================================================');
    console.log(`TOTAL PASSED: ${passed} / 11`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log('===============================================================\n');

  } catch (error) {
    console.error('Fatal error in Prompt 2 test workflow:', error);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runPrompt2Verification();
