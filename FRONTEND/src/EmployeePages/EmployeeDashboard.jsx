// --- START OF FILE EmployeeDashboard.jsx ---

import React, { useContext, useState, useEffect, useCallback } from "react";
import { AuthContext } from "../context/AuthContext"; // ✅ Step 1: Import AuthContext
import { NoticeContext } from "../context/NoticeContext";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  FaRegClock,
  FaUserCircle,
  FaBell,
  FaCalendarAlt,
  FaChartPie,
} from "react-icons/fa";
// ✅ Step 2: Import only the necessary API functions
import { getAttendanceForEmployee, punchIn, punchOut } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const EmployeeDashboard = () => {
  // ✅ Step 3: Use AuthContext as the single source of truth for the user
  const { user } = useContext(AuthContext);
  const { notices } = useContext(NoticeContext);
  
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  // ✅ Step 4: Refactor data fetching to rely on the user from AuthContext
  const loadAttendance = useCallback(async (empId) => {
    try {
      const data = await getAttendanceForEmployee(empId);
      const attendanceData = Array.isArray(data) ? data : [];
      setAttendance(attendanceData);
      const todayEntry = attendanceData.find((d) => d.date === today);
      setTodayLog(todayEntry || null);
    } catch (err) {
      console.error("Attendance fetch error:", err);
    }
  }, [today]);

  useEffect(() => {
    // This effect runs when the component mounts or when the user object changes.
    const bootstrap = async () => {
      // We only fetch data if the user object exists and has an employeeId
      if (user && user.employeeId) {
        setLoading(true);
        await loadAttendance(user.employeeId);
        setLoading(false);
      } else {
        // If there is no user, we stop loading.
        setLoading(false);
      }
    };
    bootstrap();
  }, [user, loadAttendance]);

  // ✅ Step 5: Refactor Punch In/Out to use the user from context
  const handlePunch = async (action) => {
    if (!user) return; // Guard clause
    try {
      if (action === "IN") {
        await punchIn({
          employeeId: user.employeeId,
          employeeName: user.name,
        });
      } else {
        await punchOut({
          employeeId: user.employeeId,
        });
      }
      // Refetch attendance to update the UI instantly
      await loadAttendance(user.employeeId);
    } catch (err) {
      console.error("Punch error:", err);
    }
  };

  // Render states
  if (loading) {
    return <div className="p-8 text-center text-lg font-semibold">Loading Employee Dashboard...</div>;
  }

  if (!user) {
    return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data. Please try logging in again.</div>;
  }

  // ✅ Step 6: Destructure directly from the user object
  const { name, email, phone, employeeId, currentDepartment, currentRole } = user;

  const leaveBarData = {
    labels: ["Full Day", "Half Day", "Absent"],
    datasets: [{
      label: "Attendance",
      data: [
        attendance.filter(a => a.status === 'Present' && !a.isHalfDay).length,
        attendance.filter(a => a.isHalfDay).length,
        attendance.filter(a => a.status === 'Absent').length,
      ],
      backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
      borderRadius: 6,
    }],
  };

  const workPieData = {
    labels: ["Worked Hours", "Remaining"],
    datasets: [{
      data: [todayLog?.workedHours || 0, Math.max(0, 8 - (todayLog?.workedHours || 0))],
      backgroundColor: ["#3b82f6", "#e5e7eb"],
    }],
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Profile Section */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6">
        <div className="flex-shrink-0">
          <img
            alt="Employee"
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
            className="w-28 h-28 rounded-full border-4 border-white shadow"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><FaUserCircle className="text-blue-400" /> {name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 mt-2">
            <div><b>ID:</b> {employeeId}</div>
      
            <div><b>Email:</b> {email}</div>
            <div><b>Phone:</b> {phone || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Attendance Section */}
<div className="bg-gradient-to-br from-gray-50 to-blue-100 rounded-2xl shadow-lg p-6 mb-8 transition-all duration-300 hover:shadow-2xl">
  <div className="flex items-center mb-6 gap-3 border-b border-gray-200 pb-4">
    <FaRegClock className="text-blue-600 text-2xl" />
    <h2 className="font-bold text-2xl text-gray-800">Daily Attendance</h2>
  </div>

  {/* TODAY ROW */}
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-blue-600 text-white uppercase tracking-wider">
          <th className="px-4 py-3 text-left">Date</th>
          <th className="px-4 py-3 text-left">Punch In</th>
          <th className="px-4 py-3 text-left">Punch Out</th>
          <th className="px-4 py-3 text-left">Worked</th>
          <th className="px-4 py-3 text-left">Login Status</th>
          <th className="px-4 py-3 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="bg-white">
        <tr className="text-gray-700 border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200">
          <td className="px-4 py-3 font-medium">{today}</td>
          <td className="px-4 py-3">
            {todayLog?.punchIn
              ? new Date(todayLog.punchIn).toLocaleTimeString()
              : "--"}
          </td>
          <td className="px-4 py-3">
            {todayLog?.punchOut
              ? new Date(todayLog.punchOut).toLocaleTimeString()
              : "--"}
          </td>
          <td className="px-4 py-3 font-mono">{todayLog?.displayTime || "0h 0m 0s"}</td>
          <td className="px-4 py-3">
            {todayLog?.punchIn ? (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                  todayLog.loginStatus === "LATE"
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-green-100 text-green-800 border border-green-200"
                }`}
              >
                {todayLog.loginStatus === "LATE" ? "Late" : "On Time"}
              </span>
            ) : (
              "--"
            )}
          </td>
          <td className="px-4 py-3 text-center">
            {!todayLog?.punchIn ? (
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-md font-semibold shadow-md hover:bg-green-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400"
                onClick={() => handlePunch("IN")}
              >
                Punch In
              </button>
            ) : !todayLog?.punchOut ? (
              <button
                className="bg-red-500 text-white px-4 py-2 rounded-md font-semibold shadow-md hover:bg-red-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400"
                onClick={() => handlePunch("OUT")}
              >
                Punch Out
              </button>
            ) : (
              <span className="text-gray-500 font-semibold">Done</span>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* FULL HISTORY */}
  <h3 className="mt-8 font-bold text-xl text-gray-800 border-t pt-6">Attendance History</h3>

  <div className="overflow-x-auto mt-4">
    <table className="min-w-full text-sm border border-gray-200 rounded-lg shadow-sm">
      <thead className="bg-gray-100">
        <tr className="text-gray-600 uppercase">
          <th className="border-b px-4 py-3">Date</th>
          <th className="border-b px-4 py-3">In</th>
          <th className="border-b px-4 py-3">Out</th>
          <th className="border-b px-4 py-3">Worked</th>
          <th className="border-b px-4 py-3">Status</th>
          <th className="border-b px-4 py-3">Login Status</th>
        </tr>
      </thead>
      <tbody className="bg-white">
        {attendance.map((a, i) => (
          <tr key={i} className="text-center text-gray-700 hover:bg-blue-50 transition-colors duration-200">
            <td className="border-b px-4 py-3">{a.date}</td>
            <td className="border-b px-4 py-3">
              {a.punchIn ? new Date(a.punchIn).toLocaleTimeString() : "--"}
            </td>
            <td className="border-b px-4 py-3">
              {a.punchOut ? new Date(a.punchOut).toLocaleTimeString() : "--"}
            </td>
            <td className="border-b px-4 py-3 font-mono">{a.displayTime}</td>
            <td className="border-b px-4 py-3">{a.status}</td>
            <td className="border-b px-4 py-3">
              {a.punchIn ? (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    a.loginStatus === "LATE"
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {a.loginStatus === "LATE" ? "Late" : "On Time"}
                </span>
              ) : (
                "--"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2"><FaCalendarAlt className="text-blue-500" /> Attendance Summary</h2>
          <Bar data={leaveBarData} />
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2"><FaChartPie className="text-yellow-500" /> Work Hours Today</h2>
          <Pie data={workPieData} />
        </div>
      </div>

      {/* Notice Board */}
      <div className="bg-white rounded-2xl shadow p-4 mb-8">
        <h2 className="font-bold flex items-center gap-2 mb-2"><FaBell className="text-red-500" /> Notice Board</h2>
        {notices?.length > 0 ? (
          <ul className="space-y-2">
            {notices.map((n, i) => (
              <li key={i} className="border-b pb-2">
                <b>{n.title}</b> - {n.description}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No Notices</p>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;