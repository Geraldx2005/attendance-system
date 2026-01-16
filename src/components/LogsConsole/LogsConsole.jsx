import { useEffect, useState, useMemo } from "react";
import LogsToolbar from "./LogsToolbar";
import LogRow from "./LogRow";

/* ---------------------------------------
   HELPERS
--------------------------------------- */
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

export default function LogsConsole({ employee }) {
  const [logs, setLogs] = useState([]);
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [summaryMode, setSummaryMode] = useState(false);

  /* ---------------------------------------
     FETCH LOGS
  --------------------------------------- */
  useEffect(() => {
    if (!employee) return;

    const loadLogs = () => {
      if (!employee) return;

      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 1);

      const fmt = d => d.toISOString().slice(0, 10);

      fetch(
        `http://localhost:4000/api/logs/${employee.employeeId}?from=${fmt(from)}&to=${fmt(today)}`
      )
        .then(res => res.json())
        .then(data => {
          const formatted = data.map((l, i) => ({
            id: i + 1,
            date: l.date,
            time: l.time,
            type: l.type,
            source: l.source,
            dateKey: getDateKey(l.date),
          }));
          setLogs(formatted);
        })
        .catch(console.error);
    };


    loadLogs(); // initial fetch

    const interval = setInterval(() => {
      loadLogs(); // auto update
    }, 15000); // every 15 seconds

    return () => clearInterval(interval);
  }, [employee]);


  /* ---------------------------------------
     FILTER BY DATE
  --------------------------------------- */
  const dayLogs = useMemo(() => {
    return logs.filter((l) => l.dateKey === dateFilter);
  }, [logs, dateFilter]);

  /* ---------------------------------------
     FILTER BY TYPE
  --------------------------------------- */
  const filteredLogs = useMemo(() => {
    return dayLogs.filter((l) => {
      if (typeFilter === "in") return l.type === "IN";
      if (typeFilter === "out") return l.type === "OUT";
      return true;
    });
  }, [dayLogs, typeFilter]);

  /* ---------------------------------------
     DAY SUMMARY (INDEPENDENT)
  --------------------------------------- */
  const daySummary = useMemo(() => {
    if (!summaryMode) return null;

    const ins = dayLogs.filter((l) => l.type === "IN");
    const outs = dayLogs.filter((l) => l.type === "OUT");

    if (!ins.length || !outs.length) return null;

    const firstIn = ins.reduce((a, b) =>
      parseTimeToMinutes(a.time) < parseTimeToMinutes(b.time) ? a : b
    );

    const lastOut = outs.reduce((a, b) =>
      parseTimeToMinutes(a.time) > parseTimeToMinutes(b.time) ? a : b
    );

    const diff =
      parseTimeToMinutes(lastOut.time) -
      parseTimeToMinutes(firstIn.time);

    return {
      firstIn,
      lastOut,
      duration: `${Math.floor(diff / 60)}h ${diff % 60}m`,
    };
  }, [summaryMode, dayLogs]);

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
        setTypeFilter={setTypeFilter}
        summaryMode={summaryMode}
        setSummaryMode={setSummaryMode}
        duration={daySummary?.duration}
      />

      <div className="flex-1 overflow-auto minimal-scrollbar bg-nero-900 border border-nero-700 rounded-xl">
        {logsToShow.length === 0 && (
          <div className="h-full flex items-center justify-center text-nero-500 text-sm">
            No logs found
          </div>
        )}

        {logsToShow.map((log) => (
          <LogRow key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
