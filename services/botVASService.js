/**
 * BotVAS Service - Credit enforcement and VAS state management
 * 
 * Credit Rules:
 * - 30 credits per month
 * - Deduct on enable
 * - Deduct on monthly renewal
 * - Auto-disable on insufficient credits
 * - No negative balance
 */

const BotVAS = require('../models/BotVAS');
const User = require('../models/User');

const MONTHLY_CREDIT_COST = 30;

class BotVASService {
    /**
     * Check if user is eligible for bot access
     * Returns eligibility status and reason
     */
    async checkEligibility(userId) {
        const user = await User.findById(userId).select('role credits wallet_balance');

        if (!user) {
            return { eligible: false, reason: 'user_not_found' };
        }

        // Check role
        if (!['FOUNDER', 'ADMIN'].includes(user.role)) {
            return { eligible: false, reason: 'invalid_role' };
        }

        // Get VAS state
        let vas = await BotVAS.findOne({ user_id: userId });

        // VAS not enabled
        if (!vas || !vas.enabled) {
            return {
                eligible: false,
                reason: vas?.disable_reason || 'not_enabled',
                credits: user.credits || user.wallet_balance || 0,
                cost: MONTHLY_CREDIT_COST
            };
        }

        // Check credits
        const credits = user.credits || user.wallet_balance || 0;
        if (credits < MONTHLY_CREDIT_COST) {
            // Auto-disable due to low credits
            await this.disable(userId, 'low_credits');
            return {
                eligible: false,
                reason: 'low_credits',
                credits,
                cost: MONTHLY_CREDIT_COST
            };
        }

        return {
            eligible: true,
            reason: null,
            credits,
            nextDeduction: vas.next_deduction_at
        };
    }

    /**
     * Enable bot VAS for user
     * Deducts initial 30 credits
     */
    async enable(userId) {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: 'user_not_found' };
        }

        if (!['FOUNDER', 'ADMIN'].includes(user.role)) {
            return { success: false, error: 'invalid_role' };
        }

        const credits = user.credits || user.wallet_balance || 0;
        if (credits < MONTHLY_CREDIT_COST) {
            return { success: false, error: 'insufficient_credits', required: MONTHLY_CREDIT_COST, available: credits };
        }

        // Deduct credits
        const deducted = await this._deductCredits(userId, MONTHLY_CREDIT_COST, 'bot_vas_enable');
        if (!deducted) {
            return { success: false, error: 'deduction_failed' };
        }

        // Calculate next deduction (30 days from now)
        const now = new Date();
        const nextDeduction = new Date(now);
        nextDeduction.setDate(nextDeduction.getDate() + 30);

        // Create or update VAS record
        const vas = await BotVAS.findOneAndUpdate(
            { user_id: userId },
            {
                enabled: true,
                last_deduction_at: now,
                next_deduction_at: nextDeduction,
                enabled_at: now,
                disable_reason: null,
                disabled_at: null
            },
            { upsert: true, new: true }
        );

        console.log(`[BotVAS] Enabled for user ${userId}. Next deduction: ${nextDeduction.toISOString()}`);

        return { success: true, vas, nextDeduction };
    }

    /**
     * Disable bot VAS for user
     */
    async disable(userId, reason = 'manual') {
        const now = new Date();

        const vas = await BotVAS.findOneAndUpdate(
            { user_id: userId },
            {
                enabled: false,
                disable_reason: reason,
                disabled_at: now,
                next_deduction_at: null
            },
            { new: true }
        );

        if (vas) {
            console.log(`[BotVAS] Disabled for user ${userId}. Reason: ${reason}`);
        }

        return { success: true, vas };
    }

    /**
     * Get VAS status for user
     */
    async getStatus(userId) {
        const user = await User.findById(userId).select('role credits wallet_balance');
        const vas = await BotVAS.findOne({ user_id: userId });

        const credits = user?.credits || user?.wallet_balance || 0;

        return {
            enabled: vas?.enabled || false,
            status: vas?.enabled ? 'active' : (vas?.disable_reason === 'low_credits' ? 'insufficient_credits' : 'disabled'),
            disableReason: vas?.disable_reason || null,
            lastDeduction: vas?.last_deduction_at || null,
            nextDeduction: vas?.next_deduction_at || null,
            credits,
            monthlyCost: MONTHLY_CREDIT_COST,
            canEnable: credits >= MONTHLY_CREDIT_COST
        };
    }

    /**
     * Process monthly deductions (called by cron)
     */
    async processMonthlyDeductions() {
        const now = new Date();

        // Find all enabled VAS records due for deduction
        const dueRecords = await BotVAS.find({
            enabled: true,
            next_deduction_at: { $lte: now }
        });

        console.log(`[BotVAS Cron] Processing ${dueRecords.length} due deductions`);

        const results = {
            processed: 0,
            success: 0,
            failed: 0,
            disabled: []
        };

        for (const vas of dueRecords) {
            results.processed++;

            const user = await User.findById(vas.user_id);
            const credits = user?.credits || user?.wallet_balance || 0;

            if (credits < MONTHLY_CREDIT_COST) {
                // Insufficient credits - disable
                await this.disable(vas.user_id, 'low_credits');
                results.failed++;
                results.disabled.push(vas.user_id.toString());
                console.log(`[BotVAS Cron] Disabled user ${vas.user_id} - insufficient credits`);
                continue;
            }

            // Deduct credits
            const deducted = await this._deductCredits(vas.user_id, MONTHLY_CREDIT_COST, 'bot_vas_monthly');

            if (!deducted) {
                await this.disable(vas.user_id, 'low_credits');
                results.failed++;
                results.disabled.push(vas.user_id.toString());
                continue;
            }

            // Update next deduction date
            const nextDeduction = new Date(now);
            nextDeduction.setDate(nextDeduction.getDate() + 30);

            await BotVAS.findByIdAndUpdate(vas._id, {
                last_deduction_at: now,
                next_deduction_at: nextDeduction
            });

            results.success++;
            console.log(`[BotVAS Cron] Deducted ${MONTHLY_CREDIT_COST} credits from user ${vas.user_id}`);
        }

        console.log(`[BotVAS Cron] Complete. Success: ${results.success}, Failed: ${results.failed}`);
        return results;
    }

    /**
     * Deduct credits from user wallet
     */
    async _deductCredits(userId, amount, reason) {
        try {
            // Try credits field first, then wallet_balance
            let result = await User.findOneAndUpdate(
                { _id: userId, credits: { $gte: amount } },
                {
                    $inc: { credits: -amount },
                    $push: {
                        transactions: {
                            type: 'deduction',
                            amount: -amount,
                            reason,
                            created_at: new Date()
                        }
                    }
                },
                { new: true }
            );

            if (!result) {
                // Try wallet_balance field
                result = await User.findOneAndUpdate(
                    { _id: userId, wallet_balance: { $gte: amount } },
                    {
                        $inc: { wallet_balance: -amount },
                        $push: {
                            transactions: {
                                type: 'deduction',
                                amount: -amount,
                                reason,
                                created_at: new Date()
                            }
                        }
                    },
                    { new: true }
                );
            }

            return !!result;
        } catch (error) {
            console.error('[BotVAS] Credit deduction error:', error);
            return false;
        }
    }
}

module.exports = new BotVASService();
