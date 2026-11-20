const User = require('../models/User');

const SUPER_ADMIN_PERMISSIONS = {
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
  settings: true,
  pos_staff_management: true,
  pos_reports: true,
  pos_reports_all_staff: true
};

/**
 * Secure Super Admin Role Verification & Alignment
 * Ensures only the designated Super Admin (akerice1527@gmail.com) holds the Super Admin role.
 * Automatically demotes former Super Admin (kaviyansellappan15@gmail.com) to standard Admin.
 * Guarantees akerice1527@gmail.com exists in active data store with full privileges.
 */
async function bootstrapAdmin() {
  try {
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'akerice1527@gmail.com').toLowerCase().trim();

    // 1. Ensure former Super Admin account (kaviyansellappan15@gmail.com / Kavin) is demoted to standard Admin
    const formerSuperAdmin = await User.findOne({
      $or: [
        { email: 'kaviyansellappan15@gmail.com' },
        { mobile: '8489107668', isSuperAdmin: true }
      ]
    });

    if (formerSuperAdmin && formerSuperAdmin.isSuperAdmin === true) {
      formerSuperAdmin.isSuperAdmin = false;
      formerSuperAdmin.role = 'admin';
      await formerSuperAdmin.save();
      console.log(`[Bootstrap] Former Super Admin "${formerSuperAdmin.name}" (${formerSuperAdmin.email}) successfully demoted to standard Administrator.`);
    }

    // 2. Locate or create designated Super Admin account (akerice1527@gmail.com)
    let targetSuperAdmin = await User.findOne({ email: superAdminEmail });

    if (!targetSuperAdmin) {
      console.log(`[Bootstrap] Creating designated Super Admin account (${superAdminEmail})...`);
      targetSuperAdmin = new User({
        _id: '65f000000000000000000001',
        id: 'admin_super_akerice',
        name: 'AKE Rice Super Admin',
        username: 'superadmin_ake',
        email: superAdminEmail,
        mobile: process.env.WHATSAPP_NUMBER || '9176049099',
        role: 'admin',
        isSuperAdmin: true,
        status: 'Active',
        mobileVerified: true,
        emailVerified: true,
        authProvider: 'otp',
        permissions: { ...SUPER_ADMIN_PERMISSIONS }
      });
      await targetSuperAdmin.save();
      console.log(`[Bootstrap] Designated Super Admin account (${superAdminEmail}) created and granted full Super Admin privileges.`);
    } else {
      let needsSave = false;
      if (!targetSuperAdmin.isSuperAdmin) {
        targetSuperAdmin.isSuperAdmin = true;
        needsSave = true;
      }
      if (targetSuperAdmin.role !== 'admin') {
        targetSuperAdmin.role = 'admin';
        needsSave = true;
      }
      if (targetSuperAdmin.status !== 'Active') {
        targetSuperAdmin.status = 'Active';
        needsSave = true;
      }
      if (!targetSuperAdmin.permissions || !targetSuperAdmin.permissions.pos_reports_all_staff) {
        targetSuperAdmin.permissions = { ...SUPER_ADMIN_PERMISSIONS };
        needsSave = true;
      }
      if (needsSave) {
        await targetSuperAdmin.save();
        console.log(`[Bootstrap] Designated Super Admin "${targetSuperAdmin.name}" (${targetSuperAdmin.email}) verified and granted full Super Admin privileges.`);
      }
    }
    return targetSuperAdmin;
  } catch (error) {
    console.error('[Bootstrap Error] Failed during Super Admin alignment:', error.message);
  }
}

module.exports = {
  bootstrapAdmin,
  SUPER_ADMIN_PERMISSIONS
};
