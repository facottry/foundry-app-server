const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' }); // Load .env from appserver

// Models
const OutboundClickSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    click_id: { type: String },
    confirmed: { type: Boolean },
    created_at: { type: Date }
});
const OutboundClick = mongoose.model('OutboundClick', OutboundClickSchema);

const ProductStatsSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    clicks_total: { type: Number }
});
const ProductStats = mongoose.model('ProductStats', ProductStatsSchema);

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clicktory_database');
        console.log('Connected to DB');

        const clicks = await OutboundClick.find({});
        console.log(`Total OutboundClicks: ${clicks.length}`);
        if (clicks.length > 0) {
            console.log('Sample Click:', JSON.stringify(clicks[0], null, 2));
            console.log('Sample Click product_id Type:', typeof clicks[0].product_id);
        }

        const stats = await ProductStats.find({});
        console.log(`Total ProductStats: ${stats.length}`);
        if (stats.length > 0) {
            console.log('Sample Stats:', JSON.stringify(stats[0], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
