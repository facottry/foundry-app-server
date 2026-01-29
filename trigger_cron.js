const mongoose = require('mongoose');
const { runSegmentation } = require('./cron/segmentation');
require('dotenv').config();

const trigger = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Mark a user as dirty for testing
        const user = await mongoose.model('User').findOne();
        if (user) {
            console.log(`Marking user ${user._id} as dirty`);
            user.segment_dirty = true;
            await user.save();
        }

        await runSegmentation();

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

trigger();
