
const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const ContactMessage = require('../models/ContactMessage');
const { asyncHandler, sendSuccess, sendError } = require('../utils/response');

// @route   POST /api/feedback
// @desc    Submit unsubscribe feedback (internally uses Contact Us)
router.post('/', asyncHandler(async (req, res, next) => {
    const { id, reason, message } = req.body;

    if (!id) {
        return sendError(next, 'VALIDATION_ERROR', 'Subscriber ID is required', 400);
    }

    // 1. Find Subscriber
    const subscriber = await Subscriber.findById(id);
    if (!subscriber) {
        return sendError(next, 'NOT_FOUND', 'Subscriber not found', 404);
    }

    // 2. Create Contact Message
    // Reuse Contact Message logic but with "unsubscribe_flow" tag
    const subject = `Unsubscribe Feedback: ${reason || 'General'}`;
    const fullMessage = `
Reason: ${reason}
Message: ${message || 'No details provided'}

Source: Unsubscribe Flow
    `.trim();

    const contactMessage = new ContactMessage({
        name: subscriber.name || 'Subscriber (Unsubscribing)',
        email: subscriber.email,
        subject: subject,
        message: fullMessage,
        tags: ['unsubscribe_flow', 'feedback'],
        priority: 'medium',
        source: 'unsubscribe_flow'
    });

    await contactMessage.save();

    // Send ACK Email (Feedback specific)
    const homepageUrl = `${process.env.PUBLIC_URL || 'https://clicktory.in'}?utm_source=ack_email&utm_medium=email&utm_campaign=feedback_flow`;
    const emailSubject = 'Thanks for your feedback - Clicktory';

    const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
                <h2 style="color: #000; margin: 0;">Thanks for your feedback</h2>
            </div>
            
            <div style="padding: 20px 0; line-height: 1.6;">
                <p>Hello,</p>
                <p>We appreciate you taking the time to share your thoughts. We review every piece of feedback to improve Clicktory.</p>
                <p>If you're looking for something else, maybe check out our latest hotlist?</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${homepageUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Explore Clicktory Hotlist
                </a>
            </div>

            <div style="padding: 20px 0; border-top: 1px solid #eee; margin-top: 20px; font-size: 12px; color: #999; text-align: center;">
                <p>Sent via Clicktory Hotlist • Product Discovery Platform</p>
            </div>
        </div>
    `;

    try {
        const emailText = `Hello,\n\nThanks for your feedback. We review every piece of feedback to improve Clicktory.\n\nExplore Clicktory: ${homepageUrl}`;
        await require('../utils/sendEmail')(subscriber.email, emailSubject, emailText, emailHtml);
    } catch (error) {
        console.error('Failed to send Feedback ACK email:', error);
    }

    sendSuccess(res, {
        message: 'Feedback received. Thank you.',
        success: true
    });
}));

module.exports = router;
