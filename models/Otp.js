const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true }, // Hashed? Spec "OTP valid for max 5 minutes". Best practice: Hash it.
    createdAt: { type: Date, default: Date.now, expires: 300 } // 5 minutes TTL
});

module.exports = mongoose.model('Otp', OtpSchema);
