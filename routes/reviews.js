const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const ProductEvent = require('../models/ProductEvent');
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper: AI Tagging (Mock for now, or real if OpenAI available)
const tagReview = async (review) => {
    try {
        // Placeholder for AI Logic. 
        // In real production, this would call OpenAI/Gemini
        const { openai } = require('../utils/openai');
        // We won't block response, but update async.

        // Mock logic for demo speed:
        const tags = [];
        const lower = review.text.toLowerCase();
        if (lower.includes('easy') || lower.includes('simple')) tags.push('easy-to-use');
        if (lower.includes('fast') || lower.includes('speed')) tags.push('performance');
        if (lower.includes('bug')) tags.push('buggy');
        if (lower.includes('support')) tags.push('support');

        let sentiment = 'neutral';
        if (review.rating >= 4) sentiment = 'positive';
        if (review.rating <= 2) sentiment = 'negative';

        review.ai_tags = tags;
        review.sentiment = sentiment;
        await review.save();
    } catch (err) {
        console.error('AI Tagging Error:', err);
    }
};

// @route   POST /api/reviews
// @desc    Submit a product review
// @access  Customer only
router.post('/', auth(['CUSTOMER']), asyncHandler(async (req, res, next) => {
    const { productId, rating, title, text, sessionId } = req.body;

    if (!productId || !rating || !text) {
        return sendError(next, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    }

    // Check if founder trying to review own product
    if (product.owner_user_id.toString() === req.user.id) {
        return sendError(next, 'FORBIDDEN', 'Founders cannot review their own products', 403);
    }

    // Check availability (One review per product per user)
    const existing = await Review.findOne({ product_id: productId, user_id: req.user.id });
    if (existing) {
        return sendError(next, 'CONFLICT', 'You have already reviewed this product', 409);
    }

    // Save Review
    const review = new Review({
        product_id: productId,
        user_id: req.user.id,
        rating,
        title,
        text,
        session_id: sessionId
    });
    await review.save();

    // Async tasks
    tagReview(review); // AI Tagging

    // Events
    const ipHash = require('crypto').createHash('sha256').update(req.ip || 'unknown').digest('hex');
    await ProductEvent.create({
        product_id: productId,
        user_id: req.user.id,
        event_type: 'REVIEW',
        session_id: sessionId,
        ip_hash: ipHash
    });

    // Also RATE event if needed, but REVIEW covers it usually.

    // Aggregation Update
    const stats = await Review.aggregate([
        { $match: { product_id: mongoose.Types.ObjectId(productId), status: 'published' } },
        { $group: { _id: '$product_id', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            avg_rating: Math.round(stats[0].avgRating * 10) / 10,
            ratings_count: stats[0].count
        });
    }

    sendSuccess(res, { review, message: 'Review submitted' });
}));

// @route   GET /api/products/:id/reviews
// @desc    Get public reviews for a product
router.get('/products/:id', asyncHandler(async (req, res, next) => {
    const { sort } = req.query; // newest, highest, lowest

    let sortOption = { created_at: -1 };
    if (sort === 'highest') sortOption = { rating: -1 };
    if (sort === 'lowest') sortOption = { rating: 1 };

    const reviews = await Review.find({
        product_id: req.params.id,
        status: 'published'
    })
        .populate('user_id', 'name role')
        .sort(sortOption)
        .limit(50); // Pagination later

    sendSuccess(res, reviews);
}));

// @route   GET /api/founder/products/:id/reviews
// @desc    Founder view of reviews (includes hidden/flagged + stats)
router.get('/founder/products/:id', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findOne({ _id: req.params.id, owner_user_id: req.user.id });
    if (!product) return sendError(next, 'FORBIDDEN', 'Access denied', 403);

    const reviews = await Review.find({ product_id: req.params.id })
        .populate('user_id', 'name email')
        .sort({ created_at: -1 });

    // Calculate distributions
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => distribution[r.rating] = (distribution[r.rating] || 0) + 1);

    // Tags cloud
    const tags = {};
    reviews.forEach(r => {
        r.ai_tags.forEach(tag => tags[tag] = (tags[tag] || 0) + 1);
    });

    sendSuccess(res, {
        reviews,
        stats: {
            total: reviews.length,
            avg: product.avg_rating,
            distribution,
            top_tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ tag: k, count: v }))
        }
    });
}));

// @route   PATCH /api/admin/reviews/:id/hide
// @desc    Moderate review
router.patch('/admin/:id/hide', auth(['ADMIN']), asyncHandler(async (req, res, next) => {
    // Implementation for admin moderation
    const review = await Review.findById(req.params.id);
    if (!review) return sendError(next, 'NOT_FOUND', 'Review not found', 404);

    review.status = review.status === 'hidden' ? 'published' : 'hidden'; // Toggle
    await review.save();

    sendSuccess(res, review);
}));

module.exports = router;
