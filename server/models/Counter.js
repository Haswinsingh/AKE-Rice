const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);
module.exports = createModel('counters', Counter);
