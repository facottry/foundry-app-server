const mongoose = require('mongoose');

const ProductNoteSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    content: { type: String, default: '' },
    updated_at: { type: Date, default: Date.now }
});

// One note per product per user
ProductNoteSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('ProductNote', ProductNoteSchema);
