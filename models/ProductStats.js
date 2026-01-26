const mongoose = require('mongoose');

const ProductStatsSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    views_total: { type: Number, default: 0 },
    views_24h: { type: Number, default: 0 },
    clicks_total: { type: Number, default: 0 },
    clicks_24h: { type: Number, default: 0 },
    last_viewed_at: { type: Date },
    last_clicked_at: { type: Date },
    views_24h_reset_at: { type: Date, default: Date.now },
    clicks_24h_reset_at: { type: Date, default: Date.now }
});

// Index for efficient sorting
ProductStatsSchema.index({ product_id: 1 });
ProductStatsSchema.index({ views_total: -1 });
ProductStatsSchema.index({ clicks_total: -1 });
ProductStatsSchema.index({ views_24h: -1 });
ProductStatsSchema.index({ clicks_24h: -1 });

module.exports = mongoose.model('ProductStats', ProductStatsSchema);
