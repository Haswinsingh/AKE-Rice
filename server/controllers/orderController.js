const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const OrderAuditLog = require('../models/OrderAuditLog');
const { generateNextOrderId } = require('../services/orderIdService');
const { generateWaTextForOrder, getWhatsAppUrl } = require('../services/whatsappService');
const inventoryService = require('../services/inventoryService');
const googleDriveService = require('../services/googleDriveService');
const { isSuperAdminUser } = require('../middleware/authMiddleware');

/**
 * Place a new order
 */
exports.createOrder = async (req, res) => {
  try {
    let {
      name,
      mobile,
      area,
      address,
      product,
      productId,
      qty,
      paymentType,
      utr,
      screenshot,
      notes
    } = req.body;

    if (!name || !mobile || (!product && !productId) || !qty || !area || !address) {
      return res.status(400).json({ success: false, message: 'Please provide all required order details.' });
    }

    mobile = mobile.toString().trim().replace(/\D/g, '');
    if (mobile.length > 10) mobile = mobile.slice(-10);
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const isOnline = paymentType === 'Online' || paymentType === 'Online Payment';
    if (isOnline) {
      if (!utr) {
        return res.status(400).json({ success: false, message: 'UTR / Transaction ID is required for online payment.' });
      }
    }

    // Dynamic product & price calculation from Database
    let dbProduct = null;
    if (productId) {
      dbProduct = await Product.findOne({ id: productId });
    }
    if (!dbProduct && product) {
      dbProduct = await Product.findOne({ $or: [{ name: product }, { id: product }] });
    }

    let rate = 195;
    let total = 0;
    let productName = product || '1 KG Rice';
    let pId = productId || '1kg';

    if (dbProduct) {
      productName = dbProduct.name;
      pId = dbProduct.id;
      rate = dbProduct.ratePerKg || (dbProduct.price / (dbProduct.unitWeightKg || 1));
      total = dbProduct.price ? (qty * dbProduct.price) : (qty * (dbProduct.unitWeightKg || 1) * rate);
    } else {
      // Default fallback: 1 KG = ₹195, 25 KG = ₹4,625 (₹185/KG)
      if (product === '25 KG Rice' || productId === '25kg') {
        productName = '25 KG Rice';
        pId = '25kg';
        rate = 185;
        total = qty * 4625;
      } else {
        productName = '1 KG Rice';
        pId = '1kg';
        rate = 195;
        total = qty * 195;
      }
    }
    product = productName;
    productId = pId;

    // Validate inventory stock availability before placing order
    const stockCheck = await inventoryService.validateStock(productId, qty, dbProduct);
    if (!stockCheck.valid) {
      return res.status(400).json({
        success: false,
        message: stockCheck.message,
        availableStockKg: stockCheck.availableKg
      });
    }

    const unitWeightKg = dbProduct?.unitWeightKg || (productId === '25kg' ? 25 : 1);
    const orderStockKg = qty * unitWeightKg;

    // Generate atomic sequential Order ID (AKE000001, AKE000002, etc.)
    const orderId = await generateNextOrderId();

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
    const dateTimeStr = `${dateStr} ${timeStr}`;

    // Link customer
    let customerUser = req.user;
    if (!customerUser) {
      customerUser = await User.findOne({ mobile });
      if (!customerUser) {
        customerUser = new User({
          id: `cust_${mobile}`,
          name: name.trim(),
          mobile,
          role: 'customer',
          authProvider: 'otp'
        });
        await customerUser.save();
      }
    }

    const newOrder = new Order({
      id: orderId,
      customer: customerUser ? customerUser._id : undefined,
      name: name.trim(),
      mobile,
      area: area.trim(),
      address: address.trim(),
      product,
      productId,
      qty,
      stockDeductedKg: orderStockKg,
      stockRestored: false,
      rate,
      total,
      payment: isOnline ? 'Online Payment' : 'Cash on Delivery',
      paymentType: isOnline ? 'Online Payment' : 'Cash on Delivery',
      upiId: isOnline ? (process.env.UPI_ID || 'kaviyansellappan15@oksbi') : undefined,
      utr: isOnline ? utr.trim() : undefined,
      screenshot: isOnline ? screenshot : undefined,
      paymentStatus: isOnline ? 'Pending Verification' : 'Cash on Delivery',
      status: 'Pending',
      source: 'Website',
      date: dateStr,
      time: timeStr,
      dateTime: dateTimeStr,
      notes: notes ? notes.trim() : '',
      statusHistory: [{
        status: 'Order Placed',
        changedAt: now,
        note: `Order submitted via Website. Payment: ${isOnline ? 'Online UPI' : 'COD'}`
      }]
    });

    await newOrder.save();

    // Automatically deduct inventory stock and record audit transaction
    await inventoryService.deductStockForOrder(newOrder, customerUser ? customerUser.name : name.trim());

    // Trigger automatic Google Drive monthly Excel backup asynchronously (non-blocking)
    googleDriveService.exportOrder(newOrder).catch(err => {
      console.error('[GoogleDrive Trigger] Failed to auto-export order to Drive:', err.message);
    });

    // Generate WhatsApp text and URL
    const whatsappText = generateWaTextForOrder(newOrder);
    const whatsappUrl = getWhatsAppUrl(newOrder);

    return res.status(201).json({
      success: true,
      message: `Order ${orderId} placed successfully!`,
      order: newOrder,
      whatsappText,
      whatsappUrl
    });
  } catch (error) {
    console.error('[OrderController] createOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to place order.', error: error.message });
  }
};

/**
 * Get orders (Role-based: customer sees theirs, admin sees all)
 */
exports.getOrders = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    let query = {};

    if (!isAdmin) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      query = {
        isDeleted: { $ne: true },
        $or: [
          { customer: req.user._id },
          { mobile: req.user.mobile }
        ]
      };
    } else {
      // Admin filters
      const { status, paymentStatus, search, area, startDate, endDate, trash, includeTest } = req.query;

      if (trash === 'true') {
        query.isDeleted = true;
      } else {
        query.isDeleted = { $ne: true };
        if (includeTest !== 'true') {
          query.isTest = { $ne: true };
        }
      }

      if (status && status !== 'all') query.status = status;
      if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
      if (area && area !== 'all') query.area = new RegExp(area, 'i');
      if (search) {
        query.$or = [
          { id: new RegExp(search, 'i') },
          { name: new RegExp(search, 'i') },
          { mobile: new RegExp(search, 'i') },
          { area: new RegExp(search, 'i') }
        ];
      }
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
};

/**
 * Get single order by ID
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id }).populate('customer', 'name mobile email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If customer, verify ownership
    if (req.user.role !== 'admin') {
      const isOwner = (order.customer && order.customer._id.toString() === req.user._id.toString()) ||
        order.mobile === req.user.mobile;
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const whatsappText = generateWaTextForOrder(order);
    const whatsappUrl = getWhatsAppUrl(order);

    return res.status(200).json({
      success: true,
      order,
      whatsappText,
      whatsappUrl
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve order', error: error.message });
  }
};

/**
 * Admin: Update delivery / order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user.name || 'Admin',
      note: note || `Status changed to ${status}`
    });

    await order.save();

    // If order is cancelled and stock has not yet been restored, automatically restore stock
    if (status === 'Cancelled' && !order.stockRestored) {
      await inventoryService.restoreStockForOrder(order, req.user?.name || 'Admin', note || 'Order status changed to Cancelled');
    }

    // Update transaction in Google Drive monthly Excel backup asynchronously
    googleDriveService.exportOrder(order).catch(err => {
      console.error('[GoogleDrive Trigger] Failed to update order status in Drive:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update order status', error: error.message });
  }
};

/**
 * Admin: Verify or reject payment screenshot
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { action, remarks } = req.body; // action: 'verify' or 'reject'
    if (!action || !['verify', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "verify" or "reject"' });
    }

    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (action === 'verify') {
      order.paymentStatus = 'Verified';
      order.paymentVerifiedBy = req.user.name || 'Admin';
      order.paymentVerifiedAt = new Date();
      order.paymentRemarks = remarks || 'Payment verified against UPI bank transaction.';
      if (order.status === 'Pending' || order.status === 'Payment Pending' || order.status === 'Payment Verification') {
        order.status = 'Confirmed';
      }
      order.statusHistory.push({
        status: order.status,
        changedAt: new Date(),
        changedBy: req.user.name || 'Admin',
        note: `Online payment verified. ${remarks || ''}`
      });
    } else {
      order.paymentStatus = 'Rejected';
      order.status = 'Cancelled';
      order.paymentVerifiedBy = req.user.name || 'Admin';
      order.paymentVerifiedAt = new Date();
      order.paymentRemarks = remarks || 'Payment verification rejected. Invalid transaction or screenshot.';
      order.statusHistory.push({
        status: 'Cancelled',
        changedAt: new Date(),
        changedBy: req.user.name || 'Admin',
        note: `Payment screenshot rejected. Reason: ${remarks || 'Invalid proof'}`
      });

      await order.save();

      // If online payment is rejected, restore stock automatically
      if (!order.stockRestored) {
        await inventoryService.restoreStockForOrder(order, req.user?.name || 'Admin', remarks || 'Payment rejected by Admin');
      }
    }

    if (action === 'verify') {
      await order.save();
    }

    // Update verified/rejected transaction in Google Drive monthly backup asynchronously
    googleDriveService.exportOrder(order).catch(err => {
      console.error('[GoogleDrive Trigger] Failed to update payment verification in Drive:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully.`,
      order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update payment verification', error: error.message });
  }
};

/**
 * Admin & Super Admin: Get soft-deleted orders (Trash bin)
 */
exports.getDeletedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ isDeleted: true }).sort({ deletedAt: -1, createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('[OrderController] getDeletedOrders error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch deleted orders', error: error.message });
  }
};

/**
 * Admin & Super Admin: Soft delete order to Trash with audit logging
 */
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.isDeleted) {
      return res.status(400).json({ success: false, message: 'Order is already in Trash' });
    }

    const deletionReason = (reason && reason.trim()) || 'Order deleted by administrator';

    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = {
      id: req.user._id ? req.user._id.toString() : req.user.id,
      name: req.user.name || 'Admin',
      role: req.user.role || 'admin',
      email: req.user.email || ''
    };
    order.deletionReason = deletionReason;

    await order.save();

    // If order has un-restored inventory stock and is not cancelled, restore it
    if (!order.stockRestored && order.status !== 'Cancelled') {
      await inventoryService.restoreStockForOrder(
        order,
        req.user?.name || 'Admin',
        `Order moved to trash: ${deletionReason}`
      ).catch(e => console.error('[Inventory] Restore stock error on delete:', e));
    }

    // Record audit log
    await OrderAuditLog.create({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderId: order.id,
      action: 'delete',
      orderDetails: {
        id: order.id,
        customerName: order.name,
        mobile: order.mobile,
        address: order.address,
        product: order.product,
        qty: order.qty,
        total: order.total,
        date: order.date,
        status: order.status,
        paymentMethod: order.payment
      },
      performedBy: {
        id: req.user._id ? req.user._id.toString() : req.user.id,
        name: req.user.name || 'Admin',
        role: req.user.role || 'admin',
        email: req.user.email || '',
        isSuperAdmin: isSuperAdminUser(req.user)
      },
      reason: deletionReason
    }).catch(e => console.error('[OrderAuditLog] Create error:', e));

    // Remove from Google Drive daily sheet and recalculate summaries
    googleDriveService.removeOrderFromDrive(order.id, order.date || order.createdAt).catch(err => {
      console.error('[GoogleDrive] Failed to remove deleted order from Drive:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Order ${order.id} has been moved to Trash.`,
      order
    });
  } catch (error) {
    console.error('[OrderController] deleteOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete order', error: error.message });
  }
};

/**
 * Admin & Super Admin: Restore soft-deleted order from Trash
 */
exports.restoreOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.isDeleted) {
      return res.status(400).json({ success: false, message: 'Order is not in Trash' });
    }

    order.isDeleted = false;
    order.deletedAt = null;
    order.deletedBy = null;
    order.deletionReason = null;

    await order.save();

    // Re-deduct stock if needed
    if (order.stockRestored && order.status !== 'Cancelled') {
      await inventoryService.deductStockForOrder(
        order,
        req.user?.name || 'Admin'
      ).catch(e => console.error('[Inventory] Re-deduct stock error on restore:', e));
    }

    // Record audit log
    await OrderAuditLog.create({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderId: order.id,
      action: 'restore',
      orderDetails: {
        id: order.id,
        customerName: order.name,
        mobile: order.mobile,
        address: order.address,
        product: order.product,
        qty: order.qty,
        total: order.total,
        date: order.date,
        status: order.status,
        paymentMethod: order.payment
      },
      performedBy: {
        id: req.user._id ? req.user._id.toString() : req.user.id,
        name: req.user.name || 'Admin',
        role: req.user.role || 'admin',
        email: req.user.email || '',
        isSuperAdmin: isSuperAdminUser(req.user)
      },
      reason: 'Order restored from Trash'
    }).catch(e => console.error('[OrderAuditLog] Create error:', e));

    // Re-export order to Google Drive daily sheet
    googleDriveService.exportOrder(order).catch(err => {
      console.error('[GoogleDrive] Failed to restore order to Drive:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Order ${order.id} restored successfully.`,
      order
    });
  } catch (error) {
    console.error('[OrderController] restoreOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to restore order', error: error.message });
  }
};

/**
 * Super Admin ONLY: Permanently delete order
 */
exports.permanentDeleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Forbidden. Permanent deletion requires Super Admin authorization.'
      });
    }

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Record audit log BEFORE permanently deleting
    await OrderAuditLog.create({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderId: order.id,
      action: 'permanent_delete',
      orderDetails: {
        id: order.id,
        customerName: order.name,
        mobile: order.mobile,
        address: order.address,
        product: order.product,
        qty: order.qty,
        total: order.total,
        date: order.date,
        status: order.status,
        paymentMethod: order.payment
      },
      performedBy: {
        id: req.user._id ? req.user._id.toString() : req.user.id,
        name: req.user.name || 'Super Admin',
        role: req.user.role || 'admin',
        email: req.user.email || '',
        isSuperAdmin: true
      },
      reason: 'Permanently deleted by Super Admin'
    }).catch(e => console.error('[OrderAuditLog] Create error:', e));

    // Remove from Google Drive
    googleDriveService.removeOrderFromDrive(order.id, order.date || order.createdAt).catch(err => {
      console.error('[GoogleDrive] Failed to remove permanently deleted order from Drive:', err.message);
    });

    await Order.deleteOne({ id });

    return res.status(200).json({
      success: true,
      message: `Order ${order.id} permanently deleted from database.`
    });
  } catch (error) {
    console.error('[OrderController] permanentDeleteOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to permanently delete order', error: error.message });
  }
};
