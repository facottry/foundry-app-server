const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Collection = require('../models/Collection');

// Allow overriding via CLI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.argv[2];

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is missing. Pass it as an argument or set it in .env');
    console.error('Usage: node scripts/populate_with_ai.js <YOUR_OPENAI_API_KEY>');
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const db = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';

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
You are a product discovery expert. Generate a list of curated software collections in JSON format.
Each collection must have:
- slug: kebab-case unique identifier
- name: Human readable title
- tagline: Short catchy description (max 100 chars)
- products: Array of 5-10 real, relevant product names.

Return ONLY a valid JSON array of objects. No markdown.
`;

const THEMES = [
    "AI for Legal", "AI for Healthcare", "No-Code App Builders", "Personal Finance Apps",
    "Remote Team Games", "Mental Health Apps", "Crypto Portfolio Trackers", "Indie Maker Tools",
    "Self-Hosted Alternatives", "Privacy-Focused Browsers"
];

const generateCollections = async () => {
    console.log('Generating collections via OpenAI...');
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate 5 distinct collections for these themes: ${THEMES.join(', ')}` }
            ],
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const collections = JSON.parse(content);

        return collections;

    } catch (error) {
        console.error('OpenAI Error:', error.message);
        return [];
    }
};

const run = async () => {
    await connectDB();

    // 1. Try to generate new ones
    const collections = await generateCollections();
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
        // Path adjusted to point back to tools/collections/generated_collections.json
        const jsonPath = path.join(__dirname, '../../../tools/collections/generated_collections.json');

        if (fs.existsSync(jsonPath)) {
            console.log('Restoring base collections from tools/collections/generated_collections.json...');
            const fileContent = fs.readFileSync(jsonPath, 'utf8');
            const baseCollections = JSON.parse(fileContent);
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

    process.exit(0);
};

run();
