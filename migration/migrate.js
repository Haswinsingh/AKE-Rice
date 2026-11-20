const fs = require('fs');
const path = require('path');
module.paths.push(path.join(__dirname, '..', 'server', 'node_modules'));
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const { connectDB, closeDB } = require('../server/config/db');
const User = require('../server/models/User');
const Product = require('../server/models/Product');
const Feedback = require('../server/models/Feedback');
const Order = require('../server/models/Order');
const Counter = require('../server/models/Counter');

const BACKUP_DIR = path.join(__dirname, 'backup');

async function runMigration() {
  console.log('===========================================================');
  console.log('🌾 AKE RICE DATA MIGRATION SCRIPT');
  console.log('===========================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    await connectDB();
    console.log('[Migration] Database connection established.');

    // 1. Migrate Customers
    const customersFile = path.join(BACKUP_DIR, 'customers.json');
    if (fs.existsSync(customersFile)) {
      let customersRaw = fs.readFileSync(customersFile, 'utf-8').replace(/^\uFEFF/, '');
      const customers = JSON.parse(customersRaw);
      console.log(`[Migration] Found ${customers.length} customer records in customers.json`);

      let custImported = 0;
      let custSkipped = 0;

      for (const c of customers) {
        const cleanMobile = (c.mobile || '').toString().trim().replace(/\D/g, '').slice(-10);
        const existing = await User.findOne({
          $or: [
            ...(c.id ? [{ id: c.id }] : []),
            ...(cleanMobile ? [{ mobile: cleanMobile }] : [])
          ]
        });

        if (!existing) {
          await User.create({
            id: c.id || `cust_${cleanMobile}`,
            name: c.name || `Customer ${cleanMobile.slice(-4)}`,
            mobile: cleanMobile,
            password: c.password || '1234',
            role: 'customer',
            authProvider: 'password',
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
          });
          custImported++;
        } else {
          custSkipped++;
        }
      }
      console.log(`[Migration] Customers: ${custImported} imported, ${custSkipped} already existed.`);
    }

    // 2. Ensure Admin User
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        name: process.env.DEFAULT_ADMIN_USER || 'Kavin',
        mobile: process.env.DEFAULT_ADMIN_MOBILE || '8489107668',
        role: 'admin',
        authProvider: 'password'
      });
      console.log('[Migration] Default Admin account created.');
    } else {
      console.log('[Migration] Admin account already present.');
    }

    // 3. Migrate Feedback
    const feedbackFile = path.join(BACKUP_DIR, 'feedback.json');
    if (fs.existsSync(feedbackFile)) {
      let feedbackRaw = fs.readFileSync(feedbackFile, 'utf-8').replace(/^\uFEFF/, '');
      const feedbackList = JSON.parse(feedbackRaw);
      console.log(`[Migration] Found ${feedbackList.length} feedback records in feedback.json`);

      let fbImported = 0;
      let fbSkipped = 0;

      for (const fb of feedbackList) {
        const existingFb = await Feedback.findOne({ id: fb.id });
        if (!existingFb) {
          const cleanMobile = (fb.mobile || '').toString().trim().replace(/\D/g, '').slice(-10);
          const customerUser = await User.findOne({ mobile: cleanMobile });

          await Feedback.create({
            id: fb.id,
            customer: customerUser ? customerUser._id : undefined,
            customerId: customerUser ? customerUser.id : (cleanMobile ? `cust_${cleanMobile}` : undefined),
            name: fb.name || 'Anonymous Customer',
            mobile: cleanMobile,
            rating: fb.rating || 5,
            review: fb.review || '',
            photo: fb.photo || undefined,
            product: 'Koppampatty Seeraga Samba Rice',
            status: fb.status || 'Approved',
            reviewed: fb.reviewed || false,
            date: fb.date || new Date().toISOString()
          });
          fbImported++;
        } else {
          fbSkipped++;
        }
      }
      console.log(`[Migration] Feedback: ${fbImported} imported, ${fbSkipped} already existed.`);
    }

    // 4. Ensure Sequential Order Counter
    let counter = await Counter.findById('orderId');
    if (!counter) {
      const maxOrder = await Order.find({ id: /^AKE\d+$/ }).sort({ id: -1 }).limit(1).lean();
      let maxNum = 0;
      if (maxOrder.length > 0 && maxOrder[0].id) {
        maxNum = parseInt(maxOrder[0].id.replace('AKE', ''), 10) || 0;
      }
      counter = await Counter.create({ _id: 'orderId', seq: maxNum });
      console.log(`[Migration] Initialized Order Counter at: AKE${String(maxNum).padStart(6, '0')}`);
    } else {
      console.log(`[Migration] Order Counter active at sequence: ${counter.seq}`);
    }

    console.log('===========================================================');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('===========================================================');
  } catch (error) {
    console.error('❌ [Migration Failed]:', error);
  } finally {
    await closeDB();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
