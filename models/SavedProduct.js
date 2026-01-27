const mongoose = require('mongoose');

const SavedProductSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    folder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SavedFolder', default: null }, // Null means root/unsorted
    created_at: { type: Date, default: Date.now }
});

// Prevent saving same product multiple times? 
// Requirement says "User can save product". Usually yes, unique per user per product (or per folder?).
// Let's enforce unique per user+product to simplify "is saved" checks.
SavedProductSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('SavedProduct', SavedProductSchema);
