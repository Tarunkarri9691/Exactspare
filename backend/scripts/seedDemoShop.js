import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import { logger } from '../utils/logger.js';

const seedDemoShop = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI missing');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB for demo seeding...');

    // 1. Ensure approved owner user
    const ownerEmail = 'owner.demo@exactspare.com';
    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      const passwordHash = await User.hashPassword('OwnerExactSpare@2026');
      owner = await User.create({
        name: 'Vikram Auto Ventures',
        email: ownerEmail,
        phone: '+919820011223',
        passwordHash,
        role: 'OWNER',
        accountStatus: 'ACTIVE'
      });
      logger.info(`Created demo owner user: ${ownerEmail}`);
    }

    // 2. Ensure ShopApplication exists and is approved
    let app = await ShopApplication.findOne({ ownerId: owner._id });
    if (!app) {
      app = await ShopApplication.create({
        ownerId: owner._id,
        shopName: 'Apex Motor Spares & Service',
        ownerFullName: 'Vikram Auto Ventures',
        ownerPhone: '+919820011223',
        businessEmail: ownerEmail,
        shopDescription: 'Authorized retailer and distributor of genuine OEM & aftermarket automotive spares in Mumbai.',
        shopCategory: 'MULTI_CATEGORY',
        addressLine: 'Unit 4B, Automobile Market, Kurla West',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400070',
        latitude: 19.0688,
        longitude: 72.8804,
        openingHours: 'Mon-Sat: 09:00 AM - 08:30 PM',
        status: 'APPROVED',
        statusHistory: [
          {
            status: 'APPROVED',
            changedBy: owner._id,
            note: 'Approved during initialization'
          }
        ]
      });
    }

    // 3. Ensure approved Shop exists
    let shop = await Shop.findOne({ ownerId: owner._id });
    if (!shop) {
      shop = await Shop.create({
        ownerId: owner._id,
        applicationId: app._id,
        name: 'Apex Motor Spares & Service',
        shopName: 'Apex Motor Spares & Service',
        description: 'Authorized retailer and distributor of genuine OEM & aftermarket automotive spares in Mumbai.',
        category: 'MULTI_CATEGORY',
        contact: {
          phone: '+919820011223',
          email: ownerEmail
        },
        address: {
          addressLine: 'Unit 4B, Automobile Market, Kurla West',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400070',
          location: {
            type: 'Point',
            coordinates: [72.8804, 19.0688]
          }
        },
        openingHours: 'Mon-Sat: 09:00 AM - 08:30 PM, Sun: 10:00 AM - 02:00 PM',
        imagePaths: [],
        isApproved: true,
        isActive: true
      });
      logger.info(`Created demo shop: ${shop.shopName}`);
    } else {
      shop.isApproved = true;
      shop.isActive = true;
      await shop.save();
    }

    // 4. Ensure some starter spare parts exist
    const partsCount = await SparePart.countDocuments({ shopId: shop._id });
    if (partsCount === 0) {
      await SparePart.create([
        {
          shopId: shop._id,
          ownerId: owner._id,
          partName: 'Brembo Front Ceramic Brake Pad Set',
          description: 'High-performance ceramic brake pads with anti-squeal shims. Engineered for heat resistance and minimal dust.',
          category: 'BRAKES',
          subcategory: 'Brake Pads',
          vehicleType: 'Car',
          compatibleMakes: ['Honda', 'Hyundai'],
          compatibleModels: ['City Gen 4 & 5', 'Verna 1.6'],
          compatibleYears: [2017, 2018, 2019, 2020, 2021, 2022],
          engineDetails: '1.5L i-VTEC / 1.6L CRDi',
          manufacturer: 'Brembo Automotive',
          partNumber: 'P-28-023N',
          condition: 'NEW',
          price: 2450,
          stockQuantity: 18,
          isPublished: true,
          availabilityStatus: 'IN_STOCK'
        },
        {
          shopId: shop._id,
          ownerId: owner._id,
          partName: 'Bosch High Flow Oil Filter Cartridge',
          description: 'OEM grade oil filter offering 99% filtration efficiency for engine protection.',
          category: 'ENGINE',
          subcategory: 'Filters',
          vehicleType: 'Car',
          compatibleMakes: ['Maruti Suzuki', 'Toyota'],
          compatibleModels: ['Swift', 'Baleno', 'Glanza'],
          compatibleYears: [2018, 2019, 2020, 2021, 2022, 2023],
          engineDetails: '1.2L K-Series DualJet',
          manufacturer: 'Bosch India',
          partNumber: '0986AF0043',
          condition: 'NEW',
          price: 340,
          stockQuantity: 45,
          isPublished: true,
          availabilityStatus: 'IN_STOCK'
        },
        {
          shopId: shop._id,
          ownerId: owner._id,
          partName: 'NGK Laser Iridium Spark Plug (Pack of 4)',
          description: 'Premium laser-welded iridium center electrode for superior ignition and fuel efficiency.',
          category: 'ELECTRICAL',
          subcategory: 'Ignition',
          vehicleType: 'Bike',
          compatibleMakes: ['KTM', 'Bajaj'],
          compatibleModels: ['Duke 390', 'Dominar 400'],
          compatibleYears: [2019, 2020, 2021, 2022, 2023, 2024],
          engineDetails: '373cc Single Cylinder DOHC',
          manufacturer: 'NGK Spark Plugs',
          partNumber: 'LKAR8A-9',
          condition: 'NEW',
          price: 1199,
          stockQuantity: 0,
          isPublished: true,
          availabilityStatus: 'OUT_OF_STOCK'
        }
      ]);
      logger.info('Created 3 starter spare parts for demo shop');
    }

    logger.info('Demo shop seeding complete!');
    logger.info('Demo Credentials:');
    logger.info('  Email:    owner.demo@exactspare.com');
    logger.info('  Password: OwnerExactSpare@2026');
  } catch (err) {
    logger.error(`Error seeding demo shop: ${err.message}`);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDemoShop();
