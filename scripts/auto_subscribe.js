const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Subscriber = require('../models/Subscriber');
const crypto = require('crypto');

// Encryption Logic (Replicated from adminserver/utils/encryption.js for simplicity in script)
// In a real scenario, should import from a shared util if available.
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function hashEmail(email) {
    if (!email) return null;
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

const EMAILS_TO_ADD = [
    'nvnjwl@gmail.com',
    'facottry@gmail.com',
    'nvnjwl2@gmail.com',
    'adarsh13082008@gmail.com',
    'soumilj2017@email.iimcal.ac.in',
    'support@brewquant.com',
    'shobhitjas0505@gmail.com',
    'sr2636463@gmail.com',
    'kwikmedisocial@gmail.com',
    'vkumarg22@gmail.com'
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database')
    .then(async () => {
        console.log('Connected to DB');
        console.log(`DB Name: ${mongoose.connection.name}`);
        console.log(`Host: ${mongoose.connection.host}`);

        if (!ENCRYPTION_KEY) {
            console.error('CRITICAL: ENCRYPTION_KEY is missing in environment variables.');
            process.exit(1);
        }

        for (const email of EMAILS_TO_ADD) {
            try {
                const normalizedEmail = email.trim();
                const emailHash = hashEmail(normalizedEmail);

                // Check by hash
                let subscriber = await Subscriber.findOne({ email_hash: emailHash });

                if (subscriber) {
                    console.log(`[EXISTS] ${normalizedEmail} - ID: ${subscriber._id}`);
                    if (subscriber.status !== 'ACTIVE') {
                        subscriber.status = 'ACTIVE';
                        await subscriber.save();
                        console.log(`   -> Updated status to ACTIVE`);
                    } else {
                        console.log(`   -> Already ACTIVE`);
                    }
                } else {
                    console.log(`[NEW] Creating ${normalizedEmail}...`);
                    subscriber = new Subscriber({
                        email: normalizedEmail, // Optional plain text
                        email_encrypted: encrypt(normalizedEmail),
                        email_hash: emailHash,
                        status: 'ACTIVE',
                        source: 'admin_bulk_script'
                    });
                    await subscriber.save();
                    console.log(`   -> Created Successfully - ID: ${subscriber._id}`);
                }

            } catch (err) {
                console.error(`[ERROR] Failed to process ${email}:`, err.message);
            }
        }

        console.log('Finished processing all emails.');
        mongoose.disconnect();
    })
    .catch(err => console.error('DB Connection Error:', err));
