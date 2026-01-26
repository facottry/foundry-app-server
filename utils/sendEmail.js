const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.APP_EMAIL,
                pass: process.env.APP_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.APP_EMAIL,
            to,
            subject,
            text
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent to ' + to);
    } catch (err) {
        console.error('Email send error:', err);
        throw err;
    }
};

module.exports = sendEmail;
