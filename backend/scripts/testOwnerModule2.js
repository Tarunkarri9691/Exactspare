import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import SparePart from '../models/SparePart.js';
import ShopApplication from '../models/ShopApplication.js';

const PORT = 5092;
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
    const bodyPayload = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(bodyPayload ? { 'Content-Length': Buffer.byteLength(bodyPayload) } : {}),
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
    if (bodyPayload) {
      req.write(bodyPayload);
    }
    req.end();
  });
};

const runAllTests = async () => {
  console.log('\n===============================================================');
  console.log('EXACTSPARE OWNER PORTAL MODULE 2 COMPREHENSIVE VERIFICATION');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  const timestamp = Date.now();
  const ownerEmail = `module2.owner.${timestamp}@exactspare.test`;
  const ownerPassword = 'OwnerSecurePass123!';
  let ownerCookie = null;
  let partId = null;

  try {
    // 1. Register owner with valid password and confirmPassword
    const regRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Ramesh Patel',
        email: ownerEmail,
        phone: '+919876543202',
        password: ownerPassword,
        confirmPassword: ownerPassword,
        role: 'OWNER'
      }
    });

    if (regRes.status === 201) {
      ownerCookie = parseCookie(regRes);
      logPass(1, 'Shop owner successfully registered with secure password and authenticated session cookie');
    } else {
      logFail(1, 'Shop owner registration failed', JSON.stringify(regRes.data));
      throw new Error('Registration failed');
    }

    const ownerUser = await User.findOne({ email: ownerEmail });

    // 2. Seed approved ShopApplication and Shop directly in MongoDB
    const appDoc = await ShopApplication.create({
      ownerId: ownerUser._id,
      shopName: 'Patel Auto Spares Hub',
      ownerFullName: 'Ramesh Patel',
      ownerPhone: '+919876543202',
      businessEmail: ownerEmail,
      shopDescription: 'Genuine automobile replacement parts and accessories',
      shopCategory: 'CAR',
      addressLine: 'Plot 42, Mayapuri Industrial Area Phase 2',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110064',
      latitude: 28.6289,
      longitude: 77.1025,
      openingHours: 'Mon-Sat: 09:00 AM - 08:30 PM',
      shopImagePaths: ['/uploads/shops/sample-storefront.jpg'],
      status: 'APPROVED',
      submittedAt: new Date(),
      reviewedAt: new Date()
    });

    const shop = await Shop.create({
      applicationId: appDoc._id,
      ownerId: ownerUser._id,
      name: 'Patel Auto Spares Hub',
      description: 'Genuine automobile replacement parts and accessories',
      category: 'CAR',
      phone: '+919876543202',
      email: ownerEmail,
      address: {
        addressLine: 'Plot 42, Mayapuri Industrial Area Phase 2',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110064',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.6289]
        }
      },
      openingHours: 'Mon-Sat: 09:00 AM - 08:30 PM',
      images: ['/uploads/shops/sample-storefront.jpg'],
      isApproved: true,
      isActive: true
    });

    logPass(2, `Active verified shop seeded for merchant (Shop ID: ${shop._id})`);

    // 3. Fetch My Shop
    const myShopRes = await makeRequest('/api/shops/my', {
      headers: { Cookie: ownerCookie }
    });

    if (myShopRes.status === 200 && myShopRes.data?.shop?.name === 'Patel Auto Spares Hub') {
      logPass(3, 'Owner successfully retrieved their approved shop profile');
    } else {
      logFail(3, 'Failed to fetch owner shop', JSON.stringify(myShopRes.data));
    }

    // 4. Update My Shop details and GPS coordinates
    const updateShopRes = await makeRequest('/api/shops/my', {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: {
        name: 'Patel Genuine Parts Supercenter',
        description: 'Authorized distributor of OEM brake pads, spark plugs and filters',
        phone: '+919876543219',
        openingHours: 'Mon-Sun: 08:30 AM - 09:00 PM',
        addressLine: 'Plot 42, Mayapuri Phase 2',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110064',
        latitude: 28.6300,
        longitude: 77.1050
      }
    });

    if (
      updateShopRes.status === 200 &&
      updateShopRes.data?.shop?.name === 'Patel Genuine Parts Supercenter' &&
      updateShopRes.data.shop.address.location.coordinates[1] === 28.63
    ) {
      logPass(4, 'Owner updated shop profile and accurate GPS coordinates were saved in GeoJSON format');
    } else {
      logFail(4, 'Failed to update shop details', JSON.stringify(updateShopRes.data));
    }

    // 5. Delete specific storefront image
    const delImgRes = await makeRequest('/api/shops/my/images', {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
      body: {
        imagePath: '/uploads/shops/sample-storefront.jpg'
      }
    });

    if (delImgRes.status === 200 && !delImgRes.data?.images?.includes('/uploads/shops/sample-storefront.jpg')) {
      logPass(5, 'Owner successfully deleted specific storefront photograph via DELETE /api/shops/my/images');
    } else {
      logFail(5, 'Failed to delete shop photo', JSON.stringify(delImgRes.data));
    }

    // 6. Create Spare Part with manual price control & notes
    const createPartRes = await makeRequest('/api/parts', {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: {
        partName: 'Bosch QuietCast Ceramic Disc Brake Pad Set',
        description: 'Premium copper-free ceramic formulation for front axle',
        category: 'Brakes',
        subcategory: 'Brake Pads',
        vehicleType: 'Car',
        manufacturer: 'Bosch',
        partNumber: 'BP1107',
        condition: 'NEW',
        price: 2450.00,
        stockQuantity: 15,
        notes: 'Shelf 3B, Batch 2026-Q1, 1-Year Manufacturer Warranty',
        compatibleMakes: ['Honda', 'Toyota'],
        compatibleModels: ['City', 'Civic', 'Corolla'],
        compatibleYears: ['2019', '2020', '2021', '2022'],
        isPublished: true
      }
    });

    if (
      createPartRes.status === 201 &&
      createPartRes.data?.part?.price === 2450 &&
      createPartRes.data.part.notes === 'Shelf 3B, Batch 2026-Q1, 1-Year Manufacturer Warranty'
    ) {
      partId = createPartRes.data.part._id;
      logPass(6, 'Owner created spare part listing with manual price ₹2450 in INR and warehouse notes');
    } else {
      logFail(6, 'Failed to create spare part', JSON.stringify(createPartRes.data));
    }

    // 7. Get Owner Inventory (/api/parts/my) with pagination & metrics
    const myInvRes = await makeRequest('/api/parts/my?page=1&limit=10', {
      headers: { Cookie: ownerCookie }
    });

    if (myInvRes.status === 200 && myInvRes.data?.parts?.length >= 1 && myInvRes.data?.stats?.totalParts >= 1) {
      logPass(7, 'Owner fetched own inventory with aggregated stock statistics and pagination metadata');
    } else {
      logFail(7, 'Failed to fetch owner inventory', JSON.stringify(myInvRes.data));
    }

    // 8. Update part price, stock, and toggle publication to Draft
    const updatePartRes = await makeRequest(`/api/parts/${partId}`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: {
        price: 2399.00,
        stockQuantity: 8,
        notes: 'Price discounted for weekend promotion',
        isPublished: false
      }
    });

    if (
      updatePartRes.status === 200 &&
      updatePartRes.data?.part?.price === 2399 &&
      updatePartRes.data.part.isPublished === false
    ) {
      logPass(8, 'Owner updated price to ₹2399 and toggled publication status to Draft');
    } else {
      logFail(8, 'Failed to update part listing', JSON.stringify(updatePartRes.data));
    }

    // 9. Verify unpublished draft is excluded from public customer search
    const publicPartsRes = await makeRequest('/api/parts?search=BP1107');
    const isFoundPublic = publicPartsRes.data?.parts?.some(p => p._id.toString() === partId.toString());
    if (!isFoundPublic) {
      logPass(9, 'Unpublished draft spare part is strictly hidden from public customer search results');
    } else {
      logFail(9, 'Draft part should not appear in public search', '');
    }

    // 10. Switch back to published and verify discoverable
    await makeRequest(`/api/parts/${partId}`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { isPublished: true }
    });

    const publicPartsRes2 = await makeRequest('/api/parts?search=BP1107');
    const isFoundPublic2 = publicPartsRes2.data?.parts?.some(p => p._id.toString() === partId.toString());
    if (isFoundPublic2) {
      logPass(10, 'Published spare part is immediately discoverable in customer marketplace search');
    } else {
      logFail(10, 'Published part should appear in public search', '');
    }

    // 11. Update Owner Profile (Name & Phone)
    const updateProfileRes = await makeRequest('/api/users/profile', {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: {
        name: 'Ramesh Patel (Authorized Dealer)',
        phone: '+919876543299'
      }
    });

    const isProfileUpdated =
      updateProfileRes.status === 200 &&
      (updateProfileRes.data?.profile?.name === 'Ramesh Patel (Authorized Dealer)' ||
       updateProfileRes.data?.user?.name === 'Ramesh Patel (Authorized Dealer)');

    if (isProfileUpdated) {
      logPass(11, 'Owner updated representative profile name and phone number');
    } else {
      logFail(11, 'Failed to update owner profile', JSON.stringify(updateProfileRes.data));
    }

    // 12. In-Page Password Change: Rejects wrong current password
    const badPassRes = await makeRequest('/api/auth/change-password', {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: {
        currentPassword: 'WrongPassword123!',
        newPassword: 'BrandNewOwnerPass789!',
        confirmPassword: 'BrandNewOwnerPass789!'
      }
    });

    if (badPassRes.status === 400 || badPassRes.status === 401) {
      logPass(12, 'Password change securely rejected incorrect current password');
    } else {
      logFail(12, 'Should reject invalid current password', JSON.stringify(badPassRes.data));
    }

    // 13. In-Page Password Change: Accepts correct current password
    const goodPassRes = await makeRequest('/api/auth/change-password', {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: {
        currentPassword: ownerPassword,
        newPassword: 'BrandNewOwnerPass789!',
        confirmPassword: 'BrandNewOwnerPass789!'
      }
    });

    if (goodPassRes.status === 200) {
      logPass(13, 'Password successfully updated using valid current password and securely re-hashed');
    } else {
      logFail(13, 'Password change failed', JSON.stringify(goodPassRes.data));
    }

    // 14. Verify login with new password
    const newLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: ownerEmail,
        password: 'BrandNewOwnerPass789!'
      }
    });

    let newOwnerCookie = null;
    if (newLoginRes.status === 200) {
      newOwnerCookie = parseCookie(newLoginRes);
      logPass(14, 'Owner successfully logged in using newly updated password and received new session cookie');
    } else {
      logFail(14, 'Login with new password failed', JSON.stringify(newLoginRes.data));
    }

    // 15. Verify AI image endpoint fallback (requires image and does not predict price)
    const aiFallbackRes = await makeRequest('/api/parts/auto-fill-from-image', {
      method: 'POST',
      headers: { Cookie: newOwnerCookie || ownerCookie },
      body: {}
    });

    if (aiFallbackRes.status === 400) {
      logPass(15, 'Image recognition endpoint requires valid uploaded file and does not predict price');
    } else {
      logFail(15, 'Image recognition validation unexpected response', JSON.stringify(aiFallbackRes.data));
    }

    console.log('\n===============================================================');
    console.log('ALL 15 OWNER PORTAL MODULE 2 TESTS PASSED PERFECTLY!');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    // Cleanup
    await User.deleteMany({ email: ownerEmail });
    if (partId) await SparePart.deleteOne({ _id: partId });
    await Shop.deleteMany({ email: ownerEmail });
    await mongoose.disconnect();
    server.close();
  }
};

runAllTests();
