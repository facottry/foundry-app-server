const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Product = require('../models/Product');

const approveProduct = async () => {
    const slug = process.argv[2];
    if (!slug) {
        console.error('Please provide a slug');
        process.exit(1);
    }

    try {
        const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database';
        await mongoose.connect(db);
        console.log('MongoDB Connected');

        // Allow matching by slug OR ID
        let query = { slug: slug };
        if (slug.match(/^[0-9a-fA-F]{24}$/)) {
            query = { _id: slug };
        }

        const product = await Product.findOne(query);

        if (!product) {
            console.error('Product not found');
            process.exit(1);
        }

        product.status = 'approved';
        await product.save();

        console.log(`SUCCESS: Product "${product.name}" (${product._id}) is now APPROVED.`);
        console.log('It should now appear in search results.');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

approveProduct();
