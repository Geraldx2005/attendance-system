import { useState } from "react";
import SearchBar from "./components/SearchBar";
import AttendanceCalendar from "./components/AttendanceCalendar";

// Icons
import { IoCalendarNumberSharp, IoBook, IoPersonSharp } from "react-icons/io5";
import { LuSearchX } from "react-icons/lu";


function App() {
  // State
  const [activeView, setActiveView] = useState("ATTENDANCE");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // MASTER DATA
  const [employees] = useState([
    { employeeId: "EMP001", name: "John Doe" },
    { employeeId: "EMP002", name: "Jane Smith" },
    { employeeId: "EMP003", name: "Alex Johnson" },
    { employeeId: "EMP004", name: "Michael Brown" },
    { employeeId: "EMP005", name: "Emily Davis" },
    { employeeId: "EMP006", name: "Daniel Wilson" },
    { employeeId: "EMP007", name: "Sophia Martinez" },
    { employeeId: "EMP008", name: "Chris Anderson" },
    { employeeId: "EMP009", name: "Olivia Taylor" },
    { employeeId: "EMP010", name: "Matthew Thomas" },
    { employeeId: "EMP011", name: "Ava Moore" },
    { employeeId: "EMP012", name: "Ryan Jackson" },
    { employeeId: "EMP013", name: "Isabella White" },
    { employeeId: "EMP014", name: "David Harris" },
    { employeeId: "EMP015", name: "Mia Martin" },
    { employeeId: "EMP016", name: "Andrew Thompson" },
    { employeeId: "EMP017", name: "Charlotte Garcia" },
    { employeeId: "EMP018", name: "Joshua Martinez" },
    { employeeId: "EMP019", name: "Amelia Robinson" },
    { employeeId: "EMP020", name: "Ethan Clark" },
    { employeeId: "EMP021", name: "Harper Rodriguez" },
    { employeeId: "EMP022", name: "Noah Lewis" },
    { employeeId: "EMP023", name: "Ella Lee" },
    { employeeId: "EMP024", name: "Benjamin Walker" },
    { employeeId: "EMP025", name: "Grace Hall" },
    { employeeId: "EMP026", name: "Samuel Allen" },
    { employeeId: "EMP027", name: "Lily Young" },
    { employeeId: "EMP028", name: "Nathan King" },
    { employeeId: "EMP029", name: "Zoey Wright" },
    { employeeId: "EMP030", name: "Lucas Scott" },
  ]);

  // Filtered Data
  const [filteredEmployees, setFilteredEmployees] = useState(employees);

  // Search
  const handleSearch = (query) => {
    if (!query) {
      setFilteredEmployees(employees);
      return;
    }

    const q = query.toLowerCase();

    setFilteredEmployees(
      employees.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          emp.employeeId.toLowerCase().includes(q)
      )
    );
  };

  return (
    <main className="w-full h-screen flex bg-nero-900 text-nero-300 select-none">
      {/* SideBar */}
      <div className="w-14 bg-nero-800 border-r-2 border-nero-900 flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setActiveView("ATTENDANCE")}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors
              ${activeView === "ATTENDANCE"
              ? "bg-nero-700 text-nero-300"
              : "text-nero-400 hover:bg-nero-700"}
          `}
          title="Attendance"
        >
          <IoCalendarNumberSharp className="text-lg" />
        </button>

        <button
          onClick={() => setActiveView("LOGS")}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors
              ${activeView === "LOGS"
              ? "bg-nero-700 text-nero-300"
              : "text-nero-400 hover:bg-nero-700"}
          `}
          title="Employee Logs"
          aria-label="Employee Logs"
        >
          <IoBook className="text-lg" />
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex">
        {/* Left: Employee List */}
        <div className="w-72 bg-nero-900 border-r-2 border-nero-900 flex flex-col">
          {/* Search */}
          <div className="h-14 px-3 flex items-center bg-nero-800 border-b-2 border-nero-900">
            <SearchBar
              placeholder="Search employee (Name / ID)"
              onSearch={handleSearch}
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto minimal-scrollbar p-2 border-r border-r-nero-800">
            {filteredEmployees.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-nero-450 gap-2">
                <LuSearchX className="text-5xl" />
                <div className="text-md">No employee found</div>
              </div>
            )}

            {filteredEmployees.map((emp) => {
              const isActive =
                selectedEmployee?.employeeId === emp.employeeId;

              return (
                <div
                  key={emp.employeeId}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`px-3 py-2 mb-1 rounded-md cursor-pointer transition-colors
                  ${isActive
                      ? "bg-nero-700 text-nero-300"
                      : "bg-nero-800 hover:bg-[#2b2b2b]"
                    }`}
                >
                  <div className="text-sm font-medium">{emp.name}</div>
                  <div className="text-xs text-nero-400">
                    {emp.employeeId}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Right: Content */}
        <div className="flex-1 bg-nero-900 overflow-hidden flex flex-col">

          {/* Empty State */}
          {!selectedEmployee && (
            <div className="flex-1 flex flex-col items-center justify-center text-nero-450">
              <IoPersonSharp className="text-6xl mb-3 opacity-60" />
              <div className="text-lg font-medium text-nero-300">
                No Employee Selected
              </div>
              <div className="text-sm text-nero-500 mt-1">
                Select an employee from the list to view attendance or logs
              </div>
            </div>
          )}

          {/* Attendance View */}
          {selectedEmployee && activeView === "ATTENDANCE" && (
            <>
              {/* Header – Employee Identity */}
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="text-lg font-semibold text-nero-200 leading-tight">
                  {selectedEmployee.name}
                </div>
                <div className="text-xs text-nero-500">
                  Employee ID • {selectedEmployee.employeeId}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden p-3 flex flex-col">
                {/* Section Label */}
                <div className="bg-nero-800 px-3 py-1 text-xs uppercase tracking-wide text-nero-500 mb-2 rounded-lg">
                  Attendance
                </div>

                {/* Calendar */}
                <div className="flex-1 overflow-hidden">
                  <AttendanceCalendar employee={selectedEmployee} />
                </div>
              </div>
            </>
          )}

          {/* Logs View */}
          {selectedEmployee && activeView === "LOGS" && (
            <>
              <div className="h-16 px-4 flex flex-col justify-center bg-nero-800 border-b border-nero-900">
                <div className="text-sm font-medium text-nero-300">
                  Employee Logs
                </div>
                <div className="text-xs text-nero-500">
                  {selectedEmployee.name} • {selectedEmployee.employeeId}
                </div>
              </div>

              <div className="flex-1 p-4 text-nero-500 text-sm">
                {/* LOG TABLE GOES HERE */}
                Logs will appear here
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}

export default App;
