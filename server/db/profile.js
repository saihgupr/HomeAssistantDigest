const { getDb, saveDatabase } = require('./index');

/**
 * Get all profile values as an object
 */
function getProfile() {
    const db = getDb();
    const result = db.exec('SELECT key, value FROM profile');
    const profile = {};

    if (result.length > 0) {
        const rows = result[0].values;
        for (const [key, value] of rows) {
            try {
                profile[key] = JSON.parse(value);
            } catch {
                profile[key] = value;
            }
        }
    }
    return profile;
}

/**
 * Get a single profile value
 */
function getProfileValue(key) {
    const db = getDb();
    const stmt = db.prepare('SELECT value FROM profile WHERE key = ?');
    stmt.bind([key]);

    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }
    stmt.free();
    return null;
}

/**
 * Set a profile value
 */
function setProfileValue(key, value) {
    const db = getDb();
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.run(`
        INSERT INTO profile (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET 
            value = excluded.value,
            updated_at = datetime('now')
    `, [key, jsonValue]);
    saveDatabase();
}

/**
 * Set multiple profile values at once
 */
function setProfile(profileData) {
    const db = getDb();

    for (const [key, value] of Object.entries(profileData)) {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        db.run(`
            INSERT INTO profile (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value,
                updated_at = datetime('now')
        `, [key, jsonValue]);
    }

    saveDatabase();
}

/**
 * Check if profile setup is complete
 */
function isProfileComplete() {
    const profile = getProfile();
    const requiredKeys = ['occupants', 'schedule', 'priorities'];
    return requiredKeys.every(key => profile[key] !== undefined);
}

/**
 * Clear all profile data
 */
function clearProfile() {
    const db = getDb();
    db.run('DELETE FROM profile');
    saveDatabase();
}

module.exports = {
    getProfile,
    getProfileValue,
    setProfileValue,
    setProfile,
    isProfileComplete,
    clearProfile
};
