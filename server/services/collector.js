const { getAllStates } = require('./homeassistant');
const { getMonitoredEntities } = require('../db/entities');
const { addSnapshots, deleteOldSnapshots, getSnapshotStats } = require('../db/snapshots');

let isCollecting = false;
let lastCollectionTime = null;
let collectionErrors = [];

/**
 * Collect snapshots from all monitored entities
 */
async function collectSnapshots() {
    if (isCollecting) {
        console.log('Collection already in progress, skipping...');
        return { skipped: true };
    }

    isCollecting = true;
    collectionErrors = [];
    const startTime = Date.now();

    try {
        // Get monitored entities (excluding ignored ones)
        const monitoredEntities = getMonitoredEntities()
            .filter(e => e.priority !== 'ignore');

        if (monitoredEntities.length === 0) {
            console.log('No entities to monitor');
            return { collected: 0, skipped: false };
        }

        // Fetch current states from HA
        const allStates = await getAllStates();
        const stateMap = new Map(allStates.map(s => [s.entity_id, s]));

        // Create timestamp for this collection
        const timestamp = new Date().toISOString();

        // Build snapshots array
        const snapshots = [];

        for (const entity of monitoredEntities) {
            const state = stateMap.get(entity.entity_id);

            if (!state) {
                collectionErrors.push({
                    entity_id: entity.entity_id,
                    error: 'Entity not found in HA states'
                });
                continue;
            }

            // Skip unavailable entities
            if (state.state === 'unavailable' || state.state === 'unknown') {
                continue;
            }

            // Determine value type and extract value
            const numValue = parseFloat(state.state);
            const isNumeric = !isNaN(numValue) && isFinite(numValue);

            // Extract relevant attributes based on domain
            const relevantAttrs = extractRelevantAttributes(entity.domain, state.attributes);

            snapshots.push({
                entity_id: entity.entity_id,
                timestamp,
                value_type: isNumeric ? 'number' : 'state',
                value_num: isNumeric ? numValue : null,
                value_str: isNumeric ? null : state.state,
                attributes: Object.keys(relevantAttrs).length > 0 ? relevantAttrs : null
            });
        }

        // Store all snapshots
        if (snapshots.length > 0) {
            addSnapshots(snapshots);
        }

        lastCollectionTime = new Date();
        const duration = Date.now() - startTime;

        console.log(`Collected ${snapshots.length} snapshots in ${duration}ms`);

        return {
            collected: snapshots.length,
            errors: collectionErrors.length,
            duration,
            skipped: false
        };
    } catch (error) {
        console.error('Collection failed:', error);
        collectionErrors.push({ error: error.message });
        throw error;
    } finally {
        isCollecting = false;
    }
}

/**
 * Extract only relevant attributes to minimize storage
 */
function extractRelevantAttributes(domain, attributes) {
    const relevant = {};

    // Common useful attributes by domain
    const attrMap = {
        climate: ['current_temperature', 'target_temperature', 'hvac_action', 'preset_mode'],
        sensor: ['device_class', 'unit_of_measurement'],
        binary_sensor: ['device_class'],
        light: ['brightness', 'color_temp', 'rgb_color'],
        switch: [],
        cover: ['current_position'],
        media_player: ['media_title', 'media_artist', 'volume_level'],
        weather: ['temperature', 'humidity', 'pressure', 'wind_speed']
    };

    const keysToExtract = attrMap[domain] || [];

    for (const key of keysToExtract) {
        if (attributes[key] !== undefined) {
            relevant[key] = attributes[key];
        }
    }

    return relevant;
}

/**
 * Clean up old snapshots beyond retention period
 */
async function cleanupOldData() {
    const historyDays = parseInt(process.env.HISTORY_DAYS) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - historyDays);

    const cutoffISO = cutoffDate.toISOString();
    const deletedCount = deleteOldSnapshots(cutoffISO);

    if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old snapshots (before ${cutoffISO})`);
    }

    return { deleted: deletedCount, cutoff: cutoffISO };
}

/**
 * Get collector status
 */
function getCollectorStatus() {
    const stats = getSnapshotStats();

    return {
        isCollecting,
        lastCollectionTime: lastCollectionTime?.toISOString() || null,
        recentErrors: collectionErrors.slice(-10),
        stats
    };
}

module.exports = {
    collectSnapshots,
    cleanupOldData,
    getCollectorStatus
};
