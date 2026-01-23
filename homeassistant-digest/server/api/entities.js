const express = require('express');
const router = express.Router();
const {
    getAllStates,
    checkConnection,
    categorizeEntity,
    determineStorageStrategy,
    determinePriority
} = require('../services/homeassistant');
const {
    getMonitoredEntities,
    setMonitoredEntities,
    updateEntityPriority,
    getEntityStats,
    getTotalCounts,
    clearMonitoredEntities
} = require('../db/entities');

// Domains to exclude by default (internal/system entities)
const EXCLUDED_DOMAINS = [
    'zone', 'automation', 'script', 'scene', 'group',
    'input_boolean', 'input_number', 'input_text', 'input_select', 'input_datetime',
    'input_button', 'timer', 'counter', 'schedule',
    'persistent_notification', 'conversation', 'tts', 'stt',
    'update', 'button', 'number', 'select', 'text', 'datetime'
];

// Domains to exclude for privacy
const PRIVACY_EXCLUDED_DOMAINS = [
    'person', 'device_tracker'
];

/**
 * GET /api/entities/connection
 * Check if we can connect to Home Assistant
 */
router.get('/connection', async (req, res) => {
    try {
        const status = await checkConnection();
        res.json(status);
    } catch (error) {
        console.error('Connection check failed:', error);
        res.json({ connected: false, error: error.message });
    }
});

/**
 * GET /api/entities/discover
 * Discover all entities from Home Assistant and categorize them
 */
router.get('/discover', async (req, res) => {
    try {
        const states = await getAllStates();

        // Filter and categorize entities
        const entities = states
            .filter(entity => {
                const domain = entity.entity_id.split('.')[0];
                // Skip excluded domains
                if (EXCLUDED_DOMAINS.includes(domain)) return false;
                if (PRIVACY_EXCLUDED_DOMAINS.includes(domain)) return false;
                // Skip unavailable entities
                if (entity.state === 'unavailable') return false;
                return true;
            })
            .map(entity => {
                const domain = entity.entity_id.split('.')[0];
                const category = categorizeEntity(entity);
                return {
                    entity_id: entity.entity_id,
                    friendly_name: entity.attributes?.friendly_name || entity.entity_id,
                    domain,
                    category,
                    priority: determinePriority(entity, category),
                    storage_strategy: determineStorageStrategy(entity),
                    state: entity.state,
                    attributes: entity.attributes
                };
            });

        // Group by category for easier display
        const byCategory = {};
        for (const entity of entities) {
            if (!byCategory[entity.category]) {
                byCategory[entity.category] = [];
            }
            byCategory[entity.category].push(entity);
        }

        res.json({
            total: entities.length,
            byCategory,
            entities
        });
    } catch (error) {
        console.error('Entity discovery failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/entities/auto-configure
 * Automatically discover and save all entities with sensible defaults
 * This is the "magic" one-click setup - no manual selection needed
 */
router.post('/auto-configure', async (req, res) => {
    try {
        console.log('[Auto-Configure] Starting automatic entity configuration...');
        const states = await getAllStates();

        // Filter and categorize entities (same as discover)
        const entities = states
            .filter(entity => {
                const domain = entity.entity_id.split('.')[0];
                if (EXCLUDED_DOMAINS.includes(domain)) return false;
                if (PRIVACY_EXCLUDED_DOMAINS.includes(domain)) return false;
                if (entity.state === 'unavailable') return false;
                return true;
            })
            .map(entity => {
                const domain = entity.entity_id.split('.')[0];
                const category = categorizeEntity(entity);
                return {
                    entity_id: entity.entity_id,
                    friendly_name: entity.attributes?.friendly_name || entity.entity_id,
                    domain,
                    category,
                    // AI will determine what's important - everything is "normal" by default
                    priority: determinePriority(entity, category),
                    storage_strategy: determineStorageStrategy(entity),
                    state: entity.state
                };
            });

        // Clear existing and save all entities
        clearMonitoredEntities();
        setMonitoredEntities(entities);

        const stats = getTotalCounts();
        console.log(`[Auto-Configure] Saved ${entities.length} entities (${stats.monitored} monitored)`);

        res.json({
            success: true,
            total: entities.length,
            monitored: stats.monitored,
            message: `Auto-configured ${entities.length} entities for monitoring`
        });
    } catch (error) {
        console.error('Auto-configure failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/entities/save
 * Save discovered entities to the database
 */
router.post('/save', async (req, res) => {
    try {
        const { entities } = req.body;

        if (!Array.isArray(entities)) {
            return res.status(400).json({ error: 'entities must be an array' });
        }

        // Clear existing and save new
        clearMonitoredEntities();
        setMonitoredEntities(entities);

        const stats = getTotalCounts();
        res.json({
            success: true,
            saved: entities.length,
            monitored: stats.monitored
        });
    } catch (error) {
        console.error('Save entities failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/entities
 * Get all monitored entities from database
 */
router.get('/', async (req, res) => {
    try {
        const filters = {};
        if (req.query.category) filters.category = req.query.category;
        if (req.query.priority) filters.priority = req.query.priority;
        if (req.query.domain) filters.domain = req.query.domain;

        const entities = getMonitoredEntities(filters);
        const stats = getEntityStats();
        const counts = getTotalCounts();

        res.json({
            entities,
            stats,
            counts
        });
    } catch (error) {
        console.error('Get entities failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/entities/:entityId/priority
 * Update an entity's priority
 */
router.patch('/:entityId/priority', async (req, res) => {
    try {
        const { entityId } = req.params;
        const { priority } = req.body;

        const validPriorities = ['critical', 'normal', 'low', 'ignore'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({
                error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
            });
        }

        updateEntityPriority(decodeURIComponent(entityId), priority);
        res.json({ success: true });
    } catch (error) {
        console.error('Update priority failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/entities/stats
 * Get entity statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = getEntityStats();
        const counts = getTotalCounts();
        res.json({ stats, counts });
    } catch (error) {
        console.error('Get stats failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
