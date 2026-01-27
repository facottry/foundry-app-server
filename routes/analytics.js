const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductEvent = require('../models/ProductEvent');
const OutboundClick = require('../models/OutboundClick');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// Middleware to verify ownership
const verifyOwnership = async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendError(res, 'BAD_REQUEST', 'Invalid product ID', 400);
    }

    // Allow admin bypass if needed later, currently strictly founder
    const product = await Product.findOne({ _id: id, owner_user_id: req.user.id });
    if (!product) {
        return sendError(res, 'FORBIDDEN', 'Product not found or unauthorized', 403);
    }

    req.product = product;
    next();
};

// @route   GET /api/analytics/product/:id/summary
// @desc    Get high-level stats (Views, Clicks, CTR, Credits)
router.get('/product/:id/summary', auth(['FOUNDER', 'ADMIN']), verifyOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { range = '30d' } = req.query; // 24h, 7d, 30d, all

    let dateQuery = {};
    if (range !== 'all') {
        const date = new Date();
        if (range === '24h') date.setHours(date.getHours() - 24);
        if (range === '7d') date.setDate(date.getDate() - 7);
        if (range === '30d') date.setDate(date.getDate() - 30);
        dateQuery = { created_at: { $gte: date } };
    }

    // 1. On-site Views
    const views = await ProductEvent.countDocuments({
        product_id: id,
        event_type: 'VIEW',
        ...dateQuery
    });

    // 2. Website Clicks (Intent)
    const websiteClicks = await ProductEvent.countDocuments({
        product_id: id,
        event_type: 'CLICK',
        ...dateQuery
    });

    // 3. Unique Visitors (Approximate via distinct session_id)
    const uniqueVisitors = (await ProductEvent.distinct('session_id', {
        product_id: id,
        event_type: 'VIEW',
        ...dateQuery
    })).length;

    // 4. Confirmed Outbound Clicks (Billing) - Uses OutboundClick model
    // Note: OutboundClick uses 'confirmed_at' instead of 'created_at' for filter
    let outboundDateQuery = {};
    if (range !== 'all') {
        const date = new Date();
        if (range === '24h') date.setHours(date.getHours() - 24);
        if (range === '7d') date.setDate(date.getDate() - 7);
        if (range === '30d') date.setDate(date.getDate() - 30);
        outboundDateQuery = { confirmed_at: { $gte: date } };
    }

    const confirmedClicks = await OutboundClick.countDocuments({
        product_id: id,
        confirmed: true,
        ...outboundDateQuery
    });

    // Calculate CTR (Website Clicks / Views)
    const ctr = views > 0 ? ((websiteClicks / views) * 100).toFixed(2) : 0;

    // Credits Consumed (Each confirmed click = 1 credit usually, but let's check legacy logic if needed. 
    // Assuming 1 click = 1 credit for now as per core law).
    const creditsConsumed = confirmedClicks;

    // Remaining Credits (User level)
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    sendSuccess(res, {
        views,
        uniqueVisitors,
        websiteClicks,
        uniqueClickers: 0, // TODO: Compute if needed, expensive
        ctr: parseFloat(ctr),
        confirmedClicks,
        creditsConsumed,
        remainingCredits: user.credits_balance
    });
}));

// @route   GET /api/analytics/product/:id/trends
// @desc    Time-series data for generic charts
router.get('/product/:id/trends', auth(['FOUNDER', 'ADMIN']), verifyOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { range = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    if (range === '24h') startDate.setHours(endDate.getHours() - 24);
    else if (range === '7d') startDate.setDate(endDate.getDate() - 7);
    else startDate.setDate(endDate.getDate() - 30); // Default 30d

    // Aggregation for Views & Clicks (ProductEvent)
    // Group by Day (or Hour for 24h)

    const groupBy = range === '24h'
        ? { year: { $year: "$created_at" }, month: { $month: "$created_at" }, day: { $dayOfMonth: "$created_at" }, hour: { $hour: "$created_at" } }
        : { year: { $year: "$created_at" }, month: { $month: "$created_at" }, day: { $dayOfMonth: "$created_at" } };

    const format = range === '24h' ? "%Y-%m-%d %H:00" : "%Y-%m-%d";

    const trends = await ProductEvent.aggregate([
        {
            $match: {
                product_id: new mongoose.Types.ObjectId(id),
                created_at: { $gte: startDate, $lte: endDate },
                event_type: { $in: ['VIEW', 'CLICK'] }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: format, date: "$created_at" } },
                    type: "$event_type"
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.date": 1 } }
    ]);

    // Post-process to structured format: { labels: [], views: [], clicks: [] }
    // Ideally user wants continuous time series, filling zeros.
    // For MVP, sending raw points, frontend can fill gaps or display as is.

    const dataMap = {};
    trends.forEach(t => {
        if (!dataMap[t._id.date]) dataMap[t._id.date] = { views: 0, clicks: 0 };
        if (t._id.type === 'VIEW') dataMap[t._id.date].views = t.count;
        if (t._id.type === 'CLICK') dataMap[t._id.date].clicks = t.count;
    });

    const sortedLabels = Object.keys(dataMap).sort();
    const result = {
        labels: sortedLabels,
        views: sortedLabels.map(l => dataMap[l].views),
        clicks: sortedLabels.map(l => dataMap[l].clicks)
    };

    sendSuccess(res, result);
}));

// @route   GET /api/analytics/product/:id/distribution
// @desc    Distribution charts (Geo, Device, OS)
router.get('/product/:id/distribution', auth(['FOUNDER', 'ADMIN']), verifyOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const getDist = async (field) => {
        return ProductEvent.aggregate([
            { $match: { product_id: new mongoose.Types.ObjectId(id), event_type: 'VIEW' } },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
    };

    const [country, city, device, browser, os] = await Promise.all([
        getDist('country'),
        getDist('city'),
        getDist('device_type'),
        getDist('browser'),
        getDist('os')
    ]);

    sendSuccess(res, { country, city, device, browser, os });
}));

// @route   GET /api/analytics/product/:id/activity
// @desc    Recent activity logs (Paginated)
router.get('/product/:id/activity', auth(['FOUNDER', 'ADMIN']), verifyOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const activity = await ProductEvent.find({ product_id: id })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('event_type country city device_type browser created_at');

    sendSuccess(res, activity);
}));



// @route   GET /api/analytics/product/:id/dashboard
// @desc    Aggregated dashboard data (Monetization-Grade)
router.get('/product/:id/dashboard', auth(['FOUNDER', 'ADMIN']), verifyOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { range = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    if (range === '24h') startDate.setHours(endDate.getHours() - 24);
    else if (range === '7d') startDate.setDate(endDate.getDate() - 7);
    else startDate.setDate(endDate.getDate() - 30);

    // 1. KPIs
    const views = await ProductEvent.countDocuments({ product_id: id, event_type: 'VIEW', created_at: { $gte: startDate } });
    const clicks = await ProductEvent.countDocuments({ product_id: id, event_type: 'CLICK', created_at: { $gte: startDate } });
    const confirmed = await OutboundClick.countDocuments({ product_id: id, confirmed: true, confirmed_at: { $gte: startDate } });
    const uniqueVisitors = (await ProductEvent.distinct('session_id', { product_id: id, event_type: 'VIEW', created_at: { $gte: startDate } })).length;

    // CTR calculation
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : 0;

    // Credits (Assuming 1 credit per confirmed click)
    const creditsConsumed = confirmed;

    // 2. Trends (Multi-line: Views, Clicks, Confirmed)
    // We need to aggregate all 3. For MVP efficiency, let's run 2 aggs (ProductEvents and OutboundClicks) and merge.
    const eventTrends = await ProductEvent.aggregate([
        {
            $match: {
                product_id: new mongoose.Types.ObjectId(id),
                created_at: { $gte: startDate, $lte: endDate },
                event_type: { $in: ['VIEW', 'CLICK'] }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    type: "$event_type"
                },
                count: { $sum: 1 }
            }
        }
    ]);

    const confirmedTrends = await OutboundClick.aggregate([
        {
            $match: {
                product_id: new mongoose.Types.ObjectId(id),
                confirmed: true,
                confirmed_at: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$confirmed_at" } },
                count: { $sum: 1 }
            }
        }
    ]);

    // Merge and format
    const trendMap = {};
    // Seed map with dates... (simplified for now: just use found dates)
    eventTrends.forEach(t => {
        if (!trendMap[t._id.date]) trendMap[t._id.date] = { views: 0, clicks: 0, confirmed: 0 };
        if (t._id.type === 'VIEW') trendMap[t._id.date].views = t.count;
        if (t._id.type === 'CLICK') trendMap[t._id.date].clicks = t.count;
    });
    confirmedTrends.forEach(t => {
        if (!trendMap[t._id]) trendMap[t._id] = { views: 0, clicks: 0, confirmed: 0 };
        trendMap[t._id].confirmed = t.count;
    });

    const dates = Object.keys(trendMap).sort();
    const trends = {
        labels: dates,
        views: dates.map(d => trendMap[d].views),
        clicks: dates.map(d => trendMap[d].clicks),
        confirmed: dates.map(d => trendMap[d].confirmed)
    };

    // 3. Distributions
    const getDist = async (field) => {
        return ProductEvent.aggregate([
            { $match: { product_id: new mongoose.Types.ObjectId(id), event_type: 'VIEW', created_at: { $gte: startDate } } },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
    };

    const distributions = {
        country: await getDist('country'),
        city: await getDist('city'),
        device: await getDist('device_type'),
        browser: await getDist('browser'),
        os: await getDist('os')
    };

    // 4. Recent Activity
    const activity = await ProductEvent.find({ product_id: id })
        .sort({ created_at: -1 })
        .limit(20)
        .select('event_type country city device_type browser created_at');

    // 5. User Segments (Mock)
    // 5. User Segments (Real AI Data)
    // We want segments of users who VIEWED this product.
    // This requires aggregation: ProductEvent (views) -> User (segments).
    const visitorSegments = await ProductEvent.aggregate([
        {
            $match: {
                product_id: new mongoose.Types.ObjectId(id),
                event_type: 'VIEW',
                created_at: { $gte: startDate },
                user_id: { $exists: true, $ne: null } // Only authenticated users have segments
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        { $unwind: '$user.segments' },
        {
            $group: {
                _id: '$user.segments.label',
                count: { $sum: 1 } // Naive count of occurrences
            }
        },
        { $sort: { count: -1 } },
        { $limit: 6 }
    ]);

    const segments = visitorSegments.map(s => ({
        name: s._id || 'Unknown',
        count: s.count
    }));

    sendSuccess(res, {
        summary: { views, clicks, confirmed, uniqueVisitors, ctr, creditsConsumed },
        trends,
        distributions,
        activity,
        segments
    });
}));

module.exports = router;
