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

router.post('/topup', auth(['FOUNDER']), asyncHandler(async (req, res, next) => {
    const { amount } = req.body;
    const user = await User.findById(req.user.id);
    user.credits_balance += parseInt(amount);
    await user.save();

    await new WalletTransaction({ user_id: req.user.id, amount: parseInt(amount), reason: 'topup' }).save();
    sendSuccess(res, { success: true, balance: user.credits_balance });
}));

module.exports = router;
