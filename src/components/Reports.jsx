import { useState } from "react";

/* MOCK DATA (same as before) */
const MOCK_REPORT_DATA = [
  // Rahul Sharma
  { employee: "Rahul Sharma", date: "2026-01-01", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-02", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-03", status: "Half Day" },
  { employee: "Rahul Sharma", date: "2026-01-04", status: "Absent" },
  { employee: "Rahul Sharma", date: "2026-01-05", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-06", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-07", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-08", status: "Half Day" },
  { employee: "Rahul Sharma", date: "2026-01-09", status: "Present" },
  { employee: "Rahul Sharma", date: "2026-01-10", status: "Absent" },

  // Ankit Verma
  { employee: "Ankit Verma", date: "2026-01-01", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-02", status: "Absent" },
  { employee: "Ankit Verma", date: "2026-01-03", status: "Half Day" },
  { employee: "Ankit Verma", date: "2026-01-04", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-05", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-06", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-07", status: "Absent" },
  { employee: "Ankit Verma", date: "2026-01-08", status: "Present" },
  { employee: "Ankit Verma", date: "2026-01-09", status: "Half Day" },
  { employee: "Ankit Verma", date: "2026-01-10", status: "Present" },

  // Suresh Kumar
  { employee: "Suresh Kumar", date: "2026-01-01", status: "Absent" },
  { employee: "Suresh Kumar", date: "2026-01-02", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-03", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-04", status: "Half Day" },
  { employee: "Suresh Kumar", date: "2026-01-05", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-06", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-07", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-08", status: "Absent" },
  { employee: "Suresh Kumar", date: "2026-01-09", status: "Present" },
  { employee: "Suresh Kumar", date: "2026-01-10", status: "Half Day" },

  // Priya Singh
  { employee: "Priya Singh", date: "2026-01-01", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-02", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-03", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-04", status: "Absent" },
  { employee: "Priya Singh", date: "2026-01-05", status: "Half Day" },
  { employee: "Priya Singh", date: "2026-01-06", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-07", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-08", status: "Present" },
  { employee: "Priya Singh", date: "2026-01-09", status: "Absent" },
  { employee: "Priya Singh", date: "2026-01-10", status: "Present" },

  // Amit Patel (late joiner / irregular)
  { employee: "Amit Patel", date: "2026-01-03", status: "Present" },
  { employee: "Amit Patel", date: "2026-01-04", status: "Absent" },
  { employee: "Amit Patel", date: "2026-01-05", status: "Half Day" },
  { employee: "Amit Patel", date: "2026-01-06", status: "Present" },
  { employee: "Amit Patel", date: "2026-01-07", status: "Present" },
  { employee: "Amit Patel", date: "2026-01-08", status: "Absent" },
];


export default function Reports() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState([]);

  const generateReport = () => {
    let filtered = MOCK_REPORT_DATA;

    // date filter
    if (fromDate) filtered = filtered.filter(r => r.date >= fromDate);
    if (toDate) filtered = filtered.filter(r => r.date <= toDate);

    // aggregate employee-wise
    const summaryMap = {};

    for (const r of filtered) {
      if (!summaryMap[r.employee]) {
        summaryMap[r.employee] = {
          employee: r.employee,
          present: 0,
          halfDay: 0,
          absent: 0,
          totalPresent: 0,
        };
      }

      if (r.status === "Present") {
        summaryMap[r.employee].present += 1;
        summaryMap[r.employee].totalPresent += 1;
      }

      if (r.status === "Half Day") {
        summaryMap[r.employee].halfDay += 1;
        summaryMap[r.employee].totalPresent += 0.5;
      }

      if (r.status === "Absent") {
        summaryMap[r.employee].absent += 1;
      }

    }

    setRows(Object.values(summaryMap));
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">

      {/* Filters */}
      <div className="bg-nero-800 border border-nero-700 rounded-lg p-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <div className="text-xs text-nero-500 mb-1">From</div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-nero-900 border border-nero-700 px-2 py-1 rounded text-sm"
            />
          </div>

          <div>
            <div className="text-xs text-nero-500 mb-1">To</div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-nero-900 border border-nero-700 px-2 py-1 rounded text-sm"
            />
          </div>

          <button
            onClick={generateReport}
            className="ml-auto px-4 py-1.5 rounded bg-nero-700 hover:bg-nero-600 text-sm"
          >
            Generate Report
          </button>
        </div>
      </div>

      {/* Summary Table */}
      <div className="flex-1 bg-nero-900 border border-nero-700 rounded-lg overflow-auto minimal-scrollbar">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-nero-500">
            No data to display
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-nero-800">
              <tr>
                <th className="p-2 text-left">Employee</th>
                <th className="p-2 text-center text-green-400">Present</th>
                <th className="p-2 text-center text-yellow-400">Half Day</th>
                <th className="p-2 text-center text-red-400">Absent</th>
                <th className="p-2 text-center text-nero-300">Total Present</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-nero-700">
                  <td className="p-2">{r.employee}</td>
                  <td className="p-2 text-center">{r.present}</td>
                  <td className="p-2 text-center">{r.halfDay}</td>
                  <td className="p-2 text-center">{r.absent}</td>
                  <td className="p-2 text-center font-medium">{r.totalPresent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
