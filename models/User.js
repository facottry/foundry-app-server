const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, alias: 'primaryEmail' }, // Alias for spec compatibility
    slug: { type: String, unique: true, sparse: true }, // URL friendly slug
    password_hash: { type: String, required: false, alias: 'passwordHash' }, // Alias for spec compatibility

    phone: { type: String, unique: true, sparse: true }, // Sparse unique index
    role: { type: String, enum: ['CUSTOMER', 'FOUNDER', 'ADMIN'], default: 'CUSTOMER' },
    credits_balance: { type: Number, default: 0 },
    otp_hash: { type: String },
    otp_expires: { type: Date },
    phone_otp_hash: { type: String },
    phone_otp_expires: { type: Date },
    created_at: { type: Date, default: Date.now },
    last_login_at: { type: Date },
    avatar_url: { type: String },
    bio: { type: String },
    company_name: { type: String },
    role_title: { type: String },
    city: { type: String }, // Inferred from IP or User set
    location: { type: String },
    website: { type: String },
    twitter: { type: String },
    linkedin: { type: String },
    timezone: { type: String },
    onboarding_completed: { type: Boolean, default: false },
    profileImageKey: { type: String }, // New field for R2 key
    preferences: {
        email_notifications: { type: Boolean, default: true },
        product_updates: { type: Boolean, default: true },
        weekly_digest: { type: Boolean, default: true }
    },
    // Verification
    verified: { type: Boolean, default: false },

    // Integration Settings
    staffiumEnabled: { type: Boolean, default: false },
    staffiumExpiresAt: { type: Date },

    // AI Segmentation
    segments: [{
        label: { type: String },
        confidence: { type: Number }
    }],

    // Phase 2: Engagement - Follow System
    follows: {
        productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
        categoryIds: [{ type: String }] // Categories use slug or string ID
    },
    segment_dirty: { type: Boolean, default: false },
    last_segmented_at: { type: Date }
});

module.exports = mongoose.model('User', UserSchema);
