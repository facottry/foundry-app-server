const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    daily_budget: { type: Number, required: true },
    max_cpc: { type: Number, required: true },
    spent_today: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    // Reset spent_today needs to be handled via cron job
});

module.exports = mongoose.model('Campaign', CampaignSchema);
