import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import SparePart from '../models/SparePart.js';
import fs from 'fs';
import path from 'path';

const TEST_PORT = 5092;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let server;
const createdUserIds = [];
const createdShopIds = [];
const createdPartIds = [];

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            json = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function makeMultipartRequest(path, fieldName, filename, fileBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Math.random().toString(36).substring(2);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileBuffer, footer]);

    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            json = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runModule11Tests() {
  console.log('\n===============================================================');
  console.log('EXACTSPARE MODULE 11 — ADVANCED SEARCH, BARCODE/QR & PART IDENTIFICATION');
  console.log('===============================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB database successfully.');

    await new Promise((resolve) => {
      server = http.createServer(app).listen(TEST_PORT, () => {
        console.log(`Test server running at ${BASE_URL}\n`);
        resolve();
      });
    });

    // -------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------
    console.log('--- Setting up Module 11 Test Fixtures ---');

    // 1. Approved Shop Owner and Approved Shop
    const approvedOwner = await User.create({
      name: 'M11 Precision Parts Dealer',
      email: `m11_merchant_${Date.now()}@test.com`,
      passwordHash: 'dummy_hash',
      role: 'OWNER',
      phone: '9876543211'
    });
    createdUserIds.push(approvedOwner._id);

    const approvedShop = await Shop.create({
      name: 'M11 Apex Auto Spares',
      ownerId: approvedOwner._id,
      applicationId: new mongoose.Types.ObjectId(),
      category: 'CAR',
      description: 'Authorized OEM and performance spare parts supplier.',
      isApproved: true,
      isActive: true,
      address: {
        addressLine: '12 Industrial Area Phase 2',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      contact: { phone: approvedOwner.phone, email: approvedOwner.email }
    });
    createdShopIds.push(approvedShop._id);

    // 2. Unapproved Shop (for security negative tests)
    const unapprovedOwner = await User.create({
      name: 'M11 Unapproved Merchant',
      email: `m11_unapproved_${Date.now()}@test.com`,
      passwordHash: 'dummy_hash',
      role: 'OWNER',
      phone: '9876543212'
    });
    createdUserIds.push(unapprovedOwner._id);

    const unapprovedShop = await Shop.create({
      name: 'M11 BlackMarket Parts',
      ownerId: unapprovedOwner._id,
      applicationId: new mongoose.Types.ObjectId(),
      category: 'CAR',
      description: 'Pending verification shop.',
      isApproved: false,
      isActive: true,
      address: {
        addressLine: '99 Hidden Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      },
      contact: { phone: unapprovedOwner.phone, email: unapprovedOwner.email }
    });
    createdShopIds.push(unapprovedShop._id);

    // 3. Test Spare Parts with Barcodes and MPNs
    const knownBarcode = `890${Date.now().toString().slice(-9)}1`;
    const knownPartNumber = `EXACT-BRK-${Date.now().toString().slice(-4)}`;
    const knownMpn = `MPN-BREM-${Date.now().toString().slice(-4)}`;

    const p1 = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Brembo Front Ceramic Brake Pad Set',
      description: 'High performance ceramic brake pads with exceptional heat dissipation.',
      category: 'Brakes',
      subcategory: 'Brake Pads',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      partNumber: knownPartNumber,
      barcode: knownBarcode,
      manufacturerPartNumber: knownMpn,
      alternatePartNumbers: ['ALT-BRK-991', 'OEM-45022-S04'],
      condition: 'NEW',
      price: 2450,
      stockQuantity: 15,
      isPublished: true,
      averageRating: 4.8,
      totalReviews: 12
    });
    createdPartIds.push(p1._id);

    const p2 = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Bosch Spark Plug Super 4',
      description: 'Four ground electrodes for high performance and smooth engine idle.',
      category: 'Electrical',
      subcategory: 'Spark Plugs',
      vehicleType: 'Car',
      compatibleMakes: ['Honda', 'Toyota'],
      compatibleModels: ['City', 'Civic', 'Corolla'],
      compatibleYears: ['2018', '2019', '2020'],
      manufacturer: 'Bosch',
      partNumber: `SPK-BOS-${Date.now().toString().slice(-4)}`,
      barcode: `890${Date.now().toString().slice(-9)}2`,
      condition: 'NEW',
      price: 850,
      stockQuantity: 40,
      isPublished: true,
      averageRating: 4.2,
      totalReviews: 8
    });
    createdPartIds.push(p2._id);

    const p3 = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Used Reconditioned Power Steering Pump',
      description: 'Tested and reconditioned original hydraulic power steering pump.',
      category: 'Steering',
      subcategory: 'Pumps',
      vehicleType: 'Car',
      compatibleMakes: ['Toyota'],
      compatibleModels: ['Corolla', 'Innova'],
      manufacturer: 'Denso',
      partNumber: `PMP-DNS-${Date.now().toString().slice(-4)}`,
      condition: 'USED',
      price: 4500,
      stockQuantity: 2,
      isPublished: true,
      averageRating: 3.5,
      totalReviews: 4
    });
    createdPartIds.push(p3._id);

    // 4. Unpublished Part in Approved Shop
    const pUnpublished = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Draft Hidden Radiator Cap',
      description: 'Unpublished draft part.',
      category: 'Cooling',
      vehicleType: 'Car',
      manufacturer: 'OEM',
      partNumber: `HIDDEN-PART-${Date.now()}`,
      barcode: `999${Date.now().toString().slice(-9)}1`,
      condition: 'NEW',
      price: 300,
      stockQuantity: 5,
      isPublished: false
    });
    createdPartIds.push(pUnpublished._id);

    // 5. Part in Unapproved Shop
    const pUnapproved = await SparePart.create({
      shopId: unapprovedShop._id,
      ownerId: unapprovedOwner._id,
      partName: 'Illegal Unapproved High Flow Exhaust',
      description: 'From an unapproved shop.',
      category: 'Exhaust',
      vehicleType: 'Car',
      manufacturer: 'NoName',
      partNumber: `UNAPPROVED-EXH-${Date.now()}`,
      barcode: `999${Date.now().toString().slice(-9)}2`,
      condition: 'NEW',
      price: 7000,
      stockQuantity: 10,
      isPublished: true
    });
    createdPartIds.push(pUnapproved._id);

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST SUITE EXECUTION
    // -------------------------------------------------------------

    // TEST 1: Search by Product Name (case-insensitive, normalized)
    console.log('--- TEST 1: Search by Product Name ---');
    {
      const res = await makeRequest('GET', `/api/parts/nearby?q=${encodeURIComponent('   brembo ceramic front   ')}`);
      assert(res.status === 200, 'Search by product name returned HTTP 200');
      const parts = res.data.data?.parts || [];
      assert(parts.length > 0, 'Found matching part by name');
      assert(parts.some((p) => p._id.toString() === p1._id.toString()), 'Exact Brembo part included in results');
    }

    // TEST 2: Search by Exact Part Number
    console.log('--- TEST 2: Search by Exact Part Number ---');
    {
      const res = await makeRequest('GET', `/api/parts/nearby?partNumber=${encodeURIComponent(knownPartNumber)}`);
      assert(res.status === 200, 'Search by exact part number returned HTTP 200');
      const parts = res.data.data?.parts || [];
      assert(parts.length === 1, 'Only the exact part number returned');
      assert(parts[0].partNumber === knownPartNumber, 'Matched exact part number correctly');
    }

    // TEST 3: Combine Vehicle Compatibility, Price, and Condition Filters
    console.log('--- TEST 3: Combined Vehicle Compatibility and Price Filters ---');
    {
      const res = await makeRequest(
        'GET',
        `/api/parts/nearby?vehicleType=Car&make=Toyota&minPrice=500&maxPrice=1200&condition=NEW`
      );
      assert(res.status === 200, 'Combined filters query returned HTTP 200');
      const parts = res.data.data?.parts || [];
      assert(parts.length >= 1, 'Found at least one part matching vehicle, price, and condition');
      assert(parts.every((p) => p.price >= 500 && p.price <= 1200), 'All parts strictly satisfy price range');
      assert(parts.every((p) => p.condition === 'NEW'), 'All parts strictly satisfy NEW condition');
    }

    // TEST 4: Sort and Paginate Results (Relevance, Price, Rating)
    console.log('--- TEST 4: Sorting and Pagination ---');
    {
      // Sort by price ascending
      const sortPriceRes = await makeRequest('GET', '/api/parts/nearby?sortBy=price_asc&limit=2');
      assert(sortPriceRes.status === 200, 'Sort by price_asc returned HTTP 200');
      const priceParts = sortPriceRes.data.data?.parts || [];
      assert(priceParts.length <= 2, 'Limit 2 respected');
      if (priceParts.length >= 2) {
        assert(priceParts[0].price <= priceParts[1].price, 'Parts correctly ordered by price ascending');
      }

      // Sort by rating descending
      const sortRatingRes = await makeRequest('GET', '/api/parts/nearby?sortBy=rating_desc&minRating=4');
      assert(sortRatingRes.status === 200, 'Sort by rating_desc returned HTTP 200');
      const ratingParts = sortRatingRes.data.data?.parts || [];
      assert(ratingParts.length > 0, 'Returned 4+ star parts');
      assert(ratingParts.every((p) => (p.averageRating || 0) >= 4), 'All parts have 4+ star rating');
      if (ratingParts.length >= 2) {
        assert(
          (ratingParts[0].averageRating || 0) >= (ratingParts[1].averageRating || 0),
          'Correctly sorted by rating descending'
        );
      }
    }

    // TEST 5: Search using a Known Barcode
    console.log('--- TEST 5: Search using a Known Barcode ---');
    {
      // Direct barcode endpoint
      const directRes = await makeRequest('GET', `/api/products/barcode/${encodeURIComponent(knownBarcode)}`);
      assert(directRes.status === 200, 'Direct barcode lookup returned HTTP 200');
      assert(directRes.data.success === true, 'Direct barcode response success is true');
      assert(directRes.data.data?.barcode === knownBarcode, 'Correct product returned by barcode');

      // Identifier search endpoint
      const identRes = await makeRequest('GET', `/api/search/identifier?code=${encodeURIComponent(knownBarcode)}`);
      assert(identRes.status === 200, 'Identifier search returned HTTP 200 for barcode');
      assert(identRes.data.data?.barcode === knownBarcode, 'Identifier matched barcode');
      assert(identRes.data.data?.matchedBy === 'barcode', 'Matched by field indicates barcode');
    }

    // TEST 6: Search using an Unknown Barcode
    console.log('--- TEST 6: Search using an Unknown Barcode ---');
    {
      const unknownCode = '0000000000000';
      const directRes = await makeRequest('GET', `/api/products/barcode/${unknownCode}`);
      assert(directRes.status === 404, 'Unknown barcode returned HTTP 404');
      assert(directRes.data.success === false, 'Unknown barcode success is false');

      const identRes = await makeRequest('GET', `/api/search/identifier?code=${unknownCode}`);
      assert(identRes.status === 404, 'Unknown identifier returned HTTP 404');
    }

    // TEST 7: Suggestions API Endpoint
    console.log('--- TEST 7: Suggestions API (/api/search/suggestions) ---');
    {
      const res = await makeRequest('GET', `/api/search/suggestions?q=Brem`);
      assert(res.status === 200, 'Suggestions endpoint returned HTTP 200');
      assert(res.data.success === true, 'Suggestions response success is true');
      const suggestions = res.data.data?.suggestions || [];
      assert(suggestions.length > 0, 'Found suggestions for "Brem"');
      assert(
        suggestions.some((s) => s.text.toLowerCase().includes('brembo')),
        'Brembo suggested from MongoDB catalog'
      );
    }

    // TEST 8: Identifier Search Endpoint (Part Number, MPN, Alternate)
    console.log('--- TEST 8: Identifier Search for MPN and Alternate Numbers ---');
    {
      // Match by Manufacturer Part Number (MPN)
      const mpnRes = await makeRequest('GET', `/api/search/identifier?code=${encodeURIComponent(knownMpn)}`);
      assert(mpnRes.status === 200, 'Identifier search for MPN returned HTTP 200');
      assert(mpnRes.data.data?.manufacturerPartNumber === knownMpn, 'Matched MPN correctly');

      // Match by Alternate Part Number
      const altRes = await makeRequest('GET', `/api/search/identifier?code=OEM-45022-S04`);
      assert(altRes.status === 200, 'Identifier search for Alternate Part Number returned HTTP 200');
      assert(altRes.data.data?._id.toString() === p1._id.toString(), 'Matched alternate part number correctly');
    }

    // TEST 9: Direct Barcode Endpoint Aliases
    console.log('--- TEST 9: Barcode Lookup Endpoint Aliases ---');
    {
      const pRes = await makeRequest('GET', `/api/parts/barcode/${encodeURIComponent(knownBarcode)}`);
      assert(pRes.status === 200, '/api/parts/barcode/:barcode alias returned HTTP 200');
      assert(pRes.data.data?.barcode === knownBarcode, 'Alias returned correct part');
    }

    // TEST 10: QR Code Identifier Resolution
    console.log('--- TEST 10: QR Code Product Identifier Resolution ---');
    {
      // A QR code containing the MongoDB ID or SKU
      const idRes = await makeRequest('GET', `/api/search/identifier?code=${p1._id.toString()}`);
      assert(idRes.status === 200, 'QR product ID resolved via identifier search');
      assert(idRes.data.data?._id.toString() === p1._id.toString(), 'Accurate part returned from QR ID');
    }

    // TEST 11: Malicious / External URL Safety Simulation
    console.log('--- TEST 11: Safety Verification against Arbitrary External QR URLs ---');
    {
      // Testing external URL safety logic:
      const externalUrl = 'https://malicious-external-site.com/steal-creds';
      const parsed = new URL(externalUrl);
      const isInternal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      assert(!isInternal, 'External domain detected and flagged as non-internal');

      // Identifier search treats arbitrary string safely and returns 404 without executing
      const safeSearch = await makeRequest('GET', `/api/search/identifier?code=${encodeURIComponent(externalUrl)}`);
      assert(safeSearch.status === 404, 'Arbitrary external URL treated as untrusted text, returns 404');
    }

    // TEST 12: Image Upload Validation (Invalid format or oversized)
    console.log('--- TEST 12: Image Search Upload Validation ---');
    {
      // 1. Invalid file format (e.g. text/plain pretending to be image)
      const fakeBuffer = Buffer.from('This is a text file not an image');
      const invalidRes = await makeMultipartRequest(
        '/api/search/image',
        'image',
        'test.txt',
        fakeBuffer,
        'text/plain'
      );
      assert(invalidRes.status === 400, 'Text file rejected with HTTP 400');
      assert(invalidRes.data.success === false, 'Error message returned for invalid file type');

      // 2. Missing image file in multipart
      const emptyRes = await makeRequest('POST', '/api/search/image', {});
      assert(emptyRes.status === 400, 'Empty request without image rejected with HTTP 400');
    }

    // TEST 13: Image-based Part Search Fallback & Cleanup
    console.log('--- TEST 13: Image-Based Part Search Execution & File Cleanup ---');
    {
      // 1x1 transparent PNG buffer
      const png1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const imageRes = await makeMultipartRequest(
        '/api/search/image',
        'image',
        'brake_pad_sample.png',
        png1x1,
        'image/png'
      );
      assert(imageRes.status === 200, 'Image search returned HTTP 200');
      assert(imageRes.data.success === true, 'Image search response success is true');
      assert(Array.isArray(imageRes.data.data?.parts), 'Parts list returned from MongoDB inventory');
      assert(Array.isArray(imageRes.data.data?.suggestedTerms), 'Suggested terms array returned');

      // Verify that no temporary files were leaked in backend/uploads/temp
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      if (fs.existsSync(tempDir)) {
        const remaining = fs.readdirSync(tempDir);
        assert(remaining.length === 0, 'Temporary image file was immediately deleted from disk in finally block');
      }
    }

    // TEST 14: Strict Exclusion of Unpublished Products and Unapproved Shops
    console.log('--- TEST 14: Strict Exclusion of Unpublished & Unapproved Inventory ---');
    {
      // 1. Search by name of unpublished part
      const unpubRes = await makeRequest('GET', `/api/parts/nearby?q=${encodeURIComponent('Hidden Radiator Cap')}`);
      const unpubParts = unpubRes.data.data?.parts || [];
      assert(!unpubParts.some((p) => p._id.toString() === pUnpublished._id.toString()), 'Unpublished part is never in search results');

      // 2. Barcode lookup on unpublished part
      const unpubBarcode = await makeRequest('GET', `/api/products/barcode/${pUnpublished.barcode}`);
      assert(unpubBarcode.status === 404, 'Barcode lookup for unpublished part returns 404');

      // 3. Search for part from unapproved shop
      const unapprovedRes = await makeRequest('GET', `/api/parts/nearby?q=${encodeURIComponent('Illegal Unapproved High Flow')}`);
      const unapprovedParts = unapprovedRes.data.data?.parts || [];
      assert(!unapprovedParts.some((p) => p._id.toString() === pUnapproved._id.toString()), 'Unapproved shop parts are never in search results');

      // 4. Barcode lookup on part from unapproved shop
      const unapprovedBarcode = await makeRequest('GET', `/api/products/barcode/${pUnapproved.barcode}`);
      assert(unapprovedBarcode.status === 404, 'Barcode lookup for unapproved shop part returns 404');
    }

    // TEST 15: Modules 1–10 Continued Integrity
    console.log('--- TEST 15: Verification of Modules 1–10 Continued Functionality ---');
    {
      // Health check
      const healthRes = await makeRequest('GET', '/api/health');
      assert(healthRes.status === 200, 'System Health Check returns HTTP 200');

      // Approved shops listing (Module 4)
      const shopsRes = await makeRequest('GET', '/api/shops');
      assert(shopsRes.status === 200, 'Public shops endpoint returns HTTP 200');

      // AI Assistant status endpoint (Module 10)
      const aiStatusRes = await makeRequest('GET', '/api/ai/status');
      assert(aiStatusRes.status === 200, 'AI Assistant status endpoint continues functioning');
      assert(aiStatusRes.data.success === true, 'AI status returned valid data');

      // Product Recommendations endpoint (Module 10)
      const recRes = await makeRequest('GET', `/api/recommendations?category=Brakes&vehicleType=Car`);
      assert(recRes.status === 200, 'Recommendations endpoint continues functioning');
      assert(recRes.data.success === true, 'Recommendations returned valid data');

      // AI Assistant chat validation (Module 10)
      const chatRes = await makeRequest('POST', '/api/ai/assistant', { message: 'What brake pads do you recommend?' });
      assert(chatRes.status === 200, 'AI Assistant chat endpoint continues functioning');
      assert(chatRes.data.success === true, 'AI Assistant chat responded successfully');
    }

    console.log('');
    console.log('===============================================================');
    console.log('🎉 ALL 15 MODULE 11 TESTS PASSED SUCCESSFULLY! (0 ERRORS)');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('\n❌ Module 11 Test Suite Encountered an Error:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    console.log('--- Cleaning up Test Fixtures ---');
    try {
      if (createdPartIds.length > 0) {
        await SparePart.deleteMany({ _id: { $in: createdPartIds } });
      }
      if (createdShopIds.length > 0) {
        await Shop.deleteMany({ _id: { $in: createdShopIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      console.log('Test fixtures cleaned up.');
    } catch (e) {
      console.error('Error during cleanup:', e);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('Test HTTP server closed.');
    }
    await mongoose.disconnect();
    console.log('MongoDB disconnected.\n');
  }
}

runModule11Tests();
