const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: String, default: 'System' },
  note: { type: String }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  productId: { type: String, default: '1kg' },
  qty: { type: Number, required: true, min: 1 },
  stockDeductedKg: { type: Number, default: 0 },
  stockRestored: { type: Boolean, default: false },
  rate: { type: Number, required: true },
  total: { type: Number, required: true },
  payment: { 
    type: String, 
    enum: ['Cash on Delivery', 'Online Payment', 'Cash', 'Online'], 
    default: 'Cash on Delivery' 
  },
  paymentType: { type: String, default: 'Cash on Delivery' },
  upiId: { type: String },
  utr: { type: String },
  screenshot: { type: String },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Pending Verification', 'Verified', 'Rejected', 'Refunded', 'Cash on Delivery'],
    default: 'Pending Verification'
  },
  paymentVerifiedBy: { type: String },
  paymentVerifiedAt: { type: Date },
  paymentRemarks: { type: String },
  status: {
    type: String,
    enum: [
      'Order Placed',
      'Pending',
      'Payment Pending',
      'Payment Verification',
      'Confirmed',
      'Processing',
      'Ready for Delivery',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ],
    default: 'Pending'
  },
  statusHistory: [statusHistorySchema],
  source: { type: String, default: 'Website' },
  date: { type: String },
  time: { type: String },
  dateTime: { type: String },
  notes: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: {
    id: { type: String },
    name: { type: String },
    role: { type: String },
    email: { type: String }
  },
  deletionReason: { type: String },
  isTest: { type: Boolean, default: false, index: true },
  testReason: { type: String },
  googleDriveExport: {
    status: {
      type: String,
      enum: ['pending', 'exported', 'failed', 'not_configured'],
      default: 'pending'
    },
    fileId: { type: String },
    fileName: { type: String },
    exportedAt: { type: Date },
    error: { type: String },
    retryCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
module.exports = createModel('orders', Order);
