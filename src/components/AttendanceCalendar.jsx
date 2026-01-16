import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

/* ---------------------------------------
   HELPERS
--------------------------------------- */
function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function calcDuration(inTime, outTime) {
  const diff = toMinutes(outTime) - toMinutes(inTime);
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

/* ---------------------------------------
   MONTH CELL RENDER
--------------------------------------- */
function renderAttendanceEvent(info) {
  const { firstIn, lastOut } = info.event.extendedProps;

  const duration =
    firstIn && lastOut ? calcDuration(firstIn, lastOut) : null;

  return (
    <div style={{ fontSize: "11px", lineHeight: 1.2 }}>
      {/* STATUS + DURATION */}
      <div className="flex justify-between font-semibold">
        <span>{info.event.title}</span>
        {duration && <span>{duration}</span>}
      </div>

      {/* IN / OUT */}
      {firstIn && lastOut && (
        <div className="opacity-90 mt-0.5">
          {firstIn} — {lastOut}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------
   DAY TIMELINE BUILDER
--------------------------------------- */
function buildDayTimelineEvents(date, logs) {
  return logs.map((l, i) => {
    const start = new Date(`${l.date}T${l.time}:00`);
    const end = new Date(start);

    // 🔥 visual duration (prevents short-event issues)
    end.setMinutes(end.getMinutes() + 30);

    return {
      id: i,
      title:
        l.type === "IN"
          ? `Check In · ${l.time}`
          : `Check Out · ${l.time}`,
      start,
      end,
      backgroundColor: l.type === "IN" ? "#16a34a" : "#dc2626",
      borderColor: l.type === "IN" ? "#16a34a" : "#dc2626",
      textColor: "#fff",
      classNames: ["day-log-event"],
    };
  });
}

/* ---------------------------------------
   COMPONENT
--------------------------------------- */
export default function AttendanceCalendar({ employee }) {
  const [events, setEvents] = useState([]);

  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(null);

  /* ---------------------------------------
     LOAD MONTH SUMMARY
  --------------------------------------- */
  const loadMonth = (dateStr) => {
    if (!employee) return;

    // dateStr = YYYY-MM-DD → YYYY-MM
    const month = dateStr.slice(0, 7);

    fetch(
      `http://localhost:4000/api/attendance/${employee.employeeId}?month=${month}`
    )
      .then((res) => res.json())
      .then((data) => {
        setEvents(
          data.map((d) => ({
            title: d.status,
            start: d.date,
            firstIn: d.firstIn,
            lastOut: d.lastOut,
            backgroundColor:
              d.status === "Present"
                ? "#2e7d32"
                : d.status === "Half Day"
                  ? "#b7791f"
                  : "#8b1d1d",
            borderColor: "transparent",
          }))
        );
      })
      .catch(console.error);
  };


  /* ---------------------------------------
     LOAD DAY LOGS
  --------------------------------------- */
  const loadDay = (dateStr) => {
    if (!employee) return;

    fetch(
      `http://localhost:4000/api/logs/${employee.employeeId}?date=${dateStr}`
    )
      .then(res => res.json())
      .then(logs => {
        setEvents(buildDayTimelineEvents(dateStr, logs));
      })
      .catch(console.error);
  };


  /* ---------------------------------------
     INITIAL LOAD
  --------------------------------------- */
  useEffect(() => {
    if (!employee) return;

    setEvents([]); // clear old employee data immediately

    if (currentView === "timeGridDay" && currentDate) {
      loadDay(currentDate);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      loadMonth(today);
    }

  }, [employee]);


  /* ---------------------------------------
     AUTO FETCH
  --------------------------------------- */
  useEffect(() => {
    if (!employee) return;

    const interval = setInterval(() => {
      if (currentView === "timeGridDay" && currentDate) {
        loadDay(currentDate);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        loadMonth(today);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [employee, currentView, currentDate]);


  return (
    <div className="h-full rounded-lg overflow-hidden border border-nero-700 bg-nero-900">
      <FullCalendar
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

        /* DAY VIEW SETTINGS */
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

        /* VIEW CHANGE HANDLER */
        datesSet={(arg) => {
          setCurrentView(arg.view.type);

          const date = arg.startStr.slice(0, 10);

          if (arg.view.type === "timeGridDay") {
            setCurrentDate(date);
            loadDay(date);
          } else {
            setCurrentDate(null);
            loadMonth(date); // ✅ pass visible month
          }
        }}

      />
    </div>
  );
}
