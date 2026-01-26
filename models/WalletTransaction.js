const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // Positive for topup/grant, negative for spend
    reason: { type: String, enum: ['starter', 'topup', 'click_charge'], required: true },
    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
