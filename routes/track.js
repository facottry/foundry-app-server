const express = require('express');
const router = express.Router();
const ProductView = require('../models/ProductView');
const ProductStats = require('../models/ProductStats');
const { extractMetadata } = require('../utils/geoDevice');
const { asyncHandler, sendSuccess } = require('../utils/response');

// @route   POST /api/track/view
// @desc    Track product view with session and metadata
router.post('/view', asyncHandler(async (req, res) => {
    const { productId, sessionId } = req.body;

    if (!productId || !sessionId) {
        return sendSuccess(res, { tracked: false });
    }

    // Extract geo and device metadata
    const metadata = extractMetadata(req);

    // Create view record
    await ProductView.create({
        product_id: productId,
        session_id: sessionId,
        ...metadata
    });

    // Update ProductStats
    await ProductStats.findOneAndUpdate(
        { product_id: productId },
        {
            $inc: { views_total: 1, views_24h: 1 },
            $set: { last_viewed_at: new Date(), updated_at: new Date() }
        },
        { upsert: true }
    );

    sendSuccess(res, { tracked: true });
}));

module.exports = router;
