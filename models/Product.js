const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    owner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    description: { type: String, required: true },
    website_url: { type: String, required: true },
    logo_url: { type: String },
    screenshots: [{ type: String }],
    categories: [{ type: String }],
    tags: [{ type: String }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    traffic_enabled: { type: Boolean, default: true },

    // Team members
    team_members: [{
        name: { type: String },
        role: { type: String },
        avatar_url: { type: String },
        twitter_url: { type: String },
        linkedin_url: { type: String }
    }],

    // Awards
    awards: [{
        title: { type: String },
        year: { type: Number },
        source: { type: String }
    }],

    // Rating fields
    avg_rating: { type: Number, default: 0 },
    ratings_count: { type: Number, default: 0 },

    // Soft delete
    deleted_at: { type: Date },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Text index for search
ProductSchema.index({
    name: 'text',
    tagline: 'text',
    description: 'text',
    categories: 'text',
    tags: 'text'
});

module.exports = mongoose.model('Product', ProductSchema);
