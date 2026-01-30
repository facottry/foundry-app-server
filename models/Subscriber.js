const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
    email: {
        type: String,
    },
    email_encrypted: {
        type: String,
        required: true,
    },
    email_hash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACTIVE', 'UNSUBSCRIBED'],
        default: 'PENDING',
        index: true,
    },
    confirmation_token: {
        type: String,
        index: true,
    },
    source: {
        type: String,
        default: 'footer',
    },
    unsubscribed_at: {
        type: Date,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Subscriber', subscriberSchema);
