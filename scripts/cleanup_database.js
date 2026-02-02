const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Import Models
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const SavedProduct = require('../models/SavedProduct');
const ProductView = require('../models/ProductView');
const OutboundClick = require('../models/OutboundClick');
const WalletTransaction = require('../models/WalletTransaction');
const VisitCreditLedger = require('../models/VisitCreditLedger');
const VisitEvent = require('../models/VisitEvent');
const ProductEvent = require('../models/ProductEvent');
const ProductStats = require('../models/ProductStats');
const ProductDailyTraffic = require('../models/ProductDailyTraffic');
const FounderDailyTraffic = require('../models/FounderDailyTraffic');
const ProductNote = require('../models/ProductNote');
const FolderNote = require('../models/FolderNote');
const SavedFolder = require('../models/SavedFolder');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foundry';

async function cleanupDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB');

        // Step 1: Find all test founders
        console.log('\n=== Step 1: Finding test founders ===');
        const testFounders = await User.find({
            email: { $regex: '@foundry.test', $options: 'i' }
        });

        if (testFounders.length === 0) {
            console.log('No test founders found with @foundry.test emails');
            await mongoose.connection.close();
            return;
        }

        console.log(`Found ${testFounders.length} test founder(s):`);
        testFounders.forEach(founder => {
            console.log(`  - ${founder.name} (${founder.email})`);
        });

        const founderIds = testFounders.map(f => f._id);

        // Step 2: Find all products owned by test founders
        console.log('\n=== Step 2: Finding products owned by test founders ===');
        const testProducts = await Product.find({
            owner_user_id: { $in: founderIds }
        });

        console.log(`Found ${testProducts.length} product(s) to delete`);
        testProducts.forEach(product => {
            console.log(`  - ${product.name} (${product.slug || 'no slug'})`);
        });

        const productIds = testProducts.map(p => p._id);

        // Step 3: Delete all related data
        console.log('\n=== Step 3: Deleting related data ===');

        // Reviews
        const reviewsDeleted = await Review.deleteMany({
            $or: [
                { product_id: { $in: productIds } },
                { user_id: { $in: founderIds } }
            ]
        });
        console.log(`Deleted ${reviewsDeleted.deletedCount} review(s)`);

        // Saved Products
        const savedDeleted = await SavedProduct.deleteMany({
            $or: [
                { product_id: { $in: productIds } },
                { user_id: { $in: founderIds } }
            ]
        });
        console.log(`Deleted ${savedDeleted.deletedCount} saved product(s)`);

        // Product Views
        const viewsDeleted = await ProductView.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${viewsDeleted.deletedCount} product view(s)`);

        // Outbound Clicks
        const clicksDeleted = await OutboundClick.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${clicksDeleted.deletedCount} outbound click(s)`);

        // Wallet Transactions
        const transactionsDeleted = await WalletTransaction.deleteMany({
            user_id: { $in: founderIds }
        });
        console.log(`Deleted ${transactionsDeleted.deletedCount} wallet transaction(s)`);

        // Visit Credit Ledger
        const ledgerDeleted = await VisitCreditLedger.deleteMany({
            user_id: { $in: founderIds }
        });
        console.log(`Deleted ${ledgerDeleted.deletedCount} visit credit ledger(s)`);

        // Visit Events
        const visitEventsDeleted = await VisitEvent.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${visitEventsDeleted.deletedCount} visit event(s)`);

        // Product Events
        const productEventsDeleted = await ProductEvent.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${productEventsDeleted.deletedCount} product event(s)`);

        // Product Stats
        const statsDeleted = await ProductStats.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${statsDeleted.deletedCount} product stat(s)`);

        // Product Daily Traffic
        const productTrafficDeleted = await ProductDailyTraffic.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${productTrafficDeleted.deletedCount} product daily traffic record(s)`);

        // Founder Daily Traffic
        const founderTrafficDeleted = await FounderDailyTraffic.deleteMany({
            user_id: { $in: founderIds }
        });
        console.log(`Deleted ${founderTrafficDeleted.deletedCount} founder daily traffic record(s)`);

        // Product Notes
        const productNotesDeleted = await ProductNote.deleteMany({
            product_id: { $in: productIds }
        });
        console.log(`Deleted ${productNotesDeleted.deletedCount} product note(s)`);

        // Folder Notes
        const folderNotesDeleted = await FolderNote.deleteMany({
            user_id: { $in: founderIds }
        });
        console.log(`Deleted ${folderNotesDeleted.deletedCount} folder note(s)`);

        // Saved Folders
        const foldersDeleted = await SavedFolder.deleteMany({
            user_id: { $in: founderIds }
        });
        console.log(`Deleted ${foldersDeleted.deletedCount} saved folder(s)`);

        // Step 4: Delete products
        console.log('\n=== Step 4: Deleting products ===');
        const productsDeleted = await Product.deleteMany({
            owner_user_id: { $in: founderIds }
        });
        console.log(`Deleted ${productsDeleted.deletedCount} product(s)`);

        // Step 5: Delete founders
        console.log('\n=== Step 5: Deleting test founders ===');
        const foundersDeleted = await User.deleteMany({
            email: { $regex: '@foundry.test', $options: 'i' }
        });
        console.log(`Deleted ${foundersDeleted.deletedCount} test founder(s)`);

        // Summary
        console.log('\n=== CLEANUP COMPLETE ===');
        console.log('Summary:');
        console.log(`  - Founders deleted: ${foundersDeleted.deletedCount}`);
        console.log(`  - Products deleted: ${productsDeleted.deletedCount}`);
        console.log(`  - Reviews deleted: ${reviewsDeleted.deletedCount}`);
        console.log(`  - Saved products deleted: ${savedDeleted.deletedCount}`);
        console.log(`  - Product views deleted: ${viewsDeleted.deletedCount}`);
        console.log(`  - Outbound clicks deleted: ${clicksDeleted.deletedCount}`);
        console.log(`  - Wallet transactions deleted: ${transactionsDeleted.deletedCount}`);
        console.log(`  - Visit credit ledgers deleted: ${ledgerDeleted.deletedCount}`);
        console.log(`  - Visit events deleted: ${visitEventsDeleted.deletedCount}`);
        console.log(`  - Product events deleted: ${productEventsDeleted.deletedCount}`);
        console.log(`  - Product stats deleted: ${statsDeleted.deletedCount}`);
        console.log(`  - Product daily traffic deleted: ${productTrafficDeleted.deletedCount}`);
        console.log(`  - Founder daily traffic deleted: ${founderTrafficDeleted.deletedCount}`);
        console.log(`  - Product notes deleted: ${productNotesDeleted.deletedCount}`);
        console.log(`  - Folder notes deleted: ${folderNotesDeleted.deletedCount}`);
        console.log(`  - Saved folders deleted: ${foldersDeleted.deletedCount}`);

        await mongoose.connection.close();
        console.log('\nDisconnected from MongoDB');

    } catch (error) {
        console.error('Error during cleanup:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

// Run the cleanup
cleanupDatabase();
