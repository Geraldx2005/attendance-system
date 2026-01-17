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

export default function LogRow({ log }) {
  const m = meta[log.type];

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-nero-800 hover:bg-nero-800 transition">
      
      {/* ICON */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.bg} ${m.color}`}
      >
        {m.icon}
      </div>

      {/* MAIN INFO */}
      <div className="flex-1">
        <div className="text-sm font-medium text-nero-200">
          {m.label}
        </div>

        <div className="flex items-center gap-2 text-xs text-nero-500 mt-0.5">
          <IoCalendarOutline className="text-nero-600" />
          <span>{log.date}</span>
          <span className="text-nero-600">•</span>
          <span>{to12Hour(log.time)}</span>
        </div>
      </div>
    </div>
  );
}