const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const inventoryTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  qtyKg: { type: Number, required: true },
  stockBefore: { type: Number, required: true },
  stockAfter: { type: Number, required: true },
  type: {
    type: String,
    enum: ['Order Deduction', 'Stock Restoration', 'Admin Adjustment', 'Initial Stock Entry', 'POS Sale Deduction'],
    required: true
  },
  note: { type: String },
  performedBy: { type: String, default: 'System' },
  date: { type: String },
  time: { type: String }
}, {
  timestamps: true
});

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
module.exports = createModel('inventory_transactions', InventoryTransaction);
