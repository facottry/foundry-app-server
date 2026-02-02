const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    owner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true }, // unique and sparse for migration safety
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
    verified_status: { type: String, enum: ['unverified', 'verified'], default: 'unverified' },
    verified_domain: { type: String },
    verified_at: { type: Date },
    verification_method: { type: String }, // 'domain_email_otp'
    verification_otp_hash: { type: String },
    verification_otp_expires: { type: Date },
    pending_verification_email: { type: String },

    traffic_enabled: { type: Boolean, default: true },
    follower_count: { type: Number, default: 0 },
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
    slug: 'text',
    tagline: 'text',
    description: 'text',
    categories: 'text',
    tags: 'text'
});

module.exports = mongoose.model('Product', ProductSchema);
