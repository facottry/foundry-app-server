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
const cacheFirst = require('../utils/cacheFirst'); // Import Cache Util

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

router.get('/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const mode = req.query.mode; // 'track' = return 200 JSON, undefined = 302 Redirect

        // 1. Resolve Product (Cache First for Slugs/IDs)
        // We cache the mapping of slug/id -> product core data (id, website_url, owner_user_id)
        // using a short TTL (e.g. 10 mins) as these don't change often.
        const productData = await cacheFirst({
            key: `redirect:lookup:${idOrSlug}`,
            ttlMs: 600 * 1000, // 10 minutes
            res: null, // Don't auto-send response, we need data
            fetcher: async () => {
                let p = null;
                if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
                    p = await Product.findById(idOrSlug).select('website_url owner_user_id slug name');
                } else {
                    p = await Product.findOne({ slug: idOrSlug }).select('website_url owner_user_id slug name');
                }
                return p ? p.toObject() : null;
            }
        });

        if (!productData) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        if (!productData.website_url) {
            return res.status(400).send('Product has no website URL');
        }

        // 2. Async Tracking Logic (Fire and Forget style if possible, but Node is single threaded event loop, so we just await it fast)
        // We could wrap this in setImmediate to return response faster, but we need to ensure it runs.
        // For 'track' mode, speed is critical.

        const trackVisit = async () => {
            try {
                // 1. Basic Metadata
                const cookies = parseCookies(req);
                const visitId = crypto.randomUUID();
                const sessionId = cookies.visit_session_id || crypto.randomUUID();
                const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
                const ua = req.headers['user-agent'] || '';

                // 2. Enrichment
                const geo = geoip.lookup(ip);
                const uaResult = uaparser(ua);

                // 3. Create Visit Record
                const visitRecord = await VisitEvent.create({
                    visit_id: visitId,
                    product_id: productData._id,
                    founder_id: productData.owner_user_id,
                    session_id: sessionId,
                    status: 'CONFIRMED',
                    ip_hash: crypto.createHash('sha256').update(ip).digest('hex'),
                    country: geo?.country || 'Unknown',
                    city: geo?.city || 'Unknown',
                    browser: uaResult.browser.name || 'Unknown',
                    os: uaResult.os.name || 'Unknown',
                    device_type: uaResult.device.type || 'desktop',
                    confirmed_at: new Date()
                });

                // 4. Credit Deduction Logic
                const today = new Date().toISOString().split('T')[0];
                const existingCharge = await VisitCreditLedger.findOne({
                    product_id: productData._id,
                    session_id: sessionId,
                    date: today
                });

                let billable = false;

                if (!existingCharge) {
                    const founder = await User.findById(productData.owner_user_id);
                    if (founder && founder.credits_balance > 0) {
                        billable = true;
                        await User.findByIdAndUpdate(productData.owner_user_id, { $inc: { credits_balance: -1 } });
                        await VisitCreditLedger.create({
                            product_id: productData._id,
                            founder_id: productData.owner_user_id,
                            session_id: sessionId,
                            date: today,
                            visit_id: visitId,
                            credits_deducted: 1
                        });
                        visitRecord.status = 'BILLED';
                        await visitRecord.save();
                    }
                }

                // 4b. Create OutboundClick Record
                await OutboundClick.create({
                    product_id: productData._id,
                    click_id: visitId,
                    session_id: sessionId,
                    confirmed: true,
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
                // Fire and forget these updates? No, mongo is fast enough.
                const incUpdate = { $inc: { visits: 1 } };
                if (billable) incUpdate.$inc.credits_consumed = 1;
                if (!existingCharge) incUpdate.$inc.unique_visits = 1;

                await ProductDailyTraffic.findOneAndUpdate(
                    { product_id: productData._id, date: today },
                    incUpdate,
                    { upsert: true, new: true }
                );

                await FounderDailyTraffic.findOneAndUpdate(
                    { founder_id: productData.owner_user_id, date: today },
                    { $inc: { visits: 1, credits_consumed: billable ? 1 : 0 } },
                    { upsert: true }
                );

                await ProductStats.findOneAndUpdate(
                    { product_id: productData._id },
                    {
                        $inc: { clicks_total: 1, clicks_24h: 1 },
                        $set: { last_clicked_at: new Date(), updated_at: new Date() }
                    },
                    { upsert: true }
                );

                return { visitId, sessionId };
            } catch (e) {
                console.error("Async Tracking Error:", e);
                return null;
            }
        };

        // Execute Tracking
        // We await it to ensure billing happens. 
        // Optimization: In 'track' mode, we could perform this *after* sending response if using a proper queue, but simple await is safer for now.
        const trackResult = await trackVisit();

        const destUrl = new URL(productData.website_url.startsWith('http') ? productData.website_url : `https://${productData.website_url}`);
        destUrl.searchParams.append('fid', 'clicktory');
        if (trackResult?.visitId) {
            destUrl.searchParams.append('vid', trackResult.visitId);
        }

        // Return based on mode
        if (mode === 'track') {
            // Async tracking mode: Client handles redirect
            return res.json({
                success: true,
                target_url: destUrl.toString(),
                visit_id: trackResult?.visitId
            });
        } else {
            // Traditional 302 Redirect (Fallback)
            return res.redirect(destUrl.toString());
        }

    } catch (err) {
        console.error('Redirect error', err);
        // Fallback
        res.status(500).send('Redirect failed');
    }
});

module.exports = router;
