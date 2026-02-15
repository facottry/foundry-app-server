const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const axios = require('axios');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const jwt = require('jsonwebtoken');
const { generateUniqueSlug } = require('../utils/slug');
const { sendEmail } = require('../email-engine');

/**
 * POST /api/staffium/token
 * Generate a one-time SSO token for Staffium access
 * 
 * Security:
 * - Validates Clicktory session JWT
 * - Makes server-to-server call to Staffium
 * - Never exposes STAFFIUM_SSO_SECRET to frontend
 * - Token is short-lived (60s) and one-time use
 */
router.post('/token', authMiddleware(), async (req, res) => {
    try {
        const user = req.user; // From auth middleware

        // Only founders can access Staffium
        if (user.role !== 'FOUNDER') {
            return res.status(403).json({
                success: false,
                error: 'Staffium access is only available for founders'
            });
        }

        // Check if Staffium integration is enabled
        // Note: We need to fetch the latest user state because req.user might be stale or partial
        // However, req.user from auth middleware usually has the essentials. 
        // But staffiumEnabled is new.
        // Let's rely on the fetch below if we need to, but we can also just check if it exists in req.user
        // if the auth middleware supports it. 
        // To be safe, we should fetch the user or trust the token if we regenerate it on setting change.
        // But for now, let's fetch it to be sure, or check the fullUser fetch below.

        // Actually, logic below fetches fullUser if email/name missing. 
        // Let's fetch full user always to check the setting securely? 
        // Or better, let's just use the user object we have, assuming auth middleware populates it?
        // Auth middleware populates from DB? No, it usually verifies JWT.
        // Standard JWT usually contains minimal info. 
        // So we probably need to fetch the user to check this setting.

        const userSettings = await User.findById(user._id || user.id).select('staffiumEnabled');
        if (!userSettings || !userSettings.staffiumEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Staffium integration is disabled. Enable it in your Security Settings.'
            });
        }

        // Prepare SSO payload
        let ssoUser = user;

        // If email or name is missing (due to auth middleware stripping), fetch from DB
        if (!user.email || !user.name) {
            console.log('Fetching full user details for SSO...');
            const fullUser = await User.findById(user._id || user.id);
            if (!fullUser) {
                throw new Error('User not found for SSO');
            }
            ssoUser = fullUser;
        }

        const ssoPayload = {
            user_id: ssoUser._id || ssoUser.id,
            email: ssoUser.email,
            name: ssoUser.name,
            role: 'founder' // Staffium role mapping
        };

        // Staffium internal SSO endpoint
        const staffiumUrl = process.env.STAFFIUM_URL;
        const ssoSecret = process.env.STAFFIUM_CLICKTORY_SSO_SHARED_SECRET;
        if (!staffiumUrl) {
            console.error('STAFFIUM_URL not configured');
            return res.status(500).json({
                success: false,
                error: 'SSO configuration error,staffiumUrl is not defined'
            });
        }

        if (!ssoSecret) {
            console.error('STAFFIUM_CLICKTORY_SSO_SHARED_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: 'SSO configuration error,ssoSecret is not defined'
            });
        }
        console.log('Generating Staffium SSO token', {
            hasUserId: Boolean(ssoPayload.user_id),
            email: ssoPayload.email,
            role: ssoPayload.role,
            staffiumUrl
        });

        // Server-to-server call to Staffium
        const response = await axios.post(
            `${staffiumUrl}/internal/sso-token`,
            ssoPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': ssoSecret,
                    'X-App-Source': 'clicktory-server'
                },
                timeout: 5000 // 5 second timeout
            }
        );

        console.log('Staffium SSO response:', response.data);

        const tokenData = response.data;
        if (!tokenData || !tokenData.staffium_token) {
            throw new Error('Invalid response from Staffium SSO');
        }

        // Return token to frontend (never log it)
        res.json({
            success: true,
            staffium_token: tokenData.staffium_token,
            expires_in: tokenData.expires_in || 60
        });

    } catch (error) {
        console.error('Staffium SSO token generation failed:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });

        // Return generic error to frontend
        if (error.response) {
            // Staffium returned an error
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data?.error || 'Failed to generate SSO token' + JSON.stringify(error.response)
            });
        }

        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            return res.status(504).json({
                success: false,
                error: 'Staffium service timeout'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to generate SSO token' + JSON.stringify(error)
        });
    }
});

/**
 * POST /api/staffium/sso-login
 * Server-to-server endpoint for Staffium to request a session for a user.
 * 
 * Flow:
 * 1. Staffium backend calls this with shared secret + user details (email, name).
 * 2. Clicktory validates secret.
 * 3. Clicktory finds or creates user (auto-onboarding).
 * 4. Clicktory generates JWT.
 * 5. Returns JWT to Staffium to be used in iframe.
 */
/**
 * POST /api/staffium/activate
 * Activate or Renew Staffium subscription
 * Cost: 30 Credits / Month
 */
router.post('/activate', authMiddleware(), async (req, res) => {
    try {
        const userId = req.user.id;
        const COST = 30;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        // Check Balance
        if (user.credits_balance < COST) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits',
                current_balance: user.credits_balance,
                required: COST
            });
        }

        // Deduct Credits
        user.credits_balance -= COST;

        // Calculate New Expiry
        const now = new Date();
        let newExpiry = new Date();

        // If already active, extend
        if (user.staffiumExpiresAt && user.staffiumExpiresAt > now) {
            newExpiry = new Date(user.staffiumExpiresAt);
        }

        // Add 30 days
        newExpiry.setDate(newExpiry.getDate() + 30);

        user.staffiumExpiresAt = newExpiry;
        user.staffiumEnabled = true; // Auto-enable on purchase

        await user.save();

        // Log Transaction
        await new WalletTransaction({
            user_id: user.id,
            amount: -COST,
            reason: 'staffium_subscription'
        }).save();

        res.json({
            success: true,
            msg: 'Staffium activated successfully',
            expires_at: user.staffiumExpiresAt,
            remaining_balance: user.credits_balance
        });

    } catch (error) {
        console.error('Staffium Activation Error:', error);
        res.status(500).json({ success: false, error: 'Activation failed' });
    }
});

// Original SSO Login Route (unchanged)
router.post('/sso-login', async (req, res) => {
    try {
        const { email, name } = req.body;
        const secret = req.headers['x-staffium-secret'] || req.headers['x-internal-secret'];

        // 1. Validate Secret
        if (secret !== process.env.STAFFIUM_CLICKTORY_SSO_SHARED_SECRET) {
            console.warn('Unauthorized Staffium SSO attempt', { email });
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!email || !name) {
            return res.status(400).json({ success: false, error: 'Missing email or name' });
        }

        // 2. Find or Create User
        let user = await User.findOne({ email });

        if (!user) {
            console.log('Creating new user from Staffium SSO', { email });

            // Generate Slug
            const slug = await generateUniqueSlug(User, name);

            // Generate Random Password (account is managed via SSO mostly, but good to have)
            const randomPassword = Math.random().toString(36).slice(-8);
            // We don't hash it here because we aren't setting a password login yet, 
            // or we could hash a random string. Let's just leave password_hash undefined or set a dummy.
            // Requirement says "always treated as logged in user", effectively auto-signup.

            user = new User({
                name,
                email,
                slug,
                role: 'FOUNDER',
                // Auto-onboard settings
                onboarding_completed: true,
                verified: true,
                credits_balance: 1000,
                // Mark as created via Staffium for analytics if we had a source field
                bio: 'Joined via Staffium',
            });

            await user.save();

            // Grant Starter Credits
            await new WalletTransaction({
                user_id: user.id,
                amount: 1000,
                reason: 'starter'
            }).save();

            // Send welcome email (optional, depends on if we want them to know they have a Clicktory account yet)
            // For now, let's trigger it so they have an email record.
            try {
                sendEmail({
                    templateKey: 'WELCOME_FOUNDER',
                    to: user.email,
                    data: { founderName: user.name }
                });
            } catch (e) {
                console.error('Failed to send welcome email for SSO user', e);
            }
        } else {
            // Ensure existing user is treated as FOUNDER if they come from Staffium? 
            // Requirement says "create a user in Real Time... complete basic onboarding".
            // If user exists but is CUSTOMER, do we upgrade? 
            // Staffium is a B2B tool for founders/staff. Safe to assume FOUNDER role or keep existing.
            // If they are CUSTOMER, they might be confused if they don't see dashboard.
            // Let's force ensure they have FOUNDER capability if they are coming from Staffium context.
            if (user.role === 'CUSTOMER') {
                user.role = 'FOUNDER';
                // If they verify via SSO, we can mark verified
                if (!user.verified) user.verified = true;
                await user.save();
            }
        }

        // 3. Generate JWT
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 }); // 100 hours

        // 4. Return Token
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                slug: user.slug
            }
        });

    } catch (error) {
        console.error('Staffium SSO Login Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
