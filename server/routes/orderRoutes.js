const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');

// Create order (Customer can be logged in or guest)
router.post('/', optionalAuth, orderController.createOrder);

// Get orders (Role-based: customer sees theirs, admin sees all)
router.get('/', optionalAuth, orderController.getOrders);

// Get single order
router.get('/:id', optionalAuth, orderController.getOrderById);

// Admin: Update order delivery status
router.put('/:id/status', verifyToken, requireAdmin, orderController.updateOrderStatus);

// Admin: Verify or reject payment screenshot
router.put('/:id/payment', verifyToken, requireAdmin, orderController.verifyPayment);

module.exports = router;
