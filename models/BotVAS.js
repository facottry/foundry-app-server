/**
 * BotVAS Model - Founder AI Bot Value Added Service State
 * 
 * Tracks:
 * - enabled/disabled status
 * - last/next deduction dates
 * - disable reason (manual | low_credits)
 */

const mongoose = require('mongoose');

const BotVASSchema = new mongoose.Schema({
    // Link to founder user
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    // VAS state
    enabled: {
        type: Boolean,
        default: false
    },

    // Deduction tracking
    last_deduction_at: {
        type: Date,
        default: null
    },
    next_deduction_at: {
        type: Date,
        default: null
    },

    // Disable reason
    disable_reason: {
        type: String,
        enum: ['manual', 'low_credits', null],
        default: null
    },

    // Audit
    enabled_at: {
        type: Date,
        default: null
    },
    disabled_at: {
        type: Date,
        default: null
    },

    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
BotVASSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});

// Indexes for cron queries
BotVASSchema.index({ enabled: 1, next_deduction_at: 1 });

module.exports = mongoose.model('BotVAS', BotVASSchema);
