const cron = require('node-cron');
const { collectSnapshots, cleanupOldData } = require('./collector');
const { generateDigest } = require('./analyzer');
const { sendDigestNotification } = require('./notifier');
const { markNotificationSent } = require('../db/digests');

let snapshotJob = null;
let cleanupJob = null;
let digestJob = null;
let weeklyDigestJob = null;
let isRunning = false;

/**
 * Start the scheduler
 */
function startScheduler() {
    if (isRunning) {
        console.log('Scheduler already running');
        return;
    }

    const snapshotInterval = parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30;
    const digestTime = process.env.DIGEST_TIME || '07:00';
    const [digestHour, digestMinute] = digestTime.split(':').map(Number);

    // Schedule snapshot collection (every N minutes)
    const snapshotCron = `*/${snapshotInterval} * * * *`;
    snapshotJob = cron.schedule(snapshotCron, async () => {
        console.log(`[Scheduler] Running snapshot collection...`);
        try {
            const result = await collectSnapshots();
            if (!result.skipped) {
                console.log(`[Scheduler] Collected ${result.collected} snapshots`);
            }
        } catch (error) {
            console.error('[Scheduler] Snapshot collection failed:', error.message);
        }
    });

    // Schedule daily cleanup at 3 AM
    cleanupJob = cron.schedule('0 3 * * *', async () => {
        console.log('[Scheduler] Running daily cleanup...');
        try {
            const result = await cleanupOldData();
            console.log(`[Scheduler] Cleanup complete: ${result.deleted} old snapshots removed`);
        } catch (error) {
            console.error('[Scheduler] Cleanup failed:', error.message);
        }
    });

    // Schedule daily digest generation
    const digestCron = `${digestMinute} ${digestHour} * * *`;
    digestJob = cron.schedule(digestCron, async () => {
        console.log('[Scheduler] Generating daily digest...');
        try {
            const digest = await generateDigest('daily');
            console.log(`[Scheduler] Digest generated: ${digest.summary}`);

            // Send notification
            const notifyResult = await sendDigestNotification(digest);
            if (notifyResult.success) {
                markNotificationSent(digest.id);
                console.log('[Scheduler] Digest notification sent');
            } else {
                console.error('[Scheduler] Failed to send notification:', notifyResult.error);
            }
        } catch (error) {
            console.error('[Scheduler] Digest generation failed:', error.message);
        }
    });

    // Schedule weekly digest on configurable day at the same time
    const weeklyDay = process.env.WEEKLY_DIGEST_DAY || 'sunday';
    const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const dayNum = dayMap[weeklyDay.toLowerCase()] ?? 0;
    const weeklyDigestCron = `${digestMinute} ${digestHour} * * ${dayNum}`;
    weeklyDigestJob = cron.schedule(weeklyDigestCron, async () => {
        console.log('[Scheduler] Generating weekly digest...');
        try {
            const digest = await generateDigest('weekly');
            console.log(`[Scheduler] Weekly digest generated: ${digest.summary}`);

            // Send notification
            const notifyResult = await sendDigestNotification(digest);
            if (notifyResult.success) {
                markNotificationSent(digest.id);
                console.log('[Scheduler] Weekly digest notification sent');
            } else {
                console.error('[Scheduler] Failed to send weekly notification:', notifyResult.error);
            }
        } catch (error) {
            console.error('[Scheduler] Weekly digest generation failed:', error.message);
        }
    });

    isRunning = true;
    console.log(`Scheduler started:`);
    console.log(`  - Snapshots: every ${snapshotInterval} minutes`);
    console.log(`  - Daily digest: ${digestTime}`);
    console.log(`  - Weekly digest: ${weeklyDay}s at ${digestTime}`);
    console.log(`  - Cleanup: 3:00 AM`);

    // Run initial collection after a short delay
    setTimeout(async () => {
        console.log('[Scheduler] Running initial snapshot collection...');
        try {
            await collectSnapshots();
        } catch (error) {
            console.error('[Scheduler] Initial collection failed:', error.message);
        }
    }, 5000);
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
    if (snapshotJob) {
        snapshotJob.stop();
        snapshotJob = null;
    }
    if (cleanupJob) {
        cleanupJob.stop();
        cleanupJob = null;
    }
    if (digestJob) {
        digestJob.stop();
        digestJob = null;
    }
    if (weeklyDigestJob) {
        weeklyDigestJob.stop();
        weeklyDigestJob = null;
    }
    isRunning = false;
    console.log('Scheduler stopped');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    const digestTime = process.env.DIGEST_TIME || '07:00';
    return {
        isRunning,
        snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30,
        digestTime,
        nextSnapshot: snapshotJob ? 'Scheduled' : 'Not scheduled',
        nextDigest: digestJob ? `Daily at ${digestTime}` : 'Not scheduled',
        nextWeeklyDigest: weeklyDigestJob ? `Sundays at ${digestTime}` : 'Not scheduled',
        nextCleanup: cleanupJob ? 'Daily at 3 AM' : 'Not scheduled'
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    getSchedulerStatus
};
