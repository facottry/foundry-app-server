const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');

// Config
const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';
const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('FATAL: OPENAI_KEY is missing in .env');
    process.exit(1);
}

const openai = new OpenAI({ apiKey });

const connectDB = async () => {
    try {
        await mongoose.connect(db);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const calibrateProduct = async (product) => {
    try {
        console.log(`[Processing] ${product.name}...`);

        const prompt = `
        You are an expert product marketer and taxonomist.
        Analyze the following product and provide enhanced data.
        
        Product Name: ${product.name}
        Tagline: ${product.tagline}
        Original Description: ${product.description}
        Original Categories: ${product.categories.join(', ')}

        Tasks:
        1. Enhanced Description: Write a compelling, professional, and SEO-friendly description (approx 2-3 sentences).
        2. Tags: Generate 3 to 6 high-value, relevant search tags (e.g. "No-code", "Generative AI", "Analytics").
        3. Categories: Assign 1-3 best-fit categories from a broad tech taxonomy (e.g. "SaaS", "DevTools", "AI", "Marketing", "Productivity", "Fintech", "Health", "Social Media", "E-commerce", "Education", "Design", "Hardware", "Crypto", "Security").

        Output pure JSON format:
        {
            "enhanced_description": "...",
            "tags": ["...", "..."],
            "categories": ["...", "..."]
        }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs only valid JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Validation
        if (!result.enhanced_description || !result.tags || !result.categories) {
            throw new Error("Invalid structure from OpenAI");
        }

        // Update Product
        product.description = result.enhanced_description;
        product.tags = result.tags;
        product.categories = result.categories;

        // Save
        await product.save();
        console.log(`[✔ Done] ${product.name} | Tags: ${product.tags.length} | Cats: ${product.categories.join(', ')}`);

    } catch (err) {
        console.error(`[✖ Failed] ${product.name}:`, err.message);
    }
};

const run = async () => {
    await connectDB();

    const products = await Product.find({ deleted_at: null });
    console.log(`Found ${products.length} products to calibrate.`);

    // Process in chunks or one by one to avoid rate limits? 
    // Serial is safer for now.
    for (const product of products) {
        await calibrateProduct(product);
        // Small delay to be polite to the API rate limit
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('Calibration Complete.');
    process.exit(0);
};

run();
