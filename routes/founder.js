const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const OutboundClick = require('../models/OutboundClick');
const Campaign = require('../models/Campaign');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

router.get('/dashboard', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    const products = await Product.find({ owner_user_id: req.user.id });

    const productsWithStats = await Promise.all(products.map(async (product) => {
        const clickCount = await OutboundClick.countDocuments({ product_id: product.id, confirmed: true });
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const clicksToday = await OutboundClick.countDocuments({ product_id: product.id, confirmed: true, confirmed_at: { $gte: startOfDay } });
        const campaign = await Campaign.findOne({ product_id: product.id, status: 'active' });

        return {
            ...product._doc,
            total_clicks: clickCount,
            clicks_today: clicksToday,
            boost_status: campaign ? 'Active' : 'Inactive'
        };
    }));

    sendSuccess(res, { balance: user.credits_balance, products: productsWithStats });
}));

// @route   GET /api/founder/products
// @desc    Get founder's own products
router.get('/products', auth(['FOUNDER']), asyncHandler(async (req, res) => {
    const products = await Product.find({
        owner_user_id: req.user.id,
        deleted_at: null
    }).sort({ created_at: -1 });

    sendSuccess(res, products);
}));

// @route   GET /api/founder/products/:id/audience
// @desc    Get audience analytics for a product
router.get('/products/:id/audience', auth(['FOUNDER']), asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Verify ownership
    const product = await Product.findOne({ _id: id, owner_user_id: req.user.id });
    if (!product) {
        return sendError(res, 'Product not found or unauthorized', 404);
    }

    const ProductEvent = require('../models/ProductEvent');

    // Aggregation pipeline helper
    const getDistribution = async (field, eventType = null) => {
        const match = { product_id: product._id };
        if (eventType) match.event_type = eventType;

        return ProductEvent.aggregate([
            { $match: match },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
    };

    const [
        viewsByCountry,
        viewsByCity,
        viewsByBrowser,
        viewsByDevice,
        clicksByCountry,
        deviceBreakdown
    ] = await Promise.all([
        getDistribution('country', 'VIEW'),
        getDistribution('city', 'VIEW'),
        getDistribution('browser', 'VIEW'),
        getDistribution('device_type', 'VIEW'),
        getDistribution('country', 'CLICK'),
        getDistribution('device_type') // All events breakdown
    ]);

    // Get counts
    const [views, clicks, ratings, reviews] = await Promise.all([
        ProductEvent.countDocuments({ product_id: id, event_type: 'VIEW' }),
        ProductEvent.countDocuments({ product_id: id, event_type: 'CLICK' }),
        ProductEvent.countDocuments({ product_id: id, event_type: 'RATE' }),
        ProductEvent.countDocuments({ product_id: id, event_type: 'REVIEW' })
    ]);

    sendSuccess(res, {
        summary: {
            views,
            clicks,
            ratings,
            reviews
        },
        distributions: {
            views: {
                country: viewsByCountry,
                city: viewsByCity,
                browser: viewsByBrowser,
                device: viewsByDevice
            },
            clicks: {
                country: clicksByCountry
            },
            all: {
                device: deviceBreakdown
            }
        }
    });
}));

module.exports = router;
