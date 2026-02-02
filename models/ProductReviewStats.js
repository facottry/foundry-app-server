const mongoose = require('mongoose');

const ProductReviewStatsSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    weighted_rating: { type: Number, default: 0 },
    rating_count: { type: Number, default: 0 },
    review_count: { type: Number, default: 0 },
    sentiment_summary: {
        positive: { type: Number, default: 0 },
        neutral: { type: Number, default: 0 },
        negative: { type: Number, default: 0 }
    },
    weekly_satisfaction: [{
        week: { type: String }, // ISO Week "2026-W05"
        score: { type: Number } // 0-100
    }],
    updated_at: { type: Date, default: Date.now }
});

// Index for efficient retrieval
ProductReviewStatsSchema.index({ product_id: 1 });

module.exports = mongoose.model('ProductReviewStats', ProductReviewStatsSchema);
