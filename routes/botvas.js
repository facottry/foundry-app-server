/**
 * BotVAS Routes - Founder AI Bot VAS API
 * 
 * Endpoints:
 * - GET /api/founder/botvas/status - Get VAS status
 * - GET /api/founder/botvas/eligibility - Check bot eligibility (for SDK loading)
 * - POST /api/founder/botvas/enable - Enable VAS
 * - POST /api/founder/botvas/disable - Disable VAS
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const botVASService = require('../services/botVASService');

// All routes require authentication
router.use(authMiddleware());

/**
 * GET /status - Get VAS status for current user
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.id;

        // Role check
        if (!['FOUNDER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized. Founders only.' });
        }

        const status = await botVASService.getStatus(userId);
        res.json({ success: true, data: status });

    } catch (error) {
        console.error('[BotVAS Route] Status error:', error);
        res.status(500).json({ error: 'Failed to get VAS status' });
    }
});

/**
 * GET /eligibility - Check if bot can be loaded (for SDK injection)
 */
router.get('/eligibility', async (req, res) => {
    try {
        const userId = req.user.id;

        // Role check
        if (!['FOUNDER', 'ADMIN'].includes(req.user.role)) {
            return res.json({
                success: true,
                data: {
                    botEligible: false,
                    disableReason: 'invalid_role',
                    botNamespace: null
                }
            });
        }

        const eligibility = await botVASService.checkEligibility(userId);

        res.json({
            success: true,
            data: {
                botEligible: eligibility.eligible,
                disableReason: eligibility.reason,
                botNamespace: eligibility.eligible ? 'ClicktoryAI' : null,
                credits: eligibility.credits,
                nextDeduction: eligibility.nextDeduction,
                sdkUrl: eligibility.sdkUrl,
                serverUrl: eligibility.serverUrl
            }
        });

    } catch (error) {
        console.error('[BotVAS Route] Eligibility error:', error);
        res.json({
            data: {
                botEligible: false,
                disableReason: 'error',
                botNamespace: null
            }
        });
    }
});

/**
 * POST /enable - Enable VAS (deducts 30 credits)
 */
router.post('/enable', async (req, res) => {
    try {
        const userId = req.user.id;

        // Role check
        if (!['FOUNDER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized. Founders only.' });
        }

        const result = await botVASService.enable(userId);

        if (!result.success) {
            return res.status(400).json({ error: result.error, ...result });
        }

        res.json({
            success: true,
            message: 'AI Assistant enabled',
            nextDeduction: result.nextDeduction
        });

    } catch (error) {
        console.error('[BotVAS Route] Enable error:', error);
        res.status(500).json({ error: 'Failed to enable VAS' });
    }
});

/**
 * POST /disable - Disable VAS (manual)
 */
router.post('/disable', async (req, res) => {
    try {
        const userId = req.user.id;

        // Role check
        if (!['FOUNDER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized. Founders only.' });
        }

        const result = await botVASService.disable(userId, 'manual');

        res.json({
            success: true,
            message: 'AI Assistant disabled'
        });

    } catch (error) {
        console.error('[BotVAS Route] Disable error:', error);
        res.status(500).json({ error: 'Failed to disable VAS' });
    }
});

module.exports = router;
