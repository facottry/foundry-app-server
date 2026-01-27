const mongoose = require('mongoose');

const ProductDailyTrafficSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD

    visits: { type: Number, default: 0 },
    unique_visits: { type: Number, default: 0 }, // Based on Ledger entries
    credits_consumed: { type: Number, default: 0 }
});

ProductDailyTrafficSchema.index({ product_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ProductDailyTraffic', ProductDailyTrafficSchema);
