const mongoose = require('mongoose');

// One row per unique billable visit
const VisitCreditLedgerSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    founder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    session_id: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD

    visit_id: { type: String, required: true },
    credits_deducted: { type: Number, default: 1 },

    created_at: { type: Date, default: Date.now }
});

// Compound unique index enables "1 credit per user per day" rule
VisitCreditLedgerSchema.index({ product_id: 1, session_id: 1, date: 1 }, { unique: true });
VisitCreditLedgerSchema.index({ founder_id: 1, date: 1 });

module.exports = mongoose.model('VisitCreditLedger', VisitCreditLedgerSchema);
