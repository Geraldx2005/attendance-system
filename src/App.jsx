import { useEffect, useState } from "react";
import FairtechDark from "./assets/Fairtech-dark.svg";
import FairtechLight from "./assets/Fairtech-light.svg";
import SearchBar from "./components/SearchBar";
import AttendanceCalendar from "./components/AttendanceCalendar";
import LogsConsole from "./components/LogsConsole/LogsConsole";
import SettingsDialog from "./components/SettingsDialog";
import EmployeeMapDialog from "./components/EmployeeMapDialog";
import ManualSyncButton from "./components/ManualSyncButton";
import Reports from "./components/Reports";
import { apiFetch } from "./utils/api";
import { to12Hour } from "./utils/time";
import ToastHost from "./utils/ToastHost";
import { FaUserEdit } from "react-icons/fa";
import { TbRefreshDot } from "react-icons/tb";

// Icons
import {
  IoCalendarNumberSharp,
  IoBook,
  IoPersonSharp,
  IoSettingsSharp,
  IoClipboard
} from "react-icons/io5";
import { LuSearchX } from "react-icons/lu";

function App() {
  /* State */
  const [activeView, setActiveView] = useState("ATTENDANCE");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  const [theme, setTheme] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  const [logsDayStats, setLogsDayStats] = useState(null);

  const [attendanceView, setAttendanceView] = useState("dayGridMonth");
  const [attendanceDayStats, setAttendanceDayStats] = useState(null);
  const [reportPeriod, setReportPeriod] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await apiFetch("/api/employees");
      const data = await res.json();

      data.sort((a, b) => {
        const na = parseInt(a.employeeId.replace(/\D/g, ""), 10) || 0;
        const nb = parseInt(b.employeeId.replace(/\D/g, ""), 10) || 0;
        return na - nb;
      });

      setEmployees(data);

      if (!searchQuery) {
        setFilteredEmployees(data);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  function formatEmpId(id) {
    if (!id) return "";
    const num = id.replace(/\D/g, "");
    return `EMP${num.padStart(4, "0")}`;
  }

  /* Soft Refresh - Refreshes current view without full page reload */
  const handleSoftRefresh = () => {
    if (refreshing) return;

    setRefreshing(true);

    // Refresh employees list
    fetchEmployees();

    // Trigger re-render of current view by updating refresh key
    setRefreshKey(prev => prev + 1);

    // Reset refreshing state after animation
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Load Employees on mount and periodically
  useEffect(() => {
    fetchEmployees();

    const interval = setInterval(() => {
      fetchEmployees();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Theme
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  // Search
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query) {
      setFilteredEmployees(employees);
      return;
    }

    const q = query.toLowerCase();
    setFilteredEmployees(
      employees.filter(
        emp =>
          emp.name.toLowerCase().includes(q) ||
          emp.employeeId.toLowerCase().includes(q)
      )
    );
  };

  return (
    <main className="w-full h-screen flex bg-nero-900 text-nero-300 select-none">
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <EmployeeMapDialog
        open={mapOpen}
        employee={selectedEmployee}
        onClose={() => setMapOpen(false)}
        onSaved={(newName) => {
          fetchEmployees();

          // Update selected employee name instantly
          setSelectedEmployee((prev) =>
            prev ? { ...prev, name: newName } : prev
          );
        }}
      />

      {/* -------------------------------- Sidebar -------------------------------- */}
      <div className="w-14 bg-nero-800 border-r-2 border-nero-900 flex flex-col items-center gap-2 pb-3">
        {/* Logo */}
        <div className="w-full h-14 flex items-center justify-center border-b-2 border-nero-900 pt-1 select-none">
          <img
            src={theme === "dark" ? FairtechDark : FairtechLight}
            alt="Fairtech"
            className="h-6 object-contain transition-opacity select-none"
          />
        </div>

        <button
          onClick={() => setActiveView("ATTENDANCE")}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
        ${activeView === "ATTENDANCE"
              ? "bg-nero-700 text-nero-300 text-lg"
              : "text-nero-400 hover:bg-nero-700"}`}
        >
          <IoCalendarNumberSharp />
        </button>

        <button
          onClick={() => setActiveView("LOGS")}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
        ${activeView === "LOGS"
              ? "bg-nero-700 text-nero-300 text-lg"
              : "text-nero-400 hover:bg-nero-700"}`}
        >
          <IoBook />
        </button>

        <button
          onClick={() => setActiveView("REPORTS")}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
    ${activeView === "REPORTS"
              ? "bg-nero-700 text-nero-300 text-lg"
              : "text-nero-400 hover:bg-nero-700"}`}
          title="Reports"
        >
          <IoClipboard />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-md flex items-center justify-center text-nero-400 hover:bg-nero-700 transition-colors"
        >
          <IoSettingsSharp />
        </button>
      </div>

      {/* -------------------------------- Main -------------------------------- */}
      <div className="flex-1 flex">

        {/* Employee List */}
        {activeView !== "REPORTS" && (
          <div className="w-72 bg-nero-900 flex flex-col">
            <div className="h-14 px-3 flex items-center bg-nero-800 border-b-2 border-r-2 border-nero-900">
              <SearchBar
                placeholder="Search employee (Name / ID)"
                onSearch={handleSearch}
              />
            </div>

            <div className="flex-1 overflow-auto minimal-scrollbar p-2 px-3 border-r-2 border-nero-600">
              {loadingEmployees && employees.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-nero-450 gap-2">
                  <div className="w-8 h-8 border-4 border-nero-600 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="text-sm">Loading employees...</div>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-nero-450 gap-2">
                  <LuSearchX className="text-5xl" />
                  <div>No employee found</div>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isActive =
                    selectedEmployee?.employeeId === emp.employeeId;

                  return (
                    <div
                      key={emp.employeeId}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`px-3 py-2 mb-1 rounded-md cursor-pointer transition-colors border-2
              ${isActive
                          ? "bg-nero-700 text-nero-400 border-nero-400"
                          : "bg-nero-800 border-transparent hover:bg-[#2b2b2b]"}
            `}
                    >
                      <div className="text-sm font-medium">{emp.name}</div>
                      <div className="text-xs text-nero-400">
                        {formatEmpId(emp.employeeId)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 bg-nero-900 overflow-hidden flex flex-col">

          {/* REPORTS VIEW */}
          {activeView === "REPORTS" && (
            <>
              <div className="h-14 px-4 flex items-center bg-nero-800 border-b-2 border-nero-900">
                <div className="text-lg font-semibold">
                  {reportPeriod
                    ? `Monthly Attendance Report — ${reportPeriod.month} ${reportPeriod.year}`
                    : "Monthly Attendance Report"}
                </div>
              </div>

              <div className="flex-1 p-3 flex min-h-0">
                <Reports onGenerated={(m, y) => setReportPeriod({ month: m, year: y })} />
              </div>
            </>
          )}

          {/* EMPTY STATE */}
          {activeView !== "REPORTS" && !selectedEmployee && (
            <div className="flex-1 flex flex-col items-center justify-center text-nero-450">
              <IoPersonSharp className="text-6xl mb-3 opacity-60" />
              <div className="text-lg font-medium text-nero-300">
                No Employee Selected
              </div>
              <div className="text-sm text-nero-500 mt-1">
                Select an employee from the list
              </div>
            </div>
          )}

          {/* ATTENDANCE */}
          {selectedEmployee && activeView === "ATTENDANCE" && (
            <>
              <div className="h-14 px-4 flex items-center justify-between bg-nero-800 border-b-2 border-nero-900">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">
                      {selectedEmployee.name}
                    </div>

                    <button
                      onClick={() => setMapOpen(true)}
                      title="Edit employee name"
                      className="text-nero-400 hover:text-nero-200 cursor-pointer transition-colors"
                    >
                      <FaUserEdit size={14} />
                    </button>
                  </div>

                  <div className="text-xs text-nero-500">
                    Employee ID • {formatEmpId(selectedEmployee.employeeId)}
                  </div>
                </div>

                {/* Soft Refresh Button */}
                <button
                  onClick={handleSoftRefresh}
                  disabled={refreshing}
                  title="Refresh view"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-nero-700 hover:bg-nero-600 disabled:opacity-50 transition-colors group"
                >
                  <TbRefreshDot
                    size={16}
                    className={`${refreshing ? "animate-spin" : ""} group-hover:text-white transition-colors`}
                  />
                </button>
              </div>

              <div className="px-3 pt-2 pb-0 flex flex-col justify-center">
                <div className="w-full bg-nero-700 px-3 rounded-md flex items-center justify-between">

                  <div className="flex gap-3 text-[13px]">

                    {/* MONTH VIEW SUMMARY */}
                    {attendanceView === "dayGridMonth" && (
                      <>
                        <span className="text-emerald-300">
                          Present: {attendanceSummary?.present ?? 0}
                        </span>

                        <span className="text-amber-200">
                          Half day: {attendanceSummary?.halfDay ?? 0}
                        </span>

                        <span className="text-red-300">
                          Absent: {attendanceSummary?.absent ?? 0}
                        </span>

                        <span className="text-nero-300 border-l border-nero-500 pl-3">
                          Total present: {attendanceSummary?.totalPresent ?? 0}
                        </span>
                      </>
                    )}

                    {/* DAY VIEW STATS */}
                    {attendanceView === "timeGridDay" && (
                      <>
                        <span className="text-emerald-300">
                          Working: {attendanceDayStats?.working || "0h 0m"}
                        </span>

                        <span className="text-red-300">
                          Break: {attendanceDayStats?.breaks || "0h 0m"}
                        </span>

                        <span className="text-nero-300 border-l border-nero-500 pl-3">
                          In: {attendanceDayStats?.firstIn
                            ? to12Hour(attendanceDayStats.firstIn.time)
                            : "--"}
                        </span>

                        <span className="text-nero-300">
                          Out: {attendanceDayStats?.lastOut
                            ? to12Hour(attendanceDayStats.lastOut.time)
                            : "--"}
                        </span>
                      </>
                    )}
                  </div>

                  <ManualSyncButton />
                </div>
              </div>

              <div className="flex-1 p-3">
                <AttendanceCalendar
                  key={`attendance-${refreshKey}`}
                  employee={selectedEmployee}
                  onSummary={setAttendanceSummary}
                  onViewChange={setAttendanceView}
                  onDayStats={setAttendanceDayStats}
                />
              </div>
            </>
          )}

          {/* LOGS */}
          {selectedEmployee && activeView === "LOGS" && (
            <>
              <div className="h-14 px-4 flex items-center justify-between bg-nero-800 border-b-2 border-nero-900">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">
                      {selectedEmployee.name}
                    </div>

                    <button
                      onClick={() => setMapOpen(true)}
                      title="Edit employee name"
                      className="text-nero-400 hover:text-nero-200 cursor-pointer transition-colors"
                    >
                      <FaUserEdit size={14} />
                    </button>
                  </div>

                  <div className="text-xs text-nero-500">
                    Employee ID • {formatEmpId(selectedEmployee.employeeId)}
                  </div>
                </div>

                {/* Soft Refresh Button */}
                <button
                  onClick={handleSoftRefresh}
                  disabled={refreshing}
                  title="Refresh view"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-nero-700 hover:bg-nero-600 disabled:opacity-50 transition-colors group"
                >
                  <TbRefreshDot
                    size={16}
                    className={`${refreshing ? "animate-spin" : ""} group-hover:text-white transition-colors`}
                  />
                </button>
              </div>

              <div className="px-3 pt-2 pb-0 flex flex-col justify-center">

                <div className="w-full bg-nero-700 px-3 rounded-md flex items-center justify-between">

                  <div className="flex gap-3 text-[13px]">
                    <span className="text-emerald-300">
                      Working: {logsDayStats?.working || "0h 0m"}
                    </span>

                    <span className="text-red-300">
                      Break: {logsDayStats?.breaks || "0h 0m"}
                    </span>

                    <span className="text-nero-300 border-l border-nero-500 pl-3">
                      In: {logsDayStats?.firstIn ? to12Hour(logsDayStats.firstIn.time) : "--"}
                    </span>

                    <span className="text-nero-300">
                      Out: {logsDayStats?.lastOut ? to12Hour(logsDayStats.lastOut.time) : "--"}
                    </span>
                  </div>

                  <ManualSyncButton />
                </div>
              </div>

              <div className="flex-1 p-3 flex min-h-0">
                <LogsConsole
                  key={`logs-${refreshKey}`}
                  employee={selectedEmployee}
                  onDayStats={setLogsDayStats}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <ToastHost />
    </main>
  );
}

export default App;