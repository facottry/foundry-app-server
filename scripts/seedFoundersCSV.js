const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const slugify = require('../utils/slugify');

// Mongo Connection
const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

const seed = async () => {
    try {
        await mongoose.connect(db);
        console.log('MongoDB Connected for Seeding CSV');

        const defaultPassword = 'password123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const seedFile = path.join(__dirname, '../../../tools/seed3.csv');
        const fileStream = fs.createReadStream(seedFile);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let isHeader = true;
        let count = 0;
        let pendingLine = '';

        for await (const line of rl) {
            let fullLine = pendingLine + line;

            // Check if line ends inside a quote (odd number of quotes)
            const quoteCount = (fullLine.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                pendingLine = fullLine + '\n';
                continue;
            }
            pendingLine = ''; // Reset pending line

            if (!fullLine.trim()) continue;

            if (isHeader) {
                isHeader = false;
                continue; // Skip header: Project,Tagline,Enhanced Description,Founder(s),Official Email
            }

            // Columns (seed3.csv): 
            // 0: Project
            // 1: Tagline
            // 2: Enhanced Description
            // 3: Founder(s)
            // 4: Official Email
            const cols = parseCSVLine(fullLine);

            if (cols.length < 3) continue; // Skip invalid lines

            const productName = cols[0];
            const tagline = cols[1];
            const description = cols[2];
            const categoryRaw = 'SaaS'; // Default category as it's missing in seed3.csv
            const founderNameInput = cols[3];
            const emailInput = cols[4];
            const websiteInput = null; // seed3.csv has no website column

            // 1. Determine Founder Details
            let founderName = founderNameInput;
            if (!founderName || founderName.toLowerCase() === 'admin' || founderName.trim() === '') {
                founderName = 'Founder';
            }

            let founderEmail = emailInput;
            if (!founderEmail || !founderEmail.includes('@')) {
                let domain = 'clicktory.in';
                if (websiteInput) {
                    try {
                        domain = new URL(websiteInput).hostname.replace('www.', '');
                    } catch (e) {
                        domain = slugify(productName) + '.com';
                    }
                } else {
                    domain = slugify(productName) + '.com';
                }
                founderEmail = `founder@${domain}`;
            }

            // 2. Find or Create User (Upsert)
            let user = await User.findOne({ email: founderEmail });
            const userSlug = slugify(founderName) + '-' + Math.floor(Math.random() * 10000);

            const userData = {
                name: founderName,
                email: founderEmail,
                password_hash: passwordHash,
                role: 'FOUNDER',
                credits_balance: 1000,
                slug: user ? user.slug : userSlug,
                verified: true,
                onboarding_completed: true,
                company_name: productName,
                role_title: 'Founder'
            };

            if (!user) {
                user = new User(userData);
                try {
                    await user.save();
                    console.log(`[+] Created User: ${founderName} (${founderEmail})`);
                } catch (err) {
                    if (err.code === 11000 && err.keyPattern.slug) {
                        user.slug = `${userSlug}-${Math.floor(Math.random() * 99999)}`;
                        await user.save();
                        console.log(`[+] Created User (Slug adjusted): ${founderName}`);
                    }
                }
            } else {
                user.name = founderName;
                await user.save();
                console.log(`[*] Updated User: ${founderName} (${founderEmail})`);
            }

            // 3. Find or Create Product (Upsert)
            let product = await Product.findOne({ $or: [{ name: productName }, { website_url: websiteInput }] });

            const productSlug = slugify(productName);
            let categories = [];
            if (categoryRaw) {
                categories = categoryRaw.split('/').map(c => c.trim());
            }

            let cleanDesc = description.replace(/^"|"$/g, '');
            // tagline is already defined from cols[1] earlier
            // If tagline input was empty, maybe fallback to truncated description, but usually seed3 has taglines.
            if (!tagline) {
                tagline = cleanDesc.length > 100 ? cleanDesc.substring(0, 97) + '...' : cleanDesc;
            }

            const productData = {
                owner_user_id: user._id,
                name: productName,
                slug: product ? product.slug : productSlug,
                tagline: tagline,
                description: cleanDesc,
                website_url: websiteInput || `https://${slugify(productName)}.com`,
                categories: categories,
                status: 'approved',
                verified_status: 'verified',
                traffic_enabled: true
            };

            if (!product) {
                product = new Product(productData);
                try {
                    await product.save();
                    console.log(`[+] Created Product: ${productName}`);
                    count++;
                } catch (err) {
                    if (err.code === 11000) {
                        product.slug = `${productSlug}-${Math.floor(Math.random() * 1000)}`;
                        await product.save();
                        console.log(`[+] Created Product (Slug adjusted): ${productName}`);
                        count++;
                    } else {
                        console.error(`Error saving product ${productName}:`, err.message);
                    }
                }
            } else {
                Object.assign(product, productData);
                await product.save();
                console.log(`[*] Updated Product: ${productName}`);
                count++;
            }
        }

        console.log(`Seeding Completed. Processed ${count} items.`);
        process.exit(0);

    } catch (err) {
        console.error('Seeding Failed:', err);
        process.exit(1);
    }
};

seed();
