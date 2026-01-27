const express = require('express');
const router = express.Router();
/**
 * Purpose: Manage user authentication and profile retrieval.
 * Inputs: Email, Password, Name (for Register).
 * Outputs: JWT Token, User Profile.
 * Side Effects: Creates User record, Updates last_login_at.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   POST /api/auth/signup
router.post('/signup', asyncHandler(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    let user = await User.findOne({ email });
    if (user) {
        return sendError(next, 'VALIDATION_ERROR', 'User already exists', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    user = new User({
        name,
        email,
        password_hash,
        role: role === 'ADMIN' ? 'CUSTOMER' : role
    });

    if (role === 'FOUNDER') user.credits_balance = 1000;

    await user.save();

    if (role === 'FOUNDER') {
        await new WalletTransaction({
            user_id: user.id,
            amount: 1000,
            reason: 'starter'
        }).save();
    }

    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 });

    sendSuccess(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// @route   POST /api/auth/login
router.post('/login', asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    let user = await User.findOne({ email });
    if (!user) return sendError(next, 'AUTH_ERROR', 'Invalid credentials', 400);

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return sendError(next, 'AUTH_ERROR', 'Invalid credentials', 400);

    // AppServer Policy: Reject ADMIN login
    if (user.role === 'ADMIN') return sendError(next, 'PERMISSION_DENIED', 'Admins must use Admin App', 403);

    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 });

    sendSuccess(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// @route   POST /api/auth/send-otp
router.post('/send-otp', asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(next, 'NOT_FOUND', 'User not found', 404);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    user.otp_hash = otpHash;
    user.otp_expires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail(email, 'Your Foundry OTP', `Your OTP code is ${otp}`);

    sendSuccess(res, { msg: 'OTP sent' });
}));

// @route   POST /api/auth/login-otp
router.post('/login-otp', asyncHandler(async (req, res, next) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(next, 'AUTH_ERROR', 'Invalid credentials', 400);

    let isMatch = false;
    if (process.env.MASTER_OTP && otp === process.env.MASTER_OTP) {
        isMatch = true;
    } else {
        if (user.otp_hash && user.otp_expires > Date.now()) {
            isMatch = await bcrypt.compare(otp, user.otp_hash);
        }
    }

    if (!isMatch) return sendError(next, 'AUTH_ERROR', 'Invalid OTP', 400);

    if (otp !== process.env.MASTER_OTP) {
        user.otp_hash = undefined;
        user.otp_expires = undefined;
        await user.save();
    }

    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 });

    sendSuccess(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// @route   POST /api/auth/change-password
router.post('/change-password', require('../middleware/auth')(), asyncHandler(async (req, res, next) => {
    const { newPassword } = req.body;
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(req.user.id, { password_hash });
    sendSuccess(res, { msg: 'Password updated successfully' });
}));

module.exports = router;
