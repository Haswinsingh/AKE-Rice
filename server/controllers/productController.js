const Product = require('../models/Product');
const { computeStockStatus } = require('../services/inventoryService');

// Default initial products with updated ₹195 (1 KG) and ₹4,625 (25 KG @ ₹185/KG)
const DEFAULT_PRODUCTS = [
  {
    id: '1kg',
    name: '1 KG Rice',
    tamilName: '1 கிலோ கொப்பம்பட்டி சீரக சம்பா அரிசி',
    description: 'Authentic Koppampatty Seeraga Samba Rice packed fresh in 1 KG zipper aroma-lock pouch. Ideal for family feasts and traditional biryani.',
    category: 'Seeraga Samba',
    packageSize: '1 KG Pouch',
    unitWeightKg: 1,
    price: 195,
    ratePerKg: 195,
    image: 'assets/packet_1kg.jpg',
    additionalImages: ['assets/packet_original.jpg', 'assets/manual_packing.jpg'],
    stock: 500,
    isAvailable: true,
    status: 'Active',
    displayOrder: 1,
    highlights: [
      '100% Traditional Koppampatty Harvest',
      'Small, intensely fragrant aromatic grain',
      'Rich in fiber, easy digestibility',
      'FSSAI Certified Quality Assurance'
    ]
  },
  {
    id: '25kg',
    name: '25 KG Rice',
    tamilName: '25 கிலோ கொப்பம்பட்டி சீரக சம்பா அரிசி மூட்டை',
    description: 'Wholesale & family bulk 25 KG woven sack of authentic Koppampatty Seeraga Samba Rice at special wholesale rate of ₹185/KG.',
    category: 'Bulk Wholesale',
    packageSize: '25 KG Bulk Bag',
    unitWeightKg: 25,
    price: 4625,
    ratePerKg: 185,
    image: 'assets/packet_25kg.jpg',
    additionalImages: ['assets/packet_original.jpg', 'assets/about_processing.jpg'],
    stock: 250,
    isAvailable: true,
    status: 'Active',
    displayOrder: 2,
    highlights: [
      'Wholesale bulk pricing (Save ₹250 per bag)',
      'Direct farm-to-door bulk packaging',
      'Moisture-resistant heavy duty woven bag',
      'Ideal for restaurants, caterers, and large events'
    ]
  }
];

// Helper to ensure products exist
async function ensureProductsSeeded() {
  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany(DEFAULT_PRODUCTS);
    console.log('[ProductController] Seeded default products with updated pricing.');
  }
}

/**
 * Public: Get all available active products for storefront
 */
exports.getProducts = async (req, res) => {
  try {
    await ensureProductsSeeded();
    const products = await Product.find({ isAvailable: true }).sort({ displayOrder: 1, unitWeightKg: 1 });
    return res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
};

/**
 * Admin: Get all products (Active and Inactive)
 */
exports.getAllProductsAdmin = async (req, res) => {
  try {
    await ensureProductsSeeded();
    const products = await Product.find({}).sort({ displayOrder: 1, unitWeightKg: 1 });
    return res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin products', error: error.message });
  }
};

/**
 * Get product by ID
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({ success: true, product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving product', error: error.message });
  }
};

/**
 * Admin: Create new product
 */
exports.createProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.name || !data.price) {
      return res.status(400).json({ success: false, message: 'Product name and price are required.' });
    }

    if (!data.id) {
      data.id = data.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    }

    data.price = Number(data.price) || 0;
    data.unitWeightKg = Number(data.unitWeightKg) || 1;
    data.ratePerKg = Number(data.ratePerKg) || (data.price / (data.unitWeightKg || 1));
    data.stock = Number(data.stock) || 100;
    data.initialStockKg = Number(data.initialStockKg) || 5000;
    data.availableStockKg = data.availableStockKg !== undefined ? Number(data.availableStockKg) : data.initialStockKg;
    data.totalOrderedKg = Number(data.totalOrderedKg) || 0;
    data.lowStockThresholdKg = Number(data.lowStockThresholdKg) || 200;
    data.displayOrder = Number(data.displayOrder) || 0;

    if (data.status) {
      data.isAvailable = data.status === 'Active';
    } else {
      data.status = data.isAvailable !== false ? 'Active' : 'Inactive';
      data.isAvailable = data.status === 'Active';
    }

    data.stockStatus = computeStockStatus(data.availableStockKg, data.lowStockThresholdKg, data.status);
    if (data.availableStockKg <= 0) {
      data.isAvailable = false;
    }

    if (!data.image) {
      data.image = 'assets/packet_1kg.jpg';
    }

    const newProduct = new Product(data);
    await newProduct.save();
    return res.status(201).json({ success: true, message: 'Product created successfully', product: newProduct });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to create product', error: error.message });
  }
};

/**
 * Admin: Update product
 */
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.unitWeightKg) updateData.unitWeightKg = Number(updateData.unitWeightKg);
    if (updateData.ratePerKg) updateData.ratePerKg = Number(updateData.ratePerKg);
    if (updateData.stock !== undefined) updateData.stock = Number(updateData.stock);
    if (updateData.initialStockKg !== undefined) updateData.initialStockKg = Number(updateData.initialStockKg);
    if (updateData.availableStockKg !== undefined) updateData.availableStockKg = Number(updateData.availableStockKg);
    if (updateData.lowStockThresholdKg !== undefined) updateData.lowStockThresholdKg = Number(updateData.lowStockThresholdKg);
    if (updateData.displayOrder !== undefined) updateData.displayOrder = Number(updateData.displayOrder);

    if (updateData.status) {
      updateData.isAvailable = updateData.status === 'Active';
    } else if (updateData.isAvailable !== undefined) {
      updateData.status = updateData.isAvailable ? 'Active' : 'Inactive';
    }

    if (updateData.availableStockKg !== undefined || updateData.lowStockThresholdKg !== undefined || updateData.status !== undefined) {
      const avail = updateData.availableStockKg !== undefined ? updateData.availableStockKg : 5000;
      const thresh = updateData.lowStockThresholdKg !== undefined ? updateData.lowStockThresholdKg : 200;
      const stat = updateData.status || 'Active';
      updateData.stockStatus = computeStockStatus(avail, thresh, stat);
      if (avail <= 0) {
        updateData.isAvailable = false;
      }
    }

    const product = await Product.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to update product', error: error.message });
  }
};

/**
 * Admin: Delete product
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ id: req.params.id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
  }
};
