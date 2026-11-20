const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');

// Public reviews with distribution stats
router.get('/public', feedbackController.getPublicFeedback);

// Customer's own feedback history
router.get('/my', verifyToken, feedbackController.getMyFeedback);

// Submit new feedback (authenticated or guest)
router.post('/', optionalAuth, feedbackController.createFeedback);

// Admin: view all reviews
router.get('/admin', verifyToken, requireAdmin, feedbackController.getAdminFeedback);

// Admin: moderate review (approve, reject, hide, toggle reviewed, response)
router.put('/:id', verifyToken, requireAdmin, feedbackController.moderateFeedback);
router.put('/:id/moderation', verifyToken, requireAdmin, feedbackController.moderateFeedback);

// Admin: delete review
router.delete('/:id', verifyToken, requireAdmin, feedbackController.deleteFeedback);

module.exports = router;
