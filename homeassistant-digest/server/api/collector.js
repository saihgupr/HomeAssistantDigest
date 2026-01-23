const express = require('express');
const router = express.Router();
const { collectSnapshots, cleanupOldData, getCollectorStatus } = require('../services/collector');
const { getSchedulerStatus, startScheduler, stopScheduler } = require('../services/scheduler');
const { getSnapshotStats, getSnapshots, getLatestSnapshots } = require('../db/snapshots');
const { getTotalCounts } = require('../db/entities');

/**
 * GET /api/collector/status
 * Get collector and scheduler status
 */
router.get('/status', (req, res) => {
    try {
        const collectorStatus = getCollectorStatus();
        const schedulerStatus = getSchedulerStatus();
        const entityCounts = getTotalCounts();

        res.json({
            collector: collectorStatus,
            scheduler: schedulerStatus,
            entities: entityCounts
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/collector/collect
 * Trigger manual snapshot collection
 */
router.post('/collect', async (req, res) => {
    try {
        const result = await collectSnapshots();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Manual collection failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/collector/cleanup
 * Trigger manual cleanup of old data
 */
router.post('/cleanup', async (req, res) => {
    try {
        const result = await cleanupOldData();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Cleanup failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/collector/scheduler/start
 * Start the scheduler
 */
router.post('/scheduler/start', (req, res) => {
    try {
        startScheduler();
        res.json({ success: true, status: getSchedulerStatus() });
    } catch (error) {
        console.error('Start scheduler failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/collector/scheduler/stop
 * Stop the scheduler
 */
router.post('/scheduler/stop', (req, res) => {
    try {
        stopScheduler();
        res.json({ success: true, status: getSchedulerStatus() });
    } catch (error) {
        console.error('Stop scheduler failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/collector/snapshots
 * Get recent snapshots (for debugging/display)
 */
router.get('/snapshots', (req, res) => {
    try {
        const latest = getLatestSnapshots();
        const stats = getSnapshotStats();

        res.json({
            latest,
            stats
        });
    } catch (error) {
        console.error('Get snapshots failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/collector/snapshots/:entityId
 * Get snapshots for a specific entity
 */
router.get('/snapshots/:entityId', (req, res) => {
    try {
        const { entityId } = req.params;
        const { start, end, limit } = req.query;

        // Default to last 24 hours
        const now = new Date();
        const endTime = end || now.toISOString();
        const startTime = start || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const snapshots = getSnapshots(
            decodeURIComponent(entityId),
            startTime,
            endTime,
            parseInt(limit) || 100
        );

        res.json({ snapshots, count: snapshots.length });
    } catch (error) {
        console.error('Get entity snapshots failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
