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
import notFoundHandler from './middleware/notFoundHandler.js';
import errorHandler from './middleware/errorHandler.js';
import validateOriginCSRF from './middleware/csrfMiddleware.js';
import { SHOPS_DIR, PARTS_DIR } from './utils/upload.js';
import { logger } from './utils/logger.js';

const app = express();

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });
}

// CORS Configuration (Strict credentials support with dynamic origin validation)
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const localDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman) or matching origin
    if (!origin || origin === allowedOrigin || localDevOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Body Parsing Middleware
app.use(express.json());

// Cookie Parsing Middleware
app.use(cookieParser());

// CSRF Origin Protection Middleware
app.use(validateOriginCSRF);

// Serve Public Shop and Spare Part Photographs (Private verification documents are NOT served statically)
app.use('/uploads/shops', express.static(SHOPS_DIR));
app.use('/uploads/parts', express.static(PARTS_DIR));

// Base Route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'EXACTSPARE API',
    tagline: 'Vehicle Spare Parts Finder',
    version: '1.4.0',
    module: 'Module 6 - Cart, Checkout, Orders & Order Management',
    documentation: {
      health: '/api/health',
      databaseHealth: '/api/health/db',
      auth: '/api/auth',
      shopApplications: '/api/shop-applications',
      adminShopApplications: '/api/admin/shop-applications',
      shops: '/api/shops',
      parts: '/api/parts',
      search: '/api/search/nearby-parts',
      cart: '/api/cart',
      orders: '/api/orders',
      ownerOrders: '/api/owner/orders',
      notifications: '/api/notifications'
    }
  });
});

// Mount API Routes
app.use('/api/health', healthRoutes);
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
app.use('/api/admin', adminRoutes);

// Centralized 404 Route Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
