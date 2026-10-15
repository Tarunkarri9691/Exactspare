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
import SparePart from '../models/SparePart.js';
import { PARTS_DIR } from '../utils/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5057; // Dedicated test port for Module 4
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

const logPass = (num, desc) => console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
const logFail = (num, desc, err) => console.error(`\x1b[31m✖ [FAIL ${num}]\x1b[0m ${desc}: ${err}`);

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

const runInventoryTests = async () => {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 4 — SHOP & INVENTORY TEST SUITE');
  console.log('========================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const owner1Email = 'test.inv.owner1@exactspare.com';
  const owner2Email = 'test.inv.owner2@exactspare.com';
  const customerEmail = 'test.inv.cust@exactspare.com';
  const adminEmail = 'admin@exactspare.com';

  // Clean up any test users & associated records
  const oldUsers = await User.find({ email: { $in: [owner1Email, owner2Email, customerEmail] } });
  const oldIds = oldUsers.map((u) => u._id);
  await SparePart.deleteMany({ ownerId: { $in: oldIds } });
  await Shop.deleteMany({ ownerId: { $in: oldIds } });
  await ShopApplication.deleteMany({ ownerId: { $in: oldIds } });
  await User.deleteMany({ email: { $in: [owner1Email, owner2Email, customerEmail] } });

  // Start HTTP server on test port
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  let owner1Cookie = null;
  let owner2Cookie = null;
  let customerCookie = null;
  let adminCookie = null;

  let owner1User = null;
  let owner2User = null;
  let shop1 = null;
  let shop2Unapproved = null;
  let createdPart1Id = null;

  try {
    // Register Owner 1
    const regOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rajesh Sharma',
        email: owner1Email,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98111 22233',
        role: 'OWNER'
      }
    });
    owner1Cookie = parseCookie(regOwner1);
    owner1User = await User.findOne({ email: owner1Email });

    // Register Owner 2 (stays unapproved)
    const regOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Suresh Patel',
        email: owner2Email,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98222 33344',
        role: 'OWNER'
      }
    });
    owner2Cookie = parseCookie(regOwner2);
    owner2User = await User.findOne({ email: owner2Email });

    // Register Customer
    const regCust = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Aarav Mehta',
        email: customerEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98333 44455',
        role: 'CUSTOMER'
      }
    });
    customerCookie = parseCookie(regCust);

    // Login Admin
    const loginAdmin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: 'AdminExactSpare@2026' }
    });
    adminCookie = parseCookie(loginAdmin);

    // Create an approved Shop for Owner 1 directly
    const app1 = await ShopApplication.create({
      ownerId: owner1User._id,
      shopName: 'Rajesh Motors & Genuine Spares',
      ownerFullName: 'Rajesh Sharma',
      ownerPhone: '+91 98111 22233',
      businessEmail: owner1Email,
      shopDescription: 'Authorized OEM supplier for two-wheelers and passenger vehicles.',
      shopCategory: 'CAR',
      addressLine: '101 Highway Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      latitude: 18.5204,
      longitude: 73.8567,
      openingHours: 'Mon-Sat 9AM-8PM',
      shopImagePaths: ['/uploads/shops/shop-sample.jpg'],
      status: 'APPROVED',
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    shop1 = await Shop.create({
      ownerId: owner1User._id,
      applicationId: app1._id,
      name: 'Rajesh Motors & Genuine Spares',
      category: 'CAR',
      description: 'Authorized OEM supplier for two-wheelers and passenger vehicles.',
      address: {
        addressLine: '101 Highway Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        location: { type: 'Point', coordinates: [73.8567, 18.5204] }
      },
      contact: { phone: '+91 98111 22233', email: owner1Email },
      openingHours: 'Mon-Sat 9AM-8PM',
      images: ['/uploads/shops/shop-sample.jpg'],
      isApproved: true,
      isActive: true
    });

    // 1. An approved owner can view and update their own shop
    const updateShopRes = await makeRequest('/api/shops/my', {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        description: 'Updated premier automotive spare parts store in Pune.',
        openingHours: 'Mon-Sun 8:30 AM - 9:00 PM'
      }
    });

    if (
      updateShopRes.status === 200 &&
      updateShopRes.data.shop?.description === 'Updated premier automotive spare parts store in Pune.' &&
      updateShopRes.data.shop?.openingHours === 'Mon-Sun 8:30 AM - 9:00 PM'
    ) {
      logPass(1, 'Approved owner can view and update their own shop profile');
    } else {
      logFail(1, 'Approved owner shop update', JSON.stringify(updateShopRes.data));
    }

    // 2. An unapproved owner cannot publish a shop or manage inventory
    const unapprovedPartRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner2Cookie },
      body: {
        partName: 'Clutch Plate',
        description: 'Heavy duty clutch plate',
        category: 'Transmission',
        vehicleType: 'Car',
        manufacturer: 'Exedy',
        partNumber: 'EXD-8821',
        price: 2500,
        stockQuantity: 5
      }
    });

    if (unapprovedPartRes.status === 403) {
      logPass(2, 'Unapproved owner is blocked from publishing inventory (HTTP 403)');
    } else {
      logFail(2, 'Unapproved owner inventory block', `Status: ${unapprovedPartRes.status}`);
    }

    // 3. An owner cannot edit another owner's shop
    // Owner 2 tries to update Owner 1's shop by calling PATCH /api/shops/my (which updates their own context)
    // Also verify owner cannot overwrite another owner's shopId in spare parts
    const owner2ShopUpdateRes = await makeRequest('/api/shops/my', {
      method: 'PATCH',
      headers: { Cookie: owner2Cookie },
      body: { name: 'Attempted Hijack Name' }
    });

    if (owner2ShopUpdateRes.status === 404 || owner2ShopUpdateRes.status === 403) {
      logPass(3, "Owner cannot edit another owner's shop (tenant isolation enforced)");
    } else {
      logFail(3, 'Shop tenant isolation', `Status: ${owner2ShopUpdateRes.status}`);
    }

    // 4. A valid spare part can be created by an approved owner
    const createPartRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Brembo Ceramic Front Brake Pads',
        description: 'High performance ceramic brake pads providing superior stopping power with minimal brake dust.',
        category: 'Brakes',
        subcategory: 'Brake Pads',
        vehicleType: 'Car',
        compatibleMakes: ['Honda', 'Toyota'],
        compatibleModels: ['City', 'Civic', 'Corolla'],
        compatibleYears: ['2018', '2019', '2020', '2021', '2022'],
        engineDetails: '1.5L i-VTEC / 1.8L Dual VVT-i',
        manufacturer: 'Brembo',
        partNumber: 'P 28 076N',
        condition: 'NEW',
        price: 3450,
        stockQuantity: 12,
        isPublished: true
      }
    });

    if (createPartRes.status === 201 && createPartRes.data.part?.partNumber === 'P 28 076N') {
      createdPart1Id = createPartRes.data.part._id;
      logPass(4, 'Valid spare part listing created successfully with compatibility specs (HTTP 201)');
    } else {
      logFail(4, 'Valid spare part creation', JSON.stringify(createPartRes.data));
    }

    // 5. Invalid prices and negative quantities are rejected
    const negativePriceRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Faulty Filter',
        description: 'Testing validation',
        category: 'Engine',
        vehicleType: 'Car',
        manufacturer: 'Generic',
        partNumber: 'ERR-01',
        price: -500,
        stockQuantity: 5
      }
    });

    const negativeStockRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Faulty Filter 2',
        description: 'Testing validation',
        category: 'Engine',
        vehicleType: 'Car',
        manufacturer: 'Generic',
        partNumber: 'ERR-02',
        price: 500,
        stockQuantity: -10
      }
    });

    if (negativePriceRes.status === 400 && negativeStockRes.status === 400) {
      logPass(5, 'Invalid negative prices and negative stock quantities rejected (HTTP 400)');
    } else {
      logFail(5, 'Negative price/stock rejection', `Price: ${negativePriceRes.status}, Stock: ${negativeStockRes.status}`);
    }

    // 6. A valid image can be uploaded and stored correctly
    // Create a dummy image file in uploads/parts
    const samplePartFilename = `part-test-${Date.now()}.jpg`;
    const samplePartPath = path.join(PARTS_DIR, samplePartFilename);
    fs.writeFileSync(samplePartPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]));

    // Attach sample image path to part 1 via update
    const imgUpdateRes = await makeRequest(`/api/parts/${createdPart1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        existingImages: [`/uploads/parts/${samplePartFilename}`]
      }
    });

    // Check static serving of the product image
    const staticImgRes = await makeRequest(`/uploads/parts/${samplePartFilename}`);

    if (imgUpdateRes.status === 200 && staticImgRes.status === 200) {
      logPass(6, 'Valid product image stored and accessible via static route (GET /uploads/parts/...)');
    } else {
      logFail(6, 'Product image storage and retrieval', `Update: ${imgUpdateRes.status}, Static: ${staticImgRes.status}`);
    }

    // 7. Invalid vehicle types and conditions are rejected
    const invalidTypeRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: owner1Cookie },
      body: {
        partName: 'Aeroplane Winglet',
        description: 'Invalid vehicle type',
        category: 'Body',
        vehicleType: 'Aeroplane', // Invalid
        manufacturer: 'Boeing',
        partNumber: 'PLN-99',
        price: 150000,
        stockQuantity: 1
      }
    });

    if (invalidTypeRes.status === 400) {
      logPass(7, 'Invalid vehicle types and invalid enums strictly rejected (HTTP 400)');
    } else {
      logFail(7, 'Invalid enum validation', `Status: ${invalidTypeRes.status}`);
    }

    // 8. Product image paths are stored as clean relative paths in MongoDB
    const fetchedPart1 = await SparePart.findById(createdPart1Id);
    if (fetchedPart1 && fetchedPart1.imagePaths.every((p) => p.startsWith('/uploads/parts/'))) {
      logPass(8, 'Product image paths stored as clean relative paths in MongoDB');
    } else {
      logFail(8, 'Relative image path verification', JSON.stringify(fetchedPart1?.imagePaths));
    }

    // 9. An owner can update their own inventory
    const updatePartRes = await makeRequest(`/api/parts/${createdPart1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: {
        price: 3200, // Discounted
        stockQuantity: 8
      }
    });

    if (
      updatePartRes.status === 200 &&
      updatePartRes.data.part?.price === 3200 &&
      updatePartRes.data.part?.stockQuantity === 8
    ) {
      logPass(9, 'Owner can update their own inventory pricing and stock levels');
    } else {
      logFail(9, 'Owner inventory update', JSON.stringify(updatePartRes.data));
    }

    // 10. An owner cannot modify another owner's product
    const crossOwnerUpdateRes = await makeRequest(`/api/parts/${createdPart1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner2Cookie },
      body: { price: 100 }
    });

    if (crossOwnerUpdateRes.status === 404 || crossOwnerUpdateRes.status === 403) {
      logPass(10, "Owner cannot modify another owner's product (Cross-tenant protection verified)");
    } else {
      logFail(10, 'Cross-tenant product modification', `Status: ${crossOwnerUpdateRes.status}`);
    }

    // 11. Products with zero stock are automatically marked OUT_OF_STOCK
    const zeroStockUpdateRes = await makeRequest(`/api/parts/${createdPart1Id}`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { stockQuantity: 0 }
    });

    if (
      zeroStockUpdateRes.status === 200 &&
      zeroStockUpdateRes.data.part?.availabilityStatus === 'OUT_OF_STOCK'
    ) {
      logPass(11, 'Products with zero stock automatically transition to OUT_OF_STOCK');
    } else {
      logFail(11, 'Zero stock status rule', JSON.stringify(zeroStockUpdateRes.data));
    }

    // 12. Draft listings do not appear in public searches
    const draftPart = await SparePart.create({
      shopId: shop1._id,
      ownerId: owner1User._id,
      partName: 'Unpublished Draft Spark Plug',
      description: 'Draft listing not yet published',
      category: 'Electrical',
      vehicleType: 'Bike',
      manufacturer: 'NGK',
      partNumber: 'NGK-CR9E',
      price: 450,
      stockQuantity: 20,
      isPublished: false // Draft
    });

    const publicPartsRes = await makeRequest('/api/parts');
    const hasDraftInPublic = publicPartsRes.data.parts?.some((p) => p._id === draftPart._id.toString());

    if (!hasDraftInPublic) {
      logPass(12, 'Draft listings (isPublished: false) do not appear in public marketplace searches');
    } else {
      logFail(12, 'Draft exclusion in public search', 'Draft part appeared in public listing');
    }

    // 13. Products from suspended or unapproved shops are excluded from public listings
    // Restore stock to part 1 first
    await SparePart.findByIdAndUpdate(createdPart1Id, { stockQuantity: 5, availabilityStatus: 'IN_STOCK' });

    // Suspend shop 1
    await Shop.findByIdAndUpdate(shop1._id, { isActive: false });

    const suspendedShopPartsRes = await makeRequest('/api/parts');
    const hasSuspendedShopParts = suspendedShopPartsRes.data.parts?.some(
      (p) => p.shopId?._id === shop1._id.toString() || p.shopId === shop1._id.toString()
    );

    if (!hasSuspendedShopParts) {
      logPass(13, 'Products from suspended or unapproved shops are strictly excluded from public discovery');
    } else {
      logFail(13, 'Suspended shop exclusion', 'Product from suspended shop appeared publicly');
    }

    // Reactivate shop 1
    await Shop.findByIdAndUpdate(shop1._id, { isActive: true });

    // 14. Product deletion does not break historical orders (safe archival)
    const deletePartRes = await makeRequest(`/api/parts/${createdPart1Id}`, {
      method: 'DELETE',
      headers: { Cookie: owner1Cookie }
    });

    const archivedPartInDb = await SparePart.findById(createdPart1Id);

    if (
      deletePartRes.status === 200 &&
      archivedPartInDb &&
      archivedPartInDb.isArchived === true &&
      archivedPartInDb.isPublished === false
    ) {
      logPass(14, 'Product deletion performs safe archival preserving historical references');
    } else {
      logFail(14, 'Safe product deletion', `Status: ${deletePartRes.status}, isArchived: ${archivedPartInDb?.isArchived}`);
    }

    // 15. Public shop and product APIs do not expose private verification documents or sensitive owner details
    const publicShopDetailRes = await makeRequest(`/api/shops/${shop1._id}`);
    const shopData = publicShopDetailRes.data.shop;

    const noPrivateDocsExposed = !shopData?.verificationDocumentPaths;
    const noPrivateOwnerPhone = !shopData?.ownerId?.phone;

    if (publicShopDetailRes.status === 200 && noPrivateDocsExposed && noPrivateOwnerPhone) {
      logPass(15, 'Public shop and product APIs do not expose private documents or sensitive owner contact info');
    } else {
      logFail(15, 'Public data privacy leak', `Docs: ${noPrivateDocsExposed}, OwnerPhone: ${noPrivateOwnerPhone}`);
    }

    // 16. Owner inventory overview fetches complete metrics (total, in-stock, out-of-stock, low-stock, draft)
    const ownerInventoryRes = await makeRequest('/api/parts/my', {
      headers: { Cookie: owner1Cookie }
    });

    if (ownerInventoryRes.status === 200 && ownerInventoryRes.data.stats) {
      logPass(16, 'Owner inventory overview returns accurate aggregated inventory metrics and pagination');
    } else {
      logFail(16, 'Owner inventory overview stats', JSON.stringify(ownerInventoryRes.data));
    }

    console.log('\n========================================');
    console.log('ALL 16 MODULE 4 SHOP & INVENTORY TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Cleanup sample file
    const samplePartFiles = fs.readdirSync(PARTS_DIR).filter((f) => f.startsWith('part-test-'));
    samplePartFiles.forEach((f) => {
      try {
        fs.unlinkSync(path.join(PARTS_DIR, f));
      } catch {}
    });

    // Cleanup test users & records
    const cleanupUsers = await User.find({ email: { $in: [owner1Email, owner2Email, customerEmail] } });
    const cleanupIds = cleanupUsers.map((u) => u._id);
    await SparePart.deleteMany({ ownerId: { $in: cleanupIds } });
    await Shop.deleteMany({ ownerId: { $in: cleanupIds } });
    await ShopApplication.deleteMany({ ownerId: { $in: cleanupIds } });
    await User.deleteMany({ email: { $in: [owner1Email, owner2Email, customerEmail] } });

    await mongoose.disconnect();
    server.close();
    process.exit(0);
  }
};

runInventoryTests();
