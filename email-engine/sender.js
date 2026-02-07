/**
 * Email Sender - SMTP/Gmail transport abstraction
 * 
 * Uses nodemailer with Gmail service.
 * Credentials: APP_EMAIL, APP_PASSWORD env vars
 */

const nodemailer = require('nodemailer');

/**
 * Creates and returns the nodemailer transporter
 * @returns {object} - Nodemailer transporter
 */
function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.APP_EMAIL,
            pass: process.env.APP_PASSWORD
        }
    });
}

/**
 * Sends an email using nodemailer
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<void>}
 */
async function send(to, subject, html) {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"Clicktory" <${process.env.APP_EMAIL}>`,
        to,
        subject,
        html
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { send };
