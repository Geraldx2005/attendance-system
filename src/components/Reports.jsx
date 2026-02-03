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
  January: "Jan", February: "Feb", March: "Mar", April: "Apr", May: "May", June: "Jun",
  July: "Jul", August: "Aug", September: "Sep", October: "Oct", November: "Nov", December: "Dec",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Dark MUI Theme
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

// Fetch Monthly Report
async function fetchMonthlyReport(month, year) {
  const monthIndex = MONTHS.indexOf(month) + 1;
  const monthKey = `${year}-${String(monthIndex).padStart(2, "0")}`;

  // fetch employees
  const empRes = await apiFetch("/api/employees");
  const employees = await empRes.json();

  const result = [];

  // fetch attendance per employee
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

// Component
export default function Reports({ onGenerated }) {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("2026");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState(""); // "excel" or "pdf"
  const [error, setError] = useState(null);

  const generateReport = async () => {
    try {
      if (!month || !year) {
        setError("Please select both month and year");
        return;
      }

      setError(null);
      setIsGenerating(true);

      const data = await fetchMonthlyReport(month, year);
      setRows(data);

      onGenerated?.(month, year);
    } catch (err) {
      console.error("Monthly report failed", err);
      setError("Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const exportExcel = async () => {
    try {
      setIsExporting(true);
      setExportType("excel");

      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      // TRANSFORM DATA (ORDER + HEADERS)
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

      // HEADER ROW 
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

      // HEADER ROW HEIGHT (PROFESSIONAL)
      ws["!rows"] = [{ hpt: 20 }];

      ws["!autofilter"] = {
        ref: ws["!ref"],
      };

      // COLUMN WIDTHS (PROFESSIONAL)
      ws["!cols"] = [
        { wch: 14 }, // Employee ID
        { wch: 22 }, // Name
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
      ];

      // ALIGNMENT & BORDERS
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

          // Attendance % column formatting
          if (C === 6) {
            cell.z = "0.0%";
          }
        }
      }

      // FREEZE HEADER ROW
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };

      // WORKBOOK
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Attendance");

      const m = MONTH_SHORT[month] || month;
      XLSX.writeFile(wb, `Monthly Attendance Report ${m}-${year}.xlsx`);

      setError(null);
    } catch (err) {
      console.error("Excel export failed", err);
      setError("Failed to export Excel file. Please try again.");
    } finally {
      setIsExporting(false);
      setExportType("");
    }
  };

  const exportPDF = async () => {
    try {
      setIsExporting(true);
      setExportType("pdf");

      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const m = MONTH_SHORT[month] || month;

      // COLORS (STRICT B/W)
      const COLORS = {
        text: "#000000",
        muted: "#4b5563",
        border: "#000000",
        headerBg: "#f2f2f2",
        rowAlt: "#fafafa",
      };

      // HEADER (COMPACT, NO WASTE)
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

      // TABLE (FULL WIDTH)
      autoTable(doc, {
        startY: 44,
        margin: { left: 20, right: 20 },

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

        theme: "grid",

        headStyles: {
          fillColor: COLORS.headerBg,
          textColor: COLORS.text,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
          valign: "middle",
          lineColor: COLORS.border,
          lineWidth: 0.5,
          cellPadding: 4,
        },

        styles: {
          fontSize: 8,
          textColor: COLORS.text,
          lineColor: COLORS.border,
          lineWidth: 0.3,
          cellPadding: 3.5,
        },

        columnStyles: {
          0: { halign: "center", cellWidth: 60 },
          1: { halign: "left", cellWidth: 135 },
          2: { halign: "center", cellWidth: 50 },
          3: { halign: "center", cellWidth: 50 },
          4: { halign: "center", cellWidth: 50 },
          5: { halign: "center", cellWidth: 70 },
          6: { halign: "center", cellWidth: 80 },
        },

        alternateRowStyles: {
          fillColor: COLORS.rowAlt,
        },

        didDrawPage: (data) => {
          const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
          const totalPages = doc.internal.getNumberOfPages();

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(COLORS.muted);

          doc.text(
            `Page ${pageNum} of ${totalPages}`,
            20,
            pageHeight - 22
          );
        },
      });

      // FOOTER (TIMESTAMP)
      const now = new Date();
      const formattedDateTime = now.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLORS.muted);

      doc.text(
        `Generated on: ${formattedDateTime}`,
        pageWidth - 20,
        pageHeight - 22,
        { align: "right" }
      );

      doc.save(`Monthly Attendance Report ${m}-${year}.pdf`);

      setError(null);
    } catch (err) {
      console.error("PDF export failed", err);
      setError("Failed to export PDF file. Please try again.");
    } finally {
      setIsExporting(false);
      setExportType("");
    }
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

  // Table Data
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

  // Columns
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
              disabled={isGenerating}
              className="appearance-none bg-nero-900 border border-nero-700 border-r-0 px-2 py-1 text-sm rounded-l-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select month</option>
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={isGenerating}
              className="appearance-none bg-nero-900 border border-nero-700 border-l-2 px-2 py-1 text-sm rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select year</option>
              {["2024", "2025", "2026", "2027", "2028", "2029", "2030"].map(y => (
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
            disabled={isGenerating || !month || !year}
            className="ml-auto px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-600 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 text-sm text-red-400 flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium">Error</div>
              <div className="text-red-400/80">{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 border border-nero-700 rounded-md overflow-hidden bg-[#0b0b0b] flex flex-col">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-nero-400 gap-4">
              <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="text-lg font-medium text-nero-300">Generating Report...</div>
              <div className="text-sm text-nero-500">Please wait while we fetch the attendance data</div>
            </div>
          ) : rows.length === 0 ? (
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
                    <button
                      onClick={exportExcel}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isExporting && exportType === "excel" ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Exporting...
                        </>
                      ) : (
                        "Export Excel"
                      )}
                    </button>
                    <button
                      onClick={exportPDF}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-md bg-nero-700 hover:bg-nero-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isExporting && exportType === "pdf" ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Exporting...
                        </>
                      ) : (
                        "Export PDF"
                      )}
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