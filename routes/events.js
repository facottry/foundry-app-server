const express = require('express');
const router = express.Router();
const ProductEvent = require('../models/ProductEvent');
const ProductStats = require('../models/ProductStats');
const ProductDailyTraffic = require('../models/ProductDailyTraffic');
const FounderDailyTraffic = require('../models/FounderDailyTraffic');
const Product = require('../models/Product');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   POST /api/events/track
// @desc    Track product interaction (View, Click, etc.)
router.post('/track', asyncHandler(async (req, res) => {
    const { productId, eventType, sessionId } = req.body;

    // Attempt to get user_id from token if present (optional auth)
    let userId = null;
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.user.id;
        } catch (err) {
            // Ignore invalid token for tracking
        }
    }

    if (!productId || !eventType) {
        return sendError(res, 'ProductId and EventType are required', 400);
    }

    // Server-side enrichment
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const ua = UAParser(req.headers['user-agent']);

    // Anonymize IP (simple hash for uniqueness without PII)
    const crypto = require('crypto');
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'salt')).digest('hex');

    // DEDUPLICATION: Check for recent event (same session/user + product + type) within 60 seconds
    const DUPE_WINDOW_MS = 60 * 1000;
    const oneMinuteAgo = new Date(Date.now() - DUPE_WINDOW_MS);

    const query = {
        product_id: productId,
        event_type: eventType,
        created_at: { $gt: oneMinuteAgo }
    };

    if (userId) query.user_id = userId;
    else if (sessionId) query.session_id = sessionId;
    else query.ip_hash = ipHash; // Fallback to IP hash if no session

    const existingEvent = await ProductEvent.findOne(query);

    if (existingEvent) {
        // Return success but don't re-log or re-count
        return sendSuccess(res, { tracked: true, deduplicated: true });
    }

    const event = new ProductEvent({
        product_id: productId,
        user_id: userId,
        event_type: eventType,
        session_id: sessionId,
        ip_hash: ipHash,
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        browser: ua.browser.name || 'Unknown',
        os: ua.os.name || 'Unknown',
        device_type: ua.device.type || 'desktop'
    });

    await event.save();

    // AGGREGATION LOGIC (Views)
    if (eventType === 'VIEW') {
        const today = new Date().toISOString().split('T')[0];

        // 1. Update Product Stats (Global)
        await ProductStats.findOneAndUpdate(
            { product_id: productId },
            {
                $inc: { views_total: 1, views_24h: 1 },
                $set: { last_viewed_at: new Date() }
            },
            { upsert: true }
        );

        // 2. Update Product Daily Traffic
        await ProductDailyTraffic.findOneAndUpdate(
            { product_id: productId, date: today },
            { $inc: { views: 1 } }, // Note: unique_visits might need session logic, sticking to raw views for now to match dashboard
            { upsert: true }
        );

        // 3. Update Founder Daily Traffic
        // Need to find owner first
        const product = await Product.findById(productId);
        if (product && product.owner_user_id) {
            await FounderDailyTraffic.findOneAndUpdate(
                { founder_id: product.owner_user_id, date: today },
                { $inc: { views: 1 } },
                { upsert: true }
            );
        }
    }

    // AI SEGMENTATION TRACKING
    if (userId) {
        const User = require('../models/User');
        const UserEvent = require('../models/UserEvent');

        // Map ProductEvent types to UserEvent types
        // VIEW -> VIEW_PRODUCT, CLICK -> CLICK_WEBSITE
        let userEventType = null;
        if (eventType === 'VIEW') userEventType = 'VIEW_PRODUCT';
        if (eventType === 'CLICK') userEventType = 'CLICK_WEBSITE';

        if (userEventType) {
            // Log Event
            await UserEvent.create({
                userId,
                type: userEventType,
                target: productId,
                metadata: { ipHash, country: geo?.country }
            });

            // Mark Dirty
            await User.findByIdAndUpdate(userId, { segment_dirty: true });
        }
    }

    sendSuccess(res, { tracked: true });
}));

module.exports = router;
