import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import Subscription from '../models/Subscription.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find all owners
  const owners = await User.find({ role: 'OWNER' });
  console.log(`Checking ${owners.length} owners...`);

  for (const owner of owners) {
    const activeSub = await Subscription.findOne({
      ownerId: owner._id,
      status: 'ACTIVE',
      expiryDate: { $gt: new Date() }
    });
    const hasActiveSub = !!activeSub;

    let app = await ShopApplication.findOne({ ownerId: owner._id });
    if (!app) {
      console.log(`Creating default approved ShopApplication for owner ${owner.email} (${owner.name})...`);
      app = await ShopApplication.create({
        ownerId: owner._id,
        shopName: owner.name ? `${owner.name}'s Auto Spares` : 'Auto Spares Shop',
        ownerFullName: owner.name || 'Store Owner',
        ownerPhone: owner.phone || '9999999999',
        businessEmail: owner.email,
        shopDescription: 'Automotive spare parts retail shop and accessories.',
        addressLine: 'Main Road',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500001',
        country: 'India',
        latitude: 17.3850,
        longitude: 78.4867,
        openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
        shopCategory: 'MULTI_CATEGORY',
        status: 'APPROVED',
        directActivated: true,
        submittedAt: new Date(),
        reviewedAt: new Date()
      });
      console.log(`ShopApplication created: ${app._id}`);
    } else if (app.status !== 'APPROVED') {
      app.status = 'APPROVED';
      await app.save();
      console.log(`Updated ShopApplication to APPROVED for owner ${owner.email}`);
    }

    let shop = await Shop.findOne({ ownerId: owner._id });
    if (!shop) {
      console.log(`Creating Shop for owner ${owner.email}...`);
      shop = await Shop.create({
        ownerId: owner._id,
        applicationId: app._id,
        name: app.shopName || `${owner.name}'s Auto Spares`,
        category: app.shopCategory || 'MULTI_CATEGORY',
        description: app.shopDescription || 'Automotive spare parts retail shop',
        address: {
          addressLine: app.addressLine || 'Main Road',
          city: app.city || 'Hyderabad',
          state: app.state || 'Telangana',
          postalCode: app.postalCode || '500001',
          location: {
            type: 'Point',
            coordinates: [app.longitude || 78.4867, app.latitude || 17.3850]
          }
        },
        contact: {
          phone: app.ownerPhone || owner.phone || '9999999999',
          email: app.businessEmail || owner.email
        },
        openingHours: app.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
        images: app.shopImagePaths || [],
        isApproved: true,
        isActive: hasActiveSub,
        approvedAt: new Date()
      });
      console.log(`Shop created: ${shop._id} (isActive: ${shop.isActive})`);
    } else {
      let changed = false;
      if (!shop.applicationId && app?._id) {
        shop.applicationId = app._id;
        changed = true;
      }
      if (!shop.isApproved) {
        shop.isApproved = true;
        changed = true;
      }
      if (shop.isActive !== hasActiveSub) {
        shop.isActive = hasActiveSub;
        changed = true;
      }
      if (changed) {
        await shop.save();
        console.log(`Updated Shop for owner ${owner.email}: isApproved=${shop.isApproved}, isActive=${shop.isActive}`);
      }
    }

    // Link shopId in subscriptions
    if (shop?._id) {
      await Subscription.updateMany(
        { ownerId: owner._id, shopId: null },
        { $set: { shopId: shop._id } }
      );
    }
  }

  console.log('Repair complete!');
  await mongoose.disconnect();
}

repair().catch(console.error);
