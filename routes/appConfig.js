const express = require('express');
const router = express.Router();
const { getSystemConfig } = require('../utils/systemConfig');

// @route   GET /api/app/initial-config
// @desc    Get public configuration for client apps
// @access  Public
router.get('/initial-config', async (req, res) => {
    try {
        const trackServerBaseUrl = await getSystemConfig('TRACK_SERVER_BASE_URL');
        res.json({
            trackServerBaseUrl: trackServerBaseUrl || ''
        });
    } catch (err) {
        console.error('Config fetch error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
