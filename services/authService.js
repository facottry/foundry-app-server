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

        // 1. Check provider ID match
        let existingIdentity = await AuthIdentity.findOne({ provider, providerUserId });
        if (existingIdentity) {
            const user = await User.findById(existingIdentity.userId);
            if (!user) {
                console.warn(`Orphaned identity found: ${existingIdentity._id}`);
                // Optional: Delete identity or throw?
                // For robustness, let's remove the orphaned identity and proceed to re-link/create?
                // Or just throw to alerting.
                await AuthIdentity.deleteOne({ _id: existingIdentity._id });
                // Fallthrough to step 2 as if identity didn't exist
            } else {
                return user;
            }
        }

        // 2. Check verified email match
        let userToLink = null;
        if (verified) {
            const emailMatchIdentity = await AuthIdentity.findOne({ email, verified: true });
            if (emailMatchIdentity) {
                userToLink = await User.findById(emailMatchIdentity.userId);
            } else {
                const userMatch = await User.findOne({ email: email });
                if (userMatch) {
                    userToLink = userMatch;
                }
            }
        }

        if (userToLink) {
            // Auto-link
            await this.createAuthIdentity(userToLink._id, identity);
            return userToLink;
        }

        // 3. Create user + identity
        // EXISTING User model requires 'name', 'password_hash'. 
        // We need to generate defaults if not provided.
        // For passwordHash, if SSO, we put a placeholder? Or make it optional?
        // User schema says: "password_hash: { type: String, required: true }"
        // We should fix User schema to make password_hash optional, OR generate a random one.
        // Let's generate a random one for SSO users.
        const randomPassword = Math.random().toString(36).slice(-8);
        // We'd need bcrypt here but I don't want to import it just for this if possible.
        // Wait, User model is strict. I will modify User model to NOT require password_hash if it's SSO?
        // Constraint: "No breaking changes". Changing "required: true" to "false" is non-breaking for existing data, but might affect app logic expecting it.
        // Safest: Generate a dummy hash.

        // Also 'name' is required. "Foundry User"? Or extract from profile?
        // Identity has no name. We should probably pass 'name' in normalizeIdentity or separately.
        // For now, default to "User".

        // I'll update normalizeIdentity signature or just accept it might fail validation.
        // actually `resolveUser` should probably take `profile`'s name too.

        // Let's fix this in `authController` or pass specific data.
        // For now simplistic:

        const newUser = new User({
            name: identity.name || email.split('@')[0], // Extract name from email or profile
            email: email,
            password_hash: 'sso_placeholder_' + Date.now(), // Placeholder hash
            role: 'CUSTOMER', // Default
            verified: verified
        });

        await newUser.save();
        await this.createAuthIdentity(newUser._id, identity);
        return newUser;
    }

    static async createAuthIdentity(userId, identity) {
        return await AuthIdentity.create({
            userId,
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            email: identity.email,
            verified: identity.verified
        });
    }

    static generateTokens(user) {
        const payload = { user: { id: user.id, role: user.role } };
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET || 'secret_refresh', { expiresIn: '7d' });
        return { accessToken, refreshToken };
    }
}

module.exports = AuthService;
