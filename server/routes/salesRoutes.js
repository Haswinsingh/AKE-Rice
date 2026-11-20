const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { verifyToken, requireAdmin, requirePosAccess, requirePosReports } = require('../middleware/authMiddleware');

// POS Sales operations (Create & Read sales) - Accessible by authorized Admins & active POS Staff
router.post('/', verifyToken, requirePosAccess, salesController.createSale);
router.get('/', verifyToken, requirePosAccess, salesController.getSales);
router.post('/sales', verifyToken, requirePosAccess, salesController.createSale);
router.get('/sales', verifyToken, requirePosAccess, salesController.getSales);
router.get('/today-sales', verifyToken, requirePosAccess, salesController.getSales);

// POS Reports & Performance comparison
router.get('/reports', verifyToken, requirePosReports, salesController.getPosReports);
router.get('/reports/staff/:staffId', verifyToken, requirePosReports, salesController.getPosReports);
router.get('/comparison', verifyToken, requirePosReports, salesController.getStaffComparison);
router.get('/export', verifyToken, requirePosReports, salesController.exportSalesReport);

// Admin-only management
router.put('/:id', verifyToken, requireAdmin, salesController.updateSale);
router.delete('/:id', verifyToken, requireAdmin, salesController.deleteSale);

module.exports = router;
