import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import { generateToken, sendAuthCookie } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { getAdminUsers } from '../controllers/adminManagementController.js';

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
 * Update Authenticated User Profile & Preferences
 * Allows updating name, phone, saved vehicle, and default location
 */
router.patch('/profile', authenticateUser, async (req, res, next) => {
  try {
    const { name, phone, savedVehicle, defaultLocation } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'User account not found.'
      });
    }

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      user.name = name.trim().slice(0, 100);
    }

    if (phone && typeof phone === 'string') {
      const cleanPhone = phone.trim().replace(/[\s\-\(\)\.]/g, '');
      if (/^[0-9+]{7,20}$/.test(cleanPhone)) {
        user.phone = cleanPhone;
      }
    }

    if (savedVehicle && typeof savedVehicle === 'object') {
      user.savedVehicle = {
        vehicleType: savedVehicle.vehicleType || user.savedVehicle?.vehicleType || 'ALL',
        make: (savedVehicle.make || '').trim().slice(0, 50),
        model: (savedVehicle.model || '').trim().slice(0, 50),
        year: (savedVehicle.year || '').trim().slice(0, 10),
        variant: (savedVehicle.variant || '').trim().slice(0, 50)
      };
    }

    if (defaultLocation && typeof defaultLocation === 'object') {
      user.defaultLocation = {
        address: (defaultLocation.address || '').trim().slice(0, 200),
        city: (defaultLocation.city || '').trim().slice(0, 100),
        postalCode: (defaultLocation.postalCode || '').trim().slice(0, 20),
        latitude: typeof defaultLocation.latitude === 'number' ? defaultLocation.latitude : null,
        longitude: typeof defaultLocation.longitude === 'number' ? defaultLocation.longitude : null
      };
    }

    await user.save();

    const userData = user.toJSON();
    res.status(200).json({
      status: 'ok',
      message: 'Profile updated successfully.',
      profile: userData,
      user: userData,
      data: { user: userData }
    });
  } catch (error) {
    next(error);
  }
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
/**
 * Upgrade authenticated user to OWNER role
 * Automatically provisions an active and approved Shop record
 * @route POST /api/users/upgrade-to-owner
 */
router.post('/upgrade-to-owner', authenticateUser, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    user.role = 'OWNER';
    await user.save();

    // Auto-create or ensure active approved Shop for this user
    let shop = await Shop.findOne({ ownerId: user._id });
    if (!shop) {
      shop = await Shop.create({
        ownerId: user._id,
        name: `${user.name}'s Auto Spares`,
        category: 'MULTI_CATEGORY',
        description: `${user.name}'s verified spare parts shop.`,
        address: {
          addressLine: 'Main Road',
          city: 'Hyderabad',
          state: 'Telangana',
          postalCode: '500001',
          location: {
            type: 'Point',
            coordinates: [78.4867, 17.3850]
          }
        },
        contact: {
          phone: user.phone || '9999999999',
          email: user.email
        },
        openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: [],
        isApproved: true,
        isActive: true,
        approvedAt: new Date()
      });
    } else {
      shop.isApproved = true;
      shop.isActive = true;
      await shop.save();
    }

    // Re-issue JWT with new OWNER role and send auth cookie
    const token = generateToken({ id: user._id, role: 'OWNER' });
    sendAuthCookie(res, token);

    logger.info(`User ${user.email} successfully upgraded to role OWNER`);

    res.status(200).json({
      status: 'ok',
      message: 'Account successfully upgraded to Shop Owner.',
      user: user.toJSON(),
      shop
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/users', authenticateUser, authorizeRoles('ADMIN'), getAdminUsers);

export default router;
