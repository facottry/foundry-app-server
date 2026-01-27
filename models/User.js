const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['CUSTOMER', 'FOUNDER', 'ADMIN'], default: 'CUSTOMER' },
    credits_balance: { type: Number, default: 0 },
    otp_hash: { type: String },
    otp_expires: { type: Date },
    created_at: { type: Date, default: Date.now },
    last_login_at: { type: Date },
    avatar_url: { type: String },
    bio: { type: String },
    company_name: { type: String },
    role_title: { type: String },
    location: { type: String },
    website: { type: String },
    twitter: { type: String },
    linkedin: { type: String },
    timezone: { type: String },
    onboarding_completed: { type: Boolean, default: false },
    preferences: {
        email_notifications: { type: Boolean, default: true },
        product_updates: { type: Boolean, default: true },
        weekly_digest: { type: Boolean, default: true }
    },
    // AI Segmentation
    segments: [{
        label: { type: String },
        confidence: { type: Number }
    }],
    segment_dirty: { type: Boolean, default: false },
    last_segmented_at: { type: Date }
});

module.exports = mongoose.model('User', UserSchema);
