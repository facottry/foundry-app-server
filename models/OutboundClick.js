const mongoose = require('mongoose');

const OutboundClickSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
    session_id: { type: String, index: true },
    click_id: { type: String, required: true, unique: true },
    ip_hash: { type: String }, // No longer required
    country: { type: String },
    city: { type: String },
    browser: { type: String },
    os: { type: String },
    device_type: { type: String },
    confirmed: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    confirmed_at: { type: Date },
});

module.exports = mongoose.model('OutboundClick', OutboundClickSchema);
