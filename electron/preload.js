const { contextBridge, ipcRenderer } = require("electron");

/* Extract internal token */
const tokenArg = process.argv.find(arg =>
  arg.startsWith("--internal-token=")
);

const INTERNAL_TOKEN = tokenArg
  ? tokenArg.split("=")[1]
  : null;

/* Existing IPC */
contextBridge.exposeInMainWorld("ipc", {
  onAttendanceInvalidated: (cb) => {
    ipcRenderer.on("attendance:invalidated", (_, data) => cb(data));
  },

  offAttendanceInvalidated: (cb) => {
    ipcRenderer.removeListener("attendance:invalidated", cb);
  },
});

/* Settings API */
contextBridge.exposeInMainWorld("settings", {
  selectCSVPath: () => ipcRenderer.invoke("select-csv-path"),
  getCSVPath: () => ipcRenderer.invoke("get-csv-path"),
  setCSVPath: (path) => ipcRenderer.invoke("set-csv-path", path),
});

/* Internal token */
contextBridge.exposeInMainWorld(
  "__INTERNAL_TOKEN__",
  INTERNAL_TOKEN
);
