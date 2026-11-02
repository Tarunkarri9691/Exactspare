import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const resetCustomer = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const passwordHash = await bcrypt.hash('CustomerExactSpare@2026', 10);

  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: 'customer@exactspare.com' },
    {
      $set: {
        name: 'Demo Customer',
        email: 'customer@exactspare.com',
        role: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        passwordHash
      }
    },
    { upsert: true }
  );

  console.log('Successfully set customer@exactspare.com to role CUSTOMER:', result);

  const updatedUser = await mongoose.connection.db.collection('users').findOne({ email: 'customer@exactspare.com' });
  console.log('Current user in DB:', {
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role
  });

  await mongoose.disconnect();
};

resetCustomer().catch(console.error);

