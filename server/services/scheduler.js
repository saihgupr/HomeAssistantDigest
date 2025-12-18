const cron = require('node-cron');
const { collectSnapshots, cleanupOldData } = require('./collector');

let snapshotJob = null;
let cleanupJob = null;
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

    // Schedule snapshot collection (every N minutes)
    // cron format: minute hour day month weekday
    const cronExpression = `*/${snapshotInterval} * * * *`;

    snapshotJob = cron.schedule(cronExpression, async () => {
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

    isRunning = true;
    console.log(`Scheduler started: snapshots every ${snapshotInterval} minutes, cleanup at 3 AM`);

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
    isRunning = false;
    console.log('Scheduler stopped');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return {
        isRunning,
        snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30,
        nextSnapshot: snapshotJob ? 'Scheduled' : 'Not scheduled',
        nextCleanup: cleanupJob ? 'Daily at 3 AM' : 'Not scheduled'
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    getSchedulerStatus
};
