const { getDb, saveDatabase } = require('./index');

/**
 * Store a snapshot for an entity
 */
function addSnapshot(entityId, timestamp, valueType, valueNum, valueStr, attributes = null) {
    const db = getDb();
    db.run(`
        INSERT INTO snapshots (entity_id, timestamp, value_type, value_num, value_str, attributes)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        entityId,
        timestamp,
        valueType,
        valueNum,
        valueStr,
        attributes ? JSON.stringify(attributes) : null
    ]);
    saveDatabase();
}

/**
 * Store multiple snapshots at once (for batch collection)
 */
function addSnapshots(snapshots) {
    const db = getDb();

    for (const snap of snapshots) {
        db.run(`
            INSERT INTO snapshots (entity_id, timestamp, value_type, value_num, value_str, attributes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            snap.entity_id,
            snap.timestamp,
            snap.value_type,
            snap.value_num || null,
            snap.value_str || null,
            snap.attributes ? JSON.stringify(snap.attributes) : null
        ]);
    }

    saveDatabase();
}

/**
 * Get snapshots for an entity within a time range
 */
function getSnapshots(entityId, startTime, endTime, limit = 1000) {
    const db = getDb();
    const result = db.exec(`
        SELECT id, entity_id, timestamp, value_type, value_num, value_str, attributes
        FROM snapshots
        WHERE entity_id = ?
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp DESC
        LIMIT ?
    `, [entityId, startTime, endTime, limit]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const snap = {};
        columns.forEach((col, i) => {
            if (col === 'attributes' && row[i]) {
                try {
                    snap[col] = JSON.parse(row[i]);
                } catch {
                    snap[col] = row[i];
                }
            } else {
                snap[col] = row[i];
            }
        });
        return snap;
    });
}

/**
 * Get the latest snapshot for each monitored entity
 */
function getLatestSnapshots() {
    const db = getDb();
    const result = db.exec(`
        SELECT s.entity_id, s.timestamp, s.value_type, s.value_num, s.value_str, s.attributes
        FROM snapshots s
        INNER JOIN (
            SELECT entity_id, MAX(timestamp) as max_ts
            FROM snapshots
            GROUP BY entity_id
        ) latest ON s.entity_id = latest.entity_id AND s.timestamp = latest.max_ts
    `);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const snap = {};
        columns.forEach((col, i) => {
            if (col === 'attributes' && row[i]) {
                try {
                    snap[col] = JSON.parse(row[i]);
                } catch {
                    snap[col] = row[i];
                }
            } else {
                snap[col] = row[i];
            }
        });
        return snap;
    });
}

/**
 * Get hourly averages for numeric entities (for compression)
 */
function getHourlyAverages(entityId, date) {
    const db = getDb();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const result = db.exec(`
        SELECT 
            strftime('%Y-%m-%dT%H:00:00', timestamp) as hour,
            AVG(value_num) as avg_value,
            MIN(value_num) as min_value,
            MAX(value_num) as max_value,
            COUNT(*) as sample_count
        FROM snapshots
        WHERE entity_id = ?
          AND timestamp >= ?
          AND timestamp <= ?
          AND value_type = 'number'
        GROUP BY strftime('%Y-%m-%dT%H:00:00', timestamp)
        ORDER BY hour
    `, [entityId, startOfDay, endOfDay]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const stat = {};
        columns.forEach((col, i) => stat[col] = row[i]);
        return stat;
    });
}

/**
 * Get daily summary for binary sensors
 */
function getDailySummary(entityId, date) {
    const db = getDb();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const result = db.exec(`
        SELECT 
            value_str as state,
            COUNT(*) as count,
            MIN(timestamp) as first_seen,
            MAX(timestamp) as last_seen
        FROM snapshots
        WHERE entity_id = ?
          AND timestamp >= ?
          AND timestamp <= ?
        GROUP BY value_str
    `, [entityId, startOfDay, endOfDay]);

    if (result.length === 0) return null;

    const columns = result[0].columns;
    const states = {};
    result[0].values.forEach(row => {
        const stat = {};
        columns.forEach((col, i) => stat[col] = row[i]);
        states[stat.state] = stat;
    });

    return { date, entity_id: entityId, states };
}

/**
 * Delete old snapshots (for cleanup)
 */
function deleteOldSnapshots(beforeDate) {
    const db = getDb();

    // Get count before delete
    const countResult = db.exec(
        'SELECT COUNT(*) as count FROM snapshots WHERE timestamp < ?',
        [beforeDate]
    );
    const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    db.run('DELETE FROM snapshots WHERE timestamp < ?', [beforeDate]);
    saveDatabase();

    return count;
}

/**
 * Get snapshot statistics
 */
function getSnapshotStats() {
    const db = getDb();
    const result = db.exec(`
        SELECT 
            COUNT(*) as total_snapshots,
            COUNT(DISTINCT entity_id) as entities_with_data,
            MIN(timestamp) as oldest_snapshot,
            MAX(timestamp) as newest_snapshot
        FROM snapshots
    `);

    if (result.length === 0 || result[0].values.length === 0) {
        return { total_snapshots: 0, entities_with_data: 0, oldest_snapshot: null, newest_snapshot: null };
    }

    const [total, entities, oldest, newest] = result[0].values[0];
    return {
        total_snapshots: total || 0,
        entities_with_data: entities || 0,
        oldest_snapshot: oldest,
        newest_snapshot: newest
    };
}

/**
 * Get all snapshots for a date range (for AI analysis)
 */
function getAllSnapshotsForAnalysis(startTime, endTime) {
    const db = getDb();
    const result = db.exec(`
        SELECT 
            s.entity_id, 
            s.timestamp, 
            s.value_type, 
            s.value_num, 
            s.value_str,
            me.friendly_name,
            me.category,
            me.priority
        FROM snapshots s
        JOIN monitored_entities me ON s.entity_id = me.entity_id
        WHERE s.timestamp >= ?
          AND s.timestamp <= ?
          AND me.priority != 'ignore'
        ORDER BY s.entity_id, s.timestamp
    `, [startTime, endTime]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const snap = {};
        columns.forEach((col, i) => snap[col] = row[i]);
        return snap;
    });
}

module.exports = {
    addSnapshot,
    addSnapshots,
    getSnapshots,
    getLatestSnapshots,
    getHourlyAverages,
    getDailySummary,
    deleteOldSnapshots,
    getSnapshotStats,
    getAllSnapshotsForAnalysis
};
