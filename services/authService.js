const User = require('../models/User');
const AuthIdentity = require('../models/AuthIdentity');
const jwt = require('jsonwebtoken');

class AuthService {
    static normalizeIdentity(provider, profile) {
        let email = profile.email;
        let providerUserId = profile.id;
        let verified = profile.verified || false;

        if (provider === 'password' || provider === 'otp') {
            providerUserId = email;
        }

        if (!email) {
            throw new Error('Email is required for identity normalization');
        }

        return {
            provider,
            providerUserId: String(providerUserId),
            email: email.toLowerCase(),
            verified,
            name: profile.name // Preserve name
        };
    }

    static async resolveUser(identity) {
        const { provider, providerUserId, email, verified } = identity;

        // 1. Exact Match: Provider + ID
        let existingIdentity = await AuthIdentity.findOne({ provider, providerUserId });
        if (existingIdentity) {
            const user = await User.findById(existingIdentity.userId);
            if (user) {
                return await this.attachLoginMethods(user);
            }
            // If identity exists but user is gone, clean up
            await AuthIdentity.deleteOne({ _id: existingIdentity._id });
        }

        // 2. Email Match (The "Canonical" Check)
        // We only trust verified emails for automatic linking
        // 2. Email Match (The "Canonical" Check)
        // We only trust verified emails for automatic linking
        let user = await User.findOne({ email });

        if (user) {
            console.log('[AuthService] Existing user found by email:', email);
            // User exists!
            if (verified) {
                console.log('[AuthService] Linking new identity to existing user.');
                // Link this new provider to the existing user
                await this.createAuthIdentity(user._id, identity);
                return await this.attachLoginMethods(user);
            } else {
                console.warn('[AuthService] Cannot link unverified identity:', email);
                // Email matches but new provider is NOT verified?
                // Security Risk: Do not link. Do not log in.
                throw new Error('Cannot link unverified identity to existing account.');
            }
        } else {
            console.log('[AuthService] No existing user found. Creating new user for:', email);
        }

        // 3. New User (No existing user found)
        user = new User({
            name: identity.name || email.split('@')[0],
            email: email,
            role: 'CUSTOMER',
            verified: verified,
            onboarding_completed: false
        });

        await user.save();
        await this.createAuthIdentity(user._id, identity);

        return await this.attachLoginMethods(user);
    }

    static async createAuthIdentity(userId, identity) {
        // Idempotent creation (upsert-like behavior)
        const filter = { provider: identity.provider, providerUserId: identity.providerUserId };
        const update = {
            userId,
            email: identity.email,
            verified: identity.verified,
            // Update name? Maybe not.
        };
        // Use findOneAndUpdate with upsert to avoid race conditions
        return await AuthIdentity.findOneAndUpdate(filter, update, { upsert: true, new: true });
    }

    static async attachLoginMethods(userDoc) {
        const user = userDoc.toObject ? userDoc.toObject() : userDoc;

        // Find all identities for this user
        const identities = await AuthIdentity.find({ userId: user._id });

        user.loginMethods = {
            password: !!user.password_hash,
            google: false,
            github: false,
            linkedin: false,
            otp: !!user.otp_hash || !!user.phone_otp_hash
        };

        identities.forEach(id => {
            if (['google', 'github', 'linkedin'].includes(id.provider)) {
                user.loginMethods[id.provider] = true;
            }
        });

        return user;
    }

    static generateTokens(user) {
        const payload = { user: { id: user._id, role: user.role } }; // Ensure _id is used
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET || 'secret_refresh', { expiresIn: '7d' });
        return { accessToken, refreshToken };
    }
}

module.exports = AuthService;
