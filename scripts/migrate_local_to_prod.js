const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Connection URIs from .env
const LOCAL_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/clicktory_database';
const PROD_URI = process.env.MONGO_URI_PROD;

if (!PROD_URI) {
    console.error('ERROR: MONGO_URI_PROD not found in .env file');
    process.exit(1);
}

// Import Models
const User = require('../models/User');
const Product = require('../models/Product');

// Migration Stats
const stats = {
    users: { total: 0, migrated: 0, skipped: 0, errors: 0 },
    products: { total: 0, migrated: 0, skipped: 0, errors: 0 }
};

async function migrateData() {
    let localConn, prodConn;

    try {
        console.log('=== CLICKTORY DATA MIGRATION: LOCAL → PRODUCTION ===\n');

        // Connect to LOCAL database
        console.log('Connecting to LOCAL database...');
        localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
        console.log('✓ Connected to LOCAL database\n');

        // Connect to PRODUCTION database
        console.log('Connecting to PRODUCTION database...');
        prodConn = await mongoose.createConnection(PROD_URI).asPromise();
        console.log('✓ Connected to PRODUCTION database\n');

        // Create models for both connections
        const LocalUser = localConn.model('User', User.schema);
        const LocalProduct = localConn.model('Product', Product.schema);
        const ProdUser = prodConn.model('User', User.schema);
        const ProdProduct = prodConn.model('Product', Product.schema);

        // ============================================
        // STEP 1: Migrate Users
        // ============================================
        console.log('=== STEP 1: Migrating Users ===');

        const localUsers = await LocalUser.find({
            email: { $not: { $regex: '@foundry.test', $options: 'i' } }
        });

        stats.users.total = localUsers.length;
        console.log(`Found ${localUsers.length} user(s) in LOCAL database (excluding @foundry.test)\n`);

        for (const user of localUsers) {
            try {
                // Check if user already exists in production
                const existingUser = await ProdUser.findOne({ email: user.email });

                if (existingUser) {
                    console.log(`⊘ SKIPPED: User "${user.name}" (${user.email}) - Already exists in production`);
                    stats.users.skipped++;
                    continue;
                }

                // Create new user in production
                const userData = user.toObject();
                delete userData._id; // Let MongoDB generate new _id

                const newUser = new ProdUser(userData);
                await newUser.save();

                console.log(`✓ MIGRATED: User "${user.name}" (${user.email}) - Role: ${user.role}`);
                stats.users.migrated++;

            } catch (error) {
                console.error(`✗ ERROR: Failed to migrate user "${user.name}" (${user.email})`);
                console.error(`  Reason: ${error.message}`);
                stats.users.errors++;
            }
        }

        console.log(`\nUser Migration Complete: ${stats.users.migrated} migrated, ${stats.users.skipped} skipped, ${stats.users.errors} errors\n`);

        // ============================================
        // STEP 2: Migrate Products
        // ============================================
        console.log('=== STEP 2: Migrating Products ===');

        const localProducts = await LocalProduct.find({}).populate('owner_user_id');
        stats.products.total = localProducts.length;
        console.log(`Found ${localProducts.length} product(s) in LOCAL database\n`);

        for (const product of localProducts) {
            try {
                // Skip products owned by test users
                if (product.owner_user_id && product.owner_user_id.email.match(/@foundry\.test/i)) {
                    console.log(`⊘ SKIPPED: Product "${product.name}" - Owned by test user`);
                    stats.products.skipped++;
                    continue;
                }

                // Check if product already exists in production (by slug or name)
                const existingProduct = await ProdProduct.findOne({
                    $or: [
                        { slug: product.slug },
                        { name: product.name }
                    ]
                });

                if (existingProduct) {
                    console.log(`⊘ SKIPPED: Product "${product.name}" (${product.slug || 'no slug'}) - Already exists in production`);
                    stats.products.skipped++;
                    continue;
                }

                // Find the owner in production database
                const ownerEmail = product.owner_user_id ? product.owner_user_id.email : null;
                if (!ownerEmail) {
                    console.log(`⊘ SKIPPED: Product "${product.name}" - No owner found`);
                    stats.products.skipped++;
                    continue;
                }

                const prodOwner = await ProdUser.findOne({ email: ownerEmail });
                if (!prodOwner) {
                    console.log(`⊘ SKIPPED: Product "${product.name}" - Owner not found in production (${ownerEmail})`);
                    stats.products.skipped++;
                    continue;
                }

                // Create new product in production
                const productData = product.toObject();
                delete productData._id; // Let MongoDB generate new _id
                productData.owner_user_id = prodOwner._id; // Use production owner ID

                const newProduct = new ProdProduct(productData);
                await newProduct.save();

                console.log(`✓ MIGRATED: Product "${product.name}" (${product.slug || 'no slug'}) - Owner: ${ownerEmail}`);
                stats.products.migrated++;

            } catch (error) {
                console.error(`✗ ERROR: Failed to migrate product "${product.name}"`);
                console.error(`  Reason: ${error.message}`);
                stats.products.errors++;
            }
        }

        console.log(`\nProduct Migration Complete: ${stats.products.migrated} migrated, ${stats.products.skipped} skipped, ${stats.products.errors} errors\n`);

        // ============================================
        // FINAL SUMMARY
        // ============================================
        console.log('=== MIGRATION SUMMARY ===');
        console.log('\nUsers:');
        console.log(`  Total found: ${stats.users.total}`);
        console.log(`  Migrated: ${stats.users.migrated}`);
        console.log(`  Skipped: ${stats.users.skipped}`);
        console.log(`  Errors: ${stats.users.errors}`);

        console.log('\nProducts:');
        console.log(`  Total found: ${stats.products.total}`);
        console.log(`  Migrated: ${stats.products.migrated}`);
        console.log(`  Skipped: ${stats.products.skipped}`);
        console.log(`  Errors: ${stats.products.errors}`);

        console.log('\n=== MIGRATION COMPLETE ===');

    } catch (error) {
        console.error('\n✗ FATAL ERROR:', error);
        process.exit(1);
    } finally {
        // Close connections
        if (localConn) {
            await localConn.close();
            console.log('\nDisconnected from LOCAL database');
        }
        if (prodConn) {
            await prodConn.close();
            console.log('Disconnected from PRODUCTION database');
        }
    }
}

// Run the migration
console.log('\n⚠️  WARNING: This will migrate data from LOCAL to PRODUCTION database');
console.log('⚠️  Make sure you have reviewed the data before proceeding');
console.log('\nStarting migration in 3 seconds...\n');

setTimeout(() => {
    migrateData()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}, 3000);
