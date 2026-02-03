const { contextBridge, ipcRenderer } = require("electron");

/* Extract internal token */
const tokenArg = process.argv.find((arg) =>
  arg.startsWith("--internal-token=")
);

const INTERNAL_TOKEN = tokenArg
  ? tokenArg.split("=")[1]
  : null;

/* IPC Events */
contextBridge.exposeInMainWorld("ipc", {
  onAttendanceInvalidated: (cb) => {
    ipcRenderer.on("attendance:invalidated", (_, data) => cb(data));
  },
  offAttendanceInvalidated: (cb) => {
    ipcRenderer.removeListener("attendance:invalidated", cb);
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

/* API (replaces HTTP fetch) */
contextBridge.exposeInMainWorld("api", {
  // GET /api/employees
  getEmployees: () => ipcRenderer.invoke("api:get-employees"),

  // GET /api/logs/:employeeId?date=...&from=...&to=...
  getLogs: (employeeId, params) => 
    ipcRenderer.invoke("api:get-logs", { employeeId, ...params }),

  // GET /api/attendance/:employeeId?month=...
  getAttendance: (employeeId, month) => 
    ipcRenderer.invoke("api:get-attendance", { employeeId, month }),

  // POST /api/employees/:employeeId (update name)
  updateEmployeeName: (employeeId, name) => 
    ipcRenderer.invoke("api:update-employee", { employeeId, name }),
});

/* Internal token (debug) */
contextBridge.exposeInMainWorld("__INTERNAL_TOKEN__", INTERNAL_TOKEN);