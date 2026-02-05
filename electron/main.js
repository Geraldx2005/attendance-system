import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from "electron";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import Store from "electron-store";
import fs from "fs";
import { timeToMinutes as utilTimeToMinutes } from "./dateTimeUtils.js";

let db;

/* ================= SINGLE INSTANCE LOCK ================= */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/* ================= STORE ================= */
const store = new Store();

/* ================= CONFIG ================= */
const SERVICE_EXE = "C:\\essl\\service\\EsslCsvExporterService.exe";
const HEALTH_STATUS_FILE = "C:\\essl\\health\\status.json";
const DEFAULT_CSV_PATH = "C:\\essl\\data";
/* ========================================= */

/* ================= INTERNAL TOKEN ================= */
function generateInternalToken() {
  return Math.random().toString(36).slice(2) + Date.now();
}
const INTERNAL_TOKEN = generateInternalToken();

/* ================= PATH SETUP ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendStarted = false;

/* ================= CSV PATH ================= */
function ensureCSVPath() {
  let csvPath = store.get("csvPath");
  if (!csvPath) {
    csvPath = DEFAULT_CSV_PATH;
    store.set("csvPath", csvPath);
  }
  return csvPath;
}

/* ================= AUTO SYNC TIME ================= */
function getAutoSyncTime() {
  try {
    if (!fs.existsSync(HEALTH_STATUS_FILE)) return null;

    const raw = fs.readFileSync(HEALTH_STATUS_FILE, "utf-8");
    const json = JSON.parse(raw);

    if (!json.lastSuccess) return null;

    const iso = json.lastSuccess.replace(" ", "T");
    return new Date(iso).toISOString();
  } catch (err) {
    console.error("Failed to read health status.json:", err.message);
    return null;
  }
}

/* ================= IPC → RENDERER ================= */
function notifyAttendanceInvalidation(payload) {
  if (!mainWindow) return;
  mainWindow.webContents.send("attendance:invalidated", payload);
}

/* ================= WINDOW ================= */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../assets/icon.ico"),
    backgroundColor: "#0f0f0f",
    show: false,

    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: "default",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [`--internal-token=${INTERNAL_TOKEN}`],
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
}

/* ================= HELPER FUNCTIONS ================= */
function timeToMinutes(time) {
  return utilTimeToMinutes(time);
}

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

/* ================= IPC HANDLERS - SETTINGS ================= */
ipcMain.handle("select-csv-path", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Select Attendance CSV Folder",
    defaultPath: ensureCSVPath(),
    properties: ["openDirectory"],
  });

  if (canceled || !filePaths.length) return null;

  store.set("csvPath", filePaths[0]);
  process.env.CSV_PATH = filePaths[0];
  return filePaths[0];
});

ipcMain.handle("get-csv-path", () => ensureCSVPath());

ipcMain.handle("set-csv-path", (_, newPath) => {
  if (!newPath || !fs.existsSync(newPath)) {
    return { ok: false, error: "File not found" };
  }
  store.set("csvPath", newPath);
  process.env.CSV_PATH = newPath;
  return { ok: true };
});

/* ================= IPC HANDLERS - SYNC ================= */
ipcMain.handle("manual-sync", async () => {
  return new Promise((resolve) => {
    execFile(SERVICE_EXE, ["manual"], { windowsHide: true }, (error) => {
      if (error) {
        let msg = "Manual sync failed";
        if (error.code === "ENOENT") msg = "Sync service not found";
        else if (error.message?.toLowerCase().includes("timeout")) msg = "Device not reachable";

        return resolve({ ok: false, error: msg });
      }
      resolve({ ok: true, syncedAt: new Date().toISOString() });
    });
  });
});

ipcMain.handle("full-sync", async () => {
  return new Promise((resolve) => {
    execFile(SERVICE_EXE, ["full"], { windowsHide: true }, (error) => {
      if (error) {
        let msg = "Full sync failed";
        if (error.code === "ENOENT") msg = "Sync service not found";
        else if (error.message?.toLowerCase().includes("timeout")) msg = "Device not reachable";

        return resolve({ ok: false, error: msg });
      }
      resolve({ ok: true, syncedAt: new Date().toISOString() });
    });
  });
});

ipcMain.handle("get-auto-sync-time", () => {
  return { autoSyncAt: getAutoSyncTime() };
});

/* ================= IPC HANDLERS - API ================= */

// GET /api/employees
ipcMain.handle("api:get-employees", () => {
  try {
    const employees = db
      .prepare(
        `
      SELECT 
        id AS employeeId,
        name
      FROM employees
      ORDER BY 
        CAST(REPLACE(REPLACE(REPLACE(id, 'EMP', ''), 'FT', ''), '-', '') AS INTEGER),
        id
    `,
      )
      .all();

    return employees;
  } catch (err) {
    console.error("api:get-employees error:", err);
    throw err;
  }
});

// GET /api/logs/:employeeId
ipcMain.handle("api:get-logs", (_, { employeeId, date, from, to }) => {
  try {
    let rows;

    if (date) {
      // Single-day punches
      rows = db
        .prepare(
          `
        SELECT date, time, source
        FROM attendance_logs
        WHERE employee_id = ?
          AND date = ?
        ORDER BY time
      `,
        )
        .all(employeeId, date);
    } else if (from && to) {
      // Range punches (logs console)
      rows = db
        .prepare(
          `
        SELECT date, time, source
        FROM attendance_logs
        WHERE employee_id = ?
          AND date BETWEEN ? AND ?
        ORDER BY date, time
      `,
        )
        .all(employeeId, from, to);
    } else {
      // All punches (fallback)
      rows = db
        .prepare(
          `
        SELECT date, time, source
        FROM attendance_logs
        WHERE employee_id = ?
        ORDER BY date, time
      `,
        )
        .all(employeeId);
    }

    return rows;
  } catch (err) {
    console.error("api:get-logs error:", err);
    throw err;
  }
});

// GET /api/attendance/:employeeId
ipcMain.handle("api:get-attendance", (_, { employeeId, month }) => {
  try {
    let rows;

    if (month) {
      const from = `${month}-01`;
      const to = `${month}-31`;

      // Fetch RAW punches only
      rows = db
        .prepare(
          `
        SELECT date, time
        FROM attendance_logs
        WHERE employee_id = ?
          AND date BETWEEN ? AND ?
        ORDER BY date, time
      `,
        )
        .all(employeeId, from, to);

      // Group punches by date
      const byDate = {};
      for (const r of rows) {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r.time);
      }

      // Generate full month calendar
      const allDates = getDatesInMonth(month);

      const result = allDates.map((date) => {
        const punches = byDate[date] || [];

        // No punches
        if (!punches.length) {
          return {
            date,
            status: isPastDate(date) ? "Absent" : "Pending",
            firstIn: null,
            lastOut: null,
            workedMinutes: 0,
          };
        }

        // Derive IN / OUT
        const firstIn = punches[0];
        const lastOut = punches[punches.length - 1];

        let workedMinutes = 0;
        let status = "Absent";

        const inMin = timeToMinutes(firstIn);
        const outMin = timeToMinutes(lastOut);

        if (inMin !== null && outMin !== null && outMin > inMin) {
          workedMinutes = outMin - inMin;

          if (workedMinutes >= 8 * 60) status = "Present";
          else if (workedMinutes >= 5 * 60) status = "Half Day";
        }

        return {
          date,
          status,
          firstIn,
          lastOut,
          workedMinutes,
        };
      });

      return result;
    }

    /* -------- Fallback: all dates (no month filter) -------- */

    rows = db
      .prepare(
        `
      SELECT date, time
      FROM attendance_logs
      WHERE employee_id = ?
      ORDER BY date, time
    `,
      )
      .all(employeeId);

    const byDate = {};
    for (const r of rows) {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r.time);
    }

    const result = Object.entries(byDate).map(([date, punches]) => {
      const firstIn = punches[0];
      const lastOut = punches[punches.length - 1];

      let workedMinutes = 0;
      let status = "Absent";

      const inMin = timeToMinutes(firstIn);
      const outMin = timeToMinutes(lastOut);

      if (inMin !== null && outMin !== null && outMin > inMin) {
        workedMinutes = outMin - inMin;

        if (workedMinutes >= 8 * 60) status = "Present";
        else if (workedMinutes >= 5 * 60) status = "Half Day";
      }

      return {
        date,
        status,
        firstIn,
        lastOut,
        workedMinutes,
      };
    });

    return result;
  } catch (err) {
    console.error("api:get-attendance error:", err);
    throw err;
  }
});

// POST /api/employees/:employeeId (update name)
ipcMain.handle("api:update-employee", (_, { employeeId, name }) => {
  try {
    if (!name || !name.trim()) {
      throw new Error("Name required");
    }

    db.prepare(
      `
    UPDATE employees
    SET name = ?
    WHERE id = ?
  `,
    ).run(name.trim(), employeeId);

    // Notify UI to refresh lists
    notifyAttendanceInvalidation({ employeeId });

    return { ok: true };
  } catch (err) {
    console.error("api:update-employee error:", err);
    throw err;
  }
});

/* ================= APP START ================= */
app.whenReady().then(async () => {
  nativeTheme.themeSource = "dark";

  // STEP 1: SET ENV VARS FIRST
  process.env.USER_DATA_PATH = app.getPath("userData");
  process.env.CSV_PATH = ensureCSVPath();

  console.log("User Data Path:", process.env.USER_DATA_PATH);
  console.log("CSV Path:", process.env.CSV_PATH);

  // STEP 2: Import and initialize DB
  const { initDB } = await import("./backend/db.js");
  db = initDB();

  // STEP 3: Start ingest service
  if (!backendStarted) {
    const { startIngestService } = await import("./backend/ingest.js");
    startIngestService({
      csvPath: process.env.CSV_PATH,
      userDataPath: app.getPath("userData"),
      onInvalidate: notifyAttendanceInvalidation,
    });

    backendStarted = true;
  }

  // STEP 4: Create window
  createWindow();
});

// QUIT
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});