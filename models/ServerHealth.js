const mongoose = require('mongoose');

const ServerHealthSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        index: true // YYYY-MM-DD
    },
    server: {
        type: String,
        required: true,
        enum: ['adminserver', 'botserver', 'trackserver'],
        index: true
    },
    hits: {
        type: Number,
        default: 0
    },
    success: {
        type: Number,
        default: 0
    },
    fail: {
        type: Number,
        default: 0
    }
});

// Compound index for unique stats per server per day
ServerHealthSchema.index({ date: 1, server: 1 }, { unique: true });

module.exports = mongoose.model('ServerHealth', ServerHealthSchema);
