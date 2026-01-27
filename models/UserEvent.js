const mongoose = require('mongoose');

const UserEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['VIEW_PRODUCT', 'CLICK_WEBSITE', 'SAVE_PRODUCT', 'CREATE_FOLDER', 'ADD_NOTE', 'SEARCH', 'WRITE_REVIEW'],
        index: true
    },
    target: { type: String }, // Product ID, Search Query, or Folder Name
    metadata: { type: mongoose.Schema.Types.Mixed }, // Flexible payload
    timestamp: { type: Date, default: Date.now, index: true } // Index for time-range queries
});

// Compound index for efficient querying of a user's recent events
UserEventSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('UserEvent', UserEventSchema);
