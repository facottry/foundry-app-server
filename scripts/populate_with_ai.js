const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Collection = require('../models/Collection');
const Product = require('../models/Product');

// Allow overriding via CLI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.argv[2];

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is missing. Pass it as an argument or set it in .env');
    console.error('Usage: node scripts/populate_with_ai.js <YOUR_OPENAI_API_KEY>');
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// const db = process.env.MONGO_URI_PROD || process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/foundry';
const db = process.env.MONGO_URI_LOCAL;

const connectDB = async () => {
    try {
        await mongoose.connect(db, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Failed:', err.message);
        process.exit(1);
    }
};

const SYSTEM_PROMPT = `
You are a product discovery curator focused on early-stage and indie software products
from the Indian founding ecosystem.

Generate curated software collections that prioritize:
- Recently launched or actively evolving products
- Small teams, solo founders, or bootstrapped startups
- India-based or India-first founders
- Modern tools used by builders, operators, and creators

Strictly avoid large incumbents, unicorns, or Big Tech products.

Each collection must include:
- slug: kebab-case unique identifier
- name: Human-readable collection title
- tagline: Short, catchy description (max 100 chars)
- products: Array of 5–10 real, relevant product names (no giants)

Return ONLY a valid JSON array of objects.
No markdown. No explanations.
`;

const THEMES = [
    "New Indie SaaS from India",
    "Bootstrapped Tools by Indian Founders",
    "Solo Founder Products",
    "Early-Stage Dev Tools (India)",
    "Modern Tools for Indian Startups",
    "Creator Economy Tools (India)",
    "Micro SaaS for Businesses in India",
    "Open Source Products by Indian Teams",
    "Self-Hosted Tools Built in India",
    "Fresh Product Hunt Launches from India"
];


const generateCollections = async () => {
    console.log('Fetching ecosystem products...');

    // Fetch only approved products to ensure quality and visibility
    const products = await Product.find({ status: 'approved' })
        .select('name tagline categories description')
        .lean();

    if (products.length === 0) {
        console.warn('No approved products found in DB. Cannot generate collections.');
        return [];
    }

    console.log(`Found ${products.length} approved products. Generating collections via OpenAI...`);

    // Prepare context
    const productNamespace = new Map();
    products.forEach(p => {
        productNamespace.set(p.name.toLowerCase(), p.name);
    });

    const productContext = products.map(p => ({
        name: p.name,
        tagline: p.tagline,
        categories: p.categories
    }));

    // Helper for filtering
    const filterCollections = (collectionsToFilter, sourceName) => {
        return collectionsToFilter.map(col => {
            const validProducts = [];
            if (col.products && Array.isArray(col.products)) {
                col.products.forEach(prodName => {
                    const normalized = prodName.trim().toLowerCase();
                    if (productNamespace.has(normalized)) {
                        validProducts.push(productNamespace.get(normalized));
                    }
                });
            }
            col.products = validProducts;
            return col;
        });
    };

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `
                    Available Products:
                    ${JSON.stringify(productContext, null, 2)}

                    Task:
                    Generate 5 distinct collections for these themes: ${THEMES.join(', ')}
                    Select the best fitting products from the available list for each collection.
                    `
                }
            ],
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        let collections = JSON.parse(content);

        // Filter valid products
        collections = filterCollections(collections, "Generated");

        return collections;

    } catch (error) {
        console.error('OpenAI Error:', error.message);
        return [];
    }
};

const run = async () => {
    await connectDB();

    // Fetch all products once for global filtering context
    const products = await Product.find({ status: 'approved' })
        .select('name')
        .lean();

    const productNamespace = new Map();
    products.forEach(p => {
        productNamespace.set(p.name.toLowerCase(), p.name);
    });

    const filterCollections = (collectionsToFilter, sourceName) => {
        return collectionsToFilter.map(col => {
            const validProducts = [];
            if (col.products && Array.isArray(col.products)) {
                // Handle case where products might be objects in some legacy formats, expecting strings
                col.products.forEach(prodName => {
                    if (typeof prodName !== 'string') return;
                    const normalized = prodName.trim().toLowerCase();
                    if (productNamespace.has(normalized)) {
                        validProducts.push(productNamespace.get(normalized));
                    } else {
                        // warning hidden to reduce noise
                    }
                });
            }
            col.products = validProducts;
            return col;
        });
    };

    // 1. Try to generate new ones
    // Note: generateCollections needs access to productNamespace. 
    // We'll refactor generateCollections to take it as arg or just move specific logic here.
    // For minimal diff, let's keep generateCollections self-contained but we need to inject the map or products.
    // Actually, generateCollections *fetches* products internally currently. 

    // To fix this cleanly:
    // Let's modify generateCollections to accept the product list/map we just fetched.

    // ... wait, I cannot easily change the signature of generateCollections in this Replace block without changing the whole file.
    // Let's just patch the restoration block effectively.

    // 1. Generate (keeps its own fetch for now, slightly inefficient but safe)
    const collections = await generateCollections();
    // (generateCollections already filters internally in previous step)

    if (collections.length > 0) {
        console.log(`Generated ${collections.length} collections. Saving to DB...`);
        let count = 0;
        for (const col of collections) {
            if (!col.slug || !col.name) continue;

            await Collection.findOneAndUpdate(
                { slug: col.slug },
                {
                    name: col.name,
                    tagline: col.tagline,
                    products: col.products || [],
                    updated_at: new Date()
                },
                { upsert: true, new: true }
            );
            count++;
            process.stdout.write('.');
        }
        console.log(`\nSuccessfully upserted ${count} generated collections.`);
    }

    // 2. Restore base collections from the original tools location
    try {
        const jsonPath = path.join(__dirname, '../../../tools/collections/generated_collections.json');

        if (fs.existsSync(jsonPath)) {
            console.log('Restoring base collections from tools/collections/generated_collections.json...');
            const fileContent = fs.readFileSync(jsonPath, 'utf8');
            let baseCollections = JSON.parse(fileContent);

            // APPLY FILTER HERE
            console.log('Validating base collections against database products...');
            baseCollections = filterCollections(baseCollections, "Base/Restored");

            let restoredCount = 0;
            for (const col of baseCollections) {
                await Collection.findOneAndUpdate(
                    { slug: col.slug },
                    col,
                    { upsert: true, new: true }
                );
                restoredCount++;
                if (restoredCount % 10 === 0) process.stdout.write('.');
            }
            console.log(`\nRestored ${restoredCount} base collections.`);
        } else {
            console.warn(`Warning: Base collections file not found at ${jsonPath}`);
        }
    } catch (e) {
        console.error('Error reading base collections:', e.message);
    }

    console.log('\n--- STARTING GLOBAL CALIBRATION (SLOW & EASY) ---');
    console.log('Verifying every collection in the database against approved products...');

    // 3. Global Calibration: Clean entire DB
    const allCollections = await Collection.find({});
    let globalRemovedCount = 0;

    for (const col of allCollections) {
        let isDirty = false;
        const initialCount = col.products.length;
        const validProducts = [];

        if (col.products && Array.isArray(col.products)) {
            for (const prodName of col.products) {
                if (typeof prodName !== 'string') continue;

                const normalized = prodName.trim().toLowerCase();
                if (productNamespace.has(normalized)) {
                    // Keep exact matching name from our approved list
                    validProducts.push(productNamespace.get(normalized));
                } else {
                    console.log(`[Calibration] Removing invalid product "${prodName}" from collection "${col.name}"`);
                    isDirty = true;
                    globalRemovedCount++;
                }
            }
        }

        if (isDirty || col.products.length !== validProducts.length) {
            col.products = validProducts;
            await col.save();
            console.log(`[Calibration] Saved cleaned collection: ${col.name} (${initialCount} -> ${col.products.length} products)`);
            // Artificial delay for "Slow and Easy" visibility
            await new Promise(r => setTimeout(r, 100));
        } else {
            // console.log(`[Calibration] Collection "${col.name}" is clean.`);
        }
    }

    console.log(`\nCalibration Complete.`);
    console.log(`Removed ${globalRemovedCount} invalid product references across ${allCollections.length} collections.`);

    process.exit(0);
};

run();
