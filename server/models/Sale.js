const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const saleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  transactionId: { type: String, index: true },
  staffUserId: { type: String, index: true },
  staffName: { type: String, index: true },
  customerName: { type: String, trim: true },
  shop: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  riceType: { type: String },
  productId: { type: String },
  qty: { type: Number, required: true },
  quantity: { type: Number },
  rate: { type: Number, required: true },
  ratePerKg: { type: Number },
  total: { type: Number, required: true },
  totalAmount: { type: Number },
  payment: { type: String, required: true, default: 'Cash' },
  paymentMethod: { type: String, default: 'Cash' },
  status: { type: String, required: true, default: 'Delivered' },
  transactionStatus: { type: String, default: 'Delivered' },
  salesperson: { type: String, required: true, default: 'Sales Agent' },
  date: { type: String, required: true },
  transactionDate: { type: String },
  screenshot: { type: String },
  notes: { type: String }
}, {
  timestamps: true
});

const Sale = mongoose.model('Sale', saleSchema);
module.exports = createModel('sales', Sale);
