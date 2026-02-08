const express = require('express');
const router = express.Router();
/**
 * Purpose: Handle traffic redirection AND billing AND tracking.
 * Consolidates logic from trackserver for robustness.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const uaparser = require('ua-parser-js');

// Helper: Parse Cookies Manually (since cookie-parser might be missing)
const parseCookies = (req) => {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach((cookie) => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
};

// Models
const Product = require('../models/Product');
const VisitEvent = require('../models/VisitEvent');
const VisitCreditLedger = require('../models/VisitCreditLedger');
const ProductDailyTraffic = require('../models/ProductDailyTraffic');
const FounderDailyTraffic = require('../models/FounderDailyTraffic');
const ProductStats = require('../models/ProductStats');
const User = require('../models/User');
const OutboundClick = require('../models/OutboundClick');

router.get('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        if (!product.website_url) {
            return res.status(400).send('Product has no website URL');
        }

        // 1. Basic Metadata
        const cookies = parseCookies(req);
        const visitId = crypto.randomUUID();
        const sessionId = cookies.visit_session_id || crypto.randomUUID();
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';

        // 2. Enrichment
        const geo = geoip.lookup(ip);
        const uaResult = uaparser(ua);

        // 3. Create Visit Record (Default: CONFIRMED immediately because we are redirecting)
        // We skip INITIATED -> CONFIRMED step because Redirect = Action.
        const visitRecord = await VisitEvent.create({
            visit_id: visitId,
            product_id: product._id,
            founder_id: product.owner_user_id,
            session_id: sessionId,
            status: 'CONFIRMED', // Default to confirmed
            ip_hash: crypto.createHash('sha256').update(ip).digest('hex'),
            country: geo?.country || 'Unknown',
            city: geo?.city || 'Unknown',
            browser: uaResult.browser.name || 'Unknown',
            os: uaResult.os.name || 'Unknown',
            device_type: uaResult.device.type || 'desktop',
            confirmed_at: new Date()
        });

        // 4. Credit Deduction Logic of Clicktory (1 Credit = 1 Click)
        // Check for duplicate charge window (24h per session/product)
        const today = new Date().toISOString().split('T')[0];

        const existingCharge = await VisitCreditLedger.findOne({
            product_id: product._id,
            session_id: sessionId,
            date: today
        });

        let billable = false;

        if (!existingCharge) {
            const founder = await User.findById(product.owner_user_id);
            if (founder && founder.credits_balance > 0) {
                billable = true;

                // Transaction: Deduct Credit
                await User.findByIdAndUpdate(product.owner_user_id, { $inc: { credits_balance: -1 } });

                // Note: WalletTransaction handled separately? Or should we log it here?
                // Ideally log it as well. But sticking to core requirement first.
                // Assuming User model has credits_balance (checked schema earlier, it does).

                // Create Ledger Entry
                await VisitCreditLedger.create({
                    product_id: product._id,
                    founder_id: product.owner_user_id,
                    session_id: sessionId,
                    date: today,
                    visit_id: visitId,
                    credits_deducted: 1
                });

                // Update Visit Status
                visitRecord.status = 'BILLED';
                await visitRecord.save();
            }
        }

        // 4b. Create OutboundClick Record (For Dashboard Compatibility)
        // Since we are redirecting, this is an "Auto-Confirmed" Click
        await OutboundClick.create({
            product_id: product._id,
            click_id: visitId, // Use visitId as click_id
            session_id: sessionId,
            confirmed: true, // Auto-confirmed since it's a direct redirect
            created_at: new Date(),
            confirmed_at: new Date(),
            ip_hash: crypto.createHash('sha256').update(ip).digest('hex'),
            country: geo?.country || 'Unknown',
            city: geo?.city || 'Unknown',
            browser: uaResult.browser.name || 'Unknown',
            os: uaResult.os.name || 'Unknown',
            device_type: uaResult.device.type || 'desktop'
        });

        // 5. Update Aggregates (Analytics)
        const incUpdate = { $inc: { visits: 1 } };
        if (billable) incUpdate.$inc.credits_consumed = 1;
        if (!existingCharge) incUpdate.$inc.unique_visits = 1;

        await ProductDailyTraffic.findOneAndUpdate(
            { product_id: product._id, date: today },
            incUpdate,
            { upsert: true, new: true }
        );

        await FounderDailyTraffic.findOneAndUpdate(
            { founder_id: product.owner_user_id, date: today },
            { $inc: { visits: 1, credits_consumed: billable ? 1 : 0 } },
            { upsert: true }
        );

        // Update Admin/Global Product Stats
        await ProductStats.findOneAndUpdate(
            { product_id: product._id },
            {
                $inc: { clicks_total: 1, clicks_24h: 1 },
                $set: { last_clicked_at: new Date(), updated_at: new Date() }
            },
            { upsert: true }
        );

        // 6. Set Session Cookie
        if (!cookies.visit_session_id) {
            res.cookie('visit_session_id', sessionId, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });
        }

        // 7. Redirect
        const destUrl = new URL(product.website_url.startsWith('http') ? product.website_url : `https://${product.website_url}`);
        destUrl.searchParams.append('fid', 'clicktory');
        destUrl.searchParams.append('vid', visitId);

        res.redirect(destUrl.toString());

    } catch (err) {
        console.error('Redirect/Tracking error', err);
        // Fallback: Just redirect if tracking fails?
        // But if tracking fails, we lose money.
        // For now, allow 500 to signal connectivity issue is safer for "No Free Traffic".
        res.status(500).send('Redirect failed');
    }
});

module.exports = router;
