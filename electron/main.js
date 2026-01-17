import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

/* ---------------------------------------
   IPC EMITTER
--------------------------------------- */
function notifyAttendanceInvalidation(payload) {
  if (!mainWindow) return;

  mainWindow.webContents.send(
    "attendance:invalidated",
    payload
  );
}

/* ---------------------------------------
   START BACKEND
--------------------------------------- */
function startBackend() {
  const backendPath = path.join(
    process.cwd(),
    "attendance-backend",
    "server.js"
  );

  backendProcess = spawn("node", [backendPath], {
    stdio: ["inherit", "inherit", "inherit", "ipc"], // 👈 IMPORTANT
  });

  backendProcess.on("message", (msg) => {
    if (msg?.type === "attendance:invalidated") {
      notifyAttendanceInvalidation(msg);
    }
  });
}

/* ---------------------------------------
   WINDOW
--------------------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
