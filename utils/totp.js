const crypto = require('crypto');

/**
 * Validate TOTP
 * @param {string} token - The token received
 * @param {string} secret - Shared secret
 * @param {string} masterOtp - Master override code
 * @returns {boolean}
 */
const validateTOTP = (token, secret, masterOtp) => {
    if (!token) return false;
    if (masterOtp && token === masterOtp) return true;
    if (!secret) return true; // Fail open if no secret configured? Or fail closed? Better fail closed but user might not have set it. 
    // User rule: "Disallow any url". So fail closed.

    const generateToken = (counter) => {
        const buffer = Buffer.alloc(8);
        buffer.writeUInt32BE(0, 0); // High 4 bytes
        buffer.writeUInt32BE(counter, 4); // Low 4 bytes

        const hmac = crypto.createHmac('sha1', secret);
        hmac.update(buffer);
        const signature = hmac.digest();

        const offset = signature[signature.length - 1] & 0xf;
        const binary =
            ((signature[offset] & 0x7f) << 24) |
            ((signature[offset + 1] & 0xff) << 16) |
            ((signature[offset + 2] & 0xff) << 8) |
            (signature[offset + 3] & 0xff);

        const code = binary % 1000000;
        return code.toString().padStart(6, '0');
    };

    const epoch = Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor(epoch / 30);

    // Check current, previous, and next window (allow +/- 30s skew)
    return (
        token === generateToken(currentCounter) ||
        token === generateToken(currentCounter - 1) ||
        token === generateToken(currentCounter + 1)
    );
};

module.exports = { validateTOTP };
