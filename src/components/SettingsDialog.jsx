import { useEffect, useState } from "react";
import { IoFolderOpenOutline, IoWarningOutline } from "react-icons/io5";
import { FiRefreshCw } from "react-icons/fi";
import SyncProgressDialog from "../utils/SyncProgressDialog";
import FullSyncWarningDialog from "../utils/FullSyncWarningDialog";
import { toast } from "../utils/ToastHost";

export default function SettingsDialog({ open, onClose, theme, toggleTheme }) {
  const [csvPath, setCsvPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFullSyncWarn, setShowFullSyncWarn] = useState(false);
  const [syncTitle, setSyncTitle] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  /* Load current CSV path */
  useEffect(() => {
    if (!open) return;

    window.settings.getCSVPath().then((path) => {
      setCsvPath(path || "");
    }).catch(err => {
      console.error("Failed to load CSV path:", err);
      toast("Failed to load settings", "error");
    });
  }, [open]);

  /* ESC to close */
  useEffect(() => {
    if (!open) return;

    const onEsc = (e) => {
      if (e.key === "Escape" && !syncing) {
        document.activeElement?.blur();
        onClose();
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose, syncing]);

  /* Manual sync */
  const runManualSync = async () => {
    if (syncing) return;

    setSyncTitle("Manual Sync");
    setSyncMessage("Syncing attendance from device…");
    setSyncing(true);

    try {
      const res = await window.ipc.runManualSync();

      if (!res?.ok) {
        toast(res?.error || "Manual sync failed", "error");
      } else {
        toast("Manual sync completed successfully", "success");
      }
    } catch (err) {
      console.error("Manual sync error:", err);
      toast("Manual sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const requestFullSync = () => {
    if (syncing) return;
    setShowFullSyncWarn(true);
  };

  /* Full sync */
  const runFullSync = async () => {
    setShowFullSyncWarn(false);

    setSyncTitle("Full Sync");
    setSyncMessage("Rebuilding full attendance data…");
    setSyncing(true);

    try {
      const res = await window.ipc.runFullSync();

      if (!res?.ok) {
        toast(res?.error || "Full sync failed", "error");
      } else {
        toast("Full sync completed successfully", "success");
      }
    } catch (err) {
      console.error("Full sync error:", err);
      toast("Full sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  /* File picker */
  const pickCSV = async () => {
    try {
      const path = await window.settings.selectCSVPath();
      if (path) setCsvPath(path);
    } catch (err) {
      console.error("Failed to select CSV path:", err);
      toast("Failed to select folder", "error");
    }
  };

  /* Save manual path */
  const savePath = async () => {
    if (!csvPath.trim() || saving) return;

    setSaving(true);

    try {
      const result = await window.settings.setCSVPath(csvPath.trim());

      if (result?.ok) {
        toast("CSV path updated successfully", "success");
        onClose();
        
        // Reload to pick up new CSV path
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast(result?.error || "Failed to apply CSV path", "error");
      }
    } catch (err) {
      console.error("Failed to save CSV path:", err);
      toast("Failed to save CSV path", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50"
        onClick={() => !syncing && onClose()}
      >
        <div 
          className="w-125 bg-nero-900 border border-nero-700 rounded-2xl shadow-2xl p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="text-lg font-semibold">Settings</div>
            <button 
              onClick={onClose} 
              disabled={syncing}
              className="text-nero-500 hover:text-nero-300 text-xl leading-none disabled:opacity-50"
            >
              ×
            </button>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-medium">Theme</div>
              <div className="text-xs text-nero-500">
                Application appearance
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                theme === "dark" ? "bg-emerald-600" : "bg-nero-700"
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  theme === "dark" ? "translate-x-6" : "translate-x-0"
                }`} 
              />
            </button>
          </div>

          <div className="h-px bg-nero-700 my-4" />

          {/* Sync Controls */}
          <div>
            <div className="text-sm font-medium mb-1">Data Sync</div>
            <div className="flex items-center gap-1 text-xs text-nero-500 mb-3">
              Manually trigger attendance sync from device
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={requestFullSync}
                disabled={syncing}
                className="w-full px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <IoWarningOutline />
                Full Sync
              </button>

              <button
                onClick={runManualSync}
                disabled={syncing}
                className="w-full px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <FiRefreshCw className={syncing ? "animate-spin" : ""} />
                Quick Sync
              </button>
            </div>
          </div>

          <div className="h-px bg-nero-700 my-4" />

          {/* CSV PATH */}
          <div className="mb-2">
            <div className="text-sm font-medium mb-1">
              Attendance CSV Folder
            </div>
            <div className="text-xs text-nero-500 mb-2">
              This folder is watched. Current month CSV is auto-detected.
            </div>

            <div className="flex items-center gap-2">
              <input
                value={csvPath}
                onChange={(e) => setCsvPath(e.target.value)}
                placeholder="CSV file path"
                disabled={saving}
                className="flex-1 px-3 py-2 bg-nero-800 border border-nero-700 rounded-lg text-sm text-nero-300 outline-none focus:border-nero-400 disabled:opacity-50"
              />

              <button
                onClick={pickCSV}
                disabled={saving}
                title="Browse"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-nero-800 hover:bg-nero-700 text-nero-300 disabled:opacity-50"
              >
                <IoFolderOpenOutline />
              </button>
            </div>

            <div className="flex justify-end mt-3">
              <button
                onClick={savePath}
                disabled={saving || !csvPath.trim()}
                className="px-4 py-1.5 rounded-lg bg-nero-700 hover:bg-nero-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <FullSyncWarningDialog
        open={showFullSyncWarn}
        onCancel={() => setShowFullSyncWarn(false)}
        onConfirm={runFullSync}
      />

      <SyncProgressDialog
        open={syncing}
        title={syncTitle}
        message={syncMessage}
      />
    </>
  );
}