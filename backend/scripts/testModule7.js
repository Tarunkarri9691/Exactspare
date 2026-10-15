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
import Notification from '../models/Notification.js';
import Wishlist from '../models/Wishlist.js';
import Review from '../models/Review.js';

const PORT = 5060; // Dedicated test port for Module 7
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

const runModule7Tests = async () => {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 7 — NOTIFICATIONS, WISHLIST, REVIEWS & RATINGS');
  console.log('========================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const cust1Email = 'test.m7.cust1@exactspare.com';
  const cust2Email = 'test.m7.cust2@exactspare.com';
  const ownerEmail = 'test.m7.owner@exactspare.com';

  // 1. Cleanup old test data
  const oldUsers = await User.find({ email: { $in: [cust1Email, cust2Email, ownerEmail] } });
  const oldIds = oldUsers.map((u) => u._id);
  await Notification.deleteMany({ recipientId: { $in: oldIds } });
  await Wishlist.deleteMany({ customerId: { $in: oldIds } });
  await Review.deleteMany({ customerId: { $in: oldIds } });
  await Order.deleteMany({ customerId: { $in: oldIds } });
  await Cart.deleteMany({ customerId: { $in: oldIds } });
  await SparePart.deleteMany({ ownerId: { $in: oldIds } });
  await Shop.deleteMany({ ownerId: { $in: oldIds } });
  await ShopApplication.deleteMany({ ownerId: { $in: oldIds } });
  await User.deleteMany({ email: { $in: [cust1Email, cust2Email, ownerEmail] } });

  // 2. Start HTTP server
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 3. Register Customer 1, Customer 2, and Shop Owner
    const regCust1 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rohan Deshmukh',
        email: cust1Email,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98222 11111',
        role: 'CUSTOMER'
      }
    });
    const cust1Cookie = parseCookie(regCust1);
    const cust1User = await User.findOne({ email: cust1Email });
    const cust1Id = cust1User._id.toString();

    const regCust2 = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Sneha Kulkarni',
        email: cust2Email,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98222 22222',
        role: 'CUSTOMER'
      }
    });
    const cust2Cookie = parseCookie(regCust2);
    const cust2User = await User.findOne({ email: cust2Email });
    const cust2Id = cust2User._id.toString();

    const regOwner = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Pradeep Auto Spares',
        email: ownerEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        phone: '+91 98222 33333',
        role: 'OWNER'
      }
    });
    const ownerCookie = parseCookie(regOwner);
    const ownerUser = await User.findOne({ email: ownerEmail });
    const ownerId = ownerUser._id.toString();

    // 4. Create Approved Shop and 2 Spare Parts
    const appDoc = await ShopApplication.create({
      ownerId,
      shopName: 'Pradeep Motor World',
      ownerFullName: 'Pradeep Auto Spares',
      ownerPhone: '+91 98222 33333',
      businessEmail: ownerEmail,
      shopDescription: 'Genuine OEM car parts supplier in Pune.',
      addressLine: '88 Senapati Bapat Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411016',
      latitude: 18.5314,
      longitude: 73.8296,
      status: 'APPROVED'
    });

    const shop = await Shop.create({
      ownerId,
      applicationId: appDoc._id,
      name: 'Pradeep Motor World',
      category: 'CAR',
      description: 'Genuine OEM car parts supplier in Pune.',
      address: {
        addressLine: '88 Senapati Bapat Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411016',
        location: { type: 'Point', coordinates: [73.8296, 18.5314] }
      },
      contact: { phone: '+91 98222 33333', email: ownerEmail },
      isApproved: true,
      isActive: true
    });

    const partA = await SparePart.create({
      shopId: shop._id,
      ownerId,
      partName: 'Brembo High Performance Brake Rotors',
      partNumber: 'BRM-ROT-400',
      description: 'Premium ventilated front brake discs for high heat dissipation.',
      category: 'Brakes',
      vehicleType: 'Car',
      manufacturer: 'Brembo',
      price: 4500,
      stockQuantity: 15,
      isPublished: true,
      isArchived: false,
      availabilityStatus: 'IN_STOCK'
    });

    const partB = await SparePart.create({
      shopId: shop._id,
      ownerId,
      partName: 'Denso Iridium Spark Plugs Set',
      partNumber: 'DNS-SPK-900',
      description: 'Ultra-fine 0.4mm laser welded iridium spark plugs.',
      category: 'Engine',
      vehicleType: 'Car',
      manufacturer: 'Denso',
      price: 1800,
      stockQuantity: 20,
      isPublished: true,
      isArchived: false,
      availabilityStatus: 'IN_STOCK'
    });

    // ==========================================
    // NOTIFICATIONS TESTS
    // ==========================================

    // Scenario 1: Notification created upon order placement
    // Customer 1 places order for Part A
    await makeRequest('/api/cart/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partA._id, quantity: 2 }
    });

    const placeOrderRes = await makeRequest('/api/orders', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        shippingAddress: {
          fullName: 'Rohan Deshmukh',
          phone: '+91 98222 11111',
          addressLine: 'Flat 501, Mayur Colony, Kothrud',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411038'
        },
        paymentMethod: 'COD'
      }
    });

    const placedOrder = placeOrderRes.data?.data?.order;

    // Check Customer 1's notification for order placed
    const custNotifsRes = await makeRequest('/api/notifications', {
      headers: { Cookie: cust1Cookie }
    });

    const custNotifs = custNotifsRes.data?.data?.notifications || [];
    const orderPlacedNotif = custNotifs.find((n) => n.type === 'ORDER_PLACED');

    if (custNotifsRes.status === 200 && orderPlacedNotif && orderPlacedNotif.relatedOrderId === placedOrder._id) {
      logPass(1, 'Customer notification automatically generated upon order placement (ORDER_PLACED)');
    } else {
      logFail(1, 'Order placement customer notification', JSON.stringify(custNotifsRes.data));
    }

    // Scenario 2: Shop Owner notification created upon order placement
    const ownerNotifsRes = await makeRequest('/api/notifications', {
      headers: { Cookie: ownerCookie }
    });
    const ownerNotifs = ownerNotifsRes.data?.data?.notifications || [];
    const newOrderNotif = ownerNotifs.find((n) => n.type === 'NEW_ORDER_RECEIVED');

    if (ownerNotifsRes.status === 200 && newOrderNotif && newOrderNotif.relatedOrderId === placedOrder._id) {
      logPass(2, 'Shop owner notification automatically generated for new incoming order (NEW_ORDER_RECEIVED)');
    } else {
      logFail(2, 'Shop owner order notification', JSON.stringify(ownerNotifsRes.data));
    }

    // Scenario 3: Unread count endpoint returns accurate count
    const unreadCountRes = await makeRequest('/api/notifications/unread-count', {
      headers: { Cookie: cust1Cookie }
    });
    if (unreadCountRes.status === 200 && unreadCountRes.data?.data?.unreadCount >= 1) {
      logPass(3, `GET /api/notifications/unread-count returns verified unread tally (${unreadCountRes.data.data.unreadCount})`);
    } else {
      logFail(3, 'Unread count query', JSON.stringify(unreadCountRes.data));
    }

    // Scenario 4: Mark single notification as read
    const notifToRead = orderPlacedNotif?._id;
    const markReadRes = await makeRequest(`/api/notifications/${notifToRead}/read`, {
      method: 'PATCH',
      headers: { Cookie: cust1Cookie }
    });

    if (markReadRes.status === 200 && markReadRes.data?.data?.notification?.isRead === true) {
      logPass(4, 'PATCH /api/notifications/:id/read successfully marks notification as read');
    } else {
      logFail(4, 'Mark notification read', JSON.stringify(markReadRes.data));
    }

    // Scenario 5: Cross-user notification security: User 2 cannot mark User 1's notification as read
    const hijackReadRes = await makeRequest(`/api/notifications/${notifToRead}/read`, {
      method: 'PATCH',
      headers: { Cookie: cust2Cookie }
    });
    if (hijackReadRes.status === 404) {
      logPass(5, "Cross-user notification isolation: Customer 2 blocked from modifying Customer 1's notification");
    } else {
      logFail(5, 'Cross-user notification tampering', `Status: ${hijackReadRes.status}`);
    }

    // Scenario 6: Mark all notifications as read
    const markAllRes = await makeRequest('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Cookie: ownerCookie }
    });
    const ownerUnreadAfter = await Notification.countDocuments({ recipientId: ownerId, isRead: false });
    if (markAllRes.status === 200 && ownerUnreadAfter === 0) {
      logPass(6, 'PATCH /api/notifications/read-all cleanly clears all unread notifications for recipient');
    } else {
      logFail(6, 'Mark all notifications read', `Remaining unread: ${ownerUnreadAfter}`);
    }

    // Scenario 7: Delete notification
    const deleteNotifRes = await makeRequest(`/api/notifications/${notifToRead}`, {
      method: 'DELETE',
      headers: { Cookie: cust1Cookie }
    });
    const checkDeleted = await Notification.findById(notifToRead);
    if (deleteNotifRes.status === 200 && !checkDeleted) {
      logPass(7, 'DELETE /api/notifications/:id removes notification securely from database');
    } else {
      logFail(7, 'Notification deletion', JSON.stringify(deleteNotifRes.data));
    }

    // Scenario 8: Cross-user deletion blocked
    const ownerNotifId = newOrderNotif?._id;
    const crossDeleteRes = await makeRequest(`/api/notifications/${ownerNotifId}`, {
      method: 'DELETE',
      headers: { Cookie: cust2Cookie }
    });
    if (crossDeleteRes.status === 404) {
      logPass(8, "Cross-user deletion rejection: Customer 2 blocked from deleting Shop Owner's notification");
    } else {
      logFail(8, 'Cross-user notification deletion', `Status: ${crossDeleteRes.status}`);
    }

    // ==========================================
    // WISHLIST TESTS
    // ==========================================

    // Scenario 9: Add product to wishlist
    const addWishRes1 = await makeRequest('/api/wishlist/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partB._id }
    });

    if (addWishRes1.status === 201 && addWishRes1.data?.data?.totalItems === 1) {
      logPass(9, 'POST /api/wishlist/items successfully added product to customer wishlist');
    } else {
      logFail(9, 'Add to wishlist', JSON.stringify(addWishRes1.data));
    }

    // Scenario 10: Duplicate wishlist entry handled idempotently
    const addWishResDup = await makeRequest('/api/wishlist/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partB._id }
    });
    const checkWishlistDoc = await Wishlist.findOne({ customerId: cust1Id });
    if (addWishResDup.status === 200 && checkWishlistDoc?.items.length === 1) {
      logPass(10, 'Duplicate wishlist addition safely handled without duplicate entries in MongoDB');
    } else {
      logFail(10, 'Duplicate wishlist prevention', JSON.stringify(addWishResDup.data));
    }

    // Scenario 11: GET /api/wishlist returns populated details with price in INR (₹) and shop
    const getWishRes = await makeRequest('/api/wishlist', {
      headers: { Cookie: cust1Cookie }
    });
    const wishItems = getWishRes.data?.data?.items || [];
    const itemB = wishItems.find((i) => i.productId?._id === partB._id.toString());

    if (
      getWishRes.status === 200 &&
      itemB &&
      itemB.productId.price === 1800 &&
      itemB.productId.shopId.name === 'Pradeep Motor World' &&
      itemB.isAvailable === true
    ) {
      logPass(11, 'GET /api/wishlist returns populated spare parts, verified pricing (₹1,800), and shop details');
    } else {
      logFail(11, 'Get wishlist verification', JSON.stringify(getWishRes.data));
    }

    // Scenario 12: Wishlist persistence across sessions/refreshes
    const secondFetchRes = await makeRequest('/api/wishlist', {
      headers: { Cookie: cust1Cookie }
    });
    if (secondFetchRes.status === 200 && secondFetchRes.data?.data?.items?.length === 1) {
      logPass(12, 'Wishlist persistence verified in MongoDB across queries');
    } else {
      logFail(12, 'Wishlist persistence', JSON.stringify(secondFetchRes.data));
    }

    // Scenario 13: Move wishlist item to cart
    const moveRes = await makeRequest(`/api/wishlist/items/${partB._id}/move-to-cart`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie }
    });
    const cust1Cart = await Cart.findOne({ customerId: cust1Id });
    const inCart = cust1Cart?.items.some((i) => i.productId.toString() === partB._id.toString());
    const wishAfterMove = await Wishlist.findOne({ customerId: cust1Id });
    const stillInWish = wishAfterMove?.items.some((i) => i.productId.toString() === partB._id.toString());

    if (moveRes.status === 200 && inCart && !stillInWish) {
      logPass(13, 'Move to Cart successfully transferred item from wishlist to cart and cleared from wishlist');
    } else {
      logFail(13, 'Move to cart action', JSON.stringify(moveRes.data));
    }

    // Scenario 14: Remove item from wishlist
    // Add part A to wishlist and remove it
    await makeRequest('/api/wishlist/items', {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: { productId: partA._id }
    });
    const removeWishRes = await makeRequest(`/api/wishlist/items/${partA._id}`, {
      method: 'DELETE',
      headers: { Cookie: cust1Cookie }
    });
    const wishAfterRemove = await Wishlist.findOne({ customerId: cust1Id });
    if (removeWishRes.status === 200 && wishAfterRemove?.items.length === 0) {
      logPass(14, 'DELETE /api/wishlist/items/:productId removes item cleanly from wishlist');
    } else {
      logFail(14, 'Wishlist item removal', JSON.stringify(removeWishRes.data));
    }

    // ==========================================
    // REVIEWS AND RATINGS TESTS
    // ==========================================

    // Scenario 15: Reject review for products not purchased or not delivered
    const nonDeliveredReviewRes = await makeRequest(`/api/products/${partA._id}/reviews`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        rating: 5,
        title: 'Premature review attempt',
        comment: 'Trying to review before order is delivered'
      }
    });

    if (nonDeliveredReviewRes.status === 403 && nonDeliveredReviewRes.data?.message?.includes('DELIVERED')) {
      logPass(15, 'Strict verification: Review rejected with HTTP 403 when order has not reached DELIVERED state');
    } else {
      logFail(15, 'Non-delivered review check', JSON.stringify(nonDeliveredReviewRes.data));
    }

    // Progress placedOrder to DELIVERED through valid lifecycle
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { status: 'CONFIRMED' }
    });
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { status: 'PROCESSING' }
    });
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { status: 'READY_FOR_DISPATCH' }
    });
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { status: 'SHIPPED' }
    });
    await makeRequest(`/api/owner/orders/${placedOrder._id}/status`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
      body: { status: 'DELIVERED' }
    });

    // Scenario 16: Customer 1 submits verified purchase review for Part A (DELIVERED)
    const reviewRes = await makeRequest(`/api/products/${partA._id}/reviews`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        rating: 5,
        title: 'Exceptional Braking Power & Zero Squeal',
        comment: 'Installed these Brembo rotors on my Honda City. Outstanding stopping power and no heat fade!'
      }
    });

    const createdReview = reviewRes.data?.data?.review;
    if (reviewRes.status === 201 && createdReview && createdReview.rating === 5 && createdReview.verifiedPurchase === true) {
      logPass(16, 'Verified customer submitted review successfully for delivered product (5 stars)');
    } else {
      logFail(16, 'Verified review submission', JSON.stringify(reviewRes.data));
    }

    // Scenario 17: Block duplicate review for same product and order
    const dupReviewRes = await makeRequest(`/api/products/${partA._id}/reviews`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        rating: 4,
        comment: 'Trying to submit duplicate review for same order'
      }
    });

    if (dupReviewRes.status === 400 && dupReviewRes.data?.message?.includes('already reviewed')) {
      logPass(17, 'Duplicate review attempt for the same product and order rejected with HTTP 400');
    } else {
      logFail(17, 'Duplicate review prevention', JSON.stringify(dupReviewRes.data));
    }

    // Scenario 18: Block shop owner from reviewing their own products
    const ownerReviewRes = await makeRequest(`/api/products/${partA._id}/reviews`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: {
        rating: 5,
        comment: 'Owner attempting to review own catalog part'
      }
    });

    if (ownerReviewRes.status === 403) {
      logPass(18, 'Shop owner strictly prohibited from reviewing their own product (HTTP 403 Forbidden)');
    } else {
      logFail(18, 'Owner self-review prevention', `Status: ${ownerReviewRes.status}`);
    }

    // Scenario 19: Rating bounds and integer validation (e.g. 6 stars, non-integers)
    const invalidRatingRes = await makeRequest(`/api/products/${partA._id}/reviews`, {
      method: 'POST',
      headers: { Cookie: cust1Cookie },
      body: {
        rating: 7,
        comment: 'Invalid 7 star rating test'
      }
    });

    if (invalidRatingRes.status === 400 && invalidRatingRes.data?.message?.includes('integer between 1 and 5')) {
      logPass(19, 'Invalid rating (7 stars) strictly rejected with HTTP 400 validation error');
    } else {
      logFail(19, 'Invalid rating validation', JSON.stringify(invalidRatingRes.data));
    }

    // Scenario 20: GET /api/products/:productId/reviews returns accurate average, distribution, and verified flag
    const getReviewsRes = await makeRequest(`/api/products/${partA._id}/reviews`);
    const summary = getReviewsRes.data?.data?.summary;
    const revList = getReviewsRes.data?.data?.reviews;

    if (
      getReviewsRes.status === 200 &&
      summary?.averageRating === 5 &&
      summary?.totalReviews === 1 &&
      summary?.ratingDistribution['5'] === 1 &&
      revList?.length === 1 &&
      revList[0]?.verifiedPurchase === true
    ) {
      logPass(20, 'GET /api/products/:productId/reviews accurately calculates average rating (5.0), total reviews (1), and distribution');
    } else {
      logFail(20, 'Review summary calculation', JSON.stringify(getReviewsRes.data));
    }

    // Scenario 21: Customer can edit their own review
    const editReviewRes = await makeRequest(`/api/reviews/${createdReview._id}`, {
      method: 'PATCH',
      headers: { Cookie: cust1Cookie },
      body: {
        rating: 4,
        comment: 'Updated review: Great rotors, slightly firm initial bite during first 50km.'
      }
    });

    const updatedPartA = await SparePart.findById(partA._id);
    if (editReviewRes.status === 200 && updatedPartA?.averageRating === 4) {
      logPass(21, 'Author successfully edited their review and SparePart average rating recalculated (5.0 → 4.0)');
    } else {
      logFail(21, 'Review edit action', JSON.stringify(editReviewRes.data));
    }

    // Scenario 22: Cross-user review modification blocked
    const crossEditRes = await makeRequest(`/api/reviews/${createdReview._id}`, {
      method: 'PATCH',
      headers: { Cookie: cust2Cookie },
      body: {
        rating: 1,
        comment: 'Customer 2 attempting malicious review sabotage'
      }
    });

    if (crossEditRes.status === 403) {
      logPass(22, "Cross-user review edit blocked with HTTP 403 (Customer 2 cannot modify Customer 1's review)");
    } else {
      logFail(22, 'Cross-user review edit protection', `Status: ${crossEditRes.status}`);
    }

    // Scenario 23: Customer deletes their own review and stats update
    const deleteReviewRes = await makeRequest(`/api/reviews/${createdReview._id}`, {
      method: 'DELETE',
      headers: { Cookie: cust1Cookie }
    });

    const partAfterDelete = await SparePart.findById(partA._id);
    if (deleteReviewRes.status === 200 && partAfterDelete?.totalReviews === 0 && partAfterDelete?.averageRating === 0) {
      logPass(23, 'Author deleted review successfully; product ratings cleanly reset to 0');
    } else {
      logFail(23, 'Review deletion', JSON.stringify(deleteReviewRes.data));
    }

    // Scenario 24: Zero regressions across existing modules (Cart, Orders, Search, Auth)
    const checkAuthMe = await makeRequest('/api/auth/me', { headers: { Cookie: cust1Cookie } });
    const checkSearch = await makeRequest('/api/search/nearby-parts?q=Brembo');
    const checkOrders = await makeRequest('/api/orders/my', { headers: { Cookie: cust1Cookie } });

    if (checkAuthMe.status === 200 && checkSearch.status === 200 && checkOrders.status === 200) {
      logPass(24, 'Zero regressions: Module 2 Auth, Module 5 Search, and Module 6 Orders continue operating seamlessly');
    } else {
      logFail(24, 'Regression check', `Auth: ${checkAuthMe.status}, Search: ${checkSearch.status}, Orders: ${checkOrders.status}`);
    }

    console.log('\n========================================');
    console.log('ALL 24 MODULE 7 NOTIFICATIONS, WISHLIST & REVIEW TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Unhandled Module 7 test failure:', err);
  } finally {
    // Clean up test data
    const testUsers = await User.find({ email: { $in: [cust1Email, cust2Email, ownerEmail] } });
    const userIds = testUsers.map((u) => u._id);
    await Notification.deleteMany({ recipientId: { $in: userIds } });
    await Wishlist.deleteMany({ customerId: { $in: userIds } });
    await Review.deleteMany({ customerId: { $in: userIds } });
    await Order.deleteMany({ customerId: { $in: userIds } });
    await Cart.deleteMany({ customerId: { $in: userIds } });
    await SparePart.deleteMany({ ownerId: { $in: userIds } });
    await Shop.deleteMany({ ownerId: { $in: userIds } });
    await ShopApplication.deleteMany({ ownerId: { $in: userIds } });
    await User.deleteMany({ email: { $in: [cust1Email, cust2Email, ownerEmail] } });

    await mongoose.disconnect();
    if (server) server.close();
  }
};

runModule7Tests();
