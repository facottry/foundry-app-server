const SystemConfig = require('../models/SystemConfig');

const seedSystemConfig = async () => {
    try {
        const trackKey = 'TRACK_SERVER_BASE_URL';
        const existing = await SystemConfig.findOne({ key: trackKey });

        if (!existing && process.env.TRACK_SERVER_URL) {
            console.log('Seeding TRACK_SERVER_BASE_URL from ENV...');
            await SystemConfig.create({
                key: trackKey,
                value: process.env.TRACK_SERVER_URL
            });
            console.log('Seeded TRACK_SERVER_BASE_URL:', process.env.TRACK_SERVER_URL);
        } else if (!existing) {
            // Optional: Create empty default if strict
            console.log('No TRACK_SERVER_BASE_URL found in DB or ENV. Creating empty placeholder.');
            await SystemConfig.create({ key: trackKey, value: '' });
        }
    } catch (err) {
        console.error('Error seeding System Config:', err);
    }
};

module.exports = seedSystemConfig;
