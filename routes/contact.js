const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');
const { tagContactMessage } = require('../utils/openai');

// @route   POST /api/contact
// @desc    Submit contact form (public)
router.post('/', asyncHandler(async (req, res, next) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return sendError(next, 'VALIDATION_ERROR', 'All fields are required', 400);
    }

    // AI tag the message
    const { tags, priority } = await tagContactMessage(subject, message);

    const contactMessage = new ContactMessage({
        name,
        email,
        subject,
        message,
        tags,
        priority
    });

    await contactMessage.save();

    sendSuccess(res, {
        message: 'Thank you for contacting us. We will get back to you soon.',
        id: contactMessage._id
    });
}));

module.exports = router;
