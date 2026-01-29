import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

/* ESM paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ALWAYS use USER_DATA_PATH in Electron */
if (!process.env.USER_DATA_PATH) {
  throw new Error("USER_DATA_PATH not set before DB initialization");
}

const USER_DATA_PATH = process.env.USER_DATA_PATH;

const dbPath = path.join(USER_DATA_PATH, "attendance.db");

/* Open DB */
const db = new Database(dbPath);

/* PRAGMAS (IMPORTANT) */
db.pragma("journal_mode = WAL");     // fast + safe
db.pragma("foreign_keys = ON");      // enforce relations

/* TABLES */
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    date TEXT NOT NULL,          -- YYYY-MM-DD
    time TEXT NOT NULL,          -- HH:mm:ss
    type TEXT NOT NULL CHECK (type IN ('IN','OUT')),
    source TEXT DEFAULT 'Biometric',

    UNIQUE(employee_id, date, time, type),
    FOREIGN KEY (employee_id)
      REFERENCES employees(id)
      ON DELETE CASCADE
  );
`);

/* INDEXES (PERFORMANCE) */
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_logs_employee_date
    ON attendance_logs(employee_id, date);

  CREATE INDEX IF NOT EXISTS idx_logs_date
    ON attendance_logs(date);
`);

export default db;
