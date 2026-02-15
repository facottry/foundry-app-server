/**
 * User Auth Middleware (AppServer)
 * 
 * Validates User JWT tokens only.
 * Rejects Admin JWTs (type === 'ADMIN').
 * Loads user from users collection.
 * 
 * Usage: requireUserAuth() or requireUserAuth(['FOUNDER'])
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = function requireUserAuth(roles = []) {
    return async (req, res, next) => {
        const token = req.header('x-auth-token');
        console.log(`[Auth] Validating token for ${req.path}`);

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'AUTH_ERROR',
                msg: 'No token, authorization denied'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

            // Reject Admin JWTs - must be USER type or legacy token
            if (decoded.type === 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    error: 'FORBIDDEN',
                    msg: 'Admin tokens not allowed on user routes'
                });
            }

            // Handle both new and legacy token structures
            if (decoded.user) {
                // Legacy token structure: { user: { id, role } }
                req.user = decoded.user;
            } else if (decoded.userId) {
                // New token structure: { userId, type: 'USER' }
                const user = await User.findById(decoded.userId).select('-password_hash');
                if (!user) {
                    return res.status(401).json({ msg: 'User not found' });
                }
                req.user = { id: user._id, role: user.role };
            } else {
                return res.status(401).json({ msg: 'Invalid token structure' });
            }

            // Check role permissions
            if (roles.length > 0 && !roles.includes(req.user.role)) {
                return res.status(403).json({ msg: 'Access denied: Insufficient role' });
            }

            next();
        } catch (err) {
            res.status(401).json({ msg: 'Token is not valid' });
        }
    };
};
