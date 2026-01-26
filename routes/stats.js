const express = require('express');
const router = express.Router();
const ProductStats = require('../models/ProductStats');
const { asyncHandler, sendSuccess } = require('../utils/response');

// @route   POST /api/stats/view/:productId
// @desc    Track product view
router.post('/view/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;

    await ProductStats.findOneAndUpdate(
        { product_id: productId },
        {
            $inc: { views_total: 1, views_24h: 1 },
            $set: { last_viewed_at: new Date() }
        },
        { upsert: true, new: true }
    );

    sendSuccess(res, { message: 'View tracked' });
}));

module.exports = router;
