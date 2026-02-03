import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ESM paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

// Initialize database connection - MUST be called after process.env.USER_DATA_PATH is set
export function initDB() {
  if (db) {
    return db; // Already initialized
  }

  if (!process.env.USER_DATA_PATH) {
    throw new Error("USER_DATA_PATH not set before DB initialization");
  }

  const USER_DATA_PATH = process.env.USER_DATA_PATH;
  const dbPath = path.join(USER_DATA_PATH, "attendance.db");

  console.log("Initializing database at:", dbPath);

  // Open DB
  db = new Database(dbPath);

  // PRAGMAS
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // EMPLOYEES
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  // ATTENDANCE LOGS (PUNCHES ONLY)
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,      -- YYYY-MM-DD
      time TEXT NOT NULL,      -- HH:mm:ss
      source TEXT DEFAULT 'Biometric',
      created_at TEXT DEFAULT (datetime('now','localtime')),

      UNIQUE(employee_id, date, time),
      FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
    );
  `);

  // INDEXES 
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_employee_date
      ON attendance_logs(employee_id, date);

    CREATE INDEX IF NOT EXISTS idx_logs_date
      ON attendance_logs(date);
  `);

  console.log("✓ Database initialized successfully");

  return db;
}

// Get database instance - Throws error if not initialized
export function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call initDB() first.");
  }
  return db;
}

// Default export for backward compatibility
export default {
  get prepare() {
    return getDB().prepare.bind(getDB());
  },
  get exec() {
    return getDB().exec.bind(getDB());
  },
  get pragma() {
    return getDB().pragma.bind(getDB());
  },
  get transaction() {
    return getDB().transaction.bind(getDB());
  },
  get backup() {
    return getDB().backup.bind(getDB());
  },
};