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

module.exports = router;
