import { useState, useMemo } from "react";
import { MaterialReactTable } from "material-react-table";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SettingsDialog from "./SettingsDialog";

/* MOCK DATA (3 DAYS PER EMP) */
const MOCK_REPORT_DATA = [
  { employee: "Rahul Sharma", date: "2026-01-01", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-02", status: "Half Day" },
  { employee: "Rahul Sharma", date: "2026-01-03", status: "Absent" },

  { employee: "Ankit Verma", date: "2026-01-01", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-02", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-03", status: "Half Day" },

  { employee: "Priya Singh", date: "2026-01-01", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-02", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-03", status: "Present" },

  { employee: "Suresh Kumar", date: "2026-01-01", status: "Absent" },
  { employee: "Suresh Kumar", date: "2026-01-02", status: "Half Day" },
  { employee: "Suresh Kumar", date: "2026-01-03", status: "Present" },

  { employee: "Amit Patel", date: "2026-01-01", status: "Half Day" },
  { employee: "Amit Patel", date: "2026-01-02", status: "Absent" },
  { employee: "Amit Patel", date: "2026-01-03", status: "Present" },

  { employee: "Neha Iyer", date: "2026-01-01", status: "Present" },
  { employee: "Neha Iyer", date: "2026-01-02", status: "Half Day" },
  { employee: "Neha Iyer", date: "2026-01-03", status: "Present" },
];

/* Aggregate Monthly */
function aggregateMonthly(data) {
  const map = {};

  for (const r of data) {
    if (!map[r.employee]) {
      map[r.employee] = {
        employeeName: r.employee,
        present: 0,
        halfDay: 0,
        absent: 0,
        totalPresent: 0,
      };
    }

    if (r.status === "Present") {
      map[r.employee].present++;
      map[r.employee].totalPresent += 1;
    } else if (r.status === "Half Day") {
      map[r.employee].halfDay++;
      map[r.employee].totalPresent += 0.5;
    } else {
      map[r.employee].absent++;
    }
  }

  return Object.values(map);
}

/* Dark MUI Theme */
const darkMuiTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0b0b0b",
      paper: "#0b0b0b",
    },
    text: {
      primary: "#e5e7eb",
      secondary: "#9ca3af",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
});

/* Component */
export default function Reports() {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState("01");
  const [year, setYear] = useState("2026");

  const generateReport = () => {
    setRows(aggregateMonthly(MOCK_REPORT_DATA));
  };

  /* ---------- Table Data ---------- */
  const tableData = useMemo(() => {
    return rows.map((r, idx) => {
      const days = r.present + r.halfDay + r.absent;
      const pct = days
        ? ((r.totalPresent / days) * 100).toFixed(1)
        : "0.0";

      return {
        employeeId: `EMP${String(idx + 1).padStart(3, "0")}`,
        employeeName: r.employeeName,
        present: r.present,
        halfDay: r.halfDay,
        absent: r.absent,
        totalPresent: r.totalPresent,
        attendancePct: pct,
      };
    });
  }, [rows]);

  /* ---------- Columns ---------- */
  const columns = useMemo(
    () => [
      { accessorKey: "employeeId", header: "ID", size: 110 },
      { accessorKey: "employeeName", header: "Employee", size: 260 },

      {
        accessorKey: "present",
        header: "Present",
        Cell: ({ cell }) => (
          <span className="font-semibold text-emerald-400">{cell.getValue()}</span>
        ),
      },
      {
        accessorKey: "halfDay",
        header: "Half Day",
        Cell: ({ cell }) => (
          <span className="font-semibold text-amber-400">{cell.getValue()}</span>
        ),
      },
      {
        accessorKey: "absent",
        header: "Absent",
        Cell: ({ cell }) => (
          <span className="font-semibold text-red-400">{cell.getValue()}</span>
        ),
      },
      {
        accessorKey: "totalPresent",
        header: "Total",
        Cell: ({ cell }) => (
          <span className="font-semibold text-nero-100">
            {cell.getValue()}
          </span>
        ),
      },
      {
        accessorKey: "attendancePct",
        header: "Attendance %",
        Cell: ({ cell }) => (
          <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
            {cell.getValue()}%
          </span>
        ),
      },
    ],
    []
  );

  const avgAttendance =
    tableData.length > 0
      ? (
        tableData.reduce((a, b) => a + Number(b.attendancePct), 0) /
        tableData.length
      ).toFixed(1)
      : "0.0";

  return (
    <>
      <div className="w-full h-full flex flex-col gap-3">

        {/* Top Bar */}
        <div className="flex items-center gap-2 bg-nero-800 border border-nero-700 rounded-md px-3 py-2">

          {/* Month + Year (STUCK TOGETHER) */}
          <div className="flex">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-nero-900 border border-nero-700 border-r-0 px-2 py-1 text-sm rounded-l-md"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="bg-nero-900 border border-nero-700 px-2 py-1 text-sm rounded-r-md"
            >
              {["2024", "2025", "2026"].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* KPI */}
          <div className="flex gap-4 text-sm text-nero-400 ml-3">
            <span>Employees: {rows.length}</span>
            <span>Avg Attendance: {avgAttendance}%</span>
          </div>

          <button
            onClick={generateReport}
            className="ml-auto px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-black"
          >
            Generate
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 border border-nero-700 rounded-md overflow-hidden bg-[#0b0b0b] flex flex-col">
          {rows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-nero-500 text-sm">
              Generate a monthly report
            </div>
          ) : (
            <ThemeProvider theme={darkMuiTheme}>
              <CssBaseline />
              <MaterialReactTable
                columns={columns}
                data={tableData}
                layoutMode="grid"
                enableStickyHeader
                enableDensityToggle={false}
                enableColumnActions
                enableFullScreenToggle
                enableHiding
                enableSorting
                enableGlobalFilter
                initialState={{ density: "comfortable" }}
                enableRowSelection={false}
                enableColumnFilters={true}
                enableColumnOrdering={false}
                enableColumnResizing={false}
                enablePagination
                enableBottomToolbar
                enableTopToolbar


                muiTableContainerProps={{
                  sx: {
                    flex: 1,
                  },
                }}

                muiTablePaperProps={{
                  sx: {
                    backgroundColor: "#0b0b0b",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  },
                }}

                muiTableHeadCellProps={{
                  sx: {
                    backgroundColor: "#141414",
                    color: "#9ca3af",
                    fontSize: "14px",
                    fontWeight: 600,
                    borderBottom: "1px solid #262626",
                    borderTop: "1px solid #262626",
                    borderRight: "1px solid #262626",
                  },
                }}

                muiSearchTextFieldProps={{
                  placeholder: "Search employee…",
                  size: "small",
                  autoFocus: false,
                  sx: {
                    width: "250px",
                    "& input": {
                      fontSize: "12px",
                      padding: "6px 8px",
                    },
                  },
                }}

                muiTableBodyCellProps={{
                  sx: {
                    fontSize: "14px",
                    padding: "8px 10px",
                    borderBottom: "1px solid #262626",
                    borderRight: "1px solid #262626",
                  },
                }}

                muiTopToolbarProps={{
                  sx: {
                    minHeight: "52px",
                    "& .MuiToolbar-root": {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    },

                    "& .MuiTextField-root": {
                      width: "250px",
                      minWidth: "250px",
                      maxWidth: "250px",
                    },
                    "& *": {
                      transition: "none !important",
                    },
                  },
                }}

                renderTopToolbarCustomActions={({ table }) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => table.exportData("csv")}
                      className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm"
                    >
                      Export CSV
                    </button>

                    <button
                      onClick={() => table.exportData("xlsx")}
                      className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm"
                    >
                      Export Excel
                    </button>

                    <button
                      onClick={() => table.exportData("pdf")}
                      className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm"
                    >
                      Export PDF
                    </button>
                  </div>
                )}
              />
            </ThemeProvider>
          )}
        </div>
      </div>
      <SettingsDialog />
    </>
  );
}
