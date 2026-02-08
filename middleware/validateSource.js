const { validateTOTP } = require('../utils/totp');
const { sendError } = require('../utils/response');

const validateSource = (req, res, next) => {
    // Skip for public assets if any (though usually served by separate static server or CDN)
    // Skip for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') return next();

    // OPTIONAL: Skip for webhooks if they have their own signature validation (e.g. Stripe)
    // if (req.path.startsWith('/api/webhooks')) return next();

    const token = req.headers['x-app-source'];
    const secret = process.env.APP_SECRET || 'CLICKTORY_DEFAULT_SECRET';
    const masterOtp = process.env.APP_MASTER_OTP; // Backdoor/Admin code

    // console.log('[DEBUG] Source Validation:', { method: req.method, path: req.path, token: token ? 'PRESENT' : 'MISSING', ip: req.ip });

    if (!validateTOTP(token, secret, masterOtp)) {
        console.warn(`[Security] Blocked request from ${req.ip} to ${req.path} - Invalid/Missing TOTP`);
        // Directly send response to ensure execution stops here
        return res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Access Denied: Invalid Source Signature. This API is protected.',
                details: 'Missing X-App-Source header.'
            }
        });
    }

    next();
};

module.exports = validateSource;
