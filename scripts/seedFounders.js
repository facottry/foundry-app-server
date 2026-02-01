const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const slugify = require('../utils/slugify');

// Load Seed Data
const seedFile = path.join(__dirname, '../../../tools/seed_founder_product_4.json');
const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

// Mongo Connection
const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';

const seed = async () => {
    try {
        await mongoose.connect(db);
        console.log('MongoDB Connected for Seeding');

        const defaultPassword = 'password123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        console.log(`Found ${seedData.length} items to process.`);

        for (const item of seedData) {
            // 1. Determine Founder Details
            let founderName = (item.founders && item.founders.length > 0) ? item.founders[0] : 'Founder';

            let founderEmail = item.contact.email;
            if (!founderEmail) {
                let domain = 'foundry.com';
                if (item.contact.website) {
                    try {
                        domain = new URL(item.contact.website).hostname.replace('www.', '');
                    } catch (e) {
                        domain = slugify(item.name) + '.com';
                    }
                } else {
                    domain = slugify(item.name) + '.com';
                }
                founderEmail = `founder@${domain}`;
            }

            // 2. Find or Create User (Upsert)
            let user = await User.findOne({ email: founderEmail });
            const userSlug = slugify(founderName) + '-' + Math.floor(Math.random() * 1000);

            const userData = {
                name: founderName,
                email: founderEmail,
                password_hash: passwordHash,
                role: 'FOUNDER',
                credits_balance: 1000,
                slug: user ? user.slug : userSlug, // Keep existing slug if valid
                verified: true,
                onboarding_completed: true,
                company_name: item.name,
                role_title: 'Founder'
            };

            if (!user) {
                user = new User(userData);
                try {
                    await user.save();
                    console.log(`[+] Created User: ${founderName} (${founderEmail})`);
                } catch (err) {
                    if (err.code === 11000 && err.keyPattern.slug) {
                        user.slug = `${userSlug}-${Math.floor(Math.random() * 10000)}`;
                        await user.save();
                        console.log(`[+] Created User (Slug adjusted): ${founderName} (${founderEmail})`);
                    } else {
                        throw err;
                    }
                }
            } else {
                // Update Name if it changed (e.g. was 'Vibesmonitor Founder', now 'Founder')
                user.name = founderName;
                await user.save();
                console.log(`[*] Updated User: ${founderName} (${founderEmail})`);
            }

            // 3. Find or Create Product (Upsert)
            // Check by name or website
            let product = await Product.findOne({ $or: [{ name: item.name }, { website_url: item.contact.website }] });

            const productSlug = slugify(item.name);
            let categories = [];
            if (item.category) {
                categories = item.category.split('/').map(c => c.trim());
            }
            const description = item.description || `The best tool for ${item.category}`;
            let tagline = description.length > 100 ? description.substring(0, 97) + '...' : description;

            const productData = {
                owner_user_id: user._id, // Ensure correct owner linked
                name: item.name,
                slug: product ? product.slug : productSlug,
                tagline: tagline,
                description: description,
                website_url: item.contact.website || `https://${slugify(item.name)}.com`,
                categories: categories,
                status: 'approved',
                verified_status: 'verified',
                traffic_enabled: true
            };

            if (!product) {
                product = new Product(productData);
                try {
                    await product.save();
                    console.log(`[+] Created Product: ${item.name}`);
                } catch (err) {
                    if (err.code === 11000) {
                        product.slug = `${productSlug}-${Math.floor(Math.random() * 1000)}`;
                        await product.save();
                        console.log(`[+] Created Product (Slug adjusted): ${item.name}`);
                    } else {
                        throw err;
                    }
                }
            } else {
                // Update owner and fields
                Object.assign(product, productData);
                await product.save();
                console.log(`[*] Updated Product: ${item.name}`);
            }
        }

        console.log('Seeding Completed Successfully.');
        process.exit(0);

    } catch (err) {
        console.error('Seeding Failed:', err);
        process.exit(1);
    }
};

seed();
