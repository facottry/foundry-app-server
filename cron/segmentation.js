const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const UserEvent = require('../models/UserEvent');
const { OpenAI } = require('openai');

// Initialize OpenAI (using same env as enhanceProduct)
const getKey = () => process.env.FOUNDRY_OPENAI_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

// No global init to prevent crash if key missing on startup
// const openai = new OpenAI(...) 


const isDev = process.env.SEGMENT_CRON_MODE === 'dev';
const CRON_SCHEDULE = isDev ? '0 * * * *' : '0 2 * * *'; // Hourly (Dev) or 2 AM (Prod)

console.log(`[Segmentation Cron] Initialized. Schedule: ${CRON_SCHEDULE} (${isDev ? 'DEV' : 'PROD'})`);

const runSegmentation = async () => {
    console.log('[Segmentation Cron] Starting job...');

    try {
        // 1. Find dirty users
        const users = await User.find({ segment_dirty: true }).limit(50); // Batch limit
        if (users.length === 0) {
            console.log('[Segmentation Cron] No dirty users found.');
            return;
        }

        console.log(`[Segmentation Cron] Processing ${users.length} users...`);

        for (const user of users) {
            try {
                // 2. Aggregate Data (Last 24h events)
                // Actually, let's take last 7 days for better context
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const events = await UserEvent.find({
                    userId: user._id,
                    timestamp: { $gte: sevenDaysAgo }
                }).sort({ timestamp: -1 }).limit(50);

                // Summarize events
                const behaviors = {
                    viewed_products: events.filter(e => e.type === 'VIEW_PRODUCT').length,
                    saved_products: events.filter(e => e.type === 'SAVE_PRODUCT').length,
                    searches: events.filter(e => e.type === 'SEARCH').map(e => e.target),
                    notes_written: events.filter(e => e.type === 'ADD_NOTE').length,
                    reviews_written: events.filter(e => e.type === 'WRITE_REVIEW').length,
                    is_founder: user.role === 'FOUNDER',
                    bio: user.bio,
                    title: user.role_title
                };

                // 3. AI Call
                // 3. AI Call
                const apiKey = getKey();
                if (!apiKey) {
                    console.log('[Segmentation Cron] No AI Key (FOUNDRY_OPENAI_KEY), skipping user.');
                    continue;
                }
                const openai = new OpenAI({
                    apiKey,
                    // Default OpenAI Base URL
                });

                const isFounder = user.role === 'FOUNDER';

                let rules = '';
                if (isFounder) {
                    rules = `
                    - STRICT REQUIREMENT: You MUST return exactly 3 segments.
                    - First segment MUST be "Founder" (confidence 1.0).
                    - Select 2 additional relevant segments from the list based on profile/behavior.
                    `;
                } else {
                    rules = `
                    - STRICT REQUIREMENT: You MUST return at least 2 segments (minimum 2).
                    - Choose based on profile and behavior.
                    `;
                }

                const prompt = `
                Analyze this user based on their recent behavior and profile on a Product Discovery Platform (Foundry).
                Classify them into segments from this list: [Developer, Founder, Investor, Product Manager, Marketer, Student, Indie Hacker, Recruiter, Designer, SaaS Builder].
                
                ${rules}

                User Profile:
                - Title: ${behaviors.title || 'N/A'}
                - Bio: ${behaviors.bio || 'N/A'}
                - Role: ${user.role}

                Behavior (Last 7 Days):
                - Viewed Products: ${behaviors.viewed_products}
                - Saved Products: ${behaviors.saved_products}
                - Search Queries: ${behaviors.searches.join(', ') || 'None'}
                - Notes Added: ${behaviors.notes_written}
                - Reviews: ${behaviors.reviews_written}

                Return strictly a JSON array of objects with "label" and "confidence" (0-1).
                Example: { "segments": [{"label": "Founder", "confidence": 1.0}, {"label": "Indie Hacker", "confidence": 0.6}, {"label": "Developer", "confidence": 0.5}] }
                `;

                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Use reliable model (or gpt-3.5-turbo)
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" }
                });

                const rawContent = completion.choices[0].message.content;
                let result = [];
                try {
                    result = JSON.parse(rawContent);
                    // Handle if AI returns object with key "segments" instead of array directly
                    if (result.segments) result = result.segments;
                } catch (jsonErr) {
                    console.error(`[Segmentation Cron] JSON Parse Error for User ${user._id}`, jsonErr);
                    continue; // Skip update if AI fails
                }

                // 4. Update User
                user.segments = result;
                user.segment_dirty = false;
                user.last_segmented_at = new Date();
                await user.save();

                console.log(`[Segmentation Cron] Updated User ${user._id}:`, result);

            } catch (userErr) {
                console.error(`[Segmentation Cron] Error processing user ${user._id}:`, userErr.message);
                // Leave dirty = true to retry next time
            }
        }

    } catch (err) {
        console.error('[Segmentation Cron] Fatal Job Error:', err);
    }
};

// Start Cron
cron.schedule(CRON_SCHEDULE, runSegmentation);

module.exports = { runSegmentation }; // Export for manual triggering if needed
