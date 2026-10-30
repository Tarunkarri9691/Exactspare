import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import shopApplicationRoutes from './routes/shopApplicationRoutes.js';
import adminApplicationRoutes from './routes/adminApplicationRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import partRoutes from './routes/partRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import ownerOrderRoutes from './routes/ownerOrderRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import productReviewRoutes from './routes/productReviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import adminSupportRoutes from './routes/adminSupportRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminTrustRoutes from './routes/adminTrustRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import helmet from 'helmet';
import notFoundHandler from './middleware/notFoundHandler.js';
import errorHandler from './middleware/errorHandler.js';
import validateOriginCSRF from './middleware/csrfMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { performanceLogger } from './middleware/performanceLogger.js';
import { SHOPS_DIR, PARTS_DIR } from './utils/upload.js';
import { logger } from './utils/logger.js';
import requireDatabaseConnection from './middleware/dbCheckMiddleware.js';

const app = express();

// Security Headers: Helmet protection with cross-origin asset policy for uploaded images
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // API backend; CSP handled at frontend/gateway level
}));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });
}

// CORS Configuration (Strict credentials support with dynamic origin validation)
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOriginsList = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman, test scripts)
    if (!origin) {
      return callback(null, true);
    }
    const originClean = origin.replace(/\/$/, '').toLowerCase();
    // Always allow localhost / 127.0.0.1 on any port during development
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(originClean);
    if (isLocalhost) {
      return callback(null, true);
    }
    // Allow configured production origins
    const isAllowed = allowedOriginsList.some(o => o && o.replace(/\/$/, '').toLowerCase() === originClean);
    if (isAllowed) {
      return callback(null, true);
    }
    // Disallow without crashing server
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
}));

// Body Parsing Middleware with size limits protecting against large payload DoS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cookie Parsing Middleware
app.use(cookieParser());

// CSRF Origin Protection Middleware
app.use(validateOriginCSRF);

// Global Performance and Latency Tracking Middleware
app.use(performanceLogger);

// Global General API Rate Limiting for public endpoints
app.use('/api', apiLimiter);

// Serve Public Shop and Spare Part Photographs (Private verification documents are NOT served statically)
app.use('/uploads/shops', express.static(SHOPS_DIR));
app.use('/uploads/parts', express.static(PARTS_DIR));

// Base Route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'EXACTSPARE API',
    tagline: 'Vehicle Spare Parts Finder',
    version: '2.0.0',
    module: 'Module 12 - Final Integration, Testing, Bug Fixes & Documentation',
    status: 'operational',
    documentation: {
      health: '/api/health',
      databaseHealth: '/api/health/db',
      auth: '/api/auth',
      users: '/api/users',
      shopApplications: '/api/shop-applications',
      adminShopApplications: '/api/admin/shop-applications',
      shops: '/api/shops',
      parts: '/api/parts',
      search: '/api/search',
      cart: '/api/cart',
      orders: '/api/orders',
      ownerOrders: '/api/owner/orders',
      notifications: '/api/notifications',
      wishlist: '/api/wishlist',
      reviews: '/api/reviews',
      productReviews: '/api/products/:productId/reviews',
      admin: '/api/admin',
      ai: '/api/ai',
      recommendations: '/api/recommendations'
    }
  });
});

// Mount API Routes
app.use('/api/health', healthRoutes);

// Database check: fail fast with clean 503 instead of hanging for 10s if MongoDB is down
app.use('/api', requireDatabaseConnection);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', userRoutes);
app.use('/api/shop-applications', shopApplicationRoutes);
app.use('/api/admin/shop-applications', adminApplicationRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/owner/orders', ownerOrderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/products', productReviewRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/trust', adminTrustRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Centralized 404 Route Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
