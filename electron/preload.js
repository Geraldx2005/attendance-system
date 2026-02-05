const { contextBridge, ipcRenderer } = require("electron");

/* Extract internal token */
const tokenArg = process.argv.find((arg) => arg.startsWith("--internal-token="));

const INTERNAL_TOKEN = tokenArg ? tokenArg.split("=")[1] : null;

/* ─── IPC Event Bus ──────────────────────────────────────────────────────────
 * contextBridge proxies function arguments across the isolated-world
 * boundary.  Every call to onAttendanceInvalidated(cb) receives a DIFFERENT
 * proxy object even when the renderer passes the same function reference.
 * Any removal strategy that relies on matching the cb (WeakMap, ===) silently
 * fails and listeners accumulate.
 *
 * Fix: one permanent ipcRenderer.on registered here at init time.  An
 * internal Map<number, cb> holds the active subscribers.  on() pushes an
 * entry and returns its numeric id.  off() deletes by that id.  No
 * function-identity comparison is ever needed.
 * ─────────────────────────────────────────────────────────────────────────── */
let nextId = 0;
const attendanceListeners = new Map();

// Single, permanent listener. Never added again, never removed.
ipcRenderer.on("attendance:invalidated", (_, data) => {
  for (const cb of [...attendanceListeners.values()]) {
    try {
      cb(data);
    } catch (_e) {
      /* isolate */
    }
  }
});

contextBridge.exposeInMainWorld("ipc", {
  // Returns a numeric subscription id. Caller MUST pass it to off.
  onAttendanceInvalidated: (cb) => {
    const id = nextId++;
    attendanceListeners.set(id, cb);
    return id;
  },

  // Takes the id returned by on, not the callback itself.
  offAttendanceInvalidated: (id) => {
    attendanceListeners.delete(id);
  },

  runManualSync: () => ipcRenderer.invoke("manual-sync"),
  runFullSync: () => ipcRenderer.invoke("full-sync"),
  getAutoSyncTime: () => ipcRenderer.invoke("get-auto-sync-time"),
});

/* Settings */
contextBridge.exposeInMainWorld("settings", {
  selectCSVPath: () => ipcRenderer.invoke("select-csv-path"),
  getCSVPath: () => ipcRenderer.invoke("get-csv-path"),
  setCSVPath: (path) => ipcRenderer.invoke("set-csv-path", path),
});

/* API */
contextBridge.exposeInMainWorld("api", {
  getEmployees: () => ipcRenderer.invoke("api:get-employees"),
  getLogs: (employeeId, params) => ipcRenderer.invoke("api:get-logs", { employeeId, ...params }),
  getAttendance: (employeeId, month) => ipcRenderer.invoke("api:get-attendance", { employeeId, month }),
  updateEmployeeName: (employeeId, name) => ipcRenderer.invoke("api:update-employee", { employeeId, name }),
});

/* Internal token (debug) */
contextBridge.exposeInMainWorld("__INTERNAL_TOKEN__", INTERNAL_TOKEN);
