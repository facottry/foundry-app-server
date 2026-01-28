const SystemConfig = require('../models/SystemConfig');

let cache = {};

// TTL in milliseconds (60 seconds)
const TTL = 60 * 1000;

const getSystemConfig = async (key) => {
    const now = Date.now();

    // Check cache
    if (cache[key] && (now - cache[key].lastFetched < TTL)) {
        return cache[key].value;
    }

    try {
        const config = await SystemConfig.findOne({ key });
        const value = config ? config.value : null;

        // Update cache
        cache[key] = { value, lastFetched: now };

        return value;
    } catch (err) {
        console.error(`Error fetching config for ${key}:`, err);
        return null;
    }
};

module.exports = { getSystemConfig };
