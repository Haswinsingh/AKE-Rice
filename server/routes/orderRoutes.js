const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireAdmin, requireSuperAdmin, optionalAuth } = require('../middleware/authMiddleware');

// Create order (Customer can be logged in or guest)
router.post('/', optionalAuth, orderController.createOrder);

// Get orders (Role-based: customer sees theirs, admin sees all)
router.get('/', optionalAuth, orderController.getOrders);

// Admin & Super Admin: Get soft-deleted orders in Trash
router.get('/trash', verifyToken, requireAdmin, orderController.getDeletedOrders);

// Get single order
router.get('/:id', optionalAuth, orderController.getOrderById);

// Admin: Update order delivery status
router.put('/:id/status', verifyToken, requireAdmin, orderController.updateOrderStatus);

// Admin: Verify or reject payment screenshot
router.put('/:id/payment', verifyToken, requireAdmin, orderController.verifyPayment);

// Admin & Super Admin: Soft delete order to Trash
router.delete('/:id', verifyToken, requireAdmin, orderController.deleteOrder);

// Admin & Super Admin: Restore soft-deleted order from Trash
router.post('/:id/restore', verifyToken, requireAdmin, orderController.restoreOrder);

// Super Admin ONLY: Permanently delete order from database
router.delete('/:id/permanent', verifyToken, requireSuperAdmin, orderController.permanentDeleteOrder);

module.exports = router;
