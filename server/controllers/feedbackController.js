const { v4: uuidv4 } = require('crypto');
const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const User = require('../models/User');

/**
 * Submit feedback (Customer or public)
 */
exports.createFeedback = async (req, res) => {
  try {
    let { name, mobile, rating, review, photo, product, orderId } = req.body;

    if (!rating || !review || (!name && !req.user)) {
      return res.status(400).json({ success: false, message: 'Name, star rating, and review text are required.' });
    }

    rating = parseInt(rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars.' });
    }

    let customerId = undefined;
    let customerUser = req.user;

    if (customerUser) {
      customerId = customerUser.id || `cust_${customerUser.mobile}`;
      if (!name) name = customerUser.name;
      if (!mobile) mobile = customerUser.mobile;
    } else if (mobile) {
      mobile = mobile.toString().trim().replace(/\D/g, '');
      if (mobile.length > 10) mobile = mobile.slice(-10);
      customerId = `cust_${mobile}`;

      // Ensure customer record exists in DB
      let existingCust = await User.findOne({ mobile });
      if (!existingCust && mobile.length >= 10) {
        existingCust = new User({
          id: customerId,
          name: name ? name.trim() : `Customer ${mobile.slice(-4)}`,
          mobile,
          role: 'customer',
          authProvider: 'otp'
        });
        await existingCust.save();
        customerUser = existingCust;
      }
    }

    // Check if verified purchase
    let isVerifiedPurchase = false;
    if (mobile || orderId) {
      const orderMatch = await Order.findOne({
        $or: [
          ...(orderId ? [{ id: orderId }] : []),
          ...(mobile ? [{ mobile, status: 'Delivered' }] : [])
        ]
      });
      if (orderMatch) {
        isVerifiedPurchase = true;
        if (!orderId) orderId = orderMatch.id;
      }
    }

    const now = new Date();
    const dateStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

    const newFeedback = new Feedback({
      id: require('crypto').randomUUID ? require('crypto').randomUUID() : `fb_${Date.now()}`,
      customer: customerUser ? customerUser._id : undefined,
      customerId,
      name: name.trim(),
      mobile,
      rating,
      review: review.trim(),
      photo: photo || undefined,
      product: product || 'Koppampatty Seeraga Samba Rice',
      orderId,
      isVerifiedPurchase,
      status: 'Pending', // Newly submitted feedback starts as Pending until Admin approval
      reviewed: false,
      date: dateStr
    });

    await newFeedback.save();

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback!',
      feedback: newFeedback
    });
  } catch (error) {
    console.error('[FeedbackController] createFeedback error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit feedback.', error: error.message });
  }
};

/**
 * Get Public Customer Reviews with Rating Distribution
 */
exports.getPublicFeedback = async (req, res) => {
  try {
    const reviews = await Feedback.find({ status: 'Approved' }).sort({ createdAt: -1 });

    const totalCount = reviews.length;
    let averageRating = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (totalCount > 0) {
      const sum = reviews.reduce((acc, r) => {
        const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        distribution[star] = (distribution[star] || 0) + 1;
        return acc + (r.rating || 5);
      }, 0);
      averageRating = parseFloat((sum / totalCount).toFixed(1));
    }

    return res.status(200).json({
      success: true,
      totalCount,
      averageRating,
      distribution,
      reviews
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
  }
};

/**
 * Get My Feedback (Authenticated Customer)
 */
exports.getMyFeedback = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const query = {
      $or: [
        { customer: req.user._id },
        ...(req.user.mobile ? [{ mobile: req.user.mobile }] : []),
        ...(req.user.id ? [{ customerId: req.user.id }] : [])
      ]
    };

    const myReviews = await Feedback.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: myReviews.length,
      reviews: myReviews
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve feedback', error: error.message });
  }
};

/**
 * Admin: Get All Feedback
 */
exports.getAdminFeedback = async (req, res) => {
  try {
    const { status, rating, search } = req.query;
    let query = {};

    if (status && status !== 'all') query.status = status;
    if (rating && rating !== 'all') query.rating = parseInt(rating, 10);
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { mobile: new RegExp(search, 'i') },
        { review: new RegExp(search, 'i') }
      ];
    }

    const allFeedback = await Feedback.find(query).sort({ createdAt: -1 });
    const totalCount = await Feedback.countDocuments();
    const approvedCount = await Feedback.countDocuments({ status: 'Approved' });
    const pendingCount = await Feedback.countDocuments({ status: 'Pending' });
    const rejectedCount = await Feedback.countDocuments({ status: 'Rejected' });

    return res.status(200).json({
      success: true,
      totalCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      reviews: allFeedback
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin feedback', error: error.message });
  }
};

/**
 * Admin: Moderate feedback (approve, reject, hide, toggle reviewed, respond)
 */
exports.moderateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, status, adminResponse, isVerifiedPurchase } = req.body;

    const feedback = await Feedback.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    if (action === 'delete') {
      await Feedback.findByIdAndDelete(feedback._id);
      return res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
    } else if (action === 'approve') {
      feedback.status = 'Approved';
      feedback.reviewed = true;
    } else if (action === 'reject') {
      feedback.status = 'Rejected';
      feedback.reviewed = true;
    } else if (action === 'hide') {
      feedback.status = 'Hidden';
    } else if (action === 'toggle-reviewed') {
      feedback.reviewed = !feedback.reviewed;
    }

    if (status) feedback.status = status;
    if (adminResponse !== undefined) feedback.adminResponse = adminResponse;
    if (isVerifiedPurchase !== undefined) feedback.isVerifiedPurchase = isVerifiedPurchase;

    await feedback.save();

    return res.status(200).json({
      success: true,
      message: 'Feedback updated successfully',
      feedback
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update feedback', error: error.message });
  }
};

/**
 * Admin: Delete feedback
 */
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findOneAndDelete({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    return res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete feedback', error: error.message });
  }
};
