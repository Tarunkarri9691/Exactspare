import mongoose from 'mongoose';

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const shopIndexes = await mongoose.connection.db.collection('shops').indexes();
  console.log('Shop collection indexes:\n', JSON.stringify(shopIndexes, null, 2));

  // Find user ramvehicles@gmail.com
  const users = await mongoose.connection.db.collection('users').find({
    email: 'ramvehicles@gmail.com'
  }).toArray();
  console.log('User ramvehicles found:', JSON.stringify(users, null, 2));

  for (const u of users) {
    console.log(`\n=================== USER: ${u.email} (${u._id}) ===================`);
    const app = await mongoose.connection.db.collection('shopapplications').findOne({ ownerId: u._id });
    console.log('ShopApplication:', JSON.stringify(app, null, 2));

    const shop = await mongoose.connection.db.collection('shops').findOne({ ownerId: u._id });
    console.log('Shop:', JSON.stringify(shop, null, 2));

    const subs = await mongoose.connection.db.collection('subscriptions').find({ ownerId: u._id }).toArray();
    console.log('Subscriptions:', JSON.stringify(subs, null, 2));
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);
