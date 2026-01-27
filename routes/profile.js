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

module.exports = router;
