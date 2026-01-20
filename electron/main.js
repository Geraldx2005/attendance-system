import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import Store from "electron-store";
import fs from "fs";

const store = new Store();

/* Security Constants */
const SERVER_PORT = 47832;

function generateInternalToken() {
  return Math.random().toString(36).slice(2) + Date.now();
}

const INTERNAL_TOKEN = generateInternalToken();

/* Default CSV Path */
const DEFAULT_CSV_PATH = "C:\\essl\\data\\attendance_raw.csv";

/* Path Setup */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

/* Ensure Default CSV Path */
function ensureCSVPath() {
  let csvPath = store.get("csvPath");

  if (!csvPath) {
    csvPath = DEFAULT_CSV_PATH;
    store.set("csvPath", csvPath);
  }

  return csvPath;
}

/* IPC Emitter */
function notifyAttendanceInvalidation(payload) {
  if (!mainWindow) return;
  mainWindow.webContents.send("attendance:invalidated", payload);
}

/* Start Backend */
function startBackend() {
  const backendPath = path.join(process.cwd(), "attendance-backend", "server.js");

  const csvPath = ensureCSVPath();

  backendProcess = spawn("node", [backendPath], {
    env: {
      ...process.env,
      CSV_PATH: csvPath,
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

/* Restart Backend */
function restartBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
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

/* Setting IPC */
ipcMain.handle("select-csv-path", async () => {
  if (!mainWindow) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Select Attendance CSV",
    defaultPath: ensureCSVPath(),
    filters: [{ name: "CSV Files", extensions: ["csv"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths.length) return null;

  store.set("csvPath", filePaths[0]);
  restartBackend();

  return filePaths[0];
});

ipcMain.handle("get-csv-path", () => {
  return ensureCSVPath();
});

ipcMain.handle("set-csv-path", (_, newPath) => {
  if (!newPath || !fs.existsSync(newPath)) {
    return { ok: false, error: "File not found" };
  }

  store.set("csvPath", newPath);
  restartBackend();

  return { ok: true };
});

/* App Lifecycle */
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
