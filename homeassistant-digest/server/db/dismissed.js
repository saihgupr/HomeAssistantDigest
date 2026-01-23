/**
 * Dismissed Warnings - Database functions
 */

const { getDb, saveDatabase } = require('./index');

/**
 * Dismiss a warning by key (prevents it from appearing in future digests)
 */
function dismissWarning(warningKey, title = null) {
    const db = getDb();
    db.run(`
        INSERT OR REPLACE INTO dismissed_warnings (warning_key, title, dismissed_at)
        VALUES (?, ?, datetime('now'))
    `, [warningKey, title]);
    saveDatabase();
}

/**
 * Check if a warning is dismissed
 */
function isWarningDismissed(warningKey) {
    const db = getDb();
    const result = db.exec(
        'SELECT 1 FROM dismissed_warnings WHERE warning_key = ?',
        [warningKey]
    );
    return result.length > 0 && result[0].values.length > 0;
}

/**
 * Get all dismissed warnings
 */
function getDismissedWarnings() {
    const db = getDb();
    const result = db.exec(`
        SELECT warning_key, title, dismissed_at
        FROM dismissed_warnings
        ORDER BY dismissed_at DESC
    `);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const warning = {};
        columns.forEach((col, i) => warning[col] = row[i]);
        return warning;
    });
}

/**
 * Restore a dismissed warning (allow it to appear again)
 */
function restoreWarning(warningKey) {
    const db = getDb();
    db.run('DELETE FROM dismissed_warnings WHERE warning_key = ?', [warningKey]);
    saveDatabase();
}

/**
 * Generate a warning key from title (for matching)
 * Uses a simple hash of the title to create a consistent key
 */
function generateWarningKey(title) {
    // Simple hash: lowercase, remove punctuation, take first 50 chars
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

module.exports = {
    dismissWarning,
    isWarningDismissed,
    getDismissedWarnings,
    restoreWarning,
    generateWarningKey
};
