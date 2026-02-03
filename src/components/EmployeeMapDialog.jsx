import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { toast } from "../utils/ToastHost";

export default function EmployeeMapDialog({
  open,
  employee,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* Load current name when dialog opens */
  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    if (employee) {
      setName(employee.name || employee.employeeId);
    } else {
      setName("");
    }
  }, [open, employee]);

  /* ESC to close */
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

  /* Save name */
  const save = async () => {
    if (!employee || !name.trim() || saving) return;

    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/api/employees/${employee.employeeId}`, {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });

      toast("Employee name updated successfully", "success");
      onSaved?.(trimmedName);
      onClose();
    } catch (err) {
      console.error("Failed to update employee name:", err);
      setError("Failed to update name. Please try again.");
      toast("Failed to update employee name", "error");
    } finally {
      setSaving(false);
    }
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
            className="text-nero-500 hover:text-nero-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {!employee ? (
          <div className="text-sm text-nero-500">
            Select an employee to map name
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
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
                className="w-full px-3 py-2 bg-nero-800 border border-nero-700 rounded-lg text-sm text-nero-400"
              />
            </div>

            {/* Employee Name */}
            <div className="mb-4">
              <div className="text-xs text-nero-500 mb-1">
                Employee Name
              </div>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter employee name"
                autoFocus
                maxLength={50}
                className="w-full px-3 py-2 bg-nero-800 border border-nero-700 rounded-lg text-sm text-nero-300 outline-none focus:border-nero-400"
              />
              {error && (
                <div className="text-xs text-red-400 mt-1">{error}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-sm text-nero-400 hover:text-nero-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-1.5 rounded-lg bg-nero-700 hover:bg-nero-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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