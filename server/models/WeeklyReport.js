const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const weeklyReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  period: {
    startStr: { type: String, required: true },
    endStr: { type: String, required: true },
    weekNumber: { type: Number },
    year: { type: Number }
  },
  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  codOrders: { type: Number, default: 0 },
  onlineOrders: { type: Number, default: 0 },
  deliveredOrders: { type: Number, default: 0 },
  pendingOrders: { type: Number, default: 0 },
  cancelledOrders: { type: Number, default: 0 },
  dispatchedTo: { type: String, default: 'kaviyansellappan15@gmail.com' },
  dispatchedAt: { type: Date, default: Date.now },
  htmlContent: { type: String },
  status: { type: String, enum: ['Dispatched', 'Draft', 'Failed'], default: 'Dispatched' }
}, {
  timestamps: true
});

const WeeklyReport = mongoose.model('WeeklyReport', weeklyReportSchema);
module.exports = createModel('weeklyreports', WeeklyReport);
