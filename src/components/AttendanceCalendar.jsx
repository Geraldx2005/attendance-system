import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { to12Hour } from "../utils/time";
import { apiFetch } from "../utils/api";

/* Helpers */
function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function calcDuration(inTime, outTime) {
  const diff = toMinutes(outTime) - toMinutes(inTime);
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

/* Month Cell Render */
function renderAttendanceEvent(info) {
  const { firstIn, lastOut } = info.event.extendedProps;

  const duration =
    firstIn && lastOut ? calcDuration(firstIn, lastOut) : null;

  return (
    <div style={{ fontSize: "11px", lineHeight: 1.2 }}>
      {/* Status + Duration */}
      <div className="flex justify-between font-semibold">
        <span>{info.event.title}</span>
        {duration && <span>{duration}</span>}
      </div>

      {/* IN / OUT */}
      {firstIn && lastOut && (
        <div className="opacity-90 mt-0.5">
          {to12Hour(firstIn)} — {to12Hour(lastOut)}
        </div>
      )}
    </div>
  );
}

/* Day Timeline Builder */
function buildDayTimelineEvents(date, logs) {
  return logs.map((l, i) => {
    const start = new Date(`${l.date}T${l.time}:00`);
    const end = new Date(start);

    // visual duration (prevents short-event issues)
    end.setMinutes(end.getMinutes() + 30);

    return {
      id: i,
      title:
        l.type === "IN"
          ? `Check In · ${to12Hour(l.time)}`
          : `Check Out · ${to12Hour(l.time)}`,
      start,
      end,
      backgroundColor: l.type === "IN" ? "#16a34a" : "#dc2626",
      borderColor: l.type === "IN" ? "#16a34a" : "#dc2626",
      textColor: "#fff",
      classNames: ["day-log-event"],
    };
  });
}

/* Component */
export default function AttendanceCalendar({ employee }) {
  const [events, setEvents] = useState([]);

  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(null);

  const [calendarKey, setCalendarKey] = useState(0);

  /* Load Month Logs */
  const loadMonth = (dateStr) => {
    if (!employee) return;

    // dateStr = YYYY-MM-DD → YYYY-MM
    const month = dateStr.slice(0, 7);

    apiFetch(
      `/api/attendance/${employee.employeeId}?month=${month}`
    )
      .then((res) => res.json())
      .then((data) => {
        setEvents(
          data.map((d) => ({
            title: d.status === "Pending" ? "" : d.status,
            start: d.date,
            firstIn: d.firstIn,
            lastOut: d.lastOut,
            backgroundColor:
              d.status === "Present"
                ? "#2e7d32"
                : d.status === "Half Day"
                  ? "#b7791f"
                  : d.status === "Absent"
                    ? "#8b1d1d"
                    : "transparent",
            borderColor: "transparent",
          }))
        );
      })
      .catch(console.error);
  };


  /* Load Day Logs */
  const loadDay = (dateStr) => {
    if (!employee) return;

    apiFetch(
      `/api/logs/${employee.employeeId}?date=${dateStr}`
    )
      .then(res => res.json())
      .then(logs => {
        setEvents(buildDayTimelineEvents(dateStr, logs));
      })
      .catch(console.error);
  };


  /* Initial Load */
  useEffect(() => {
    if (!employee) return;

    setEvents([]); // clear old employee data immediately

    if (currentView === "timeGridDay" && currentDate) {
      loadDay(currentDate);

      // force FullCalendar to re-render day timeline
      setCalendarKey(k => k + 1);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      loadMonth(today);
    }

  }, [employee]);

  /* IPC Invalidation */
  useEffect(() => {
    if (!window.ipc || !employee) return;
    // console.log("IPC invalidation received");

    const handler = ({ employeeId }) => {
      if (employeeId && employee.employeeId !== employeeId) return;

      if (currentView === "timeGridDay" && currentDate) {
        loadDay(currentDate);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        loadMonth(today);
      }
    };

    window.ipc.onAttendanceInvalidated(handler);

    return () => {
      window.ipc.offAttendanceInvalidated(handler);
    };
  }, [employee, currentView, currentDate]);


  return (
    <div className="h-full rounded-lg overflow-hidden border border-nero-700 bg-nero-900">
      <FullCalendar key={calendarKey}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"

        headerToolbar={{
          left: "dayGridMonth,timeGridDay",
          center: "title",
          right: "prev today next",
        }}

        fixedWeekCount={false}
        showNonCurrentDates={false}
        dayMaxEvents={1}
        nowIndicator={true}

        /* Day View Settings */
        allDaySlot={false}
        displayEventTime={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"

        height="100%"
        events={events}

        /* Month-only custom render */
        eventContent={(arg) =>
          arg.view.type === "dayGridMonth"
            ? renderAttendanceEvent(arg)
            : true
        }

        /* View Change Handler */
        datesSet={(arg) => {
          setCurrentView(arg.view.type);

          const date = arg.startStr.slice(0, 10);

          if (arg.view.type === "timeGridDay") {
            setCurrentDate(date);
            loadDay(date);
          } else {
            setCurrentDate(null);
            loadMonth(date); // pass visible month
          }
        }}

      />
    </div>
  );
}
