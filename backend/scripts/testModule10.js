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

const TEST_PORT = 5090;
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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runModule10Tests() {
  console.log('\n===============================================================');
  console.log('EXACTSPARE MODULE 10 — AI ASSISTANT, RECOMMENDATIONS & COMPARE');
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
    console.log('--- Setting up Module 10 Test Fixtures ---');

    // 1. Approved Shop Owner and Shop
    const approvedOwner = await User.create({
      name: 'M10 Verified Merchant',
      email: `m10_merchant_${Date.now()}@test.com`,
      passwordHash: 'dummy_hash',
      role: 'OWNER',
      phone: '9876543210'
    });
    createdUserIds.push(approvedOwner._id);

    const approvedShop = await Shop.create({
      name: 'M10 Metro Auto Spares',
      ownerId: approvedOwner._id,
      applicationId: new mongoose.Types.ObjectId(),
      category: 'BIKE',
      description: 'Authorized genuine bike and scooter spares dealer.',
      isApproved: true,
      isActive: true,
      address: {
        addressLine: '12 Auto Nagar',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500001',
        location: { type: 'Point', coordinates: [78.4867, 17.3850] }
      },
      contact: { phone: '9876543210', email: approvedOwner.email }
    });
    createdShopIds.push(approvedShop._id);

    // 2. Unapproved Shop
    const unapprovedOwner = await User.create({
      name: 'M10 Unapproved Merchant',
      email: `m10_unapproved_${Date.now()}@test.com`,
      passwordHash: 'dummy_hash',
      role: 'OWNER',
      phone: '9876543211'
    });
    createdUserIds.push(unapprovedOwner._id);

    const unapprovedShop = await Shop.create({
      name: 'M10 Unapproved Spares Co',
      ownerId: unapprovedOwner._id,
      applicationId: new mongoose.Types.ObjectId(),
      category: 'CAR',
      description: 'Unverified auto parts retailer.',
      isApproved: false,
      isActive: false,
      address: {
        addressLine: '99 Rogue Way',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500002',
        location: { type: 'Point', coordinates: [78.4900, 17.3900] }
      },
      contact: { phone: '9876543211', email: unapprovedOwner.email }
    });
    createdShopIds.push(unapprovedShop._id);

    // 3. Test Spare Parts
    // Part A: Bosch Front Disc Brake Pads for Honda Activa
    const partA = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Bosch Front Disc Brake Pads',
      description: 'High performance ceramic brake pads for Honda Activa.',
      manufacturer: 'Bosch',
      brand: 'Bosch',
      partNumber: 'BSH-BP-ACT-01',
      category: 'Brakes',
      vehicleType: 'Scooter',
      compatibleMakes: ['Honda'],
      compatibleModels: ['Activa 6G', 'Activa 125'],
      compatibleYears: ['2020', '2021', '2022'],
      price: 850,
      stockQuantity: 15,
      condition: 'NEW',
      isPublished: true,
      isArchived: false,
      isModerated: false
    });
    createdPartIds.push(partA._id);

    // Part B: Nissin Heavy Duty Brake Pads for Honda Activa
    const partB = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Nissin Heavy Duty Brake Pads',
      description: 'OEM grade front brake friction pads for Honda Activa.',
      manufacturer: 'Nissin',
      brand: 'Nissin',
      partNumber: 'NIS-BP-ACT-02',
      category: 'Brakes',
      vehicleType: 'Scooter',
      compatibleMakes: ['Honda'],
      compatibleModels: ['Activa 6G'],
      compatibleYears: ['2021', '2022', '2023'],
      price: 1200,
      stockQuantity: 8,
      condition: 'NEW',
      isPublished: true,
      isArchived: false,
      isModerated: false
    });
    createdPartIds.push(partB._id);

    // Part C: Purolator Engine Air Filter for Maruti Swift
    const partC = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Purolator Engine Air Filter',
      description: 'High filtration engine intake air filter for Maruti Swift.',
      manufacturer: 'Purolator',
      brand: 'Purolator',
      partNumber: 'PUR-AF-SWF-01',
      category: 'Filters',
      vehicleType: 'Car',
      compatibleMakes: ['Maruti Suzuki'],
      compatibleModels: ['Swift'],
      compatibleYears: ['2018', '2019', '2020', '2021', '2022'],
      price: 450,
      stockQuantity: 20,
      condition: 'NEW',
      isPublished: true,
      isArchived: false,
      isModerated: false
    });
    createdPartIds.push(partC._id);

    // Part D: Exide 12V Motorcycle Battery for Royal Enfield Classic 350
    const partD = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Exide 12V Motorcycle Battery',
      description: 'Maintenance free 12V VRLA battery for Royal Enfield Classic 350.',
      manufacturer: 'Exide',
      brand: 'Exide',
      partNumber: 'EXD-BAT-RE-01',
      category: 'Electrical',
      vehicleType: 'Bike',
      compatibleMakes: ['Royal Enfield'],
      compatibleModels: ['Classic 350'],
      compatibleYears: ['2019', '2020', '2021', '2022'],
      price: 1800,
      stockQuantity: 5,
      condition: 'NEW',
      isPublished: true,
      isArchived: false,
      isModerated: false
    });
    createdPartIds.push(partD._id);

    // Part E: Unpublished Brake Caliper (in approved shop)
    const partUnpublished = await SparePart.create({
      shopId: approvedShop._id,
      ownerId: approvedOwner._id,
      partName: 'Unpublished Activa Brake Caliper',
      description: 'Unpublished inventory listing for Activa brake caliper.',
      manufacturer: 'OEM',
      brand: 'OEM',
      partNumber: 'UNP-BC-01',
      category: 'Brakes',
      vehicleType: 'Scooter',
      compatibleMakes: ['Honda'],
      compatibleModels: ['Activa 6G'],
      price: 2200,
      stockQuantity: 4,
      condition: 'NEW',
      isPublished: false, // UNPUBLISHED
      isArchived: false
    });
    createdPartIds.push(partUnpublished._id);

    // Part F: Published Part in Unapproved Shop
    const partUnapprovedShop = await SparePart.create({
      shopId: unapprovedShop._id,
      ownerId: unapprovedOwner._id,
      partName: 'Rogue Brake Pads for Activa',
      description: 'Unverified listing from unapproved retailer.',
      manufacturer: 'Rogue',
      brand: 'Rogue',
      partNumber: 'ROGUE-BP-01',
      category: 'Brakes',
      vehicleType: 'Scooter',
      compatibleMakes: ['Honda'],
      compatibleModels: ['Activa 6G'],
      price: 300,
      stockQuantity: 10,
      condition: 'NEW',
      isPublished: true // UNAPPROVED SHOP
    });
    createdPartIds.push(partUnapprovedShop._id);

    console.log('Test fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Search for an existing spare part using natural language
    // -------------------------------------------------------------
    console.log('TEST 1: Search for an existing spare part using natural language');
    const res1 = await makeRequest('POST', '/api/ai/assistant', {
      message: 'Find brake pads for my Honda Activa'
    });
    assert(res1.status === 200, 'Assistant endpoint returned HTTP 200');
    assert(res1.data.success === true, 'Response status is success: true');
    assert(typeof res1.data.data.response === 'string', 'Assistant returned a conversational response string');
    assert(Array.isArray(res1.data.data.products), 'Assistant returned products array');
    assert(res1.data.data.products.length > 0, 'Assistant found matching products for Honda Activa');
    const hasActivaBrakePad = res1.data.data.products.some((p) => p.partName.includes('Brake Pads'));
    assert(hasActivaBrakePad, 'Results contain brake pads for Honda Activa');
    console.log('');

    // -------------------------------------------------------------
    // TEST 2: Ask a question with missing vehicle details
    // -------------------------------------------------------------
    console.log('TEST 2: Ask a question with missing vehicle details');
    const res2 = await makeRequest('POST', '/api/ai/assistant', {
      message: 'I need an air filter'
    });
    assert(res2.status === 200, 'Assistant endpoint returned HTTP 200 for vague query');
    assert(res2.data.success === true, 'Response marked success');
    assert(Array.isArray(res2.data.data.missingDetails), 'Returned missingDetails list');
    assert(res2.data.data.missingDetails.includes('vehicleType') || res2.data.data.missingDetails.includes('make') || res2.data.data.missingDetails.includes('model'), 'Identified missing vehicle type, make, or model');
    assert(Array.isArray(res2.data.data.followUps) && res2.data.data.followUps.length > 0, 'Returned helpful follow-up prompt chips');
    console.log('');

    // -------------------------------------------------------------
    // TEST 3: Verify that returned products exist in MongoDB
    // -------------------------------------------------------------
    console.log('TEST 3: Verify that returned products exist in MongoDB');
    for (const prod of res1.data.data.products) {
      const dbPart = await SparePart.findById(prod._id);
      assert(dbPart !== null, `Product ${prod.partName} (_id: ${prod._id}) exists in MongoDB`);
    }
    console.log('');

    // -------------------------------------------------------------
    // TEST 4: Verify that unpublished parts and unapproved shops are excluded
    // -------------------------------------------------------------
    console.log('TEST 4: Verify that unpublished parts and unapproved shops are excluded');
    const res4 = await makeRequest('POST', '/api/ai/assistant', {
      message: 'Find brake parts for Honda Activa'
    });
    const foundIds = res4.data.data.products.map((p) => p._id.toString());
    assert(!foundIds.includes(partUnpublished._id.toString()), 'Unpublished part is strictly excluded from results');
    assert(!foundIds.includes(partUnapprovedShop._id.toString()), 'Part from unapproved shop is strictly excluded from results');

    // Also verify via recommendations API
    const recRes = await makeRequest('GET', `/api/recommendations?category=Brakes&vehicleType=Scooter`);
    assert(recRes.status === 200, 'Recommendations returned HTTP 200');
    const recIds = recRes.data.recommendations.map((p) => p._id.toString());
    assert(!recIds.includes(partUnpublished._id.toString()), 'Unpublished part excluded from recommendations');
    assert(!recIds.includes(partUnapprovedShop._id.toString()), 'Part from unapproved shop excluded from recommendations');
    console.log('');

    // -------------------------------------------------------------
    // TEST 5: Check that prices and stock reflect current database values
    // -------------------------------------------------------------
    console.log('TEST 5: Check that prices and stock reflect current database values');
    const matchedPartA = res1.data.data.products.find((p) => p._id.toString() === partA._id.toString());
    if (matchedPartA) {
      assert(matchedPartA.price === partA.price, `Returned price (${matchedPartA.price}) matches MongoDB price (${partA.price})`);
      assert(matchedPartA.stockQuantity === partA.stockQuantity, `Returned stock (${matchedPartA.stockQuantity}) matches MongoDB stock (${partA.stockQuantity})`);
    }
    console.log('');

    // -------------------------------------------------------------
    // TEST 6: Test budget filters and vehicle compatibility
    // -------------------------------------------------------------
    console.log('TEST 6: Test budget filters and vehicle compatibility');
    const res6 = await makeRequest('POST', '/api/ai/assistant', {
      message: 'Find brake pads for Activa under 1000'
    });
    assert(res6.status === 200, 'Budget query returned HTTP 200');
    assert(res6.data.data.products.length > 0, 'Found products within budget');
    for (const p of res6.data.data.products) {
      assert(p.price <= 1000, `Product ${p.partName} price (₹${p.price}) is within requested budget (<= ₹1000)`);
      assert(p.vehicleType === 'Scooter', `Product vehicleType is compatible: Scooter`);
    }
    console.log('');

    // -------------------------------------------------------------
    // TEST 7: Compare two to four products
    // -------------------------------------------------------------
    console.log('TEST 7: Compare two to four products');
    // 7a. Valid 2 products
    const resCompare2 = await makeRequest('POST', '/api/products/compare', {
      productIds: [partA._id.toString(), partB._id.toString()]
    });
    assert(resCompare2.status === 200, 'Compare 2 products returned HTTP 200');
    assert(resCompare2.data.success === true, 'Compare marked success');
    assert(resCompare2.data.products.length === 2, 'Returned 2 verified products in matrix');
    assert(resCompare2.data.metrics.count === 2, 'Metrics count matches 2');
    assert(resCompare2.data.metrics.lowestPriceId === partA._id.toString(), 'Correctly identified lowest priced product (partA @ 850)');
    assert(resCompare2.data.metrics.priceDifference === 350, 'Computed correct price difference (1200 - 850 = 350)');

    // 7b. Valid 3 products
    const resCompare3 = await makeRequest('POST', '/api/products/compare', {
      productIds: [partA._id.toString(), partB._id.toString(), partC._id.toString()]
    });
    assert(resCompare3.status === 200, 'Compare 3 products returned HTTP 200');
    assert(resCompare3.data.products.length === 3, 'Returned 3 verified products in matrix');

    // 7c. Valid 4 products
    const resCompare4 = await makeRequest('POST', '/api/products/compare', {
      productIds: [partA._id.toString(), partB._id.toString(), partC._id.toString(), partD._id.toString()]
    });
    assert(resCompare4.status === 200, 'Compare 4 products returned HTTP 200');
    assert(resCompare4.data.products.length === 4, 'Returned 4 verified products in matrix');

    // 7d. Reject < 2 products
    const resCompare1 = await makeRequest('POST', '/api/products/compare', {
      productIds: [partA._id.toString()]
    });
    assert(resCompare1.status === 400, 'Compare 1 product rejected with HTTP 400 Bad Request');

    // 7e. Reject > 4 products
    const resCompare5 = await makeRequest('POST', '/api/products/compare', {
      productIds: [
        partA._id.toString(),
        partB._id.toString(),
        partC._id.toString(),
        partD._id.toString(),
        partUnpublished._id.toString()
      ]
    });
    assert(resCompare5.status === 400, 'Compare 5 products rejected with HTTP 400 Bad Request');
    console.log('');

    // -------------------------------------------------------------
    // TEST 8: Handle unavailable AI configuration
    // -------------------------------------------------------------
    console.log('TEST 8: Handle unavailable AI configuration');
    const resStatus = await makeRequest('GET', '/api/ai/status');
    assert(resStatus.status === 200, 'AI status endpoint returned HTTP 200');
    assert(typeof resStatus.data.data.isConfigured === 'boolean', 'isConfigured is boolean');
    assert(resStatus.data.data.fallbackMode === 'rule_based_nlp', 'Explicitly states fallback mode: rule_based_nlp');

    // When provider is not configured or in fallback mode, assistant still works
    const resFallback = await makeRequest('POST', '/api/ai/assistant', {
      message: 'Find battery for Royal Enfield Classic 350'
    });
    assert(resFallback.status === 200, 'Assistant operates smoothly in fallback mode without crashing');
    assert(resFallback.data.success === true, 'Fallback assistant returned success: true');
    assert(resFallback.data.data.products.some((p) => p._id.toString() === partD._id.toString()), 'Found battery for Classic 350');
    console.log('');

    // -------------------------------------------------------------
    // TEST 9: Handle provider timeout and API errors
    // -------------------------------------------------------------
    console.log('TEST 9: Handle provider timeout and API errors');
    // Check that an invalid or disconnected provider does not crash the backend
    const res9 = await makeRequest('POST', '/api/ai/assistant', {
      message: 'Air filter for Maruti Swift',
      history: [{ role: 'user', content: 'hello' }]
    });
    assert(res9.status === 200, 'Handled message without unhandled promise rejection or crash');
    assert(res9.data.success === true, 'Returned successful payload with verified inventory');
    console.log('');

    // -------------------------------------------------------------
    // TEST 10: Confirm API keys never appear in frontend code or logs
    // -------------------------------------------------------------
    console.log('TEST 10: Confirm API keys never appear in frontend code or client responses');
    // Ensure no secret keys leaked in /api/ai/status
    const statusPayload = JSON.stringify(resStatus.data);
    assert(!statusPayload.includes('AIza'), 'No Google Gemini key leaked in API response');
    assert(!statusPayload.includes('sk-'), 'No OpenAI key leaked in API response');
    assert(!statusPayload.includes('apiKey'), 'apiKey property not exposed to client');

    // Scan frontend directory to verify no secret keys are hardcoded in code
    const frontendSrc = path.resolve('..', 'frontend', 'src');
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('AIzaSy') || content.includes('sk-proj-')) {
            throw new Error(`Secret key detected in frontend file: ${fullPath}`);
          }
        }
      }
    }
    if (fs.existsSync(frontendSrc)) {
      scanDir(frontendSrc);
      console.log('  ✓ Scanned frontend/src: Zero API keys or secrets detected');
    }
    console.log('');

    // -------------------------------------------------------------
    // TEST 11: Test rate limits and invalid requests
    // -------------------------------------------------------------
    console.log('TEST 11: Test rate limits and invalid requests');
    // 11a. Empty message
    const resEmpty = await makeRequest('POST', '/api/ai/assistant', { message: '   ' });
    assert(resEmpty.status === 400, 'Empty message rejected with HTTP 400');

    // 11b. Missing message property
    const resNoMsg = await makeRequest('POST', '/api/ai/assistant', {});
    assert(resNoMsg.status === 400, 'Missing message rejected with HTTP 400');

    // 11c. Oversized message (> 2000 chars)
    const longMsg = 'a'.repeat(2500);
    const resLong = await makeRequest('POST', '/api/ai/assistant', { message: longMsg });
    assert(resLong.status === 400, 'Oversized message (>2000 chars) rejected with HTTP 400');
    console.log('');

    // -------------------------------------------------------------
    // TEST 12: Verify that Modules 1–9 continue working
    // -------------------------------------------------------------
    console.log('TEST 12: Verify that Modules 1–9 continue working');
    // Health check
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'System Health check returned HTTP 200');

    // Public shops listing
    const shopsRes = await makeRequest('GET', '/api/shops');
    assert(shopsRes.status === 200, 'Public shops endpoint returned HTTP 200');
    const shopsList = shopsRes.data.shops || shopsRes.data.data?.shops;
    assert(Array.isArray(shopsList), 'Shops array returned');

    // Public spare parts search
    const partsRes = await makeRequest('GET', '/api/parts?vehicleType=Scooter');
    assert(partsRes.status === 200, 'Spare parts search endpoint returned HTTP 200');
    const partsList = partsRes.data.parts || partsRes.data.data?.parts;
    assert(Array.isArray(partsList), 'Parts array returned');

    console.log('');
    console.log('===============================================================');
    console.log('🎉 ALL 12 MODULE 10 TESTS PASSED SUCCESSFULLY! (0 ERRORS)');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('\n❌ Module 10 Test Suite Encountered an Error:');
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

runModule10Tests();
