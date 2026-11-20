const app = require('../server');
const { connectDB } = require('../config/db');
const { bootstrapAdmin } = require('../services/bootstrapService');
const mongoose = require('mongoose');

let isBootstrapped = false;

module.exports = async (req, res) => {
  // Ensure database connection is active for each serverless invocation
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('[Vercel Serverless DB Error]:', err.message);
    }
  }

  // Ensure Super Admin alignment runs on container initialization
  if (!isBootstrapped) {
    try {
      await bootstrapAdmin();
      isBootstrapped = true;
    } catch (err) {
      console.error('[Vercel Serverless Bootstrap Error]:', err.message);
    }
  }

  return app(req, res);
};
