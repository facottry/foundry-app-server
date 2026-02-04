
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

// NOTE: We need to handle connection string quotes if present
const MONGO_URI_DEV = (process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || '').replace(/"/g, '');
const MONGO_URI_PROD = (process.env.MONGO_URI_PROD || '').replace(/"/g, '');

const checkDB = async (name, uri) => {
    if (!uri) {
        console.log(`[${name}] No URI provided. Skipping.`);
        return;
    }
    console.log(`\n------------------------------------------------`);
    console.log(`[${name}] Connecting...`);
    // Mask password for safety in logs
    const safeName = uri.replace(/\/\/.*@/, '//***@');
    console.log(`URI: ${safeName}`);

    try {
        await mongoose.connect(uri);
        console.log(`[${name}] Connected.`);

        const targetId = '697faf381bd6af1f2262061d';
        console.log(`[${name}] Looking for user ID: ${targetId}`);
        const userById = await User.findById(targetId);

        if (userById) {
            console.log(`[${name}] FOUND BY ID: ${userById.name} (${userById.slug})`);
        } else {
            console.log(`[${name}] NOT FOUND BY ID.`);
        }

        console.log(`[${name}] Checking for ANY "Not specified" names/slugs...`);
        const badUsers = await User.find({
            $or: [
                { name: { $regex: /not specified/i } },
                { slug: { $regex: /not-specified/i } }
            ]
        });

        if (badUsers.length > 0) {
            console.log(`[${name}] FOUND ${badUsers.length} BAD USERS:`);
            badUsers.forEach(u => console.log(` - ID: ${u._id} | Name: ${u.name} | Slug: ${u.slug} | Email: ${u.email}`));
        } else {
            console.log(`[${name}] Clean. No occurrences found.`);
        }

    } catch (err) {
        console.error(`[${name}] Error:`, err.message);
    } finally {
        await mongoose.disconnect();
        console.log(`[${name}] Disconnected.`);
    }
};

const run = async () => {
    await checkDB('PROD', MONGO_URI_PROD);
    await checkDB('DEV', MONGO_URI_DEV);
};

run();
