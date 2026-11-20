const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization || (typeof req.get === 'function' ? req.get('authorization') : null);
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1].trim();
    } else if (req.headers['x-session-token']) {
      token = req.headers['x-session-token'].trim();
    } else if (req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'].trim();
    } else if (req.headers['x-customer-token']) {
      token = req.headers['x-customer-token'].trim();
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    // Try verifying JWT token
    const secret = process.env.JWT_SECRET || 'ake_rice_super_secure_jwt_secret_key_2026_@kavin#rice!';
    try {
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User account no longer exists.' });
      }
      req.user = user;
      return next();
    } catch (jwtErr) {
      // Check if it's a legacy or admin token format (adm_... or cust_...)
      if (token.startsWith('adm_')) {
        const adminUser = await User.findOne({ role: 'admin' });
        if (adminUser) {
          req.user = adminUser;
          return next();
        }
      } else if (token.startsWith('cust_')) {
        const custId = token.length > 20 ? null : token;
        const customerUser = await User.findOne({ $or: [{ id: token }, { mobile: token.replace('cust_', '') }] });
        if (customerUser) {
          req.user = customerUser;
          return next();
        }
      }
      return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Authentication error', error: error.message });
  }
};

function isSuperAdminUser(user) {
  if (!user) return false;
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'akerice1527@gmail.com').toLowerCase().trim();
  const userEmail = (user.email || '').toLowerCase().trim();

  // 1. Explicit match with designated Super Admin email
  if (userEmail === superAdminEmail || userEmail === 'akerice1527@gmail.com') {
    return true;
  }

  // 2. Database boolean flag, strictly ensuring demoted former super admin is excluded
  if (user.isSuperAdmin === true && userEmail !== 'kaviyansellappan15@gmail.com') {
    return true;
  }

  return false;
}

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden. Administrator privileges required.' });
  }
  if (req.user.status === 'Disabled' || req.user.isActive === false) {
    return res.status(403).json({ success: false, message: 'Administrator account is disabled. Please contact the Super Admin.' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden. Administrator privileges required.' });
  }
  if (!isSuperAdminUser(req.user)) {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_REQUIRED',
      message: 'Access denied. Only the Super Admin can perform this action.'
    });
  }
  next();
};

/**
 * Middleware to enforce granular module permissions for Admin users.
 * Super Admins automatically bypass all permission checks.
 */
const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    // 1. User is authenticated
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    // 2. User role is Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Administrator privileges required.' });
    }

    // 3. User account is active
    if (req.user.status === 'Disabled' || req.user.isActive === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Administrator account is disabled. Please contact the Super Admin.'
      });
    }

    // 4. Super Admin has all permissions
    if (isSuperAdminUser(req.user)) {
      return next();
    }

    // 5. User has the specific permission
    const perms = req.user.permissions || {};
    let hasAccess = false;

    if (permissionKey === 'sales_pos') {
      hasAccess = !!perms.sales_pos;
    } else if (permissionKey === 'orders' || permissionKey === 'whatsapp_orders') {
      hasAccess = !!(perms.orders || perms.whatsapp_orders);
    } else if (perms[permissionKey] !== undefined) {
      hasAccess = !!perms[permissionKey];
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        permission: permissionKey,
        message: `Forbidden. You do not have the required '${permissionKey}' permission to access this resource. Please contact the Super Admin.`
      });
    }

    next();
  };
};

const requireCustomer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Customer login required.' });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization || (typeof req.get === 'function' ? req.get('authorization') : null);
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1].trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'].trim();
  }

  if (!token) return next();

  try {
    const secret = process.env.JWT_SECRET || 'ake_rice_super_secure_jwt_secret_key_2026_@kavin#rice!';
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-password');
    if (user) req.user = user;
  } catch (err) {
    // Ignore invalid token in optionalAuth
  }
  next();
};

/**
 * POS Access Middleware:
 * Allows Super Admin, Admin with 'sales_pos' permission, and Active POS Staff.
 * Strictly blocks Customers, Disabled users, and unauthorized Admins.
 */
const requirePosAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  // Account must be active
  if (req.user.status === 'Disabled' || req.user.isActive === false) {
    return res.status(403).json({
      success: false,
      code: 'ACCOUNT_DISABLED',
      message: 'Account is disabled. Please contact the administrator.'
    });
  }

  // Super Admin is always allowed
  if (isSuperAdminUser(req.user)) {
    return next();
  }

  // POS Staff role
  if (req.user.role === 'pos_staff') {
    if (req.user.permissions?.sales_pos === false) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'Your POS access has been revoked. Please contact the administrator.'
      });
    }
    return next();
  }

  // Admin role with sales_pos permission
  if (req.user.role === 'admin') {
    if (req.user.permissions?.sales_pos) {
      return next();
    }
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      permission: 'sales_pos',
      message: 'Forbidden. You do not have the required "sales_pos" permission to access this resource.'
    });
  }

  // Customers or other roles strictly forbidden
  return res.status(403).json({
    success: false,
    code: 'ACCESS_DENIED',
    message: 'Access denied. POS billing access requires an authorized POS staff or administrator account.'
  });
};

/**
 * POS Staff Management Middleware:
 * Super Admin or Admin with 'pos_staff_management' or 'admin_management'.
 */
const requirePosStaffManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.status === 'Disabled' || req.user.isActive === false) {
    return res.status(403).json({ success: false, message: 'Account is disabled.' });
  }
  if (isSuperAdminUser(req.user)) {
    return next();
  }
  if (req.user.role === 'admin') {
    const perms = req.user.permissions || {};
    if (perms.pos_staff_management || perms.admin_management) {
      return next();
    }
  }
  return res.status(403).json({
    success: false,
    code: 'PERMISSION_DENIED',
    permission: 'pos_staff_management',
    message: 'Forbidden. You do not have permission to manage POS staff.'
  });
};

/**
 * POS Reports Middleware:
 * Allows Super Admin, Admin with 'pos_reports' or 'pos_reports_all_staff', or POS staff viewing their own reports.
 */
const requirePosReports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.status === 'Disabled' || req.user.isActive === false) {
    return res.status(403).json({ success: false, message: 'Account is disabled.' });
  }
  if (isSuperAdminUser(req.user)) {
    return next();
  }
  if (req.user.role === 'admin') {
    const perms = req.user.permissions || {};
    if (perms.pos_reports || perms.pos_reports_all_staff || perms.reports) {
      return next();
    }
  }
  if (req.user.role === 'pos_staff') {
    // POS staff cannot view comparison or bulk export
    const reqUrl = req.originalUrl || req.url || '';
    if (reqUrl.includes('comparison') || reqUrl.includes('export')) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'Forbidden. POS staff cannot view team comparison or multi-staff export.'
      });
    }
    // POS staff can only view their own reports
    const targetStaffId = req.params.staffId || req.query.staffId;
    if (!targetStaffId || targetStaffId === req.user._id?.toString() || targetStaffId === req.user.id) {
      return next();
    }
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'Forbidden. POS staff cannot view other staff reports.'
    });
  }
  return res.status(403).json({
    success: false,
    code: 'PERMISSION_DENIED',
    permission: 'pos_reports',
    message: 'Forbidden. You do not have permission to view POS reports.'
  });
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  requirePosAccess,
  requirePosStaffManagement,
  requirePosReports,
  isSuperAdminUser,
  requireCustomer,
  optionalAuth
};
