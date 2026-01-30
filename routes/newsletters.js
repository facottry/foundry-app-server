const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');

/**
 * @route   GET /api/newsletters
 * @desc    Get all public sent newsletters (Archive)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const newsletters = await Newsletter.find({ status: 'SENT' })
            .select('title slug scheduled_at cover_image stats.open_count') // Only needed fields
            .sort({ scheduled_at: -1 });
        res.json(newsletters);
    } catch (error) {
        console.error('Error fetching newsletters:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   GET /api/newsletters/:slug
 * @desc    Get single newsletter by slug
 * @access  Public
 */
router.get('/:slug', async (req, res) => {
    try {
        const newsletter = await Newsletter.findOne({
            slug: req.params.slug,
            status: 'SENT'
        });

        if (!newsletter) {
            return res.status(404).json({ error: 'Newsletter not found' });
        }

        res.json(newsletter);
    } catch (error) {
        console.error('Error fetching newsletter:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
