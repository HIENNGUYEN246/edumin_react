import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('Missing MONGO_URI in backend/.env');
  process.exit(1);
}

async function inspect() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    console.log('Database:', db.databaseName);
    console.log('Collections:', cols.map((c) => c.name).join(', '));
    for (const col of cols) {
      const docs = await db.collection(col.name).find({}).limit(3).toArray();
      console.log(`\nCollection: ${col.name}`);
      console.log(JSON.stringify(docs, null, 2));
    }
    await mongoose.disconnect();
  } catch (error) {
    console.error('Inspect error:', error);
    process.exit(1);
  }
}

inspect();
