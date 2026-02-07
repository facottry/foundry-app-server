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

    // Send ACK Email
    const homepageUrl = `${process.env.PUBLIC_URL || 'https://clicktory.in'}?utm_source=ack_email&utm_medium=email&utm_campaign=contact_us`;
    const emailSubject = 'We received your message - Clicktory';

    const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
                <h2 style="color: #000; margin: 0;">Thanks for reaching out!</h2>
            </div>
            
            <div style="padding: 20px 0; line-height: 1.6;">
                <p>Hello ${name},</p>
                <p>We have received your email. Our team will get back to you shortly.</p>
                <p>In the meantime, check out what's trending on Clicktory.</p>
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
        // Simple text fallback
        const emailText = `Hello ${name},\n\nWe have received your email. Our team will get back to you shortly.\n\nExplore Clicktory: ${homepageUrl}`;
        await require('../utils/sendEmail')(email, emailSubject, emailText, emailHtml);
    } catch (error) {
        console.error('Failed to send ACK email:', error);
        // Don't fail the request if email fails
    }

    sendSuccess(res, {
        message: 'Thank you for contacting us. We will get back to you soon.',
        id: contactMessage._id
    });
}));

module.exports = router;
