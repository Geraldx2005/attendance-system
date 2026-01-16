import { useEffect, useState } from "react";
import SearchBar from "./components/SearchBar";
import AttendanceCalendar from "./components/AttendanceCalendar";
import LogsConsole from "./components/LogsConsole/LogsConsole";
import FairtechDark from "./assets/Fairtech-dark.svg";
import FairtechLight from "./assets/Fairtech-light.svg";

// Icons
import {
  IoCalendarNumberSharp,
  IoBook,
  IoPersonSharp,
  IoMoon,
  IoSunny,
} from "react-icons/io5";
import { LuSearchX } from "react-icons/lu";

function App() {
  /* ---------------------------------------
     STATE
  --------------------------------------- */
  const [activeView, setActiveView] = useState("ATTENDANCE");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [theme, setTheme] = useState("dark");

  const fetchEmployees = () => {
    fetch("http://localhost:4000/api/employees")
      .then(res => res.json())
      .then(data => {
        setEmployees(data);

        if (!searchQuery) {
          setFilteredEmployees(data);
        }
      });
  };

  /* ---------------------------------------
     LOAD EMPLOYEES FROM CSV
  --------------------------------------- */
  useEffect(() => {
    fetchEmployees();

    const interval = setInterval(() => {
      fetchEmployees();
    }, 2000);

    return () => clearInterval(interval);
  }, [searchQuery]);

  /* ---------------------------------------
     THEME
  --------------------------------------- */
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  /* ---------------------------------------
     SEARCH
  --------------------------------------- */
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
      {/* -------------------------------- Sidebar -------------------------------- */}
      <div className="w-14 bg-nero-800 border-r-2 border-nero-900 flex flex-col items-center gap-2 pb-3">
        {/* Logo */}
        <div className="w-full h-14 flex items-center justify-center border-b-2 border-nero-900 pt-1">
          <img
            src={theme === "dark" ? FairtechDark : FairtechLight}
            alt="Fairtech"
            className="h-7 object-contain transition-opacity"
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

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-md flex items-center justify-center
          text-nero-400 hover:bg-nero-700"
        >
          {theme === "dark" ? <IoSunny /> : <IoMoon />}
        </button>
      </div>

      {/* -------------------------------- Main -------------------------------- */}
      <div className="flex-1 flex">
        {/* Employee List */}
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
                      : "bg-nero-800 border-transparent hover:bg-[#2b2b2b]"
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

        {/* Content */}
        <div className="flex-1 bg-nero-900 overflow-hidden flex flex-col">
          {!selectedEmployee && (
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

          {selectedEmployee && activeView === "ATTENDANCE" && (
            <>
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="text-lg font-semibold">
                  {selectedEmployee.name}
                </div>
                <div className="text-xs text-nero-500">
                  Employee ID • {selectedEmployee.employeeId}
                </div>
              </div>

              <div className="flex-1 p-3">
                <AttendanceCalendar employee={selectedEmployee} />
              </div>
            </>
          )}

          {selectedEmployee && activeView === "LOGS" && (
            <>
              <div className="h-14 px-4 flex flex-col justify-center bg-nero-800 border-b-2 border-nero-900">
                <div className="text-lg font-semibold">
                  {selectedEmployee.name}
                </div>
                <div className="text-xs text-nero-500">
                  Employee ID • {selectedEmployee.employeeId}
                </div>
              </div>

              <div className="flex-1 p-3">
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
