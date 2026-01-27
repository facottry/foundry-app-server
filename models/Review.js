const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    session_id: { type: String },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);
