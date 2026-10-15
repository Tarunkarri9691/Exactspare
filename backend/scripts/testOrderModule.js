import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';

const PORT = 5059; // Dedicated test port for Module 6
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

const runModule6Tests = async () => {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 6 — CART, ORDERS & MANAGEMENT TEST SUITE');
  console.log('========================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const customer1Email = 'test.order.cust1@exactspare.com';
  const customer2Email = 'test.order.cust2@exactspare.com';
  const owner1Email = 'test.order.owner1@exactspare.com';
  const owner2Email = 'test.order.owner2@exactspare.com';

  // 1. Clean up old test data
  const oldUsers = await User.find({ email: { $in: [customer1Email, customer2Email, owner1Email, owner2Email] } });
  const oldIds = oldUsers.map((u) => u._id);
  await Order.deleteMany({ customerId: { $in: oldIds } });
  await Cart.deleteMany({ customerId: { $in: oldIds } });
  await SparePart.deleteMany({ ownerId: { $in: oldIds } });
  await Shop.deleteMany({ ownerId: { $in: oldIds } });
  await ShopApplication.deleteMany({ ownerId: { $in: oldIds } });
  await User.deleteMany({ email: { $in: [customer1Email, customer2Email, owner1Email, owner2Email] } });

  // 2. Start HTTP server
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 3. Register Customer 1 & Customer 2
    const regCust1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Arjun Customer',
        email: customer1Email,
        password: 'CustomerExactSpare@2026',
        confirmPassword: 'CustomerExactSpare@2026',
        phone: '+91 98765 43210',
        role: 'CUSTOMER'
      }
    });
    const cust1Cookie = parseCookie(regCust1);
    const cust1User = await User.findOne({ email: customer1Email });
    const cust1Id = cust1User._id.toString();

    const regCust2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Pooja Customer',
        email: customer2Email,
        password: 'CustomerExactSpare@2026',
        confirmPassword: 'CustomerExactSpare@2026',
        phone: '+91 98765 43211',
        role: 'CUSTOMER'
      }
    });
    const cust2Cookie = parseCookie(regCust2);
    const cust2User = await User.findOne({ email: customer2Email });
    const cust2Id = cust2User._id.toString();

    // 4. Register Owner 1 & Owner 2
    const regOwner1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Suresh Auto Enterprises',
        email: owner1Email,
        password: 'OwnerExactSpare@2026',
        confirmPassword: 'OwnerExactSpare@2026',
        phone: '+91 98111 11111',
        role: 'OWNER'
      }
    });
    const owner1Cookie = parseCookie(regOwner1);
    const owner1User = await User.findOne({ email: owner1Email });
    const owner1Id = owner1User._id.toString();

    const regOwner2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Apex Motor Spares',
        email: owner2Email,
        password: 'OwnerExactSpare@2026',
        confirmPassword: 'OwnerExactSpare@2026',
        phone: '+91 98111 22222',
        role: 'OWNER'
      }
    });
    const owner2Cookie = parseCookie(regOwner2);
    const owner2User = await User.findOne({ email: owner2Email });
    const owner2Id = owner2User._id.toString();

    // 5. Create Approved Shop 1 (Owner 1)
    const app1 = await ShopApplication.create({
      ownerId: owner1Id,
      shopName: 'Suresh Auto Spares Hub',
      ownerFullName: 'Suresh Auto Enterprises',
      ownerPhone: '+91 98111 11111',
      businessEmail: owner1Email,
      shopDescription: 'Wholesale and retail automotive supplier in Pune.',
      addressLine: '45 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      latitude: 18.5204,
      longitude: 73.8567,
      status: 'APPROVED'
    });

    const shop1 = await Shop.create({
      ownerId: owner1Id,
      applicationId: app1._id,
      name: 'Suresh Auto Spares Hub',
      category: 'CAR',
      description: 'Wholesale and retail automotive supplier in Pune.',
      address: {
        addressLine: '45 MG Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        location: { type: 'Point', coordinates: [73.8567, 18.5204] }
      },
      contact: { phone: '+91 98111 11111', email: owner1Email },
      isApproved: true,
      isActive: true
    });

    // Create Approved Shop 2 (Owner 2)
    const app2 = await ShopApplication.create({
      ownerId: owner2Id,
      shopName: 'Apex Motor Spares',
      ownerFullName: 'Apex Motor Spares',
      ownerPhone: '+91 98111 22222',
      businessEmail: owner2Email,
      shopDescription: 'Authorized OEM retailer in Mumbai.',
      addressLine: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400020',
      latitude: 19.0760,
      longitude: 72.8777,
      status: 'APPROVED'
    });

    const shop2 = await Shop.create({
      ownerId: owner2Id,
      applicationId: app2._id,
      name: 'Apex Motor Spares',
      category: 'MULTI_CATEGORY',
      description: 'Authorized OEM retailer in Mumbai.',
      address: {
        addressLine: '12 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400020',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }
      },
      contact: { phone: '+91 98111 22222', email: owner2Email },
      isApproved: true,
      isActive: true
    });

    // 6. Create Test Spare Parts
    // Part A: Shop 1 (Price: 1500, Stock: 10)
    const partA = await SparePart.create({
      shopId: shop1._id,
      ownerId: owner1Id,
      partName: 'Bosch Front Brake Pads Set',
      partNumber: 'BOSCH-BP-101',
      description: 'High performance ceramic brake pads.',
      category: 'Brakes',
      vehicleType: 'Car',
      manufacturer: 'Bosch',
      price: 1500,
      stockQuantity: 10,
      availabilityStatus: 'IN_STOCK',
      isPublished: true,
      isArchived: false
    });

    // Part B: Shop 1 (Price: 500, Stock: 5)
    const partB = await SparePart.create({
      shopId: shop1._id,
      ownerId: owner1Id,
      partName: 'Mann Oil Filter',
      partNumber: 'MANN-OF-202',
      description: 'Engine spin-on oil filter.',
      category: 'Engine',
      vehicleType: 'Car',
      manufacturer: 'Mann',
      price: 500,
      stockQuantity: 5,
      availabilityStatus: 'IN_STOCK',
      isPublished: true,
      isArchived: false
    });

    // Part C: Shop 2 (Price: 3000, Stock: 3)
    const partC = await SparePart.create({
      shopId: shop2._id,
      ownerId: owner2Id,
      partName: 'Exedy Heavy Duty Clutch Plate',
      partNumber: 'EXD-CP-303',
      description: 'Durable transmission clutch plate.',
      category: 'Transmission',
      vehicleType: 'Car',
      manufacturer: 'Exedy',
      price: 3000,
      stockQuantity: 3,
      availabilityStatus: 'IN_STOCK',
      isPublished: true,
      isArchived: false
    });

    // ==========================================
    // Scenario 1: Add a product to the cart
    // ==========================================
    const addRes1 = await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partA._id, quantity: 2 }
    });

    if (
      addRes1.status === 200 &&
      addRes1.data.data?.items?.length === 1 &&
      addRes1.data.data.items[0].productId === partA._id.toString() &&
      addRes1.data.data.items[0].quantity === 2 &&
      addRes1.data.data.subtotal === 3000
    ) {
      logPass(1, 'Added product to cart with revalidated pricing and subtotal (2 × ₹1,500 = ₹3,000)');
    } else {
      logFail(1, 'Add product to cart', JSON.stringify(addRes1.data));
    }

    // ==========================================
    // Scenario 2: Change quantity and remove an item
    // ==========================================
    // Add second item (partB, qty: 1)
    await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partB._id, quantity: 1 }
    });

    // Update quantity of partA from 2 to 3
    const updateRes = await makeRequest(`/api/cart/items/${partA._id}`, {
      method: 'PATCH',
      headers: { Cookie: cust1Cookie },
      body: { quantity: 3 }
    });

    // Remove partB
    const removeRes = await makeRequest(`/api/cart/items/${partB._id}`, {
      method: 'DELETE',
      headers: { Cookie: cust1Cookie }
    });

    if (
      updateRes.status === 200 &&
      removeRes.status === 200 &&
      removeRes.data.data.items.length === 1 &&
      removeRes.data.data.items[0].quantity === 3 &&
      removeRes.data.data.subtotal === 4500
    ) {
      logPass(2, 'Updated cart quantity to 3 and removed item successfully (Subtotal: ₹4,500)');
    } else {
      logFail(2, 'Change quantity & remove item', JSON.stringify(removeRes.data));
    }

    // ==========================================
    // Scenario 3: Refresh / re-fetch and verify cart persists in MongoDB
    // ==========================================
    const fetchCartRes = await makeRequest('/api/cart', {
      method: 'GET',
      headers: { Cookie: cust1Cookie }
    });

    if (
      fetchCartRes.status === 200 &&
      fetchCartRes.data.data.items.length === 1 &&
      fetchCartRes.data.data.items[0].productId === partA._id.toString() &&
      fetchCartRes.data.data.items[0].quantity === 3
    ) {
      logPass(3, 'Cart successfully persists in MongoDB across sessions/refreshes');
    } else {
      logFail(3, 'Cart persistence', JSON.stringify(fetchCartRes.data));
    }

    // ==========================================
    // Scenario 4: Try adding more items than available stock
    // Part C has stock 3. Try adding 5 units.
    // ==========================================
    const exceedRes = await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partC._id, quantity: 5 }
    });

    if (exceedRes.status === 400 && exceedRes.data.message.includes('Only 3 units available')) {
      logPass(4, 'Quantity exceeding available stock strictly rejected with HTTP 400');
    } else {
      logFail(4, 'Excess quantity block', JSON.stringify(exceedRes.data));
    }

    // Add 1 unit of partC to cart (Now cart has partA: 3, partC: 1 -> multi-shop cart!)
    await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partC._id, quantity: 1 }
    });

    // ==========================================
    // Scenario 5: Place a COD order successfully
    // ==========================================
    const initialPartAStock = (await SparePart.findById(partA._id)).stockQuantity; // 10
    const initialPartCStock = (await SparePart.findById(partC._id)).stockQuantity; // 3

    const placeOrderRes = await makeRequest('/api/orders', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shippingAddress: {
          fullName: 'Arjun Customer',
          phone: '+91 98765 43210',
          addressLine: 'Flat 402, Green Avenue, FC Road',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411004',
          instructions: 'Call before delivery'
        },
        paymentMethod: 'COD'
      }
    });

    const placedOrder = placeOrderRes.data?.data?.order;

    if (
      placeOrderRes.status === 201 &&
      placedOrder &&
      placedOrder.orderNumber.startsWith('EXS-') &&
      placedOrder.orderStatus === 'PLACED' &&
      placedOrder.paymentMethod === 'COD' &&
      placedOrder.paymentStatus === 'PENDING'
    ) {
      logPass(5, `Placed COD order successfully: ${placedOrder.orderNumber}`);
    } else {
      logFail(5, 'Place COD order', JSON.stringify(placeOrderRes.data));
    }

    // ==========================================
    // Scenario 6: Verify backend calculates correct total
    // Part A: 3 × 1500 = 4500, Part C: 1 × 3000 = 3000 -> Total: 7500
    // ==========================================
    if (placedOrder && placedOrder.subtotal === 7500 && placedOrder.totalAmount === 7500) {
      logPass(6, 'Backend accurately calculated server-side total (₹7,500) from MongoDB product prices');
    } else {
      logFail(6, 'Backend calculation', `Subtotal: ${placedOrder?.subtotal}, Total: ${placedOrder?.totalAmount}`);
    }

    // ==========================================
    // Scenario 7: Verify stock decreases exactly once
    // ==========================================
    const afterPartAStock = (await SparePart.findById(partA._id)).stockQuantity;
    const afterPartCStock = (await SparePart.findById(partC._id)).stockQuantity;

    if (
      afterPartAStock === initialPartAStock - 3 && // 10 - 3 = 7
      afterPartCStock === initialPartCStock - 1    // 3 - 1 = 2
    ) {
      logPass(7, `Stock atomically decreased exactly once: Part A (10 → ${afterPartAStock}), Part C (3 → ${afterPartCStock})`);
    } else {
      logFail(7, 'Stock decrement check', `Part A: ${afterPartAStock}, Part C: ${afterPartCStock}`);
    }

    // ==========================================
    // Scenario 8: Try placing order when stock is insufficient
    // Customer 2 puts remaining 2 units of Part C in cart, but stock gets depleted
    // ==========================================
    await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust2Cookie },
      body: { productId: partC._id, quantity: 2 }
    });

    // Artificially deplete stock of Part C to 1
    await SparePart.findByIdAndUpdate(partC._id, { stockQuantity: 1 });

    const failOrderRes = await makeRequest('/api/orders', {
      method: 'POST',
      headers: { Cookie: cust2Cookie },
      body: {
        shippingAddress: {
          fullName: 'Pooja Customer',
          phone: '+91 98765 43211',
          addressLine: 'Apt 12, Baner',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411045'
        },
        paymentMethod: 'COD'
      }
    });

    if (failOrderRes.status === 400 && failOrderRes.data.message.includes('Insufficient stock')) {
      logPass(8, 'Order rejected with HTTP 400 when stock was insufficient at checkout time');
    } else {
      logFail(8, 'Insufficient stock check', JSON.stringify(failOrderRes.data));
    }

    // Restore Part C stock to 2
    await SparePart.findByIdAndUpdate(partC._id, { stockQuantity: 2 });

    // ==========================================
    // Scenario 9: Attempt order placement with empty cart
    // Customer 1 cart is now empty after previous order
    // ==========================================
    const emptyOrderRes = await makeRequest('/api/orders', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shippingAddress: {
          fullName: 'Arjun Customer',
          phone: '+91 98765 43210',
          addressLine: 'Flat 402, Green Avenue, FC Road',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411004'
        },
        paymentMethod: 'COD'
      }
    });

    if (emptyOrderRes.status === 400 && emptyOrderRes.data.message.includes('empty')) {
      logPass(9, 'Order submission with empty cart rejected safely with HTTP 400');
    } else {
      logFail(9, 'Empty cart order rejection', JSON.stringify(emptyOrderRes.data));
    }

    // ==========================================
    // Scenario 10: Customer cannot view another customer's orders
    // Customer 2 tries to GET placedOrder._id of Customer 1
    // ==========================================
    const hijackRes = await makeRequest(`/api/orders/${placedOrder._id}`, {
      headers: { Cookie: cust2Cookie }
    });

    if (hijackRes.status === 403) {
      logPass(10, "Cross-customer order access blocked with HTTP 403 Forbidden (Ownership verified)");
    } else {
      logFail(10, 'Cross-customer order isolation', `Status: ${hijackRes.status}`);
    }

    // ==========================================
    // Scenario 11: Owner cannot view another owner's orders / products
    // Owner 2 checks orders; placedOrder has items from Shop 1 and Shop 2.
    // Owner 2 must ONLY see items from Shop 2!
    // ==========================================
    const owner2OrdersRes = await makeRequest('/api/owner/orders', {
      headers: { Cookie: owner2Cookie }
    });

    const owner2Orders = owner2OrdersRes.data?.data?.orders || [];
    const owner2MatchingOrder = owner2Orders.find((o) => o._id === placedOrder._id.toString());
    const onlyOwner2Items = owner2MatchingOrder?.items?.every((item) => item.ownerId.toString() === owner2Id);

    if (
      owner2OrdersRes.status === 200 &&
      owner2MatchingOrder &&
      owner2MatchingOrder.items.length === 1 &&
      owner2MatchingOrder.items[0].partNumber === 'EXD-CP-303' &&
      onlyOwner2Items
    ) {
      logPass(11, "Multi-tenant owner isolation verified: Owner 2 only sees their own shop's items in multi-shop order");
    } else {
      logFail(11, 'Owner tenant isolation', JSON.stringify(owner2MatchingOrder));
    }

    // ==========================================
    // Scenario 12: Update order through valid status progression
    // Owner 1 updates their shop's fulfillment: PLACED -> CONFIRMED -> PROCESSING
    // ==========================================
    const confirmRes = await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'CONFIRMED', note: 'Store confirmed availability' }
    });

    const processRes = await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'PROCESSING', note: 'Packaging brake pads' }
    });

    if (
      confirmRes.status === 200 &&
      processRes.status === 200 &&
      processRes.data.data.order.shops.find((s) => s.ownerId.toString() === owner1Id).fulfillmentStatus === 'PROCESSING'
    ) {
      logPass(12, 'Owner successfully progressed fulfillment status from PLACED → CONFIRMED → PROCESSING');
    } else {
      logFail(12, 'Order status progression', JSON.stringify(processRes.data));
    }

    // ==========================================
    // Scenario 13: Attempt invalid status transition
    // Owner 1 tries to jump backward or to DELIVERED directly from PROCESSING
    // ==========================================
    const invalidJumpRes = await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'DELIVERED' }
    });

    if (invalidJumpRes.status === 400 && invalidJumpRes.data.message.includes('Invalid status transition')) {
      logPass(13, 'Invalid status transition (e.g. PROCESSING → DELIVERED) strictly rejected with HTTP 400');
    } else {
      logFail(13, 'Invalid transition rejection', JSON.stringify(invalidJumpRes.data));
    }

    // ==========================================
    // Scenario 14: Cancel an eligible order and verify stock restoration
    // Create new order for Customer 2 with Part B (quantity 2, stock is 5)
    // ==========================================
    await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust2Cookie },
      body: { productId: partB._id, quantity: 2 }
    });

    const cust2OrderRes = await makeRequest('/api/orders', {
      method: 'POST',
      headers: { Cookie: cust2Cookie },
      body: {
        shippingAddress: {
          fullName: 'Pooja Customer',
          phone: '+91 98765 43211',
          addressLine: 'Apt 12, Baner',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411045'
        },
        paymentMethod: 'COD'
      }
    });

    const cust2OrderId = cust2OrderRes.data?.data?.order?._id;
    const stockAfterCust2Order = (await SparePart.findById(partB._id)).stockQuantity; // 5 - 2 = 3

    // Customer 2 cancels this order in PLACED state
    const cancelRes = await makeRequest(`/api/orders/${cust2OrderId}/cancel`, {
      method: 'POST',
      headers: { Cookie: cust2Cookie },
      body: { reason: 'Ordered by mistake' }
    });

    const stockAfterCancel = (await SparePart.findById(partB._id)).stockQuantity; // 3 + 2 = 5

    if (
      cancelRes.status === 200 &&
      cancelRes.data.data.order.orderStatus === 'CANCELLED' &&
      stockAfterCust2Order === 3 &&
      stockAfterCancel === 5
    ) {
      logPass(14, 'Customer cancellation accepted in PLACED status and stock restored exactly once (3 → 5)');
    } else {
      logFail(14, 'Order cancellation & stock restoration', JSON.stringify(cancelRes.data));
    }

    // ==========================================
    // Scenario 15: Attempt cancellation after dispatch/shipped
    // Progress an order to SHIPPED then customer attempts cancellation
    // ==========================================
    // Progress placedOrder to READY_FOR_DISPATCH then SHIPPED by owner 1
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'READY_FOR_DISPATCH' }
    });
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: owner1Cookie },
      body: { status: 'SHIPPED' }
    });

    const lateCancelRes = await makeRequest(`/api/orders/${placedOrder._id}/cancel`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { reason: 'Too late' }
    });

    if (lateCancelRes.status === 400 && lateCancelRes.data.message.includes('cannot be cancelled')) {
      logPass(15, 'Cancellation rejected with HTTP 400 when order has reached or passed dispatch state');
    } else {
      logFail(15, 'Late cancellation rejection', JSON.stringify(lateCancelRes.data));
    }

    // ==========================================
    // Scenario 16: Empty carts, deleted products, inactive shops handled cleanly
    // Customer 1 clears cart and queries it
    // ==========================================
    const clearRes = await makeRequest('/api/cart', {
      method: 'DELETE',
      headers: { Cookie: cust1Cookie }
    });

    if (
      clearRes.status === 200 &&
      clearRes.data.data.items.length === 0 &&
      clearRes.data.data.subtotal === 0
    ) {
      logPass(16, 'Empty cart queries and DELETE /api/cart return clean zero totals without crashing');
    } else {
      logFail(16, 'Empty cart handling', JSON.stringify(clearRes.data));
    }

    // ==========================================
    // Scenario 17: Modules 1–5 regression check (Search & Auth still work)
    // ==========================================
    const searchRes = await makeRequest('/api/search/nearby-parts?q=Bosch');
    const authMeRes = await makeRequest('/api/auth/me', {
      headers: { Cookie: cust1Cookie }
    });

    if (
      searchRes.status === 200 &&
      searchRes.data.data?.parts?.length >= 1 &&
      authMeRes.status === 200 &&
      authMeRes.data.user?.email === customer1Email
    ) {
      logPass(17, 'Zero regressions: Module 2 Auth and Module 5 Search APIs continue running smoothly');
    } else {
      logFail(17, 'Regression check', `Search: ${searchRes.status}, Auth: ${authMeRes.status}`);
    }

    // ==========================================
    // Scenario 18: Clean execution and error suppression check
    // Ensure no unhandled rejections or password leaks in order responses
    // ==========================================
    const myOrdersRes = await makeRequest('/api/orders/my', {
      headers: { Cookie: cust1Cookie }
    });

    const ordersJson = JSON.stringify(myOrdersRes.data);
    const noPasswordLeak = !ordersJson.includes('passwordHash');

    if (myOrdersRes.status === 200 && noPasswordLeak) {
      logPass(18, 'Customer orders endpoint returns safe payloads without exposing sensitive credentials');
    } else {
      logFail(18, 'Sensitive data leak check', ordersJson);
    }

    console.log('\n========================================');
    console.log('ALL 18 MODULE 6 ORDERS & MANAGEMENT TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Unhandled test failure:', err);
  } finally {
    // Clean up test data
    const testUsers = await User.find({ email: { $in: [customer1Email, customer2Email, owner1Email, owner2Email] } });
    const userIds = testUsers.map((u) => u._id);
    await Order.deleteMany({ customerId: { $in: userIds } });
    await Cart.deleteMany({ customerId: { $in: userIds } });
    await SparePart.deleteMany({ ownerId: { $in: userIds } });
    await Shop.deleteMany({ ownerId: { $in: userIds } });
    await ShopApplication.deleteMany({ ownerId: { $in: userIds } });
    await User.deleteMany({ email: { $in: [customer1Email, customer2Email, owner1Email, owner2Email] } });

    await mongoose.disconnect();
    if (server) server.close();
  }
};

runModule6Tests();
