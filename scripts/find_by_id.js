const mongoose = require('mongoose');
require('dotenv').config();

const find = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Product = mongoose.model('Product', new mongoose.Schema({ name: String, slug: String, status: String, deleted_at: Date }));
        const p = await Product.findById("697e1374461c20cdf5f1092e");
        console.log('Product by ID:', JSON.stringify(p, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

find();
