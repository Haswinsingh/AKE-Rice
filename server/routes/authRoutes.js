const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Admin OTP endpoints (exclusively for Admin Dashboard)
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/admin/send-otp', authController.sendOtp);
router.post('/admin/verify-otp', authController.verifyOtp);

// Google OAuth
router.post('/google', authController.googleAuth);

// Fallback password login (supports admin & customer credentials)
router.post('/login', authController.passwordLogin);
router.post('/admin-login', authController.passwordLogin);

// Current user profile
router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, authController.updateProfile);

// Logout
router.post('/logout', authController.logout);

module.exports = router;
