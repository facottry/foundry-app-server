const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product'); // For stats
const OutboundClick = require('../models/OutboundClick'); // For stats
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

// @route   GET /api/profile/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth(), asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('-password_hash -otp_hash -otp_expires');

    if (!user) {
        return sendError(next, 'NOT_FOUND', 'User not found', 404);
    }

    let stats = {};
    if (user.role === 'FOUNDER') {
        const productCount = await Product.countDocuments({ founder_id: user.id });
        // Aggregate total clicks for all products owned by founder is expensive, 
        // but for MVP we can do a simpler count or just return product count.
        // Let's iterate user's products to get click counts if needed, 
        // or just return credit balance which is already on user.

        // Simple aggregate for total clicks
        // Find all products by this founder
        const products = await Product.find({ founder_id: user.id }).select('_id');
        const productIds = products.map(p => p._id);
        const totalClicks = await OutboundClick.countDocuments({ product_id: { $in: productIds } });

        stats = {
            products: productCount,
            total_clicks: totalClicks,
            credits: user.credits_balance
        };
    }

    sendSuccess(res, { user, stats });
}));

// @route   PUT /api/profile/me
// @desc    Update current user profile
// @access  Private
router.put('/me', auth(), asyncHandler(async (req, res, next) => {
    const {
        avatar_url,
        bio,
        company_name,
        role_title,
        location,
        website,
        twitter,
        linkedin,
        timezone,
        onboarding_completed,
        name // Allow updating name too
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
        return sendError(next, 'NOT_FOUND', 'User not found', 404);
    }

    // Update fields if provided
    if (name) user.name = name;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;
    if (bio !== undefined) user.bio = bio;
    if (company_name !== undefined) user.company_name = company_name;
    if (role_title !== undefined) user.role_title = role_title;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (twitter !== undefined) user.twitter = twitter;
    if (linkedin !== undefined) user.linkedin = linkedin;
    if (timezone !== undefined) user.timezone = timezone;
    if (onboarding_completed !== undefined) user.onboarding_completed = onboarding_completed;

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = user.toObject();
    delete updatedUser.password_hash;
    delete updatedUser.otp_hash;
    delete updatedUser.otp_expires;

    sendSuccess(res, { user: updatedUser });
}));

// @route   GET /api/profile/activity-summary
// @desc    Get recent activity for customer
// @access  Private
router.get('/activity-summary', auth(), asyncHandler(async (req, res) => {
    const ProductEvent = require('../models/ProductEvent');
    const Review = require('../models/Review');
    const Product = require('../models/Product');

    // Fetch recent Views
    const recentViewsEvents = await ProductEvent.find({
        user_id: req.user.id,
        event_type: 'VIEW'
    })
        .sort({ created_at: -1 })
        .limit(5)
        .populate('product_id', 'name logo_url tagline');

    // Deduplicate views by product_id
    const seenProducts = new Set();
    const recentViews = [];
    for (const event of recentViewsEvents) {
        if (event.product_id && !seenProducts.has(event.product_id._id.toString())) {
            seenProducts.add(event.product_id._id.toString());
            recentViews.push({
                product: event.product_id,
                viewed_at: event.created_at
            });
        }
    }

    // Fetch recent Reviews
    const recentReviews = await Review.find({ user_id: req.user.id })
        .sort({ created_at: -1 })
        .limit(5)
        .populate('product_id', 'name logo_url');

    sendSuccess(res, {
        recent_views: recentViews,
        items_reviewed: recentReviews
    });
}));

// @route   GET /api/profile/founder-summary
// @desc    Get summary stats for founder
// @access  Private (Founder)
router.get('/founder-summary', auth(['FOUNDER']), asyncHandler(async (req, res) => {
    const Product = require('../models/Product');
    const OutboundClick = require('../models/OutboundClick');

    // Products
    const products = await Product.find({ owner_user_id: req.user.id });
    const productIds = products.map(p => p._id);

    // Stats
    const totalViews = 0; // Need aggregation from ProductStats or ProductEvent
    const totalClicks = await OutboundClick.countDocuments({ product_id: { $in: productIds } });

    // Calculate average rating across all products
    const validRatings = products.filter(p => p.ratings_count > 0);
    const avgRating = validRatings.length > 0
        ? validRatings.reduce((acc, p) => acc + p.avg_rating, 0) / validRatings.length
        : 0;

    sendSuccess(res, {
        products_count: products.length,
        total_views: totalViews, // Placeholder until aggregation is ready
        total_clicks: totalClicks,
        avg_rating: avgRating,
        credits: 0 // User balance handled in profile/me
    });
}));

router.put('/me/preferences', auth(), asyncHandler(async (req, res) => {
    const { email_notifications, product_updates, weekly_digest } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    if (user.preferences) {
        if (email_notifications !== undefined) user.preferences.email_notifications = email_notifications;
        if (product_updates !== undefined) user.preferences.product_updates = product_updates;
        if (weekly_digest !== undefined) user.preferences.weekly_digest = weekly_digest;
    } else {
        user.preferences = {
            email_notifications: email_notifications ?? true,
            product_updates: product_updates ?? true,
            weekly_digest: weekly_digest ?? true
        };
    }

    await user.save();
    sendSuccess(res, { preferences: user.preferences });
}));

module.exports = router;
