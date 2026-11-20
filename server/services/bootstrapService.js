const User = require('../models/User');

/**
 * Secure one-time initial Super Admin setup
 * Configures founder account from secure environment variables.
 * Once created, public registration is strictly disabled.
 */
async function bootstrapAdmin() {
  try {
    const adminName = (process.env.INITIAL_ADMIN_NAME || process.env.DEFAULT_ADMIN_USER || 'Kavin').trim();
    let adminMobile = (process.env.INITIAL_ADMIN_MOBILE || process.env.DEFAULT_ADMIN_MOBILE || '8489107668').toString().trim().replace(/\D/g, '');
    if (adminMobile.length > 10) adminMobile = adminMobile.slice(-10);
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'kaviyansellappan15@gmail.com').toLowerCase().trim();

    let admin = await User.findOne({ 
      $or: [
        { mobile: adminMobile },
        { role: 'admin', name: adminName }
      ]
    });

    if (!admin) {
      admin = new User({
        id: `admin_super_${adminMobile}`,
        name: adminName,
        username: adminName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        mobile: adminMobile,
        email: adminEmail,
        role: 'admin',
        isSuperAdmin: true,
        permissions: {
          analytics: true,
          inventory: true,
          products: true,
          sales_pos: true,
          reports: true,
          orders: true,
          whatsapp_orders: true,
          customers: true,
          feedback: true,
          admin_management: true,
          settings: true
        },
        status: 'Active',
        mobileVerified: true,
        authProvider: 'otp'
      });
      await admin.save();
      console.log(`[Bootstrap] Initial Super Admin seeded successfully: ${admin.name} (+91 ${admin.mobile})`);
    } else {
      let needsSave = false;
      if (!admin.isSuperAdmin) {
        admin.isSuperAdmin = true;
        needsSave = true;
      }
      if (!admin.permissions || !admin.permissions.sales_pos) {
        admin.permissions = {
          analytics: true,
          inventory: true,
          products: true,
          sales_pos: true,
          reports: true,
          orders: true,
          whatsapp_orders: true,
          customers: true,
          feedback: true,
          admin_management: true,
          settings: true
        };
        needsSave = true;
      }
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        needsSave = true;
      }
      if (admin.status !== 'Active') {
        admin.status = 'Active';
        needsSave = true;
      }
      if (!admin.mobileVerified) {
        admin.mobileVerified = true;
        needsSave = true;
      }
      if (!admin.mobile && adminMobile) {
        admin.mobile = adminMobile;
        needsSave = true;
      }
      if (needsSave) {
        await admin.save();
      }
      console.log(`[Bootstrap] Super Admin verified & active: ${admin.name} (+91 ${admin.mobile})`);
    }

    return admin;
  } catch (error) {
    console.error('[Bootstrap Error] Failed during Super Admin initialization:', error.message);
  }
}

module.exports = {
  bootstrapAdmin
};
