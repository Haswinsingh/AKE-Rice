const app = require('../server');
const { connectDB } = require('../config/db');
const mongoose = require('mongoose');

module.exports = async (req, res) => {
  // Ensure database connection is active for each serverless invocation
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('[Vercel Serverless DB Error]:', err.message);
    }
  }
  return app(req, res);
};
