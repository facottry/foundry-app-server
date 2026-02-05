const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');

// @route   GET api/collections
// @desc    Get all collections
// @access  Public
router.get('/', async (req, res) => {
    try {
        const collections = await Collection.find().sort({ name: 1 });
        res.json({ success: true, data: collections });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/collections/:slug
// @desc    Get collection by slug
// @access  Public
router.get('/:slug', async (req, res) => {
    try {
        const collection = await Collection.findOne({ slug: req.params.slug });
        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }
        res.json({ success: true, data: collection });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
