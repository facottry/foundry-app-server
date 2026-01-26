const mongoose = require('mongoose');

const ProductViewSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    session_id: { type: String, required: true, index: true },
    ip_hash: { type: String },
    ua_hash: { type: String },
    country: { type: String },
    city: { type: String },
    browser: { type: String },
    os: { type: String },
    device_type: { type: String }, // mobile, tablet, desktop
    created_at: { type: Date, default: Date.now, index: true }
});

// Compound index for analytics queries
ProductViewSchema.index({ product_id: 1, created_at: -1 });
ProductViewSchema.index({ product_id: 1, session_id: 1 });

module.exports = mongoose.model('ProductView', ProductViewSchema);
