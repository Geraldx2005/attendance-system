import { useState, useEffect } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { toast } from "../utils/ToastHost";

export default function ManualSyncButton() {
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [error, setError] = useState(null);

    /* Load last sync (manual + auto) */
    useEffect(() => {
        let timer;

        async function loadLastSync() {
            const manual = localStorage.getItem("lastManualSync");
            const res = await window.ipc.getAutoSyncTime();
            const auto = res?.autoSyncAt;

            const latest =
                manual && auto
                    ? new Date(manual) > new Date(auto)
                        ? manual
                        : auto
                    : manual || auto;

            if (latest) setLastSync(latest);
        }

        loadLastSync(); // initial load

        // auto refresh every 60s
        timer = setInterval(loadLastSync, 60000);

        return () => clearInterval(timer);
    }, []);


    const runSync = async () => {
        if (syncing) return;

        setSyncing(true);
        setError(null);

        try {
            // Step 1: Sync from device (runs external service)
            const res = await window.ipc.runManualSync();

            if (!res?.ok) {
                setError(res?.error || "Sync failed");
                toast(res?.error || "Sync failed", "error");
                return;
            }

            // Step 2: Success - the CSV watcher in ingest.js will auto-detect changes
            localStorage.setItem("lastManualSync", res.syncedAt);
            toast("Sync completed successfully", "success");

            const autoRes = await window.ipc.getAutoSyncTime();
            const auto = autoRes?.autoSyncAt;

            const latest =
                auto && new Date(auto) > new Date(res.syncedAt)
                    ? auto
                    : res.syncedAt;

            setLastSync(latest);
        } catch (err) {
            console.error("Sync error:", err);
            setError("Sync failed");
            toast("Sync failed", "error");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={runSync}
                disabled={syncing}
                title="Sync from device"
                className="h-8 w-8 flex items-center justify-center rounded-md bg-nero-700 disabled:opacity-50 transition group"
            >
                <FiRefreshCw
                    size={16}
                    className={`${syncing ? "animate-spin" : ""} group-hover:text-white`}
                />
            </button>

            {lastSync && (
                <span className="text-[11px] text-nero-500" title="Last sync time">
                    {new Date(lastSync).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
            )}

            {error && (
                <span className="text-[11px] text-red-500">{error}</span>
            )}
        </div>
    );
}