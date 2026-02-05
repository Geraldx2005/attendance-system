import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import db from "./db.js";
import { normalizeDate, normalizeTime } from "../dateTimeUtils.js";

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
    console.log(line.trim()); // Also log to console
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
  logIngest(`Checking CSV_PATH: ${process.env.CSV_PATH}`, "DEBUG");
  
  if (!process.env.CSV_PATH) {
    logIngest("CSV_PATH is not set!", "ERROR");
    return [];
  }
  
  if (!fs.existsSync(process.env.CSV_PATH)) {
    logIngest(`CSV_PATH does not exist: ${process.env.CSV_PATH}`, "ERROR");
    return [];
  }

  try {
    const files = fs.readdirSync(process.env.CSV_PATH);
    logIngest(`Found ${files.length} total files in CSV_PATH`, "DEBUG");
    
    const csvFiles = files.filter((f) => f.startsWith("attendance_") && f.endsWith(".csv"));
    logIngest(`Filtered to ${csvFiles.length} attendance CSV files: ${csvFiles.join(", ")}`, "INFO");

    return csvFiles
      .map((f) => path.join(process.env.CSV_PATH, f))
      .sort();
  } catch (err) {
    logIngest(`Failed to list CSV files: ${err.message}`, "ERROR");
    return [];
  }
}

/* Remove BOM from string */
function removeBOM(str) {
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

/* CSV Reader with BOM handling */
function readCSV(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) {
    logIngest(`CSV file not found: ${csvFilePath}`, "ERROR");
    return [];
  }

  try {
    const file = fs.readFileSync(csvFilePath);
    const records = parse(file, {
      columns: true,
      skip_empty_lines: true,
      bom: true, // Handle BOM automatically
    });
    
    logIngest(`Read ${records.length} records from ${path.basename(csvFilePath)}`, "DEBUG");
    
    // Normalize column names by removing BOM from all keys
    const normalizedRecords = records.map(record => {
      const normalized = {};
      for (const [key, value] of Object.entries(record)) {
        const cleanKey = removeBOM(key.trim());
        normalized[cleanKey] = value;
      }
      return normalized;
    });
    
    // Log first record to see structure
    if (normalizedRecords.length > 0) {
      logIngest(`Sample record (normalized): ${JSON.stringify(normalizedRecords[0])}`, "DEBUG");
      
      // Log available columns
      const columns = Object.keys(normalizedRecords[0]);
      logIngest(`Available columns: ${columns.join(", ")}`, "DEBUG");
    }
    
    return normalizedRecords;
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
    logIngest("=== Starting CSV Ingest ===", "INFO");
    
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
    
    logIngest(`Current DB row count: ${dbCount}`, "INFO");
    
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
      logIngest(`Processing file: ${fileName}`, "INFO");
      
      const stats = fs.statSync(csvFile);
      logIngest(`File size: ${stats.size} bytes`, "DEBUG");

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

      // Read CSV (with BOM handling)
      const rows = readCSV(csvFile);
      if (!rows.length) {
        logIngest(`${fileName}: No rows found`, "INFO");
        continue;
      }

      logIngest(`${fileName}: Total rows in file: ${rows.length}, Previously processed: ${fileState.rows}`, "INFO");

      // Extract new rows
      const newRows = rows.slice(fileState.rows);

      if (!newRows.length) {
        logIngest(`${fileName}: No new rows to process`, "INFO");
        ingestState[fileName] = {
          rows: rows.length,
          fileSize: stats.size,
        };
        continue;
      }

      logIngest(`${fileName}: Found ${newRows.length} new rows to ingest`, "INFO");

      /* Insert new rows with normalization */
      let insertedCount = 0;
      let skippedCount = 0;
      
      db.transaction(() => {
        for (const r of newRows) {
          // Get raw values (handle different column name cases)
          const rawUserId = r.UserID || r.userId || r.user_id;
          const rawDate = r.Date || r.date || r.DATE;
          const rawTime = r.Time || r.time || r.TIME;
          
          // Normalize date and time for regional format support
          const normalizedDate = normalizeDate(rawDate);
          const normalizedTime = normalizeTime(rawTime);
          
          // Check for required fields and valid normalization
          if (!rawUserId || !normalizedDate || !normalizedTime) {
            logIngest(
              `Skipping invalid row - UserID: ${rawUserId}, Raw Date: ${rawDate} → ${normalizedDate}, Raw Time: ${rawTime} → ${normalizedTime}`,
              "WARN"
            );
            skippedCount++;
            continue;
          }

          const employeeName = r.EmployeeName || r.Name || r.name || `Employee ${rawUserId}`;

          try {
            insertEmployee.run(rawUserId, employeeName);
            // Use normalized date and time in YYYY-MM-DD and HH:MM format
            insertLog.run(rawUserId, normalizedDate, normalizedTime);
            insertedCount++;
            
            // Log first few successful normalizations
            if (insertedCount <= 3) {
              logIngest(
                `Normalized: ${rawDate} → ${normalizedDate}, ${rawTime} → ${normalizedTime}`,
                "DEBUG"
              );
            }
          } catch (err) {
            // Most likely duplicate entry, which is fine due to UNIQUE constraint
            logIngest(`Insert warning for UserID ${rawUserId}: ${err.message}`, "DEBUG");
          }
        }
      })();

      totalNewRows += insertedCount;

      logIngest(
        `${fileName}: Inserted ${insertedCount} new rows, Skipped ${skippedCount} (total: ${rows.length})`,
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
        `✔ Ingested ${totalNewRows} new rows from ${csvFiles.length} file(s)`
      );
      logIngest(`Total ingested: ${totalNewRows} rows`, "INFO");
      
      // Verify employees were added
      const empCount = db.prepare("SELECT COUNT(*) AS c FROM employees").get().c;
      const logCount = db.prepare("SELECT COUNT(*) AS c FROM attendance_logs").get().c;
      logIngest(`Total employees in DB: ${empCount}`, "INFO");
      logIngest(`Total attendance logs in DB: ${logCount}`, "INFO");
      
      notifyChange();
    } else {
      console.log("No new data to ingest");
      logIngest("No new data to ingest", "INFO");
    }
    
    logIngest("=== CSV Ingest Complete ===", "INFO");
  } catch (err) {
    logIngest(`Ingest failed: ${err.message}`, "ERROR");
    logIngest(`Stack trace: ${err.stack}`, "ERROR");
    console.error("Ingest error:", err);
    throw err;
  } finally {
    ingestRunning = false;
  }
}

/* CSV Watcher */
let ingestTimeout = null;

function attachCSVWatcher() {
  if (!process.env.CSV_PATH) {
    logIngest("Cannot attach CSV watcher: CSV_PATH not set", "ERROR");
    return;
  }
  
  if (!fs.existsSync(process.env.CSV_PATH)) {
    logIngest(`Cannot attach CSV watcher: CSV_PATH does not exist: ${process.env.CSV_PATH}`, "ERROR");
    return;
  }

  logIngest(`Attaching CSV watcher to: ${process.env.CSV_PATH}`, "INFO");

  fs.watch(process.env.CSV_PATH, (event, filename) => {
    if (!filename) return;

    if (!filename.startsWith("attendance_") || !filename.endsWith(".csv"))
      return;

    if (ingestTimeout) clearTimeout(ingestTimeout);

    ingestTimeout = setTimeout(() => {
      console.log(`CSV changed (${filename}) → ingesting`);
      logIngest(`CSV changed (${filename}) → triggering ingest`, "INFO");
      ingestCSVToDB();
    }, 300);
  });
}

/* Start Service */
export function startIngestService({ csvPath, userDataPath, onInvalidate }) {
  USER_DATA_PATH = userDataPath;
  onInvalidateCallback = onInvalidate;

  logIngest("=== Starting Ingest Service ===", "INFO");
  logIngest(`User Data Path: ${userDataPath}`, "INFO");
  logIngest(`CSV Path: ${csvPath}`, "INFO");

  cleanupOldLogs(30);
  backupDatabaseIfNeeded();
  ingestCSVToDB();
  attachCSVWatcher();

  console.log("✔ Ingest service started");
  logIngest("✔ Ingest service started", "INFO");
}