/**
 * BotVAS Cron Job - Monthly credit deduction
 * 
 * Schedule: Runs daily at 00:05 UTC
 * Purpose: Process monthly VAS deductions for enabled bots
 * 
 * This job:
 * 1. Finds all enabled VAS records due for deduction
 * 2. Attempts credit deduction
 * 3. Disables on failure
 * 4. Updates next deduction date on success
 */

const cron = require('node-cron');
const botVASService = require('../services/botVASService');

/**
 * Initialize cron job
 */
function initBotVASCron() {
    // Run daily at 00:05 UTC
    cron.schedule('5 0 * * *', async () => {
        console.log('[BotVAS Cron] Starting monthly deduction job...');

        try {
            const results = await botVASService.processMonthlyDeductions();

            console.log('[BotVAS Cron] Job complete:', {
                processed: results.processed,
                success: results.success,
                failed: results.failed
            });

        } catch (error) {
            console.error('[BotVAS Cron] Job failed:', error);
        }
    }, {
        timezone: 'UTC'
    });

    console.log('[BotVAS Cron] Scheduled daily at 00:05 UTC');
}

/**
 * Manual trigger for testing
 */
async function runManually() {
    console.log('[BotVAS Cron] Manual trigger...');
    return await botVASService.processMonthlyDeductions();
}

module.exports = {
    initBotVASCron,
    runManually
};
