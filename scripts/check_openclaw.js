const mongoose = require('mongoose');
require('dotenv').config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Product = mongoose.model('Product', new mongoose.Schema({ name: String, slug: String, status: String, deleted_at: Date }));
        const p = await Product.findOne({ slug: 'open-claw' });
        console.log('OpenClaw Status:', p ? p.status : 'NOT FOUND');
        console.log('Deleted At:', p ? p.deleted_at : 'N/A');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
