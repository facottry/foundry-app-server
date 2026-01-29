const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const slugify = require('../utils/slugify');

const migrateSlugs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for Slug Migration...');

        const products = await Product.find({ slug: { $exists: false } });
        console.log(`Found ${products.length} products without slugs.`);

        for (const product of products) {
            let slug = slugify(product.name);

            // Check uniqueness
            let existing = await Product.findOne({ slug });
            if (existing && existing._id.toString() !== product._id.toString()) {
                slug = `${slug}-${product._id.toString().slice(-4)}`;
            }

            product.slug = slug;
            await product.save();
            console.log(`Updated product: ${product.name} -> ${slug}`);
        }

        // --- MIGRATE USERS ---
        const User = require('../models/User');
        const users = await User.find({ slug: { $exists: false } });
        console.log(`Found ${users.length} users without slugs.`);

        for (const user of users) {
            let slug = slugify(user.name);

            // Check uniqueness
            let existing = await User.findOne({ slug });
            if (existing && existing._id.toString() !== user._id.toString()) {
                slug = `${slug}-${user._id.toString().slice(-4)}`;
            }

            user.slug = slug;
            await user.save();
            console.log(`Updated user: ${user.name} -> ${slug}`);
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrateSlugs();
