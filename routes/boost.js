const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

router.post('/create', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { product_id, daily_budget, max_cpc } = req.body;
    const product = await Product.findById(product_id);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    if (product.owner_user_id.toString() !== req.user.id) return sendError(next, 'PERMISSION_DENIED', 'Not authorized', 401);

    const newCampaign = new Campaign({ product_id, daily_budget, max_cpc, status: 'active' });
    const campaign = await newCampaign.save();
    sendSuccess(res, campaign);
}));

router.post('/pause', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { campaign_id } = req.body;
    const campaign = await Campaign.findById(campaign_id);
    if (!campaign) return sendError(next, 'NOT_FOUND', 'Campaign not found', 404);

    const product = await Product.findById(campaign.product_id);
    if (product.owner_user_id.toString() !== req.user.id) return sendError(next, 'PERMISSION_DENIED', 'Not authorized', 401);

    campaign.status = 'paused';
    await campaign.save();
    sendSuccess(res, campaign);
}));

router.get('/promoted/:category', asyncHandler(async (req, res, next) => {
    const productsInCategory = await Product.find({ categories: req.params.category, status: 'approved' }).select('_id');
    const productIds = productsInCategory.map(p => p._id);
    let campaigns = await Campaign.find({ product_id: { $in: productIds }, status: 'active' }).populate('product_id');
    campaigns = campaigns.filter(c => c.spent_today < c.daily_budget);
    campaigns.sort((a, b) => b.max_cpc - a.max_cpc);
    sendSuccess(res, campaigns.slice(0, 2));
}));

module.exports = router;
