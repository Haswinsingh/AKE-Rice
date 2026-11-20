const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Sale = require('../models/Sale');
const { isSuperAdminUser } = require('../middleware/authMiddleware');

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

/**
 * List all POS staff accounts with their lifetime transaction metrics and filters
 */
exports.getPosStaff = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = { role: { $in: ['pos_staff', 'staff', 'sales_agent'] } };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: reg },
        { email: reg },
        { mobile: reg },
        { username: reg },
        { staffId: reg },
        { id: reg }
      ];
    }

    const staffList = await User.find(query).select('-password -otp').sort({ createdAt: -1 });

    // Fetch all sales to calculate lifetime performance for each staff member
    const allSales = await Sale.find();

    const staffWithMetrics = staffList.map((staff, idx) => {
      const staffDoc = staff._doc ? staff._doc : staff;
      const staffIdStr = staff._id ? staff._id.toString() : staff.id;

      let totalSales = 0;
      let transactionCount = 0;
      let totalQuantityKg = 0;
      let cashSales = 0;
      let upiSales = 0;

      allSales.forEach(s => {
        const matchesStaff = (s.staffUserId === staffIdStr) || 
          (s.salesperson && s.salesperson.toLowerCase() === staff.name?.toLowerCase()) ||
          (s.staffName && s.staffName.toLowerCase() === staff.name?.toLowerCase());

        if (matchesStaff) {
          transactionCount += 1;
          const amt = (s.total || s.totalAmount || 0);
          totalSales += amt;
          const kg = s.product?.includes('25') ? (s.qty || s.quantity || 1) * 25 : (s.qty || s.quantity || 1);
          totalQuantityKg += kg;

          const pay = (s.payment || s.paymentMethod || 'Cash').toLowerCase();
          if (pay.includes('cash')) {
            cashSales += amt;
          } else if (pay.includes('upi')) {
            upiSales += amt;
          }
        }
      });

      const assignedStaffId = staff.staffId || staffDoc.staffId || `AKE-STF-${String(idx + 1).padStart(3, '0')}`;

      return {
        ...staffDoc,
        staffId: assignedStaffId,
        totalSales,
        transactionCount,
        totalQuantityKg,
        cashSales,
        upiSales,
        hasPosAccess: staff.status === 'Active' && staff.permissions?.sales_pos !== false,
        permissions: {
          sales_pos: staff.permissions?.sales_pos !== false,
          view_own_sales: staff.permissions?.view_own_sales !== false,
          view_customer_info: Boolean(staff.permissions?.view_customer_info),
          ...(staff.permissions || {})
        }
      };
    });

    return res.status(200).json({
      success: true,
      count: staffWithMetrics.length,
      staff: staffWithMetrics
    });
  } catch (error) {
    console.error('[PosStaffController] getPosStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve staff roster', error: error.message });
  }
};

/**
 * Create a new Staff Account
 */
exports.createPosStaff = async (req, res) => {
  try {
    let { name, email, mobile, username, password, status, staffId, permissions, sales_pos, view_own_sales, view_customer_info } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Staff full name is required.' });
    }

    if (!mobile) {
      return res.status(400).json({ success: false, message: '10-digit mobile number is required.' });
    }

    mobile = normalizeIndianMobile(mobile);
    if (mobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit Indian mobile number.' });
    }

    name = name.trim();
    if (email) email = email.trim().toLowerCase();
    username = (username || name.toLowerCase().replace(/[^a-z0-9]/g, '')).trim();

    // Auto-generate staff ID if not provided
    if (!staffId || !staffId.trim()) {
      const existingCount = await User.countDocuments({ role: { $in: ['pos_staff', 'staff', 'sales_agent'] } });
      staffId = `AKE-STF-${String(existingCount + 1).padStart(3, '0')}`;
    } else {
      staffId = staffId.trim().toUpperCase();
      const existingStaffId = await User.findOne({ staffId });
      if (existingStaffId) {
        return res.status(400).json({ success: false, message: `Staff ID "${staffId}" is already assigned to another staff member.` });
      }
    }

    // Consolidated permissions
    const mergedPermissions = {
      sales_pos: permissions?.sales_pos !== undefined ? Boolean(permissions.sales_pos) : (sales_pos !== false),
      view_own_sales: permissions?.view_own_sales !== undefined ? Boolean(permissions.view_own_sales) : (view_own_sales !== false),
      view_customer_info: permissions?.view_customer_info !== undefined ? Boolean(permissions.view_customer_info) : Boolean(view_customer_info),
      analytics: false,
      inventory: false,
      products: false,
      reports: false,
      orders: false,
      customers: false,
      feedback: false,
      admin_management: false,
      settings: false
    };

    // Check duplicate mobile
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      if (existingMobile.role === 'admin' || isSuperAdminUser(existingMobile)) {
        return res.status(400).json({ success: false, message: 'This mobile number is already registered to an Administrator.' });
      }
      if (existingMobile.role === 'pos_staff' || existingMobile.role === 'staff') {
        return res.status(400).json({ success: false, message: 'A Staff member with this mobile number already exists.' });
      }
      // If customer exists, upgrade role to pos_staff
      existingMobile.role = 'pos_staff';
      existingMobile.status = status || 'Active';
      existingMobile.name = name;
      existingMobile.staffId = staffId;
      if (email) existingMobile.email = email;
      existingMobile.permissions = mergedPermissions;
      if (password && password.length >= 6) {
        existingMobile.password = await bcrypt.hash(password, 10);
      }
      await existingMobile.save();

      return res.status(200).json({
        success: true,
        message: `Existing customer "${existingMobile.name}" (+91 ${mobile}) promoted to Staff role successfully!`,
        staff: existingMobile
      });
    }

    // Check duplicate email if provided
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: `Email "${email}" is already registered.` });
      }
    }

    let hashedPassword = undefined;
    if (password && password.length >= 6) {
      hashedPassword = await bcrypt.hash(password, 10);
    } else {
      hashedPassword = await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10);
    }

    const newStaff = new User({
      id: `pos_${Date.now()}`,
      staffId,
      name,
      username,
      email: email || undefined,
      mobile,
      password: hashedPassword,
      role: 'pos_staff',
      status: status || 'Active',
      mobileVerified: true,
      emailVerified: true,
      authProvider: 'otp',
      isSuperAdmin: false,
      permissions: mergedPermissions
    });

    await newStaff.save();

    console.log(`[PosStaff] Created new staff account: ${newStaff.name} (Staff ID: ${staffId}, Mobile: +91 ${newStaff.mobile})`);

    return res.status(201).json({
      success: true,
      message: `Staff account for "${name}" (${staffId}, +91 ${mobile}) created successfully.`,
      staff: {
        id: newStaff._id,
        _id: newStaff._id,
        staffId: newStaff.staffId,
        name: newStaff.name,
        email: newStaff.email,
        mobile: newStaff.mobile,
        username: newStaff.username,
        role: newStaff.role,
        status: newStaff.status,
        permissions: newStaff.permissions,
        createdAt: newStaff.createdAt
      }
    });
  } catch (error) {
    console.error('[PosStaffController] createPosStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create staff account', error: error.message });
  }
};

/**
 * Update Staff Details & Permissions
 */
exports.updatePosStaff = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, email, mobile, username, status, staffId, permissions, sales_pos, view_own_sales, view_customer_info } = req.body;

    const staff = await User.findOne({ $or: [{ _id: id }, { id }, { staffId: id }] });
    if (!staff || (staff.role !== 'pos_staff' && staff.role !== 'staff' && staff.role !== 'sales_agent')) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    if (name && name.trim()) staff.name = name.trim();
    if (staffId && staffId.trim()) staff.staffId = staffId.trim().toUpperCase();
    if (username && username.trim()) staff.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (email !== undefined) staff.email = email ? email.trim().toLowerCase() : undefined;

    if (mobile) {
      const cleanMobile = normalizeIndianMobile(mobile);
      if (cleanMobile.length === 10) {
        const existing = await User.findOne({ mobile: cleanMobile, _id: { $ne: staff._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: `Mobile +91 ${cleanMobile} is in use by another account.` });
        }
        staff.mobile = cleanMobile;
      }
    }

    if (status && ['Active', 'Disabled'].includes(status)) {
      staff.status = status;
    }

    // Update permissions
    const updatedPermissions = {
      ...(staff.permissions || {}),
      sales_pos: sales_pos !== undefined ? Boolean(sales_pos) : (permissions?.sales_pos !== undefined ? Boolean(permissions.sales_pos) : staff.permissions?.sales_pos !== false),
      view_own_sales: view_own_sales !== undefined ? Boolean(view_own_sales) : (permissions?.view_own_sales !== undefined ? Boolean(permissions.view_own_sales) : staff.permissions?.view_own_sales !== false),
      view_customer_info: view_customer_info !== undefined ? Boolean(view_customer_info) : (permissions?.view_customer_info !== undefined ? Boolean(permissions.view_customer_info) : Boolean(staff.permissions?.view_customer_info))
    };
    staff.permissions = updatedPermissions;

    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff member "${staff.name}" updated successfully.`,
      staff
    });
  } catch (error) {
    console.error('[PosStaffController] updatePosStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update staff member', error: error.message });
  }
};

/**
 * Toggle Staff Access / Status
 */
exports.togglePosStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sales_pos } = req.body;

    const staff = await User.findOne({ $or: [{ _id: id }, { id }, { staffId: id }] });
    if (!staff || (staff.role !== 'pos_staff' && staff.role !== 'staff' && staff.role !== 'sales_agent')) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    if (status && ['Active', 'Disabled'].includes(status)) {
      staff.status = status;
    }

    if (sales_pos !== undefined) {
      staff.permissions = {
        ...(staff.permissions || {}),
        sales_pos: Boolean(sales_pos)
      };
    } else if (staff.status === 'Disabled') {
      staff.permissions = {
        ...(staff.permissions || {}),
        sales_pos: false
      };
    } else if (staff.status === 'Active') {
      staff.permissions = {
        ...(staff.permissions || {}),
        sales_pos: true
      };
    }

    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff access for "${staff.name}" is now ${staff.status === 'Active' && staff.permissions?.sales_pos !== false ? 'Active & Enabled' : 'Disabled & Revoked'}.`,
      staff
    });
  } catch (error) {
    console.error('[PosStaffController] togglePosStaffStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update staff status', error: error.message });
  }
};

/**
 * Delete / Revoke Staff Account
 * CRITICAL REQUIREMENT: Strictly preserves all historical sales records.
 * Marks the staff account as inactive/revoked rather than dropping historical receipts.
 */
exports.deletePosStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await User.findOne({ $or: [{ _id: id }, { id }, { staffId: id }] });
    if (!staff || (staff.role !== 'pos_staff' && staff.role !== 'staff' && staff.role !== 'sales_agent')) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // Revoke access permanently and soft-delete/deactivate account
    staff.status = 'Disabled';
    staff.permissions = {
      ...(staff.permissions || {}),
      sales_pos: false
    };
    staff.isDeleted = true;
    staff.deletedAt = new Date();
    await staff.save();

    console.log(`[PosStaff] Revoked & deactivated staff account: ${staff.name}. Historical sales records preserved intact.`);

    return res.status(200).json({
      success: true,
      message: `Staff account "${staff.name}" has been deactivated and access revoked. All historical sales transactions have been safely preserved.`,
      staff
    });
  } catch (error) {
    console.error('[PosStaffController] deletePosStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to revoke staff account', error: error.message });
  }
};

/**
 * Reset Staff Password / Login Credentials
 */
exports.resetPosStaffAuth = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const staff = await User.findOne({ $or: [{ _id: id }, { id }, { staffId: id }] });
    if (!staff || (staff.role !== 'pos_staff' && staff.role !== 'staff' && staff.role !== 'sales_agent')) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    staff.password = await bcrypt.hash(password, 10);
    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for staff member "${staff.name}".`
    });
  } catch (error) {
    console.error('[PosStaffController] resetPosStaffAuth error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset credentials', error: error.message });
  }
};

/**
 * Get all sales generated by a specific staff member
 * Route: GET /api/admin/staff/:id/sales
 */
exports.getStaffSales = async (req, res) => {
  try {
    const { id } = req.params;
    const { period, startDate, endDate, paymentMethod, area } = req.query;

    const staff = await User.findOne({ $or: [{ _id: id }, { id }, { staffId: id }] });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const staffIdStr = staff._id ? staff._id.toString() : staff.id;
    let query = {
      $or: [
        { staffUserId: staffIdStr },
        { salesperson: staff.name },
        { staffName: staff.name }
      ]
    };

    if (paymentMethod && paymentMethod !== 'all') {
      query.payment = paymentMethod;
    }
    if (area && area !== 'all') {
      query.area = new RegExp(area, 'i');
    }

    const today = new Date().toISOString().split('T')[0];
    if (period === 'today') {
      query.date = today;
    } else if (period === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      query.date = yDate.toISOString().split('T')[0];
    } else if (period === 'week') {
      const wDate = new Date();
      wDate.setDate(wDate.getDate() - 7);
      query.date = { $gte: wDate.toISOString().split('T')[0], $lte: today };
    } else if (period === 'month') {
      const mDate = new Date();
      mDate.setDate(mDate.getDate() - 30);
      query.date = { $gte: mDate.toISOString().split('T')[0], $lte: today };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const sales = await Sale.find(query).sort({ date: -1, createdAt: -1 });

    let totalTransactions = sales.length;
    let totalQuantityKg = 0;
    let totalSalesAmount = 0;
    let cashSales = 0;
    let upiSales = 0;

    sales.forEach(s => {
      const kg = s.product?.includes('25') ? (s.qty || s.quantity || 1) * 25 : (s.qty || s.quantity || 1);
      totalQuantityKg += kg;
      const amt = (s.total || s.totalAmount || 0);
      totalSalesAmount += amt;

      const pay = (s.payment || s.paymentMethod || 'Cash').toLowerCase();
      if (pay.includes('cash')) {
        cashSales += amt;
      } else if (pay.includes('upi')) {
        upiSales += amt;
      }
    });

    const averageTransactionValue = totalTransactions > 0 ? Math.round(totalSalesAmount / totalTransactions) : 0;

    return res.status(200).json({
      success: true,
      staff: {
        id: staff._id,
        _id: staff._id,
        staffId: staff.staffId || `AKE-STF-${staff._id.toString().slice(-3).toUpperCase()}`,
        name: staff.name,
        email: staff.email,
        mobile: staff.mobile,
        username: staff.username,
        status: staff.status,
        permissions: staff.permissions,
        createdAt: staff.createdAt
      },
      summary: {
        totalTransactions,
        totalQuantityKg,
        totalSalesAmount,
        totalSales: totalSalesAmount,
        averageTransactionValue,
        avgTransactionValue: averageTransactionValue,
        cashSales,
        upiSales
      },
      sales
    });
  } catch (error) {
    console.error('[PosStaffController] getStaffSales error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve staff sales records', error: error.message });
  }
};

/**
 * Get sales reports across all staff
 * Route: GET /api/admin/staff/reports
 */
exports.getStaffReports = async (req, res) => {
  try {
    const { period, startDate, endDate, sortBy } = req.query;
    let query = {};

    const today = new Date().toISOString().split('T')[0];
    if (period === 'today') {
      query.date = today;
    } else if (period === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      query.date = yDate.toISOString().split('T')[0];
    } else if (period === 'week') {
      const wDate = new Date();
      wDate.setDate(wDate.getDate() - 7);
      query.date = { $gte: wDate.toISOString().split('T')[0], $lte: today };
    } else if (period === 'month') {
      const mDate = new Date();
      mDate.setDate(mDate.getDate() - 30);
      query.date = { $gte: mDate.toISOString().split('T')[0], $lte: today };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const sales = await Sale.find(query);
    const staffMembers = await User.find({ role: { $in: ['pos_staff', 'staff', 'sales_agent'] } });

    const staffMap = {};
    staffMembers.forEach((st, idx) => {
      const idKey = st._id ? st._id.toString() : st.id;
      staffMap[idKey] = {
        _id: idKey,
        id: idKey,
        staffId: st.staffId || `AKE-STF-${String(idx + 1).padStart(3, '0')}`,
        staffUserId: idKey,
        name: st.name,
        staffName: st.name,
        mobile: st.mobile,
        status: st.status,
        transactions: 0,
        quantityKg: 0,
        totalQuantityKg: 0,
        totalSales: 0,
        cashSales: 0,
        upiSales: 0
      };
    });

    sales.forEach(s => {
      const key = s.staffUserId || s.salesperson;
      if (!key) return;

      if (!staffMap[key]) {
        staffMap[key] = {
          staffId: 'STAFF',
          staffUserId: key,
          name: s.staffName || s.salesperson || 'Staff',
          staffName: s.staffName || s.salesperson || 'Staff',
          mobile: '',
          status: 'Active',
          transactions: 0,
          quantityKg: 0,
          totalQuantityKg: 0,
          totalSales: 0,
          cashSales: 0,
          upiSales: 0
        };
      }

      const kg = s.product?.includes('25') ? (s.qty || s.quantity || 1) * 25 : (s.qty || s.quantity || 1);
      const amt = (s.total || s.totalAmount || 0);

      staffMap[key].transactions += 1;
      staffMap[key].quantityKg += kg;
      staffMap[key].totalQuantityKg += kg;
      staffMap[key].totalSales += amt;

      const pay = (s.payment || s.paymentMethod || 'Cash').toLowerCase();
      if (pay.includes('cash')) {
        staffMap[key].cashSales += amt;
      } else if (pay.includes('upi')) {
        staffMap[key].upiSales += amt;
      }
    });

    const comparison = Object.values(staffMap).map(item => ({
      ...item,
      averageOrderValue: item.transactions > 0 ? Math.round(item.totalSales / item.transactions) : 0,
      avgOrderValue: item.transactions > 0 ? Math.round(item.totalSales / item.transactions) : 0
    }));

    // Sorting
    const sortField = sortBy || 'sales';
    comparison.sort((a, b) => {
      if (sortField === 'quantity') return b.quantityKg - a.quantityKg;
      if (sortField === 'transactions') return b.transactions - a.transactions;
      return b.totalSales - a.totalSales;
    });

    return res.status(200).json({
      success: true,
      count: comparison.length,
      comparison
    });
  } catch (error) {
    console.error('[PosStaffController] getStaffReports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate staff sales reports', error: error.message });
  }
};
