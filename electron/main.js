import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { spawn, execFile } from "child_process";
import { fileURLToPath } from "url";
import Store from "electron-store";
import fs from "fs";

const store = new Store();

/* ================= CONFIG ================= */
const SERVICE_EXE = "C:\\essl\\service\\EsslCsvExporterService.exe";
const HEALTH_STATUS_FILE = "C:\\essl\\health\\status.json";
const SERVER_PORT = 47832;
const DEFAULT_CSV_PATH = "C:\\essl\\data";
/* ========================================== */

/* Internal token */
function generateInternalToken() {
  return Math.random().toString(36).slice(2) + Date.now();
}
const INTERNAL_TOKEN = generateInternalToken();

/* Path setup */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

/* CSV Path */
function ensureCSVPath() {
  let csvPath = store.get("csvPath");
  if (!csvPath) {
    csvPath = DEFAULT_CSV_PATH;
    store.set("csvPath", csvPath);
  }
  return csvPath;
}

/* 🔥 AUTO SYNC TIME (from status.json) */
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

/* IPC → Renderer */
function notifyAttendanceInvalidation(payload) {
  if (!mainWindow) return;
  mainWindow.webContents.send("attendance:invalidated", payload);
}

/* Backend */
function startBackend() {
  const backendPath = path.join(process.cwd(), "attendance-backend", "server.js");

  backendProcess = spawn("node", [backendPath], {
    env: {
      ...process.env,
      CSV_PATH: ensureCSVPath(),
      USER_DATA_PATH: app.getPath("userData"),
      SERVER_PORT,
      INTERNAL_TOKEN,
    },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  backendProcess.on("message", (msg) => {
    if (msg?.type === "attendance:invalidated") {
      notifyAttendanceInvalidation(msg);
    }
  });
}

function restartBackend() {
  if (backendProcess) backendProcess.kill();
  startBackend();
}

/* Window */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [`--internal-token=${INTERNAL_TOKEN}`],
    },
  });

  mainWindow.loadURL("http://localhost:5173");
}

/* ================= IPC HANDLERS ================= */

// CSV picker
ipcMain.handle("select-csv-path", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Select Attendance CSV Folder",
    defaultPath: ensureCSVPath(),
    properties: ["openDirectory"],
  });

  if (canceled || !filePaths.length) return null;

  store.set("csvPath", filePaths[0]);
  restartBackend();
  return filePaths[0];
});

ipcMain.handle("get-csv-path", () => ensureCSVPath());

ipcMain.handle("set-csv-path", (_, newPath) => {
  if (!newPath || !fs.existsSync(newPath)) {
    return { ok: false, error: "File not found" };
  }
  store.set("csvPath", newPath);
  restartBackend();
  return { ok: true };
});

/* Manual Sync */
ipcMain.handle("manual-sync", async () => {
  return new Promise((resolve) => {
    execFile(SERVICE_EXE, ["manual"], { windowsHide: true }, (error) => {
      if (error) {
        let msg = "Manual sync failed";

        if (error.code === "ENOENT") {
          msg = "Sync service not found";
        } else if (error.message?.toLowerCase().includes("timeout")) {
          msg = "Device not reachable";
        }

        return resolve({ ok: false, error: msg });
      }

      // Auto Invalidate Attendance on SUCCESS
      notifyAttendanceInvalidation({ source: "manual-sync" });

      resolve({ ok: true, syncedAt: new Date().toISOString() });
    });
  });
});

/* Full Sync */
ipcMain.handle("full-sync", async () => {
  return new Promise((resolve) => {
    execFile(SERVICE_EXE, ["full"], { windowsHide: true }, (error) => {
      if (error) {
        let msg = "Full sync failed";

        if (error.code === "ENOENT") {
          msg = "Sync service not found";
        } else if (error.message?.toLowerCase().includes("timeout")) {
          msg = "Device not reachable";
        }

        return resolve({ ok: false, error: msg });
      }

      // Auto Invalidate Attendance on SUCCESS
      notifyAttendanceInvalidation({ source: "full-sync" });

      resolve({ ok: true, syncedAt: new Date().toISOString() });
    });
  });
});


/* Auto Sync Time */
ipcMain.handle("get-auto-sync-time", () => {
  return { autoSyncAt: getAutoSyncTime() };
});

/* App lifecycle */
app.whenReady().then(() => {
  ensureCSVPath();
  startBackend();
  createWindow();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
