const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        unique: true,
    },
    html_content: {
        type: String,
        required: true,
    },
    text_content: {
        type: String,
        required: true,
    },
    cover_image: {
        type: String,
    },
    status: {
        type: String,
        enum: ['DRAFT', 'SCHEDULED', 'SENT'],
        default: 'DRAFT',
        index: true,
    },
    is_ai_generated: {
        type: Boolean,
        default: false,
    },
    version: {
        type: Number,
        default: 1,
    },
    scheduled_at: {
        type: Date,
        index: true,
    },
    sent_at: {
        type: Date,
    },
    stats: {
        sent_count: { type: Number, default: 0 },
        delivered_count: { type: Number, default: 0 }, // Aggregated/Estimated
        open_count: { type: Number, default: 0 }, // Aggregated
        click_count: { type: Number, default: 0 }, // Aggregated
        unsubscribe_count: { type: Number, default: 0 },
        bounce_count: { type: Number, default: 0 },
    }
}, {
    timestamps: true,
});

// Slugify title before save
newsletterSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
    }
    next();
});

module.exports = mongoose.model('Newsletter', newsletterSchema);
