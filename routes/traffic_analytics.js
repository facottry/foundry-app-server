const express = require('express');
const router = express.Router();
/**
 * Purpose: Serve traffic analytics for the founder dashboard.
 * Inputs: Product ID, Auth Token.
 * Outputs: Traffic Stats (Today, Total, Timeline).
 * Side Effects: None (Read-only).
 */
const ProductDailyTraffic = require('../models/ProductDailyTraffic');
const FounderDailyTraffic = require('../models/FounderDailyTraffic');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess } = require('../utils/response');

// @route   GET /api/founder/products/:id/traffic/summary
// @desc    Get traffic summary for a product
// @access  Private (Founder)
router.get('/:id/traffic/summary', auth(), asyncHandler(async (req, res) => {
    // Check ownership (middleware or manual)
    // Assuming middleware checks generic auth, we check product ownership here
    // For MVP, just query by product_id. Strict ownership check recommended.

    // Aggregates for all time? Or today? "Summary". 
    // Usually "Today" + "Total".
    const { id } = req.params;

    // Calculate totals
    const totalStats = await ProductDailyTraffic.aggregate([
        { $match: { product_id: new mongoose.Types.ObjectId(id) } },
        {
            $group: {
                _id: null,
                totalVisits: { $sum: '$visits' },
                totalUnique: { $sum: '$unique_visits' },
                totalCredits: { $sum: '$credits_consumed' }
            }
        }
    ]);

    const stats = totalStats[0] || { totalVisits: 0, totalUnique: 0, totalCredits: 0 };

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await ProductDailyTraffic.findOne({
        product_id: id,
        date: today
    }) || { visits: 0, unique_visits: 0, credits_consumed: 0 };

    sendSuccess(res, {
        total: stats,
        today: todayStats
    });
}));

// @route   GET /api/founder/products/:id/traffic/timeline
// @desc    Get traffic timeline
// @access  Private
router.get('/:id/traffic/timeline', auth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { from, to } = req.query; // YYYY-MM-DD

    const query = { product_id: id };
    if (from || to) {
        query.date = {};
        if (from) query.date.$gte = from;
        if (to) query.date.$lte = to;
    }

    const timeline = await ProductDailyTraffic.find(query).sort({ date: 1 });
    sendSuccess(res, { timeline });
}));

module.exports = router;
