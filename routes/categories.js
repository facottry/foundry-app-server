const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler, sendSuccess } = require('../utils/response');

// Static Metadata Configuration
const CATEGORY_META = require('../utils/categoryMeta');

// @route   GET /api/categories
// @desc    Get rich category data with counts
router.get('/', asyncHandler(async (req, res) => {
    const cacheFirst = require('../utils/cacheFirst');

    const categories = await cacheFirst({
        key: 'public:categories:list',
        ttlMs: 3600000, // 1 Hour
        fetcher: async () => {
            // 1. Get counts and Top 3 Products
            const stats = await Product.aggregate([
                { $match: { status: 'approved', deleted_at: null } },
                { $sort: { created_at: -1 } }, // Ensure latest first
                { $unwind: "$categories" },
                {
                    $group: {
                        _id: "$categories",
                        count: { $sum: 1 },
                        topProducts: { $push: { id: "$_id", name: "$name" } }
                    }
                },
                {
                    $project: {
                        count: 1,
                        topProducts: { $slice: ["$topProducts", 3] }
                    }
                }
            ]);

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
                    productCount: stat.count,
                    topProducts: stat.topProducts || [],
                    selectionMode: 'LATEST_3_TEMP'
                };
            });

            // 3. Sort by count descending and Filter low content
            allCategories.sort((a, b) => b.productCount - a.productCount);
            return allCategories.filter(c => c.productCount >= 2);
        }
    });

    sendSuccess(res, categories);
}));

module.exports = router;
