const { getDb, saveDatabase } = require('./index');

/**
 * Get all monitored entities
 */
function getMonitoredEntities(filters = {}) {
    const db = getDb();
    let sql = 'SELECT * FROM monitored_entities';
    const params = [];
    const conditions = [];

    if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
    }
    if (filters.priority) {
        conditions.push('priority = ?');
        params.push(filters.priority);
    }
    if (filters.domain) {
        conditions.push('domain = ?');
        params.push(filters.domain);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY category, friendly_name';

    const result = db.exec(sql, params);
    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const entity = {};
        columns.forEach((col, i) => entity[col] = row[i]);
        return entity;
    });
}

/**
 * Get a single monitored entity
 */
function getMonitoredEntity(entityId) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM monitored_entities WHERE entity_id = ?');
    stmt.bind([entityId]);

    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

/**
 * Add or update a monitored entity
 */
function setMonitoredEntity(entity) {
    const db = getDb();
    db.run(`
        INSERT INTO monitored_entities 
            (entity_id, friendly_name, domain, category, priority, storage_strategy, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(entity_id) DO UPDATE SET
            friendly_name = excluded.friendly_name,
            domain = excluded.domain,
            category = excluded.category,
            priority = excluded.priority,
            storage_strategy = excluded.storage_strategy,
            updated_at = datetime('now')
    `, [
        entity.entity_id,
        entity.friendly_name,
        entity.domain,
        entity.category,
        entity.priority,
        entity.storage_strategy
    ]);
    saveDatabase();
}

/**
 * Bulk add/update monitored entities
 */
function setMonitoredEntities(entities) {
    const db = getDb();

    for (const entity of entities) {
        db.run(`
            INSERT INTO monitored_entities 
                (entity_id, friendly_name, domain, category, priority, storage_strategy, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(entity_id) DO UPDATE SET
                friendly_name = excluded.friendly_name,
                domain = excluded.domain,
                category = excluded.category,
                priority = excluded.priority,
                storage_strategy = excluded.storage_strategy,
                updated_at = datetime('now')
        `, [
            entity.entity_id,
            entity.friendly_name,
            entity.domain,
            entity.category,
            entity.priority,
            entity.storage_strategy
        ]);
    }

    saveDatabase();
}

/**
 * Update entity priority
 */
function updateEntityPriority(entityId, priority) {
    const db = getDb();
    db.run(
        "UPDATE monitored_entities SET priority = ?, updated_at = datetime('now') WHERE entity_id = ?",
        [priority, entityId]
    );
    saveDatabase();
}

/**
 * Remove a monitored entity
 */
function removeMonitoredEntity(entityId) {
    const db = getDb();
    db.run('DELETE FROM monitored_entities WHERE entity_id = ?', [entityId]);
    saveDatabase();
}

/**
 * Clear all monitored entities
 */
function clearMonitoredEntities() {
    const db = getDb();
    db.run('DELETE FROM monitored_entities');
    saveDatabase();
}

/**
 * Get entity counts by category
 */
function getEntityStats() {
    const db = getDb();
    const result = db.exec(`
        SELECT 
            category,
            COUNT(*) as count,
            SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN priority = 'normal' THEN 1 ELSE 0 END) as normal_count,
            SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low_count,
            SUM(CASE WHEN priority = 'ignore' THEN 1 ELSE 0 END) as ignored_count
        FROM monitored_entities
        GROUP BY category
        ORDER BY category
    `);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const stat = {};
        columns.forEach((col, i) => stat[col] = row[i]);
        return stat;
    });
}

/**
 * Get total counts
 */
function getTotalCounts() {
    const db = getDb();
    const result = db.exec(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN priority != 'ignore' THEN 1 ELSE 0 END) as monitored,
            SUM(CASE WHEN priority = 'ignore' THEN 1 ELSE 0 END) as ignored
        FROM monitored_entities
    `);

    if (result.length === 0 || result[0].values.length === 0) {
        return { total: 0, monitored: 0, ignored: 0 };
    }

    const [total, monitored, ignored] = result[0].values[0];
    return { total: total || 0, monitored: monitored || 0, ignored: ignored || 0 };
}

module.exports = {
    getMonitoredEntities,
    getMonitoredEntity,
    setMonitoredEntity,
    setMonitoredEntities,
    updateEntityPriority,
    removeMonitoredEntity,
    clearMonitoredEntities,
    getEntityStats,
    getTotalCounts
};
