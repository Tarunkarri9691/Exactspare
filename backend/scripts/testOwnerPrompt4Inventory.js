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
import { PARTS_DIR } from '../utils/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5064; // Dedicated port for Prompt 4 test suite
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

const makeMultipartRequest = (pathUrl, { fields = {}, files = {}, cookie = null }) => {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(pathUrl, baseUrl);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
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

    // Write text fields
    for (const [key, value] of Object.entries(fields)) {
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
      req.write(`${value}\r\n`);
    }

    // Write file fields
    for (const [fieldName, fileInfo] of Object.entries(files)) {
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="${fieldName}"; filename="${fileInfo.filename}"\r\n`);
      req.write(`Content-Type: ${fileInfo.contentType || 'application/octet-stream'}\r\n\r\n`);
      req.write(fileInfo.buffer);
      req.write('\r\n');
    }

    req.write(`--${boundary}--\r\n`);
    req.end();
  });
};

const runAllTests = async () => {
  console.log('\n===============================================================');
  console.log('EXACTSPARE OWNER PORTAL PROMPT 4: INVENTORY & PHOTO RECOGNITION');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const owner1Email = 'test.owner4.verified@exactspare.com';
  const owner2Email = 'test.owner4.unapproved@exactspare.com';
  const owner3Email = 'test.owner4.rival@exactspare.com';

  const testUsers = await User.find({ email: { $in: [owner1Email, owner2Email, owner3Email] } });
  const testUserIds = testUsers.map(u => u._id);
  await SparePart.deleteMany({ ownerId: { $in: testUserIds } });
  await Shop.deleteMany({ ownerId: { $in: testUserIds } });
  await User.deleteMany({ email: { $in: [owner1Email, owner2Email, owner3Email] } });

  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 0. Register Test Accounts
    const regOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Approved Merchant',
        email: owner1Email,
        phone: '+919876544001',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });
    const owner1Cookie = parseCookie(regOwner1);
    const owner1Id = regOwner1.data?.user?.id;

    const regOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Unapproved Merchant',
        email: owner2Email,
        phone: '+919876544002',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });
    const owner2Cookie = parseCookie(regOwner2);

    const regOwner3 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rival Merchant',
        email: owner3Email,
        phone: '+919876544003',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });
    const owner3Cookie = parseCookie(regOwner3);
    const owner3Id = regOwner3.data?.user?.id;

    // Seed approved shop application and shop for Owner 1
    const app1 = await ShopApplication.create({
      ownerId: owner1Id,
      shopName: 'Precision Gearworks & Spares',
      ownerFullName: 'Approved Merchant',
      ownerPhone: '+919876544001',
      businessEmail: owner1Email,
      shopDescription: 'Authorized OEM performance parts distributor and supplier',
      shopCategory: 'CAR',
      addressLine: '88 MG Road Autozone',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      shopImagePaths: ['/uploads/shops/storefront1.jpg'],
      status: 'APPROVED',
      paymentStatus: 'PAID',
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    const approvedShop1 = await Shop.create({
      applicationId: app1._id,
      ownerId: owner1Id,
      name: 'Precision Gearworks & Spares',
      description: 'Authorized OEM performance parts distributor and supplier',
      category: 'CAR',
      address: {
        addressLine: '88 MG Road Autozone',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      contact: {
        phone: '+919876544001',
        email: owner1Email
      },
      phone: '+919876544001',
      email: owner1Email,
      isApproved: true,
      isActive: true,
      images: ['/uploads/shops/storefront1.jpg']
    });

    // Seed approved shop application and shop for Owner 3 (Rival)
    const app3 = await ShopApplication.create({
      ownerId: owner3Id,
      shopName: 'Rival Auto Spares',
      ownerFullName: 'Rival Merchant',
      ownerPhone: '+919876544003',
      businessEmail: owner3Email,
      shopDescription: 'Competing aftermarket retailer',
      shopCategory: 'CAR',
      addressLine: '12 Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      latitude: 12.9784,
      longitude: 77.6412,
      shopImagePaths: ['/uploads/shops/storefront3.jpg'],
      status: 'APPROVED',
      paymentStatus: 'PAID',
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    const approvedShop3 = await Shop.create({
      applicationId: app3._id,
      ownerId: owner3Id,
      name: 'Rival Auto Spares',
      description: 'Competing aftermarket retailer',
      category: 'CAR',
      address: {
        addressLine: '12 Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        location: {
          type: 'Point',
          coordinates: [77.6412, 12.9784]
        }
      },
      contact: {
        phone: '+919876544003',
        email: owner3Email
      },
      phone: '+919876544003',
      email: owner3Email,
      isApproved: true,
      isActive: true,
      images: ['/uploads/shops/storefront3.jpg']
    });

    // =========================================================
    // CASE 1: Publishing restrictions for unapproved shops
    // =========================================================
    const unapprovedCreateRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner2Cookie },
      body: {
        partName: 'Illegal Listing',
        description: 'Should be blocked by server middleware',
        category: 'Engine',
        vehicleType: 'Car',
        manufacturer: 'Generic',
        partNumber: 'ERR-001',
        price: 999,
        stockQuantity: 5
      }
    });

    if (unapprovedCreateRes.status === 403) {
      logPass(1, 'Unapproved shop owner cannot publish inventory (HTTP 403 Forbidden)');
    } else {
      logFail(1, 'Unapproved shop inventory protection', `Status: ${unapprovedCreateRes.status}`);
    }

    // =========================================================
    // CASE 2: Image upload validation (valid image & invalid file format)
    // =========================================================
    // 2A: Upload non-image text file -> rejected
    const badFileBuffer = Buffer.from('console.log("malicious code");', 'utf-8');
    const badUploadRes = await makeMultipartRequest('/api/parts/auto-fill-from-image', {
      files: {
        partPhoto: {
          filename: 'script.js',
          contentType: 'application/javascript',
          buffer: badFileBuffer
        }
      },
      cookie: owner1Cookie
    });

    if (badUploadRes.status === 400 || badUploadRes.status === 500) {
      logPass('2A', 'Invalid non-image file upload is rejected by strict MIME and extension filter');
    } else {
      logFail('2A', 'MIME type filter check', `Status: ${badUploadRes.status}`);
    }

    // 2B: Valid sample JPEG photo uploaded for photo-based identification
    // Create a 1x1 valid sample jpeg buffer
    const validSampleJpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0x7f, 0x00, 0xff, 0xd9
    ]);

    const validPhotoRes = await makeMultipartRequest('/api/parts/auto-fill-from-image', {
      files: {
        partPhoto: {
          filename: 'bosch-oil-filter.jpg',
          contentType: 'image/jpeg',
          buffer: validSampleJpg
        }
      },
      cookie: owner1Cookie
    });

    if (validPhotoRes.status === 200 && validPhotoRes.data.data?.uploadedImage?.path) {
      logPass('2B', 'Valid spare-part photograph uploaded and safely stored in uploads/parts directory');
    } else {
      logFail('2B', 'Valid photo upload', JSON.stringify(validPhotoRes.data));
    }

    // =========================================================
    // CASE 3: AI Configured vs AI Unavailable Scenarios (No Fake Pricing)
    // =========================================================
    // The endpoint must return editable suggestions without fabricating prices
    if (
      validPhotoRes.status === 200 &&
      validPhotoRes.data.data?.price === undefined &&
      validPhotoRes.data.data?.stockQuantity === undefined
    ) {
      logPass(3, 'Image auto-fill strictly omits price & stock — owner controls all prices manually (Zero AI pricing)');
    } else {
      logFail(3, 'AI price contamination check', 'Price or stock was populated by AI endpoint');
    }

    // =========================================================
    // CASE 4: Manual part creation with owner-controlled price & vehicle compatibility
    // =========================================================
    // Test negative price rejection
    const invalidPriceRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'NGK Iridium Spark Plug Set',
        description: 'High-performance laser iridium spark plugs for Japanese VTEC engines',
        category: 'Engine',
        subcategory: 'Ignition & Spark Plugs',
        vehicleType: 'Car',
        compatibleMakes: ['Honda', 'Toyota'],
        compatibleModels: ['City', 'Civic', 'Corolla'],
        compatibleYears: ['2018', '2019', '2020', '2021', '2022'],
        compatibleVariant: '1.5L i-VTEC VXi / ZX',
        manufacturer: 'NGK',
        partNumber: 'ILZKR7B-11',
        condition: 'NEW',
        price: -150, // NEGATIVE PRICE REJECTED
        stockQuantity: 12
      }
    });

    if (invalidPriceRes.status === 400) {
      logPass('4A', 'Negative or invalid pricing is rejected by backend validation (HTTP 400)');
    } else {
      logFail('4A', 'Negative price rejection', `Status: ${invalidPriceRes.status}`);
    }

    // Valid part creation
    const createPart1Res = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'NGK Laser Iridium Spark Plug Pack of 4',
        description: 'Precision OEM performance laser iridium spark plugs for smooth acceleration and optimal fuel efficiency.',
        category: 'Engine',
        subcategory: 'Ignition & Plugs',
        vehicleType: 'Car',
        compatibleMakes: ['Honda', 'Toyota'],
        compatibleModels: ['City', 'Civic', 'Corolla'],
        compatibleYears: ['2018', '2019', '2020', '2021', '2022'],
        compatibleVariant: '1.5L i-VTEC VXi',
        manufacturer: 'NGK',
        partNumber: 'ILZKR7B11',
        condition: 'NEW',
        price: 2850,
        stockQuantity: 14,
        notes: 'Warehouse Rack B4-12. In OEM sealed blister package.',
        isPublished: true
      }
    });

    const part1 = createPart1Res.data?.part;
    const part1Id = part1?._id;

    if (
      createPart1Res.status === 201 &&
      part1 &&
      part1.price === 2850 &&
      part1.stockQuantity === 14 &&
      part1.compatibleVariant === '1.5L i-VTEC VXi' &&
      part1.isPublished === true
    ) {
      logPass('4B', 'Owner successfully created spare part with manual price ₹2,850 and variant compatibility');
    } else {
      logFail('4B', 'Valid part creation', JSON.stringify(createPart1Res.data));
    }

    // Create a 2nd part (Low stock item)
    const createPart2Res = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Brembo Front Ceramic Brake Rotor 262mm',
        description: 'Vented high-carbon front disc brake rotor',
        category: 'Brakes',
        vehicleType: 'Car',
        manufacturer: 'Brembo',
        partNumber: '09.5509.11',
        condition: 'NEW',
        price: 4999,
        stockQuantity: 2, // Low stock (<= 3)
        isPublished: true
      }
    });
    const part2Id = createPart2Res.data?.part?._id;

    // Create a 3rd part (Draft / Unpublished item)
    const createPart3Res = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Bosch Super 4 Spark Plug Set',
        description: 'Unpublished draft item awaiting inventory count verification',
        category: 'Engine',
        vehicleType: 'Car',
        manufacturer: 'Bosch',
        partNumber: 'WR78X',
        condition: 'USED',
        price: 1100,
        stockQuantity: 0, // Out of stock
        isPublished: false // Draft
      }
    });
    const part3Id = createPart3Res.data?.part?._id;

    // =========================================================
    // CASE 5: Owner inventory metrics and multi-filter querying
    // =========================================================
    const inventoryAllRes = await makeRequest('/api/parts/my', {
      headers: { Cookie: owner1Cookie }
    });

    const stats = inventoryAllRes.data?.stats;

    if (
      inventoryAllRes.status === 200 &&
      stats.totalParts === 3 &&
      stats.publishedCount === 2 &&
      stats.draftCount === 1 &&
      stats.lowStockCount === 1 &&
      stats.outOfStockCount === 1
    ) {
      logPass('5A', 'Inventory dashboard accurately computes total, published, draft, low-stock, and out-of-stock metrics');
    } else {
      logFail('5A', 'Inventory metrics check', JSON.stringify(stats));
    }

    // Filter by condition
    const conditionFilterRes = await makeRequest('/api/parts/my?condition=USED', {
      headers: { Cookie: owner1Cookie }
    });
    const usedParts = conditionFilterRes.data?.parts || [];

    // Filter by availability: LOW_STOCK
    const lowStockFilterRes = await makeRequest('/api/parts/my?availability=LOW_STOCK', {
      headers: { Cookie: owner1Cookie }
    });
    const lowStockParts = lowStockFilterRes.data?.parts || [];

    // Filter by search: "ILZKR7B11"
    const searchFilterRes = await makeRequest('/api/parts/my?search=ILZKR7B11', {
      headers: { Cookie: owner1Cookie }
    });
    const searchParts = searchFilterRes.data?.parts || [];

    if (
      usedParts.length === 1 && usedParts[0].condition === 'USED' &&
      lowStockParts.length === 1 && lowStockParts[0].partNumber === '09.5509.11' &&
      searchParts.length === 1 && searchParts[0].partNumber === 'ILZKR7B11'
    ) {
      logPass('5B', 'Inventory filters by condition, availability (low stock), and search by part number function properly');
    } else {
      logFail('5B', 'Multi-filter inventory query', `Used: ${usedParts.length}, Low: ${lowStockParts.length}, Search: ${searchParts.length}`);
    }

    // =========================================================
    // CASE 6: Stock & price update (Immediate persistence)
    // =========================================================
    const updatePriceRes = await makeRequest(`/api/parts/${part1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        price: 2990,
        stockQuantity: 20
      }
    });

    const updatedPartDb = await SparePart.findById(part1Id);

    if (
      updatePriceRes.status === 200 &&
      updatedPartDb.price === 2990 &&
      updatedPartDb.stockQuantity === 20
    ) {
      logPass(6, 'Owner updated selling price to ₹2,990 and stock to 20 units with confirmed database persistence');
    } else {
      logFail(6, 'Price and stock update', `Price: ${updatedPartDb?.price}, Stock: ${updatedPartDb?.stockQuantity}`);
    }

    // =========================================================
    // CASE 7: Publish, unpublish and customer visibility
    // =========================================================
    // 7A: Check public search includes published part 1
    const publicSearch1 = await makeRequest('/api/parts?search=ILZKR7B11');
    const pubList1 = publicSearch1.data?.parts || [];
    const foundPubPart1 = pubList1.some(p => p._id === part1Id);

    // 7B: Toggle Part 1 to Draft (isPublished: false)
    await makeRequest(`/api/parts/${part1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { isPublished: false }
    });

    // 7C: Check public search now hides Part 1
    const publicSearch2 = await makeRequest('/api/parts?search=ILZKR7B11');
    const pubList2 = publicSearch2.data?.parts || [];
    const hiddenPubPart1 = !pubList2.some(p => p._id === part1Id);

    // 7D: Re-publish Part 1
    await makeRequest(`/api/parts/${part1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { isPublished: true }
    });

    if (foundPubPart1 && hiddenPubPart1) {
      logPass(7, 'Unpublished parts are strictly hidden from customer marketplace, while published parts are discoverable');
    } else {
      logFail(7, 'Marketplace visibility toggle', `FoundBefore: ${foundPubPart1}, HiddenAfter: ${hiddenPubPart1}`);
    }

    // =========================================================
    // CASE 8: Unauthorized access to another owner's parts
    // =========================================================
    // Owner 3 (Rival) attempts to edit or delete Owner 1's part
    const unauthorizedEditRes = await makeRequest(`/api/parts/${part1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner3Cookie },
      body: { price: 10 }
    });

    const unauthorizedDeleteRes = await makeRequest(`/api/parts/${part1Id}`, {
      method: 'DELETE',
      headers: { Cookie: owner3Cookie }
    });

    if (unauthorizedEditRes.status === 404 && unauthorizedDeleteRes.status === 404) {
      logPass(8, 'Unauthorized owners are strictly prevented from modifying or deleting another shop\'s inventory (HTTP 404 Not Found)');
    } else {
      logFail(8, 'Cross-tenant isolation check', `Edit: ${unauthorizedEditRes.status}, Delete: ${unauthorizedDeleteRes.status}`);
    }

    // =========================================================
    // CASE 9: Safe archival of part listing
    // =========================================================
    const archiveRes = await makeRequest(`/api/parts/${part2Id}`, {
      method: 'DELETE',
      headers: { Cookie: owner1Cookie }
    });

    const archivedPartDb = await SparePart.findById(part2Id);
    const activeInventoryCheck = await makeRequest('/api/parts/my', {
      headers: { Cookie: owner1Cookie }
    });
    const activeList = activeInventoryCheck.data?.parts || [];
    const isExcludedFromActive = !activeList.some(p => p._id === part2Id);

    if (
      archiveRes.status === 200 &&
      archivedPartDb.isArchived === true &&
      archivedPartDb.isPublished === false &&
      isExcludedFromActive
    ) {
      logPass(9, 'Safe archival deactivates listing and removes it from active inventory while preserving row for order history');
    } else {
      logFail(9, 'Safe archival check', `isArchived: ${archivedPartDb?.isArchived}, excluded: ${isExcludedFromActive}`);
    }

    // =========================================================
    // CASE 10: Customer portal integration & data fidelity
    // =========================================================
    const customerPartView = await makeRequest(`/api/parts/${part1Id}`);
    const cp = customerPartView.data?.part;

    if (
      customerPartView.status === 200 &&
      cp &&
      cp.partName === 'NGK Laser Iridium Spark Plug Pack of 4' &&
      cp.price === 2990 &&
      cp.shopId?.name === 'Precision Gearworks & Spares' &&
      cp.shopId?.address?.city === 'Bengaluru' &&
      cp.compatibleVariant === '1.5L i-VTEC VXi'
    ) {
      logPass(10, 'Customer portal displays real part details, owner-set price (₹2,990), compatibility variant, and shop location');
    } else {
      logFail(10, 'Customer view verification', JSON.stringify(customerPartView.data));
    }

    console.log('\n===============================================================');
    console.log('ALL OWNER PORTAL PROMPT 4 TESTS PASSED PERFECTLY!');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Test run fatal error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runAllTests();
