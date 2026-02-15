const express = require('express');
const router = express.Router();
const { getSystemConfig } = require('../utils/systemConfig');

const axios = require('axios');
const ServerHealth = require('../models/ServerHealth');

// @route   GET /api/app/initial-config
// @desc    Get public configuration for client apps
// @access  Public
router.get('/initial-config', async (req, res) => {
    try {
        const trackServerBaseUrl = await getSystemConfig('TRACK_SERVER_BASE_URL');

        // Define servers with names for logging
        const servers = [
            { name: 'adminserver', url: process.env.ADMIN_SERVER_URL ? `${process.env.ADMIN_SERVER_URL}/api/wakeup` : null },
            { name: 'botserver', url: process.env.BOT_SERVER_URL ? `${process.env.BOT_SERVER_URL}/wakeup` : null },
            { name: 'trackserver', url: process.env.TRACK_SERVER_URL ? `${process.env.TRACK_SERVER_URL}/wakeup` : null }
        ].filter(s => s.url);

        // Fire and forget - using Promise.allSettled to track results
        if (servers.length > 0) {
            Promise.allSettled(servers.map(s => axios.get(s.url)))
                .then(results => {
                    const today = new Date().toISOString().split('T')[0];
                    const updates = results.map((result, index) => {
                        const serverName = servers[index].name;
                        const isSuccess = result.status === 'fulfilled';

                        if (!isSuccess) {
                            console.log(`[Wakeup] Failed to wake ${serverName}: ${result.reason?.message}`);
                        }

                        return ServerHealth.updateOne(
                            { date: today, server: serverName },
                            {
                                $inc: {
                                    hits: 1,
                                    success: isSuccess ? 1 : 0,
                                    fail: isSuccess ? 0 : 1
                                }
                            },
                            { upsert: true }
                        );
                    });

                    // Execute DB updates
                    return Promise.all(updates);
                })
                .catch(err => console.error('[Wakeup] Stats Logging Error:', err));
        }

        const SystemConfig = require('../models/SystemConfig');
        const popupConfig = await SystemConfig.findOne({ key: 'PROMO_POPUP_CONFIG' });
        const marqueeConfig = await SystemConfig.findOne({ key: 'MARQUEE_CONFIG' });

        const defaultPopup = { enabled: false, htmlContent: '', frequencyHours: 24 };
        const defaultMarquee = { enabled: false, htmlContent: '', linkUrl: '', backgroundColor: '#111827', textColor: '#ffffff' };

        let popup = defaultPopup;
        let marquee = defaultMarquee;

        if (popupConfig && popupConfig.value) {
            try {
                const val = typeof popupConfig.value === 'string' ? JSON.parse(popupConfig.value) : popupConfig.value;
                popup = { ...defaultPopup, ...val };
            } catch (e) { console.error('Error parsing popup config', e); }
        }

        if (marqueeConfig && marqueeConfig.value) {
            try {
                const val = typeof marqueeConfig.value === 'string' ? JSON.parse(marqueeConfig.value) : marqueeConfig.value;
                marquee = { ...defaultMarquee, ...val };
            } catch (e) { console.error('Error parsing marquee config', e); }
        }

        res.json({
            trackServerBaseUrl: trackServerBaseUrl || '',
            popup,
            marquee
        });

    } catch (err) {
        console.error('Config fetch error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
