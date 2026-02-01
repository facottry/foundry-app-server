const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess } = require('../utils/response');

// Static Metadata Configuration
const CATEGORY_META = {
    'AI': {
        name: 'AI Tools',
        slug: 'AI',
        tagline: 'Build faster with intelligence',
        gradient: 'from-orange-400 to-amber-500',
        icon: '🤖',
        subtags: ['Chatbots', 'Automation', 'Agents'],
        isTrending: true
    },
    'DevTools': {
        name: 'Developer Tools',
        slug: 'DevTools',
        tagline: 'Ship better software',
        gradient: 'from-amber-400 to-orange-600',
        icon: '⚡',
        subtags: ['Testing', 'API', 'Monitoring'],
        isTrending: true
    },
    'Marketing': {
        name: 'Marketing',
        slug: 'Marketing',
        tagline: 'Grow your audience',
        gradient: 'from-orange-300 to-red-400',
        icon: '📈',
        subtags: ['SEO', 'Content', 'Analytics'],
        isTrending: false
    },
    'Productivity': {
        name: 'Productivity',
        slug: 'Productivity',
        tagline: 'Optimize your workflow',
        gradient: 'from-amber-300 to-orange-400',
        icon: '✅',
        subtags: ['Notes', 'Calendar', 'Tasks'],
        isTrending: false
    },
    'SaaS': {
        name: 'SaaS',
        slug: 'SaaS',
        tagline: 'Software as a Service',
        gradient: 'from-orange-200 to-amber-400',
        icon: '☁️',
        subtags: ['B2B', 'Enterprise', 'Startup'],
        isTrending: false
    }
};

// @route   GET /api/categories
// @desc    Get rich category data with counts
router.get('/', asyncHandler(async (req, res) => {
    // 1. Get counts
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

    // 2. Merge with metadata
    // 2. Merge stats with metadata and include ALL categories found
    const allCategories = stats.map(stat => {
        const slug = stat._id;
        const meta = CATEGORY_META[slug] || {
            name: slug,
            slug: slug,
            tagline: 'Discover top tools',
            gradient: 'from-gray-400 to-gray-600',
            icon: '🔧',
            subtags: [],
            isTrending: false
        };

        return {
            ...meta,
            productCount: stat.count
        };
    });

    // 3. Sort by count descending
    allCategories.sort((a, b) => b.productCount - a.productCount);

    sendSuccess(res, allCategories);
}));

module.exports = router;
