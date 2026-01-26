const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const { enhanceProduct } = require('../utils/openai');

router.post('/', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { name, tagline, description, website_url, logo_url, screenshots, categories, tags } = req.body;

    // Enhance product with AI (auto-tagging and description improvement)
    const enhancedData = await enhanceProduct({
        name,
        description,
        categories: categories || []
    });

    const newProduct = new Product({
        owner_user_id: req.user.id,
        name,
        tagline,
        description: enhancedData.description, // Use AI-improved description
        website_url,
        logo_url,
        screenshots,
        categories,
        tags: enhancedData.tags || tags || [], // Use AI-generated tags or fallback to provided tags
        status: 'pending'
    });

    const product = await newProduct.save();
    sendSuccess(res, product);
}));

router.get('/:id', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);
    sendSuccess(res, product);
}));

router.get('/category/:slug', asyncHandler(async (req, res, next) => {
    const { sort = 'trending' } = req.query;

    let sortQuery = {};
    let useStats = false;

    switch (sort) {
        case 'trending':
            useStats = true;
            break;
        case 'popular':
            useStats = true;
            break;
        case 'clicked':
            sortQuery = { 'stats.clicks_total': -1 };
            useStats = true;
            break;
        case 'newest':
            sortQuery = { created_at: -1 };
            break;
        case 'alpha':
            sortQuery = { name: 1 };
            break;
        default:
            useStats = true; // Default to trending
    }

    let products;

    if (useStats && (sort === 'trending' || sort === 'popular')) {
        // Use aggregation for calculated sort
        const ProductStats = require('../models/ProductStats');

        const pipeline = [
            { $match: { categories: req.params.slug, status: 'approved' } },
            {
                $lookup: {
                    from: 'productstats',
                    localField: '_id',
                    foreignField: 'product_id',
                    as: 'stats'
                }
            },
            { $unwind: { path: '$stats', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    sortScore: sort === 'trending'
                        ? { $add: [{ $multiply: [{ $ifNull: ['$stats.clicks_24h', 0] }, 3] }, { $ifNull: ['$stats.views_24h', 0] }] }
                        : { $add: [{ $multiply: [{ $ifNull: ['$stats.clicks_total', 0] }, 3] }, { $ifNull: ['$stats.views_total', 0] }] }
                }
            },
            { $sort: { sortScore: -1 } }
        ];

        products = await Product.aggregate(pipeline);
    } else {
        products = await Product.find({ categories: req.params.slug, status: 'approved' }).sort(sortQuery);
    }

    sendSuccess(res, products);
}));

// @route   PUT /api/products/:id
// @desc    Update product (founders only, own products)
router.put('/:id', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    // Verify ownership
    if (product.owner_user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'You can only edit your own products', 403);
    }

    const { name, tagline, description, website_url, logo_url, screenshots, categories, tags, team_members, awards } = req.body;

    // Update allowed fields
    if (name) product.name = name;
    if (tagline) product.tagline = tagline;
    if (description) product.description = description;
    if (website_url) product.website_url = website_url;
    if (logo_url !== undefined) product.logo_url = logo_url;
    if (screenshots) product.screenshots = screenshots;
    if (categories) product.categories = categories;
    if (tags) product.tags = tags;
    if (team_members) product.team_members = team_members;
    if (awards) product.awards = awards;

    // If product was approved, set back to pending for re-review
    if (product.status === 'approved') {
        product.status = 'pending';
    }

    product.updated_at = new Date();
    await product.save();

    sendSuccess(res, product);
}));

// @route   DELETE /api/products/:id
// @desc    Soft delete product (founders only, own products)
router.delete('/:id', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    // Verify ownership
    if (product.owner_user_id.toString() !== req.user.id) {
        return sendError(next, 'FORBIDDEN', 'You can only delete your own products', 403);
    }

    // Soft delete
    product.deleted_at = new Date();
    await product.save();

    sendSuccess(res, { message: 'Product deleted successfully' });
}));

module.exports = router;
