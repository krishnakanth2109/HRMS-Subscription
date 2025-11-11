import React, { useState, useEffect } from "react";
import axios from "axios";

const AdminAttendance = () => {
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [attendanceData, setAttendanceData] = useState([]);

  const fetchAttendance = async (date) => {
    const res = await axios.get(
      `http://localhost:5000/api/admin/attendance/by-date/${date}`
    );
    setAttendanceData(res.data);
  };

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate]);

  const workingCount = attendanceData.filter(
    (item) => item.punchIn && !item.punchOut
  ).length;

  const completedCount = attendanceData.filter(
    (item) => item.punchIn && item.punchOut
  ).length;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          Admin Attendance
        </h2>

        {/* Styled Date Filter */}
        <div className="mt-4 md:mt-0 flex items-center bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
          <span className="px-3 py-2 bg-slate-100 border-r text-slate-500 text-sm font-medium">
            Filter Date
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 outline-none text-slate-700 font-medium"
          />
        </div>
      </div>

      {/* Dynamic Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Card 1: Currently Working */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center justify-between transition-transform hover:scale-[1.02]">
          <div>
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
              Currently Working
            </p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">
              {workingCount}
            </h3>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Completed Shift */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between transition-transform hover:scale-[1.02]">
          <div>
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
              Shift Completed
            </p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">
              {completedCount}
            </h3>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
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
              {attendanceData.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-10 text-slate-500 text-lg"
                  >
                    No attendance records found for this date.
                  </td>
                </tr>
              ) : (
                attendanceData.map((item, idx) => {
                  const isCompleted = item.punchOut;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 transition-colors duration-200 group"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {item.employeeName}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        {item.employeeId}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.date}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">
                        {item.punchIn
                          ? new Date(item.punchIn).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-red-500 font-medium">
                        {item.punchOut
                          ? new Date(item.punchOut).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {item.displayTime || "0h 0m"}
                      </td>
                
                      <td
                        className={`px-6 py-4 text-center font-bold ${
                          item.loginStatus === "LATE"
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {item.loginStatus === "LATE" 
                           ? "LATE LOGIN" 
                           : item.loginStatus || "--"}
                      </td>
                     
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm
                            ${
                              isCompleted
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : "bg-green-100 text-green-700 border border-green-200 animate-pulse"
                            }
                          `}
                        >
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