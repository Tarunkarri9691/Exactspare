import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  getAnalyticsOverview,
  getSalesAnalytics,
  getOrderAnalytics,
  getProductAnalytics,
  getInventoryAnalytics,
  getShopAnalytics,
  getCustomerAnalytics,
  exportOrdersCsv,
  exportInventoryCsv,
  exportShopsCsv,
  exportCustomersCsv
} from '../controllers/adminAnalyticsController.js';
import {
  getAdminShops,
  getAdminShopDetails,
  updateAdminShopStatus,
  getAdminShopParts,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserStatus,
  getAdminParts,
  moderateAdminPart,
  getAdminReviews,
  moderateAdminReview,
  getAdminAuditLogs
} from '../controllers/adminManagementController.js';

const router = express.Router();

// Strict Admin-only middleware applied to all routes in this router
router.use(authenticateUser, authorizeRoles('ADMIN'));

/* ========================================================
   1. ANALYTICS & REPORTS ENDPOINTS (MODULE 16)
   ======================================================== */
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/sales', getSalesAnalytics);
router.get('/analytics/orders', getOrderAnalytics);
router.get('/analytics/products', getProductAnalytics);
router.get('/analytics/inventory', getInventoryAnalytics);
router.get('/analytics/shops', getShopAnalytics);
router.get('/analytics/customers', getCustomerAnalytics);

/* CSV REPORT EXPORT ENDPOINTS (ADMIN-PROTECTED) */
router.get('/reports/orders.csv', exportOrdersCsv);
router.get('/reports/inventory.csv', exportInventoryCsv);
router.get('/reports/shops.csv', exportShopsCsv);
router.get('/reports/customers.csv', exportCustomersCsv);

/* ========================================================
   2. SHOP MANAGEMENT ENDPOINTS
   ======================================================== */
router.get('/shops', getAdminShops);
router.get('/shops/:id', getAdminShopDetails);
router.patch('/shops/:id/status', updateAdminShopStatus);
router.get('/shops/:id/parts', getAdminShopParts);

/* ========================================================
   3. USER MANAGEMENT ENDPOINTS
   ======================================================== */
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserDetails);
router.patch('/users/:id/status', updateAdminUserStatus);

/* ========================================================
   4. SPARE PART MODERATION ENDPOINTS
   ======================================================== */
router.get('/parts', getAdminParts);
router.patch('/parts/:id/moderate', moderateAdminPart);

/* ========================================================
   5. REVIEW MODERATION ENDPOINTS
   ======================================================== */
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/moderate', moderateAdminReview);

/* ========================================================
   6. AUDIT LOGS ENDPOINT
   ======================================================== */
router.get('/audit-logs', getAdminAuditLogs);

export default router;
