const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';

const calibrateSegments = async () => {
    try {
        await mongoose.connect(db);
        console.log('MongoDB Connected');

        // Find users with empty segments array or missing segments
        const query = {
            $or: [
                { segments: { $size: 0 } },
                { segments: { $exists: false } },
                { segments: null }
            ]
        };

        const result = await User.updateMany(query, {
            $set: { segment_dirty: true }
        });

        console.log(`[✔] Marked ${result.modifiedCount} users as segment_dirty (from matched ${result.matchedCount}).`);

        process.exit(0);
    } catch (err) {
        console.error('Error calibrating segments:', err);
        process.exit(1);
    }
};

calibrateSegments();
