import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import LogsToolbar from "./LogsToolbar";
import LogRow from "./LogRow";
import { apiFetch } from "../../utils/api";
import { calcDayStats } from "../../utils/attendanceStats";
import { 
  IoDocumentTextOutline, 
  IoAlertCircleOutline,
  IoRefreshOutline 
} from "react-icons/io5";

function getDateKey(dateStr) {
  try {
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
  } catch (err) {
    console.error("Invalid date:", dateStr);
    return "other";
  }
}

export default function LogsConsole({ employee, onDayStats }) {
  const [logs, setLogs] = useState([]);
  const [dateFilter, setDateFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [summaryMode, setSummaryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestRef = useRef(0);
  const invalidateTimer = useRef(null);
  const isMounted = useRef(true);

  const handleTypeChange = useCallback((type) => {
    setTypeFilter(type);
    setSummaryMode(false);
  }, []);

  const handleSummaryToggle = useCallback(() => {
    setSummaryMode(true);
    setTypeFilter("all");
  }, []);

  const loadLogs = useCallback(async () => {
    if (!employee) {
      setLogs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const reqId = ++requestRef.current;

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 1);

    const fmt = d => d.toISOString().slice(0, 10);

    setIsLoading(true);
    setError(null);

    try {
      // Check if IPC is available
      if (!window.api || !window.api.getLogs) {
        throw new Error("IPC API not available. Please restart the application.");
      }

      const response = await apiFetch(
        `/api/logs/${employee.employeeId}?from=${fmt(from)}&to=${fmt(today)}`
      );

      // Check if request is still relevant
      if (reqId !== requestRef.current || !isMounted.current) {
        return;
      }

      // Check response status
      if (response && !response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Final relevance check
      if (reqId !== requestRef.current || !isMounted.current) {
        return;
      }

      // Validate data
      if (!Array.isArray(data)) {
        console.error("Invalid response format:", data);
        throw new Error("Invalid data format received");
      }

      // Sort by date and time
      data.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      // Derive IN/OUT from punch sequence
      const formatted = data.map((l, i) => ({
        id: `${l.date}-${l.time}-${i}`,
        date: l.date,
        time: l.time,
        type: i % 2 === 0 ? "IN" : "OUT",
        source: l.source,
        dateKey: getDateKey(l.date),
      }));

      if (isMounted.current) {
        setLogs(formatted);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);

      // Check if request is still relevant
      if (reqId !== requestRef.current || !isMounted.current) {
        return;
      }

      // User-friendly error messages
      let errorMessage = "Failed to load attendance logs";

      if (err.message.includes("IPC API not available")) {
        errorMessage = "Application error. Please restart the app";
      } else if (err.message.includes("404") || err.message.includes("not found")) {
        errorMessage = "No attendance data found for this employee";
      } else if (err.message.includes("500") || err.message.includes("Internal")) {
        errorMessage = "Database error. Please try again";
      } else if (err.message.includes("Invalid data")) {
        errorMessage = "Invalid data received. Please contact support";
      } else if (err.message.includes("window.api")) {
        errorMessage = "IPC communication error. Please restart the app";
      } else if (err.message.includes("Unknown API")) {
        errorMessage = "API endpoint not found";
      }

      if (isMounted.current) {
        setError(errorMessage);
        setLogs([]);
      }
    } finally {
      if (reqId === requestRef.current && isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [employee]);

  const handleRetry = useCallback(() => {
    setError(null);
    loadLogs();
  }, [loadLogs]);

  // Track mount state
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset state when employee changes
  useEffect(() => {
    setLogs([]);
    setError(null);
    setIsLoading(false);
    setSummaryMode(false);
    setTypeFilter("all");
    requestRef.current++;
  }, [employee]);

  // Load logs when employee is selected
  useEffect(() => {
    if (!employee) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    loadLogs();
  }, [employee, loadLogs]);

  // IPC Invalidation Handler
  useEffect(() => {
    if (!window.ipc || !employee) return;

    const handler = ({ employeeId }) => {
      if (employeeId && employee.employeeId !== employeeId) return;

      // Debounce multiple invalidations
      if (invalidateTimer.current) return;

      invalidateTimer.current = setTimeout(() => {
        invalidateTimer.current = null;
        loadLogs();
      }, 300);
    };

    window.ipc.onAttendanceInvalidated(handler);

    return () => {
      window.ipc.offAttendanceInvalidated(handler);
      if (invalidateTimer.current) {
        clearTimeout(invalidateTimer.current);
        invalidateTimer.current = null;
      }
    };
  }, [employee, loadLogs]);

  // Filter By Date
  const dayLogs = useMemo(() => {
    return logs.filter((l) => l.dateKey === dateFilter);
  }, [logs, dateFilter]);

  // Filter By Type
  const filteredLogs = useMemo(() => {
    if (typeFilter === "in") return dayLogs.filter((l) => l.type === "IN");
    if (typeFilter === "out") return dayLogs.filter((l) => l.type === "OUT");
    return dayLogs;
  }, [dayLogs, typeFilter]);

  // Day Summary
  const daySummary = useMemo(() => {
    if (!dayLogs.length) return null;
    try {
      return calcDayStats(dayLogs);
    } catch (err) {
      console.error("Failed to calculate day stats:", err);
      return null;
    }
  }, [dayLogs]);

  // Notify parent of day stats changes
  useEffect(() => {
    onDayStats?.(daySummary);
  }, [daySummary, onDayStats]);

  // Logs to Display
  const logsToShow = useMemo(() => {
    if (summaryMode && daySummary?.firstIn && daySummary?.lastOut) {
      return [
        { ...daySummary.firstIn, type: "IN", id: "summary-first" },
        { ...daySummary.lastOut, type: "OUT", id: "summary-last" }
      ];
    }
    return filteredLogs;
  }, [summaryMode, daySummary, filteredLogs]);

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
        isLoading={isLoading}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 text-sm text-red-400 flex items-start gap-3">
          <IoAlertCircleOutline className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">Error Loading Logs</div>
            <div className="text-red-400/80 mt-0.5">{error}</div>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors"
          >
            <IoRefreshOutline className="text-sm" />
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-nero-900 border border-nero-700 rounded-md flex">
        {isLoading ? (
          // Loading State
          <div className="flex-1 flex flex-col items-center justify-center text-nero-400 gap-4">
            <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-lg font-medium text-nero-300">Loading Logs...</div>
            <div className="text-sm text-nero-500">Please wait while we fetch attendance data</div>
          </div>
        ) : logsToShow.length === 0 && !error ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center text-nero-450">
            <IoDocumentTextOutline className="text-6xl mb-3 opacity-60" />
            <div className="text-lg font-medium text-nero-300">
              No Logs Found
            </div>
            <div className="text-sm text-nero-500 mt-1">
              There are no logs for the selected day
            </div>
          </div>
        ) : !error ? (
          // Logs List
          <div className="flex-1 overflow-auto minimal-scrollbar">
            {logsToShow.map((log, idx) => (
              <LogRow
                key={log.id}
                log={log}
                isLast={idx === logsToShow.length - 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}