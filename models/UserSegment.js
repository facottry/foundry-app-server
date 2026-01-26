const mongoose = require('mongoose');

const UserSegmentSchema = new mongoose.Schema({
    session_id: { type: String, required: true, index: true },
    segment_tag: {
        type: String,
        enum: ['founder', 'developer', 'marketer', 'student', 'investor', 'designer', 'other'],
        required: true
    },
    confidence: { type: Number, min: 0, max: 1 }, // 0-1 confidence score
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserSegment', UserSegmentSchema);
