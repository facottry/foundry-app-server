const crypto = require('crypto');

/**
 * Parse User-Agent string to extract browser, OS, and device type
 */
const parseUserAgent = (ua) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', device_type: 'desktop' };

    const uaLower = ua.toLowerCase();

    // Browser detection
    let browser = 'Other';
    if (uaLower.includes('chrome') && !uaLower.includes('edg')) browser = 'Chrome';
    else if (uaLower.includes('safari') && !uaLower.includes('chrome')) browser = 'Safari';
    else if (uaLower.includes('firefox')) browser = 'Firefox';
    else if (uaLower.includes('edg')) browser = 'Edge';
    else if (uaLower.includes('opera') || uaLower.includes('opr')) browser = 'Opera';

    // OS detection
    let os = 'Other';
    if (uaLower.includes('windows')) os = 'Windows';
    else if (uaLower.includes('mac os')) os = 'macOS';
    else if (uaLower.includes('linux')) os = 'Linux';
    else if (uaLower.includes('android')) os = 'Android';
    else if (uaLower.includes('ios') || uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';

    // Device type detection
    let device_type = 'desktop';
    if (uaLower.includes('mobile') || uaLower.includes('android')) device_type = 'mobile';
    else if (uaLower.includes('tablet') || uaLower.includes('ipad')) device_type = 'tablet';

    return { browser, os, device_type };
};

/**
 * Get geo location from IP (simplified - returns mock data)
 * In production, use a service like MaxMind GeoIP2 or ip-api.com
 */
const getGeoFromIP = (ip) => {
    // For now, return placeholder
    // In production, integrate with GeoIP service
    return {
        country: 'Unknown',
        city: 'Unknown'
    };
};

/**
 * Hash IP address for privacy
 */
const hashIP = (ip) => {
    if (!ip) return null;
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
};

/**
 * Hash User-Agent for privacy
 */
const hashUA = (ua) => {
    if (!ua) return null;
    return crypto.createHash('sha256').update(ua).digest('hex').substring(0, 16);
};

/**
 * Extract all metadata from request
 */
const extractMetadata = (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';

    const { browser, os, device_type } = parseUserAgent(ua);
    const { country, city } = getGeoFromIP(ip);

    return {
        ip_hash: hashIP(ip),
        ua_hash: hashUA(ua),
        browser,
        os,
        device_type,
        country,
        city
    };
};

module.exports = {
    parseUserAgent,
    getGeoFromIP,
    hashIP,
    hashUA,
    extractMetadata
};
