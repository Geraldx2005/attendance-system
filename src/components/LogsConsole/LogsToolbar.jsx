import {
  IoCalendarOutline,
  IoLogInOutline,
  IoLogOutOutline,
  IoFunnelOutline,
  IoTimeOutline,
} from "react-icons/io5";

export default function LogsToolbar({
  dateFilter,
  setDateFilter,
  typeFilter,
  onTypeChange,
  summaryMode,
  onSummaryClick,
  duration,
}) {
  const tabBtn =
    "px-3 py-1.5 text-xs rounded-md flex items-center gap-1 transition-colors";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-nero-800/90 backdrop-blur border border-nero-700 rounded-md">

      {/* Date Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-md">
        {["today", "yesterday"].map((v) => (
          <button
            key={v}
            onClick={() => setDateFilter(v)}
            className={`${tabBtn} ${dateFilter === v
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
              }`}
          >
            <IoCalendarOutline className="text-sm" />
            {v === "today" ? "Today" : "Yesterday"}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-nero-900" />

      {/* Type Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-md">
        <button
          onClick={() => onTypeChange("all")}
          className={`${tabBtn} ${typeFilter === "all" && !summaryMode
            ? "bg-nero-700 text-nero-200"
            : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoFunnelOutline className="text-sm" />
          All
        </button>

        <button
          onClick={() => onTypeChange("in")}
          className={`${tabBtn} ${typeFilter === "in" && !summaryMode
            ? "bg-nero-700 text-emerald-400"
            : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoLogInOutline className="text-sm" />
          In
        </button>

        <button
          onClick={() => onTypeChange("out")}
          className={`${tabBtn} ${typeFilter === "out" && !summaryMode
            ? "bg-nero-700 text-red-400"
            : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoLogOutOutline className="text-sm" />
          Out
        </button>

      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-nero-900" />

      {/* Day Summary */}
      <div className="flex items-center bg-nero-900/80 p-1 rounded-md">
        <button
          onClick={onSummaryClick}
          className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 transition-colors
    ${summaryMode
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoTimeOutline className="text-sm" />
          Day summary
        </button>

        {summaryMode && (
          <div className="px-2 py-1 text-[12px] text-nero-300 bg-nero-800 rounded-md ml-1">
            {duration || "0h 0m"}
          </div>
        )}

      </div>


      <div className="flex-1" />
    </div>
  );
}
