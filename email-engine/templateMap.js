/**
 * Template Map - Maps template keys to metadata
 * Each template has: subject, htmlFile, isActive
 */
const templateMap = {
    WELCOME_FOUNDER: {
        subject: '🎉 Welcome to Clicktory - Let\'s Launch Your First Product!',
        htmlFile: 'welcome.html',
        isActive: true
    },
    PRODUCT_SUBMITTED: {
        subject: '📝 Product Submitted - Under Review',
        htmlFile: 'product_submitted.html',
        isActive: true
    },
    PRODUCT_APPROVED: {
        subject: '🚀 Your Product is Live on Clicktory!',
        htmlFile: 'product_approved.html',
        isActive: true
    },
    DAILY_PRODUCT_REPORT: {
        subject: '📊 Daily Product Report - Clicktory',
        htmlFile: 'daily_report.html',
        isActive: true
    }
};

module.exports = templateMap;
