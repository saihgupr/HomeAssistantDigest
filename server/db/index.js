const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'digest.db');

let db = null;
let SQL = null;

/**
 * Initialize the database and run migrations
 */
async function initDatabase() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Initialize sql.js
    SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('Loaded existing database:', DB_PATH);
    } else {
        db = new SQL.Database();
        console.log('Created new database:', DB_PATH);
    }

    runMigrations();
    saveDatabase(); // Initial save

    return db;
}

/**
 * Save the database to disk
 */
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log(`[DB] Saved database to ${DB_PATH} (${buffer.length} bytes)`);
    }
}

/**
 * Run all database migrations
 */
function runMigrations() {
    // Create migrations table if not exists
    db.run(`
        CREATE TABLE IF NOT EXISTS migrations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
    `);

    const migrations = [
        {
            name: '001_create_profile',
            sql: `
                CREATE TABLE IF NOT EXISTS profile(
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `
        },
        {
            name: '002_create_monitored_entities',
            sql: `
                CREATE TABLE IF NOT EXISTS monitored_entities(
        entity_id TEXT PRIMARY KEY,
        friendly_name TEXT,
        domain TEXT,
        category TEXT,
        priority TEXT DEFAULT 'normal',
        storage_strategy TEXT DEFAULT 'daily_snapshot',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `
        },
        {
            name: '003_create_snapshots',
            sql: `
                CREATE TABLE IF NOT EXISTS snapshots(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        value_type TEXT NOT NULL,
        value_num REAL,
        value_str TEXT,
        attributes TEXT
    );
                CREATE INDEX IF NOT EXISTS idx_snapshots_entity_time 
                ON snapshots(entity_id, timestamp);
`
        },
        {
            name: '004_create_digests',
            sql: `
                CREATE TABLE IF NOT EXISTS digests(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    attention_count INTEGER DEFAULT 0,
    notification_sent INTEGER DEFAULT 0
)
            `
        },
        {
            name: '005_create_dismissed_warnings',
            sql: `
                CREATE TABLE IF NOT EXISTS dismissed_warnings(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warning_key TEXT UNIQUE NOT NULL,
    title TEXT,
    dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
            `
        }
    ];

    // Get applied migrations
    const appliedResult = db.exec('SELECT name FROM migrations');
    const applied = appliedResult.length > 0
        ? appliedResult[0].values.map(row => row[0])
        : [];

    for (const migration of migrations) {
        if (!applied.includes(migration.name)) {
            console.log(`Running migration: ${migration.name} `);
            db.run(migration.sql);
            db.run('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
        }
    }

    saveDatabase();
}

/**
 * Get the database instance
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDb,
    closeDatabase,
    saveDatabase
};
