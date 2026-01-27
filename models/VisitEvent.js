const mongoose = require('mongoose');

const VisitEventSchema = new mongoose.Schema({
    visit_id: { type: String, required: true, unique: true, index: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    founder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session_id: { type: String, required: true, index: true }, // from cookie/auth

    // Metadata
    ip_hash: { type: String },
    country: { type: String },
    city: { type: String },
    browser: { type: String },
    os: { type: String },
    device_type: { type: String },

    status: {
        type: String,
        enum: ['INITIATED', 'REDIRECTED', 'CONFIRMED', 'BILLED', 'SKIPPED'],
        default: 'INITIATED'
    },

    visited_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VisitEvent', VisitEventSchema);
