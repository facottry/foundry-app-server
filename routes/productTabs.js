const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   GET /api/products/:id/alternatives
// @desc    Get alternative products (same category)
router.get('/:id/alternatives', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    const alternatives = await Product.find({
        _id: { $ne: product._id },
        categories: { $in: product.categories },
        status: 'approved',
        deleted_at: null
    })
        .limit(10)
        .select('name tagline logo_url categories avg_rating ratings_count');

    sendSuccess(res, alternatives);
}));

// @route   GET /api/products/:id/team
// @desc    Get product team members
router.get('/:id/team', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id).select('team_members');
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    sendSuccess(res, product.team_members || []);
}));

// @route   GET /api/products/:id/awards
// @desc    Get product awards
router.get('/:id/awards', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id).select('awards');
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    sendSuccess(res, product.awards || []);
}));

module.exports = router;
