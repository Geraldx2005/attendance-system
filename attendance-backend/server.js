import express from "express";
import cors from "cors";
import fs from "fs";
import { parse } from "csv-parse/sync";

const app = express();
app.use(cors());

const CSV_PATH = "./data/attendance.csv";// change later

function readCSV() {
  const file = fs.readFileSync(CSV_PATH);
  return parse(file, {
    columns: true,
    skip_empty_lines: true,
  });
}

/* ---------------------------------------
   RAW LOGS API
--------------------------------------- */
app.get("/api/logs/:employeeId", (req, res) => {
  const rows = readCSV();
  const logs = rows
    .filter(r => String(r.UserID) === req.params.employeeId)
    .map(r => ({
      date: r.Date,
      time: r.Time.slice(0, 5),
      type: r.Status,
      source: "Biometric",
    }));

  res.json(logs);
});

/* ---------------------------------------
   ATTENDANCE SUMMARY API
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
   EMPLOYEES LIST (FROM CSV)
--------------------------------------- */
app.get("/api/employees", (req, res) => {
  const rows = readCSV();

  const map = new Map();

  rows.forEach((r) => {
    if (!map.has(r.UserID)) {
      map.set(r.UserID, {
        employeeId: r.UserID,
        name: r.EmployeeName,
      });
    }
  });

  res.json([...map.values()]);
});


app.listen(4000, () =>
  console.log("✅ Backend running on http://localhost:4000")
);
