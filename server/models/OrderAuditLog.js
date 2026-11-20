const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const orderAuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, index: true },
  action: {
    type: String,
    enum: ['delete', 'restore', 'permanent_delete', 'test_cleanup', 'status_change', 'update'],
    required: true,
    index: true
  },
  orderDetails: {
    id: { type: String },
    customerName: { type: String },
    mobile: { type: String },
    address: { type: String },
    product: { type: String },
    qty: { type: Number },
    total: { type: Number },
    date: { type: String },
    status: { type: String },
    paymentMethod: { type: String }
  },
  performedBy: {
    id: { type: String },
    name: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String },
    isSuperAdmin: { type: Boolean, default: false }
  },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

const OrderAuditLog = mongoose.model('OrderAuditLog', orderAuditLogSchema);
module.exports = createModel('order_audit_logs', OrderAuditLog);
