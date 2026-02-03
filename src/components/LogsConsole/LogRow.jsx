import { memo } from "react";
import {
  IoLogInOutline,
  IoLogOutOutline,
  IoCalendarOutline,
} from "react-icons/io5";
import { to12Hour } from "../../utils/time";

const meta = {
  IN: {
    label: "Check In",
    icon: <IoLogInOutline />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  OUT: {
    label: "Check Out",
    icon: <IoLogOutOutline />,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
};

function LogRow({ log, isLast }) {
  // SAFETY: Ensure log.type exists (fallback to IN if undefined)
  const logType = log.type || "IN";
  const m = meta[logType];

  // SAFETY: Handle missing data gracefully
  const displayDate = log.date || "N/A";
  const displayTime = log.time ? to12Hour(log.time) : "N/A";

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 hover:bg-nero-800 transition-colors duration-150
        ${!isLast ? "border-b border-nero-800" : ""}
      `}
    >
      {/* ICON */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.bg} ${m.color} shrink-0`}
      >
        {m.icon}
      </div>

      {/* MAIN INFO */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-nero-200">
          {m.label}
        </div>

        <div className="flex items-center gap-2 text-xs text-nero-500 mt-0.5">
          <IoCalendarOutline className="text-nero-600 shrink-0" />
          <span className="truncate">{displayDate}</span>
          <span className="text-nero-600 shrink-0">•</span>
          <span className="shrink-0">{displayTime}</span>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(LogRow, (prevProps, nextProps) => {
  return (
    prevProps.log.id === nextProps.log.id &&
    prevProps.log.date === nextProps.log.date &&
    prevProps.log.time === nextProps.log.time &&
    prevProps.log.type === nextProps.log.type &&
    prevProps.isLast === nextProps.isLast
  );
});