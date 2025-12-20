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
 * Get list of past digests with optional type filter
 */
router.get('/list', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || null; // 'daily', 'weekly', or null for all

        const digests = getDigests(limit, offset, type);
        const stats = getDigestStats();

        res.json({ digests, stats });
    } catch (error) {
        console.error('List digests error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/digest/notes
 * Get all user notes - MUST be before /:id to avoid route conflict
 */
const { addNote, getNotes, getNote, updateNote, deleteNote } = require('../db/notes');

router.get('/notes', (req, res) => {
    try {
        const notes = getNotes();
        res.json({ notes });
    } catch (error) {
        console.error('Get notes error:', error);
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

// ============================================
// Dismissed Warnings Routes
// ============================================

const { dismissWarning, getDismissedWarnings, restoreWarning, generateWarningKey } = require('../db/dismissed');

/**
 * POST /api/digest/dismiss
 * Dismiss a warning so it won't appear in future digests
 */
router.post('/dismiss', (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const warningKey = generateWarningKey(title);
        dismissWarning(warningKey, title);

        res.json({ success: true, warningKey });
    } catch (error) {
        console.error('Dismiss warning error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/digest/dismissed
 * Get list of dismissed warnings
 */
router.get('/dismissed', (req, res) => {
    try {
        const dismissed = getDismissedWarnings();
        res.json({ dismissed });
    } catch (error) {
        console.error('Get dismissed warnings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/digest/restore
 * Restore a dismissed warning
 */
router.post('/restore', (req, res) => {
    try {
        const { warningKey } = req.body;

        if (!warningKey) {
            return res.status(400).json({ error: 'warningKey is required' });
        }

        restoreWarning(warningKey);
        res.json({ success: true });
    } catch (error) {
        console.error('Restore warning error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// User Notes Routes (POST, PUT, DELETE only - GET /notes is above /:id)
// ============================================

/**
 * POST /api/digest/note
 * Add a note for a warning
 */
router.post('/note', (req, res) => {
    try {
        const { title, note } = req.body;

        if (!title || !note) {
            return res.status(400).json({ error: 'title and note are required' });
        }

        const result = addNote(title, note);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/digest/note/:id
 * Update a note
 */
router.put('/note/:id', (req, res) => {
    try {
        const { note } = req.body;
        const id = parseInt(req.params.id);

        if (!note) {
            return res.status(400).json({ error: 'note is required' });
        }

        updateNote(id, note);
        res.json({ success: true });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/digest/note/:id
 * Delete a note
 */
router.delete('/note/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        deleteNote(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
