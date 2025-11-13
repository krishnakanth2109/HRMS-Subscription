// --- START OF FILE AdminAttendance.jsx ---

import React, { useState, useEffect } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
// ✅ Step 1: Import the new centralized API function
import { getAttendanceByDateRange } from "../api";

const AdminAttendance = () => {
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state for better UX

  // ✅ Step 2: Refactor the fetchAttendance function to use the API service
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const data = await getAttendanceByDateRange(startDate, endDate);
        setAttendanceData(data);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        setAttendanceData([]); // Clear data on error
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [startDate, endDate]);

  const workingCount = attendanceData.filter(
    (item) => item.punchIn && !item.punchOut
  ).length;

  const completedCount = attendanceData.filter(
    (item) => item.punchIn && item.punchOut
  ).length;

  const exportToExcel = () => {
    // ... (This function is correct and does not need changes)
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          All Employees Attendance
        </h2>
        <div className="flex flex-col md:flex-row items-center gap-4 mt-4 md:mt-0">
          <div className="flex items-center bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
            <span className="px-3 py-2 bg-slate-100 border-r text-slate-500 text-sm font-medium">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 outline-none text-slate-700 font-medium" />
          </div>
          <div className="flex items-center bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
            <span className="px-3 py-2 bg-slate-100 border-r text-slate-500 text-sm font-medium">To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 outline-none text-slate-700 font-medium" />
          </div>
          <button onClick={exportToExcel} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
            Export to Excel
          </button>
        </div>
      </div>

      {/* Dynamic Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center justify-between transition-transform hover:scale-[1.02]">
          <div>
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Currently Working</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{workingCount}</h3>
          </div>
          <div className="p-3 bg-green-100 rounded-full">{/* ... (SVG icon) ... */}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between transition-transform hover:scale-[1.02]">
          <div>
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Shift Completed</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{completedCount}</h3>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">{/* ... (SVG icon) ... */}</div>
        </div>
      </div>

      {/* Dynamic Attendance Table */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-100 uppercase font-medium tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee Name</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Punch In</th>
                <th className="px-6 py-4">Punch Out</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4 text-center">Login Status</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-10 text-slate-500">Loading data...</td></tr>
              ) : attendanceData.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-10 text-slate-500 text-lg">No attendance records found for this date range.</td></tr>
              ) : (
                attendanceData.map((item, idx) => {
                  const isCompleted = item.punchOut;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors duration-200 group">
                      <td className="px-6 py-4 font-semibold text-slate-700">{item.employeeName}</td>
                      <td className="px-6 py-4 text-slate-500 font-mono">{item.employeeId}</td>
                      <td className="px-6 py-4 text-slate-600">{item.date}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4 text-red-500 font-medium">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4 text-slate-700 font-medium">{item.displayTime || "0h 0m"}</td>
                      <td className={`px-6 py-4 text-center font-bold ${item.loginStatus === "LATE" ? "text-red-500" : "text-green-500"}`}>
                        {item.loginStatus === "LATE" ? "LATE LOGIN" : item.loginStatus || "--"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${isCompleted ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-green-100 text-green-700 border border-green-200 animate-pulse"}`}>
                          {isCompleted ? "Completed" : "Working"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAttendance;