import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Common Authenticated User Profile Endpoint
 * Accessible by CUSTOMER, OWNER, ADMIN
 */
router.get('/profile', authenticateUser, (req, res) => {
  res.status(200).json({
    status: 'ok',
    profile: req.user.toJSON()
  });
});

/**
 * Customer Specific Dashboard Data
 * Accessible only by CUSTOMER
 */
router.get('/customer/dashboard-data', authenticateUser, authorizeRoles('CUSTOMER'), (req, res) => {
  res.status(200).json({
    status: 'ok',
    role: 'CUSTOMER',
    message: 'Welcome to your Customer Dashboard.',
    data: {
      recentOrders: [], // Placeholder for Module 6
      savedShops: [],
      suggestedCategories: ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other']
    }
  });
});

/**
 * Shop Owner Specific Dashboard Data
 * Accessible only by OWNER
 */
router.get('/owner/dashboard-data', authenticateUser, authorizeRoles('OWNER'), (req, res) => {
  res.status(200).json({
    status: 'ok',
    role: 'OWNER',
    message: 'Welcome to your Shop Owner Portal.',
    data: {
      shopApplicationStatus: 'NOT_SUBMITTED', // Placeholder for Module 4 application flow
      accountStatus: req.user.accountStatus,
      notice: 'Shop publishing, inventory listing, and customer orders require administrative approval.'
    }
  });
});

/**
 * Administrator Specific Dashboard Data
 * Accessible only by ADMIN
 */
router.get('/admin/dashboard-data', authenticateUser, authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const customerCount = await User.countDocuments({ role: 'CUSTOMER' });
    const ownerCount = await User.countDocuments({ role: 'OWNER' });
    const adminCount = await User.countDocuments({ role: 'ADMIN' });

    res.status(200).json({
      status: 'ok',
      role: 'ADMIN',
      message: 'Administrative Control Center',
      stats: {
        totalUsers: customerCount + ownerCount + adminCount,
        customers: customerCount,
        shopOwners: ownerCount,
        administrators: adminCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Administrator List Users Endpoint
 * Accessible only by ADMIN
 */
router.get('/admin/users', authenticateUser, authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(50);
    res.status(200).json({
      status: 'ok',
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
});

export default router;
