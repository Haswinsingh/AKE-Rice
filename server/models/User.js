const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  fullAddress: { type: String, required: true },
  area: { type: String, required: true },
  pincode: { type: String },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  staffId: { type: String, sparse: true, trim: true },
  username: { type: String, sparse: true, trim: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, unique: true, sparse: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String },
  role: { 
    type: String, 
    enum: ['customer', 'admin', 'pos_staff', 'sales_agent'], 
    default: 'customer' 
  },
  status: {
    type: String,
    enum: ['Active', 'Disabled'],
    default: 'Active'
  },
  mobileVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String },
  addresses: [addressSchema],
  authProvider: { 
    type: String, 
    enum: ['otp', 'google', 'password'], 
    default: 'otp' 
  },
  otp: {
    code: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date }
  },
  isSuperAdmin: { type: Boolean, default: false },
  permissions: {
    type: Object,
    default: () => ({
      analytics: true,
      inventory: true,
      products: true,
      sales_pos: false,
      reports: true,
      orders: true,
      whatsapp_orders: true,
      customers: true,
      feedback: true,
      admin_management: false,
      settings: false,
      pos_staff_management: false,
      pos_reports: false,
      pos_reports_all_staff: false,
      view_own_sales: true,
      view_customer_info: false
    })
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
module.exports = createModel('users', User);
