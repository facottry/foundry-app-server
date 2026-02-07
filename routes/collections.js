const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');

// @route   GET api/collections
// @desc    Get all collections
// @access  Public
router.get('/', async (req, res) => {
    const cacheFirst = require('../utils/cacheFirst');
    try {
        const data = await cacheFirst({
            key: 'public:collections:list',
            ttlMs: 3600000,
            res,
            fetcher: async () => {
                // Only return collections with at least 2 products
                return Collection.find({ "products.1": { $exists: true } }).sort({ name: 1 });
            }
        });
        res.json({ success: true, data });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/collections/:slug
// @desc    Get collection by slug
// @access  Public
router.get('/:slug', async (req, res) => {
    const cacheFirst = require('../utils/cacheFirst');
    try {
        const data = await cacheFirst({
            key: `public:collections:slug:${req.params.slug}`,
            ttlMs: 3600000,
            res,
            fetcher: async () => {
                return Collection.findOne({ slug: req.params.slug });
            }
        });

        if (!data) {
            return res.status(404).json({ msg: 'Collection not found' });
        }
        res.json({ success: true, data });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
