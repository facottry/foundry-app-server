const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const OutboundClick = require('../models/OutboundClick');
const ProductStats = require('../models/ProductStats');
const crypto = require('crypto');
const { asyncHandler, sendError } = require('../utils/response'); // Redirect doesn't use sendSuccess usually

router.get('/:productId', asyncHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.productId);
    if (!product) return sendError(next, 'NOT_FOUND', 'Product not found', 404);

    const owner = await User.findById(product.owner_user_id);
    if (!owner) return sendError(next, 'NOT_FOUND', 'Owner not found', 404);

    if (owner.credits_balance <= 0) {
        // Degrade to UI message instead of raw string
        // Returning JSON error for now as per "Every API response" rule, frontend should handle invalid redirects? 
        // Actually /r/ is likely opened in new tab. JSON response in new tab is ugly. 
        // But adhering to "Graceful Degradation" means I should probably respond with a nice HTML page or redirect to a frontend error route?
        // I'll stick to JSON for strictness of "Every API response matches schema", but this is arguably a "Page Request".
        // Let's redirect to client error page: http://localhost:3000/error?code=CREDITS_EXHAUSTED
        // For now, I will use sendError(..., 402) which returns JSON.
        return sendError(next, 'PAYMENT_REQUIRED', 'Founder out of credits', 402);
    }

    const click_id = crypto.randomBytes(16).toString('hex');
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.get('User-Agent') || 'unknown';
    const ip_hash = crypto.createHash('sha256').update(ip).digest('hex');
    const ua_hash = crypto.createHash('sha256').update(ua).digest('hex');

    const click = new OutboundClick({
        product_id: product.id,
        click_id,
        ip_hash,
        ua_hash,
        confirmed: false
    });

    await click.save();

    // Update ProductStats
    await ProductStats.findOneAndUpdate(
        { product_id: product.id },
        {
            $inc: { clicks_total: 1, clicks_24h: 1 },
            $set: { last_clicked_at: new Date() }
        },
        { upsert: true, new: true }
    );

    const targetUrl = new URL(product.website_url);
    targetUrl.searchParams.append('fid', 'foundry');
    targetUrl.searchParams.append('cid', click_id);

    res.redirect(targetUrl.toString());
}));

module.exports = router;
