const mongoose = require('mongoose');
require('dotenv').config();

const find = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Product = mongoose.model('Product', new mongoose.Schema({ name: String, slug: String, status: String, deleted_at: Date }));
        const products = await Product.find({ name: /Claw/i });
        console.log('Found Products:', JSON.stringify(products, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

find();
