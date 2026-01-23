import { useEffect, useState } from "react";
import SearchBar from "./components/SearchBar";
import AttendanceCalendar from "./components/AttendanceCalendar";
import LogsConsole from "./components/LogsConsole/LogsConsole";
import FairtechDark from "./assets/Fairtech-dark.svg";
import FairtechLight from "./assets/Fairtech-light.svg";
import SettingsDialog from "./components/SettingsDialog";
import EmployeeMapDialog from "./components/EmployeeMapDialog";
import { apiFetch } from "./utils/api";
import Reports from "./components/Reports";
import { FaUserEdit } from "react-icons/fa";

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

  const [searchQuery, setSearchQuery] = useState("");

  const [theme, setTheme] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  const fetchEmployees = () => {
    apiFetch("/api/employees")
      .then(res => res.json())
      .then(data => {
        setEmployees(data);

        if (!searchQuery) {
          setFilteredEmployees(data);
        }
      });
  };

  function formatEmpId(id) {
    if (!id) return "";

    // extract numbers from ID (e.g., FT102 → 102)
    const num = id.replace(/\D/g, "");

    return `EMP${num.padStart(4, "0")}`;
  }


  /* Load Employees from CSV */
  useEffect(() => {
    fetchEmployees();

    const interval = setInterval(() => {
      fetchEmployees();
    }, 15000);

    return () => clearInterval(interval);
  }, [searchQuery]);

  /* Theme */
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  /* Search */
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
        onSaved={() => {
          fetchEmployees();

          // refresh selectedEmployee name instantly
          setSelectedEmployee((prev) =>
            prev
              ? { ...prev, name: document.querySelector('input[placeholder="Enter employee name"]')?.value || prev.name }
              : prev
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
          className={`w-9 h-9 rounded-md flex items-center justify-center
        ${activeView === "ATTENDANCE"
              ? "bg-nero-700 text-nero-300"
              : "text-nero-400 hover:bg-nero-700"}`}
        >
          <IoCalendarNumberSharp />
        </button>

        <button
          onClick={() => setActiveView("LOGS")}
          className={`w-9 h-9 rounded-md flex items-center justify-center
        ${activeView === "LOGS"
              ? "bg-nero-700 text-nero-300"
              : "text-nero-400 hover:bg-nero-700"}`}
        >
          <IoBook />
        </button>

        <button
          onClick={() => setActiveView("REPORTS")}
          className={`w-9 h-9 rounded-md flex items-center justify-center
    ${activeView === "REPORTS"
              ? "bg-nero-700 text-nero-300"
              : "text-nero-400 hover:bg-nero-700"}`}
          title="Reports"
        >
          <IoClipboard />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-md flex items-center justify-center
        text-nero-400 hover:bg-nero-700"
        >
          <IoSettingsSharp />
        </button>
      </div>

      {/* -------------------------------- Main -------------------------------- */}
      <div className="flex-1 flex">
        {/* Employee List */}
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
              {filteredEmployees.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-nero-450 gap-2">
                  <LuSearchX className="text-5xl" />
                  <div>No employee found</div>
                </div>
              )}

              {filteredEmployees.map((emp) => {
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
              })}
            </div>
          </div>
        )}


        {/* Content */}
        <div className="flex-1 bg-nero-900 overflow-hidden flex flex-col">

          {/* REPORTS VIEW (no employee needed) */}
          {activeView === "REPORTS" && (
            <>
              {/* Reports Header */}
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">
                    Attendance Reports
                  </div>
                </div>
              </div>

              <div className="flex-1 p-3 flex min-h-0">
                <Reports />
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
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">
                    {selectedEmployee.name}
                  </div>

                  <button
                    onClick={() => setMapOpen(true)}
                    title="Edit employee name"
                    className="text-nero-400 hover:text-nero-200"
                  >
                    <FaUserEdit size={14} />
                  </button>
                </div>

                <div className="text-xs text-nero-500">
                  Employee ID • {formatEmpId(selectedEmployee.employeeId)}
                </div>
              </div>

              <div className="px-3 pt-2 pb-0 flex flex-col justify-center">

                <div className="w-full bg-nero-700 py-1 px-2 rounded-md flex items-center justify-between">
                  <span className="text-md font-medium">Attendance</span>

                  {attendanceSummary && (
                    <div className="flex gap-3 text-[13px]">
                      <span className="text-emerald-400">
                        Present: {attendanceSummary.present}
                      </span>

                      <span className="text-amber-400">
                        Half day: {attendanceSummary.halfDay}
                      </span>

                      <span className="text-rose-600">
                        Absent: {attendanceSummary.absent}
                      </span>

                      <span className="text-nero-300 border-l border-nero-500 pl-3">
                        Total present: {attendanceSummary.totalPresent}
                      </span>
                    </div>
                  )}
                </div>
              </div>


              <div className="flex-1 p-3">
                <AttendanceCalendar employee={selectedEmployee} onSummary={setAttendanceSummary} />
              </div>
            </>
          )}

          {/* LOGS */}
          {selectedEmployee && activeView === "LOGS" && (
            <>
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">
                    {selectedEmployee.name}
                  </div>

                  <button
                    onClick={() => setMapOpen(true)}
                    title="Edit employee name"
                    className="text-nero-400 hover:text-nero-200"
                  >
                    <FaUserEdit size={14} />
                  </button>
                </div>

                <div className="text-xs text-nero-500">
                  Employee ID • {formatEmpId(selectedEmployee.employeeId)}
                </div>
              </div>

              <div className="flex-1 p-3 flex min-h-0">
                <LogsConsole employee={selectedEmployee} />
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}

export default App;