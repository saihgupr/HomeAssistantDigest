const { getDb, saveDatabase } = require('./index');

/**
 * Store a new digest
 */
function addDigest(type, content, summary, attentionCount) {
    const db = getDb();
    db.run(`
        INSERT INTO digests (timestamp, type, content, summary, attention_count, notification_sent)
        VALUES (datetime('now'), ?, ?, ?, ?, 0)
    `, [type, content, summary, attentionCount]);
    saveDatabase();

    // Return the ID of the inserted digest
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result.length > 0 ? result[0].values[0][0] : null;
}

/**
 * Get the most recent digest
 */
function getLatestDigest() {
    const db = getDb();
    const result = db.exec(`
        SELECT id, timestamp, type, content, summary, attention_count, notification_sent
        FROM digests
        ORDER BY timestamp DESC
        LIMIT 1
    `);

    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    const digest = {};
    columns.forEach((col, i) => digest[col] = row[i]);
    return digest;
}

/**
 * Get the most recent digest of a specific type
 */
function getLatestDigestByType(type) {
    const db = getDb();
    const result = db.exec(`
        SELECT id, timestamp, type, content, summary, attention_count, notification_sent
        FROM digests
        WHERE type = ?
        ORDER BY timestamp DESC
        LIMIT 1
    `, [type]);

    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    const digest = {};
    columns.forEach((col, i) => digest[col] = row[i]);
    return digest;
}

/**
 * Get digest by ID
 */
function getDigest(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM digests WHERE id = ?');
    stmt.bind([id]);

    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

/**
 * Get all digests with pagination and optional type filter
 */
function getDigests(limit = 10, offset = 0, type = null) {
    const db = getDb();

    let query = `
        SELECT id, timestamp, type, summary, attention_count, notification_sent
        FROM digests
    `;
    let params = [];

    if (type) {
        query += ` WHERE type = ?`;
        params.push(type);
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = db.exec(query, params);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const digest = {};
        columns.forEach((col, i) => digest[col] = row[i]);
        return digest;
    });
}

/**
 * Mark digest as notification sent
 */
function markNotificationSent(id) {
    const db = getDb();
    db.run('UPDATE digests SET notification_sent = 1 WHERE id = ?', [id]);
    saveDatabase();
}

/**
 * Get digest statistics
 */
function getDigestStats() {
    const db = getDb();
    const result = db.exec(`
        SELECT 
            COUNT(*) as total_digests,
            SUM(attention_count) as total_attention_items,
            AVG(attention_count) as avg_attention_items,
            MAX(timestamp) as last_digest_time
        FROM digests
    `);

    if (result.length === 0 || result[0].values.length === 0) {
        return { total_digests: 0, total_attention_items: 0, avg_attention_items: 0, last_digest_time: null };
    }

    const [total, totalAttention, avgAttention, lastTime] = result[0].values[0];
    return {
        total_digests: total || 0,
        total_attention_items: totalAttention || 0,
        avg_attention_items: Math.round((avgAttention || 0) * 10) / 10,
        last_digest_time: lastTime
    };
}

/**
 * Delete old digests (keep last N days)
 */
function deleteOldDigests(beforeDate) {
    const db = getDb();
    db.run('DELETE FROM digests WHERE timestamp < ?', [beforeDate]);
    saveDatabase();
}

module.exports = {
    addDigest,
    getLatestDigest,
    getLatestDigestByType,
    getDigest,
    getDigests,
    markNotificationSent,
    getDigestStats,
    deleteOldDigests
};
