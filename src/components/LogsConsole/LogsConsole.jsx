import { useEffect, useState, useMemo, useRef } from "react";
import LogsToolbar from "./LogsToolbar";
import LogRow from "./LogRow";
import { apiFetch } from "../../utils/api";
import { IoDocumentTextOutline } from "react-icons/io5";

/* Helpers */
function parseTimeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getDateKey(dateStr) {
  const logDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();

  today.setHours(0, 0, 0, 0);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  logDate.setHours(0, 0, 0, 0);

  if (logDate.getTime() === today.getTime()) return "today";
  if (logDate.getTime() === yesterday.getTime()) return "yesterday";

  return "other";
}

export default function LogsConsole({ employee, onDayStats }) {
  const [logs, setLogs] = useState([]);
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [summaryMode, setSummaryMode] = useState(false);

  const requestRef = useRef(0);

  const handleTypeChange = (type) => {
    setTypeFilter(type);
    setSummaryMode(false); // radio behavior
  };

  const handleSummaryToggle = () => {
    setSummaryMode(true);
  };

  function minutesBetween(a, b) {
    return parseTimeToMinutes(b) - parseTimeToMinutes(a);
  }

  function formatMinutes(min) {
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }


  const loadLogs = () => {
    if (!employee) return;

    const reqId = ++requestRef.current;

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 1);

    const fmt = d => d.toISOString().slice(0, 10);

    apiFetch(
      `/api/logs/${employee.employeeId}?from=${fmt(from)}&to=${fmt(today)}`
    )
      .then(res => res.json())
      .then(data => {
        if (reqId !== requestRef.current) return; // avoid stale response

        const formatted = data.map((l, i) => ({
          id: i + 1,
          date: l.date,
          time: l.time,
          type: l.type,     // single source of truth
          source: l.source,
          dateKey: getDateKey(l.date),
        }));

        setLogs(formatted);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLogs([]);
    requestRef.current++;
  }, [employee]);

  useEffect(() => {
    if (!employee) return;
    loadLogs(); // initial fetch when logs view opens
  }, [employee]);

  /* Fetch Logs */
  useEffect(() => {
    if (!window.ipc || !employee) return;

    const handler = ({ employeeId }) => {
      if (employeeId && employee.employeeId !== employeeId) return;
      loadLogs();
    };

    window.ipc.onAttendanceInvalidated(handler);

    return () => {
      window.ipc.offAttendanceInvalidated(handler);
    };
  }, [employee]);

  /* Filter By Date */
  const dayLogs = useMemo(() => {
    return logs.filter((l) => l.dateKey === dateFilter);
  }, [logs, dateFilter]);

  /* Filter By Type */
  const filteredLogs = useMemo(() => {
    return dayLogs.filter((l) => {
      if (typeFilter === "in") return l.type === "IN";
      if (typeFilter === "out") return l.type === "OUT";
      return true;
    });
  }, [dayLogs, typeFilter]);

  /* Day Summary */
  const daySummary = useMemo(() => {
    if (!dayLogs.length) return null;

    const sorted = [...dayLogs].sort(
      (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
    );

    const ins = sorted.filter(l => l.type === "IN");
    const outs = sorted.filter(l => l.type === "OUT");

    if (!ins.length || !outs.length) return null;

    const firstIn = ins[0];
    const lastOut = outs[outs.length - 1];

    let workingMinutes = 0;
    let breakMinutes = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      if (curr.type === "IN" && next.type === "OUT") {
        workingMinutes += minutesBetween(curr.time, next.time);
      }

      if (curr.type === "OUT" && next.type === "IN") {
        breakMinutes += minutesBetween(curr.time, next.time);
      }
    }

    return {
      firstIn,
      lastOut,
      working: formatMinutes(workingMinutes),
      breaks: formatMinutes(breakMinutes),
    };
  }, [dayLogs]);

  useEffect(() => {
  onDayStats?.(daySummary);
}, [daySummary]);



  const logsToShow =
    summaryMode && daySummary
      ? [daySummary.firstIn, daySummary.lastOut]
      : filteredLogs;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <LogsToolbar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        summaryMode={summaryMode}
        onSummaryClick={handleSummaryToggle}
        duration={daySummary?.working}
      />


      <div className="flex-1 min-h-0 bg-nero-900 border border-nero-700 rounded-md flex">
        {logsToShow.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-nero-450">
            <IoDocumentTextOutline className="text-6xl mb-3 opacity-60" />
            <div className="text-lg font-medium text-nero-300">
              No Logs Found
            </div>
            <div className="text-sm text-nero-500 mt-1">
              There are no logs for the selected day
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto minimal-scrollbar pb-2">
            {logsToShow.map((log, idx) => (
              <LogRow
                key={log.id}
                log={log}
                isLast={idx === logsToShow.length - 1}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
