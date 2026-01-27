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
        description: enhancedData.description,
        website_url,
        logo_url,
        screenshots,
        categories,
        tags: enhancedData.tags || tags || [],
        status: 'pending',
        team_members: [] // Initialize empty
    });

    // AUTO-POPULATION RULE: If no team, add Founder
    // We already have req.user from auth middleware.
    // Fetch full user details to get avatar/title if needed, or trust req.user?
    // req.user from middleware usually has basic fields. Let's fetch full user to be safe for avatar.
    const User = require('../models/User');
    const founder = await User.findById(req.user.id);

    if (founder) {
        newProduct.team_members.push({
            user_id: founder._id,
            name: founder.name,
            title: founder.role_title || 'Founder',
            role_type: 'founder',
            avatar_url: founder.avatar_url
        });
    }

    const product = await newProduct.save();
    sendSuccess(res, product);
}));

router.get('/:id', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id).populate('team_members.user_id', 'name avatar_url role_title');
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    // DYNAMIC INJECTION RULE: If team empty, inject founder
    // We need to clone to not mutate the DB document during save (though we aren't saving here)
    // To safe-guard, let's work on the object version.
    let productObj = product.toObject();

    if (!productObj.team_members || productObj.team_members.length === 0) {
        const User = require('../models/User');
        const founder = await User.findById(product.owner_user_id);

        if (founder) {
            productObj.team_members = [{
                user_id: founder._id,
                name: founder.name,
                title: founder.role_title || 'Founder',
                role_type: 'founder',
                avatar_url: founder.avatar_url
            }];
        }
    } else {
        // Ensure founder is first?
        productObj.team_members.sort((a, b) => {
            if (a.role_type === 'founder') return -1;
            if (b.role_type === 'founder') return 1;
            return 0;
        });
    }

    sendSuccess(res, productObj);
}));

// @route   GET /api/products/categories/stats
// @desc    Get counts of products per category
router.get('/categories/stats', asyncHandler(async (req, res) => {
    // If categories is an array of strings in Product schema
    const stats = await Product.aggregate([
        { $match: { status: 'approved', deleted_at: null } },
        { $unwind: "$categories" },
        {
            $group: {
                _id: "$categories",
                count: { $sum: 1 }
            }
        }
    ]);

    // Format as { "DevTools": 12, "AI": 5, ... }
    const result = {};
    stats.forEach(s => {
        result[s._id] = s.count;
    });

    sendSuccess(res, result);
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

        const match = { status: 'approved' };
        if (req.params.slug !== 'all') {
            match.categories = req.params.slug;
        }

        const pipeline = [
            { $match: match },
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
        const query = { status: 'approved' };
        if (req.params.slug !== 'all') {
            query.categories = req.params.slug;
        }
        products = await Product.find(query).sort(sortQuery);
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
