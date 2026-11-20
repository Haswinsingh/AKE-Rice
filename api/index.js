const app = require('../server/server');
const { connectDB } = require('../server/config/db');

let isDbConnected = false;

module.exports = async (req, res) => {
  if (!isDbConnected) {
    try {
      await connectDB();
      isDbConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless DB Error]:', err.message);
    }
  }
  return app(req, res);
};
