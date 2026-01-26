const express = require('express');
const router = express.Router();
const OutboundClick = require('../models/OutboundClick');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const Product = require('../models/Product');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

router.post('/confirm', asyncHandler(async (req, res, next) => {
    const { cid } = req.body;
    if (!cid) return sendError(next, 'VALIDATION_ERROR', 'Missing cid', 400);

    const click = await OutboundClick.findOne({ click_id: cid });
    if (!click) return sendError(next, 'NOT_FOUND', 'Invalid click', 404);

    if (click.confirmed) return sendSuccess(res, { msg: 'Already confirmed' });

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentClick = await OutboundClick.findOne({
        product_id: click.product_id,
        ip_hash: click.ip_hash,
        confirmed: true,
        confirmed_at: { $gt: thirtyMinsAgo }
    });

    if (recentClick) return sendError(next, 'RATE_LIMITED', 'Duplicate confirmation', 429);

    click.confirmed = true;
    click.confirmed_at = Date.now();
    await click.save();

    const product = await Product.findById(click.product_id);
    const owner = await User.findById(product.owner_user_id);

    if (owner.credits_balance > 0) {
        owner.credits_balance -= 1;
        await owner.save();
        await new WalletTransaction({ user_id: owner.id, amount: -1, reason: 'click_charge' }).save();
    }

    sendSuccess(res, { success: true });
}));

module.exports = router;
