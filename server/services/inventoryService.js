const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');

/**
 * Recalculate product stockStatus based on availableStockKg and threshold
 */
function computeStockStatus(availableStockKg, thresholdKg = 200, status = 'Active') {
  if (status === 'Inactive') return 'OUT OF STOCK';
  if (availableStockKg <= 0) return 'OUT OF STOCK';
  if (availableStockKg <= thresholdKg) return 'LOW STOCK';
  return 'IN STOCK';
}

/**
 * Validate if product has sufficient stock for requested quantity
 */
async function validateStock(productId, requestedUnits, productLookup = null) {
  let product = productLookup;
  if (!product) {
    product = await Product.findOne({ $or: [{ id: productId }, { name: productId }] });
  }

  if (!product) {
    return { valid: false, message: 'Requested product not found in catalog.' };
  }

  if (product.status === 'Inactive' || product.isAvailable === false) {
    return { valid: false, message: `"${product.name}" is currently inactive and not available for booking.` };
  }

  const unitWeight = Number(product.unitWeightKg) || 1;
  const requestedKg = Number(requestedUnits) * unitWeight;
  const availableKg = Number(product.availableStockKg !== undefined ? product.availableStockKg : (product.stock || 0));

  if (availableKg <= 0) {
    return { 
      valid: false, 
      message: `"${product.name}" is currently OUT OF STOCK. Please check back soon or choose another package size.`,
      product,
      requestedKg,
      availableKg
    };
  }

  if (requestedKg > availableKg) {
    return {
      valid: false,
      message: `Requested quantity exceeds available stock. You requested ${requestedKg} KG (${requestedUnits} units), but only ${availableKg} KG is available.`,
      product,
      requestedKg,
      availableKg
    };
  }

  return { valid: true, product, requestedKg, availableKg };
}

/**
 * Automatically deduct inventory when an order is created
 */
async function deductStockForOrder(order, performedBy = 'Customer Order') {
  if (!order) return { success: false, message: 'No order provided' };

  let product = null;
  if (order.productId) {
    product = await Product.findOne({ id: order.productId });
  }
  if (!product && order.product) {
    product = await Product.findOne({ $or: [{ name: order.product }, { id: order.product }] });
  }

  if (!product) {
    return { success: false, message: `Product "${order.product || order.productId}" not found` };
  }

  const unitWeight = Number(product.unitWeightKg) || 1;
  const requestedKg = (Number(order.qty) || 1) * unitWeight;

  const stockBefore = Number(product.availableStockKg !== undefined ? product.availableStockKg : 5000);
  const stockAfter = Math.max(0, stockBefore - requestedKg);
  const totalOrdered = (Number(product.totalOrderedKg) || 0) + requestedKg;

  product.availableStockKg = stockAfter;
  product.totalOrderedKg = totalOrdered;
  product.stock = stockAfter;
  product.stockStatus = computeStockStatus(stockAfter, product.lowStockThresholdKg, product.status);

  if (stockAfter <= 0) {
    product.isAvailable = false;
  }

  await product.save();

  // Create Transaction Audit Log
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
  const txnId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const txn = new InventoryTransaction({
    id: txnId,
    orderId: order.id,
    productId: product.id,
    productName: product.name,
    qtyKg: requestedKg,
    stockBefore,
    stockAfter,
    type: 'Order Deduction',
    note: `Order ${order.id} placed by ${order.name} (${order.qty} units / ${requestedKg} KG)`,
    performedBy,
    date: dateStr,
    time: timeStr
  });
  await txn.save();

  // Mark order stock deduction
  order.stockDeductedKg = requestedKg;
  order.stockRestored = false;
  await order.save();

  return {
    success: true,
    qtyKg: requestedKg,
    stockBefore,
    stockAfter,
    stockStatus: product.stockStatus
  };
}

/**
 * Automatically restore inventory when an order is cancelled or payment rejected
 * Safe against double restoration
 */
async function restoreStockForOrder(order, performedBy = 'System', reason = 'Order Cancelled') {
  if (!order) return { success: false, message: 'No order provided' };

  if (order.stockRestored) {
    return { success: false, message: `Stock for order ${order.id} was already restored earlier.` };
  }

  let product = null;
  if (order.productId) {
    product = await Product.findOne({ id: order.productId });
  }
  if (!product && order.product) {
    product = await Product.findOne({ $or: [{ name: order.product }, { id: order.product }] });
  }

  if (!product) {
    order.stockRestored = true;
    await order.save();
    return { success: false, message: `Product not found for restoration.` };
  }

  const unitWeight = Number(product.unitWeightKg) || 1;
  const restoreKg = order.stockDeductedKg > 0 
    ? order.stockDeductedKg 
    : ((Number(order.qty) || 1) * unitWeight);

  const stockBefore = Number(product.availableStockKg !== undefined ? product.availableStockKg : 0);
  const stockAfter = stockBefore + restoreKg;
  const totalOrdered = Math.max(0, (Number(product.totalOrderedKg) || 0) - restoreKg);

  product.availableStockKg = stockAfter;
  product.totalOrderedKg = totalOrdered;
  product.stock = stockAfter;
  if (stockAfter > 0 && product.status === 'Active') {
    product.isAvailable = true;
  }
  product.stockStatus = computeStockStatus(stockAfter, product.lowStockThresholdKg, product.status);

  await product.save();

  // Create Transaction Audit Log
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
  const txnId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const txn = new InventoryTransaction({
    id: txnId,
    orderId: order.id,
    productId: product.id,
    productName: product.name,
    qtyKg: restoreKg,
    stockBefore,
    stockAfter,
    type: 'Stock Restoration',
    note: `Restored ${restoreKg} KG for Order ${order.id} (${reason})`,
    performedBy,
    date: dateStr,
    time: timeStr
  });
  await txn.save();

  // Flag order as restored to prevent any subsequent duplicate restorations
  order.stockRestored = true;
  await order.save();

  return {
    success: true,
    qtyKg: restoreKg,
    stockBefore,
    stockAfter,
    stockStatus: product.stockStatus
  };
}

/**
 * Adjust stock or update initial stock levels from Admin
 */
async function adjustStock(productId, adjustmentData, adminUser = null) {
  const product = await Product.findOne({ $or: [{ id: productId }, { name: productId }] });
  if (!product) {
    return { success: false, message: 'Product not found' };
  }

  const stockBefore = Number(product.availableStockKg !== undefined ? product.availableStockKg : (product.stock || 0));
  let stockAfter = stockBefore;
  let transactionType = 'Admin Adjustment';
  let diffKg = 0;

  if (adjustmentData.initialStockKg !== undefined) {
    const newInitial = Number(adjustmentData.initialStockKg);
    product.initialStockKg = newInitial;
    // Available = Initial - Total Confirmed Ordered
    const orderedKg = Number(product.totalOrderedKg) || 0;
    stockAfter = Math.max(0, newInitial - orderedKg);
    diffKg = stockAfter - stockBefore;
    transactionType = 'Initial Stock Entry';
  } else if (adjustmentData.addStockKg !== undefined) {
    const addKg = Number(adjustmentData.addStockKg);
    product.initialStockKg = (Number(product.initialStockKg) || 0) + addKg;
    stockAfter = stockBefore + addKg;
    diffKg = addKg;
  } else if (adjustmentData.setAvailableStockKg !== undefined) {
    stockAfter = Math.max(0, Number(adjustmentData.setAvailableStockKg));
    diffKg = stockAfter - stockBefore;
  }

  if (adjustmentData.lowStockThresholdKg !== undefined) {
    product.lowStockThresholdKg = Number(adjustmentData.lowStockThresholdKg);
  }

  product.availableStockKg = stockAfter;
  product.stock = stockAfter;
  if (stockAfter > 0 && product.status === 'Active') {
    product.isAvailable = true;
  }
  product.stockStatus = computeStockStatus(stockAfter, product.lowStockThresholdKg, product.status);

  await product.save();

  // Record audit transaction
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
  const txnId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const txn = new InventoryTransaction({
    id: txnId,
    productId: product.id,
    productName: product.name,
    qtyKg: Math.abs(diffKg),
    stockBefore,
    stockAfter,
    type: transactionType,
    note: adjustmentData.note || `Admin stock adjustment by ${adminUser?.name || 'Administrator'}`,
    performedBy: adminUser?.name || 'Admin',
    date: dateStr,
    time: timeStr
  });
  await txn.save();

  return {
    success: true,
    product,
    transaction: txn
  };
}

/**
 * Get comprehensive inventory overview and metrics
 */
async function getInventorySummary() {
  const products = await Product.find({}).sort({ displayOrder: 1, createdAt: 1 });

  let totalInitialKg = 0;
  let totalAvailableKg = 0;
  let totalOrderedKg = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const productSummaries = products.map(p => {
    const initialKg = Number(p.initialStockKg !== undefined ? p.initialStockKg : 5000);
    const orderedKg = Number(p.totalOrderedKg !== undefined ? p.totalOrderedKg : 0);
    const availableKg = Number(p.availableStockKg !== undefined ? p.availableStockKg : Math.max(0, initialKg - orderedKg));
    const thresholdKg = Number(p.lowStockThresholdKg !== undefined ? p.lowStockThresholdKg : 200);
    const status = computeStockStatus(availableKg, thresholdKg, p.status);

    totalInitialKg += initialKg;
    totalAvailableKg += availableKg;
    totalOrderedKg += orderedKg;

    if (status === 'OUT OF STOCK') outOfStockCount++;
    else if (status === 'LOW STOCK') lowStockCount++;

    return {
      _id: p._id,
      id: p.id,
      name: p.name,
      tamilName: p.tamilName,
      packageSize: p.packageSize,
      unitWeightKg: p.unitWeightKg || 1,
      price: p.price,
      ratePerKg: p.ratePerKg,
      initialStockKg: initialKg,
      totalOrderedKg: orderedKg,
      availableStockKg: availableKg,
      lowStockThresholdKg: thresholdKg,
      stockStatus: status,
      status: p.status,
      isAvailable: p.isAvailable && status !== 'OUT OF STOCK',
      image: p.image
    };
  });

  return {
    summary: {
      totalInitialKg,
      totalAvailableKg,
      totalOrderedKg,
      lowStockCount,
      outOfStockCount,
      totalProducts: productSummaries.length
    },
    products: productSummaries
  };
}

/**
 * Get inventory transaction logs
 */
async function getInventoryTransactions(limit = 100) {
  const txns = await InventoryTransaction.find({}).sort({ createdAt: -1 });
  return (txns || []).slice(0, limit);
}

module.exports = {
  validateStock,
  deductStockForOrder,
  restoreStockForOrder,
  adjustStock,
  getInventorySummary,
  getInventoryTransactions,
  computeStockStatus
};
