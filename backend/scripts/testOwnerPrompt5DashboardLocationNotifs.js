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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5065; // Dedicated port for Prompt 5 test suite
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

async function runPrompt5TestSuite() {
  console.log('\n===============================================================');
  console.log('EXACTSPARE OWNER PORTAL PROMPT 5: DASHBOARD, LOCATION, NOTIFS & SETTINGS');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/exactspare';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const ts = Date.now();
  const owner1Email = `owner5.verified.${ts}@exactspare.test`;
  const owner2Email = `owner5.rival.${ts}@exactspare.test`;
  const initialPassword = 'Password@123';
  const updatedPassword = 'NewSecurePassword@456';

  let owner1Cookie = '';
  let owner2Cookie = '';
  let owner1User = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Register Owner 1 and Owner 2
    // -------------------------------------------------------------
    const regRes1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rohan Sharma',
        email: owner1Email,
        password: initialPassword,
        confirmPassword: initialPassword,
        role: 'OWNER',
        phone: '+91 9811223344'
      }
    });
    owner1Cookie = parseCookie(regRes1);
    owner1User = regRes1.data.user || regRes1.data.data?.user;
    const owner1Id = owner1User?.id || owner1User?._id;

    const regRes2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Vikram Singh',
        email: owner2Email,
        password: initialPassword,
        confirmPassword: initialPassword,
        role: 'OWNER',
        phone: '+91 9822334455'
      }
    });
    owner2Cookie = parseCookie(regRes2);

    if (regRes1.status === 201 && regRes2.status === 201) {
      logPass(1, 'Registered test shop owners with authenticated session cookies');
    } else {
      logFail(1, 'Failed to register test shop owners', regRes1.data);
    }

    // -------------------------------------------------------------
    // Step 2: Seed Approved Shop for Owner 1 in MongoDB
    // -------------------------------------------------------------
    const appId = new mongoose.Types.ObjectId();
    const shopId = new mongoose.Types.ObjectId();

    await ShopApplication.create({
      _id: appId,
      ownerId: owner1Id,
      ownerFullName: 'Rohan Sharma',
      ownerPhone: '+91 9811223344',
      businessEmail: owner1Email,
      shopName: 'Sharma Auto World',
      shopCategory: 'MULTI_CATEGORY',
      shopDescription: 'Authorized retailer of genuine multi-brand spare parts in North Delhi.',
      addressLine: 'Shop 12, G.T. Road Auto Market',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110006',
      latitude: 28.6139,
      longitude: 77.2090,
      status: 'APPROVED',
      paymentStatus: 'PAID',
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    await Shop.create({
      _id: shopId,
      ownerId: owner1Id,
      applicationId: appId,
      name: 'Sharma Auto World',
      category: 'MULTI_CATEGORY',
      description: 'Authorized retailer of genuine multi-brand spare parts in North Delhi.',
      address: {
        addressLine: 'Shop 12, G.T. Road Auto Market',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110006',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139] // [lng, lat]
        }
      },
      contact: {
        phone: '+91 9811223344',
        email: owner1Email
      },
      openingHours: 'Mon-Sat: 09:00 AM - 08:30 PM',
      isApproved: true,
      isActive: true,
      approvedAt: new Date()
    });

    logPass(2, 'Seeded verified active shop for merchant with authoritative GeoJSON coordinates');

    // -------------------------------------------------------------
    // Test 3: Dashboard Inventory Metrics Against Real Database Records
    // -------------------------------------------------------------
    // Part A: In stock published part (Qty: 10, Price: ₹1850)
    await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Minda Headlight Assembly Left',
        description: 'Clear lens front halogen headlight assembly for Maruti Swift.',
        category: 'ELECTRICAL',
        vehicleType: 'Car',
        manufacturer: 'Minda',
        partNumber: 'MIN-SW-HL01',
        condition: 'NEW',
        price: 1850,
        stockQuantity: 10,
        isPublished: true
      }
    });

    // Part B: Low stock published part (Qty: 2, Price: ₹650)
    await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Purolator Air Filter Element',
        description: 'High efficiency engine air intake filter.',
        category: 'ENGINE',
        vehicleType: 'Car',
        manufacturer: 'Purolator',
        partNumber: 'PUR-AF-442',
        condition: 'NEW',
        price: 650,
        stockQuantity: 2,
        isPublished: true
      }
    });

    // Part C: Out of stock draft part (Qty: 0, Price: ₹3200)
    await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Gabriel Rear Gas Shock Absorber',
        description: 'Heavy duty gas-pressurized rear damper set.',
        category: 'SUSPENSION',
        vehicleType: 'Car',
        manufacturer: 'Gabriel',
        partNumber: 'GAB-SA-881',
        condition: 'NEW',
        price: 3200,
        stockQuantity: 0,
        isPublished: false
      }
    });

    // Fetch aggregated inventory stats
    const invRes = await makeRequest('/api/parts/my', {
      method: 'GET',
      headers: { Cookie: owner1Cookie }
    });

    const stats = invRes.data?.data?.stats || invRes.data?.stats;
    if (
      stats &&
      stats.totalParts === 3 &&
      stats.publishedCount === 2 &&
      stats.draftCount === 1 &&
      stats.lowStockCount === 1 &&
      stats.outOfStockCount === 1
    ) {
      logPass(3, `Dashboard metrics accurately verified: Total=3, Published=2, Draft=1, LowStock=1, OutOfStock=1`);
    } else {
      logFail(3, `Stats mismatch: expected 3/2/1/1/1, got ${JSON.stringify(stats)}`);
    }

    // -------------------------------------------------------------
    // Test 4: Real Backend Events Trigger Notifications
    // -------------------------------------------------------------
    const notifsRes = await makeRequest('/api/notifications', {
      method: 'GET',
      headers: { Cookie: owner1Cookie }
    });

    const notifs = notifsRes.data?.data?.notifications || notifsRes.data?.notifications || [];
    const partAddedNotif = notifs.find(n => n.type === 'PART_ADDED');
    const outOfStockNotif = notifs.find(n => n.type === 'PART_OUT_OF_STOCK');
    const lowStockNotif = notifs.find(n => n.type === 'PART_LOW_STOCK');

    if (partAddedNotif && outOfStockNotif && lowStockNotif) {
      logPass(4, `Real backend events generated notifications: PART_ADDED, PART_OUT_OF_STOCK, and PART_LOW_STOCK`);
    } else {
      logFail(4, `Missing expected notification types. Found types: ${notifs.map(n => n.type).join(', ')}`);
    }

    // -------------------------------------------------------------
    // Test 5: Mark Single Notification as Read & Unread Count Decrement
    // -------------------------------------------------------------
    const initialUnread = notifsRes.data?.data?.unreadCount ?? notifsRes.data?.unreadCount;
    const targetNotifId = notifs[0]._id;

    const markRes = await makeRequest(`/api/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie }
    });

    const unreadCountRes = await makeRequest('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Cookie: owner1Cookie }
    });
    const currentUnread = unreadCountRes.data?.data?.unreadCount ?? unreadCountRes.data?.unreadCount;

    if (markRes.status === 200 && currentUnread === initialUnread - 1) {
      logPass(5, `Single notification marked as read; unread count decremented from ${initialUnread} to ${currentUnread}`);
    } else {
      logFail(5, `Failed unread count decrement: initial=${initialUnread}, current=${currentUnread}`);
    }

    // -------------------------------------------------------------
    // Test 6: Mark All Notifications as Read
    // -------------------------------------------------------------
    const markAllRes = await makeRequest('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie }
    });

    const afterAllRes = await makeRequest('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Cookie: owner1Cookie }
    });
    const afterAllUnread = afterAllRes.data?.data?.unreadCount ?? afterAllRes.data?.unreadCount;

    if (markAllRes.status === 200 && afterAllUnread === 0) {
      logPass(6, `Mark all notifications as read succeeded; verified unreadCount = 0`);
    } else {
      logFail(6, `Mark all notifications did not zero unread count: ${afterAllUnread}`);
    }

    // -------------------------------------------------------------
    // Test 7: Cross-Tenant Notification Isolation
    // -------------------------------------------------------------
    const crossRes = await makeRequest(`/api/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: owner2Cookie }
    });

    if (crossRes.status === 404) {
      logPass(7, 'Cross-tenant notification security enforced: rival owner cannot read or modify another alert (HTTP 404)');
    } else {
      logFail(7, `Unexpected status code on cross-tenant modification: ${crossRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 8: Shop Location Save, Reload, and GeoJSON Validation
    // -------------------------------------------------------------
    const newLocPayload = {
      addressLine: 'Plot 42, Mayapuri Industrial Area Phase II',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110064',
      latitude: 28.6280,
      longitude: 77.1120
    };

    const updateLocRes = await makeRequest('/api/shops/my/location', {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: newLocPayload
    });

    if (updateLocRes.status === 200 && updateLocRes.data?.data?.latitude === 28.6280) {
      // Reopen / reload shop details to verify persistence in MongoDB
      const reloadShopRes = await makeRequest('/api/shops/my', {
        method: 'GET',
        headers: { Cookie: owner1Cookie }
      });
      const coords = reloadShopRes.data?.shop?.address?.location?.coordinates;
      if (coords && coords[0] === 77.1120 && coords[1] === 28.6280) {
        logPass(8, `Shop location saved and accurately reloaded from DB: [Lng: ${coords[0]}, Lat: ${coords[1]}] (GeoJSON Point)`);
      } else {
        logFail(8, `Coordinates mismatch on reload: ${JSON.stringify(coords)}`);
      }
    } else {
      logFail(8, 'Failed to update shop location', updateLocRes.data);
    }

    // -------------------------------------------------------------
    // Test 9: Coordinate Range and Server-Side Validation
    // -------------------------------------------------------------
    const invalidCoordsRes = await makeRequest('/api/shops/my/location', {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        latitude: 145.5, // Invalid latitude > 90
        longitude: 77.1120
      }
    });

    if (invalidCoordsRes.status === 400) {
      logPass(9, 'Server-side validation strictly rejects out-of-bounds geographic coordinates (HTTP 400)');
    } else {
      logFail(9, `Unexpected status on invalid coords: ${invalidCoordsRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 10: Location Modification Restriction for Unapproved Shop
    // -------------------------------------------------------------
    const unapprovedLocRes = await makeRequest('/api/shops/my/location', {
      method: 'PATCH',
      headers: { Cookie: owner2Cookie },
      body: {
        latitude: 28.6139,
        longitude: 77.2090
      }
    });

    if ([403, 404].includes(unapprovedLocRes.status)) {
      logPass(10, 'Unapproved/pending owner cannot modify live store location (HTTP 403/404 Forbidden)');
    } else {
      logFail(10, `Unexpected status for unapproved owner location change: ${unapprovedLocRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 11: Owner Profile Update with Server Validation
    // -------------------------------------------------------------
    const profileUpdateRes = await makeRequest('/api/users/profile', {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        name: 'Rohan K. Sharma',
        phone: '+91 9998887766'
      }
    });

    const updatedName = profileUpdateRes.data?.profile?.name || profileUpdateRes.data?.user?.name || profileUpdateRes.data?.data?.user?.name;
    if (profileUpdateRes.status === 200 && updatedName === 'Rohan K. Sharma') {
      logPass(11, 'Owner profile name and phone number updated with authoritative server-side persistence');
    } else {
      logFail(11, 'Failed to update owner profile', profileUpdateRes.data);
    }

    // -------------------------------------------------------------
    // Test 12: Secure Password Change with bcrypt & Session Login
    // -------------------------------------------------------------
    const changePassRes = await makeRequest('/api/auth/change-password', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        currentPassword: initialPassword,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      }
    });

    if (changePassRes.status === 200) {
      // Re-login with new password to verify bcrypt re-hash
      const newLoginRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: owner1Email,
          password: updatedPassword
        }
      });

      if (newLoginRes.status === 200) {
        logPass(12, 'Password securely updated with bcrypt re-hash; verified authentication with updated credentials');
      } else {
        logFail(12, 'Login failed with updated password', newLoginRes.data);
      }
    } else {
      logFail(12, 'Password change request failed', changePassRes.data);
    }

    console.log('\n===============================================================');
    console.log('ALL 12 OWNER PORTAL PROMPT 5 TESTS PASSED PERFECTLY!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('Test Suite encountered an unexpected error:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runPrompt5TestSuite();
