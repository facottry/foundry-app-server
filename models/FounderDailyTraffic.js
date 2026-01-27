const mongoose = require('mongoose');

const FounderDailyTrafficSchema = new mongoose.Schema({
    founder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD

    visits: { type: Number, default: 0 },
    credits_consumed: { type: Number, default: 0 }
});

FounderDailyTrafficSchema.index({ founder_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FounderDailyTraffic', FounderDailyTrafficSchema);
