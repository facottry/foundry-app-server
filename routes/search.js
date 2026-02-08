const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess } = require('../utils/response');

// Escape regex special characters to prevent regex DOS
const escapeRegex = (text) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @route   GET /api/search
// @desc    Full intent-aware search with grouped results
router.get('/', asyncHandler(async (req, res) => {
    const { q = '' } = req.query;

    if (q.length < 2) {
        return sendSuccess(res, {
            results: { pages: [], categories: [], products: [], founders: [] },
            query: q
        });
    }

    const escapedQuery = escapeRegex(q);
    // Flexible match: search for each word separately (e.g. "open claw" matches "OpenClaw")
    const flexiblePattern = escapedQuery.split(/\s+/).filter(Boolean).join('.*');
    const regex = new RegExp(flexiblePattern, 'i');
    const User = require('../models/User');
    const CUSTOM_PAGES = require('../utils/customPages');
    const CATEGORY_META = require('../utils/categoryMeta');

    // 1. Custom Pages (Intent Matching)
    const matchedPages = CUSTOM_PAGES.filter(page => {
        // Match name or keywords
        return regex.test(page.name) || page.keywords.some(k => regex.test(k));
    }).map(p => ({ ...p, type: 'PAGE' }));

    // 2. Categories
    const matchedCategories = Object.values(CATEGORY_META).filter(cat => {
        return regex.test(cat.name) || regex.test(cat.slug) || cat.subtags.some(t => regex.test(t));
    }).map(c => ({
        _id: c.slug,
        name: c.name,
        slug: c.slug,
        tagline: c.tagline,
        icon: c.icon,
        type: 'CATEGORY'
    }));

    // 3. Founders (Regex + Fuzzy Fallback)
    // A. Strict Regex Match
    let founders = await User.find({
        $and: [
            {
                $or: [
                    { role: 'FOUNDER' },
                    { role: 'CUSTOMER', company_name: { $exists: true, $ne: null, $ne: '' } }
                ]
            },
            {
                $or: [
                    { name: regex },
                    { bio: regex },
                    { company_name: regex }
                ]
            }
        ]
    })
        .select('name slug avatar_url profileImageKey role_title company_name bio')
        .limit(5)
        .lean();

    // B. Fuzzy Match Fallback (if no strict results)
    if (founders.length === 0 && q.length > 3) {
        const { levenshtein } = require('../utils/stringDistance');

        // Fetch candidates (Broad: Founders OR Customers with Company)
        // Optimization: In a real large DB, this needs a text index. For now, we limit to recent 100 active or just all (assuming dataset < 1000)
        const candidates = await User.find({
            $or: [
                { role: 'FOUNDER' },
                { role: 'CUSTOMER', company_name: { $exists: true, $ne: null, $ne: '' } }
            ]
        }).select('name slug avatar_url profileImageKey role_title company_name bio').limit(200).lean();

        const fuzzyMatches = candidates.map(c => {
            const output = { ...c };
            // Check distance on Name and Company
            const distName = levenshtein(q, c.name);
            const distCompany = c.company_name ? levenshtein(q, c.company_name) : 999;
            output.score = Math.min(distName, distCompany);
            return output;
        })
            .filter(c => c.score <= 3) // Threshold: Max 3 edits allowed (Very close match)
            .sort((a, b) => a.score - b.score)
            .slice(0, 3); // Top 3 fuzzy matches

        if (fuzzyMatches.length > 0) {
            founders = fuzzyMatches;
        }
    }

    // Add type & image url
    const { buildPublicR2Url } = require('../utils/r2Url');
    const formattedFounders = founders.map(f => ({
        ...f,
        type: 'FOUNDER',
        avatar_url: f.profileImageKey ? buildPublicR2Url(f.profileImageKey) : f.avatar_url,
        is_fuzzy: !!f.score
    }));

    // 4. Products (Existing Logic + Tag matching)
    const productQuery = {
        status: 'approved',
        deleted_at: null,
        $or: [
            { name: regex },
            { tagline: regex },
            { description: regex },
            { categories: regex },
            { tags: regex }
        ]
    };

    const products = await Product.find(productQuery)
        .select('name slug tagline logo_url logoKey categories tags avg_rating ratings_count')
        .limit(20) // Get more to sort, then slice? Or just 10? Spec says "Max 5 items initially"
        .lean();

    // Sort products by relevance
    const sortedProducts = products.sort((a, b) => {
        const aNameMatch = regex.test(a.name);
        const bNameMatch = regex.test(b.name);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return 0;
    }).slice(0, 10); // Return top 10 products

    const formattedProducts = sortedProducts.map(p => {
        if (p.logoKey) p.logo_url = buildPublicR2Url(p.logoKey);
        return { ...p, type: 'PRODUCT' };
    });


    // Response Structure
    sendSuccess(res, {
        results: {
            pages: matchedPages.slice(0, 5),
            categories: matchedCategories.slice(0, 5),
            founders: formattedFounders,
            products: formattedProducts
        },
        query: q
    });

    // AI SEGMENTATION (Fire and Forget)
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.user) {
                const UserEvent = require('../models/UserEvent');
                UserEvent.create({ userId: decoded.user.id, type: 'SEARCH', target: q }).catch(() => { });
            }
        } catch (e) { }
    }
}));

// @route   GET /api/search/trending
// @desc    Get trending search queries from UserEvents
router.get('/trending', asyncHandler(async (req, res) => {
    const UserEvent = require('../models/UserEvent');

    // Aggregate top searches from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trending = await UserEvent.aggregate([
        {
            $match: {
                type: 'SEARCH',
                timestamp: { $gte: thirtyDaysAgo },
                target: { $exists: true, $ne: '' }
            }
        },
        // Normalize to lowercase to group "AI" and "ai"
        { $project: { query: { $toLower: "$target" } } },
        {
            $group: {
                _id: "$query",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    // Filter out very short queries or nonsense if needed
    const queries = trending
        .filter(t => t._id && t._id.length > 2)
        .map(t => t._id)
        .slice(0, 6);

    // If no data (e.g. dev env), return defaults
    if (queries.length === 0) {
        return sendSuccess(res, ['ai', 'saas', 'marketing', 'crm', 'productivity']);
    }

    sendSuccess(res, queries);
}));

// @route   GET /api/search/typeahead
// @desc    Type-ahead autocomplete (top 10 lightweight results)
router.get('/typeahead', asyncHandler(async (req, res) => {
    const { q = '' } = req.query;

    // Minimum query length
    if (q.length < 2) {
        return sendSuccess(res, []);
    }

    const escapedQuery = escapeRegex(q);
    const startsWithRegex = new RegExp(`^${escapedQuery}`, 'i');
    const containsRegex = new RegExp(escapedQuery, 'i');

    // Priority: startsWith name > contains name > founder name > startsWith tags/categories
    const results = await Product.find({
        status: 'approved',
        deleted_at: null,
        $or: [
            { name: startsWithRegex },
            { name: containsRegex },
            { 'team_members.name': containsRegex },
            { tags: startsWithRegex },
            { categories: startsWithRegex }
        ]
    })
        .select('name tagline logo_url team_members')
        .limit(10)
        .lean();

    // Sort by priority
    const sorted = results.sort((a, b) => {
        const aStartsWithName = startsWithRegex.test(a.name);
        const bStartsWithName = startsWithRegex.test(b.name);
        if (aStartsWithName && !bStartsWithName) return -1;
        if (!aStartsWithName && bStartsWithName) return 1;
        return 0;
    });

    sendSuccess(res, sorted);
}));

module.exports = router;
