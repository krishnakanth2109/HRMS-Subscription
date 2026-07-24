import React, { useContext, useMemo, useState } from "react";
import { CurrentEmployeeAttendanceContext } from "../EmployeeContext/CurrentEmployeeAttendanceContext";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ==================================================================================
// Helper Functions
// ==================================================================================
const getMonthOptions = (records) => {
  const months = records.map((rec) => rec.date.slice(0, 7));
  return Array.from(new Set(months)).sort();
};

const getMonthName = (monthStr) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

// Calendar Cell
const CalendarCell = ({ day, record }) => {
  let bg = "bg-gray-100";
  let text = "text-gray-700";

  const colorMap = {
    Present: ["bg-green-100", "text-green-700"],
    Absent: ["bg-red-100", "text-red-700"],
    Leave: ["bg-yellow-100", "text-yellow-700"],
    Halfday: ["bg-orange-100", "text-orange-700"],
    Completed: ["bg-blue-100", "text-blue-700"],
  };

  if (record?.status && colorMap[record.status]) {
    bg = colorMap[record.status][0];
    text = colorMap[record.status][1];
  }

  return (
    <td className={`h-28 w-40 align-top ${bg} ${text} border rounded-lg`}>
      <div className="font-bold">{day}</div>
      {record && (
        <div className="text-xs">
          {record.status}
          <br />
          {record.punchIn && <>In: {record.punchIn}<br /></>}
          {record.punchOut && <>Out: {record.punchOut}<br /></>}
        </div>
      )}
    </td>
  );
};

// ==================================================================================
// Main Component
// ==================================================================================
const CurrentEmployeeAttendanceProfile = () => {
  const {
    attendanceRecords,
    PermissionRequests,
    overtimeRequests,
  } = useContext(CurrentEmployeeAttendanceContext);

  // ==================================================================================
  // Ensure attendance data is loaded
  // ==================================================================================
  const employeeId = attendanceRecords?.[0]?.employeeId || null;

  if (!employeeId) {
    return (
      <div className="p-6 text-gray-500 text-lg">
        Loading attendance data...
      </div>
    );
  }

  // ==================================================================================
  // Prepare Attendance Data
  // ==================================================================================
  const monthOptions = getMonthOptions(attendanceRecords);

  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions[monthOptions.length - 1] || ""
  );

  const monthlyRecords = useMemo(() => {
    return attendanceRecords.filter((rec) =>
      rec.date.startsWith(selectedMonth)
    );
  }, [attendanceRecords, selectedMonth]);

  // ==================================================================================
  // Summary Counts
  // ==================================================================================
  const presentCount = monthlyRecords.filter((r) => r.status === "Present").length;
  const absentCount = monthlyRecords.filter((r) => r.status === "Absent").length;
  const leaveCount = monthlyRecords.filter((r) => r.status === "Leave").length;
  const halfdayCount = monthlyRecords.filter((r) => r.status === "Halfday").length;
  const completedCount = monthlyRecords.filter((r) => r.status === "Completed").length;

  const chartData = {
    labels: ["Present", "Absent", "Leave", "Half-Day", "Completed"],
    datasets: [
      {
        label: "Attendance Summary",
        data: [
          presentCount,
          absentCount,
          leaveCount,
          halfdayCount,
          completedCount,
        ],
        backgroundColor: [
          "#22c55e",
          "#ef4444",
          "#facc15",
          "#fb923c",
          "#3b82f6",
        ],
      },
    ],
  };

  // ==================================================================================
  // Calendar Setup
  // ==================================================================================
  const [calendarView, setCalendarView] = useState(false);

  const daysInMonth = selectedMonth
    ? new Date(
      Number(selectedMonth.slice(0, 4)),
      Number(selectedMonth.slice(5, 7)),
      0
    ).getDate()
    : 0;

  const firstDayOfWeek = selectedMonth
    ? new Date(
      Number(selectedMonth.slice(0, 4)),
      Number(selectedMonth.slice(5, 7)) - 1,
      1
    ).getDay()
    : 0;

  const calendarRows = [];
  let day = 1 - firstDayOfWeek;

  while (day <= daysInMonth) {
    const row = [];

    for (let i = 0; i < 7; i++) {
      if (day > 0 && day <= daysInMonth) {
        const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
        const record = monthlyRecords.find((rec) => rec.date === dateStr);

        row.push(<CalendarCell key={i} day={day} record={record} />);
      } else {
        row.push(<td key={i} className="h-20 w-32 bg-white"></td>);
      }

      day++;
    }

    calendarRows.push(<tr key={day}>{row}</tr>);
  }

  // ==================================================================================
  // Render Component
  // ==================================================================================
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Attendance Profile (Employee {employeeId})
      </h1>

      {/* Month Selector */}
      <div className="mb-4 flex gap-4 items-center">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border px-4 py-2 rounded"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {getMonthName(m)}
            </option>
          ))}
        </select>

        <button
          onClick={() => setCalendarView((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {calendarView ? "Table View" : "Calendar View"}
        </button>
      </div>

      {/* Bar Chart */}
      <div className="max-w-lg mb-6">
        <Bar data={chartData} />
      </div>

      {/* Summary Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded text-center">
          Present<br /><span className="text-2xl font-bold">{presentCount}</span>
        </div>
        <div className="bg-red-50 p-4 rounded text-center">
          Absent<br /><span className="text-2xl font-bold">{absentCount}</span>
        </div>
        <div className="bg-yellow-50 p-4 rounded text-center">
          Leave<br /><span className="text-2xl font-bold">{leaveCount}</span>
        </div>
        <div className="bg-orange-50 p-4 rounded text-center">
          Half-Day<br /><span className="text-2xl font-bold">{halfdayCount}</span>
        </div>
        <div className="bg-blue-50 p-4 rounded text-center">
          Completed<br /><span className="text-2xl font-bold">{completedCount}</span>
        </div>
      </div>

      {/* Calendar or Table View */}
      {calendarView ? (
        <div className="overflow-x-auto mb-10">
          <table className="bg-white rounded shadow">
            <thead>
              <tr>
                <th className="p-4">Sun</th>
                <th className="p-4">Mon</th>
                <th className="p-4">Tue</th>
                <th className="p-4">Wed</th>
                <th className="p-4">Thu</th>
                <th className="p-4">Fri</th>
                <th className="p-4">Sat</th>
              </tr>
            </thead>
            <tbody>{calendarRows}</tbody>
          </table>
        </div>
      ) : (
        <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mb-10">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Punch In</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Punch Out</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Half-Day</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">Late Login</th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide">OT</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {monthlyRecords.length > 0 ? (
              monthlyRecords.map((rec) => (
                <tr
                  key={rec.id}
                  className="odd:bg-white even:bg-gray-50 hover:bg-blue-50/40 transition cursor-pointer"
                >
                  <td className="px-6 py-3 text-sm">{rec.date}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-700">{rec.status}</td>
                  <td className="px-6 py-3 text-sm">{rec.punchIn || "-"}</td>
                  <td className="px-6 py-3 text-sm">{rec.punchOut || "-"}</td>
                  <td className="px-6 py-3 text-sm">
                    {rec.isHalfDay ? (
                      <span className="text-yellow-600 font-semibold">Yes</span>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {rec.isLateLogin ? (
                      <span className="text-red-600 font-semibold">Yes</span>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {rec.isOtDay ? (
                      <span className="text-green-600 font-semibold">Yes</span>
                    ) : (
                      "No"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-6 text-gray-500 text-sm"
                >
                  No attendance found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

      )}
    </div>
  );
};

export default CurrentEmployeeAttendanceProfile;
