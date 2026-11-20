const app = require('../server/server');
const { connectDB } = require('../server/config/db');

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('[Vercel DB Connection Error]:', err.message);
    }
  }
  return app(req, res);
};
