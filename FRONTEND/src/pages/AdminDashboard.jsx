// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaClipboardList,
  FaBuilding,
  FaChevronLeft,
  FaChevronRight,
  FaSyncAlt,
  FaClock,
  FaArrowRight
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import DepartmentPieChart from "../components/DepartmentPieChart"; 
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import { getAttendanceByDateRange } from "../api";

const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  const [selectedDept, setSelectedDept] = useState("All");
  
  // --- NEW STATE FOR MONTHLY FILTER ---
  const [viewMode, setViewMode] = useState("week"); // Options: 'week', 'month'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // Format YYYY-MM

  const [currentWeek, setCurrentWeek] = useState(0); 
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const [todayCounts, setTodayCounts] = useState({
    present: 0,
    notLoggedIn: 0,
    onLeave: 0
  });

  // --- 1. General Dashboard Stats ---
  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  // --- 2. Calculate Today's Overview Counts ---
  useEffect(() => {
    const calculateTodayCounts = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const todayAttendance = await getAttendanceByDateRange(today, today);
        const attendanceArray = Array.isArray(todayAttendance) ? todayAttendance : [];

        const todayLeaveRequests = leaveRequests.filter(leave => {
          if (leave.status !== 'Approved') return false;
          return today >= leave.from && today <= leave.to;
        });

        const present = attendanceArray.filter(att => att.punchIn).length;
        const onLeave = todayLeaveRequests.length;

        const activeEmployeeIds = new Set(
          activeEmployees.filter(e => e.isActive !== false).map(e => e.employeeId)
        );
        const presentIds = new Set(
          attendanceArray.filter(att => att.punchIn).map(att => att.employeeId)
        );
        const onLeaveIds = new Set(todayLeaveRequests.map(l => l.employeeId));

        const notLoggedIn = Array.from(activeEmployeeIds).filter(
          id => !presentIds.has(id) && !onLeaveIds.has(id)
        ).length;

        setTodayCounts({
          present,
          notLoggedIn,
          onLeave
        });
      } catch (error) {
        console.error("Error calculating today's counts:", error);
      }
    };

    calculateTodayCounts();
  }, [activeEmployees, leaveRequests]);

  // --- 3. Calculate Date Range (Updated for Month Support) ---
  const weekDates = useMemo(() => {
    const formatDate = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    };

    // Monthly View Logic
    if (viewMode === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0); // Last day of the month
      lastDay.setHours(23, 59, 59, 999);

      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        startDateObj: firstDay,
        endDateObj: lastDay
      };
    }

    // Weekly View Logic (Existing)
    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);

    const dayOfWeek = today.getDay(); 

    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return {
      start: formatDate(sunday),
      end: formatDate(saturday),
      startDateObj: sunday,
      endDateObj: saturday
    };
  }, [currentWeek, viewMode, selectedMonth]);

  // --- 4. Fetch Attendance Data ---
  useEffect(() => {
    const fetchWeeklyData = async () => {
      setLoadingGraph(true);
      try {
        const data = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setWeeklyAttendanceData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        setWeeklyAttendanceData([]);
      } finally {
        setLoadingGraph(false);
      }
    };
    fetchWeeklyData();
  }, [weekDates]);

  // --- 5. Process Data for Graph (Updated for Dynamic Range) ---
  const weeklyChartData = useMemo(() => {
    const deptEmployees = activeEmployees.filter(e =>
      selectedDept === "All" || e.department === selectedDept
    );
    const totalActiveCount = deptEmployees.length;
    const validEmployeeIds = new Set(deptEmployees.map(e => e.employeeId));

    const data = [];
    const startObj = new Date(weekDates.startDateObj);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate number of days in the selected range (7 for week, 28-31 for month)
    const timeDiff = weekDates.endDateObj.getTime() - weekDates.startDateObj.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include start date

    for (let i = 0; i < dayDiff; i++) {
      const loopDate = new Date(startObj);
      loopDate.setDate(startObj.getDate() + i);

      if (loopDate > today) break;

      const offset = loopDate.getTimezoneOffset() * 60000;
      const dateStr = new Date(loopDate.getTime() - offset).toISOString().slice(0, 10);
      
      // Short day name for week view, Date number for month view to save space
      const dayName = viewMode === 'week' 
        ? loopDate.toLocaleDateString('en-US', { weekday: 'short' })
        : loopDate.getDate().toString(); 

      const presentSet = new Set();

      weeklyAttendanceData.forEach(record => {
        const recordRawDate = record.punchIn ? new Date(record.punchIn) : new Date(record.date);
        const rOffset = recordRawDate.getTimezoneOffset() * 60000;
        const recordLocalStr = new Date(recordRawDate.getTime() - rOffset).toISOString().slice(0, 10);

        if (recordLocalStr === dateStr && record.punchIn && validEmployeeIds.has(record.employeeId)) {
          presentSet.add(record.employeeId);
        }
      });

      const presentCount = presentSet.size;
      let absentCount = totalActiveCount - presentCount;
      if (absentCount < 0) absentCount = 0;

      data.push({
        name: dayName,
        date: dateStr,
        "Present": presentCount,
        "Absent": absentCount
      });
    }

    return data;
  }, [weeklyAttendanceData, activeEmployees, selectedDept, weekDates, viewMode]);

  // --- 6. Process Employee Distribution Data ---
  const departmentData = useMemo(() => {
    const counts = {};
    activeEmployees.forEach((emp) => {
      const dept = emp.department || "Unassigned";
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.keys(counts).map((dept) => ({
      name: dept,
      employees: counts[dept]
    }));
  }, [activeEmployees]);

  // --- Helpers ---
  const formatWeekRange = (start, end) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const isCurrentWeek = currentWeek >= 0;
  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* 1. Today's Attendance Overview */}
        <div 
          // className="bg-white rounded-xl shadow-md border border-pink-500 border-l-4 border-blue-600 p-5 cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
          className="bg-white rounded-xl shadow-md   p-4 cursor-pointer hover:shadow-lg transition-all duration-200 border border-blue-700 border-l-4 cursor-pointer"
          onClick={() => navigate("/admin/today-overview")}
        >
          <div className="flex justify-between items-center mb-3">
             <h3 className="text-gray-700 font-bold text-base">Today's Attendance</h3>
             <FaClock className="text-blue-500 w-5 h-5" />
          </div>
          <div className="grid grid-cols-3 gap-3">
             <div className="flex flex-col items-center justify-center bg-green-50 rounded-lg py-2 border border-green-100">
                <span className="text-2xl font-bold text-green-600 leading-none">{todayCounts.present}</span>
                <span className="text-xs font-semibold text-green-700 mt-1">Present</span>
             </div>
             <div className="flex flex-col items-center justify-center bg-red-50 rounded-lg py-2 border border-red-100">
                <span className="text-2xl font-bold text-red-600 leading-none">{todayCounts.notLoggedIn}</span>
                <span className="text-xs font-semibold text-red-700 mt-1">Absent</span>
             </div>
             <div className="flex flex-col items-center justify-center bg-amber-50 rounded-lg py-2 border border-amber-100">
                <span className="text-2xl font-bold text-amber-600 leading-none">{todayCounts.onLeave}</span>
                <span className="text-xs font-semibold text-amber-700 mt-1">Leave</span>
             </div>
          </div>
          <div className="mt-3 flex justify-end">
             <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline">
               Details <FaArrowRight className="w-2.5 h-2.5" />
             </span>
          </div>
        </div>

        {/* 2. Total Employees - Added Border Left */}
        <div 
          className="bg-white rounded-xl shadow-md border border-pink-500 border-l-4 border-blue-600 p-5 cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
          onClick={() => navigate("/employees")}
        >
          <div>
            <p className="text-gray-500 text-sm font-semibold mb-1">Total Employees</p>
            <h3 className="text-3xl font-extrabold text-gray-800">{statCards.totalEmployees}</h3>
          </div>
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <FaUsers className="w-6 h-6" />
          </div>
        </div>

        {/* 3. Leave Approvals - Added Border Left */}
        <div 
          className="bg-white rounded-xl shadow-md border border-gray-100 border-l-4 border-purple-600 p-5 cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
          onClick={() => navigate("/admin/admin-Leavemanage", { state: { defaultStatus: "Pending" } })}
        >
           <div>
            <p className="text-gray-500 text-sm font-semibold mb-1">Leave Request</p>
            <h3 className="text-3xl font-extrabold text-gray-800">{statCards.pendingLeaves}</h3>
          </div>
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <FaClipboardList className="w-6 h-6" />
          </div>
        </div>

        {/* 4. Departments - Added Border Left */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 border-l-4 border-orange-600 p-5 flex items-center justify-between">
           <div>
            <p className="text-gray-500 text-sm font-semibold mb-1">Departments</p>
            <h3 className="text-3xl font-extrabold text-gray-800">{statCards.totalDepartments}</h3>
          </div>
          <div className="p-3 bg-orange-100 rounded-full text-orange-600">
            <FaBuilding className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation & Filters (UPDATED) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
        
        {/* Left Side: Type Selector & Date Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* View Mode Dropdown */}
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)} 
            className="border border-gray-300 px-3 py-2 rounded-lg font-medium text-gray-700 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>

          {/* Conditional Rendering based on View Mode */}
          {viewMode === 'week' ? (
            // Weekly Navigation
            <>
              <button
                onClick={() => setCurrentWeek(currentWeek - 1)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                title="Previous Week"
              >
                <FaChevronLeft />
              </button>

              <span className="font-bold text-gray-800 text-base sm:text-lg min-w-[200px] text-center">
                {formatWeekRange(weekDates.start, weekDates.end)}
              </span>

              <button
                onClick={() => setCurrentWeek(currentWeek + 1)}
                className={`p-2 rounded-lg transition ${isCurrentWeek ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                disabled={isCurrentWeek}
                title="Next Week"
              >
                <FaChevronRight />
              </button>

              {currentWeek !== 0 && (
                <button onClick={() => setCurrentWeek(0)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="Go to Current Week">
                  <FaSyncAlt />
                </button>
              )}
            </>
          ) : (
            // Monthly Navigation
            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
                className="border border-gray-300 px-3 py-2 rounded-lg font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-xs text-gray-500 ml-1">
                 ({formatWeekRange(weekDates.start, weekDates.end)})
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Department Filter */}
        <div className="w-full lg:w-auto">
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="border border-gray-300 px-4 py-2 rounded-lg w-full lg:w-64 font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
            <option value="All">All Departments</option>
            {departmentList.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Attendance Bar Chart (Updated Title) */}
        <div className="col-span-1 xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-800 font-bold text-lg mb-6">
            {viewMode === 'week' ? "Weekly Attendance" : "Monthly Attendance"}
          </h3>
          <div className="w-full h-80">
            {loadingGraph ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading Chart...</div>
            ) : weeklyChartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    dy={10}
                    interval={0} 
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey="Present"
                    fill="#14532d"
                    radius={[4, 4, 0, 0]}
                    barSize={viewMode === 'month' ? 10 : 20} // Thinner bars for month view
                  />
                  <Bar
                    dataKey="Absent"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    barSize={viewMode === 'month' ? 10 : 20}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Employee Distribution Graph */}
        <div className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-800 font-bold text-lg mb-6">Employee Distribution</h3>
          <div className="w-full h-80">
            {departmentData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">No Data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="employees" barSize={20} radius={[0, 4, 4, 0]}>
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;