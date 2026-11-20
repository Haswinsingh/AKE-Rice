const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['login', 'admin_login', 'verification'],
    default: 'login'
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // MongoDB TTL index: automatically deletes document once expired
  }
}, {
  timestamps: true
});

// Compound index for querying active unverified OTPs fast
otpSchema.index({ email: 1, verified: 1, expiresAt: 1 });

const OtpModel = mongoose.model('Otp', otpSchema);

module.exports = createModel('otps', OtpModel);
