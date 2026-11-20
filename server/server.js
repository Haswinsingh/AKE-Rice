const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { bootstrapAdmin } = require('./services/bootstrapService');
const User = require('./models/User');
const Product = require('./models/Product');

// Import Route handlers
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const salesRoutes = require('./routes/salesRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const clientUrl = (process.env.CLIENT_URL || '').trim().replace(/\/$/, '');

const allowedOrigins = [
  'https://ake-ricestore.vercel.app',
  'https://ake-rice.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  clientUrl
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/$/, '');

    // 1. Exact match with configured allowed origins
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 2. Official Vercel deployment domains and preview branches
    if (/^https:\/\/ake-ricestore(-[a-z0-9-]+)?\.vercel\.app$/.test(cleanOrigin) ||
        /^https:\/\/ake-rice(-[a-z0-9-]+)?\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // 3. Localhost on any port in development
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // Reject unknown origin in production
    return callback(new Error(`CORS blocked: Origin ${origin} not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Session-Token',
    'X-Admin-Token',
    'X-Customer-Token',
    'X-Requested-With',
    'Accept'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static directory for uploaded files (screenshots, receipts, customer feedback images)
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// Rate limiting for auth and API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  validate: { default: false, ip: false },
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pos', salesRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Root service endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'AKE Rice REST API Backend Server',
    version: '2.0.0',
    frontend: 'https://ake-ricestore.vercel.app',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    appName: 'AKE Rice MERN Stack Platform',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Diagnostic & Trace endpoint (safe, non-sensitive)
app.get('/api/diagnostic', async (req, res) => {
  const mongoose = require('mongoose');
  const { getLastError } = require('./config/db');
  const Otp = require('./models/Otp');
  const otpCount = await Otp.countDocuments().catch(() => -1);
  const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const uri = process.env.MONGODB_URI || '';
  
  res.status(200).json({
    status: 'online',
    version: '2.0.2',
    buildId: 'BUILD-OTP-DIAG-20261120',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongo: {
      readyState: mongoose.connection ? mongoose.connection.readyState : 0,
      readyStateText: stateNames[mongoose.connection ? mongoose.connection.readyState : 0] || 'unknown',
      host: mongoose.connection ? mongoose.connection.host : null,
      dbName: mongoose.connection ? mongoose.connection.name : null,
      hasMongoUriEnv: !!process.env.MONGODB_URI,
      isPlaceholderUri: uri.includes('<db_username>'),
      lastConnectionError: getLastError()
    },
    otpsInCollection: otpCount,
    models: mongoose.models ? Object.keys(mongoose.models) : []
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Seed default admin and products
async function seedInitialData() {
  try {
    // 1. Ensure Super Admin account is seeded and verified
    await bootstrapAdmin();

    // 2. Ensure Default Products exist
    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      await Product.insertMany([
        {
          id: '1kg',
          name: '1 KG Rice',
          tamilName: '1 கிலோ கொப்பம்பட்டி சீரக சம்பா அரிசி',
          description: 'Authentic Koppampatty Seeraga Samba Rice packed fresh in 1 KG zipper aroma-lock pouch. Ideal for family feasts and traditional biryani.',
          packageSize: '1 KG Pouch',
          unitWeightKg: 1,
          price: 200,
          ratePerKg: 200,
          image: 'assets/packet_1kg.jpg',
          additionalImages: ['assets/packet_original.jpg', 'assets/manual_packing.jpg'],
          stock: 500,
          isAvailable: true,
          highlights: [
            '100% Traditional Koppampatty Harvest',
            'Small, intensely fragrant aromatic grain',
            'Rich in fiber, easy digestibility',
            'FSSAI Certified Quality Assurance'
          ]
        },
        {
          id: '25kg',
          name: '25 KG Rice',
          tamilName: '25 கிலோ கொப்பம்பட்டி சீரக சம்பா அரிசி மூட்டை',
          description: 'Wholesale & family bulk 25 KG woven sack of authentic Koppampatty Seeraga Samba Rice at special wholesale rate of ₹190/KG.',
          packageSize: '25 KG Bulk Bag',
          unitWeightKg: 25,
          price: 4750,
          ratePerKg: 190,
          image: 'assets/packet_25kg.jpg',
          additionalImages: ['assets/packet_original.jpg', 'assets/about_processing.jpg'],
          stock: 250,
          isAvailable: true,
          highlights: [
            'Wholesale bulk pricing (Save ₹250 per bag)',
            'Direct farm-to-door bulk packaging',
            'Moisture-resistant heavy duty woven bag',
            'Ideal for restaurants, caterers, and large events'
          ]
        }
      ]);
      console.log('[Seed] Default products seeded successfully.');
    }
  } catch (error) {
    console.error('[Seed Error]:', error.message);
  }
}

// Start Server
async function startServer() {
  await connectDB();
  await seedInitialData();

  return app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌾 AKE Rice MERN REST API Server running on port ${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
