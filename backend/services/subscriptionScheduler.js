import Subscription from '../models/Subscription.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendSubscriptionExpiryReminderEmail } from './emailService.js';
import { logger } from '../utils/logger.js';

let schedulerInterval = null;

/**
 * Determine the expiry reminder stage based on consistent UTC time difference
 * 
 * Stages:
 * - 'EXPIRED': msRemaining <= 0
 * - '1_DAY':   0 < msRemaining <= 24 hours (daysRemaining <= 1)
 * - '3_DAYS':  24 hours < msRemaining <= 72 hours (1 < daysRemaining <= 3)
 * - '7_DAYS':  72 hours < msRemaining <= 168 hours (3 < daysRemaining <= 7)
 * - null:      msRemaining > 168 hours (> 7 days)
 * 
 * @param {Date|string} expiryDate 
 * @param {Date|number} [now=new Date()]
 * @returns {Object|null}
 */
export const getSubscriptionExpiryStage = (expiryDate, now = new Date()) => {
  if (!expiryDate) return null;

  const expiryMs = new Date(expiryDate).getTime();
  if (isNaN(expiryMs)) return null;

  const nowMs = new Date(now).getTime();
  const msRemaining = expiryMs - nowMs;

  if (msRemaining <= 0) {
    return {
      stage: 'EXPIRED',
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      title: 'EXACTSPARE Subscription Expired',
      message: 'Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access.',
      notificationType: 'SUBSCRIPTION_EXPIRED'
    };
  }

  // Calculate integer days remaining using consistent ceiling formula
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 1) {
    return {
      stage: '1_DAY',
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: 1,
      title: 'Subscription Expiring Tomorrow',
      message: 'Your subscription expires tomorrow. Renew now.',
      notificationType: 'SUBSCRIPTION_EXPIRING'
    };
  }

  if (daysRemaining <= 3) {
    return {
      stage: '3_DAYS',
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      title: 'Subscription Expiry Reminder: 3 Days Remaining',
      message: 'Your subscription expires in 3 days. Please renew your plan.',
      notificationType: 'SUBSCRIPTION_EXPIRING'
    };
  }

  if (daysRemaining <= 7) {
    return {
      stage: '7_DAYS',
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      title: 'Subscription Expiry Reminder: 7 Days Remaining',
      message: 'Your EXACTSPARE subscription expires in 7 days. Renew now to avoid interruption.',
      notificationType: 'SUBSCRIPTION_EXPIRING'
    };
  }

  return null;
};

/**
 * Core Expiry Check & Notification Dispatch Engine
 * 
 * Completely idempotent:
 * - Avoids sending duplicate reminders for the same owner, subscription, and reminder stage.
 * - Stores reminder stages in `subscription.remindersSent` array and unique `notificationKey` on `Notification`.
 * - Safe to rerun repeatedly or across server restarts.
 * 
 * @param {Object} [filter={}] Optional filter, e.g. { ownerId }
 * @returns {Promise<Object>} Summary statistics of processed subscriptions
 */
export const checkAndProcessSubscriptionExpirations = async (filter = {}) => {
  const now = new Date();
  const stats = {
    checked: 0,
    expiredTransitions: 0,
    remindersSent: {
      stage7Days: 0,
      stage3Days: 0,
      stage1Day: 0,
      stageExpired: 0
    },
    skippedDuplicates: 0,
    errors: 0
  };

  try {
    // -------------------------------------------------------------
    // STEP 1: Process and transition already expired subscriptions
    // -------------------------------------------------------------
    const expiredActiveSubs = await Subscription.find({
      ...filter,
      status: 'ACTIVE',
      expiryDate: { $lte: now }
    }).populate('ownerId', 'name email phone');

    for (const sub of expiredActiveSubs) {
      stats.checked++;
      try {
        sub.status = 'EXPIRED';
        sub.history.push({
          status: 'EXPIRED',
          changedBy: null,
          note: `Subscription automatically expired on ${now.toISOString()}. Access revoked until renewal is verified.`,
          timestamp: now
        });
        stats.expiredTransitions++;
        await User.findByIdAndUpdate(sub.ownerId?._id || sub.ownerId, { hasActiveSubscription: false });

        const notificationKey = `SUB_EXPIRY_${sub._id}_EXPIRED`;
        const alreadySent = Array.isArray(sub.remindersSent) && sub.remindersSent.includes('EXPIRED');
        const notificationExists = alreadySent || (await Notification.exists({ notificationKey }));

        if (!notificationExists) {
          const owner = sub.ownerId;
          const ownerId = owner?._id || sub.ownerId;
          const ownerEmail = owner?.email;
          const ownerName = owner?.name;

          // Dispatch in-app notification
          await Notification.create({
            recipientId: ownerId,
            title: 'EXACTSPARE Subscription Expired',
            message: 'Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access.',
            type: 'SUBSCRIPTION_EXPIRED',
            relatedId: sub._id,
            notificationKey
          });

          // Dispatch email if recipient is valid
          if (ownerEmail) {
            await sendSubscriptionExpiryReminderEmail(
              ownerEmail,
              ownerName,
              sub.planName,
              sub.expiryDate,
              'EXPIRED',
              0
            ).catch(err => logger.error('[Scheduler] Email delivery error:', err.message));
          }

          if (!sub.remindersSent.includes('EXPIRED')) {
            sub.remindersSent.push('EXPIRED');
          }
          sub.lastReminderAt = now;
          stats.remindersSent.stageExpired++;
        } else {
          stats.skippedDuplicates++;
        }

        await sub.save();
      } catch (err) {
        stats.errors++;
        logger.error(`[Scheduler] Error expiring subscription ${sub._id}:`, err.message);
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Process active subscriptions approaching expiry
    // (Expiring in 7 days, 3 days, or 1 day)
    // -------------------------------------------------------------
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const approachingSubs = await Subscription.find({
      ...filter,
      status: 'ACTIVE',
      expiryDate: { $gt: now, $lte: sevenDaysFromNow }
    }).populate('ownerId', 'name email phone');

    for (const sub of approachingSubs) {
      stats.checked++;
      try {
        const stageInfo = getSubscriptionExpiryStage(sub.expiryDate, now);
        if (!stageInfo || stageInfo.stage === 'EXPIRED') {
          continue;
        }

        const notificationKey = `SUB_EXPIRY_${sub._id}_${stageInfo.stage}`;
        const alreadySent = Array.isArray(sub.remindersSent) && sub.remindersSent.includes(stageInfo.stage);
        const notificationExists = alreadySent || (await Notification.exists({ notificationKey }));

        if (notificationExists) {
          stats.skippedDuplicates++;
          continue;
        }

        const owner = sub.ownerId;
        const ownerId = owner?._id || sub.ownerId;
        const ownerEmail = owner?.email;
        const ownerName = owner?.name;

        // Create in-app notification
        await Notification.create({
          recipientId: ownerId,
          title: stageInfo.title,
          message: stageInfo.message,
          type: stageInfo.notificationType,
          relatedId: sub._id,
          notificationKey
        });

        // Send email
        if (ownerEmail) {
          await sendSubscriptionExpiryReminderEmail(
            ownerEmail,
            ownerName,
            sub.planName,
            sub.expiryDate,
            stageInfo.stage,
            stageInfo.daysRemaining
          ).catch(err => logger.error('[Scheduler] Email delivery error:', err.message));
        }

        if (!Array.isArray(sub.remindersSent)) {
          sub.remindersSent = [];
        }
        sub.remindersSent.push(stageInfo.stage);
        sub.lastReminderAt = now;
        await sub.save();

        if (stageInfo.stage === '7_DAYS') stats.remindersSent.stage7Days++;
        if (stageInfo.stage === '3_DAYS') stats.remindersSent.stage3Days++;
        if (stageInfo.stage === '1_DAY') stats.remindersSent.stage1Day++;
      } catch (err) {
        stats.errors++;
        logger.error(`[Scheduler] Error processing reminder for sub ${sub._id}:`, err.message);
      }
    }

    logger.info(
      `[Subscription Scheduler] Run completed: Checked ${stats.checked}, ` +
      `Expired ${stats.expiredTransitions}, Reminders Sent (7d: ${stats.remindersSent.stage7Days}, ` +
      `3d: ${stats.remindersSent.stage3Days}, 1d: ${stats.remindersSent.stage1Day}, ` +
      `Exp: ${stats.remindersSent.stageExpired}), Skipped Duplicates: ${stats.skippedDuplicates}`
    );

    return stats;
  } catch (error) {
    logger.error('[Subscription Scheduler] Unhandled error during expiry check:', error);
    stats.errors++;
    return stats;
  }
};

/**
 * Start the recurring subscription scheduler
 * 
 * @param {number} [intervalMs=3600000] Interval in milliseconds (default: 1 hour)
 */
export const startSubscriptionScheduler = (intervalMs = 60 * 60 * 1000) => {
  if (schedulerInterval) {
    return;
  }

  logger.info(`[Subscription Scheduler] Service initialized (Check interval: ${intervalMs / 1000}s)`);

  // Run an initial check 5 seconds after startup
  setTimeout(() => {
    checkAndProcessSubscriptionExpirations().catch(err =>
      logger.error('[Subscription Scheduler] Startup check error:', err)
    );
  }, 5000);

  // Set recurring interval
  schedulerInterval = setInterval(() => {
    checkAndProcessSubscriptionExpirations().catch(err =>
      logger.error('[Subscription Scheduler] Interval check error:', err)
    );
  }, intervalMs);

  // Allow Node process to terminate without waiting for this interval
  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }
};

/**
 * Stop the recurring subscription scheduler cleanly
 */
export const stopSubscriptionScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[Subscription Scheduler] Service stopped gracefully.');
  }
};

export default {
  getSubscriptionExpiryStage,
  checkAndProcessSubscriptionExpirations,
  startSubscriptionScheduler,
  stopSubscriptionScheduler
};
