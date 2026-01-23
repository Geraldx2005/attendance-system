import { useEffect, useState, useRef } from "react";
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
export default function AttendanceCalendar({ employee, onSummary }) {
  const [events, setEvents] = useState([]);

  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const calendarRef = useRef(null);
  const requestRef = useRef(0);

  /* Initial Load */
  useEffect(() => {
    if (!employee) return;

    setEvents([]); // safe to reset events on employee change (avoid stale data)
    const reqId = ++requestRef.current; // increment request version

    if (currentView === "timeGridDay" && currentDate) {
      apiFetch(`/api/logs/${employee.employeeId}?date=${currentDate}`)
        .then(res => res.json())
        .then(logs => {
          if (reqId !== requestRef.current) return; // avoids stale response
          setEvents(buildDayTimelineEvents(currentDate, logs));
        })
        .catch(console.error);

    } else {
      apiFetch(
        `/api/attendance/${employee.employeeId}?month=${currentMonth}`
      )
        .then(res => res.json())
        .then(data => {
          if (reqId !== requestRef.current) return; // avoids stale response
          // -------- Attendance Summary --------
          let present = 0;
          let halfDay = 0;
          let absent = 0;

          for (const d of data) {
            if (d.status === "Present") present++;
            else if (d.status === "Half Day") halfDay++;
            else if (d.status === "Absent") absent++;
          }

          onSummary?.({
            present,
            halfDay,
            absent,
            totalPresent: present + halfDay * 0.5,
            totalDays: data.length,
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
        })
        .catch(console.error);
    }
  }, [employee, currentView, currentDate, currentMonth]);

  /* IPC Invalidation */
  useEffect(() => {
    if (!window.ipc || !employee) return;

    const handler = ({ employeeId }) => {
      if (employeeId && employee.employeeId !== employeeId) return;

      const reqId = ++requestRef.current; // invalidate old requests

      if (currentView === "timeGridDay" && currentDate) {
        apiFetch(`/api/logs/${employee.employeeId}?date=${currentDate}`)
          .then(res => res.json())
          .then(logs => {
            if (reqId !== requestRef.current) return;
            setEvents(buildDayTimelineEvents(currentDate, logs));
          })
          .catch(console.error);
      } else {
        apiFetch(
          `/api/attendance/${employee.employeeId}?month=${currentMonth}`
        )
          .then(res => res.json())
          .then(data => {
            if (reqId !== requestRef.current) return;

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
          })
          .catch(console.error);
      }
    };

    window.ipc.onAttendanceInvalidated(handler);
    return () => window.ipc.offAttendanceInvalidated(handler);
  }, [employee, currentView, currentDate]);

  return (
    <div className="h-full rounded-lg overflow-hidden border border-nero-700 bg-nero-900">
      <FullCalendar ref={calendarRef}
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

          if (arg.view.type === "timeGridDay") {
            setCurrentDate(arg.startStr.slice(0, 10));
          } else {
            setCurrentDate(null);

            // 👇 IMPORTANT: track visible month
            const month = arg.startStr.slice(0, 7);
            setCurrentMonth(month);
          }
        }}



      />
    </div>
  );
}
