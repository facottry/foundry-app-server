const User = require('../models/User');
const AuthIdentity = require('../models/AuthIdentity');
const jwt = require('jsonwebtoken');

class AuthService {
    static normalizeIdentity(provider, profile) {
        let email = profile.email;
        let providerUserId = profile.id;
        // Handle both naming conventions from different providers
        let verified = profile.verified || profile.email_verified || false;

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

    static async resolveUser(identity, ipAddress = null) {
        const { provider, providerUserId, email, verified } = identity;
        const { getEffectiveName } = require('../utils/slugGenerator');
        const geoip = require('geoip-lite');

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
        // Derive clean name
        const cleanName = getEffectiveName(identity.name, email);

        // Derive City from IP
        let city = undefined;
        let location = undefined;
        if (ipAddress) {
            const geo = geoip.lookup(ipAddress);
            if (geo && geo.city) {
                city = geo.city;
                // Also approximate location for existing logic if we want
                location = `${geo.city}, ${geo.country}`;
            }
        }

        user = new User({
            name: cleanName,
            email: email,
            role: 'FOUNDER', // Default to FOUNDER per user request
            verified: verified,
            onboarding_completed: false,
            city: city, // New Field
            location: location // Approximate
        });

        // Generate Slug
        const { generateBaseSlug } = require('../utils/slugGenerator');
        let baseSlug = generateBaseSlug(user.name);
        let finalSlug = baseSlug;

        // Collision Resolution (Lite version for auth flow)
        // We do a simple loop check.
        const FILLER_WORDS = ['official', 'profile', 'hq', 'real', 'site', 'web', 'now', 'connect'];

        let counter = 0;
        while (await User.findOne({ slug: finalSlug })) {
            const filler = FILLER_WORDS[counter % FILLER_WORDS.length];
            // If we exhaust fillers, we might need to stack or append random chars (but user said NO NUMBERS)
            // Let's stack if round 2
            if (counter >= FILLER_WORDS.length) {
                finalSlug = `${baseSlug}-generic-${filler}`;
            } else {
                finalSlug = `${baseSlug}-${filler}`;
            }
            counter++;
            // Circuit breaker
            if (counter > 20) {
                // Fallback to timestamp hash letters only if absolutely stuck
                const uniqueSuffix = Date.now().toString(36).replace(/[0-9]/g, 'z');
                finalSlug = `${baseSlug}-${uniqueSuffix}`;
                break;
            }
        }
        user.slug = finalSlug;

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
