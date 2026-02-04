/**
 * slugMigration.js
 * 
 * Production Database Migration Script
 * Purpose: Normalize and optimize product slugs for SEO.
 * 
 * Usage: node slugMigration.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product'); // Adjust path if needed

// CONFIGURATION
const DRY_RUN = process.argv.includes('--dry-run');
const MONGO_URI = (process.env.MONGO_URI_PROD || process.env.MONGO_URI || '').replace(/"/g, ''); // Prefer PROD for migration task
const LOG_FILE = path.join(__dirname, 'slug_migration_log.json');

// RULES CONSTANTS
const STOP_WORDS = new Set(['the', 'a', 'an', 'by', 'for', 'with', 'and', 'of']);
const KEYWORDS = ["app", "software", "tool", "platform", "service"];
const MAX_LENGTH = 60;

// Connect to DB
const connectDB = async () => {
    try {
        if (!MONGO_URI) throw new Error('MONGO_URI is undefined');
        console.log(`Connecting to MongoDB at ${MONGO_URI.replace(/\/\/.*@/, '//***@')}...`);
        await mongoose.connect(MONGO_URI);
        console.log(`Connected to MongoDB. Dry Run: ${DRY_RUN}`);
    } catch (err) {
        console.error('DB Connection Failed:', err);
        process.exit(1);
    }
};

// HELPER: Generate Base Slug
const generateBaseSlug = (name) => {
    let slug = name.toString();

    // 1. Convert CamelCase/PascalCase to kebab-case BEFORE lowercase
    // e.g., FastMCP -> Fast-MCP
    slug = slug.replace(/([a-z])([A-Z])/g, '$1-$2');

    // 2. Lowercase
    slug = slug.toLowerCase();

    // 3. Remove Versions (CRITICAL)
    // Matches " v2", " 2.0", " 2024", "-v1", etc.
    // Aggressive version removal
    slug = slug.replace(/(\s|-|v)?\d+(\.\d+)*(-?beta|-?alpha|-?rc)?\b/g, '');

    // 4. Special Characters -> Hyphen or Remove
    // Dots to hyphens
    slug = slug.replace(/\./g, '-');
    // Remove disallowed chars: @ # % & * ! ? ( ) [ ] { }
    slug = slug.replace(/[@#%&*!?(){}\[\]]/g, '');

    // 5. Replace other non-alphanumeric with hyphens
    slug = slug.replace(/[^a-z0-9]/g, '-');

    // 6. Stopwords removal (split -> filter -> join)
    let parts = slug.split('-').filter(p => p && !STOP_WORDS.has(p));
    slug = parts.join('-');

    // 7. Collapse hyphens
    slug = slug.replace(/-+/g, '-');

    // 8. Trim hyphens
    slug = slug.replace(/^-+|-+$/g, '');

    // Fallback if empty (rare, but possible if name was "The @")
    if (!slug) slug = 'product';

    // 9. Hard limit check (truncate responsibly)
    if (slug.length > MAX_LENGTH) {
        slug = slug.substring(0, MAX_LENGTH).replace(/-+$/, '');
    }

    return slug;
};

// HELPER: Check collision
const isCollision = (slug, existingSlugs) => {
    return existingSlugs.has(slug);
};

// MAIN MIGRATION LOGIC
const migrate = async () => {
    await connectDB();

    console.log('Fetching all products...');
    const products = await Product.find({});
    console.log(`Found ${products.length} products.`);

    const existingSlugs = new Set();
    // Pre-fill existing slugs to avoid self-collision if we were doing partial updates, 
    // but here we are re-calculating ALL. However, we should check against DB unique constraint too?
    // Actually, we want to re-slug everything. So we track *new* slugs assigned in this batch.

    const updates = [];
    const logData = [];

    // Sort products by creation date or ID to have deterministic processing order?
    // Let's sort by ID to be deterministic.
    products.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

    for (const product of products) {
        let baseSlug = generateBaseSlug(product.name);

        // Resolve Collision
        let finalSlug = baseSlug;
        let attempt = 0;

        // Resolution Strategy
        // 1. Base slug
        // 2. Base slug + best keyword
        // 3. Base slug + alternative keyword
        // 4. Base slug + keyword + short hash

        if (isCollision(finalSlug, existingSlugs)) {
            // Strategy 2 & 3: Keywords
            let resolved = false;
            for (const kw of KEYWORDS) {
                // Don't append if already ends with keyword
                if (baseSlug.endsWith(`-${kw}`)) continue;

                const prospect = `${baseSlug}-${kw}`;
                if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                    finalSlug = prospect;
                    resolved = true;
                    break;
                }
            }

            // Strategy 4: Short hash if still colliding
            if (!resolved) {
                const hash = product._id.toString().substring(0, 4);
                // Try with keywords + hash
                for (const kw of KEYWORDS) {
                    const prospect = `${baseSlug}-${kw}-${hash}`;
                    if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                        finalSlug = prospect;
                        resolved = true;
                        break;
                    }
                }
                // Fallback: just hash
                if (!resolved) {
                    finalSlug = `${baseSlug}-${hash}`;
                }
            }
        }

        existingSlugs.add(finalSlug);

        // Prepare Update
        if (product.slug !== finalSlug) {
            updates.push({
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { slug: finalSlug } }
                }
            });

            logData.push({
                product_id: product._id,
                product_name: product.name,
                old_slug: product.slug,
                new_slug: finalSlug,
                status: 'UPDATED'
            });

            console.log(`[PLAN] ${product.name} -> ${finalSlug}`);
        } else {
            console.log(`[SKIP] ${product.name} already has correct slug: ${finalSlug}`);
            logData.push({
                product_id: product._id,
                product_name: product.name,
                old_slug: product.slug,
                new_slug: finalSlug,
                status: 'SKIPPED'
            });
        }
    }

    // EXECUTE OR DRY RUN
    if (updates.length > 0) {
        if (!DRY_RUN) {
            console.log(`Executing ${updates.length} updates...`);
            await Product.bulkWrite(updates);
            console.log('Migration committed.');
        } else {
            console.log(`DRY RUN: Would execute ${updates.length} updates.`);
        }
    } else {
        console.log('No updates needed.');
    }

    // WRITE LOG
    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    console.log(`Log written to ${LOG_FILE}`);

    process.exit(0);
};

migrate();
