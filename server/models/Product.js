const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  tamilName: { type: String, default: 'கொப்பம்பட்டி சீரக சம்பா அரிசி' },
  description: { type: String, required: true },
  category: { type: String, default: 'Seeraga Samba' },
  packageSize: { type: String, required: true },
  unitWeightKg: { type: Number, required: true },
  price: { type: Number, required: true },
  ratePerKg: { type: Number, required: true },
  image: { type: String, required: true },
  additionalImages: [{ type: String }],
  stock: { type: Number, default: 500 },
  initialStockKg: { type: Number, default: 5000 },
  availableStockKg: { type: Number, default: 5000 },
  totalOrderedKg: { type: Number, default: 0 },
  lowStockThresholdKg: { type: Number, default: 200 },
  stockStatus: { 
    type: String, 
    default: 'IN STOCK', 
    enum: ['IN STOCK', 'LOW STOCK', 'OUT OF STOCK'] 
  },
  isAvailable: { type: Boolean, default: true },
  status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
  displayOrder: { type: Number, default: 0 },
  highlights: [{ type: String }],
  specifications: {
    origin: { type: String, default: 'Koppampatty, Tamil Nadu' },
    grainType: { type: String, default: 'Aromatic Short Grain' },
    fssaiLicense: { type: String, default: '22423545000216' },
    shelfLife: { type: String, default: '12 Months' }
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = createModel('products', Product);
