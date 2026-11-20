const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const feedbackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerId: { type: String },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, required: true, trim: true },
  photo: { type: String },
  product: { type: String, default: 'Koppampatty Seeraga Samba Rice' },
  orderId: { type: String },
  isVerifiedPurchase: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Hidden'], 
    default: 'Approved' 
  },
  reviewed: { type: Boolean, default: false },
  adminResponse: { type: String },
  date: { type: String }
}, {
  timestamps: true
});

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = createModel('feedback', Feedback);
