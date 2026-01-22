import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import db from "./db.js";

/* -------------------- */
/* SERVER CONSTANTS */
/* -------------------- */
const SERVER_PORT = Number(process.env.SERVER_PORT || 47832);
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

const app = express();
app.use(cors());

/* path setup (ESM safe) */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = process.env.CSV_PATH;

const USER_DATA_PATH = process.env.USER_DATA_PATH;

/* -------------------- */
/* FILE LOGGER */
/* -------------------- */
const LOG_DIR = path.join(USER_DATA_PATH, "logs");
function getIngestLogPath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `ingest-${date}.log`);
}

function logIngest(message, level = "INFO") {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;

    fs.appendFileSync(getIngestLogPath(), line);
  } catch (err) {
    // last-resort fallback
    console.error("Failed to write ingest log:", err.message);
  }
}

/* -------------------- */
/* LOG CLEANUP (30 DAYS) */
/* -------------------- */

function cleanupOldLogs(days = 30) {
  try {
    if (!fs.existsSync(LOG_DIR)) return;

    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    for (const file of files) {
      // only touch ingest logs
      if (!file.startsWith("ingest-") || !file.endsWith(".log")) continue;

      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);

      const age = now - stats.mtimeMs;
      if (age > maxAgeMs) {
        fs.unlinkSync(filePath);
        logIngest(`Deleted old log file: ${file}`, "INFO");
      }
    }
  } catch (err) {
    console.error("Log cleanup failed:", err.message);
  }
}

/* -------------------- */
/* UTILS */
/* -------------------- */

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// CSV Ingest State
function getIngestStatePath() {
  const now = new Date();
  const ym = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
  return path.join(USER_DATA_PATH, `csv_ingest_${ym}.json`);
}

function getIngestState() {
  const p = getIngestStatePath();
  if (!fs.existsSync(p)) {
    return { rows: 0, fileSize: 0, mtimeMs: 0 };
  }

  try {
    return JSON.parse(fs.readFileSync(p));
  } catch {
    return { rows: 0, fileSize: 0, mtimeMs: 0 };
  }
}

function saveIngestState(state) {
  fs.writeFileSync(getIngestStatePath(), JSON.stringify(state));
}

/* Get Current Month CSV Path */
function getCurrentMonthCSV() {
  const now = new Date();
  const ym = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
  return path.join(CSV_PATH, `attendance_${ym}.csv`);
}

/* CSV Reader */
function readCSV() {
  if (!CSV_PATH || !fs.existsSync(CSV_PATH)) return [];

  const csvFile = getCurrentMonthCSV();
  if (!fs.existsSync(csvFile)) return [];

  try {
    const file = fs.readFileSync(csvFile);
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    logIngest(`CSV read error: ${err.message}`, "ERROR");
    return [];
  }
}

function notifyChange(employeeId = null, date = null) {
  if (process.send) {
    process.send({
      type: "attendance:invalidated",
      employeeId,
      date,
    });
  }
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function backupDatabaseIfNeeded() {
  if (!USER_DATA_PATH) {
    console.warn("USER_DATA_PATH not set, skipping DB backup");
    return;
  }

  const dateKey = getYesterdayDate(); // previous completed day
  const monthKey = dateKey.slice(0, 7); // YYYY-MM

  const backupsRoot = path.join(USER_DATA_PATH, "backups", monthKey);

  ensureDir(backupsRoot);

  const backupFile = path.join(backupsRoot, `attendance-${dateKey}.db`);

  // prevent duplicate backup
  if (fs.existsSync(backupFile)) {
    console.log("DB backup already exists for", dateKey);
    return;
  }

  const dbPath = path.join(__dirname, "attendance.db");

  if (!fs.existsSync(dbPath)) {
    console.warn("attendance.db not found, skipping backup");
    return;
  }

  console.log("Creating DB backup for", dateKey);

  // SQLite-safe backup using existing connection
  db.backup(backupFile);

  console.log("DB backup completed:", backupFile);
}

/* CSV → Sqlite Ingest */
function ingestCSVToDB() {
  const rows = readCSV();
  console.log("CSV rows read:", rows.length);

  // No CSV / empty CSV
  if (!rows.length) return;

  // Read last ingested row count (per-month)
  const csvFile = getCurrentMonthCSV();
  const stats = fs.statSync(csvFile);

  let { rows: lastRow, fileSize, mtimeMs } = getIngestState();

  // MUTATION DETECTION
  const fileShrank = stats.size < fileSize;
  const fileRewritten = stats.mtimeMs !== mtimeMs;

  if (fileShrank || fileRewritten) {
    logIngest(`CSV mutation detected (shrank=${fileShrank}, rewritten=${fileRewritten}) → reset`, "WARN");
    lastRow = 0;
  }

  // SELF-HEALING LOGIC
  // If DB is empty but ingest state exists, reset ingest state
  const dbCount = db.prepare("SELECT COUNT(*) AS c FROM attendance_logs").get().c;

  if (dbCount === 0 && lastRow > 0) {
    console.warn("DB empty but ingest state exists → resetting ingest state");
    lastRow = 0;
  }

  // Only ingest new rows
  const newRows = rows.slice(lastRow);
  if (!newRows.length) {
    saveIngestState({
      rows: rows.length,
      fileSize: stats.size,
      mtimeMs: stats.mtimeMs,
    });
    logIngest(`No new rows. lastRow=${lastRow}, totalRows=${rows.length}`);
    return;
  }

  const insertEmployee = db.prepare(`
    INSERT OR IGNORE INTO employees (id, name)
    VALUES (?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO attendance_logs
    (employee_id, date, time, type, source)
    VALUES (?, ?, ?, ?, 'Biometric')
  `);

  db.transaction(() => {
    for (const r of newRows) {
      if (!r.UserID) continue;

      insertEmployee.run(r.UserID, r.EmployeeName || r.UserID);

      insertLog.run(r.UserID, r.Date, r.Time.slice(0, 5), r.Status);
    }
  })();

  logIngest(`Ingest completed. Inserted=${newRows.length}, totalRows=${rows.length}`);

  // Save new ingest checkpoint
  saveIngestState({
    rows: rows.length,
    fileSize: stats.size,
    mtimeMs: stats.mtimeMs,
  });

  // Notify Electron UI
  notifyChange();
}

/* CSV File Watcher (Debounced) */
let ingestTimeout = null;

if (fs.existsSync(CSV_PATH)) {
  fs.watch(CSV_PATH, (event, filename) => {
    if (!filename) {
      logIngest("fs.watch filename missing → fallback ingest", "WARN");
      ingestCSVToDB();
      return;
    }

    const current = path.basename(getCurrentMonthCSV());
    if (filename !== current) return;

    if (ingestTimeout) clearTimeout(ingestTimeout);

    ingestTimeout = setTimeout(() => {
      console.log("Current month CSV updated → ingest");
      ingestCSVToDB();
    }, 300);
  });
}

/* Startup Tasks → Backup + Ingest on StartUp + Log Cleanup */
cleanupOldLogs(30);
backupDatabaseIfNeeded();
ingestCSVToDB();

function isPastDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();

  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return d < today;
}

function getDatesInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();

  const result = [];
  for (let d = 1; d <= days; d++) {
    result.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return result;
}

/* Internal Auth Middleware */
app.use((req, res, next) => {
  // allow health check if you want later
  const token = req.headers["x-internal-token"];

  if (!INTERNAL_TOKEN || token !== INTERNAL_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
});

/* Logs Api (SQLITE) */
app.get("/api/logs/:employeeId", (req, res) => {
  const employeeId = req.params.employeeId;
  const { date, from, to } = req.query;

  let rows;

  if (date) {
    // single-day fetch
    rows = db
      .prepare(
        `
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ? AND date = ?
      ORDER BY time
    `
      )
      .all(employeeId, date);
  } else if (from && to) {
    // range fetch (logs console)
    rows = db
      .prepare(
        `
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ?
        AND date BETWEEN ? AND ?
      ORDER BY date, time
    `
      )
      .all(employeeId, from, to);
  } else {
    // fallback (temporary, will remove later)
    rows = db
      .prepare(
        `
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ?
      ORDER BY date, time
    `
      )
      .all(employeeId);
  }

  res.json(rows);
});

/* Attendance Summary API (SQLITE) */
app.get("/api/attendance/:employeeId", (req, res) => {
  const employeeId = req.params.employeeId;
  const { month } = req.query; // optional YYYY-MM

  let rows;

  if (month) {
    const from = `${month}-01`;
    const to = `${month}-31`;

    // fetch existing attendance rows
    rows = db
      .prepare(
        `
    SELECT
      date,
      MIN(CASE WHEN type = 'IN'  THEN time END) AS firstIn,
      MAX(CASE WHEN type = 'OUT' THEN time END) AS lastOut
    FROM attendance_logs
    WHERE employee_id = ?
      AND date BETWEEN ? AND ?
    GROUP BY date
  `
      )
      .all(employeeId, from, to);

    // index by date
    const byDate = {};
    for (const r of rows) byDate[r.date] = r;

    // generate full month
    const allDates = getDatesInMonth(month);

    const result = allDates.map((date) => {
      const r = byDate[date];

      // No Entry + Day Passed → ABSENT
      if (!r) {
        return {
          date,
          status: isPastDate(date) ? "Absent" : "Pending",
          firstIn: null,
          lastOut: null,
          workedMinutes: 0,
        };
      }

      let status = "Absent";
      let workedMinutes = 0;

      if (r.firstIn && r.lastOut) {
        const inMin = timeToMinutes(r.firstIn);
        const outMin = timeToMinutes(r.lastOut);

        if (outMin > inMin) {
          workedMinutes = outMin - inMin;

          if (workedMinutes >= 8 * 60) status = "Present";
          else if (workedMinutes >= 5 * 60) status = "Half Day";
        }
      }

      return {
        date,
        status,
        firstIn: r.firstIn,
        lastOut: r.lastOut,
        workedMinutes,
      };
    });

    return res.json(result);
  } else {
    // fallback: all dates for employee
    rows = db
      .prepare(
        `
      SELECT
        date,
        MIN(CASE WHEN type = 'IN'  THEN time END) AS firstIn,
        MAX(CASE WHEN type = 'OUT' THEN time END) AS lastOut
      FROM attendance_logs
      WHERE employee_id = ?
      GROUP BY date
      ORDER BY date
    `
      )
      .all(employeeId);
  }

  const result = rows.map((r) => {
    let status = "Absent";
    let workedMinutes = 0;

    if (r.firstIn && r.lastOut) {
      const inMin = timeToMinutes(r.firstIn);
      const outMin = timeToMinutes(r.lastOut);

      if (inMin !== null && outMin !== null && outMin > inMin) {
        workedMinutes = outMin - inMin;

        if (workedMinutes >= 8 * 60) {
          status = "Present"; // Full Day
        } else if (workedMinutes >= 5 * 60) {
          status = "Half Day";
        } else {
          status = "Absent";
        }
      }
    }

    return {
      date: r.date,
      status,
      firstIn: r.firstIn || null,
      lastOut: r.lastOut || null,
      workedMinutes, // optional (future use)
    };
  });

  res.json(result);
});

/* Employees API (SQLITE) */
app.get("/api/employees", (req, res) => {
  const employees = db.prepare("SELECT id AS employeeId, name FROM employees").all();

  res.json(employees);
});

/* Start Server */
app.listen(SERVER_PORT, "127.0.0.1", () => {
  console.log(`Backend running on http://127.0.0.1:${SERVER_PORT}`);
});
