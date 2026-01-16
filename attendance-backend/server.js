import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import db from "./db.js";

const app = express();
app.use(cors());

/* ---------------------------------------
   PATH SETUP (ESM SAFE)
--------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, "data", "attendance.csv");

/* ---------------------------------------
   CSV READER (HARDENED)
--------------------------------------- */
function readCSV() {
  if (!fs.existsSync(CSV_PATH)) {
    console.warn("⚠️ CSV not found, skipping read");
    return [];
  }

  try {
    const file = fs.readFileSync(CSV_PATH);
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch (err) {
    console.error("❌ Failed to read CSV:", err.message);
    return [];
  }
}

/* ---------------------------------------
   CSV → SQLITE INGEST (IDEMPOTENT)
--------------------------------------- */
function ingestCSVToDB() {
  const rows = readCSV();
  if (!rows.length) return;

  const insertEmployee = db.prepare(`
    INSERT OR IGNORE INTO employees (id, name)
    VALUES (?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO attendance_logs
    (employee_id, date, time, type, source)
    VALUES (?, ?, ?, ?, 'Biometric')
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.UserID) continue;

      insertEmployee.run(r.UserID, r.EmployeeName);

      if (r.Date && r.Time && r.Status) {
        insertLog.run(
          r.UserID,
          r.Date,
          r.Time.slice(0, 5),
          r.Status
        );
      }
    }
  });

  tx();
}

/* ---------------------------------------
   CSV FILE WATCHER (DEBOUNCED)
--------------------------------------- */
let ingestTimeout = null;

if (fs.existsSync(CSV_PATH)) {
  fs.watch(CSV_PATH, { persistent: true }, (eventType) => {
    if (eventType !== "change") return;

    if (ingestTimeout) clearTimeout(ingestTimeout);

    ingestTimeout = setTimeout(() => {
      console.log("📄 CSV changed → re-ingesting");
      ingestCSVToDB();
    }, 300);
  });
}

/* 👉 INGEST ON STARTUP */
ingestCSVToDB();

/* ---------------------------------------
   LOGS API (SQLITE ✅)
--------------------------------------- */
app.get("/api/logs/:employeeId", (req, res) => {
  const employeeId = req.params.employeeId;
  const { date, from, to } = req.query;

  let rows;

  if (date) {
    // ✅ single-day fetch
    rows = db.prepare(`
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ? AND date = ?
      ORDER BY time
    `).all(employeeId, date);

  } else if (from && to) {
    // ✅ range fetch (logs console)
    rows = db.prepare(`
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ?
        AND date BETWEEN ? AND ?
      ORDER BY date, time
    `).all(employeeId, from, to);

  } else {
    // ❌ fallback (temporary, will remove later)
    rows = db.prepare(`
      SELECT date, time, type, source
      FROM attendance_logs
      WHERE employee_id = ?
      ORDER BY date, time
    `).all(employeeId);
  }

  res.json(rows);
});

/* ---------------------------------------
   ATTENDANCE SUMMARY API (SQLITE)
--------------------------------------- */
app.get("/api/attendance/:employeeId", (req, res) => {
  const employeeId = req.params.employeeId;
  const { month } = req.query; // optional YYYY-MM

  let rows;

  if (month) {
    // YYYY-MM → YYYY-MM-01 to YYYY-MM-31 (safe for TEXT dates)
    const from = `${month}-01`;
    const to = `${month}-31`;

    rows = db.prepare(`
      SELECT
        date,
        MIN(CASE WHEN type = 'IN'  THEN time END) AS firstIn,
        MAX(CASE WHEN type = 'OUT' THEN time END) AS lastOut
      FROM attendance_logs
      WHERE employee_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date
    `).all(employeeId, from, to);
  } else {
    // fallback: all dates for employee
    rows = db.prepare(`
      SELECT
        date,
        MIN(CASE WHEN type = 'IN'  THEN time END) AS firstIn,
        MAX(CASE WHEN type = 'OUT' THEN time END) AS lastOut
      FROM attendance_logs
      WHERE employee_id = ?
      GROUP BY date
      ORDER BY date
    `).all(employeeId);
  }

  const result = rows.map(r => ({
    date: r.date,
    status: r.firstIn && r.lastOut ? "Present" : "Half Day",
    firstIn: r.firstIn || null,
    lastOut: r.lastOut || null,
  }));

  res.json(result);
});

/* ---------------------------------------
   EMPLOYEES API (SQLITE ✅)
--------------------------------------- */
app.get("/api/employees", (req, res) => {
  const employees = db
    .prepare("SELECT id AS employeeId, name FROM employees")
    .all();

  res.json(employees);
});

/* ---------------------------------------
   START SERVER
--------------------------------------- */
app.listen(4000, () =>
  console.log("✅ Backend running on http://localhost:4000")
);
