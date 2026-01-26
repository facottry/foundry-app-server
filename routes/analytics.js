const express = require('express');
const router = express.Router();
const ProductView = require('../models/ProductView');
const OutboundClick = require('../models/OutboundClick');
const UserSegment = require('../models/UserSegment');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   GET /api/founder/products/:id/analytics/overview
// @desc    Overview analytics: views, clicks, CTR, unique users
router.get('/:id/overview', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const productId = req.params.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Verify ownership
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    if (product.owner_user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'You can only view analytics for your own products', 403);
    }

    const [viewsToday, views7d, viewsTotal, clicksToday, clicks7d, clicksTotal, uniqueViewsToday, uniqueClicksToday, repeatVisitors] = await Promise.all([
        ProductView.countDocuments({ product_id: productId, created_at: { $gte: todayStart } }),
        ProductView.countDocuments({ product_id: productId, created_at: { $gte: sevenDaysAgo } }),
        ProductView.countDocuments({ product_id: productId }),
        OutboundClick.countDocuments({ product_id: productId, created_at: { $gte: todayStart } }),
        OutboundClick.countDocuments({ product_id: productId, created_at: { $gte: sevenDaysAgo } }),
        OutboundClick.countDocuments({ product_id: productId }),
        ProductView.distinct('session_id', { product_id: productId, created_at: { $gte: todayStart } }).then(arr => arr.length),
        OutboundClick.distinct('session_id', { product_id: productId, created_at: { $gte: todayStart } }).then(arr => arr.length),
        ProductView.aggregate([
            { $match: { product_id: product._id } },
            { $group: { _id: '$session_id', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $count: 'repeat' }
        ])
    ]);

    const totalUniqueSessions = await ProductView.distinct('session_id', { product_id: productId }).then(arr => arr.length);
    const repeatVisitorsCount = repeatVisitors[0]?.repeat || 0;
    const repeatVisitorsPercent = totalUniqueSessions > 0 ? (repeatVisitorsCount / totalUniqueSessions * 100).toFixed(1) : 0;
    const ctr = viewsToday > 0 ? (clicksToday / viewsToday * 100).toFixed(2) : 0;

    const data = {
        views_today: viewsToday,
        views_7d: views7d,
        views_total: viewsTotal,
        clicks_today: clicksToday,
        clicks_7d: clicks7d,
        clicks_total: clicksTotal,
        unique_views_today: uniqueViewsToday,
        unique_clicks_today: uniqueClicksToday,
        repeat_visitors_percent: parseFloat(repeatVisitorsPercent),
        ctr: parseFloat(ctr)
    };

    sendSuccess(res, data);
}));

// @route   GET /api/founder/products/:id/analytics/audience
// @desc    Audience analytics: countries, cities, browsers, devices, segments
router.get('/:id/audience', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const productId = req.params.id;

    // Verify ownership
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    if (product.owner_user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'You can only view analytics for your own products', 403);
    }

    const [topCountries, topCities, topBrowsers, topDevices, topSegments] = await Promise.all([
        ProductView.aggregate([
            { $match: { product_id: product._id, country: { $ne: 'Unknown' } } },
            { $group: { _id: '$country', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { country: '$_id', count: 1, _id: 0 } }
        ]),
        ProductView.aggregate([
            { $match: { product_id: product._id, city: { $ne: 'Unknown' } } },
            { $group: { _id: '$city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { city: '$_id', count: 1, _id: 0 } }
        ]),
        ProductView.aggregate([
            { $match: { product_id: product._id } },
            { $group: { _id: '$browser', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { browser: '$_id', count: 1, _id: 0 } }
        ]),
        ProductView.aggregate([
            { $match: { product_id: product._id } },
            { $group: { _id: '$device_type', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { device_type: '$_id', count: 1, _id: 0 } }
        ]),
        ProductView.aggregate([
            { $match: { product_id: product._id } },
            {
                $lookup: {
                    from: 'usersegments',
                    localField: 'session_id',
                    foreignField: 'session_id',
                    as: 'segment'
                }
            },
            { $unwind: { path: '$segment', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$segment.segment_tag', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { segment: '$_id', count: 1, _id: 0 } }
        ])
    ]);

    const data = {
        top_countries: topCountries,
        top_cities: topCities,
        top_browsers: topBrowsers,
        top_devices: topDevices,
        top_segments: topSegments
    };

    sendSuccess(res, data);
}));

// @route   GET /api/founder/products/:id/analytics/traffic
// @desc    Traffic timeline: views and clicks over time
router.get('/:id/traffic', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const productId = req.params.id;
    const days = parseInt(req.query.days) || 7;

    // Verify ownership
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    if (product.owner_user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'You can only view analytics for your own products', 403);
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    const [viewsTimeline, clicksTimeline] = await Promise.all([
        ProductView.aggregate([
            { $match: { product_id: product._id, created_at: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', views: '$count', _id: 0 } }
        ]),
        OutboundClick.aggregate([
            { $match: { product_id: product._id, created_at: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', clicks: '$count', _id: 0 } }
        ])
    ]);

    const data = {
        views_timeline: viewsTimeline,
        clicks_timeline: clicksTimeline
    };

    sendSuccess(res, data);
}));

module.exports = router;
