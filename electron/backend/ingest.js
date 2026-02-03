import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import db from "./db.js";

let ingestRunning = false;
let onInvalidateCallback = null;
let USER_DATA_PATH = null;

/* FILE LOGGER */
function getLogDir() {
  return path.join(USER_DATA_PATH, "logs");
}

function getIngestLogPath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(getLogDir(), `ingest-${date}.log`);
}

function logIngest(message, level = "INFO") {
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;

    fs.appendFileSync(getIngestLogPath(), line);
  } catch (err) {
    console.error("Failed to write ingest log:", err.message);
  }
}

/* LOG CLEANUP (30 DAYS) */
function cleanupOldLogs(days = 30) {
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.startsWith("ingest-") || !file.endsWith(".log")) continue;

      const filePath = path.join(logDir, file);
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

/* UTILS */
function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getIngestStatePath() {
  return path.join(USER_DATA_PATH, "csv_ingest_state.json");
}

function getIngestState() {
  const p = getIngestStatePath();
  if (!fs.existsSync(p)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(p));
  } catch {
    return {};
  }
}

function saveIngestState(state) {
  fs.writeFileSync(getIngestStatePath(), JSON.stringify(state, null, 2));
}

/* Get ALL attendance CSV files */
function getAllAttendanceCSVs() {
  if (!process.env.CSV_PATH || !fs.existsSync(process.env.CSV_PATH)) {
    return [];
  }

  try {
    const files = fs.readdirSync(process.env.CSV_PATH);

    return files
      .filter((f) => f.startsWith("attendance_") && f.endsWith(".csv"))
      .map((f) => path.join(process.env.CSV_PATH, f))
      .sort();
  } catch (err) {
    logIngest(`Failed to list CSV files: ${err.message}`, "ERROR");
    return [];
  }
}

/* CSV Reader */
function readCSV(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) return [];

  try {
    const file = fs.readFileSync(csvFilePath);
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    logIngest(
      `CSV read error (${path.basename(csvFilePath)}): ${err.message}`,
      "ERROR"
    );
    return [];
  }
}

function notifyChange(employeeId = null, date = null) {
  if (typeof onInvalidateCallback === "function") {
    onInvalidateCallback({ employeeId, date });
  }
}

function backupDatabaseIfNeeded() {
  if (!USER_DATA_PATH) {
    console.warn("USER_DATA_PATH not set, skipping DB backup");
    return;
  }

  const dateKey = getYesterdayDate();
  const monthKey = dateKey.slice(0, 7);

  const backupsRoot = path.join(USER_DATA_PATH, "backups", monthKey);

  ensureDir(backupsRoot);

  const backupFile = path.join(backupsRoot, `attendance-${dateKey}.db`);

  if (fs.existsSync(backupFile)) {
    console.log("DB backup already exists for", dateKey);
    return;
  }

  const dbPath = path.join(USER_DATA_PATH, "attendance.db");

  if (!fs.existsSync(dbPath)) {
    console.warn("attendance.db not found, skipping backup");
    return;
  }

  console.log("Creating DB backup for", dateKey);
  db.backup(backupFile);
  console.log("DB backup completed:", backupFile);
}

/* CSV → SQLite Ingest */
export function ingestCSVToDB() {
  if (ingestRunning) {
    logIngest("Ingest already running → skipped", "WARN");
    return;
  }

  ingestRunning = true;

  try {
    const csvFiles = getAllAttendanceCSVs();

    if (!csvFiles.length) {
      logIngest("No CSV files found", "WARN");
      console.log("No CSV files found in:", process.env.CSV_PATH);
      return;
    }

    console.log(
      `Found ${csvFiles.length} CSV file(s):`,
      csvFiles.map((f) => path.basename(f))
    );

    /* Self-healing: Detect empty DB */
    const dbCount = db
      .prepare("SELECT COUNT(*) AS c FROM attendance_logs")
      .get().c;
    let ingestState = getIngestState();

    const hasStateButEmptyDB =
      Object.keys(ingestState).length > 0 && dbCount === 0;

    if (hasStateButEmptyDB) {
      logIngest(
        "⚠️  DB is empty but ingest state exists → RESETTING all state",
        "WARN"
      );
      console.log("⚠️  Self-healing: DB empty, resetting ingest state");
      ingestState = {};
    }

    let totalNewRows = 0;

    /* Prepared statements */
    const insertEmployee = db.prepare(`
      INSERT OR IGNORE INTO employees (id, name)
      VALUES (?, ?)
    `);

    const insertLog = db.prepare(`
      INSERT OR IGNORE INTO attendance_logs
      (employee_id, date, time, source)
      VALUES (?, ?, ?, 'Biometric')
    `);

    /* Process each CSV file */
    for (const csvFile of csvFiles) {
      const fileName = path.basename(csvFile);
      const stats = fs.statSync(csvFile);

      const fileState = ingestState[fileName] || { rows: 0, fileSize: 0 };

      // Detect file truncation
      const fileShrank = stats.size < fileState.fileSize;
      if (fileShrank) {
        logIngest(
          `${fileName} truncated (${stats.size} < ${fileState.fileSize}) → reset`,
          "WARN"
        );
        fileState.rows = 0;
      }

      // Read CSV
      const rows = readCSV(csvFile);
      if (!rows.length) {
        logIngest(`${fileName}: No rows found`, "INFO");
        continue;
      }

      // Extract new rows
      const newRows = rows.slice(fileState.rows);

      if (!newRows.length) {
        ingestState[fileName] = {
          rows: rows.length,
          fileSize: stats.size,
        };
        continue;
      }

      // Sort new rows
      newRows.sort((a, b) => {
        if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
        if (a.UserID !== b.UserID) return a.UserID.localeCompare(b.UserID);
        return a.Time.localeCompare(b.Time);
      });

      /* Insert new rows */
      db.transaction(() => {
        for (const r of newRows) {
          if (!r.UserID || !r.Date || !r.Time) continue;

          const employeeName = r.EmployeeName || r.Name || `Employee ${r.UserID}`;

          insertEmployee.run(r.UserID, employeeName);
          insertLog.run(r.UserID, r.Date, r.Time);
        }
      })();

      totalNewRows += newRows.length;

      logIngest(
        `${fileName}: Inserted ${newRows.length} new rows (total: ${rows.length})`,
        "INFO"
      );

      ingestState[fileName] = {
        rows: rows.length,
        fileSize: stats.size,
      };
    }

    saveIngestState(ingestState);

    if (totalNewRows > 0) {
      console.log(
        `✓ Ingested ${totalNewRows} new rows from ${csvFiles.length} file(s)`
      );
      logIngest(`Total ingested: ${totalNewRows} rows`, "INFO");
      notifyChange();
    } else {
      console.log("No new data to ingest");
    }
  } catch (err) {
    logIngest(`Ingest failed: ${err.message}`, "ERROR");
    console.error("Ingest error:", err);
    throw err;
  } finally {
    ingestRunning = false;
  }
}

/* CSV Watcher */
let ingestTimeout = null;

function attachCSVWatcher() {
  if (!process.env.CSV_PATH) return;
  if (!fs.existsSync(process.env.CSV_PATH)) return;

  fs.watch(process.env.CSV_PATH, (event, filename) => {
    if (!filename) return;

    if (!filename.startsWith("attendance_") || !filename.endsWith(".csv"))
      return;

    if (ingestTimeout) clearTimeout(ingestTimeout);

    ingestTimeout = setTimeout(() => {
      console.log(`CSV changed (${filename}) → ingesting`);
      ingestCSVToDB();
    }, 300);
  });
}

/* Start Service */
export function startIngestService({ csvPath, userDataPath, onInvalidate }) {
  USER_DATA_PATH = userDataPath;
  onInvalidateCallback = onInvalidate;

  cleanupOldLogs(30);
  backupDatabaseIfNeeded();
  ingestCSVToDB();
  attachCSVWatcher();

  console.log("✓ Ingest service started");
}