import { useState, useMemo } from "react";
import { MaterialReactTable } from "material-react-table";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SettingsDialog from "./SettingsDialog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiFetch } from "../utils/api";

const MONTH_SHORT = {
  January: "Jan", February: "Feb", March: "Mar", April: "Apr", May: "May", June: "Jun", July: "Jul", August: "Aug", September: "Sep", October: "Oct", November: "Nov", December: "Dec",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

async function fetchMonthlyReport(month, year) {
  const monthIndex = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ].indexOf(month) + 1;

  const monthKey = `${year}-${String(monthIndex).padStart(2, "0")}`;

  // 1️⃣ fetch employees
  const empRes = await apiFetch("/api/employees");
  const employees = await empRes.json();

  const result = [];

  // 2️⃣ fetch attendance per employee
  for (const emp of employees) {
    const attRes = await apiFetch(
      `/api/attendance/${emp.employeeId}?month=${monthKey}`
    );
    const days = await attRes.json();

    let present = 0;
    let halfDay = 0;
    let absent = 0;

    for (const d of days) {
      if (d.status === "Present") present++;
      else if (d.status === "Half Day") halfDay++;
      else if (d.status === "Absent") absent++;
    }

    result.push({
      employeeName: emp.name,
      present,
      halfDay,
      absent,
      totalPresent: present + halfDay * 0.5,
    });
  }

  return result;
}


/* Component */
export default function Reports({ onGenerated }) {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("2026");

  const generateReport = async () => {
    try {
      if (!month || !year) return;

      const data = await fetchMonthlyReport(month, year);
      setRows(data);

      onGenerated?.(month, year);
    } catch (err) {
      console.error("Monthly report failed", err);
    }
  };

  const exportExcel = () => {
    /* ===== TRANSFORM DATA (ORDER + HEADERS) ===== */
    const data = tableData.map(r => ({
      "Employee ID": r.employeeId,
      "Employee Name": r.employeeName,
      "Present Days": r.present,
      "Half Days": r.halfDay,
      "Absent Days": r.absent,
      "Total Present Days": r.totalPresent,
      "Attendance Percentage": Number(r.attendancePct) / 100, // real %
    }));

    const ws = XLSX.utils.json_to_sheet(data, {
      origin: "A2",
      skipHeader: true,
    });

    /* ===== HEADER ROW ===== */
    const headers = Object.keys(data[0]);
    headers.forEach((h, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i });
      ws[cell] = {
        v: h,
        t: "s",
        s: {
          font: { bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        },
      };
    });

    /* ===== HEADER ROW HEIGHT (PROFESSIONAL) ===== */
    ws["!rows"] = [{ hpt: 20 }];

    ws["!autofilter"] = {
      ref: ws["!ref"],
    };

    /* ===== COLUMN WIDTHS (PROFESSIONAL) ===== */
    ws["!cols"] = [
      { wch: 14 }, // Employee ID
      { wch: 22 }, // Name
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
    ];

    /* ===== ALIGNMENT & BORDERS ===== */
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;

        cell.s = {
          alignment: {
            horizontal: C === 1 ? "left" : "center",
            vertical: "center",
          },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };

        /* Attendance % column formatting */
        if (C === 6) {
          cell.z = "0.0%";
        }
      }
    }

    /* ===== FREEZE HEADER ROW ===== */
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    /* ===== WORKBOOK ===== */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Attendance");

    const m = MONTH_SHORT[month] || month;
    XLSX.writeFile(wb, `Monthly Attendance Report ${m}-${year}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const m = MONTH_SHORT[month] || month;

    /* ===== COLORS (STRICT B/W) ===== */
    const COLORS = {
      text: "#000000",
      muted: "#4b5563",
      border: "#000000",
      headerBg: "#f2f2f2",
      rowAlt: "#fafafa",
    };

    /* ===== HEADER (COMPACT, NO WASTE) ===== */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLORS.text);
    doc.text("Monthly Attendance Report", 36, 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.muted);
    doc.text(`Period: ${m} ${year}`, pageWidth - 36, 28, { align: "right" });

    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.8);
    doc.line(36, 36, pageWidth - 36, 36);

    /* ===== TABLE (FULL WIDTH) ===== */
    autoTable(doc, {
      startY: 44,
      margin: { left: 20, right: 20 }, // near full-page width

      head: [[
        "Employee ID",
        "Employee Name",
        "Present Days",
        "Half Days",
        "Absent Days",
        "Total Present Days",
        "Attendance Percentage",
      ]],

      body: tableData.map(r => [
        r.employeeId,
        r.employeeName,
        r.present,
        r.halfDay,
        r.absent,
        r.totalPresent,
        `${r.attendancePct}%`,
      ]),

      styles: {
        font: "helvetica",
        fontSize: 9,
        textColor: COLORS.text,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        lineColor: COLORS.border,
        lineWidth: 0.6,
        valign: "middle",
      },

      headStyles: {
        fillColor: COLORS.headerBg,
        textColor: COLORS.text,
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.8,
      },

      bodyStyles: {
        fillColor: "#ffffff",
      },

      alternateRowStyles: {
        fillColor: COLORS.rowAlt,
      },

      columnStyles: {
        0: { halign: "center", cellWidth: 70 },  // Employee ID
        1: { halign: "left", cellWidth: 160 }, // Name
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center", fontStyle: "bold" },
      },
    });

    /* ===== FOOTER (PROFESSIONAL, QUIET) ===== */
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted);

    /* ===== FOOTER (DATE + TIME, DD/MM/YYYY) ===== */
    const now = new Date();

    // 12-hour time conversion
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert 0 -> 12

    // format: DD/MM/YYYY hh:mm AM/PM
    const formattedDateTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")
      }/${now.getFullYear()} ${hours}:${minutes} ${ampm}`;

    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted);

    doc.text(
      "Generated by Attendance Management System",
      20,
      pageHeight - 22
    );

    doc.text(
      `Generated on: ${formattedDateTime}`,
      pageWidth - 20,
      pageHeight - 22,
      { align: "right" }
    );


    doc.save(`Monthly Attendance Report ${m}-${year}.pdf`);
  };



  function getAttendanceBadge(pct) {
    const v = Number(pct);

    if (v < 30) {
      return "bg-red-500/15 text-red-400";
    }

    if (v < 75) {
      return "bg-amber-500/15 text-amber-400";
    }

    return "bg-emerald-500/15 text-emerald-400";
  }


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
        Cell: ({ cell }) => {
          const pct = cell.getValue();
          const cls = getAttendanceBadge(pct);

          return (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}
            >
              {pct}%
            </span>
          );
        },
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
              className="appearance-none bg-nero-900 border border-nero-700 border-r-0 px-2 py-1 text-sm rounded-l-md"
            >
              <option value="" disabled>Select month</option>
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="appearance-none bg-nero-900 border border-nero-700 border-l-2 px-2 py-1 text-sm rounded-r-md"
            >
              <option value="" disabled>Select year</option>
              {["2024", "2025","2026", "2027", "2028", "2029", "2030"].map(y => (
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
                  className: "minimal-scrollbar",
                  sx: {
                    flex: 1,
                    overflow: "auto",
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
                    <button onClick={exportExcel} className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm">Export Excel</button>
                    <button onClick={exportPDF} className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm">Export PDF</button>
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
