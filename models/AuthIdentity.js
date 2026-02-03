const mongoose = require('mongoose');

// Spec: sso_systemdesign.md
const AuthIdentitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    provider: {
        type: String,
        required: true,
        enum: ['google', 'github', 'linkedin', 'password', 'otp'],
        index: true
    },
    providerUserId: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: true,
        lowercase: true,
        trim: true
    },
    verified: {
        type: Boolean,
        default: false,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

AuthIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

module.exports = mongoose.model('AuthIdentity', AuthIdentitySchema);
