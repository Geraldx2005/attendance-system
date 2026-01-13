import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import { IoArrowBackSharp, IoArrowForwardSharp  } from "react-icons/io5";

import "react-big-calendar/lib/css/react-big-calendar.css";

// ---------------------------
// LOCALIZER
// ---------------------------
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// ---------------------------
// CUSTOM TOOLBAR
// ---------------------------
function CalendarToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="flex items-center justify-between px-1.5 py-1.5 bg-nero-800 border-b border-nero-600 rounded-t-2xl">

      {/* LEFT: Month / Week / Day */}
      <div className="flex items-center gap-1 rounded-md bg-nero-900/60 p-0.5">
        {["month", "day"].map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`px-3 py-1 text-sm rounded transition-colors
        ${view === v
                ? "bg-nero-700 text-nero-200"
                : "text-nero-400 hover:text-nero-300"
              }
      `}
          >
            {v}
          </button>
        ))}
      </div>


      {/* CENTER: LABEL */}
      <div className="text-sm font-medium text-nero-300">
        {label}
      </div>

      {/* RIGHT: NAVIGATION */}
<div className="flex items-center gap-1 rounded-md bg-nero-900/60 p-0.5">
  <button
    onClick={() => onNavigate("PREV")}
    className="px-3 py-1 text-md rounded transition-colors bg-nero-700 text-nero-400 hover:text-nero-300"
  >
    <IoArrowBackSharp />
  </button>

  <button
    onClick={() => onNavigate("TODAY")}
    className="px-3 py-1 text-sm rounded transition-colors bg-nero-700 text-nero-400 hover:text-nero-300"
  >
    Today
  </button>

  <button
    onClick={() => onNavigate("NEXT")}
    className="px-3 py-1 text-md rounded transition-colors bg-nero-700 text-nero-400 hover:text-nero-300"
  >
    <IoArrowForwardSharp />
  </button>
</div>

    </div>
  );
}

// ---------------------------
// SAMPLE ATTENDANCE DATA
// ---------------------------
const getAttendanceEvents = (employeeId) => {
  if (!employeeId) return [];

  return [
    {
      title: "Full Day",
      start: new Date(2026, 0, 2),
      end: new Date(2026, 0, 2),
      status: "FULL",
    },
    {
      title: "Half Day",
      start: new Date(2026, 0, 5),
      end: new Date(2026, 0, 5),
      status: "HALF",
    },
    {
      title: "Absent",
      start: new Date(2026, 0, 8),
      end: new Date(2026, 0, 8),
      status: "ABSENT",
    },
  ];
};

// ---------------------------
// MAIN COMPONENT
// ---------------------------
export default function AttendanceCalendar({ employee }) {
  const events = getAttendanceEvents(employee?.employeeId);

  return (
    <div className="w-full h-full bg-nero-800 rounded-lg border border-nero-600 overflow-hidden">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={["month", "day"]}
        defaultView="month"
        components={{ toolbar: CalendarToolbar }}
        popup
        selectable
        style={{ height: "100%" }}
        eventPropGetter={(event) => {
          let bg = "#2563eb";

          if (event.status === "FULL") bg = "#16a34a";
          if (event.status === "HALF") bg = "#eab308";
          if (event.status === "ABSENT") bg = "#dc2626";

          return {
            style: {
              backgroundColor: bg,
              borderRadius: "6px",
              border: "none",
              color: "#fff",
              fontSize: "12px",
            },
          };
        }}
      />
    </div>
  );
}
