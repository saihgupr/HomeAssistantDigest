const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8099;

// Parse JSON bodies
app.use(express.json());

// Serve static UI files
app.use(express.static(path.join(__dirname, '..', 'ui')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '0.1.0',
        uptime: process.uptime()
    });
});

// Status endpoint - returns current add-on state
app.get('/api/status', (req, res) => {
    res.json({
        configured: !!process.env.GEMINI_API_KEY,
        digestTime: process.env.DIGEST_TIME || '07:00',
        historyDays: parseInt(process.env.HISTORY_DAYS) || 7,
        snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30,
        lastDigest: null, // TODO: Implement
        nextDigest: null, // TODO: Implement
        entitiesMonitored: 0 // TODO: Implement
    });
});

// Ingress compatibility - handle base path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'ui', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Home Assistant Digest server running on port ${PORT}`);
    console.log(`Digest scheduled for: ${process.env.DIGEST_TIME || '07:00'}`);
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn('Warning: GEMINI_API_KEY not configured');
    }
});
