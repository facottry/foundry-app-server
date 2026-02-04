
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

const MONGO_URI = (process.env.MONGO_URI_PROD || process.env.MONGO_URI || '').replace(/"/g, '');

const check = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // precise case insensitive search
        const regex = /not specified/i;

        const users = await User.find({
            $or: [
                { name: { $regex: regex } },
                { slug: { $regex: /not-specified/i } }
            ]
        });

        console.log(`Found ${users.length} users fitting the description.`);
        users.forEach(u => {
            console.log(`ID: ${u._id}, Name: "${u.name}", Slug: "${u.slug}", Email: "${u.email}", Company: "${u.company_name}"`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

check();
