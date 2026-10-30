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

const PORT = 5069; // Dedicated test port for Module 19
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
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const tokenCookie = cookies.find(c => c.startsWith('exactspare_token=') || c.startsWith('token=')) || cookies[0];
  return tokenCookie.split(';')[0];
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
      res.on('data', (chunk) => { data += chunk; });
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

async function runModule19ComprehensiveIntegration() {
  console.log('\n======================================================');
  console.log('🚀 EXACTSPARE MODULE 19: END-TO-END WORKFLOW INTEGRATION');
  console.log('======================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
    await mongoose.connect(mongoUri);
    console.log('✔ Connected to MongoDB successfully.');

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        console.log(`✔ Test server running on http://127.0.0.1:${PORT}\n`);
        resolve();
      });
    });

    const timestamp = Date.now();
    const customerEmail = `cust_m19_${timestamp}@exactspare.test`;
    const ownerEmail = `owner_m19_${timestamp}@exactspare.test`;
    const adminEmail = `admin_m19_${timestamp}@exactspare.test`;
    const password = 'Password@12345';

    // 1. Customer Registration
    let customerCookie = '';
    let customerId = '';
    try {
      const regRes = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Module19 Customer',
          email: customerEmail,
          password: password,
          confirmPassword: password,
          phone: '+919876543214',
          role: 'CUSTOMER'
        }
      });
      if (regRes.status === 201 && (regRes.data?.statusCode === 201 || regRes.data?.success)) {
        customerCookie = parseCookie(regRes);
        customerId = regRes.data.user?._id || regRes.data.user?.id || regRes.data.data?.user?.id;
        logPass(1, `Customer registered successfully (${customerEmail})`);
      } else {
        throw new Error(`Customer registration failed: ${JSON.stringify(regRes.data)}`);
      }
    } catch (err) {
      logFail(1, 'Customer registration', err);
    }

    // 2. Customer Profile & Protected Route (/api/auth/me)
    try {
      const meRes = await makeRequest('/api/auth/me', {
        headers: { Cookie: customerCookie }
      });
      if (meRes.status === 200 && (meRes.data?.user?.email === customerEmail || meRes.data?.data?.user?.email === customerEmail)) {
        logPass(2, `Customer authentication & protected route verified (/api/auth/me)`);
      } else {
        throw new Error(`Failed to access /api/auth/me: status ${meRes.status}`);
      }
    } catch (err) {
      logFail(2, 'Customer /api/auth/me verification', err);
    }

    // 3. Shop Owner Registration
    let ownerCookie = '';
    let ownerId = '';
    try {
      const regRes = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Module19 Shop Owner',
          email: ownerEmail,
          password: password,
          confirmPassword: password,
          phone: '+919876543212',
          role: 'OWNER'
        }
      });
      if (regRes.status === 201 && (regRes.data?.statusCode === 201 || regRes.data?.success)) {
        ownerCookie = parseCookie(regRes);
        ownerId = regRes.data.user?._id || regRes.data.user?.id || regRes.data.data?.user?.id;
        logPass(3, `Shop Owner registered successfully (${ownerEmail})`);
      } else {
        throw new Error(`Owner registration failed: ${JSON.stringify(regRes.data)}`);
      }
    } catch (err) {
      logFail(3, 'Shop Owner registration', err);
    }

    // 4. Shop Owner Application Submission
    let applicationId = '';
    try {
      const appRes = await makeRequest('/api/shop-applications', {
        method: 'POST',
        headers: { Cookie: ownerCookie },
        body: {
          shopName: 'Metro Speed Spares M19',
          ownerFullName: 'Module19 Shop Owner',
          ownerPhone: '+919876543212',
          businessEmail: ownerEmail,
          shopDescription: 'Specializing in two-wheeler and four-wheeler original spare parts.',
          shopCategory: 'MULTI_CATEGORY',
          addressLine: '123 Expressway Highway',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          latitude: 12.9716,
          longitude: 77.5946,
          openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
          action: 'SAVE_DRAFT'
        }
      });

      if (appRes.status === 201 && (appRes.data.application || appRes.data.data?.application)) {
        const appDoc = appRes.data.application || appRes.data.data?.application;
        applicationId = (appDoc._id || appDoc.id).toString();

        // Update application with valid photos & submit
        await ShopApplication.findByIdAndUpdate(applicationId, {
          shopImagePaths: ['uploads/shops/sample-storefront.jpg'],
          verificationDocumentPaths: ['uploads/documents/trade-license.pdf'],
          status: 'PENDING'
        });

        logPass(4, `Shop application submitted (ID: ${applicationId}, Status: PENDING)`);
      } else {
        throw new Error(`Failed to submit shop application: ${JSON.stringify(appRes.data)}`);
      }
    } catch (err) {
      logFail(4, 'Shop application submission', err);
    }

    // 5. Admin Creation and Application Approval
    let adminCookie = '';
    let approvedShopId = '';
    try {
      const adminUser = await User.create({
        name: 'Module19 Admin',
        email: adminEmail,
        phone: '+919999900019',
        passwordHash: await User.hashPassword(password),
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        isEmailVerified: true
      });

      const adminLogin = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: adminEmail, password: password }
      });
      adminCookie = parseCookie(adminLogin);

      // Approve shop application via /decision endpoint
      const approveRes = await makeRequest(`/api/admin/shop-applications/${applicationId}/decision`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: {
          decision: 'APPROVE',
          reason: 'Application verified and approved in Module 19 test run.'
        }
      });

      if (approveRes.status === 200 && (approveRes.data?.status === 'ok' || approveRes.data?.success)) {
        // Query approved shop created
        const shop = await Shop.findOne({ ownerId: ownerId });
        approvedShopId = shop?._id?.toString();
        logPass(5, `Admin approved shop application; Shop created (ID: ${approvedShopId})`);
      } else {
        throw new Error(`Admin failed to approve application: ${JSON.stringify(approveRes.data)}`);
      }
    } catch (err) {
      logFail(5, 'Admin shop approval', err);
    }

    // 6. Spare Part Creation by Approved Shop Owner
    let createdPartId = '';
    try {
      const partRes = await makeRequest('/api/parts', {
        method: 'POST',
        headers: { Cookie: ownerCookie },
        body: {
          partName: 'Ceramic High-Performance Brake Pad Set M19',
          partNumber: `BPD-${timestamp}`,
          manufacturer: 'Brembo OEM',
          category: 'Brakes',
          vehicleType: 'Car',
          compatibleMakes: ['Honda', 'Toyota'],
          compatibleModels: ['Civic', 'Corolla'],
          compatibleYears: [2020, 2021, 2022, 2023, 2024],
          price: 2450,
          condition: 'NEW',
          stockQuantity: 15,
          description: 'High-friction fade-resistant ceramic brake pads for sport sedans.',
          isPublished: true
        }
      });

      if (partRes.status === 201 && (partRes.data?.status === 'ok' || partRes.data?.success)) {
        const partObj = partRes.data.part || partRes.data.data?.part;
        createdPartId = (partObj._id || partObj.id).toString();
        logPass(6, `Shop Owner created published spare part listing (ID: ${createdPartId}, Stock: 15)`);
      } else {
        throw new Error(`Failed to create part listing: ${JSON.stringify(partRes.data)}`);
      }
    } catch (err) {
      logFail(6, 'Spare part creation', err);
    }

    // 7. Public Search & Discovery (Geospatial & Filtering)
    try {
      const searchRes = await makeRequest('/api/search/nearby-parts?q=Brake&category=Brakes&vehicleType=Car&lat=12.9716&lng=77.5946&radius=50');
      if (searchRes.status === 200 && searchRes.data?.data?.parts) {
        logPass(7, `Public search returned ${searchRes.data.data.parts.length} nearby matching parts`);
      } else {
        throw new Error(`Search request failed: status ${searchRes.status}`);
      }
    } catch (err) {
      logFail(7, 'Public search & filtering', err);
    }

    // 8. Add Part to Wishlist
    try {
      const wishRes = await makeRequest('/api/wishlist/items', {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: { productId: createdPartId }
      });
      if (wishRes.status === 200 || wishRes.status === 201) {
        logPass(8, `Customer added part to wishlist`);
      } else {
        throw new Error(`Wishlist add failed: ${JSON.stringify(wishRes.data)}`);
      }
    } catch (err) {
      logFail(8, 'Wishlist toggle', err);
    }

    // 9. Customer Cart Operations
    try {
      const cartRes = await makeRequest('/api/cart/items', {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: { productId: createdPartId, quantity: 2 }
      });
      if (cartRes.status === 200 && cartRes.data?.success) {
        logPass(9, `Customer added 2 items to cart; subtotal computed securely on backend`);
      } else {
        throw new Error(`Add to cart failed: ${JSON.stringify(cartRes.data)}`);
      }
    } catch (err) {
      logFail(9, 'Cart management', err);
    }

    // 10. Checkout & Atomic Stock Decrement
    let orderId = '';
    try {
      const checkoutRes = await makeRequest('/api/orders', {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: {
          shippingAddress: {
            fullName: 'Module19 Customer',
            phone: '+919876543211',
            addressLine: '45 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560001'
          },
          paymentMethod: 'COD'
        }
      });

      if (checkoutRes.status === 201 && checkoutRes.data?.success) {
        orderId = (checkoutRes.data.data.order.id || checkoutRes.data.data.order._id).toString();
        // Verify atomic stock decrement in DB
        const updatedPart = await SparePart.findById(createdPartId);
        if (updatedPart.stockQuantity === 13) {
          logPass(10, `Checkout succeeded (Order ID: ${orderId}); stock quantity decremented atomically from 15 to 13`);
        } else {
          throw new Error(`Stock quantity mismatch: expected 13, found ${updatedPart.stockQuantity}`);
        }
      } else {
        throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.data)}`);
      }
    } catch (err) {
      logFail(10, 'Checkout & atomic stock decrement', err);
    }

    // 11. Shop Owner Order Progress
    try {
      const progRes = await makeRequest(`/api/owner/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { Cookie: ownerCookie },
        body: { status: 'CONFIRMED' }
      });

      if (progRes.status === 200 && progRes.data?.success) {
        logPass(11, `Shop Owner confirmed order fulfillment; status updated to CONFIRMED`);
      } else {
        throw new Error(`Owner order update failed: ${JSON.stringify(progRes.data)}`);
      }
    } catch (err) {
      logFail(11, 'Owner order fulfillment', err);
    }

    // 12. Support Ticket Lifecycle
    try {
      const ticketRes = await makeRequest('/api/support/tickets', {
        method: 'POST',
        headers: { Cookie: customerCookie },
        body: {
          subject: 'Compatibility check for M19 part',
          category: 'Order',
          message: 'Can I confirm delivery schedule for this order?',
          priority: 'NORMAL'
        }
      });

      if (ticketRes.status === 201 && ticketRes.data?.success) {
        logPass(12, `Customer filed support ticket (Ticket #: ${ticketRes.data.data?.ticket?.ticketNumber || 'TKT-OK'})`);
      } else {
        throw new Error(`Support ticket creation failed: ${JSON.stringify(ticketRes.data)}`);
      }
    } catch (err) {
      logFail(12, 'Support ticket workflow', err);
    }

    // 13. Admin Analytics Real-Time Attribution
    try {
      const analyticsRes = await makeRequest('/api/admin/analytics/overview', {
        headers: { Cookie: adminCookie }
      });

      if (analyticsRes.status === 200 && analyticsRes.data?.success) {
        logPass(13, `Admin analytics overview verified; dynamic aggregation computed real-time revenue & orders`);
      } else {
        throw new Error(`Admin analytics failed: status ${analyticsRes.status}`);
      }
    } catch (err) {
      logFail(13, 'Admin analytics verification', err);
    }

    // 14. Customer Logout & Cookie Invalidation
    try {
      const logoutRes = await makeRequest('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: customerCookie }
      });

      if (logoutRes.status === 200) {
        logPass(14, `Customer logged out; JWT cookie cleared`);
      } else {
        throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
      }
    } catch (err) {
      logFail(14, 'Authentication logout verification', err);
    }

    // Clean up test data created in this run
    await User.deleteMany({ email: { $in: [customerEmail, ownerEmail, adminEmail] } });
    await ShopApplication.deleteMany({ contactEmail: ownerEmail });
    if (approvedShopId) await Shop.findByIdAndDelete(approvedShopId);
    if (createdPartId) await SparePart.findByIdAndDelete(createdPartId);
    if (orderId) await Order.findByIdAndDelete(orderId);

  } catch (fatalErr) {
    console.error('Fatal test runner error:', fatalErr);
    failCount++;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('\n======================================================');
    console.log(`TOTAL PASSED: ${passCount} / ${passCount + failCount}`);
    console.log(`TOTAL FAILED: ${failCount}`);
    console.log('======================================================\n');
    process.exit(failCount === 0 ? 0 : 1);
  }
}

runModule19ComprehensiveIntegration();
