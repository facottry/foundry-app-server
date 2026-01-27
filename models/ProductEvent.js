const mongoose = require('mongoose');

const ProductEventSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    event_type: {
        type: String,
        enum: ['VIEW', 'CLICK', 'RATE', 'REVIEW'],
        required: true,
        index: true
    },
    session_id: { type: String, index: true },
    ip_hash: { type: String }, // Anonymized IP
    country: { type: String }, // Start with ISO code or full name
    city: { type: String },
    browser: { type: String },
    os: { type: String },
    device_type: { type: String }, // mobile, tablet, desktop
    created_at: { type: Date, default: Date.now, index: true }
});

// Index for aggregation performance
ProductEventSchema.index({ product_id: 1, event_type: 1, created_at: -1 });

module.exports = mongoose.model('ProductEvent', ProductEventSchema);
