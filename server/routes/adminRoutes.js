const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const posStaffController = require('../controllers/posStaffController');
const { 
  verifyToken, 
  requireAdmin, 
  requirePermission, 
  requireSuperAdmin, 
  requirePosStaffManagement 
} = require('../middleware/authMiddleware');

// All admin routes require valid active admin role
router.use(verifyToken, requireAdmin);

router.get('/dashboard', requirePermission('analytics'), adminController.getDashboardAnalytics);
router.get('/reports', requirePermission('reports'), adminController.getReports);
router.get('/customers', requirePermission('customers'), adminController.getCustomersRegistry);

// Google Drive Transaction Backup routes (Reports permission required)
router.get('/drive-backup/status', requirePermission('reports'), adminController.getDriveBackupStatus);
router.post('/drive-backup/test-connection', requirePermission('reports'), adminController.testDriveConnection);
router.post('/drive-backup/sync-current-month', requirePermission('reports'), adminController.syncCurrentMonthDriveBackup);
router.post('/drive-backup/retry-failed', requirePermission('reports'), adminController.retryFailedDriveBackups);
router.post('/drive-backup/export-historical', requirePermission('reports'), adminController.exportHistoricalDriveBackup);

// Inventory routes
router.get('/inventory', requirePermission('inventory'), adminController.getInventory);
router.get('/inventory/transactions', requirePermission('inventory'), adminController.getInventoryTransactions);
router.put('/inventory/:productId', requirePermission('inventory'), adminController.updateInventoryStock);

// Admin Account Management routes (Super Admin or admin_management permission)
router.get('/users', requirePermission('admin_management'), adminController.getAdminUsers);
router.get('/users/check-mobile/:mobile', requirePermission('admin_management'), adminController.checkAdminMobile);
router.post('/users/promote', requirePermission('admin_management'), adminController.promoteCustomerToAdmin);
router.post('/users', requirePermission('admin_management'), adminController.createAdminUser);
router.put('/users/:id', requirePermission('admin_management'), adminController.updateAdminUser);
router.put('/users/:id/permissions', requireSuperAdmin, adminController.updateAdminPermissions);
router.put('/users/:id/status', requireSuperAdmin, adminController.updateAdminUserStatus);
router.delete('/users/:id', requireSuperAdmin, adminController.deleteAdminUser);
router.put('/users/:id/reset-password', requireSuperAdmin, adminController.resetAdminPassword);

// Staff Management routes (Standardized /staff endpoints)
router.get('/staff', requirePosStaffManagement, posStaffController.getPosStaff);
router.post('/staff', requirePosStaffManagement, posStaffController.createPosStaff);
router.put('/staff/:id', requirePosStaffManagement, posStaffController.updatePosStaff);
router.patch('/staff/:id/status', requirePosStaffManagement, posStaffController.togglePosStaffStatus);
router.put('/staff/:id/status', requirePosStaffManagement, posStaffController.togglePosStaffStatus);
router.delete('/staff/:id', requirePosStaffManagement, posStaffController.deletePosStaff);
router.put('/staff/:id/reset-auth', requirePosStaffManagement, posStaffController.resetPosStaffAuth);
router.get('/staff/:id/sales', requirePosStaffManagement, posStaffController.getStaffSales);
router.get('/staff/reports', requirePosStaffManagement, posStaffController.getStaffReports);

// POS Staff Management backward-compatible aliases
router.get('/pos-staff', requirePosStaffManagement, posStaffController.getPosStaff);
router.post('/pos-staff', requirePosStaffManagement, posStaffController.createPosStaff);
router.put('/pos-staff/:id', requirePosStaffManagement, posStaffController.updatePosStaff);
router.put('/pos-staff/:id/status', requirePosStaffManagement, posStaffController.togglePosStaffStatus);
router.delete('/pos-staff/:id', requirePosStaffManagement, posStaffController.deletePosStaff);
router.put('/pos-staff/:id/reset-auth', requirePosStaffManagement, posStaffController.resetPosStaffAuth);
router.get('/pos-staff/:id/sales', requirePosStaffManagement, posStaffController.getStaffSales);
router.get('/pos-staff/reports', requirePosStaffManagement, posStaffController.getStaffReports);

module.exports = router;
