import { useEffect, useState } from "react";
import { IoFolderOpenOutline } from "react-icons/io5";

export default function SettingsDialog({
    open,
    onClose,
    theme,
    toggleTheme,
}) {
    const [csvPath, setCsvPath] = useState("");
    const [saving, setSaving] = useState(false);

    /* LOAD CURRENT CSV PATH */
    useEffect(() => {
        if (!open) return;

        window.settings.getCSVPath().then((path) => {
            setCsvPath(path || "");
        });
    }, [open]);

    /* FILE PICKER */
    const pickCSV = async () => {
        const path = await window.settings.selectCSVPath();
        if (path) setCsvPath(path);
    };

    /* SAVE MANUAL PATH */
    const savePath = async () => {
        if (!csvPath.trim()) return;

        setSaving(true);

        const result = await window.settings.setCSVPath(csvPath.trim());

        setSaving(false);

        if (result?.ok) {
            // close dialog
            onClose();

            // hard guarantee fresh data
            window.location.reload();
        } else {
            alert(result?.error || "Failed to apply CSV path");
        }
    };


    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
            <div className="w-125 bg-nero-900 border border-nero-700 rounded-2xl shadow-2xl p-5">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="text-lg font-semibold">Settings</div>
                    <button
                        onClick={onClose}
                        className="text-nero-500 hover:text-nero-300"
                    >
                        ✕
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
                        className={`
      relative w-12 h-6 rounded-full transition-colors
      ${theme === "dark" ? "bg-blue-500" : "bg-nero-700"}
    `}
                    >
                        <span
                            className={`
        absolute top-0.5 left-0.5
        w-5 h-5 rounded-full bg-white
        transition-transform
        ${theme === "dark" ? "translate-x-6" : "translate-x-0"}
      `}
                        />
                    </button>
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
                            className="
                flex-1
                px-3 py-2
                bg-nero-800
                border border-nero-700
                rounded-lg
                text-sm
                text-nero-300
                outline-none
                focus:border-nero-400
              "
                        />

                        <button
                            onClick={pickCSV}
                            title="Browse"
                            className="
                w-10 h-10
                flex items-center justify-center
                rounded-lg
                bg-nero-800
                hover:bg-nero-700
                text-nero-300
              "
                        >
                            <IoFolderOpenOutline />
                        </button>
                    </div>

                    <div className="flex justify-end mt-3">
                        <button
                            onClick={savePath}
                            disabled={saving}
                            className="
                px-4 py-1.5
                rounded-lg
                bg-nero-700
                hover:bg-nero-600
                text-sm
                disabled:opacity-50
              "
                        >
                            {saving ? "Saving…" : "Apply"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
