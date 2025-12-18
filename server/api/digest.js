const express = require('express');
const router = express.Router();
const { generateDigest, getDigestStatus } = require('../services/analyzer');
const { sendDigestNotification, sendTestNotification } = require('../services/notifier');
const { getDigests, getDigest, markNotificationSent, getDigestStats } = require('../db/digests');

/**
 * GET /api/digest/status
 * Get digest generation status
 */
router.get('/status', (req, res) => {
    try {
        const status = getDigestStatus();
        const stats = getDigestStats();
        res.json({ ...status, stats });
    } catch (error) {
        console.error('Digest status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/digest/generate
 * Generate a new digest on-demand
 */
router.post('/generate', async (req, res) => {
    try {
        const { type = 'on_demand' } = req.body;

        console.log(`Generating ${type} digest...`);
        const digest = await generateDigest(type);

        res.json({ success: true, digest });
    } catch (error) {
        console.error('Digest generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/digest/generate-and-notify
 * Generate a digest and send notification
 */
router.post('/generate-and-notify', async (req, res) => {
    try {
        const { type = 'daily' } = req.body;

        console.log(`Generating ${type} digest with notification...`);
        const digest = await generateDigest(type);

        // Send notification
        const notifyResult = await sendDigestNotification(digest);

        if (notifyResult.success) {
            markNotificationSent(digest.id);
        }

        res.json({
            success: true,
            digest,
            notification: notifyResult
        });
    } catch (error) {
        console.error('Digest generation/notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/digest/list
 * Get list of past digests
 */
router.get('/list', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const digests = getDigests(limit, offset);
        const stats = getDigestStats();

        res.json({ digests, stats });
    } catch (error) {
        console.error('List digests error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/digest/:id
 * Get a specific digest by ID
 */
router.get('/:id', (req, res) => {
    try {
        const digest = getDigest(parseInt(req.params.id));

        if (!digest) {
            return res.status(404).json({ error: 'Digest not found' });
        }

        res.json({ digest });
    } catch (error) {
        console.error('Get digest error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/digest/test-notification
 * Send a test notification
 */
router.post('/test-notification', async (req, res) => {
    try {
        const result = await sendTestNotification();
        res.json(result);
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
