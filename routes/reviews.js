const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const ProductEvent = require('../models/ProductEvent');
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper: AI Tagging (Heuristic Rule-Based)
const tagReview = async (review) => {
    try {
        const text = (review.text + ' ' + (review.title || '')).toLowerCase();
        const tags = [];

        // Tagging Rules
        if (text.match(/easy|simple|intuitive|user-friendly/)) tags.push('easy-to-use');
        if (text.match(/fast|speed|performance|quick/)) tags.push('performance');
        if (text.match(/bug|crash|error|broken|fail/)) tags.push('buggy');
        if (text.match(/support|help|service|team/)) tags.push('support');
        if (text.match(/price|cost|expensive|cheap|value/)) tags.push('pricing');
        if (text.match(/feature|missing|request|need/)) tags.push('features');

        // Sentiment Analysis (Keyword Score + Rating Weight)
        let score = 0;
        const positiveWords = ['love', 'great', 'awesome', 'excellent', 'good', 'best', 'amazing', 'perfect', 'helpful', 'smooth'];
        const negativeWords = ['hate', 'bad', 'terrible', 'worst', 'worse', 'slow', 'buggy', 'crash', 'awful', 'poor', 'useless'];

        positiveWords.forEach(w => { if (text.includes(w)) score += 1; });
        negativeWords.forEach(w => { if (text.includes(w)) score -= 1; });

        // Rating Weight: 5 star pulls positive, 1 star pulls negative
        if (review.rating === 5) score += 2;
        if (review.rating === 4) score += 1;
        if (review.rating === 2) score -= 1;
        if (review.rating === 1) score -= 2;

        let sentiment = 'neutral';
        if (score >= 2) sentiment = 'positive';
        if (score <= -2) sentiment = 'negative';

        review.ai_tags = tags;
        review.sentiment = sentiment;
        await review.save();
    } catch (err) {
        console.error('AI Tagging Error:', err);
    }
};

// @route   POST /api/reviews
// @desc    Upsert a product review (v1 Sync Flow)
// @access  Customer OR Founder (except own product)
router.post('/', auth(['CUSTOMER', 'FOUNDER']), asyncHandler(async (req, res, next) => {
    const { productId, rating, title, text, sessionId } = req.body;
    const { analyzeSentiment } = require('../utils/sentimentEngine');
    const { calculateProductStats } = require('../utils/ratingAlgorithm');
    const ProductReviewStats = require('../models/ProductReviewStats');

    if (!productId || !rating || !text) {
        return sendError(next, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    // 1. Check Product Exists
    const product = await Product.findById(productId);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    // NOTE: Founders can now review their own products (per user request)

    // 2. Prepare Review Data (Upsert Logic)
    let review = await Review.findOne({ product_id: productId, user_id: req.user.id });

    // Run Sentiment Sync
    const { sentiment, sentimentScore } = analyzeSentiment(text, rating);
    const aiTags = []; // Re-implement simple tagging if needed or use simple heuristic inside sentiment
    // (Optional: Basic heuristic tags can be added here if needed, keeping it simple for now as per PRD "Sentiment only")

    if (review) {
        // Update existing
        review.rating = rating;
        review.title = title;
        review.text = text;
        review.sentiment = sentiment;
        review.sentiment_score = sentimentScore;
        review.updated_at = Date.now();
    } else {
        // Create new
        review = new Review({
            product_id: productId,
            user_id: req.user.id,
            rating,
            title,
            text,
            sentiment,
            sentiment_score: sentimentScore,
            session_id: sessionId,
            ai_tags: []
        });
    }

    await review.save();

    // Run AI Tagging (async, non-blocking)
    tagReview(review);

    // 3. Trigger Aggregation (Critical Sync Step)
    const allReviews = await Review.find({ product_id: productId, status: 'published' });
    const statsResult = calculateProductStats(allReviews);

    // 4. Update Read Models
    // A. ProductReviewStats
    await ProductReviewStats.findOneAndUpdate(
        { product_id: productId },
        {
            weighted_rating: statsResult.weightedRating,
            rating_count: statsResult.ratingCount,
            review_count: statsResult.reviewCount,
            sentiment_summary: statsResult.sentimentSummary,
            weekly_satisfaction: statsResult.weeklySatisfaction,
            updated_at: Date.now()
        },
        { upsert: true, new: true }
    );

    // B. Legacy Product Aggregation (for backward compat)
    product.avg_rating = statsResult.weightedRating; // Use weighted!
    product.ratings_count = statsResult.ratingCount;
    await product.save();

    // 5. Events
    const ipHash = require('crypto').createHash('sha256').update(req.ip || 'unknown').digest('hex');
    // Only log event if new? or update? PRD says "Event-driven". 
    // We log it.
    await ProductEvent.create({
        product_id: productId,
        user_id: req.user.id,
        event_type: review.isNew ? 'REVIEW' : 'REVIEW_UPDATE',
        session_id: sessionId,
        ip_hash: ipHash
    });

    sendSuccess(res, { review, stats: statsResult, message: 'Review saved successfully' });
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

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    reviews.forEach(r => {
        if (r.sentiment) {
            sentimentCounts[r.sentiment] = (sentimentCounts[r.sentiment] || 0) + 1;
        } else {
            // Fallback if no sentiment yet
            if (r.rating >= 4) sentimentCounts.positive++;
            else if (r.rating <= 2) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
        }
    });

    sendSuccess(res, { data: reviews, sentimentCounts });
}));

// @route   GET /api/products/:slug/review-summary
// @desc    Get aggregated stats for product
router.get('/products/:slug/review-summary', asyncHandler(async (req, res, next) => {
    // Resolve slug to ID
    let product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
        if (req.params.slug.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product.findById(req.params.slug);
        }
    }
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    const ProductReviewStats = require('../models/ProductReviewStats');
    const stats = await ProductReviewStats.findOne({ product_id: product._id });

    if (!stats) {
        // Return empty structure
        return sendSuccess(res, {
            weightedRating: 0,
            counts: { rating: 0, review: 0 },
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            weeklySatisfaction: []
        });
    }

    sendSuccess(res, {
        weightedRating: stats.weighted_rating,
        counts: { rating: stats.rating_count, review: stats.review_count },
        sentiment: stats.sentiment_summary,
        weeklySatisfaction: stats.weekly_satisfaction
    });
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

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Owner only
router.put('/:id', auth(['CUSTOMER', 'FOUNDER']), asyncHandler(async (req, res, next) => {
    const { rating, title, text } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
        return sendError(next, 'NOT_FOUND', 'Review not found', 404);
    }

    // Check ownership
    if (review.user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'Not authorized', 403);
    }

    // Update fields
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (text) review.text = text;
    review.status = 'published'; // Reset status if it was hidden (optional policy)

    await review.save();

    // Re-run AI Tagging
    tagReview(review);

    // Re-calculate Product Stats
    const productId = review.product_id;
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

    sendSuccess(res, { review, message: 'Review updated' });
}));

module.exports = router;
