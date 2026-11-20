const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const saleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  transactionId: { type: String, index: true },
  staffUserId: { type: String, index: true },
  staffName: { type: String, index: true },
  customerName: { type: String, trim: true },
  mobile: { type: String, trim: true },
  phone: { type: String, trim: true },
  shop: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  riceType: { type: String },
  productId: { type: String },
  qty: { type: Number, required: true },
  quantity: { type: Number },
  rate: { type: Number, required: true },
  ratePerKg: { type: Number },
  subtotal: { type: Number },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  totalAmount: { type: Number },
  payment: { type: String, required: true, default: 'Cash' },
  paymentMethod: { type: String, default: 'Cash' },
  paymentStatus: { type: String, default: 'Paid' },
  status: { type: String, required: true, default: 'Delivered' },
  transactionStatus: { type: String, default: 'Delivered' },
  salesperson: { type: String, required: true, default: 'Sales Agent' },
  date: { type: String, required: true },
  transactionDate: { type: String },
  screenshot: { type: String },
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

const Sale = mongoose.model('Sale', saleSchema);
module.exports = createModel('sales', Sale);
