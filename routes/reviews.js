const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const ProductEvent = require('../models/ProductEvent');
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   POST /api/reviews
// @desc    Submit a product review
router.post('/', asyncHandler(async (req, res) => {
    const { productId, rating, text, sessionId } = req.body;

    if (!productId || !rating || !text) {
        return sendError(res, 'Missing required fields', 400);
    }

    // 1. Save Review
    const review = new Review({
        product_id: productId,
        rating,
        text,
        session_id: sessionId
    });
    await review.save();

    // 2. Dual Write: Create 'REVIEW' ProductEvent (for analytics)
    // We recreate the event context if possible, or just basic tracking
    // For simplicity, we can just fire the event via internal logic or client side.
    // Client side firing is more reliable for Geo/UA, but let's do server-side to ensure 1:1 match.
    // We will miss Geo/UA unless we parse request here too.

    // Re-use logic or duplicate lightly? Let's duplicate lightly for now to avoid circular deps.
    const geoip = require('geoip-lite');
    const UAParser = require('ua-parser-js');
    const crypto = require('crypto');

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const ua = UAParser(req.headers['user-agent']);
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'salt')).digest('hex');

    const reviewEvent = new ProductEvent({
        product_id: productId,
        event_type: 'REVIEW',
        session_id: sessionId,
        ip_hash: ipHash,
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        browser: ua.browser.name || 'Unknown',
        os: ua.os.name || 'Unknown',
        device_type: ua.device.type || 'desktop'
    });
    await reviewEvent.save();

    // 3. Also trigger RATE event?
    // User requirement: "Rates product" is an event. "Reviews product" is an event.
    // A review includes a rating. Should we fire both?
    // The requirement lists them separately. "Rates product" might assume just star rating.
    // If review includes rating, let's fire RATE event too.
    const rateEvent = new ProductEvent({
        product_id: productId,
        event_type: 'RATE',
        session_id: sessionId,
        ip_hash: ipHash,
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        browser: ua.browser.name || 'Unknown',
        os: ua.os.name || 'Unknown',
        device_type: ua.device.type || 'desktop'
    });
    await rateEvent.save();

    // Update Product average rating
    // This is "server enrichment" or side effect.
    // We can do this async or here.
    const stats = await Review.aggregate([
        { $match: { product_id: mongoose.Types.ObjectId(productId) } },
        {
            $group: {
                _id: '$product_id',
                avgRating: { $avg: '$rating' },
                count: { $sum: 1 }
            }
        }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            avg_rating: stats[0].avgRating,
            ratings_count: stats[0].count
        });
    }

    sendSuccess(res, { review, message: 'Review submitted' });
}));

const mongoose = require('mongoose'); // Needed for ObjectId casting above

module.exports = router;
