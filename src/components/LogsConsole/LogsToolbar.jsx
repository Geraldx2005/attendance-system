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
  setTypeFilter,
  summaryMode,
  setSummaryMode,
  duration,
}) {
  const tabBtn =
    "px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-colors";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-nero-800/90 backdrop-blur border border-nero-700 rounded-2xl">

      {/* Date Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-xl">
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
      <div className="h-6 w-px bg-nero-700/70" />

      {/* Type Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-xl">
        <button
          onClick={() => setTypeFilter("all")}
          className={`${tabBtn} ${typeFilter === "all"
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoFunnelOutline className="text-sm" />
          All
        </button>

        <button
          onClick={() => setTypeFilter("in")}
          className={`${tabBtn} ${typeFilter === "in"
              ? "bg-nero-700 text-emerald-400"
              : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoLogInOutline className="text-sm" />
          In
        </button>

        <button
          onClick={() => setTypeFilter("out")}
          className={`${tabBtn} ${typeFilter === "out"
              ? "bg-nero-700 text-rose-400"
              : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoLogOutOutline className="text-sm" />
          Out
        </button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-nero-700/70" />

      {/* Day Summary */}
      <div className="flex items-center bg-nero-900/80 p-1 rounded-xl">
        <button
          onClick={() => setSummaryMode(!summaryMode)}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-colors
      ${summaryMode
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
            }`}
        >
          <IoTimeOutline className="text-sm" />
          Day summary
        </button>

        {summaryMode && duration && (
          <div className="px-2 py-1 text-[12px] text-nero-300 bg-nero-800 rounded-md ml-1">
            {duration}
          </div>
        )}
      </div>


      <div className="flex-1" />
    </div>
  );
}
