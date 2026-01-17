const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
  onAttendanceInvalidated: (cb) => {
    ipcRenderer.on("attendance:invalidated", (_, data) => cb(data));
  },

  offAttendanceInvalidated: (cb) => {
    ipcRenderer.removeListener("attendance:invalidated", cb);
  },
});
