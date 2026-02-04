const express = require('express');
const router = express.Router();
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

router.get('/balance', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    sendSuccess(res, { balance: user.credits_balance });
}));

router.get('/transactions', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const transactions = await WalletTransaction.find({ user_id: req.user.id }).sort({ created_at: -1 });
    sendSuccess(res, transactions);
}));

const MAX_CREDITS = 5000;
const MAX_TOPUP_AMOUNT = 1000;

router.post('/topup', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { amount } = req.body;
    const topupAmount = parseInt(amount);

    // Enforce max topup per transaction
    if (topupAmount > MAX_TOPUP_AMOUNT) {
        return sendError(next, 'LIMIT_EXCEEDED', `Maximum topup allowed is ${MAX_TOPUP_AMOUNT} credits per transaction.`, 400);
    }

    const user = await User.findById(req.user.id);
    user.credits_balance += topupAmount;

    // Enforce max credit limit
    if (user.credits_balance > MAX_CREDITS) {
        user.credits_balance = MAX_CREDITS;
    }

    await user.save();

    await new WalletTransaction({ user_id: req.user.id, amount: topupAmount, reason: 'topup' }).save();
    sendSuccess(res, { success: true, balance: user.credits_balance });
}));

module.exports = router;
