/**
 * User Notes - Database functions
 * Allows users to add personal notes to warnings for AI context
 */

const { getDb, saveDatabase } = require('./index');
const { generateWarningKey } = require('./dismissed');

/**
 * Add a note for a specific warning
 */
function addNote(title, note) {
    const db = getDb();
    const warningKey = generateWarningKey(title);

    db.run(`
        INSERT INTO user_notes (warning_key, title, note)
        VALUES (?, ?, ?)
    `, [warningKey, title, note]);
    saveDatabase();

    return { warningKey, title, note };
}

/**
 * Get all user notes
 */
function getNotes() {
    const db = getDb();
    const result = db.exec(`
        SELECT id, warning_key, title, note, created_at
        FROM user_notes
        ORDER BY created_at DESC
    `);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
        const noteObj = {};
        columns.forEach((col, i) => noteObj[col] = row[i]);
        return noteObj;
    });
}

/**
 * Get a single note by ID
 */
function getNote(id) {
    const db = getDb();
    const result = db.exec(
        'SELECT id, warning_key, title, note, created_at FROM user_notes WHERE id = ?',
        [id]
    );

    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    const noteObj = {};
    columns.forEach((col, i) => noteObj[col] = row[i]);
    return noteObj;
}

/**
 * Get note for a specific warning key
 */
function getNoteForWarning(warningKey) {
    const db = getDb();
    const result = db.exec(
        'SELECT id, warning_key, title, note, created_at FROM user_notes WHERE warning_key = ?',
        [warningKey]
    );

    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const row = result[0].values[0];
    const noteObj = {};
    columns.forEach((col, i) => noteObj[col] = row[i]);
    return noteObj;
}

/**
 * Update a note by ID
 */
function updateNote(id, note) {
    const db = getDb();
    db.run('UPDATE user_notes SET note = ? WHERE id = ?', [note, id]);
    saveDatabase();
}

/**
 * Delete a note by ID
 */
function deleteNote(id) {
    const db = getDb();
    db.run('DELETE FROM user_notes WHERE id = ?', [id]);
    saveDatabase();
}

/**
 * Get all notes as context for AI prompt
 * Returns a summary string suitable for injecting into AI prompts
 */
function getNotesForPrompt() {
    const notes = getNotes();
    if (notes.length === 0) return null;

    return notes.map(n => `- "${n.title}": ${n.note}`).join('\n');
}

module.exports = {
    addNote,
    getNotes,
    getNote,
    getNoteForWarning,
    updateNote,
    deleteNote,
    getNotesForPrompt
};
