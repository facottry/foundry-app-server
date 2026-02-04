/**
 * founderSlugMigration.js
 * 
 * Production Database Migration Script
 * Purpose: 
 * 1. Normalize and optimize founder profile slugs for SEO (Strict: NO NUMBERS).
 * 2. Migrate ALL 'CUSTOMER' users to 'FOUNDER' role.
 * 3. Fix Generic Names (Founder, Not specified) -> Derived from Email.
 * 4. Ensure ALL users have slugs.
 * 
 * Usage: node scripts/founderSlugMigration.js [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../models/User');
const { generateBaseSlug } = require('../utils/slugGenerator');

// CONFIGURATION
const DRY_RUN = process.argv.includes('--dry-run');
const MONGO_URI = (process.env.MONGO_URI_PROD || process.env.MONGO_URI || '').replace(/"/g, '');
const LOG_FILE = path.join(__dirname, 'founder_slug_migration_log.json');
const REDIRECT_FILE = path.join(__dirname, 'founder_redirect_map.csv');

// RULES CONSTANTS
const GENERIC_NAMES = new Set([
    'founder', 'user', 'admin', 'unknown', 'anonymous', 'test', 'tester', 'demo',
    'not specified', 'not publicly listed', 'no name'
]);

// Public providers where we should use First Last instead of Domain Team
const PUBLIC_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
]);

// Filler words for collision resolution
const FILLER_WORDS = [
    'official', 'profile', 'real', 'hq', 'org', 'net', 'site', 'web', 'online', 'now',
    'connect', 'hub', 'box', 'space', 'zone', 'link', 'bio', 'page', 'home'
];

const MAX_LENGTH = 50;

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

// HELPER: Capitalize Words
const capitalize = (str) => {
    return str.replace(/\b\w/g, c => c.toUpperCase());
};

// HELPER: Derive Name from Email
const deriveNameFromEmail = (email) => {
    if (!email) return 'Founder';

    const [local, domain] = email.split('@');
    if (!domain) return local; // Should not happen for valid email

    if (PUBLIC_EMAIL_PROVIDERS.has(domain.toLowerCase())) {
        // Use local part (john.doe -> John Doe)
        // Remove numbers from local part to be clean?
        const cleanLocal = local.replace(/[0-9]/g, '');
        return capitalize(cleanLocal.replace(/[._-]/g, ' ')).trim() || 'Founder';
    } else {
        // Use Domain (ideaproof.com -> Ideaproof Team)
        const company = domain.split('.')[0];
        return `${capitalize(company)} Team`;
    }
};

// HELPER: Clean Name (Remove numbers and special chars)
const cleanName = (name) => {
    if (!name) return '';
    // Keep only letters and spaces
    let cleaned = name.replace(/[^a-zA-Z\s]/g, '');
    // Collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
};

// HELPER: Get effective name (with Generic check)
const getEffectiveName = (founder) => {
    let name = cleanName(founder.name || '');
    const normalized = name.toLowerCase();

    // If generic or empty after cleaning, try to recover better name
    if (!name || GENERIC_NAMES.has(normalized)) {
        // 1. Try Company Name
        if (founder.company_name && founder.company_name.length > 2) {
            return cleanName(founder.company_name);
        }
        // 2. Derive from Email
        if (founder.email) {
            return deriveNameFromEmail(founder.email);
        }
        // 3. Fallback specifically for generic names
        // If we found it in GENERIC_NAMES, we definitely do NOT want to return it.
        return 'Entrepreneur';
    }
    return name;
};

// HELPER: Get Location Suffix
const getLocationSuffix = (location) => {
    if (!location) return null;
    const loc = location.toLowerCase();
    if (loc.includes('india') || loc.includes('delhi') || loc.includes('bangalore') || loc.includes('mumbai')) return 'india';
    if (loc.includes('usa') || loc.includes('united states') || loc.includes('sf') || loc.includes('ny') || loc.includes('california')) return 'usa';
    if (loc.includes('uk') || loc.includes('london')) return 'uk';
    if (loc.includes('canada') || loc.includes('toronto')) return 'canada';
    if (loc.includes('australia')) return 'australia';
    if (loc.includes('germany') || loc.includes('berlin')) return 'germany';
    return null;
};

// HELPER: Check collision
const isCollision = (slug, existingSlugs) => {
    return existingSlugs.has(slug);
};

// MAIN MIGRATION LOGIC
const migrate = async () => {
    await connectDB();

    console.log('Fetching ALL users to fix Names (No Numbers/Special Chars) and Slugs...');
    // Fetch ALL users
    const users = await User.find({});
    console.log(`Found ${users.length} total users.`);

    const existingSlugs = new Set();
    const updates = [];
    const logData = [];
    const redirectMap = [];

    // Deterministic Sort
    users.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

    for (const user of users) {
        let isModified = false;
        let roleChanged = false;
        let nameChanged = false;

        // 1. Name Cleaning & Fix: Generic -> Derived
        const oldName = user.name;
        const betterName = getEffectiveName(user);

        if (oldName !== betterName) {
            user.name = betterName;
            nameChanged = true;
            isModified = true;
        }

        // 2. Role Migration: CUSTOMER -> FOUNDER
        if (user.role === 'CUSTOMER') {
            user.role = 'FOUNDER';
            roleChanged = true;
            isModified = true;
        }

        // 3. Slug Generation / Normalization (Use NEW name)
        // Note: generateBaseSlug also cleans, but our name is already clean-ish.
        // But generateBaseSlug handles CamelCase -> kebab-case which cleanName doesn't (cleanName keeps spaces).
        let baseSlug = generateBaseSlug(user.name);

        if (baseSlug.length < 2) baseSlug = 'entrepreneur';

        let finalSlug = baseSlug;

        // Resolution Strategy (Strict No Numbers)
        if (isCollision(finalSlug, existingSlugs)) {
            let resolved = false;

            // Strategy 2: Location
            const locSuffix = getLocationSuffix(user.location);
            if (locSuffix) {
                const prospect = `${baseSlug}-${locSuffix}`;
                if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                    finalSlug = prospect;
                    resolved = true;
                }
            }

            // Strategy 3: Filler Words (Loop)
            if (!resolved) {
                for (const filler of FILLER_WORDS) {
                    if (baseSlug.endsWith(`-${filler}`)) continue;

                    const prospect = `${baseSlug}-${filler}`;
                    if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                        finalSlug = prospect;
                        resolved = true;
                        break;
                    }
                }
            }

            // Strategy 4: Location + Filler
            if (!resolved && locSuffix) {
                for (const filler of FILLER_WORDS) {
                    const prospect = `${baseSlug}-${locSuffix}-${filler}`;
                    if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                        finalSlug = prospect;
                        resolved = true;
                        break;
                    }
                }
            }

            // Strategy 5: Double Filler
            if (!resolved) {
                for (const filler1 of FILLER_WORDS) {
                    for (const filler2 of FILLER_WORDS) {
                        if (filler1 === filler2) continue;
                        const prospect = `${baseSlug}-${filler1}-${filler2}`;
                        if (!isCollision(prospect, existingSlugs) && prospect.length <= MAX_LENGTH) {
                            finalSlug = prospect;
                            resolved = true;
                            break;
                        }
                    }
                    if (resolved) break;
                }
            }

            // Fail Safe
            if (!resolved) {
                console.warn(`[WARN] Extreme collision for ${user.name} (${baseSlug}). Using prefix.`);
                const prospect = `the-${baseSlug}-official`;
                if (!isCollision(prospect, existingSlugs)) {
                    finalSlug = prospect;
                    resolved = true;
                } else {
                    // Last resort: letter-based hash
                    const suffix = user._id.toString().substring(20).split('').map(c =>
                        (parseInt(c, 16) % 2 === 0) ? 'x' : 'y'
                    ).join('');
                    finalSlug = `${baseSlug}-unique-${suffix}`;
                }
            }
        }

        existingSlugs.add(finalSlug);

        // Prepare Update Block
        // We ALWAYS update if ANY field changed (slug, name, or role)
        // OR if slug is different (even if name didn't change this run, maybe slug rules changed)
        if (user.slug !== finalSlug || isModified) {

            const updateAction = {
                updateOne: {
                    filter: { _id: user._id },
                    update: {
                        $set: {
                            role: user.role,
                            slug: finalSlug,
                            name: user.name // Persist the fixed name
                        }
                    }
                }
            };
            updates.push(updateAction);

            const status = [];
            if (roleChanged) status.push('ROLE_UPGRADED');
            if (nameChanged) status.push('NAME_FIXED');
            if (user.slug !== finalSlug) status.push('SLUG_UPDATED');

            logData.push({
                user_id: user._id,
                old_name: oldName,
                new_name: user.name,
                old_role: roleChanged ? 'CUSTOMER' : user.role,
                new_role: user.role,
                old_slug: user.slug,
                new_slug: finalSlug,
                status: status.join(', ')
            });

            if (user.slug && user.slug !== finalSlug) {
                redirectMap.push(`${user.slug},${finalSlug}`);
            }

            console.log(`[UPDATE] ${user.name} (was: ${oldName}) -> ${finalSlug} [${status.join(', ')}]`);
        } else {
            console.log(`[SKIP] ${user.name} ok: ${finalSlug}`);
            logData.push({
                user_id: user._id,
                full_name: user.name,
                slug: user.slug,
                status: 'SKIPPED'
            });
        }
    }

    // EXECUTE OR DRY RUN
    if (updates.length > 0) {
        if (!DRY_RUN) {
            console.log(`Executing ${updates.length} updates...`);
            await User.bulkWrite(updates);
            console.log('Migration committed.');
        } else {
            console.log(`DRY RUN: Would execute ${updates.length} updates.`);
        }
    } else {
        console.log('No updates needed.');
    }

    // WRITE LOGS
    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    console.log(`Log written to ${LOG_FILE}`);

    if (redirectMap.length > 0) {
        fs.writeFileSync(REDIRECT_FILE, "old_slug,new_slug\n" + redirectMap.join('\n'));
        console.log(`Redirect map written to ${REDIRECT_FILE}`);
    }

    process.exit(0);
};

migrate();
