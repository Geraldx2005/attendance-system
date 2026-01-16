import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB will be created automatically
const dbPath = path.join(__dirname, "attendance.db");
const db = new Database(dbPath);

// ---- TABLES ----
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT CHECK(type IN ('IN','OUT')),
    source TEXT DEFAULT 'Biometric',
    UNIQUE(employee_id, date, time, type)
  );
`);

export default db;
