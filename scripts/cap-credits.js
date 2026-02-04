/**
 * Script to cap all users' credits_balance at 5000
 * Run with: node scripts/cap-credits.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MAX_CREDITS = 5000;

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const User = require('../models/User');

    // Find all users with credits > MAX
    const usersToFix = await User.find({ credits_balance: { $gt: MAX_CREDITS } });
    console.log(`Found ${usersToFix.length} users with credits > ${MAX_CREDITS}`);

    for (const user of usersToFix) {
        const oldBalance = user.credits_balance;
        user.credits_balance = MAX_CREDITS;
        await user.save();
        console.log(`Capped ${user.email}: ${oldBalance} → ${MAX_CREDITS}`);
    }

    await mongoose.disconnect();
    console.log('Done');
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
