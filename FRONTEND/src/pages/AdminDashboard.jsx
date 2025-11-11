// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaUsers, FaCalendarAlt, FaClipboardList, FaBuilding, FaChevronLeft, FaChevronRight, FaSyncAlt } from "react-icons/fa";
import AttendanceChart from "../components/AttendanceChart";
import DepartmentPieChart from "../components/DepartmentPieChart";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";

const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { attendanceRecords, getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  const [selectedDept, setSelectedDept] = useState("All");
  const [currentWeek, setCurrentWeek] = useState(0);

  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  const weekDates = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
    };
  }, [currentWeek]);

  const filteredAttendance = useMemo(() => {
    const activeEmployeeMap = new Map(activeEmployees.map(e => [e.employeeId, e.department]));
    return attendanceRecords.filter(record => {
      const dateMatch = record.date >= weekDates.start && record.date <= weekDates.end;
      if (!dateMatch) return false;
      const department = activeEmployeeMap.get(record.employeeId);
      if (!department) return false;
      const deptMatch = selectedDept === "All" || department === selectedDept;
      return deptMatch;
    });
  }, [attendanceRecords, activeEmployees, selectedDept, weekDates]);
  
  const formatWeekRange = (start, end) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition flex flex-col items-center" onClick={() => navigate("/employees")}>
          <FaUsers className="text-3xl text-blue-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Total Employees</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.totalEmployees}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition flex flex-col items-center">
          <FaCalendarAlt className="text-3xl text-yellow-500 mb-2" />
          <h3 className="text-gray-600 font-semibold">On Leave Today</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.onLeaveToday}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition flex flex-col items-center" onClick={() => navigate("/leave-management", { state: { defaultStatus: "Pending" } })}>
          <FaClipboardList className="text-3xl text-purple-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Pending Leaves</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.pendingLeaves}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <FaBuilding className="text-3xl text-green-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Departments</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.totalDepartments}</p>
        </div>
      </div>

      {/* Week Navigation & Filters */}
      <div className="mt-8 bg-white p-4 rounded-xl shadow-lg flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentWeek(currentWeek - 1)} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow"><FaChevronLeft /></button>
          <span className="font-semibold text-gray-700 w-64 text-center">{formatWeekRange(weekDates.start, weekDates.end)}</span>
          <button onClick={() => setCurrentWeek(currentWeek + 1)} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow"><FaChevronRight /></button>
          {currentWeek !== 0 && <button onClick={() => setCurrentWeek(0)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow" title="Go to Current Week"><FaSyncAlt /></button>}
        </div>
        <div className="w-full lg:w-auto">
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="border border-gray-300 px-4 py-2 rounded-lg w-full lg:w-64 font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="All">All Departments</option>
              {departmentList.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
            </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="col-span-1 xl:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-blue-700 font-bold text-lg mb-4">Weekly Attendance Overview</h3>
          <div className="w-full h-80">
            <AttendanceChart data={filteredAttendance} />
          </div>
        </div>
        <div className="col-span-1 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-blue-700 font-bold text-lg mb-4">Employee Distribution</h3>
          <div className="w-full h-80">
            <DepartmentPieChart data={activeEmployees} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;