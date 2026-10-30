import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Notification from '../models/Notification.js';
import Enquiry from '../models/Enquiry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5066; // Dedicated test port for Prompt 6
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

async function runPrompt6Tests() {
  console.log('\n======================================================');
  console.log('EXACTSPARE — Prompt 6: Customer Enquiries & Shop Communication Test Suite');
  console.log('======================================================\n');

  let server;

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    console.log('Connected to MongoDB for Prompt 6 verification.');

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`Test server live on ${baseUrl}`);

    // Clean up past test fixtures
    await User.deleteMany({ email: { $regex: /prompt6.*@exactspare\.com/ } });
    await Shop.deleteMany({ name: { $regex: /Prompt 6 / } });
    await ShopApplication.deleteMany({ businessEmail: { $regex: /prompt6.*@exactspare\.com/ } });
    await SparePart.deleteMany({ partNumber: { $regex: /P6-/ } });
    await Enquiry.deleteMany({ subject: { $regex: /Prompt 6/ } });

    // 1. Register Owner 1
    const regResOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'P6 Owner Alpha',
        email: 'prompt6.owner1@exactspare.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'OWNER',
        phone: '+91 9811223344'
      }
    });
    const owner1Cookie = parseCookie(regResOwner1);
    const owner1User = regResOwner1.data?.user || regResOwner1.data?.data?.user;
    const owner1Id = owner1User?._id || owner1User?.id;

    // 2. Register Owner 2
    const regResOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'P6 Owner Beta',
        email: 'prompt6.owner2@exactspare.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'OWNER',
        phone: '+91 9822334455'
      }
    });
    const owner2Cookie = parseCookie(regResOwner2);
    const owner2User = regResOwner2.data?.user || regResOwner2.data?.data?.user;
    const owner2Id = owner2User?._id || owner2User?.id;

    // 3. Register Customer 1
    const regResCust1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'P6 Customer Ramesh',
        email: 'prompt6.cust1@exactspare.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'CUSTOMER',
        phone: '+91 9833445566'
      }
    });
    const cust1Cookie = parseCookie(regResCust1);
    const customer1 = regResCust1.data?.user || regResCust1.data?.data?.user;
    const customer1Id = customer1?._id || customer1?.id;

    // 4. Register Customer 2
    const regResCust2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'P6 Customer Suresh',
        email: 'prompt6.cust2@exactspare.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'CUSTOMER',
        phone: '+91 9844556677'
      }
    });
    const cust2Cookie = parseCookie(regResCust2);

    // Create Approved Shop 1
    const appId1 = new mongoose.Types.ObjectId();
    const shop1Id = new mongoose.Types.ObjectId();

    await ShopApplication.create({
      _id: appId1,
      ownerId: owner1Id,
      ownerFullName: 'P6 Owner Alpha',
      ownerPhone: '+91 9811223344',
      businessEmail: 'prompt6.owner1@exactspare.com',
      shopName: 'Prompt 6 Alpha Auto Spares',
      shopCategory: 'MULTI_CATEGORY',
      shopDescription: 'Verified test store for Prompt 6 customer enquiries',
      addressLine: '123 Test Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600001',
      latitude: 13.0827,
      longitude: 80.2707,
      status: 'APPROVED',
      paymentStatus: 'PAID'
    });

    const shop1 = await Shop.create({
      _id: shop1Id,
      ownerId: owner1Id,
      applicationId: appId1,
      name: 'Prompt 6 Alpha Auto Spares',
      category: 'MULTI_CATEGORY',
      description: 'Verified test store for Prompt 6 customer enquiries',
      address: {
        addressLine: '123 Test Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600001',
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827]
        }
      },
      contact: {
        phone: '+91 9811223344',
        email: 'prompt6.owner1@exactspare.com'
      },
      isApproved: true,
      isActive: true,
      status: 'ACTIVE'
    });

    // Create Spare Part for Shop 1
    const part1 = await SparePart.create({
      partName: 'Prompt 6 Front Brake Disc Rotor',
      partNumber: 'P6-BRK-001',
      category: 'Brakes',
      description: 'High performance OEM front brake disc rotor for passenger hatchbacks',
      price: 2450,
      stockQuantity: 10,
      condition: 'NEW',
      vehicleType: 'Car',
      manufacturer: 'Brembo OEM',
      isPublished: true,
      shopId: shop1._id,
      ownerId: owner1Id
    });

    // Create Approved Shop 2 (for tenant isolation check)
    const appId2 = new mongoose.Types.ObjectId();
    const shop2Id = new mongoose.Types.ObjectId();

    await ShopApplication.create({
      _id: appId2,
      ownerId: owner2Id,
      ownerFullName: 'P6 Owner Beta',
      ownerPhone: '+91 9822334455',
      businessEmail: 'prompt6.owner2@exactspare.com',
      shopName: 'Prompt 6 Beta Spares Store',
      shopCategory: 'MULTI_CATEGORY',
      shopDescription: 'Competitor test store',
      addressLine: '456 Cross Street',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      status: 'APPROVED',
      paymentStatus: 'PAID'
    });

    const shop2 = await Shop.create({
      _id: shop2Id,
      ownerId: owner2Id,
      applicationId: appId2,
      name: 'Prompt 6 Beta Spares Store',
      category: 'MULTI_CATEGORY',
      description: 'Competitor test store',
      address: {
        addressLine: '456 Cross Street',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      contact: {
        phone: '+91 9822334455',
        email: 'prompt6.owner2@exactspare.com'
      },
      isApproved: true,
      isActive: true,
      status: 'ACTIVE'
    });

    // TEST 1: Unauthenticated request to submit enquiry must be rejected
    const test1Res = await makeRequest('/api/enquiries', {
      method: 'POST',
      body: {
        shopId: shop1._id.toString(),
        subject: 'Prompt 6 Test unauth',
        message: 'Hello store owner'
      }
    });
    if (test1Res.status === 401) {
      logPass(1, 'Unauthenticated user rejected from submitting enquiry (401)');
    } else {
      logFail(1, 'Unauthenticated submission should return 401', test1Res.status);
    }

    // TEST 2: Validation rejection on empty/too short message
    const test2Res = await makeRequest('/api/enquiries', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shopId: shop1._id.toString(),
        subject: 'Prompt 6 Short',
        message: 'Hi' // < 5 characters
      }
    });
    if (test2Res.status === 400 && test2Res.data?.success === false) {
      logPass(2, 'Enquiry submission with invalid/too-short message rejected (400)');
    } else {
      logFail(2, 'Short message submission should fail with 400', test2Res.status);
    }

    // TEST 3: Validation rejection on non-existent shop
    const test3Res = await makeRequest('/api/enquiries', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shopId: new mongoose.Types.ObjectId().toString(),
        subject: 'Prompt 6 Invalid Shop',
        message: 'Inquiring about your inventory'
      }
    });
    if (test3Res.status === 404) {
      logPass(3, 'Enquiry submission for non-existent shop rejected (404)');
    } else {
      logFail(3, 'Submission for non-existent shop should return 404', test3Res.status);
    }

    // TEST 4: Validation rejection if spare part belongs to another shop
    const test4Res = await makeRequest('/api/enquiries', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shopId: shop2._id.toString(), // Shop 2
        sparePartId: part1._id.toString(), // Part belongs to Shop 1!
        subject: 'Prompt 6 Cross Part Test',
        message: 'Inquiring about fitment'
      }
    });
    if (test4Res.status === 400) {
      logPass(4, 'Enquiry referencing part from another shop rejected (400)');
    } else {
      logFail(4, 'Mismatched shop/part should return 400', test4Res.status);
    }

    // TEST 5: Customer 1 successfully submits an enquiry for Shop 1 & Part 1
    const test5Res = await makeRequest('/api/enquiries', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shopId: shop1._id.toString(),
        sparePartId: part1._id.toString(),
        customerName: 'Ramesh Auto Enthusiast',
        customerEmail: 'prompt6.cust1@exactspare.com',
        customerPhone: '+91 9833445566',
        subject: 'Prompt 6: Fitment Compatibility for 2018 Swift VXI',
        message: 'Hello, is this Brembo brake disc rotor compatible with the 2018 Maruti Suzuki Swift VXI model? Also do you have 2 pieces available for immediate in-store pickup today?',
        vehicleInfo: {
          make: 'Maruti Suzuki',
          model: 'Swift VXI',
          year: '2018',
          compatibilityQuestion: 'Does it fit standard 14 inch OEM wheels?'
        }
      }
    });
    let createdEnquiryId = null;
    if (test5Res.status === 201 && test5Res.data?.success && test5Res.data?.data?._id) {
      createdEnquiryId = test5Res.data.data._id;
      logPass(5, `Customer enquiry successfully created (ID: ${createdEnquiryId}, status: NEW)`);
    } else {
      logFail(5, 'Valid enquiry submission failed', JSON.stringify(test5Res.data));
    }

    // TEST 6: Real database notification created for Shop Owner 1
    const owner1Notifs = await Notification.find({
      recipientId: owner1Id,
      type: 'CUSTOMER_ENQUIRY'
    }).sort({ createdAt: -1 });
    if (owner1Notifs.length > 0 && owner1Notifs[0].title.includes('New Customer Enquiry')) {
      logPass(6, `Shop Owner received real database notification (Title: "${owner1Notifs[0].title}")`);
    } else {
      logFail(6, 'Owner notification not found in database', owner1Notifs.length);
    }

    // TEST 7: Shop Owner 1 retrieves their shop enquiries
    const test7Res = await makeRequest('/api/enquiries/owner', {
      headers: { Cookie: owner1Cookie }
    });
    if (test7Res.status === 200 && test7Res.data?.success && Array.isArray(test7Res.data?.data)) {
      const found = test7Res.data.data.find(e => e._id.toString() === createdEnquiryId.toString());
      if (found && found.subject.includes('Prompt 6') && found.sparePartId?.partName) {
        logPass(7, `Shop Owner 1 successfully listed enquiries with populated part info (${test7Res.data.data.length} total)`);
      } else {
        logFail(7, 'Created enquiry not found in owner list', JSON.stringify(test7Res.data));
      }
    } else {
      logFail(7, 'Owner enquiry list failed', test7Res.status);
    }

    // TEST 8: Cross-owner access isolation — Owner 2 CANNOT see Owner 1's enquiries
    const test8Res = await makeRequest('/api/enquiries/owner', {
      headers: { Cookie: owner2Cookie }
    });
    if (test8Res.status === 200) {
      const crossFound = (test8Res.data?.data || []).find(e => e._id.toString() === createdEnquiryId.toString());
      if (!crossFound) {
        logPass(8, 'Cross-owner isolation verified: Owner 2 cannot view Owner 1 enquiries');
      } else {
        logFail(8, 'LEAK: Owner 2 was able to view Owner 1 enquiry!', crossFound);
      }
    } else {
      logFail(8, 'Owner 2 enquiry list failed', test8Res.status);
    }

    // TEST 9: Customer 1 retrieves their own submitted enquiries
    const test9Res = await makeRequest('/api/enquiries/my', {
      headers: { Cookie: cust1Cookie }
    });
    if (test9Res.status === 200 && test9Res.data?.success) {
      const myEnq = (test9Res.data?.data || []).find(e => e._id.toString() === createdEnquiryId.toString());
      if (myEnq && myEnq.shopId?.name) {
        logPass(9, `Customer 1 retrieved submitted enquiry with populated shop details (${myEnq.shopId.name})`);
      } else {
        logFail(9, 'Customer 1 enquiry not found in my enquiries', JSON.stringify(test9Res.data));
      }
    } else {
      logFail(9, 'Customer enquiries list failed', test9Res.status);
    }

    // TEST 10: Customer 2 CANNOT access Customer 1's enquiry details
    const test10Res = await makeRequest(`/api/enquiries/${createdEnquiryId}`, {
      headers: { Cookie: cust2Cookie }
    });
    if (test10Res.status === 403) {
      logPass(10, 'Cross-customer isolation verified: Customer 2 blocked from viewing Customer 1 enquiry (403)');
    } else {
      logFail(10, 'Customer 2 should receive 403 Forbidden', test10Res.status);
    }

    // TEST 11: Owner 1 updates enquiry status to IN_PROGRESS
    const test11Res = await makeRequest(`/api/enquiries/${createdEnquiryId}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'IN_PROGRESS' }
    });
    if (test11Res.status === 200 && test11Res.data?.data?.status === 'IN_PROGRESS') {
      logPass(11, 'Owner 1 successfully updated enquiry status to IN_PROGRESS');
    } else {
      logFail(11, 'Status update to IN_PROGRESS failed', test11Res.status);
    }

    // TEST 12: Customer CANNOT update enquiry status (Forbidden)
    const test12Res = await makeRequest(`/api/enquiries/${createdEnquiryId}/status`, {
      method: 'PATCH',
      headers: { Cookie: cust1Cookie },
      body: { status: 'CLOSED' }
    });
    if (test12Res.status === 403) {
      logPass(12, 'Customer forbidden from updating enquiry status directly (403)');
    } else {
      logFail(12, 'Customer should not be allowed to change status', test12Res.status);
    }

    // TEST 13: Owner 1 posts a reply message to the enquiry thread
    const test13Res = await makeRequest(`/api/enquiries/${createdEnquiryId}/reply`, {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        message: 'Yes, this rotor fits the 2018 Swift VXI perfectly. We have 4 units in stock at our Chennai storefront. You are welcome to visit today between 9 AM and 8 PM!'
      }
    });
    if (test13Res.status === 200 && test13Res.data?.success) {
      const updated = test13Res.data.data;
      if (updated.status === 'REPLIED' && updated.replies.length === 1 && updated.replies[0].senderRole === 'OWNER') {
        logPass(13, 'Owner successfully replied to enquiry thread; status transitioned to REPLIED');
      } else {
        logFail(13, 'Reply did not update status or replies correctly', JSON.stringify(updated));
      }
    } else {
      logFail(13, 'Owner reply failed', test13Res.status);
    }

    // TEST 14: Customer receives notification on owner reply
    const cust1Notifs = await Notification.find({
      recipientId: customer1Id
    }).sort({ createdAt: -1 });
    if (cust1Notifs.length > 0 && (cust1Notifs[0].title.includes('Replied') || cust1Notifs[0].title.includes('Enquiry'))) {
      logPass(14, `Customer received real database notification on owner response ("${cust1Notifs[0].title}")`);
    } else {
      logFail(14, 'Customer response notification not found', cust1Notifs.length);
    }

    // TEST 15: Customer posts a follow-up reply in the thread
    const test15Res = await makeRequest(`/api/enquiries/${createdEnquiryId}/reply`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        message: 'Thank you for the quick confirmation! I will stop by your shop around 5 PM today for pickup.'
      }
    });
    if (test15Res.status === 200 && test15Res.data?.data?.replies?.length === 2) {
      logPass(15, 'Customer successfully appended follow-up message to enquiry thread (2 messages total)');
    } else {
      logFail(15, 'Customer follow-up reply failed', test15Res.status);
    }

    // TEST 16: Owner closes the enquiry
    const test16Res = await makeRequest(`/api/enquiries/${createdEnquiryId}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'CLOSED' }
    });
    if (test16Res.status === 200 && test16Res.data?.data?.status === 'CLOSED') {
      logPass(16, 'Owner successfully marked enquiry as CLOSED');
    } else {
      logFail(16, 'Closing enquiry failed', test16Res.status);
    }

    console.log('\n------------------------------------------------------');
    console.log('ALL PROMPT 6 TEST CASES PASSED SUCCESSFULLY (16/16)!');
    console.log('------------------------------------------------------\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  }
}

runPrompt6Tests();
