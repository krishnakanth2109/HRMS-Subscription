// src/pages/EmployeesOnLeaveToday.jsx
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AttendanceContext } from "../context/AttendanceContext";
import { EmployeeContext } from "../context/EmployeeContext";

const EmployeesOnLeaveToday = () => {
  const { attendanceRecords } = useContext(AttendanceContext);
  const { employees } = useContext(EmployeeContext);
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const onLeaveToday = attendanceRecords
    .filter((record) => record.date === today && record.status === "Leave")
    .map((record) => {
      const emp = employees.find((e) => e.employeeId === record.employeeId);
      return {
        id: record.employeeId,
        name: emp?.name || "Unknown",
        department: emp?.department || "N/A",
        isActive: emp?.isActive !== false,
      };
    })
    .filter((emp) => emp.isActive); // Only include active employees

  // Department color mapping for badges
  const departmentColors = {
    HR: "bg-pink-100 text-pink-700",
    Engineering: "bg-blue-100 text-blue-700",
    Sales: "bg-green-100 text-green-700",
    Marketing: "bg-yellow-100 text-yellow-700",
    Finance: "bg-purple-100 text-purple-700",
    'N/A': "bg-gray-100 text-gray-700",
  };

  // Department icon mapping
  const departmentIcons = {
    HR: "👥",
    Engineering: "💻",
    Sales: "📈",
    Marketing: "📢",
    Finance: "💰",
    'N/A': "❓",
  };

  return (
    <div className="p-6 min-h-[70vh] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2">
          <span>Employees on Leave Today</span>
          <span className="ml-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
            {onLeaveToday.length}
          </span>
        </h2>
        <span className="text-gray-500 text-sm">{today}</span>
      </div>

      {onLeaveToday.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <img src="/vite.svg" alt="No leave" className="w-20 h-20 mb-4 opacity-60" />
          <p className="text-gray-500 text-lg">No employees are on leave today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {onLeaveToday.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-4 hover:scale-[1.03] transition-transform duration-200 cursor-pointer"
              onClick={() => navigate(`/employee/${emp.id}/profile`)}
              title={`View ${emp.name}'s profile`}
            >
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-200 via-pink-200 to-blue-200 flex items-center justify-center text-3xl font-bold">
                {emp.name !== "Unknown" ? emp.name.charAt(0) : "?"}
              </div>
              {/* Details */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800">{emp.name}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${departmentColors[emp.department] || departmentColors['N/A']}`}
                  >
                    {departmentIcons[emp.department] || departmentIcons['N/A']} {emp.department}
                  </span>
                </div>
                <div className="text-gray-500 text-sm mt-1">Employee ID: <span className="font-mono text-purple-700">{emp.id}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesOnLeaveToday;
