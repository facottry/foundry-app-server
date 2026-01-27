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
    const categories = Object.keys(CATEGORY_META).map(key => {
        const meta = CATEGORY_META[key];
        const stat = stats.find(s => s._id === key);
        return {
            ...meta,
            productCount: stat ? stat.count : 0
        };
    });

    // 3. Sort (Trending/Count first, or fixed order?)
    // Fixed order as per metadata definition keys usually implies priority, 
    // or we can sort by count. Let's keep fixed order for design consistency.

    sendSuccess(res, categories);
}));

module.exports = router;
