import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

export default function EmployeeMapDialog({
  open,
  employee,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  /* LOAD CURRENT NAME WHEN OPEN */
  useEffect(() => {
    if (!open) return;

    if (employee) {
      setName(employee.name || employee.employeeId);
    } else {
      setName("");
    }
  }, [open, employee]);

  /* ESC TO CLOSE */
  useEffect(() => {
    if (!open) return;

    const onEsc = (e) => {
      if (e.key === "Escape") {
        document.activeElement?.blur();
        onClose();
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  /* SAVE NAME */
  const save = async () => {
    if (!employee || !name.trim() || saving) return;

    setSaving(true);

    await apiFetch(`/api/employees/${employee.employeeId}`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });

    setSaving(false);

    // 🔥 pass updated name back to App.jsx
    onSaved?.(name.trim());
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-96 bg-nero-900 border border-nero-700 rounded-2xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-lg font-semibold">Employee Mapping</div>
          <button
            onClick={onClose}
            className="text-nero-500 hover:text-nero-300"
          >
            ✕
          </button>
        </div>

        {!employee ? (
          <div className="text-sm text-nero-500">
            Select an employee to map name
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault(); // ⛔ prevent page reload
              save();             // ✅ Enter triggers Save
            }}
          >
            {/* Employee ID */}
            <div className="mb-3">
              <div className="text-xs text-nero-500 mb-1">
                Employee ID
              </div>
              <input
                value={employee.employeeId}
                disabled
                className="
                  w-full
                  px-3 py-2
                  bg-nero-800
                  border border-nero-700
                  rounded-lg
                  text-sm
                  text-nero-400
                "
              />
            </div>

            {/* Employee Name */}
            <div className="mb-4">
              <div className="text-xs text-nero-500 mb-1">
                Employee Name
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter employee name"
                autoFocus
                className="
                  w-full
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
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <button
                type="submit"
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
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
