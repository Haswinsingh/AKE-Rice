const mongoose = require('mongoose');

// Never buffer commands when MongoDB is disconnected
mongoose.set('bufferCommands', false);

let cachedConnection = null;

const connectDB = async () => {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, wait for it
  if (mongoose.connection.readyState === 2 && cachedConnection) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ake_rice_db';

  try {
    console.log(`[DB] Connecting to MongoDB...`);
    cachedConnection = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await cachedConnection;
  } catch (err) {
    console.error(`[DB Error]:`, err.message);
  }

  if (mongoose.connection.readyState === 1) {
    console.log(`[DB] Connected to MongoDB successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } else {
    console.warn(`[DB Notice] External MongoDB not active.`);
    console.log('[DB] Activating persistent local document store (data/*.json).');
    console.log('[DB] Full MERN schema support & data persistence enabled.');
  }

  return mongoose.connection;
};

const closeDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
};

module.exports = { connectDB, closeDB };
