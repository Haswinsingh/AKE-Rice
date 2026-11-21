const Order = require('../models/Order');
const Sale = require('../models/Sale');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const OrderAuditLog = require('../models/OrderAuditLog');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const inventoryService = require('../services/inventoryService');
const googleDriveService = require('../services/googleDriveService');
const { isSuperAdminUser } = require('../middleware/authMiddleware');

/**
 * Get comprehensive analytics for Admin Dashboard
 */
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const orders = await Order.find({ isDeleted: { $ne: true }, isTest: { $ne: true } }).lean();
    const sales = await Sale.find({ isDeleted: { $ne: true }, isTest: { $ne: true } }).lean();
    const customersCount = await User.countDocuments({ role: 'customer' });
    const feedbackCount = await Feedback.countDocuments();

    // 1. Calculate Summary Totals
    const totalOrderRevenue = orders
      .filter(o => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    
    const totalPosRevenue = sales
      .filter(s => s.status !== 'Cancelled')
      .reduce((sum, s) => sum + (s.total || 0), 0);

    const totalRevenue = totalOrderRevenue + totalPosRevenue;
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
    const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Order Placed' || o.status === 'Payment Pending').length;

    // 2. Weekly / 7-Day Trend
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      // Daily orders revenue
      const orderDaily = orders
        .filter(o => (o.date === dateStr || (o.createdAt && new Date(o.createdAt).toISOString().split('T')[0] === dateStr)) && o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0);

      // Daily POS sales revenue
      const posDaily = sales
        .filter(s => s.date === dateStr && s.status !== 'Cancelled')
        .reduce((sum, s) => sum + (s.total || 0), 0);

      last7Days.push({
        date: dateStr,
        day: dayName,
        revenue: orderDaily + posDaily,
        ordersRevenue: orderDaily,
        posRevenue: posDaily
      });
    }

    // 3. Revenue Distribution by Area
    const areaRevenueMap = {};
    orders.forEach(o => {
      if (o.status !== 'Cancelled' && o.area) {
        const area = o.area.trim();
        areaRevenueMap[area] = (areaRevenueMap[area] || 0) + (o.total || 0);
      }
    });
    sales.forEach(s => {
      if (s.status !== 'Cancelled' && s.area) {
        const area = s.area.trim();
        areaRevenueMap[area] = (areaRevenueMap[area] || 0) + (s.total || 0);
      }
    });

    const areaBreakdown = Object.entries(areaRevenueMap)
      .map(([area, amount]) => ({ area, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // 4. Payment Share (Online vs COD / Cash)
    let onlineCount = 0;
    let onlineTotal = 0;
    let cashCount = 0;
    let cashTotal = 0;

    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        if ((o.payment || '').includes('Online')) {
          onlineCount += 1;
          onlineTotal += (o.total || 0);
        } else {
          cashCount += 1;
          cashTotal += (o.total || 0);
        }
      }
    });
    sales.forEach(s => {
      if (s.status !== 'Cancelled') {
        if ((s.payment || '').includes('Online') || (s.payment || '').includes('UPI')) {
          onlineCount += 1;
          onlineTotal += (s.total || 0);
        } else {
          cashCount += 1;
          cashTotal += (s.total || 0);
        }
      }
    });

    const paymentShare = {
      online: { count: onlineCount, amount: onlineTotal },
      cash: { count: cashCount, amount: cashTotal },
      totalOrders: onlineCount + cashCount
    };

    // 5. Product Comparison (1 KG vs 25 KG)
    let count1kg = 0;
    let revenue1kg = 0;
    let count25kg = 0;
    let revenue25kg = 0;

    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        if ((o.product || '').includes('25')) {
          count25kg += (o.qty || 1);
          revenue25kg += (o.total || 0);
        } else {
          count1kg += (o.qty || 1);
          revenue1kg += (o.total || 0);
        }
      }
    });
    sales.forEach(s => {
      if (s.status !== 'Cancelled') {
        if ((s.product || '').includes('25')) {
          count25kg += (s.qty || 1);
          revenue25kg += (s.total || 0);
        } else {
          count1kg += (s.qty || 1);
          revenue1kg += (s.total || 0);
        }
      }
    });

    const productComparison = {
      p1kg: { name: '1 KG Pouch', units: count1kg, revenue: revenue1kg },
      p25kg: { name: '25 KG Bag', units: count25kg, revenue: revenue25kg }
    };

    return res.status(200).json({
      success: true,
      metrics: {
        totalRevenue,
        totalOrders,
        deliveredOrders,
        pendingOrders,
        customersCount,
        feedbackCount,
        last7Days,
        areaBreakdown,
        paymentShare,
        productComparison
      }
    });
  } catch (error) {
    console.error('[AdminController] getDashboardAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load analytics', error: error.message });
  }
};

/**
 * Filtered Business Reports
 */
exports.getReports = async (req, res) => {
  try {
    const {
      type, // 'all', 'orders', 'sales'
      period, // 'all', 'today', 'last7', 'thismonth', 'custom'
      area,
      salesperson,
      payment,
      deliveryStatus,
      product,
      startDate,
      endDate
    } = req.query;

    let ordersQuery = {
      isDeleted: { $ne: true },
      isTest: { $ne: true }
    };
    let salesQuery = {
      isDeleted: { $ne: true },
      isTest: { $ne: true }
    };

    if (area && area !== 'all') {
      ordersQuery.area = new RegExp(area, 'i');
      salesQuery.area = new RegExp(area, 'i');
    }
    if (payment && payment !== 'all') {
      ordersQuery.payment = new RegExp(payment, 'i');
      salesQuery.payment = new RegExp(payment, 'i');
    }
    if (deliveryStatus && deliveryStatus !== 'all') {
      ordersQuery.status = deliveryStatus;
      salesQuery.status = deliveryStatus;
    }
    if (salesperson && salesperson !== 'all') {
      salesQuery.salesperson = salesperson;
    }
    if (product && product !== 'all') {
      ordersQuery.product = new RegExp(product, 'i');
      salesQuery.product = new RegExp(product, 'i');
    }

    // Period dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (period === 'today') {
      ordersQuery.date = todayStr;
      salesQuery.date = todayStr;
    } else if (period === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const past7Str = d.toISOString().split('T')[0];
      ordersQuery.date = { $gte: past7Str };
      salesQuery.date = { $gte: past7Str };
    } else if (period === 'thismonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      ordersQuery.date = { $gte: firstDay };
      salesQuery.date = { $gte: firstDay };
    } else if (startDate || endDate) {
      if (startDate && endDate) {
        ordersQuery.date = { $gte: startDate, $lte: endDate };
        salesQuery.date = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        ordersQuery.date = { $gte: startDate };
        salesQuery.date = { $gte: startDate };
      }
    }

    let reportRows = [];

    if (type !== 'sales') {
      const orders = await Order.find(ordersQuery).sort({ createdAt: -1 }).lean();
      orders.forEach(o => {
        reportRows.push({
          id: o.id,
          source: 'Website Order',
          date: o.date || (o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : todayStr),
          customer: o.name,
          mobile: o.mobile,
          area: o.area,
          product: o.product,
          qty: o.qty,
          rate: o.rate,
          total: o.total,
          payment: o.payment,
          paymentStatus: o.paymentStatus,
          status: o.status,
          salesperson: 'Online Store'
        });
      });
    }

    if (type !== 'orders') {
      const sales = await Sale.find(salesQuery).sort({ date: -1 }).lean();
      sales.forEach(s => {
        reportRows.push({
          id: s.id,
          source: 'POS Offline Sale',
          date: s.date,
          customer: s.shop,
          mobile: 'N/A',
          area: s.area,
          product: s.product,
          qty: s.qty,
          rate: s.rate,
          total: s.total,
          payment: s.payment,
          paymentStatus: 'Paid',
          status: s.status,
          salesperson: s.salesperson
        });
      });
    }

    // Sort by date desc
    reportRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalRevenue = reportRows.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalTransactions = reportRows.length;

    return res.status(200).json({
      success: true,
      totalTransactions,
      totalRevenue,
      reportRows
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
  }
};

/**
 * Customer & Shop Registry with aggregated metrics
 */
exports.getCustomersRegistry = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    const sales = await Sale.find({}).sort({ createdAt: -1 }).lean();
    const registeredUsers = await User.find({ role: 'customer' }).lean();

    const customerMap = {};

    // 1. Process Website Customers from Orders
    orders.forEach(o => {
      const key = o.mobile ? o.mobile : o.name.toLowerCase();
      if (!customerMap[key]) {
        customerMap[key] = {
          name: o.name,
          mobile: o.mobile || 'N/A',
          area: o.area || 'N/A',
          address: o.address || '',
          type: 'Direct Customer',
          totalOrders: 0,
          totalQtyKg: 0,
          totalSpent: 0,
          lastOrderDate: o.date || o.dateTime || '',
          orders: []
        };
      }
      customerMap[key].totalOrders += 1;
      const weight = (o.product || '').includes('25') ? (o.qty * 25) : o.qty;
      customerMap[key].totalQtyKg += weight;
      customerMap[key].totalSpent += (o.total || 0);
      customerMap[key].orders.push({
        id: o.id,
        date: o.date || o.dateTime,
        product: o.product,
        total: o.total,
        status: o.status
      });
    });

    // 2. Process Shops / Merchants from Sales
    sales.forEach(s => {
      const key = `shop_${s.shop.toLowerCase()}_${s.area.toLowerCase()}`;
      if (!customerMap[key]) {
        customerMap[key] = {
          name: s.shop,
          mobile: 'Shop Entry',
          area: s.area,
          address: s.area,
          type: 'Retail / Merchant Shop',
          totalOrders: 0,
          totalQtyKg: 0,
          totalSpent: 0,
          lastOrderDate: s.date,
          orders: []
        };
      }
      customerMap[key].totalOrders += 1;
      const weight = (s.product || '').includes('25') ? (s.qty * 25) : s.qty;
      customerMap[key].totalQtyKg += weight;
      customerMap[key].totalSpent += (s.total || 0);
      customerMap[key].orders.push({
        id: s.id,
        date: s.date,
        product: s.product,
        total: s.total,
        status: s.status
      });
    });

    // 3. Include registered accounts without orders yet
    registeredUsers.forEach(u => {
      const key = u.mobile;
      if (key && !customerMap[key]) {
        customerMap[key] = {
          name: u.name,
          mobile: u.mobile,
          area: u.addresses && u.addresses[0] ? u.addresses[0].area : 'N/A',
          address: u.addresses && u.addresses[0] ? u.addresses[0].fullAddress : '',
          type: 'Direct Customer',
          totalOrders: 0,
          totalQtyKg: 0,
          totalSpent: 0,
          lastOrderDate: 'No orders yet',
          orders: []
        };
      }
    });

    const registry = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);

    return res.status(200).json({
      success: true,
      totalCustomers: registry.length,
      registry
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer registry', error: error.message });
  }
};

/**
 * -------------------------------------------------------------
 * INVENTORY MANAGEMENT CONTROLLER
 * -------------------------------------------------------------
 */

/**
 * Get real-time inventory overview and product stock details
 */
exports.getInventory = async (req, res) => {
  try {
    const data = await inventoryService.getInventorySummary();
    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[AdminController] getInventory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory overview', error: error.message });
  }
};

/**
 * Get inventory transaction audit logs
 */
exports.getInventoryTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const transactions = await inventoryService.getInventoryTransactions(limit);
    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('[AdminController] getInventoryTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory transactions', error: error.message });
  }
};

/**
 * Update stock, set initial stock, or adjust threshold
 */
exports.updateInventoryStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await inventoryService.adjustStock(productId, req.body, req.user);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.status(200).json({
      success: true,
      message: 'Inventory stock level adjusted successfully.',
      ...result
    });
  } catch (error) {
    console.error('[AdminController] updateInventoryStock error:', error);
    return res.status(500).json({ success: false, message: 'Failed to adjust inventory stock', error: error.message });
  }
};

/**
 * -------------------------------------------------------------
 * ADMIN ACCOUNT MANAGEMENT CONTROLLER
 * -------------------------------------------------------------
 */

/**
 * Normalize Indian 10-digit mobile number helper
 * Handles: +91 8838048371, 918838048371, 08838048371, 8838048371
 */
function normalizeIndianMobile(input) {
  if (!input) return '';
  let cleaned = input.toString().trim().replace(/\D/g, '');
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length > 10 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(-10);
  }
  return cleaned;
}

const DEFAULT_ADMIN_PERMISSIONS = {
  analytics: true,
  inventory: true,
  products: true,
  sales_pos: false,
  reports: true,
  orders: true,
  whatsapp_orders: true,
  customers: true,
  feedback: true,
  admin_management: false,
  settings: false,
  pos_reports: false,
  pos_reports_all_staff: false
};

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
  pos_reports: true,
  pos_reports_all_staff: true
};

/**
 * List all admin accounts
 */
exports.getAdminUsers = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password -otp').sort({ createdAt: -1 });
    const formattedAdmins = admins.map(u => {
      const isSuper = isSuperAdminUser(u);
      return {
        ...u._doc ? u._doc : u,
        isSuperAdmin: isSuper,
        permissions: isSuper 
          ? { ...SUPER_ADMIN_PERMISSIONS } 
          : { ...DEFAULT_ADMIN_PERMISSIONS, ...(u.permissions || {}) }
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedAdmins.length,
      users: formattedAdmins
    });
  } catch (error) {
    console.error('[AdminController] getAdminUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list admin users', error: error.message });
  }
};

/**
 * Check whether a mobile number already exists in Users collection
 * Determines whether it is Available, existing Admin, Super Admin, or existing Customer (eligible for promotion)
 */
exports.checkAdminMobile = async (req, res) => {
  try {
    const rawMobile = req.params.mobile || req.query.mobile;
    const mobile = normalizeIndianMobile(rawMobile);

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number.'
      });
    }

    const existingUser = await User.findOne({ mobile });
    if (!existingUser) {
      return res.status(200).json({
        success: true,
        exists: false,
        mobile,
        message: `Mobile +91 ${mobile} is available for a new Administrator account.`
      });
    }

    // Case 4: Existing Super Admin
    if (isSuperAdminUser(existingUser)) {
      return res.status(200).json({
        success: true,
        exists: true,
        isSuperAdmin: true,
        role: 'admin',
        canPromote: false,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          mobile: existingUser.mobile,
          role: 'admin',
          status: existingUser.status
        },
        message: 'This mobile number belongs to the Super Admin account and cannot be modified or duplicated.'
      });
    }

    // Case 3: Existing Admin
    if (existingUser.role === 'admin') {
      return res.status(200).json({
        success: true,
        exists: true,
        isSuperAdmin: false,
        role: 'admin',
        canPromote: false,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          mobile: existingUser.mobile,
          role: 'admin',
          status: existingUser.status
        },
        message: 'This mobile number is already registered as an Admin.'
      });
    }

    // Case 2: Existing Customer (Eligible for Promotion to Admin)
    return res.status(200).json({
      success: true,
      exists: true,
      isSuperAdmin: false,
      role: 'customer',
      canPromote: true,
      user: {
        id: existingUser._id,
        name: existingUser.name,
        mobile: existingUser.mobile,
        email: existingUser.email
      },
      message: `An account with this mobile number already exists as a Customer ("${existingUser.name}"). Do you want to promote this account to Admin?`
    });
  } catch (error) {
    console.error('[AdminController] checkAdminMobile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check mobile number', error: error.message });
  }
};

/**
 * Promote an existing Customer account to Admin
 * Preserves user's _id, orders, feedback, and customer history.
 */
exports.promoteCustomerToAdmin = async (req, res) => {
  try {
    let { mobile, name, email } = req.body;
    mobile = normalizeIndianMobile(mobile);

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required.' });
    }

    const existingUser = await User.findOne({ mobile });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'No account found with this mobile number.' });
    }

    if (isSuperAdminUser(existingUser)) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number belongs to the Super Admin account.'
      });
    }

    if (existingUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered as an Admin.'
      });
    }

    // Role check: Only an authenticated Admin/Super Admin can promote
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only authorized administrators can promote customer accounts to Admin.'
      });
    }

    // Promote Customer to Admin
    existingUser.role = 'admin';
    existingUser.status = 'Active';
    if (!existingUser.permissions) {
      existingUser.permissions = { ...DEFAULT_ADMIN_PERMISSIONS };
    }
    if (name && name.trim()) existingUser.name = name.trim();
    if (email && email.trim()) existingUser.email = email.trim().toLowerCase();
    existingUser.promotedAt = new Date();
    existingUser.promotedBy = {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile
    };

    await existingUser.save();

    console.log(`[Admin Promotion] Customer "${existingUser.name}" (+91 ${existingUser.mobile}) promoted to Admin by ${req.user.name}`);

    return res.status(200).json({
      success: true,
      promoted: true,
      message: `Account "${existingUser.name}" (+91 ${existingUser.mobile}) has been successfully promoted to Administrator.`,
      user: {
        id: existingUser._id,
        name: existingUser.name,
        username: existingUser.username,
        email: existingUser.email,
        mobile: existingUser.mobile,
        role: existingUser.role,
        status: existingUser.status,
        mobileVerified: existingUser.mobileVerified || false,
        promotedAt: existingUser.promotedAt,
        permissions: existingUser.permissions
      }
    });
  } catch (error) {
    console.error('[AdminController] promoteCustomerToAdmin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to promote account to Admin', error: error.message });
  }
};

/**
 * Create a new admin account (Admin only)
 * Automatically checks for existing accounts:
 * - If not existing: creates new Admin
 * - If existing Customer: promotes to Admin when promote: true, or returns prompt
 * - If existing Admin: prevents duplicate with descriptive message
 * - If Super Admin: prevents accidental modification
 */
exports.createAdminUser = async (req, res) => {
  try {
    let { name, username, email, mobile, password, promote } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Administrator full name is required.' });
    }

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Administrator 10-digit mobile number is required.' });
    }

    mobile = normalizeIndianMobile(mobile);
    if (mobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    name = name.trim();
    username = (username || name.toLowerCase().replace(/[^a-z0-9]/g, '')).trim();

    // Search the database for an existing account with that mobile number
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      // Case 4: Super Admin
      if (isSuperAdminUser(existingUser)) {
        return res.status(400).json({
          success: false,
          message: 'This mobile number belongs to the Super Admin account and cannot be modified or duplicated.'
        });
      }

      // Case 3: Already an Admin
      if (existingUser.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered as an Admin.'
        });
      }

      // Case 2: Exists as Customer -> Promote to Admin
      if (existingUser.role === 'customer') {
        if (!promote) {
          // Provide option to promote
          return res.status(409).json({
            success: false,
            canPromote: true,
            code: 'CUSTOMER_EXISTS',
            message: `An account with this mobile number already exists as a Customer. Do you want to promote this account to Admin?`,
            existingUser: {
              id: existingUser._id,
              name: existingUser.name,
              mobile: existingUser.mobile,
              email: existingUser.email
            }
          });
        }

        // When confirmed, promote existing customer
        existingUser.role = 'admin';
        existingUser.status = 'Active';
        if (name && name.trim()) existingUser.name = name.trim();
        if (email && email.trim()) existingUser.email = email.trim().toLowerCase();
        existingUser.promotedAt = new Date();
        existingUser.promotedBy = {
          id: req.user._id,
          name: req.user.name,
          mobile: req.user.mobile
        };
        await existingUser.save();

        console.log(`[Admin Promotion] Customer "${existingUser.name}" (+91 ${existingUser.mobile}) promoted to Admin by ${req.user.name}`);

        return res.status(200).json({
          success: true,
          promoted: true,
          message: `Customer account "${existingUser.name}" (+91 ${existingUser.mobile}) has been successfully promoted to Administrator.`,
          user: {
            id: existingUser._id,
            name: existingUser.name,
            username: existingUser.username,
            email: existingUser.email,
            mobile: existingUser.mobile,
            role: existingUser.role,
            status: existingUser.status,
            mobileVerified: existingUser.mobileVerified || false
          }
        });
      }
    }

    // Case 1: Mobile number does not exist -> Create new Admin User
    // Check duplicate username if provided
    if (username) {
      const existingUname = await User.findOne({ username });
      if (existingUname) {
        return res.status(400).json({ success: false, message: `Username "${username}" is already in use.` });
      }
    }

    // Check duplicate email if provided
    if (email) {
      email = email.toLowerCase().trim();
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: `Email "${email}" is already registered.` });
      }
    }

    let hashedPassword = undefined;
    if (password && password.length >= 6) {
      hashedPassword = await bcrypt.hash(password, 10);
    } else {
      hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    }

    const newAdmin = new User({
      id: `admin_${Date.now()}`,
      name,
      username,
      email: email || undefined,
      mobile,
      password: hashedPassword,
      role: 'admin',
      status: 'Active',
      mobileVerified: false,
      authProvider: 'otp',
      isSuperAdmin: false,
      permissions: req.body.permissions ? { ...DEFAULT_ADMIN_PERMISSIONS, ...req.body.permissions } : { ...DEFAULT_ADMIN_PERMISSIONS }
    });

    await newAdmin.save();

    return res.status(201).json({
      success: true,
      message: `Admin account for "${name}" (+91 ${mobile}) created successfully. Admin will verify via SMS OTP upon first login.`,
      user: {
        id: newAdmin._id,
        name: newAdmin.name,
        username: newAdmin.username,
        email: newAdmin.email,
        mobile: newAdmin.mobile,
        role: newAdmin.role,
        status: newAdmin.status,
        mobileVerified: newAdmin.mobileVerified,
        permissions: newAdmin.permissions,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (error) {
    console.error('[AdminController] createAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin user', error: error.message });
  }
};

/**
 * Update an existing admin account (Admin only)
 */
exports.updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, username, email, mobile, status } = req.body;

    const targetUser = await User.findOne({ $or: [{ _id: id }, { id }] });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // Case 4: Super Admin Protection from modification or demotion
    if (isSuperAdminUser(targetUser)) {
      if (name && name.trim() !== targetUser.name) {
        return res.status(400).json({ success: false, message: 'Super Admin account is protected and cannot be modified.' });
      }
      if (mobile && normalizeIndianMobile(mobile) !== targetUser.mobile) {
        return res.status(400).json({ success: false, message: 'Super Admin mobile number is protected and cannot be modified.' });
      }
      if (req.body.role && req.body.role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Super Admin role is protected and cannot be demoted.' });
      }
      if (status && status === 'Disabled') {
        return res.status(400).json({ success: false, message: 'Super Admin account cannot be disabled.' });
      }
    }

    if (name && name.trim()) targetUser.name = name.trim();
    if (username && username.trim()) targetUser.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (email !== undefined) targetUser.email = email ? email.trim().toLowerCase() : undefined;

    if (mobile) {
      const cleanMobile = normalizeIndianMobile(mobile);
      if (cleanMobile.length === 10) {
        // Check if mobile in use by another user
        const existing = await User.findOne({ mobile: cleanMobile, _id: { $ne: targetUser._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: `Mobile number +91 ${cleanMobile} is already in use.` });
        }
        if (targetUser.mobile !== cleanMobile) {
          targetUser.mobile = cleanMobile;
          targetUser.mobileVerified = false; // Must re-verify new number
        }
      }
    }

    if (status && ['Active', 'Disabled'].includes(status)) {
      if (isSuperAdminUser(targetUser) && status === 'Disabled') {
        return res.status(400).json({ success: false, message: 'Primary founder accounts cannot be disabled.' });
      }
      targetUser.status = status;
    }

    if (req.body.permissions && typeof req.body.permissions === 'object') {
      if (!isSuperAdminUser(req.user)) {
        return res.status(403).json({ success: false, message: 'Only the Super Admin can modify administrator permissions.' });
      }
      if (!isSuperAdminUser(targetUser)) {
        targetUser.permissions = {
          analytics: Boolean(req.body.permissions.analytics),
          inventory: Boolean(req.body.permissions.inventory),
          products: Boolean(req.body.permissions.products),
          sales_pos: Boolean(req.body.permissions.sales_pos),
          reports: Boolean(req.body.permissions.reports),
          orders: Boolean(req.body.permissions.orders ?? req.body.permissions.whatsapp_orders),
          whatsapp_orders: Boolean(req.body.permissions.whatsapp_orders ?? req.body.permissions.orders),
          customers: Boolean(req.body.permissions.customers),
          feedback: Boolean(req.body.permissions.feedback),
          admin_management: Boolean(req.body.permissions.admin_management),
          settings: Boolean(req.body.permissions.settings),
          pos_reports: Boolean(req.body.permissions.pos_reports),
          pos_reports_all_staff: Boolean(req.body.permissions.pos_reports_all_staff)
        };
      }
    }

    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `Administrator "${targetUser.name}" updated successfully.`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        email: targetUser.email,
        mobile: targetUser.mobile,
        status: targetUser.status,
        mobileVerified: targetUser.mobileVerified,
        permissions: targetUser.permissions
      }
    });
  } catch (error) {
    console.error('[AdminController] updateAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update admin account', error: error.message });
  }
};

/**
 * Update Admin Granular Permissions (Super Admin Only)
 */
exports.updateAdminPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the Super Admin can assign or modify administrator permissions.'
      });
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid permissions payload is required.' });
    }

    const targetUser = await User.findOne({ $or: [{ _id: id }, { id }] });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    if (isSuperAdminUser(targetUser)) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin permissions are complete and immutable.'
      });
    }

    const sanitizedPermissions = {
      analytics: Boolean(permissions.analytics),
      inventory: Boolean(permissions.inventory),
      products: Boolean(permissions.products),
      sales_pos: Boolean(permissions.sales_pos),
      reports: Boolean(permissions.reports),
      orders: Boolean(permissions.orders ?? permissions.whatsapp_orders),
      whatsapp_orders: Boolean(permissions.whatsapp_orders ?? permissions.orders),
      customers: Boolean(permissions.customers),
      feedback: Boolean(permissions.feedback),
      admin_management: Boolean(permissions.admin_management),
      settings: Boolean(permissions.settings),
      pos_reports: Boolean(permissions.pos_reports),
      pos_reports_all_staff: Boolean(permissions.pos_reports_all_staff)
    };

    targetUser.permissions = sanitizedPermissions;
    await targetUser.save();

    console.log(`[Admin Permissions] Updated permissions for "${targetUser.name}": POS=${sanitizedPermissions.sales_pos} by Super Admin (${req.user.name})`);

    return res.status(200).json({
      success: true,
      message: `Permissions updated successfully for "${targetUser.name}".`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        mobile: targetUser.mobile,
        role: targetUser.role,
        isSuperAdmin: false,
        permissions: targetUser.permissions
      }
    });
  } catch (error) {
    console.error('[AdminController] updateAdminPermissions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update admin permissions', error: error.message });
  }
};

/**
 * Delete an admin account (Admin only)
 */
exports.deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findOne({ $or: [{ _id: id }, { id }] });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // Case 4: Prevent deleting primary founder / Super Admin accounts
    if (isSuperAdminUser(targetUser)) {
      return res.status(400).json({ success: false, message: 'Super Admin account is protected and cannot be deleted.' });
    }

    // Prevent deleting self
    if (req.user && targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own administrator account.' });
    }

    await User.deleteOne({ _id: targetUser._id });

    return res.status(200).json({
      success: true,
      message: `Administrator account "${targetUser.name}" has been permanently deleted.`
    });
  } catch (error) {
    console.error('[AdminController] deleteAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete admin account', error: error.message });
  }
};

/**
 * Toggle enable/disable status for an admin account
 */
exports.updateAdminUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Active' or 'Disabled'

    if (!['Active', 'Disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "Active" or "Disabled".' });
    }

    const targetUser = await User.findOne({ $or: [{ _id: id }, { id }] });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // Prevent disabling the current authenticated admin
    if (targetUser._id.toString() === req.user._id.toString() && status === 'Disabled') {
      return res.status(400).json({ success: false, message: 'You cannot disable your own administrator account.' });
    }

    // Prevent disabling Super Admin account
    if (isSuperAdminUser(targetUser) && status === 'Disabled') {
      return res.status(400).json({ success: false, message: 'Super Admin account cannot be disabled.' });
    }

    targetUser.status = status;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `Admin account "${targetUser.name}" has been ${status === 'Active' ? 'enabled' : 'disabled'}.`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        status: targetUser.status
      }
    });
  } catch (error) {
    console.error('[AdminController] updateAdminUserStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update admin account status', error: error.message });
  }
};

/**
 * Reset password for an admin account
 */
exports.resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const targetUser = await User.findOne({ $or: [{ _id: id }, { id }] });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    targetUser.password = await bcrypt.hash(password, 10);
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `Password for administrator "${targetUser.name}" has been successfully reset.`
    });
  } catch (error) {
    console.error('[AdminController] resetAdminPassword error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset admin password', error: error.message });
  }
};

/**
 * Google Drive Backup - Get connection & synchronization status
 */
exports.getDriveBackupStatus = async (req, res) => {
  try {
    const status = await googleDriveService.getBackupStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (error) {
    console.error('[AdminController] getDriveBackupStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve Google Drive backup status', error: error.message });
  }
};

/**
 * Google Drive Backup - Test connection & service account credentials
 */
exports.testDriveConnection = async (req, res) => {
  try {
    const result = await googleDriveService.testConnection();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[AdminController] testDriveConnection error:', error);
    return res.status(500).json({ success: false, message: 'Google Drive connection test failed', error: error.message });
  }
};

/**
 * Google Drive Backup - Sync current month transactions
 */
exports.syncCurrentMonthDriveBackup = async (req, res) => {
  try {
    const user = req.user ? req.user.name : 'Admin';
    const result = await googleDriveService.syncCurrentMonth(user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[AdminController] syncCurrentMonthDriveBackup error:', error);
    return res.status(500).json({ success: false, message: 'Failed to sync current month transactions to Drive', error: error.message });
  }
};

/**
 * Google Drive Backup - Retry failed or pending exports
 */
exports.retryFailedDriveBackups = async (req, res) => {
  try {
    const user = req.user ? req.user.name : 'Admin';
    const result = await googleDriveService.retryFailedExports(user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[AdminController] retryFailedDriveBackups error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retry failed exports', error: error.message });
  }
};

/**
 * Google Drive Backup - Export all historical transactions
 */
exports.exportHistoricalDriveBackup = async (req, res) => {
  try {
    const user = req.user ? req.user.name : 'Admin';
    const result = await googleDriveService.exportAllHistoricalTransactions(user);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[AdminController] exportHistoricalDriveBackup error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export historical transactions', error: error.message });
  }
};

/**
 * Preview test records vs real transactions
 */
exports.getTestRecordsPreview = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    const sales = await Sale.find({}).sort({ createdAt: -1 }).lean();

    const testKeywords = [/test/i, /dummy/i, /inventory test/i, /dynamic product test/i];
    const testMobiles = ['9876000001', '9876000002', '9876543210', '9840998877', '9840123456'];

    const testOrders = [];
    const realOrders = [];

    orders.forEach(o => {
      let isTest = !!o.isTest;
      const reasons = [];

      if (o.isTest && o.testReason) {
        reasons.push(o.testReason);
      }
      if (testKeywords.some(p => p.test(o.name))) {
        isTest = true;
        reasons.push(`Customer name mentions test: "${o.name}"`);
      }
      if (o.notes && testKeywords.some(p => p.test(o.notes))) {
        isTest = true;
        reasons.push(`Notes mention test: "${o.notes}"`);
      }
      if (testMobiles.includes(o.mobile)) {
        isTest = true;
        reasons.push(`Mobile ${o.mobile} is a known test number`);
      }

      const item = {
        id: o.id,
        name: o.name,
        mobile: o.mobile,
        address: o.address,
        area: o.area,
        product: o.product,
        qty: o.qty,
        total: o.total,
        date: o.date || o.createdAt,
        status: o.status,
        payment: o.payment,
        notes: o.notes,
        isDeleted: !!o.isDeleted,
        isTest,
        reasons
      };

      if (isTest) testOrders.push(item);
      else realOrders.push(item);
    });

    const testSales = [];
    const realSales = [];

    sales.forEach(s => {
      let isTest = !!s.isTest;
      const reasons = [];

      if (s.isTest && s.testReason) {
        reasons.push(s.testReason);
      }
      if (s.notes && testKeywords.some(p => p.test(s.notes))) {
        isTest = true;
        reasons.push(`Notes mention test: "${s.notes}"`);
      }
      if (testKeywords.some(p => p.test(s.shop) || p.test(s.customerName))) {
        isTest = true;
        reasons.push(`Shop/Customer name mentions test: "${s.shop || s.customerName}"`);
      }

      const item = {
        id: s.id,
        shop: s.shop,
        customerName: s.customerName,
        salesperson: s.salesperson,
        product: s.product,
        qty: s.qty,
        total: s.total,
        date: s.date,
        status: s.status,
        notes: s.notes,
        isDeleted: !!s.isDeleted,
        isTest,
        reasons
      };

      if (isTest) testSales.push(item);
      else realSales.push(item);
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalOrders: orders.length,
        testOrdersCount: testOrders.length,
        realOrdersCount: realOrders.length,
        totalSales: sales.length,
        testSalesCount: testSales.length,
        realSalesCount: realSales.length
      },
      testOrders,
      realOrders,
      testSales,
      realSales
    });
  } catch (error) {
    console.error('[AdminController] getTestRecordsPreview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate test records preview', error: error.message });
  }
};

/**
 * Execute confirmed test records cleanup
 */
exports.cleanupTestRecords = async (req, res) => {
  try {
    const { orderIds = [], saleIds = [], action = 'soft_delete', reason } = req.body;
    const cleanupReason = (reason && reason.trim()) || 'Confirmed test data cleanup';

    if (action === 'permanent_delete' && !isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Permanent deletion of test records requires Super Admin authorization.'
      });
    }

    let cleanedOrdersCount = 0;
    let cleanedSalesCount = 0;

    // Handle Orders
    for (const orderId of orderIds) {
      const order = await Order.findOne({ id: orderId });
      if (!order) continue;

      if (action === 'permanent_delete') {
        await OrderAuditLog.create({
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          orderId: order.id,
          action: 'permanent_delete',
          orderDetails: {
            id: order.id,
            customerName: order.name,
            total: order.total,
            date: order.date
          },
          performedBy: {
            id: req.user._id ? req.user._id.toString() : req.user.id,
            name: req.user.name,
            role: req.user.role,
            isSuperAdmin: true
          },
          reason: cleanupReason
        }).catch(() => {});

        googleDriveService.removeOrderFromDrive(order.id, order.date || order.createdAt).catch(() => {});
        await Order.deleteOne({ id: orderId });
      } else {
        // Soft delete / flag as test
        order.isDeleted = true;
        order.isTest = true;
        order.testReason = cleanupReason;
        order.deletedAt = new Date();
        order.deletedBy = {
          id: req.user._id ? req.user._id.toString() : req.user.id,
          name: req.user.name || 'Admin',
          role: req.user.role || 'admin',
          email: req.user.email || ''
        };
        order.deletionReason = cleanupReason;
        await order.save();

        await OrderAuditLog.create({
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          orderId: order.id,
          action: 'test_cleanup',
          orderDetails: {
            id: order.id,
            customerName: order.name,
            total: order.total,
            date: order.date
          },
          performedBy: {
            id: req.user._id ? req.user._id.toString() : req.user.id,
            name: req.user.name,
            role: req.user.role,
            isSuperAdmin: isSuperAdminUser(req.user)
          },
          reason: cleanupReason
        }).catch(() => {});

        googleDriveService.removeOrderFromDrive(order.id, order.date || order.createdAt).catch(() => {});
      }
      cleanedOrdersCount++;
    }

    // Handle Sales
    for (const saleId of saleIds) {
      const sale = await Sale.findOne({ id: saleId });
      if (!sale) continue;

      if (action === 'permanent_delete') {
        googleDriveService.removeSaleFromDrive(sale.id, sale.date || sale.transactionDate).catch(() => {});
        await Sale.deleteOne({ id: saleId });
      } else {
        sale.isDeleted = true;
        sale.isTest = true;
        sale.testReason = cleanupReason;
        sale.deletedAt = new Date();
        sale.deletedBy = {
          id: req.user._id ? req.user._id.toString() : req.user.id,
          name: req.user.name || 'Admin',
          role: req.user.role || 'admin',
          email: req.user.email || ''
        };
        sale.deletionReason = cleanupReason;
        await sale.save();

        googleDriveService.removeSaleFromDrive(sale.id, sale.date || sale.transactionDate).catch(() => {});
      }
      cleanedSalesCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${cleanedOrdersCount} test orders and ${cleanedSalesCount} test sales (${action}).`,
      cleanedOrdersCount,
      cleanedSalesCount
    });
  } catch (error) {
    console.error('[AdminController] cleanupTestRecords error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cleanup test records', error: error.message });
  }
};

