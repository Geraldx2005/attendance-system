import { memo } from "react";
import {
  IoCalendarOutline,
  IoLogInOutline,
  IoLogOutOutline,
  IoFunnelOutline,
  IoTimeOutline,
} from "react-icons/io5";

function LogsToolbar({
  dateFilter,
  setDateFilter,
  typeFilter,
  onTypeChange,
  summaryMode,
  onSummaryClick,
  duration,
  isLoading = false,
}) {
  const tabBtn =
    "px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors font-medium";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-nero-800/90 backdrop-blur border border-nero-700 rounded-md flex-wrap">

      {/* Date Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-md">
        {["today", "yesterday"].map((v) => (
          <button
            key={v}
            onClick={() => setDateFilter(v)}
            disabled={isLoading}
            className={`${tabBtn} ${
              dateFilter === v
                ? "bg-nero-700 text-nero-200"
                : "text-nero-500 hover:bg-nero-800"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <IoCalendarOutline className="text-sm" />
            {v === "today" ? "Today" : "Yesterday"}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-nero-700" />

      {/* Type Filter */}
      <div className="flex items-center gap-1 bg-nero-900/80 p-1 rounded-md">
        <button
          onClick={() => onTypeChange("all")}
          disabled={isLoading}
          className={`${tabBtn} ${
            typeFilter === "all" && !summaryMode
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <IoFunnelOutline className="text-sm" />
          All
        </button>

        <button
          onClick={() => onTypeChange("in")}
          disabled={isLoading}
          className={`${tabBtn} ${
            typeFilter === "in" && !summaryMode
              ? "bg-nero-700 text-emerald-400"
              : "text-nero-500 hover:bg-nero-800"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <IoLogInOutline className="text-sm" />
          In
        </button>

        <button
          onClick={() => onTypeChange("out")}
          disabled={isLoading}
          className={`${tabBtn} ${
            typeFilter === "out" && !summaryMode
              ? "bg-nero-700 text-red-400"
              : "text-nero-500 hover:bg-nero-800"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <IoLogOutOutline className="text-sm" />
          Out
        </button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-nero-700" />

      {/* Day Summary */}
      <div className="flex items-center gap-2 bg-nero-900/80 p-1 rounded-md">
        <button
          onClick={onSummaryClick}
          disabled={isLoading}
          className={`${tabBtn} ${
            summaryMode
              ? "bg-nero-700 text-nero-200"
              : "text-nero-500 hover:bg-nero-800"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <IoTimeOutline className="text-sm" />
          Day Summary
        </button>

        {summaryMode && duration && (
          <div className="px-2.5 py-1.5 text-xs font-medium text-nero-300 bg-nero-800 rounded-md">
            {duration}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-nero-400">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent re-renders
export default memo(LogsToolbar);