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

  const logs = db
    .prepare(`
      SELECT
        date,
        time,
        type,
        source
      FROM attendance_logs
      WHERE employee_id = ?
      ORDER BY date, time
    `)
    .all(employeeId);

  res.json(logs);
});

/* ---------------------------------------
   ATTENDANCE SUMMARY API (STILL CSV)
--------------------------------------- */
app.get("/api/attendance/:employeeId", (req, res) => {
  const rows = readCSV();
  const empRows = rows.filter(
    r => String(r.UserID) === req.params.employeeId
  );

  const byDate = {};

  empRows.forEach(r => {
    byDate[r.Date] ??= [];
    byDate[r.Date].push(r);
  });

  const result = Object.entries(byDate).map(([date, logs]) => {
    const ins = logs.filter(l => l.Status === "IN");
    const outs = logs.filter(l => l.Status === "OUT");

    if (!ins.length || !outs.length) {
      return { date, status: "Half Day" };
    }

    const firstIn = ins.sort((a, b) => a.Time.localeCompare(b.Time))[0];
    const lastOut = outs.sort((a, b) => b.Time.localeCompare(a.Time))[0];

    return {
      date,
      status: "Present",
      firstIn: firstIn.Time.slice(0, 5),
      lastOut: lastOut.Time.slice(0, 5),
    };
  });

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
