const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    owner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    description: { type: String, required: true },
    website_url: { type: String, required: true },
    logo_url: { type: String },
    logoKey: { type: String }, // New field for R2 key
    externalLogoUrl: { type: String }, // New field for external URL
    screenshots: [{ type: String }],
    screenshotKeys: [{ type: String }], // New field for R2 keys
    categories: [{ type: String }],
    tags: [{ type: String }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    traffic_enabled: { type: Boolean, default: true },

    // Team members
    team_members: [{
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String }, // Fallback if no user_id or for manual entry
        title: { type: String }, // Role title e.g. "CEO"
        role_type: { type: String, enum: ['founder', 'member'], default: 'member' },
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
