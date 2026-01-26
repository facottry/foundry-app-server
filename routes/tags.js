const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess } = require('../utils/response');

// @route   GET /api/products/tag/:slug
// @desc    Get all products with a specific tag
router.get('/tag/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;

    // Convert slug to tag (e.g., "email-sending" → "email sending")
    const tag = slug.replace(/-/g, ' ');

    const products = await Product.find({
        status: 'approved',
        deleted_at: null,
        tags: { $regex: new RegExp(`^${tag}$`, 'i') }
    })
        .select('name tagline logo_url categories tags website_url avg_rating ratings_count')
        .sort({ created_at: -1 })
        .lean();

    sendSuccess(res, products);
}));

module.exports = router;
