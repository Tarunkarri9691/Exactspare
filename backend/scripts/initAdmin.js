import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

const initAdmin = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  // Admin configuration parameters from environment variables or command-line arguments
  const adminName = process.env.ADMIN_NAME || 'Platform Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@exactspare.com').toLowerCase().trim();
  const adminPhone = process.env.ADMIN_PHONE || '+919876543210';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminExactSpare@2026';

  if (!adminPassword || adminPassword.length < 8) {
    logger.error('Admin password must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    logger.info('Connecting to MongoDB for admin initialization...');
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB.');

    // Check if an admin or user with this email already exists
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        logger.info(`Administrator account already exists for ${adminEmail}. Updating credentials...`);
        existingUser.passwordHash = await User.hashPassword(adminPassword);
        existingUser.accountStatus = 'ACTIVE';
        existingUser.name = adminName;
        existingUser.phone = adminPhone;
        await existingUser.save();
        logger.info(`Admin account credentials updated successfully for ${adminEmail}.`);
      } else {
        logger.warn(`User with email ${adminEmail} already exists as role [${existingUser.role}]. Elevating to ADMIN...`);
        existingUser.role = 'ADMIN';
        existingUser.passwordHash = await User.hashPassword(adminPassword);
        existingUser.accountStatus = 'ACTIVE';
        await existingUser.save();
        logger.info(`User elevated to ADMIN successfully.`);
      }
    } else {
      logger.info(`Creating new Administrator account for ${adminEmail}...`);
      const passwordHash = await User.hashPassword(adminPassword);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: 'ADMIN',
        accountStatus: 'ACTIVE'
      });
      logger.info(`Administrator created successfully with ID: ${newAdmin._id}`);
    }

    logger.info('Admin setup completed successfully.');
  } catch (error) {
    logger.error(`Error initializing administrator: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
    process.exit(0);
  }
};

initAdmin();
