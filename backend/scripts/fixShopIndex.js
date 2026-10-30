import mongoose from 'mongoose';

async function fixIndex() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const coll = mongoose.connection.db.collection('shops');
  const indexes = await coll.indexes();
  console.log('Existing indexes:', indexes.map(i => i.name));

  const hasAppIndex = indexes.some(i => i.name === 'applicationId_1');
  if (hasAppIndex) {
    console.log('Dropping index applicationId_1...');
    await coll.dropIndex('applicationId_1');
    console.log('Index applicationId_1 dropped successfully.');
  }

  // Re-create as sparse index so multiple nulls are allowed
  console.log('Creating sparse index on applicationId...');
  await coll.createIndex({ applicationId: 1 }, { sparse: true, background: true });
  console.log('Sparse index created successfully.');

  const updatedIndexes = await coll.indexes();
  console.log('Updated indexes:', updatedIndexes.map(i => ({ name: i.name, sparse: i.sparse, unique: i.unique })));

  await mongoose.disconnect();
}

fixIndex().catch(console.error);
