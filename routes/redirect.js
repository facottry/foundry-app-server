const express = require('express');
const router = express.Router();
/**
 * Purpose: Handle traffic redirection and visit initiation tracking.
 * Inputs: Product ID (URL param), Session Cookie.
 * Outputs: 302 Redirect to Product Website.
 * Side Effects: Logs INITIATED VisitEvent, Sets visit_session_id cookie.
 */
const Product = require('../models/Product');
const VisitEvent = require('../models/VisitEvent'); // We might log initiation here
const { v4: uuidv4 } = require('uuid'); // Or crypto if uuid not avail, let's use crypto for zero-dep
const crypto = require('crypto');

// @route   GET /r/:productId
// @desc    Redirect to product website and track visit initiation
// @access  Public
router.get('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' }); // Or JSON if strictly API
        }

        if (!product.website_url) {
            return res.status(400).send('Product has no website URL');
        }

        // Generate Visit ID
        const visitId = crypto.randomUUID();
        const sessionId = req.cookies?.visit_session_id || crypto.randomUUID();

        // Optional: Log INITIATED event (fire and forget or await?)
        // For speed, we might skip awaiting purely, but let's await for reliability of logs relative to redirect
        // Ideally push to redis queue, but AppServer writes to Mongo directly for other things. 
        // Let's write INITIATED to Mongo for debugging, or skip to keep it fast?
        // Plan said "Appserver -> Redirect user". 
        // Let's just redirect. The CONFIRMATION is the key monetization event.
        // However, we need to know WHO initiated it for the confirmation to match? 
        // No, the confirmation comes from the client beacon with the visit_id we gave them.
        // So we don't strictly *need* to store it here if we trust the visit_id provided back.
        // BUT, to prevent easier spoofing, we should record that we Issued visit_id X for product Y.

        // Let's create the record.
        try {
            await VisitEvent.create({
                visit_id: visitId,
                product_id: product._id,
                founder_id: product.owner_user_id, // Fixed: Product model uses owner_user_id
                session_id: sessionId,
                status: 'INITIATED',
                ip_hash: 'REDACTED', // AppServer might not do full enrichment, TrackServer does
                // We'll trust TrackServer/EventWorker to fill in details on Confirmation
            });
        } catch (logErr) {
            console.error('Failed to log visit initiation', logErr);
            // Don't block redirect
        }

        // Set persistent session cookie if not present
        if (!req.cookies?.visit_session_id) {
            res.cookie('visit_session_id', sessionId, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });
        }

        // Construct Destination URL
        const destUrl = new URL(product.website_url.startsWith('http') ? product.website_url : `https://${product.website_url}`);
        destUrl.searchParams.append('fid', 'foundry');
        destUrl.searchParams.append('vid', visitId);

        res.redirect(destUrl.toString());

    } catch (err) {
        console.error('Redirect error', err);
        res.status(500).send('Redirect failed');
    }
});

module.exports = router;
