const mongoose = require('mongoose');

// Never buffer commands when MongoDB is disconnected
mongoose.set('bufferCommands', false);

// Global connection cache for serverless environments (Vercel, AWS Lambda)
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null, lastError: null };
}

const getLastError = () => cached.lastError;

const connectDB = async () => {
  // 1. If connection is already open and ready, return it immediately
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. If a cached connection is open, return it
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ake_rice_db';

  if (uri.includes('<db_username>')) {
    cached.lastError = 'Placeholder <db_username> detected in MONGODB_URI environment variable.';
    console.warn(`[DB Notice] ${cached.lastError} Activating persistent local document store.`);
    return mongoose.connection;
  }

  // 3. If no connection promise in flight, initiate connection
  if (!cached.promise) {
    console.log('[DB] Connecting to MongoDB Atlas...');
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      maxPoolSize: 10,
      socketTimeoutMS: 30000,
    };

    cached.promise = mongoose.connect(uri, opts)
      .then((m) => {
        cached.lastError = null;
        console.log(`[DB] Connected to MongoDB successfully: ${m.connection.host}/${m.connection.name}`);
        return m.connection;
      })
      .catch((err) => {
        cached.promise = null; // Clear so subsequent invocations can retry
        cached.lastError = err.message;
        console.error('[DB Error]: Failed to connect to MongoDB:', err.message);
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    cached.lastError = err.message;
    console.error('[DB Connect Await Error]:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    cached.lastError = null;
    return mongoose.connection;
  } else {
    console.warn('[DB Notice] External MongoDB not active. Persistent local document store active.');
    return mongoose.connection;
  }
};

const closeDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  cached.conn = null;
  cached.promise = null;
};

module.exports = { connectDB, closeDB, getLastError };
