export default function SyncProgressDialog({ open, title, message }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-96 bg-nero-900 border border-nero-700 rounded-xl p-5 shadow-xl">
        <div className="text-sm font-medium mb-2">{title}</div>

        <div className="text-xs text-nero-500 mb-4">
          {message}
        </div>

        {/* Progress bar (indeterminate) */}
        <div className="w-full h-2 bg-nero-800 rounded overflow-hidden">
          <div className="h-full w-1/3 bg-emerald-500 animate-progress" />
        </div>

        <div className="text-[11px] text-nero-500 mt-3">
          Please don’t close the app
        </div>
      </div>
    </div>
  );
}
