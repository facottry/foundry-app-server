const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    products: [{ type: String }], // Storing product names as editorial references
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Collection', CollectionSchema);
