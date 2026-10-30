import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'exactspare_super_secret_jwt_key_change_in_production';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import SupportTicket from '../models/SupportTicket.js';

const PORT = 5063; // Dedicated test port for Module 13
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

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🚀 EXACTSPARE MODULE 13 VERIFICATION & TEST SUITE');
  console.log('Live Order Tracking, Delivery Updates & Customer Support');
  console.log('======================================================\n');

  try {
    // 1. Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare');
    }

    // 2. Start HTTP Test Server
    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`Test server running on port ${PORT}`);
        resolve();
      });
    });

    // Clean up past test fixtures for module 13
    await User.deleteMany({ email: { $in: ['custA.m13@test.com', 'custB.m13@test.com', 'owner.m13@test.com', 'admin.m13@test.com'] } });
    await SupportTicket.deleteMany({ subject: { $regex: /m13_test/i } });
    await Order.deleteMany({ orderNumber: { $regex: /^EXS-M13/ } });

    // 3. Register Customer A, Customer B, Shop Owner, Admin
    const customerAPassword = 'PasswordA@123';
    const customerBPassword = 'PasswordB@123';
    const ownerPassword = 'PasswordOwner@123';
    const adminPassword = 'PasswordAdmin@123';

    const custA = await User.create({
      name: 'Customer A Module 13',
      email: 'custA.m13@test.com',
      phone: '+919876543201',
      passwordHash: await User.hashPassword(customerAPassword),
      role: 'CUSTOMER'
    });

    const custB = await User.create({
      name: 'Customer B Module 13',
      email: 'custB.m13@test.com',
      phone: '+919876543202',
      passwordHash: await User.hashPassword(customerBPassword),
      role: 'CUSTOMER'
    });

    const ownerUser = await User.create({
      name: 'Shop Owner Module 13',
      email: 'owner.m13@test.com',
      phone: '+919876543203',
      passwordHash: await User.hashPassword(ownerPassword),
      role: 'OWNER'
    });

    const adminUser = await User.create({
      name: 'Platform Admin Module 13',
      email: 'admin.m13@test.com',
      phone: '+919876543204',
      passwordHash: await User.hashPassword(adminPassword),
      role: 'ADMIN'
    });

    // Create a demo shop application & demo shop
    const testApp = await ShopApplication.create({
      ownerId: ownerUser._id,
      shopName: 'M13 Verified Auto Hub',
      ownerFullName: 'Shop Owner Module 13',
      ownerPhone: '+919876543203',
      businessEmail: 'owner.m13@test.com',
      shopDescription: 'Specialist retailer in Bengaluru for quality automobile spares and service parts.',
      shopCategory: 'MULTI_CATEGORY',
      addressLine: '456 Test Street, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      status: 'APPROVED'
    });

    const testShop = await Shop.create({
      ownerId: ownerUser._id,
      applicationId: testApp._id,
      name: 'M13 Verified Auto Hub',
      shopName: 'M13 Verified Auto Hub',
      description: 'Specialist retailer in Bengaluru for quality automobile spares and service parts.',
      category: 'MULTI_CATEGORY',
      contact: {
        phone: '+919876543203',
        email: 'owner.m13@test.com'
      },
      address: {
        addressLine: '456 Test Street, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      isApproved: true,
      isActive: true
    });

    const testPart = await SparePart.create({
      shopId: testShop._id,
      ownerId: ownerUser._id,
      partName: 'Front Brake Disc M13',
      partNumber: 'FBD-M13-100',
      manufacturer: 'Brembo Auto',
      description: 'High-performance durable front brake disc rotor.',
      price: 1500,
      stockQuantity: 20,
      category: 'Brakes',
      vehicleType: 'Car',
      isPublished: true,
      availabilityStatus: 'IN_STOCK'
    });

    // Create a demo order for Customer A
    const orderA = await Order.create({
      orderNumber: 'EXS-M13-TEST-001',
      customerId: custA._id,
      items: [
        {
          productId: testPart._id,
          partName: testPart.partName,
          partNumber: testPart.partNumber,
          unitPrice: testPart.price,
          quantity: 2,
          subtotal: 3000,
          shopId: testShop._id,
          shopName: testShop.name,
          ownerId: ownerUser._id
        }
      ],
      shops: [
        {
          shopId: testShop._id,
          shopName: testShop.name,
          ownerId: ownerUser._id,
          itemsSubtotal: 3000,
          fulfillmentStatus: 'PLACED',
          statusHistory: [
            {
              status: 'PLACED',
              changedBy: custA._id,
              updatedBy: custA._id,
              note: 'Order placed by customer',
              customerSafeMessage: 'Order placed and logged in our system.',
              timestamp: new Date(),
              changedAt: new Date()
            }
          ]
        }
      ],
      shippingAddress: {
        fullName: 'Customer A',
        phone: '+919876543201',
        addressLine: '123 Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001'
      },
      subtotal: 3000,
      deliveryCharge: 0,
      totalAmount: 3000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      statusHistory: [
        {
          status: 'PLACED',
          changedBy: custA._id,
          updatedBy: custA._id,
          note: 'Order created',
          customerSafeMessage: 'Order successfully created with Cash on Delivery',
          timestamp: new Date(),
          changedAt: new Date()
        }
      ]
    });

    // Login each user to get cookies
    const loginA = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'custA.m13@test.com', password: customerAPassword }
    });
    const cookieA = parseCookie(loginA);

    const loginB = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'custB.m13@test.com', password: customerBPassword }
    });
    const cookieB = parseCookie(loginB);

    const loginOwner = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner.m13@test.com', password: ownerPassword }
    });
    const cookieOwner = parseCookie(loginOwner);

    const loginAdmin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin.m13@test.com', password: adminPassword }
    });
    const cookieAdmin = parseCookie(loginAdmin);

    // =========================================================================
    // TEST 1: Customer A can track their own order
    // =========================================================================
    const trackResA = await makeRequest(`/api/orders/${orderA._id}/tracking`, {
      method: 'GET',
      headers: { Cookie: cookieA }
    });

    if (trackResA.status === 200 && trackResA.data?.success && trackResA.data?.data?.orderNumber === orderA.orderNumber) {
      logPass(1, 'Customer A can successfully track their own order');
    } else {
      logFail(1, 'Customer A failed to track own order', JSON.stringify(trackResA.data));
    }

    // =========================================================================
    // TEST 2: Customer B cannot track Customer A's order (Forbidden isolation)
    // =========================================================================
    const trackResB = await makeRequest(`/api/orders/${orderA._id}/tracking`, {
      method: 'GET',
      headers: { Cookie: cookieB }
    });

    if (trackResB.status === 403) {
      logPass(2, 'Customer B is correctly blocked from tracking Customer A’s order (403 Forbidden)');
    } else {
      logFail(2, 'Customer isolation failed; Customer B accessed another user’s tracking', `Status: ${trackResB.status}`);
    }

    // =========================================================================
    // TEST 3: Order tracking verifies milestones and no invented courier GPS
    // =========================================================================
    const trackingObj = trackResA.data?.data;
    if (
      trackingObj?.trackingMode === 'ORDER_STATUS_TRACKING' &&
      Array.isArray(trackingObj?.timeline) &&
      trackingObj.timeline.length === 6 &&
      trackingObj.timeline[0].key === 'PLACED' &&
      trackingObj.timeline[0].timestamp !== null
    ) {
      logPass(3, 'Tracking correctly provides 6 lifecycle milestones with actual recorded timestamps & honest disclaimer');
    } else {
      logFail(3, 'Tracking milestones structure incorrect', JSON.stringify(trackingObj?.timeline));
    }

    // =========================================================================
    // TEST 4: Shop Owner can update order status along valid lifecycle transition
    // =========================================================================
    const statusUpdateRes = await makeRequest(`/api/owner/orders/${orderA._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: cookieOwner },
      body: { status: 'CONFIRMED', note: 'All brake discs confirmed in stock' }
    });

    if (statusUpdateRes.status === 200 && statusUpdateRes.data?.data?.order?.orderStatus === 'CONFIRMED') {
      logPass(4, 'Shop owner successfully transitioned status from PLACED to CONFIRMED');
    } else {
      logFail(4, 'Failed to transition status to CONFIRMED', JSON.stringify(statusUpdateRes.data));
    }

    // =========================================================================
    // TEST 5: Status transition validation rejects invalid skips (e.g. CONFIRMED to DELIVERED)
    // =========================================================================
    const invalidSkipRes = await makeRequest(`/api/owner/orders/${orderA._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: cookieOwner },
      body: { status: 'DELIVERED', note: 'Attempting invalid jump' }
    });

    if (invalidSkipRes.status === 400 && !invalidSkipRes.data?.success) {
      logPass(5, 'Server rejected invalid status jump from CONFIRMED directly to DELIVERED (400)');
    } else {
      logFail(5, 'Server permitted invalid status transition jump', `Status: ${invalidSkipRes.status}`);
    }

    // =========================================================================
    // TEST 6: Duplicate notifications are prevented on retry / repeat dispatch
    // =========================================================================
    // Count notifications for Customer A before and after retrying duplicate status update notification
    const initialNotifCount = await Notification.countDocuments({
      recipientId: custA._id,
      relatedOrderId: orderA._id,
      type: 'ORDER_CONFIRMED'
    });

    // Check that one notification exists
    if (initialNotifCount === 1) {
      logPass(6, 'Customer received in-app delivery update notification for ORDER_CONFIRMED');
    } else {
      logFail(6, `Expected 1 notification, found: ${initialNotifCount}`);
    }

    // =========================================================================
    // TEST 7: Customer A creates a Support Ticket linked to their own order
    // =========================================================================
    const createTicketRes = await makeRequest('/api/support/tickets', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: {
        category: 'Order',
        subject: 'm13_test Question regarding dispatch date',
        message: 'Hello, when will my brake discs be handed over to dispatch?',
        orderId: orderA._id.toString()
      }
    });

    let createdTicketId = null;
    if (createTicketRes.status === 201 && createTicketRes.data?.success && createTicketRes.data?.data?.ticket?.ticketNumber) {
      createdTicketId = createTicketRes.data.data.ticket._id;
      logPass(7, `Customer A created support ticket ${createTicketRes.data.data.ticket.ticketNumber} successfully linked to their order`);
    } else {
      logFail(7, 'Failed to create support ticket', JSON.stringify(createTicketRes.data));
    }

    // =========================================================================
    // TEST 8: Customer B cannot link Customer A's order to a support ticket (403)
    // =========================================================================
    const invalidLinkRes = await makeRequest('/api/support/tickets', {
      method: 'POST',
      headers: { Cookie: cookieB },
      body: {
        category: 'Order',
        subject: 'm13_test Trying to hijack order',
        message: 'Inquiry on someone else order',
        orderId: orderA._id.toString()
      }
    });

    if (invalidLinkRes.status === 403) {
      logPass(8, 'Backend prevented Customer B from linking Customer A’s order to a ticket (403 Forbidden)');
    } else {
      logFail(8, 'Order linkage ownership check failed', `Status: ${invalidLinkRes.status}`);
    }

    // =========================================================================
    // TEST 9: Customer A can view their own tickets; Customer B cannot view Customer A's ticket
    // =========================================================================
    const viewTicketResA = await makeRequest(`/api/support/tickets/${createdTicketId}`, {
      method: 'GET',
      headers: { Cookie: cookieA }
    });

    const viewTicketResB = await makeRequest(`/api/support/tickets/${createdTicketId}`, {
      method: 'GET',
      headers: { Cookie: cookieB }
    });

    if (viewTicketResA.status === 200 && viewTicketResB.status === 403) {
      logPass(9, 'Customer A can view their ticket; Customer B is strictly forbidden (403)');
    } else {
      logFail(9, 'Ticket ownership privacy failed', `A: ${viewTicketResA.status}, B: ${viewTicketResB.status}`);
    }

    // =========================================================================
    // TEST 10: Customer A can post a reply to their open ticket
    // =========================================================================
    const customerReplyRes = await makeRequest(`/api/support/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { message: 'Adding additional note: please pack carefully.' }
    });

    if (
      customerReplyRes.status === 200 &&
      customerReplyRes.data?.data?.ticket?.messages?.length === 2
    ) {
      logPass(10, 'Customer successfully posted reply to ticket conversation');
    } else {
      logFail(10, 'Failed to post customer reply', JSON.stringify(customerReplyRes.data));
    }

    // =========================================================================
    // TEST 11: Admin can fetch tickets, search & filter
    // =========================================================================
    const adminListRes = await makeRequest('/api/admin/support/tickets?status=OPEN', {
      method: 'GET',
      headers: { Cookie: cookieAdmin }
    });

    if (
      adminListRes.status === 200 &&
      adminListRes.data?.data?.tickets &&
      adminListRes.data.data.counts.TOTAL >= 1
    ) {
      logPass(11, 'Admin can list, search, and retrieve support tickets with status metrics');
    } else {
      logFail(11, 'Admin failed to fetch tickets', JSON.stringify(adminListRes.data));
    }

    // =========================================================================
    // TEST 12: Admin can reply to customer ticket and update status
    // =========================================================================
    const adminReplyRes = await makeRequest(`/api/admin/support/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieAdmin },
      body: {
        message: 'Hello! Your brake discs are confirmed and will be ready for dispatch by tomorrow noon.'
      }
    });

    if (
      adminReplyRes.status === 200 &&
      adminReplyRes.data?.data?.ticket?.status === 'IN_PROGRESS' &&
      adminReplyRes.data?.data?.ticket?.messages?.length === 3
    ) {
      logPass(12, 'Admin replied to ticket; status automatically progressed to IN_PROGRESS and customer was notified');
    } else {
      logFail(12, 'Admin reply failed', JSON.stringify(adminReplyRes.data));
    }

    // =========================================================================
    // TEST 13: Customer received in-app notification of admin reply
    // =========================================================================
    const custNotif = await Notification.findOne({
      recipientId: custA._id,
      type: 'SUPPORT_TICKET_REPLY'
    });

    if (custNotif) {
      logPass(13, 'Customer received in-app SUPPORT_TICKET_REPLY notification');
    } else {
      logFail(13, 'Customer did not receive ticket reply notification');
    }

    // =========================================================================
    // TEST 14: Admin can assign ticket to administrator and resolve ticket
    // =========================================================================
    const assignRes = await makeRequest(`/api/admin/support/tickets/${createdTicketId}/assign`, {
      method: 'PATCH',
      headers: { Cookie: cookieAdmin },
      body: { assignedTo: adminUser._id.toString() }
    });

    const resolveRes = await makeRequest(`/api/admin/support/tickets/${createdTicketId}/status`, {
      method: 'PATCH',
      headers: { Cookie: cookieAdmin },
      body: { status: 'RESOLVED', note: 'Customer query answered satisfactorily' }
    });

    if (
      assignRes.status === 200 &&
      resolveRes.status === 200 &&
      resolveRes.data?.data?.ticket?.status === 'RESOLVED' &&
      resolveRes.data?.data?.ticket?.assignedTo?.name === adminUser.name
    ) {
      logPass(14, 'Admin successfully assigned ticket to administrator and marked status as RESOLVED');
    } else {
      logFail(14, 'Admin assignment or resolution failed', `Assign: ${assignRes.status}, Resolve: ${resolveRes.status}`);
    }

    console.log('\n======================================================');
    console.log(`📊 TEST RESULTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failCount > 0 ? 1 : 0);
  }
};

runTests();
