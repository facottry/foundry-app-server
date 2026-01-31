const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config({ path: '../.env' }); // Adjust path as needed

const updateProduct = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Target specific founder/product
        const founderId = '697db95aa4ce00a2fd022505';

        // Find latest product for this founder or by name 'slikeqa'
        let product = await Product.findOne({ owner_user_id: founderId }).sort({ created_at: -1 });

        if (!product) {
            console.log('Product not found for founder');
            process.exit(1);
        }

        console.log(`Found product: ${product.name}`);

        // Update
        product.name = 'OpenClaw';
        product.tagline = 'The AI that actually does things.';
        product.description = 'Clears your inbox, sends emails, manages your calendar, checks you in for flights. All from WhatsApp, Telegram, or any chat app you already use.';

        // Also regenerate slug
        product.slug = 'openclaw';

        await product.save();
        console.log('Product updated successfully to OpenClaw');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

updateProduct();
