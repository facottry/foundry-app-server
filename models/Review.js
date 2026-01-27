const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 100 }, // New field
    text: { type: String, required: true, maxlength: 2000 },
    ai_tags: [{ type: String }], // New AI tags
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' }, // New Sentiment
    status: { type: String, enum: ['published', 'hidden', 'flagged'], default: 'published' }, // New Status
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    session_id: { type: String },
    created_at: { type: Date, default: Date.now }
});

// Enforce unique review per user per product
ReviewSchema.index({ product_id: 1, user_id: 1 }, { unique: true, partialFilterExpression: { user_id: { $exists: true } } });

module.exports = mongoose.model('Review', ReviewSchema);
