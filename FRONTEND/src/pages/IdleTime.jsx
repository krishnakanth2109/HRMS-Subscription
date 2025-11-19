import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import jsPDF from "jspdf";

import { getAllIdleTimeRecords } from "../api";

// ---------------------------------------------
// Helper: format Date -> "YYYY-MM-DD"
// ---------------------------------------------
const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

// ---------------------------------------------
// Convert ISO → HH:MM safely
// ---------------------------------------------
const toHHMM = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toTimeString().slice(0, 5);
};

const IdleTime = () => {
  const [employees, setEmployees] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("today");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showCalendarFor, setShowCalendarFor] = useState(null);

  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));

  // ======================================================
  // FETCH → CLEAN → TRANSFORM backend idle time records
  // ======================================================
  useEffect(() => {
    loadIdleRecords();
  }, []);

  const loadIdleRecords = async () => {
    try {
      const data = await getAllIdleTimeRecords(); // from backend
      console.log("🔥 Raw Backend Idle Data:", data);

      const map = {};

      data.forEach((rec) => {
        const id = rec.employeeId;

        if (!map[id]) {
          map[id] = {
            id,
            name: rec.name,
            date: rec.date,
            totalWork: 0,
            totalIdle: 0,
            timeline: [],
          };
        }

        rec.idleTimeline.forEach((r) => {
          // Skip invalid ones
          if (
            !r.idleStart ||
            !r.idleEnd ||
            r.idleStart === "" ||
            r.idleEnd === "" ||
            isNaN(new Date(r.idleStart).getTime()) ||
            isNaN(new Date(r.idleEnd).getTime())
          ) {
            return;
          }

          const startTime = toHHMM(r.idleStart);
          const endTime = toHHMM(r.idleEnd);

          if (!startTime || !endTime) return;

          map[id].totalIdle += (r.idleDurationSeconds || 0) / 3600;

          map[id].timeline.push({ time: startTime, status: 0 });
          map[id].timeline.push({ time: endTime, status: 1 });
        });

        // Sort timeline chronologically
        map[id].timeline.sort((a, b) => (a.time > b.time ? 1 : -1));
      });

      const finalArr = Object.values(map).map((e) => ({
        ...e,
        totalIdle: isNaN(e.totalIdle) ? "0.0" : e.totalIdle.toFixed(1),
        totalWork: (8 - e.totalIdle).toFixed(1),
      }));

      console.log("✨ Cleaned Final Employees:", finalArr);

      setEmployees(finalArr);
    } catch (error) {
      console.error("❌ Idle fetch error", error);
    }
  };

  // -------------------------------------------------
  // Filtering
  // -------------------------------------------------
  const filteredByDate = employees.filter((emp) => {
    const empDate = emp.date;

    if (fromDate || toDate) {
      const from = fromDate ? formatDate(fromDate) : null;
      const to = toDate ? formatDate(toDate) : null;

      if (from && !to) return empDate >= from;
      if (!from && to) return empDate <= to;
      if (from && to) return empDate >= from && empDate <= to;
      return true;
    }

    if (filterDate === "today") return empDate === today;
    if (filterDate === "yesterday") return empDate === yesterday;

    return true;
  });

  const finalEmployees = filteredByDate.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  );

  // -------------------------------------------------
  // Export CSV
  // -------------------------------------------------
  const exportCSV = (emp) => {
    const csv = Papa.unparse(emp.timeline);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${emp.name}-idle-report.csv`);
  };

  // -------------------------------------------------
  // Export PDF
  // -------------------------------------------------
  const exportPDF = (emp) => {
    const doc = new jsPDF();
    doc.text(`Idle Report - ${emp.name}`, 10, 10);
    doc.text(`Date: ${emp.date}`, 10, 18);

    emp.timeline.forEach((item, idx) => {
      doc.text(
        `${item.time} - ${item.status === 1 ? "Work" : "Idle"}`,
        10,
        30 + idx * 8
      );
    });

    doc.save(`${emp.name}-idle-report.pdf`);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold mb-2">Employee Idle Time Dashboard</h1>
      <p className="text-gray-500 mb-6">
        Track daily idle patterns, real intervals, and export reports.
      </p>

      {/* ===================== SEARCH + FILTER ===================== */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex flex-col">
          <label className="text-sm mb-1 font-medium">Search Employee</label>
          <input
            type="text"
            placeholder="Type name..."
            className="px-4 py-2 rounded-lg border w-64 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Quick Filter */}
        <div className="flex flex-col">
          <label className="text-sm mb-1 font-medium">Quick Filter</label>
          <select
            className="px-4 py-2 rounded-lg border shadow-sm"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="all">All Days</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="text-sm font-medium">From</label>
          <DatePicker
            selected={fromDate}
            onChange={(d) => setFromDate(d)}
            className="border px-3 py-2 rounded-lg shadow-sm ml-2"
            dateFormat="yyyy-MM-dd"
          />
        </div>
        <div>
          <label className="text-sm font-medium">To</label>
          <DatePicker
            selected={toDate}
            onChange={(d) => setToDate(d)}
            className="border px-3 py-2 rounded-lg shadow-sm ml-2"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <button
          onClick={() => {
            setFromDate(null);
            setToDate(null);
            setFilterDate("today");
          }}
          className="ml-auto px-4 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Reset
        </button>
      </div>

      {/* ===================== EMPLOYEE LIST ===================== */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Idle Time Summary</h2>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-3">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Working (hrs)</th>
              <th className="p-3">Idle (hrs)</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {finalEmployees.map((emp) => (
              <React.Fragment key={emp.id}>
                <tr className="border-b hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold">{emp.name}</td>
                  <td className="p-3">{emp.date}</td>
                  <td className="p-3">{emp.totalWork}</td>
                  <td className="p-3 text-red-600">{emp.totalIdle}</td>

                  <td className="p-3 text-center">
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button
                        onClick={() =>
                          setExpanded(expanded === emp.id ? null : emp.id)
                        }
                        className="text-blue-600 flex items-center gap-1"
                      >
                        {expanded === emp.id ? "Hide" : "Show More"}
                        {expanded === emp.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>

                      <button
                        onClick={() => exportCSV(emp)}
                        className="text-green-600 flex items-center gap-1"
                      >
                        <Download size={14} /> CSV
                      </button>

                      <button
                        onClick={() => exportPDF(emp)}
                        className="text-pink-600 flex items-center gap-1"
                      >
                        <Download size={14} /> PDF
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Timeline Graph */}
                {expanded === emp.id && (
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="p-4">
                      <h3 className="text-lg font-semibold mb-2">
                        Idle Timeline — {emp.name}
                      </h3>

                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={emp.timeline}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis
                              domain={[0, 1]}
                              tickFormatter={(v) => (v === 1 ? "Work" : "Idle")}
                            />
                            <Tooltip
                              formatter={(v) => (v === 1 ? "Working" : "Idle")}
                            />
                            <Area
                              type="stepAfter"
                              dataKey="status"
                              stroke="#000"
                              fill="#ef4444"
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IdleTime;
