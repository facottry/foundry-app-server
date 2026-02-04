const mongoose = require('mongoose');

const ProductFollowSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    created_at: { type: Date, default: Date.now }
});

// Composite unique index to prevent double following
ProductFollowSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

// Index for counting followers of a product
ProductFollowSchema.index({ product_id: 1 });

// Index for listing products a user follows
ProductFollowSchema.index({ user_id: 1 });

module.exports = mongoose.model('ProductFollow', ProductFollowSchema);
