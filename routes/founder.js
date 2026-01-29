const express = require('express');
const router = express.Router();
/**
 * Purpose: Provide founder-specific functionality (Products, Wallet).
 * Inputs: Auth Token (Founder Role).
 * Outputs: Product Lists, Wallet Balance.
 * Side Effects: None (Read-only aggregation mostly).
 */
const Product = require('../models/Product');
const User = require('../models/User');
const OutboundClick = require('../models/OutboundClick');
const Campaign = require('../models/Campaign');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const { buildPublicR2Url } = require('../utils/r2Url');

// @route   GET /api/founder/public/:userId
// @desc    Get public founder profile and products
router.get('/public/:identity', asyncHandler(async (req, res, next) => {
    const { identity } = req.params;
    let query = {};

    // Check if identity is a valid ObjectId
    if (identity.match(/^[0-9a-fA-F]{24}$/)) {
        query = { _id: identity };
    } else {
        query = { slug: identity };
    }

    const user = await User.findOne(query).select('name role_title bio company_name linkedin twitter website avatar_url profileImageKey created_at slug');

    if (!user) {
        return sendError(next, 'NOT_FOUND', 'Founder not found', 404);
    }

    // Prepare public profile object
    const publicProfile = user.toObject();
    if (publicProfile.profileImageKey) {
        publicProfile.profileImageUrl = buildPublicR2Url(publicProfile.profileImageKey);
        // Cache busting
        publicProfile.profileImageUrl += `?ts=${new Date(publicProfile.created_at || Date.now()).getTime()}`;
    } else {
        publicProfile.profileImageUrl = publicProfile.avatar_url;
    }

    // Fetch Public Products (Owned by this user OR where they are a Team Member)
    // "team_members.user_id": user._id
    const products = await Product.find({
        $or: [
            { owner_user_id: user._id },
            { 'team_members.user_id': user._id }
        ],
        status: 'approved',
        deleted_at: null
    }).select('name slug tagline logo_url logoKey categories avg_rating ratings_count');

    // Enhance products with URLs
    const enhancedProducts = products.map(p => {
        const obj = p.toObject();
        if (obj.logoKey) obj.logoUrl = buildPublicR2Url(obj.logoKey);
        return obj;
    });

    sendSuccess(res, {
        profile: publicProfile,
        products: enhancedProducts
    });
}));

router.get('/dashboard', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        return sendError(next, 'AUTH_ERROR', 'User not found (DB mismatch)', 401);
    }
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

    sendSuccess(res, {
        balance: user.credits_balance,
        products: productsWithStats,
        user: {
            id: user.id,
            name: user.name,
            slug: user.slug,
            avatar_url: user.avatar_url,
            profileImageKey: user.profileImageKey
        }
    });
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
        return sendError(next, 'NOT_FOUND', 'Product not found or unauthorized', 404);
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

// @route   PUT /api/founder/products/:id
// @desc    Update product details
router.put('/products/:id', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findOne({ _id: req.params.id, owner_user_id: req.user.id });
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    const { name, tagline, description, website_url, logo_url, screenshots, categories, tags, team_members } = req.body;

    // AI Enhancement optional here? Maybe button triggered instead of auto.
    // For now, straight update.

    if (name) product.name = name;
    if (tagline) product.tagline = tagline;
    if (description) product.description = description;
    if (website_url) product.website_url = website_url;
    if (logo_url !== undefined) product.logo_url = logo_url;
    if (screenshots) product.screenshots = screenshots;
    if (categories) product.categories = categories;
    if (tags) product.tags = tags;
    if (team_members) product.team_members = team_members;

    // Reset status to pending if critical info changed? Spec says "Update Product". 
    // Usually editing approved product requires re-approval.
    if (product.status === 'approved') {
        product.status = 'pending';
    }

    product.updated_at = Date.now();
    await product.save();
    sendSuccess(res, product);
}));

// @route   DELETE /api/founder/products/:id
// @desc    Soft delete product
router.delete('/products/:id', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findOne({ _id: req.params.id, owner_user_id: req.user.id });
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    product.deleted_at = Date.now();
    // Also disable status?
    product.status = 'archived';
    await product.save();

    sendSuccess(res, { message: 'Product deleted' });
}));

// @route   PATCH /api/founder/products/:id/archive
// @desc    Archive product (Toggle)
router.patch('/products/:id/archive', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const product = await Product.findOne({ _id: req.params.id, owner_user_id: req.user.id });
    if (!product) return sendError(res, 'NOT_FOUND', 'Product not found', 404);

    // Toggle archive status
    if (product.status === 'archived') {
        product.status = 'pending'; // Restore to pending for re-review or DRAFT? 
        // Spec says "Archive Product (soft delete)". 
        // If we treat archive as a status, we can restore.
        product.deleted_at = null;
    } else {
        product.status = 'archived';
        // product.deleted_at = Date.now(); // Optional: if we want it to vanish from lists
    }

    await product.save();
    sendSuccess(res, product);
}));

module.exports = router;
