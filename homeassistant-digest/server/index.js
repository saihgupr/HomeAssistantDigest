const express = require('express');
const path = require('path');
const { initDatabase } = require('./db');
const { isProfileComplete, getProfile } = require('./db/profile');
const { getTotalCounts } = require('./db/entities');
const { getSnapshotStats } = require('./db/snapshots');
const profileRoutes = require('./api/profile');
const entityRoutes = require('./api/entities');
const collectorRoutes = require('./api/collector');
const digestRoutes = require('./api/digest');
const devRoutes = require('./api/dev');
const { startScheduler, getSchedulerStatus } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 8099;

// Parse JSON bodies
app.use(express.json());

// Disable caching for API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Serve static UI files
app.use(express.static(path.join(__dirname, '..', 'ui')));

// API Routes
app.use('/api/profile', profileRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/collector', collectorRoutes);
app.use('/api/digest', digestRoutes);
app.use('/api/dev', devRoutes);  // Development helpers

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
        const complete = isProfileComplete();
        const configured = !!process.env.GEMINI_API_KEY;

        console.log(`Status Check - Configured: ${configured}, Complete: ${complete}, Keys: ${Object.keys(profile).join(',')}`);

        res.json({
            configured,
            profileComplete: complete,
            digestTime: process.env.DIGEST_TIME || '07:00',
            historyDays: parseInt(process.env.HISTORY_DAYS) || 7,
            snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES) || 30,
            lastDigest: null, // TODO: Implement
            nextDigest: null, // TODO: Implement
            entitiesMonitored: getTotalCounts().monitored,
            entitiesDiscovered: getTotalCounts().total > 0,
            snapshotStats: getSnapshotStats(),
            scheduler: getSchedulerStatus(),
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

            // Auto-start scheduler if entities are configured
            const entityCounts = getTotalCounts();
            if (entityCounts.monitored > 0) {
                console.log(`Found ${entityCounts.monitored} monitored entities, starting scheduler...`);
                startScheduler();
            } else {
                console.log('No entities configured yet, scheduler will start after entity discovery');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();
