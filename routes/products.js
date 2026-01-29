const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const { enhanceProduct } = require('../utils/openai');

const { buildPublicR2Url } = require('../utils/r2Url');
const slugify = require('../utils/slugify');

// Helper to enhance product with derived URLs
const enhanceProductWithUrls = (product) => {
    let p = product;
    if (product.toObject) p = product.toObject();

    // Logo
    if (p.logoKey) {
        p.logoUrl = buildPublicR2Url(p.logoKey);
        // Cache busting
        p.logoUrl += `?ts=${new Date(p.updated_at || Date.now()).getTime()}`;
    } else if (p.externalLogoUrl) {
        p.logoUrl = p.externalLogoUrl;
    } else {
        p.logoUrl = p.logo_url;
    }

    // Screenshots
    if (p.screenshotKeys && p.screenshotKeys.length > 0) {
        p.screenshotUrls = p.screenshotKeys.map(key => buildPublicR2Url(key));
    } else {
        p.screenshotUrls = p.screenshots || [];
    }

    return p;
};

router.post('/', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { name, tagline, description, website_url, logo_url, screenshots, categories, tags, logoKey, screenshotKeys, externalLogoUrl } = req.body;

    // Enhance product with AI (auto-tagging and description improvement)
    const enhancedData = await enhanceProduct({
        name,
        description,
        categories: categories || []
    });

    // Generate Slug
    let slug = slugify(name);
    // Ensure uniqueness (simple append strategy)
    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const newProduct = new Product({
        owner_user_id: req.user.id,
        name,
        slug,
        tagline,
        description: enhancedData.description,
        website_url,
        logo_url,
        logoKey, // Save key
        externalLogoUrl,
        screenshots,
        screenshotKeys, // Save keys
        categories,
        tags: enhancedData.tags || tags || [],
        status: 'pending',
        team_members: [] // Initialize empty
    });

    // AUTO-POPULATION RULE: If no team, add Founder
    const User = require('../models/User');
    const founder = await User.findById(req.user.id);

    if (founder) {
        const founderObj = founder.toObject(); // use object to avoid weirdness if we were saving

        // Use helper logic for founder avatar too? 
        // We need to fetch it properly.
        let founderAvatar = founder.avatar_url;
        if (founder.profileImageKey) {
            const url = buildPublicR2Url(founder.profileImageKey);
            founderAvatar = url ? `${url}?ts=${Date.now()}` : founder.avatar_url;
        }

        newProduct.team_members.push({
            user_id: founder._id,
            name: founder.name,
            title: founder.role_title || 'Founder',
            role_type: 'founder',
            avatar_url: founderAvatar
        });
    }

    const product = await newProduct.save();

    // Return enhanced product
    sendSuccess(res, enhanceProductWithUrls(product));
}));

// @route   GET /api/products/similar/:id
// @desc    Get similar products based on category
router.get('/similar/:id', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    const similar = await Product.find({
        _id: { $ne: product._id },
        categories: { $in: product.categories },
        status: 'approved',
        deleted_at: null
    })
        .sort({ 'stats.clicks_total': -1 }) // Simple effective sort
        .limit(3);

    sendSuccess(res, similar.map(p => enhanceProductWithUrls(p)));
}));

router.get('/:id', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id).populate('team_members.user_id', 'name avatar_url role_title profileImageKey slug');
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    let productObj = product.toObject();

    // Fix team member avatars in the populated objects
    if (productObj.team_members) {
        productObj.team_members.forEach(member => {
            if (member.user_id && member.user_id.profileImageKey) {
                const url = buildPublicR2Url(member.user_id.profileImageKey);
                member.user_id.avatar_url = url ? `${url}?ts=${Date.now()}` : member.user_id.avatar_url; // Override for display
                // Also update the top-level avatar_url on the member object if it was copied/stored
                member.avatar_url = member.user_id.avatar_url;
            }
        });
    }

    // DYNAMIC INJECTION RULE: If team empty, inject founder
    if (!productObj.team_members || productObj.team_members.length === 0) {
        const User = require('../models/User');
        const founder = await User.findById(product.owner_user_id);

        if (founder) {
            let founderAvatar = founder.avatar_url;
            if (founder.profileImageKey) {
                const url = buildPublicR2Url(founder.profileImageKey);
                founderAvatar = url ? `${url}?ts=${Date.now()}` : founder.avatar_url;
            }

            productObj.team_members = [{
                user_id: founder, // Injected as full object to mimic population
                name: founder.name,
                title: founder.role_title || 'Founder',
                role_type: 'founder',
                avatar_url: founderAvatar
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

    sendSuccess(res, enhanceProductWithUrls(productObj));
    sendSuccess(res, enhanceProductWithUrls(productObj));
}));

// @route   GET /api/products/slug/:slug
// @desc    Get product by slug (public)
router.get('/slug/:slug', asyncHandler(async (req, res, next) => {
    let product = await Product.findOne({ slug: req.params.slug }).populate('team_members.user_id', 'name avatar_url role_title profileImageKey slug');

    // Fallback for migration period or if slug lookup fails
    if (!product) {
        // Check if it's an ID (valid hex string) just in case
        if (req.params.slug.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product.findById(req.params.slug).populate('team_members.user_id', 'name avatar_url role_title profileImageKey slug');
        }
    }

    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    let productObj = product.toObject();

    // Fix team member avatars logic (duplicate of logical block in get /:id, should be refactored ideally but keeping inline for now)
    if (productObj.team_members) {
        productObj.team_members.forEach(member => {
            if (member.user_id && member.user_id.profileImageKey) {
                const url = buildPublicR2Url(member.user_id.profileImageKey);
                member.user_id.avatar_url = url ? `${url}?ts=${Date.now()}` : member.user_id.avatar_url;
                member.avatar_url = member.user_id.avatar_url;
            }
        });
    }

    // Founders injection logic (condensed)
    if (!productObj.team_members || productObj.team_members.length === 0) {
        const User = require('../models/User');
        const founder = await User.findById(product.owner_user_id);
        if (founder) {
            let founderAvatar = founder.avatar_url;
            if (founder.profileImageKey) {
                const url = buildPublicR2Url(founder.profileImageKey);
                founderAvatar = url ? `${url}?ts=${Date.now()}` : founder.avatar_url;
            }
            productObj.team_members = [{
                user_id: founder,
                name: founder.name,
                title: founder.role_title || 'Founder',
                role_type: 'founder',
                avatar_url: founderAvatar
            }];
        }
    }

    sendSuccess(res, enhanceProductWithUrls(productObj));
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

    // Map products to include URLs
    const enhancedProducts = products.map(p => enhanceProductWithUrls(p));

    sendSuccess(res, enhancedProducts);
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

    const { name, tagline, description, website_url, logo_url, screenshots, categories, tags, team_members, awards, logoKey, screenshotKeys, externalLogoUrl } = req.body;

    // Update allowed fields
    if (name) product.name = name;
    if (tagline) product.tagline = tagline;
    if (description) product.description = description;
    if (website_url) product.website_url = website_url;
    if (logo_url !== undefined) product.logo_url = logo_url;
    if (logoKey !== undefined) product.logoKey = logoKey;
    if (externalLogoUrl !== undefined) product.externalLogoUrl = externalLogoUrl;
    if (screenshots) product.screenshots = screenshots;
    if (screenshotKeys) product.screenshotKeys = screenshotKeys;
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

    sendSuccess(res, enhanceProductWithUrls(product));
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
