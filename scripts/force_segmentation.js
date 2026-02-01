const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const { runSegmentation } = require('../cron/segmentation');

const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';

const forceRun = async () => {
    try {
        await mongoose.connect(db);
        console.log('MongoDB Connected');

        let remaining = await User.countDocuments({ segment_dirty: true });
        console.log(`Starting Force Segmentation. Dirty Users: ${remaining}`);

        while (remaining > 0) {
            console.log(`\n--- Running Batch (Remaining: ${remaining}) ---`);
            await runSegmentation();

            // Wait a bit to avoid rate limits
            await new Promise(r => setTimeout(r, 2000));

            remaining = await User.countDocuments({ segment_dirty: true });
        }

        console.log('Force Segmentation Complete. All users processed.');
        process.exit(0);
    } catch (err) {
        console.error('Force Segmentation Failed:', err);
        process.exit(1);
    }
};

forceRun();
