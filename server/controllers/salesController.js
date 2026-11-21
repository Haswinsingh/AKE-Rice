const Sale = require('../models/Sale');
const inventoryService = require('../services/inventoryService');
const googleDriveService = require('../services/googleDriveService');

/**
 * Record a new offline POS sale entry (1 KG or 25 KG)
 * Automatically binds the authenticated staff member's session identity.
 * Frontend cannot manually assign or tamper with transaction ownership.
 */
exports.createSale = async (req, res) => {
  try {
    let {
      date,
      transactionDate,
      shop,
      customerName,
      mobile,
      phone,
      area,
      product,
      riceType,
      qty,
      quantity,
      rate,
      ratePerKg,
      subtotal,
      discount,
      payment,
      paymentMethod,
      paymentStatus,
      status,
      transactionStatus,
      screenshot,
      notes
    } = req.body;

    const finalShop = (customerName || shop || '').trim();
    const finalArea = (area || '').trim();
    let finalProduct = (riceType || product || '').trim();
    let finalQty = parseInt(quantity || qty, 10);
    let finalRate = parseFloat(ratePerKg || rate);

    if (!finalShop || !finalArea || !finalProduct || !finalQty || !finalRate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required sales fields (Customer/Shop Name, Area, Rice Variety, Quantity, and Rate).' 
      });
    }

    let total = 0;
    if (finalProduct === '25 KG Rice' || finalProduct.includes('25')) {
      total = finalQty * 25 * finalRate;
      finalProduct = '25 KG Rice';
    } else {
      total = finalQty * finalRate;
      finalProduct = '1 KG Rice';
    }

    const saleId = `S${Date.now().toString().slice(-4)}`;
    const todayStr = transactionDate || date || new Date().toISOString().split('T')[0];

    // Staff identity ALWAYS comes from authenticated session token (prevents spoofing)
    const staffUserId = req.user._id ? req.user._id.toString() : (req.user.id || 'pos_user');
    const staffName = req.user.name || 'Administrator';

    const newSale = new Sale({
      id: saleId,
      transactionId: saleId,
      date: todayStr,
      transactionDate: todayStr,
      shop: finalShop,
      customerName: finalShop,
      mobile: (mobile || phone || '').trim() || undefined,
      phone: (mobile || phone || '').trim() || undefined,
      area: finalArea,
      product: finalProduct,
      riceType: finalProduct,
      productId: finalProduct.includes('25') ? '25kg' : '1kg',
      qty: finalQty,
      quantity: finalQty,
      rate: finalRate,
      ratePerKg: finalRate,
      subtotal: subtotal !== undefined && !isNaN(parseFloat(subtotal)) ? parseFloat(subtotal) : total,
      discount: discount !== undefined && !isNaN(parseFloat(discount)) ? parseFloat(discount) : 0,
      total,
      totalAmount: total,
      payment: paymentMethod || payment || 'Cash',
      paymentMethod: paymentMethod || payment || 'Cash',
      paymentStatus: paymentStatus || 'Paid',
      status: transactionStatus || status || 'Delivered',
      transactionStatus: transactionStatus || status || 'Delivered',
      salesperson: staffName,
      staffName,
      staffUserId,
      screenshot: screenshot || undefined,
      notes: notes || ''
    });

    await newSale.save();

    // Trigger automatic Google Drive monthly Excel backup asynchronously (non-blocking)
    googleDriveService.exportSale(newSale).catch(err => {
      console.error('[GoogleDrive Trigger] Failed to auto-export POS sale to Drive:', err.message);
    });

    // Deduct inventory stock for offline POS sale
    if (newSale.status !== 'Cancelled') {
      const pId = finalProduct.includes('25') ? '25kg' : '1kg';
      await inventoryService.deductStockForOrder({
        id: newSale.id,
        name: newSale.shop,
        product: newSale.product,
        productId: pId,
        qty: newSale.qty,
        save: async () => {}
      }, staffName);
    }

    return res.status(201).json({
      success: true,
      message: `Saved ${finalProduct} sales entry successfully!`,
      sale: newSale
    });
  } catch (error) {
    console.error('[SalesController] createSale error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record sales entry', error: error.message });
  }
};

/**
 * Get all sales entries with role-based visibility:
 * - POS Staff can ONLY view their own transactions
 * - Admins can view all transactions or filter by specific staff member
 */
exports.getSales = async (req, res) => {
  try {
    const { area, salesperson, staffId, payment, product, startDate, endDate, search } = req.query;
    let query = {};

    if (staffId && staffId !== 'all') {
      query.$or = [
        { staffUserId: staffId },
        { salesperson: staffId },
        { staffName: staffId }
      ];
    } else if (salesperson && salesperson !== 'all') {
      query.$or = [
        { staffUserId: salesperson },
        { salesperson: salesperson },
        { staffName: salesperson }
      ];
    }

    if (area && area !== 'all') query.area = new RegExp(area, 'i');
    if (payment && payment !== 'all') {
      query.payment = payment;
    }
    if (product && product !== 'all') query.product = product;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { shop: searchRegex },
          { customerName: searchRegex },
          { area: searchRegex },
          { id: searchRegex },
          { transactionId: searchRegex }
        ]
      });
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const sales = await Sale.find(query).sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      sales
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch sales entries', error: error.message });
  }
};

/**
 * Get comprehensive POS sales reports with metric aggregations
 */
exports.getPosReports = async (req, res) => {
  try {
    const { staffId, period, startDate, endDate, payment, area } = req.query;
    let query = {};

    if (staffId && staffId !== 'all') {
      query.$or = [{ staffUserId: staffId }, { salesperson: staffId }, { staffName: staffId }];
    }

    if (area && area !== 'all') query.area = new RegExp(area, 'i');
    if (payment && payment !== 'all') query.payment = payment;

    // Period calculation
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
    let otherSales = 0;

    sales.forEach(s => {
      const kg = s.product?.includes('25') ? (s.quantity || s.qty || 1) * 25 : (s.quantity || s.qty || 1);
      totalQuantityKg += kg;
      const amt = (s.totalAmount !== undefined ? s.totalAmount : (s.total || 0));
      totalSalesAmount += amt;

      const pay = (s.payment || s.paymentMethod || 'Cash').toLowerCase();
      if (pay.includes('cash')) {
        cashSales += amt;
      } else if (pay.includes('upi')) {
        upiSales += amt;
      } else {
        otherSales += amt;
      }
    });

    const averageTransactionValue = totalTransactions > 0 ? Math.round(totalSalesAmount / totalTransactions) : 0;

    const summary = {
      totalSales: totalSalesAmount,
      totalSalesAmount,
      totalQuantityKg,
      transactionCount: totalTransactions,
      totalTransactions,
      avgTransactionValue: averageTransactionValue,
      averageTransactionValue,
      cashSales,
      upiSales,
      otherSales,
      paymentBreakdown: {
        cash: cashSales,
        upi: upiSales,
        other: otherSales
      }
    };

    return res.status(200).json({
      success: true,
      report: {
        ...summary,
        summary,
        transactions: sales
      },
      summary,
      transactions: sales
    });
  } catch (error) {
    console.error('[SalesController] getPosReports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate POS reports', error: error.message });
  }
};

/**
 * Get staff performance comparison table
 */
exports.getStaffComparison = async (req, res) => {
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

    // Group by staff
    const staffMap = {};
    sales.forEach(s => {
      const key = s.staffUserId || s.salesperson || 'Unassigned Staff';
      const name = s.staffName || s.salesperson || 'Staff';
      if (!staffMap[key]) {
        staffMap[key] = {
          staffId: key,
          name,
          staffName: name,
          transactions: 0,
          quantityKg: 0,
          totalQuantityKg: 0,
          totalSales: 0,
          cashSales: 0,
          upiSales: 0
        };
      }
      const kg = s.product?.includes('25') ? (s.qty || 1) * 25 : (s.qty || 1);
      staffMap[key].transactions += 1;
      staffMap[key].quantityKg += kg;
      staffMap[key].totalQuantityKg += kg;
      staffMap[key].totalSales += (s.total || 0);

      const pay = (s.payment || s.paymentMethod || 'Cash').toLowerCase();
      if (pay.includes('cash')) {
        staffMap[key].cashSales += (s.total || 0);
      } else if (pay.includes('upi')) {
        staffMap[key].upiSales += (s.total || 0);
      }
    });

    const comparison = Object.values(staffMap).map(item => ({
      ...item,
      averageOrderValue: item.transactions > 0 ? Math.round(item.totalSales / item.transactions) : 0,
      avgOrderValue: item.transactions > 0 ? Math.round(item.totalSales / item.transactions) : 0
    }));

    // Sort
    const sortField = sortBy || 'sales';
    comparison.sort((a, b) => {
      if (sortField === 'quantity') return b.quantityKg - a.quantityKg;
      if (sortField === 'transactions') return b.transactions - a.transactions;
      return b.totalSales - a.totalSales; // Default: highest sales first
    });

    return res.status(200).json({
      success: true,
      count: comparison.length,
      comparison
    });
  } catch (error) {
    console.error('[SalesController] getStaffComparison error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate staff comparison', error: error.message });
  }
};

/**
 * Export sales report to CSV format
 */
exports.exportSalesReport = async (req, res) => {
  try {
    const { staffId, period, startDate, endDate, payment } = req.query;
    let query = {};

    if (staffId && staffId !== 'all') {
      query.$or = [{ staffUserId: staffId }, { salesperson: staffId }];
    }

    if (payment && payment !== 'all') query.payment = payment;

    const today = new Date().toISOString().split('T')[0];
    if (period === 'today') query.date = today;
    else if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query.date = { $gte: d.toISOString().split('T')[0], $lte: today };
    } else if (period === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      query.date = { $gte: d.toISOString().split('T')[0], $lte: today };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const sales = await Sale.find(query).sort({ date: -1, createdAt: -1 });

    const headers = ['Transaction ID', 'Date', 'Staff Name', 'Customer / Shop', 'Area', 'Rice Product', 'Quantity', 'Rate (₹)', 'Payment Method', 'Total (₹)', 'Status'];
    const rows = sales.map(s => [
      `"${s.transactionId || s.id || ''}"`,
      `"${s.transactionDate || s.date || ''}"`,
      `"${s.staffName || s.salesperson || 'Staff'}"`,
      `"${(s.customerName || s.shop || '').replace(/"/g, '""')}"`,
      `"${(s.area || '').replace(/"/g, '""')}"`,
      `"${s.product || ''}"`,
      s.qty || 1,
      s.rate || 195,
      `"${s.payment || s.paymentMethod || 'Cash'}"`,
      s.total || 0,
      `"${s.status || s.transactionStatus || 'Delivered'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ake_rice_pos_report_${today}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to export sales report', error: error.message });
  }
};

/**
 * Update sales entry
 */
exports.updateSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale entry not found' });
    }

    // Update modified POS sale in Google Drive monthly backup asynchronously
    googleDriveService.exportSale(sale).catch(err => {
      console.error('[GoogleDrive Trigger] Failed to update POS sale in Drive:', err.message);
    });
    return res.status(200).json({ success: true, message: 'Sale updated', sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update sale', error: error.message });
  }
};

/**
 * Delete sales entry
 */
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndDelete({ id: req.params.id });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale entry not found' });
    }
    return res.status(200).json({ success: true, message: 'Sale deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete sale', error: error.message });
  }
};
