const express = require('express');
const path = require('path');
const { initDatabase } = require('./db');
const { isProfileComplete, getProfile } = require('./db/profile');
const profileRoutes = require('./api/profile');

const app = express();
const PORT = process.env.PORT || 8099;

// Parse JSON bodies
app.use(express.json());

// Serve static UI files
app.use(express.static(path.join(__dirname, '..', 'ui')));

// API Routes
app.use('/api/profile', profileRoutes);

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
    try {
        const profile = getProfile();
        res.json({
            configured: !!process.env.GEMINI_API_KEY,
            profileComplete: isProfileComplete(),
            digestTime: process.env.DIGEST_TIME || '07:00',
            historyDays: parseInt(process.env.HISTORY_DAYS) || 7,
            snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30,
            lastDigest: null, // TODO: Implement
            nextDigest: null, // TODO: Implement
            entitiesMonitored: 0, // TODO: Implement
            profile: isProfileComplete() ? profile : null
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Database not ready' });
    }
});

// Ingress compatibility - handle base path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'ui', 'index.html'));
});

// Start server with async database initialization
async function start() {
    try {
        await initDatabase();

        app.listen(PORT, () => {
            console.log(`Home Assistant Digest server running on port ${PORT}`);
            console.log(`Digest scheduled for: ${process.env.DIGEST_TIME || '07:00'}`);

            if (!process.env.GEMINI_API_KEY) {
                console.warn('Warning: GEMINI_API_KEY not configured');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();
