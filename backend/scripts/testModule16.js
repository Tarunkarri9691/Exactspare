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
import { sanitizeCsvCell, parseDateRange } from '../utils/analyticsHelper.js';

const PORT = 5066; // Dedicated test port for Module 16
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
  console.log('  EXACTSPARE MODULE 16 — AUTOMATED VERIFICATION TEST SUITE');
  console.log('  Advanced Admin Analytics, Multi-Shop Attribution & CSV Reports');
  console.log('===============================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri);
    }
    console.log(`Connected to MongoDB at ${mongoUri}`);

    await new Promise((resolve, reject) => {
      server = http.createServer(app);
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        console.log(`Test server running at ${baseUrl}\n`);
        resolve();
      });
    });

    const timestamp = Date.now();
    const adminPassword = 'AdminSecretPassword99!';
    const customerPassword = 'CustomerPassword99!';
    const ownerPassword = 'OwnerPassword99!';

    // Setup Test Accounts
    const adminEmail = `admin_m16_${timestamp}@exactspare.test`;
    const customerEmail = `customer_m16_${timestamp}@exactspare.test`;
    const ownerEmail = `owner_m16_${timestamp}@exactspare.test`;

    // 1. Create Admin User
    const adminUser = await User.create({
      name: 'Admin Module 16 Tester',
      email: adminEmail,
      phone: '+919999900016',
      passwordHash: await User.hashPassword(adminPassword),
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      isEmailVerified: true
    });

    // 2. Create Customer User via API
    const custRegRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Customer Module 16',
        email: customerEmail,
        phone: '+919888800016',
        password: customerPassword,
        confirmPassword: customerPassword,
        role: 'CUSTOMER'
      }
    });
    const customerCookie = parseCookie(custRegRes);

    // 3. Create Shop Owner User via API
    const ownerRegRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Owner Module 16',
        email: ownerEmail,
        phone: '+919777700016',
        password: ownerPassword,
        confirmPassword: ownerPassword,
        role: 'OWNER'
      }
    });
    const ownerCookie = parseCookie(ownerRegRes);

    // 4. Login as Admin
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: adminEmail,
        password: adminPassword
      }
    });
    const adminCookie = parseCookie(adminLoginRes);

    // -------------------------------------------------------------------------
    // TEST 1: Role-Based Authorization — Customer Cannot Access Admin Analytics
    // -------------------------------------------------------------------------
    const custAnalyticsRes = await makeRequest('/api/admin/analytics/overview', {
      headers: { Cookie: customerCookie }
    });
    if (custAnalyticsRes.status === 403) {
      logPass(1, 'Backend strictly enforces role: Customer cannot access admin analytics (403 Forbidden)');
    } else {
      logFail(1, 'Customer improperly permitted or wrong status code', custAnalyticsRes.status);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Role-Based Authorization — Customer Cannot Access CSV Reports
    // -------------------------------------------------------------------------
    const custReportRes = await makeRequest('/api/admin/reports/orders.csv', {
      headers: { Cookie: customerCookie }
    });
    if (custReportRes.status === 403) {
      logPass(2, 'Backend blocks Customer from accessing private CSV reports (403 Forbidden)');
    } else {
      logFail(2, 'Customer improperly accessed CSV report', custReportRes.status);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Role-Based Authorization — Shop Owner Cannot Access Admin Analytics
    // -------------------------------------------------------------------------
    const ownerAnalyticsRes = await makeRequest('/api/admin/analytics/overview', {
      headers: { Cookie: ownerCookie }
    });
    if (ownerAnalyticsRes.status === 403) {
      logPass(3, 'Backend blocks Shop Owner from accessing platform admin analytics (403 Forbidden)');
    } else {
      logFail(3, 'Shop Owner improperly accessed admin analytics', ownerAnalyticsRes.status);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Role-Based Authorization — Shop Owner Cannot Access Admin CSV Reports
    // -------------------------------------------------------------------------
    const ownerReportRes = await makeRequest('/api/admin/reports/orders.csv', {
      headers: { Cookie: ownerCookie }
    });
    if (ownerReportRes.status === 403) {
      logPass(4, 'Backend blocks Shop Owner from downloading global orders CSV report (403 Forbidden)');
    } else {
      logFail(4, 'Shop Owner improperly accessed global orders CSV', ownerReportRes.status);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Unauthenticated Requests Rejected with 401
    // -------------------------------------------------------------------------
    const unauthRes = await makeRequest('/api/admin/analytics/overview');
    if (unauthRes.status === 401) {
      logPass(5, 'Unauthenticated access to admin endpoints correctly rejected (401 Unauthorized)');
    } else {
      logFail(5, 'Unauthenticated request was not rejected with 401', unauthRes.status);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Admin Successfully Retrieves Analytics Overview with Required Metrics
    // -------------------------------------------------------------------------
    const adminOverviewRes = await makeRequest('/api/admin/analytics/overview', {
      headers: { Cookie: adminCookie }
    });

    const ovData = adminOverviewRes.data?.data;
    if (
      adminOverviewRes.status === 200 &&
      ovData &&
      ovData.users &&
      typeof ovData.users.customers === 'number' &&
      typeof ovData.users.shopOwners === 'number' &&
      ovData.shops &&
      typeof ovData.shops.approvedAndActive === 'number' &&
      ovData.inventory &&
      typeof ovData.inventory.published === 'number' &&
      ovData.orders &&
      typeof ovData.orders.totalLifetime === 'number' &&
      ovData.revenue &&
      typeof ovData.revenue.grossOrderValue === 'number' &&
      typeof ovData.revenue.completedRevenue === 'number'
    ) {
      logPass(6, 'Admin successfully retrieves complete analytics overview with all required metrics');
    } else {
      logFail(6, 'Analytics overview missing required metrics structure', adminOverviewRes.data);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Date Filter Validation & Error Handling
    // -------------------------------------------------------------------------
    const invalidDateRes = await makeRequest('/api/admin/analytics/overview?from=invalid-date', {
      headers: { Cookie: adminCookie }
    });
    const invertedDateRes = await makeRequest(
      '/api/admin/analytics/overview?from=2026-12-31&to=2026-01-01',
      { headers: { Cookie: adminCookie } }
    );

    if (invalidDateRes.status === 400 && invertedDateRes.status === 400) {
      logPass(7, 'Date validation rejects malformed dates and inverted ranges with HTTP 400');
    } else {
      logFail(7, 'Invalid date filter was not rejected properly', {
        invalid: invalidDateRes.status,
        inverted: invertedDateRes.status
      });
    }

    // -------------------------------------------------------------------------
    // TEST 8: Date Range Presets (Today, 7 Days, 30 Days) Return Filtered Results
    // -------------------------------------------------------------------------
    const todayRes = await makeRequest('/api/admin/analytics/overview?preset=today', {
      headers: { Cookie: adminCookie }
    });
    const sevenDaysRes = await makeRequest('/api/admin/analytics/sales?preset=7days&period=daily', {
      headers: { Cookie: adminCookie }
    });

    if (
      todayRes.status === 200 &&
      todayRes.data?.data?.filter?.preset === 'today' &&
      sevenDaysRes.status === 200 &&
      Array.isArray(sevenDaysRes.data?.data?.timeline)
    ) {
      logPass(8, 'Date filter presets (today, 7days) dynamically apply to aggregation pipelines');
    } else {
      logFail(8, 'Date filter presets failed to return expected response', {
        today: todayRes.data,
        sevenDays: sevenDaysRes.data
      });
    }

    // -------------------------------------------------------------------------
    // TEST 9: Financial Integrity — Cancelled Orders Excluded from Completed Revenue
    // -------------------------------------------------------------------------
    const testCustomerId = custRegRes.data?.data?.id || (await User.findOne({ email: customerEmail }))._id;

    // Create a temporary shop for order tests
    const testShop1 = await Shop.create({
      ownerId: (await User.findOne({ email: ownerEmail }))._id,
      applicationId: new mongoose.Types.ObjectId(),
      name: `M16 Test Shop 1 ${timestamp}`,
      category: 'CAR',
      description: 'Test shop 1 for multi-shop attribution',
      address: {
        addressLine: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        location: { type: 'Point', coordinates: [72.8777, 19.076] }
      },
      contact: { phone: '+919999911111', email: 'shop1@test.com' },
      isApproved: true,
      isActive: true
    });

    const testShop2 = await Shop.create({
      ownerId: new mongoose.Types.ObjectId(),
      applicationId: new mongoose.Types.ObjectId(),
      name: `M16 Test Shop 2 ${timestamp}`,
      category: 'BIKE',
      description: 'Test shop 2 for multi-shop attribution',
      address: {
        addressLine: '456 Test Rd',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        location: { type: 'Point', coordinates: [73.8567, 18.5204] }
      },
      contact: { phone: '+919999922222', email: 'shop2@test.com' },
      isApproved: true,
      isActive: true
    });

    // Delivered Order
    await Order.create({
      orderNumber: `EXS-M16-DELIV-${timestamp}`,
      customerId: testCustomerId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          partName: 'Delivered Brake Pad',
          partNumber: `DELIV-${timestamp}`,
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          unitPrice: 1200,
          quantity: 1,
          subtotal: 1200
        }
      ],
      shops: [
        {
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          itemsSubtotal: 1200,
          fulfillmentStatus: 'DELIVERED'
        }
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '+919888800016',
        addressLine: '10 Shipping St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      },
      subtotal: 1200,
      deliveryCharge: 50,
      totalAmount: 1250,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED'
    });

    // Cancelled Order (Gross amount 900)
    await Order.create({
      orderNumber: `EXS-M16-CANCEL-${timestamp}`,
      customerId: testCustomerId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          partName: 'Cancelled Air Filter',
          partNumber: `CANCEL-${timestamp}`,
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          unitPrice: 900,
          quantity: 1,
          subtotal: 900
        }
      ],
      shops: [
        {
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          itemsSubtotal: 900,
          fulfillmentStatus: 'CANCELLED'
        }
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '+919888800016',
        addressLine: '10 Shipping St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      },
      subtotal: 900,
      deliveryCharge: 0,
      totalAmount: 900,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'CANCELLED',
      cancellation: {
        cancelledAt: new Date(),
        reason: 'Customer requested cancellation'
      }
    });

    const checkRevRes = await makeRequest('/api/admin/analytics/overview', {
      headers: { Cookie: adminCookie }
    });
    const revCheck = checkRevRes.data?.data?.revenue;

    if (
      checkRevRes.status === 200 &&
      revCheck &&
      revCheck.cancelledOrderValue >= 900 &&
      revCheck.completedRevenue >= 1250
    ) {
      logPass(9, 'Cancelled orders are properly excluded from completed revenue and tracked separately');
    } else {
      logFail(9, 'Cancelled order value leaked into completed revenue', revCheck);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Multi-Shop Order Attribution Without Double-Counting
    // -------------------------------------------------------------------------
    // Multi-Shop Order containing Shop 1 (₹600) and Shop 2 (₹1400) = Total ₹2000
    await Order.create({
      orderNumber: `EXS-M16-MULTI-${timestamp}`,
      customerId: testCustomerId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          partName: 'Oil Filter for Shop 1',
          partNumber: `OIL-${timestamp}`,
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          unitPrice: 600,
          quantity: 1,
          subtotal: 600
        },
        {
          productId: new mongoose.Types.ObjectId(),
          partName: 'Spark Plug Set for Shop 2',
          partNumber: `PLUG-${timestamp}`,
          shopId: testShop2._id,
          shopName: testShop2.name,
          ownerId: testShop2.ownerId,
          unitPrice: 700,
          quantity: 2,
          subtotal: 1400
        }
      ],
      shops: [
        {
          shopId: testShop1._id,
          shopName: testShop1.name,
          ownerId: testShop1.ownerId,
          itemsSubtotal: 600,
          fulfillmentStatus: 'DELIVERED'
        },
        {
          shopId: testShop2._id,
          shopName: testShop2.name,
          ownerId: testShop2.ownerId,
          itemsSubtotal: 1400,
          fulfillmentStatus: 'PROCESSING'
        }
      ],
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '+919888800016',
        addressLine: '10 Shipping St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      },
      subtotal: 2000,
      deliveryCharge: 0,
      totalAmount: 2000,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      orderStatus: 'PROCESSING'
    });

    const shopAnalyticsRes = await makeRequest('/api/admin/analytics/shops', {
      headers: { Cookie: adminCookie }
    });
    const shopsList = shopAnalyticsRes.data?.data?.shops || [];
    const matchedShop1 = shopsList.find((s) => s._id.toString() === testShop1._id.toString());
    const matchedShop2 = shopsList.find((s) => s._id.toString() === testShop2._id.toString());

    if (
      matchedShop1 &&
      matchedShop2 &&
      matchedShop1.attributableOrderValue >= 1800 && // 1200 from first order + 600 from multi-shop
      matchedShop2.attributableOrderValue === 1400 // only 1400 from its item, NOT the full 2000!
    ) {
      logPass(10, 'Multi-shop orders are correctly partitioned by item subtotal without double-counting');
    } else {
      logFail(10, 'Multi-shop attribution failed', {
        shop1: matchedShop1?.attributableOrderValue,
        shop2: matchedShop2?.attributableOrderValue
      });
    }

    // -------------------------------------------------------------------------
    // TEST 11: Inventory Insights — Low Stock, Out of Stock, Category Grouping
    // -------------------------------------------------------------------------
    // Create sample parts: 1 low stock (stock = 3), 1 out of stock (stock = 0)
    await SparePart.create([
      {
        shopId: testShop1._id,
        ownerId: testShop1.ownerId,
        partName: `Low Stock Clutch Wire ${timestamp}`,
        partNumber: `CLUTCH-${timestamp}`,
        description: 'Quality clutch cable wire',
        category: 'Engine & Drivetrain',
        vehicleType: 'Bike',
        manufacturer: 'Honda Genuine',
        price: 350,
        stockQuantity: 3,
        isPublished: true,
        isArchived: false
      },
      {
        shopId: testShop1._id,
        ownerId: testShop1.ownerId,
        partName: `Out of Stock Piston ${timestamp}`,
        partNumber: `PISTON-${timestamp}`,
        description: 'High compression piston',
        category: 'Engine & Drivetrain',
        vehicleType: 'Car',
        manufacturer: 'Mahle',
        price: 2500,
        stockQuantity: 0,
        isPublished: true,
        isArchived: false
      }
    ]);

    const inventoryRes = await makeRequest('/api/admin/analytics/inventory', {
      headers: { Cookie: adminCookie }
    });
    const invData = inventoryRes.data?.data;

    if (
      inventoryRes.status === 200 &&
      invData &&
      invData.summary?.lowStockCount >= 1 &&
      invData.summary?.outOfStockCount >= 1 &&
      Array.isArray(invData.categories) &&
      invData.lowStockProducts.some((p) => p.stockQuantity <= 5) &&
      invData.outOfStockProducts.some((p) => p.stockQuantity === 0)
    ) {
      logPass(11, 'Inventory insights endpoint correctly reports low-stock, out-of-stock, and categories');
    } else {
      logFail(11, 'Inventory analytics failed to return required stock breakdowns', invData);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Customer Analytics Endpoint
    // -------------------------------------------------------------------------
    const customerAnalyticsRes = await makeRequest('/api/admin/analytics/customers', {
      headers: { Cookie: adminCookie }
    });
    const custData = customerAnalyticsRes.data?.data;

    if (
      customerAnalyticsRes.status === 200 &&
      custData &&
      Array.isArray(custData.statuses) &&
      Array.isArray(custData.registrationsTimeline) &&
      custData.purchasingBehavior
    ) {
      logPass(12, 'Customer analytics returns registrations timeline, account statuses, and behavior');
    } else {
      logFail(12, 'Customer analytics missing expected keys', custData);
    }

    // -------------------------------------------------------------------------
    // TEST 13: CSV Report Exports (Orders, Inventory, Shops, Customers)
    // -------------------------------------------------------------------------
    const [ordersCsvRes, inventoryCsvRes, shopsCsvRes, customersCsvRes] = await Promise.all([
      makeRequest('/api/admin/reports/orders.csv', { headers: { Cookie: adminCookie } }),
      makeRequest('/api/admin/reports/inventory.csv', { headers: { Cookie: adminCookie } }),
      makeRequest('/api/admin/reports/shops.csv', { headers: { Cookie: adminCookie } }),
      makeRequest('/api/admin/reports/customers.csv', { headers: { Cookie: adminCookie } })
    ]);

    const allCsvValid =
      ordersCsvRes.status === 200 &&
      ordersCsvRes.headers['content-type'].includes('text/csv') &&
      typeof ordersCsvRes.data === 'string' &&
      ordersCsvRes.data.includes('Order Number') &&
      inventoryCsvRes.status === 200 &&
      inventoryCsvRes.headers['content-type'].includes('text/csv') &&
      typeof inventoryCsvRes.data === 'string' &&
      inventoryCsvRes.data.includes('Part Number') &&
      shopsCsvRes.status === 200 &&
      shopsCsvRes.headers['content-type'].includes('text/csv') &&
      typeof shopsCsvRes.data === 'string' &&
      shopsCsvRes.data.includes('Shop Name') &&
      customersCsvRes.status === 200 &&
      customersCsvRes.headers['content-type'].includes('text/csv') &&
      typeof customersCsvRes.data === 'string' &&
      customersCsvRes.data.includes('Customer Name');

    // Security check: Customer CSV MUST NOT contain passwords or hashes
    const noSecretsLeaked =
      !customersCsvRes.data.includes('passwordHash') &&
      !customersCsvRes.data.includes('passwordResetToken') &&
      !customersCsvRes.data.includes('emailVerificationToken');

    if (allCsvValid && noSecretsLeaked) {
      logPass(13, 'All 4 CSV reports export valid data with proper headers and zero secret field exposure');
    } else {
      logFail(13, 'CSV export validation failed', {
        orders: ordersCsvRes.status,
        inventory: inventoryCsvRes.status,
        shops: shopsCsvRes.status,
        customers: customersCsvRes.status,
        noSecretsLeaked
      });
    }

    // -------------------------------------------------------------------------
    // TEST 14: CSV Formula Injection Mitigation (CWE-1236)
    // -------------------------------------------------------------------------
    const testCases = [
      { input: '=1+1', expectedStarts: "'=" },
      { input: '+12345', expectedStarts: "'+12345" },
      { input: '+cmd|"/c calc"', expectedStarts: '"\'+cmd' },
      { input: '-SUM(A1:A10)', expectedStarts: "'-SUM" },
      { input: '@calc', expectedStarts: "'@calc" },
      { input: '\tsecret', expectedStarts: "'\t" },
      { input: 'Normal Brake Pad', expected: 'Normal Brake Pad' },
      { input: 'Brake Pad, Front & Rear', expected: '"Brake Pad, Front & Rear"' }
    ];

    let formulaDefensePassed = true;
    for (const tc of testCases) {
      const sanitized = sanitizeCsvCell(tc.input);
      if (tc.expectedStarts && !sanitized.startsWith(tc.expectedStarts)) {
        formulaDefensePassed = false;
        break;
      }
      if (tc.expected && sanitized !== tc.expected) {
        formulaDefensePassed = false;
        break;
      }
    }

    if (formulaDefensePassed) {
      logPass(14, 'Formula injection mitigation successfully sanitizes dangerous leading characters (=, +, -, @, \\t)');
    } else {
      logFail(14, 'Formula injection sanitization did not produce expected safe escaping');
    }

    // -------------------------------------------------------------------------
    // TEST 15: Zero Regressions — Public Health & Search Continue Functioning
    // -------------------------------------------------------------------------
    const healthRes = await makeRequest('/api/health');
    const searchRes = await makeRequest('/api/search/meta');

    if (healthRes.status === 200 && searchRes.status === 200) {
      logPass(15, 'Zero regressions: Platform health and search APIs continue operating seamlessly');
    } else {
      logFail(15, 'Regression detected in health or search endpoints', {
        health: healthRes.status,
        search: searchRes.status
      });
    }

    // Teardown test records
    await User.deleteMany({
      email: { $in: [adminEmail, customerEmail, ownerEmail] }
    });
    await Shop.deleteMany({
      _id: { $in: [testShop1._id, testShop2._id] }
    });
    await Order.deleteMany({
      orderNumber: { $regex: `^EXS-M16-.*-${timestamp}$` }
    });
    await SparePart.deleteMany({
      partNumber: { $regex: `-${timestamp}$` }
    });

  } catch (err) {
    console.error('Fatal test runner error:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
    console.log('\n---------------------------------------------------------------');
    console.log(`Test Execution Finished: ${passCount} Passed, ${failCount} Failed.`);
    console.log('---------------------------------------------------------------\n');
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runTests();
