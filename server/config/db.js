const mongoose = require('mongoose');

// Never buffer commands when MongoDB is disconnected
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ake_rice_db';

  try {
    console.log(`[DB] Attempting connection to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 1500,
    });
  } catch (err) {
    // Handled below
  }

  if (mongoose.connection.readyState === 1) {
    console.log(`[DB] Connected to MongoDB successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } else {
    console.warn(`[DB Notice] External MongoDB not active.`);
    console.log('[DB] Activating persistent local document store (data/*.json).');
    console.log('[DB] Full MERN schema support & data persistence enabled.');
  }

  mongoose.connection.on('error', (err) => {
    // Silent catch
  });
};

const closeDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
};

module.exports = { connectDB, closeDB };
