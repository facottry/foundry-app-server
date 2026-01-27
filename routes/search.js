const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess } = require('../utils/response');

// Escape regex special characters to prevent regex DOS
const escapeRegex = (text) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @route   GET /api/search
// @desc    Full product search with pagination
router.get('/', asyncHandler(async (req, res) => {
    const { q = '', page = 1, limit = 20 } = req.query;

    // Minimum query length
    if (q.length < 2) {
        return sendSuccess(res, { results: [], page: 1, total: 0, query: q });
    }

    const escapedQuery = escapeRegex(q);
    const regex = new RegExp(escapedQuery, 'i');

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Search across multiple fields
    const query = {
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

    const [results, total] = await Promise.all([
        Product.find(query)
            .select('name tagline description logo_url categories tags website_url avg_rating ratings_count')
            .limit(parseInt(limit))
            .skip(skip)
            .lean(),
        Product.countDocuments(query)
    ]);

    // Sort by match priority (name > tagline > tags > description)
    const sorted = results.sort((a, b) => {
        const aNameMatch = regex.test(a.name);
        const bNameMatch = regex.test(b.name);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        const aTaglineMatch = regex.test(a.tagline);
        const bTaglineMatch = regex.test(b.tagline);
        if (aTaglineMatch && !bTaglineMatch) return -1;
        if (!aTaglineMatch && bTaglineMatch) return 1;

        const aTagsMatch = a.tags?.some(tag => regex.test(tag));
        const bTagsMatch = b.tags?.some(tag => regex.test(tag));
        if (aTagsMatch && !bTagsMatch) return -1;
        if (!aTagsMatch && bTagsMatch) return 1;

        return 0;
    });

    sendSuccess(res, {
        results: sorted,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        query: q
    });

    // AI SEGMENTATION (If authenticated)
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.user) {
                const User = require('../models/User');
                const UserEvent = require('../models/UserEvent');
                await UserEvent.create({ userId: decoded.user.id, type: 'SEARCH', target: q });
                await User.findByIdAndUpdate(decoded.user.id, { segment_dirty: true });
            }
        } catch (e) { /* Ignore auth errors in search */ }
    }
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

    // Priority: startsWith name > contains name > startsWith tags/categories
    const results = await Product.find({
        status: 'approved',
        deleted_at: null,
        $or: [
            { name: startsWithRegex },
            { name: containsRegex },
            { tags: startsWithRegex },
            { categories: startsWithRegex }
        ]
    })
        .select('name tagline logo_url')
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
