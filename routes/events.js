const express = require('express');
const router = express.Router();
const ProductEvent = require('../models/ProductEvent');
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
        device_type: ua.device.type || 'desktop' // ua-parser returns undefined for desktop usually
    });

    await event.save();

    sendSuccess(res, { tracked: true });
}));

module.exports = router;
