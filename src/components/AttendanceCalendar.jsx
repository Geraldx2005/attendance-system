import { useEffect, useState, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { to12Hour } from "../utils/time";
import { apiFetch } from "../utils/api";
import { calcDayStats } from "../utils/attendanceStats";

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

/* Day Timeline Builder */
function buildDayTimelineEvents(date, logs) {
  if (!logs || logs.length === 0) {
    const anchorStart = new Date(`${date}T08:00:00`);
    const anchorEnd = new Date(anchorStart);
    anchorEnd.setMinutes(anchorEnd.getMinutes() + 1);

    return [
      {
        id: "anchor",
        title: "",
        start: anchorStart,
        end: anchorEnd,
        display: "background",
        backgroundColor: "transparent",
      },
    ];
  }

  const sorted = [...logs].sort((a, b) => a.time.localeCompare(b.time));
  const events = [];

  for (let i = 0; i < sorted.length; i++) {
    const punch = sorted[i];
    const isIn = i % 2 === 0;
    
    const start = new Date(`${punch.date}T${punch.time}`);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    events.push({
      id: `${punch.date}-${punch.time}-${i}`,
      title: isIn
        ? `Check In · ${to12Hour(punch.time)}`
        : `Check Out · ${to12Hour(punch.time)}`,
      start,
      end,
      backgroundColor: isIn ? "#16a34a" : "#dc2626",
      borderColor: isIn ? "#16a34a" : "#dc2626",
      textColor: "#fff",
      classNames: ["day-log-event"],
    });
  }

  return events;
}

/* Component */
export default function AttendanceCalendar({ 
  employee, 
  onSummary, 
  onViewChange, 
  onDayStats, 
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [, forceRerender] = useState(0);

  const calendarRef = useRef(null);
  const requestRef = useRef(0);
  const monthReadyRef = useRef(false);

  /* Initial Load */
  useEffect(() => {
    if (!employee) {
      setEvents([]);
      setLoading(false);
      setError(null);
      onSummary?.(null);
      onDayStats?.(null);
      return;
    }

    monthReadyRef.current = false;
    setLoading(true);
    setError(null);

    const reqId = ++requestRef.current;

    if (currentView === "timeGridDay" && currentDate) {
      apiFetch(`/api/logs/${employee.employeeId}?date=${currentDate}`)
        .then(res => res.json())
        .then(logs => {
          if (reqId !== requestRef.current) return;
          
          setEvents(buildDayTimelineEvents(currentDate, logs));
          onDayStats?.(calcDayStats(logs));
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load day logs:", err);
          if (reqId === requestRef.current) {
            setError("Failed to load attendance data");
            setLoading(false);
          }
        });
    } else {
      apiFetch(`/api/attendance/${employee.employeeId}?month=${currentMonth}`)
        .then(res => res.json())
        .then(data => {
          if (reqId !== requestRef.current) return;

          onDayStats?.(null);

          let present = 0;
          let halfDay = 0;
          let absent = 0;

          data.forEach(d => {
            if (d.status === "Present") present++;
            else if (d.status === "Half Day") halfDay++;
            else if (d.status === "Absent") absent++;
          });

          const totalPresent = present + halfDay * 0.5;

          onSummary?.({
            present,
            halfDay,
            absent,
            totalPresent,
          });

          setEvents(
            data.map(d => ({
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
          
          monthReadyRef.current = true;
          setLoading(false);
          forceRerender(v => v + 1);
        })
        .catch(err => {
          console.error("Failed to load month attendance:", err);
          if (reqId === requestRef.current) {
            setError("Failed to load attendance data");
            setLoading(false);
          }
        });
    }
  }, [employee, currentView, currentDate, currentMonth]);

  /* IPC Invalidation */
  useEffect(() => {
    if (!window.ipc || !employee) return;

    const handler = ({ employeeId }) => {
      if (employeeId && employee.employeeId !== employeeId) return;

      const reqId = ++requestRef.current;
      setLoading(true);

      if (currentView === "timeGridDay" && currentDate) {
        apiFetch(`/api/logs/${employee.employeeId}?date=${currentDate}`)
          .then(res => res.json())
          .then(logs => {
            if (reqId !== requestRef.current) return;
            setEvents(buildDayTimelineEvents(currentDate, logs));
            onDayStats?.(calcDayStats(logs));
            setLoading(false);
          })
          .catch(() => reqId === requestRef.current && setLoading(false));
      } else {
        apiFetch(`/api/attendance/${employee.employeeId}?month=${currentMonth}`)
          .then(res => res.json())
          .then(data => {
            if (reqId !== requestRef.current) return;

            onDayStats?.(null);
            
            let present = 0, halfDay = 0, absent = 0;
            data.forEach(d => {
              if (d.status === "Present") present++;
              else if (d.status === "Half Day") halfDay++;
              else if (d.status === "Absent") absent++;
            });

            onSummary?.({
              present,
              halfDay,
              absent,
              totalPresent: present + halfDay * 0.5,
            });

            setEvents(
              data.map(d => ({
                title: d.status === "Pending" ? "" : d.status,
                start: d.date,
                firstIn: d.firstIn,
                lastOut: d.lastOut,
                backgroundColor:
                  d.status === "Present" ? "#2e7d32"
                  : d.status === "Half Day" ? "#b7791f"
                  : d.status === "Absent" ? "#8b1d1d"
                  : "transparent",
                borderColor: "transparent",
              }))
            );
            
            monthReadyRef.current = true;
            setLoading(false);
            forceRerender(v => v + 1);
          })
          .catch(() => reqId === requestRef.current && setLoading(false));
      }
    };

    window.ipc.onAttendanceInvalidated(handler);
    return () => window.ipc.offAttendanceInvalidated(handler);
  }, [employee, currentView, currentDate, currentMonth]);

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
              onClick={() => {
                setError(null);
                forceRerender(v => v + 1);
              }}
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
          left: "dayGridMonth,timeGridDay",
          center: "title",
          right: "prev today next",
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
            const date = arg.startStr.slice(0, 10);
            setCurrentDate(date);

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