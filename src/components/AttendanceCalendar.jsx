import { useEffect, useState, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { to12Hour } from "../utils/time";
import { apiFetch } from "../utils/api";
import { calcDayStats } from "../utils/attendanceStats";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function toMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function calcDuration(inTime, outTime) {
  const inMin  = toMinutes(inTime);
  const outMin = toMinutes(outTime);
  if (inMin === null || outMin === null || outMin <= inMin) return null;
  const diff = outMin - inMin;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

/* ─── Event builders ──────────────────────────────────────────────────────── */

// Month-grid event.  firstIn / lastOut MUST be inside extendedProps or
// FullCalendar drops them and renderAttendanceEvent crashes.
function toCalendarEvent(d) {
  return {
    title: d.status === "Pending" ? "" : d.status,
    start: d.date,
    extendedProps: { firstIn: d.firstIn, lastOut: d.lastOut },
    backgroundColor:
      d.status === "Present"  ? "#2e7d32"
      : d.status === "Half Day" ? "#b7791f"
      : d.status === "Absent"   ? "#8b1d1d"
      : "transparent",
    borderColor: "transparent",
  };
}

function renderAttendanceEvent(info) {
  const { firstIn, lastOut } = info.event.extendedProps;
  const duration = firstIn && lastOut ? calcDuration(firstIn, lastOut) : null;

  return (
    <div style={{ fontSize: "11px", lineHeight: 1.2 }}>
      <div className="flex justify-between font-semibold">
        <span>{info.event.title}</span>
        {duration && <span>{duration}</span>}
      </div>
      {firstIn && lastOut && (
        <div className="opacity-90 mt-0.5">
          {to12Hour(firstIn)} – {to12Hour(lastOut)}
        </div>
      )}
    </div>
  );
}

// Day-timeline events (single-day punch list)
function buildDayTimelineEvents(date, logs) {
  if (!logs || logs.length === 0) {
    const anchorStart = new Date(`${date}T08:00:00`);
    const anchorEnd   = new Date(anchorStart);
    anchorEnd.setMinutes(anchorEnd.getMinutes() + 1);
    return [{
      id: "anchor", title: "", start: anchorStart, end: anchorEnd,
      display: "background", backgroundColor: "transparent",
    }];
  }

  const sorted = [...logs].sort((a, b) => a.time.localeCompare(b.time));
  return sorted.map((punch, i) => {
    const isIn  = i % 2 === 0;
    const start = new Date(`${punch.date}T${punch.time}`);
    const end   = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    return {
      id: `${punch.date}-${punch.time}-${i}`,
      title: isIn
        ? `Check In · ${to12Hour(punch.time)}`
        : `Check Out · ${to12Hour(punch.time)}`,
      start, end,
      backgroundColor: isIn ? "#16a34a" : "#dc2626",
      borderColor:     isIn ? "#16a34a" : "#dc2626",
      textColor: "#fff",
      classNames: ["day-log-event"],
    };
  });
}

/* ─── Summary calculator ──────────────────────────────────────────────────── */
function calcSummary(data) {
  let present = 0, halfDay = 0, absent = 0;
  data.forEach((d) => {
    if      (d.status === "Present")  present++;
    else if (d.status === "Half Day") halfDay++;
    else if (d.status === "Absent")   absent++;
  });
  return { present, halfDay, absent, totalPresent: present + halfDay * 0.5 };
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function AttendanceCalendar({
  employee,
  onSummary,
  onViewChange,
  onDayStats,
}) {
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [, forceRerender] = useState(0);

  const calendarRef    = useRef(null);
  const requestRef     = useRef(0);
  const monthReadyRef  = useRef(false);

  // ── refs that let the IPC handler trigger a re-fetch without being in
  //     its own dep array (breaks the churn cycle)
  const currentViewRef  = useRef(currentView);
  const currentDateRef  = useRef(currentDate);
  const currentMonthRef = useRef(currentMonth);
  const employeeRef     = useRef(employee);

  // Keep refs in sync
  useEffect(() => { currentViewRef.current  = currentView;  }, [currentView]);
  useEffect(() => { currentDateRef.current  = currentDate;  }, [currentDate]);
  useEffect(() => { currentMonthRef.current = currentMonth; }, [currentMonth]);
  useEffect(() => { employeeRef.current     = employee;     }, [employee]);

  // ── shared fetch logic ─────────────────────────────────────────────────
  const doFetch = useCallback(() => {
    const emp = employeeRef.current;
    if (!emp) return;

    monthReadyRef.current = false;
    setLoading(true);
    setError(null);

    const reqId = ++requestRef.current;
    const view  = currentViewRef.current;
    const date  = currentDateRef.current;
    const month = currentMonthRef.current;

    if (view === "timeGridDay" && date) {
      apiFetch(`/api/logs/${emp.employeeId}?date=${date}`)
        .then((res) => res.json())
        .then((logs) => {
          if (reqId !== requestRef.current) return;
          setEvents(buildDayTimelineEvents(date, logs));
          onDayStats?.(calcDayStats(logs));
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load day logs:", err);
          if (reqId === requestRef.current) {
            setError("Failed to load attendance data");
            setLoading(false);
          }
        });
    } else {
      apiFetch(`/api/attendance/${emp.employeeId}?month=${month}`)
        .then((res) => res.json())
        .then((data) => {
          if (reqId !== requestRef.current) return;
          onDayStats?.(null);
          onSummary?.(calcSummary(data));
          setEvents(data.map(toCalendarEvent));
          monthReadyRef.current = true;
          setLoading(false);
          forceRerender((v) => v + 1);
        })
        .catch((err) => {
          console.error("Failed to load month attendance:", err);
          if (reqId === requestRef.current) {
            setError("Failed to load attendance data");
            setLoading(false);
          }
        });
    }
  }, []); // intentionally empty — reads everything via refs

  // ── effect: fetch whenever the view/date/month/employee actually changes
  useEffect(() => {
    if (!employee) {
      setEvents([]);
      setLoading(false);
      setError(null);
      onSummary?.(null);
      onDayStats?.(null);
      return;
    }
    doFetch();
  }, [employee, currentView, currentDate, currentMonth]);

  // ── effect: IPC invalidation subscription
  //     Dep array is [employee] only.  The handler reads view/date/month
  //     from refs so it is always current without needing to re-subscribe.
  useEffect(() => {
    if (!window.ipc || !employee) return;

    const handler = ({ employeeId }) => {
      // If the event is scoped to a specific employee, ignore if it doesn't match
      if (employeeId && employeeRef.current?.employeeId !== employeeId) return;
      doFetch();
    };

    // on() returns a numeric id; off() takes that id. No function-identity matching.
    const subId = window.ipc.onAttendanceInvalidated(handler);
    return () => window.ipc.offAttendanceInvalidated(subId);
  }, [employee]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full rounded-lg overflow-hidden border border-nero-700 bg-nero-900 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-nero-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-nero-600 border-t-emerald-500 rounded-full animate-spin" />
            <div className="text-sm text-nero-400">Loading attendance...</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="absolute inset-0 bg-nero-900 z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 text-lg mb-2">⚠️ {error}</div>
            <button
              onClick={() => { setError(null); forceRerender((v) => v + 1); }}
              className="px-4 py-2 bg-nero-700 hover:bg-nero-600 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"

        headerToolbar={{
          left:   "dayGridMonth,timeGridDay",
          center: "title",
          right:  "prev today next",
        }}

        fixedWeekCount={false}
        showNonCurrentDates={false}
        dayMaxEvents={1}
        nowIndicator={true}

        allDaySlot={false}
        displayEventTime={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        height="100%"

        events={
          currentView === "dayGridMonth" && !monthReadyRef.current
            ? []
            : events
        }

        eventContent={(arg) =>
          arg.view.type === "dayGridMonth"
            ? renderAttendanceEvent(arg)
            : true
        }

        datesSet={(arg) => {
          setCurrentView(arg.view.type);
          onViewChange?.(arg.view.type);

          if (arg.view.type === "timeGridDay") {
            monthReadyRef.current = false;
            setCurrentDate(arg.startStr.slice(0, 10));
            requestAnimationFrame(() => {
              calendarRef.current?.getApi()?.updateSize();
            });
          } else {
            monthReadyRef.current = false;
            setCurrentDate(null);
            setCurrentMonth(arg.startStr.slice(0, 7));
          }
        }}
      />
    </div>
  );
}