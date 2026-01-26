export default function FullSyncWarningDialog({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-105 bg-nero-900 border border-nero-700 rounded-xl p-5 shadow-xl">
        <div className="text-sm font-semibold mb-2">Full Sync</div>

        <div className="text-xs text-nero-500 mb-4 leading-relaxed">
          Full sync can take some time and will overwrite the full CSV.
          <br />
          Use this only when some logs are missing.
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md bg-nero-800 hover:bg-nero-700 text-sm"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-sm"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
