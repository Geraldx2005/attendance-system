import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB file path
const dbPath = path.join(__dirname, "attendance.db");
const db = new Database(dbPath);

// --------------------
// PRAGMAS (IMPORTANT)
// --------------------
db.pragma("journal_mode = WAL"); // fast concurrent reads/writes
db.pragma("foreign_keys = ON"); // enforce relations

// --------------------
// TABLES
// --------------------
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

// --------------------
// INDEXES (CRITICAL FOR SCALE)
// --------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

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

export default db;
