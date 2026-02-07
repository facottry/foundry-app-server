/**
 * Email Engine - Main entry point
 * 
 * Usage:
 * const { sendEmail } = require('./email-engine');
 * 
 * await sendEmail({
 *   templateKey: 'WELCOME_FOUNDER',
 *   to: 'founder@example.com',
 *   data: { founderName: 'John' }
 * });
 */

const { renderTemplate } = require('./renderer');
const { send } = require('./sender');

/**
 * Sends a templated email
 * @param {object} options
 * @param {string} options.templateKey - WELCOME_FOUNDER | PRODUCT_SUBMITTED | PRODUCT_APPROVED | DAILY_PRODUCT_REPORT
 * @param {string} options.to - Recipient email address
 * @param {object} options.data - Template variables
 * @returns {Promise<void>}
 */
async function sendEmail({ templateKey, to, data }) {
    try {
        // Render template with data and UTM injection
        const { subject, html } = renderTemplate(templateKey, data);

        // Send email
        await send(to, subject, html);

        console.log(`[EMAIL] Sent ${templateKey} to ${to}`);
    } catch (err) {
        // Log failure but do not throw - email failures must not break core logic
        console.error(`[EMAIL ERROR] Failed to send ${templateKey} to ${to}:`, err.message);
    }
}

module.exports = { sendEmail };
