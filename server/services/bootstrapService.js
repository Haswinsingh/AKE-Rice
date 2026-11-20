const User = require('../models/User');

/**
 * Secure Super Admin Role Verification & Alignment
 * Ensures only the designated Super Admin (akerice1527@gmail.com) holds the Super Admin role.
 * Automatically demotes former Super Admin (kaviyansellappan15@gmail.com) to standard Admin.
 * Does not create unauthenticated accounts with arbitrary passwords.
 */
async function bootstrapAdmin() {
  try {
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'akerice1527@gmail.com').toLowerCase().trim();

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

    // 2. Locate designated Super Admin account (akerice1527@gmail.com)
    const targetSuperAdmin = await User.findOne({ email: superAdminEmail });

    if (targetSuperAdmin) {
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
        targetSuperAdmin.permissions = {
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
        needsSave = true;
      }
      if (needsSave) {
        await targetSuperAdmin.save();
        console.log(`[Bootstrap] Designated Super Admin "${targetSuperAdmin.name}" (${targetSuperAdmin.email}) verified and granted full Super Admin privileges.`);
      }
      return targetSuperAdmin;
    } else {
      console.log(`[Bootstrap Notice] Designated Super Admin account (${superAdminEmail}) does not exist in the database yet. It must register first via secure OTP/Google authentication.`);
      return null;
    }
  } catch (error) {
    console.error('[Bootstrap Error] Failed during Super Admin alignment:', error.message);
  }
}

module.exports = {
  bootstrapAdmin
};
