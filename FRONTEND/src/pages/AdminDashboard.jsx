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
  FaArrowRight,
  FaBirthdayCake,
  FaUmbrellaBeach,
  FaLaptopHouse,
  FaAngleRight,
  FaCalendarAlt,
  FaLuggageCart,
  FaFileAlt,
  FaBullhorn,
  FaUserClock,
  FaChartPie,
  FaCalendarCheck,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaConnectdevelop
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
import api from "../api";

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

  // ✅ NEW STATES FOR TEAM DATA
  const [loadingTeamData, setLoadingTeamData] = useState(false);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [onLeaveToday, setOnLeaveToday] = useState([]);
  const [remoteWorkers, setRemoteWorkers] = useState([]);
  const [officeConfig, setOfficeConfig] = useState(null);
  const [isGlobalWFH, setIsGlobalWFH] = useState(false);

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

  // ✅ HELPER: Format Date DD/MM/YYYY
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  // ✅ FETCH TEAM DATA (Birthdays, On Leave, Remote Workers)
  const fetchTeamData = async () => {
    setLoadingTeamData(true);
    try {
      // Fetch all required data in parallel
      const [employeesRes, leavesRes, officeConfigRes, employeeModesRes] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/leaves"),
        api.get("/api/admin/settings/office"),
        api.get("/api/admin/settings/employees-modes")
      ]);

      const allEmployees = employeesRes.data || [];
      const allLeaves = leavesRes.data || [];
      const configData = officeConfigRes.data;
      const empModes = employeeModesRes.data?.employees || [];

      setOfficeConfig(configData);
      setIsGlobalWFH(configData?.globalWorkMode === 'WFH');

      // --- LOGIC 1: BIRTHDAYS ---
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDate = today.getDate();

      const birthdays = allEmployees.filter(emp => {
        if (!emp.personalDetails?.dob) return false;
        const dob = new Date(emp.personalDetails.dob);
        return (dob.getMonth() + 1) === todayMonth && dob.getDate() === todayDate;
      }).map(emp => ({
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department || emp.experienceDetails?.[0]?.department || "N/A",
        role: emp.role || emp.experienceDetails?.[0]?.role || "N/A"
      }));
      setTodaysBirthdays(birthdays);

      // --- LOGIC 2: ON LEAVE TODAY ---
      const employeeMap = new Map();
      allEmployees.forEach(emp => {
        employeeMap.set(emp.employeeId, {
          name: emp.name,
          employeeId: emp.employeeId,
          department: emp.department || emp.experienceDetails?.[0]?.department || "N/A",
          role: emp.role || emp.experienceDetails?.[0]?.role || "N/A"
        });
      });

      const todayStart = new Date(); 
      todayStart.setHours(0, 0, 0, 0);

      const todayLeaves = allLeaves.filter(leave => {
        if (leave.status !== 'Approved') return false;
        const fromDate = new Date(leave.from);
        const toDate = new Date(leave.to);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        return todayStart >= fromDate && todayStart <= toDate;
      });

      const onLeave = todayLeaves.map(leave => {
        const empDetails = employeeMap.get(leave.employeeId) || {
          name: leave.employeeName || "Unknown",
          employeeId: leave.employeeId,
          department: "N/A", 
          role: "N/A"
        };
        return { 
          ...empDetails, 
          leaveType: leave.leaveType || "Casual", 
          leaveReason: leave.reason 
        };
      });
      
      // Unique leaves
      setOnLeaveToday(Array.from(new Map(onLeave.map(item => [item.employeeId, item])).values()));

      // --- LOGIC 3: REMOTE WORKERS ---
      const currentGlobalMode = configData.globalWorkMode || 'WFO';
      const currentDay = today.getDay();
      
      let remoteList = [];
      empModes.forEach(emp => {
        const basicInfo = employeeMap.get(emp.employeeId);
        if(!basicInfo) return;

        let effectiveMode = currentGlobalMode;
        if (emp.ruleType === "Permanent") {
          effectiveMode = emp.config.permanentMode;
        } else if (emp.ruleType === "Temporary" && emp.config.temporary) {
          const from = new Date(emp.config.temporary.fromDate);
          const to = new Date(emp.config.temporary.toDate);
          from.setHours(0, 0, 0, 0);
          to.setHours(23, 59, 59, 999);
          if (todayStart >= from && todayStart <= to) effectiveMode = emp.config.temporary.mode;
        } else if (emp.ruleType === "Recurring" && emp.config.recurring) {
          if (emp.config.recurring.days.includes(currentDay)) effectiveMode = emp.config.recurring.mode;
        }

        if (effectiveMode === 'WFH') {
          remoteList.push({
            name: basicInfo.name,
            employeeId: basicInfo.employeeId,
            department: basicInfo.department || "N/A"
          });
        }
      });
      setRemoteWorkers(remoteList);

    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoadingTeamData(false);
    }
  };

  // ✅ FETCH TEAM DATA ON MOUNT
  useEffect(() => {
    fetchTeamData();
  }, []);

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

  // ✅ GRADIENTS FOR AVATARS
  const gradients = [
    "from-blue-400 to-indigo-500",
    "from-pink-400 to-rose-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-amber-500",
    "from-purple-400 to-violet-500",
  ];

  // ✅ QUICK ACTIONS DATA (Based on Sidebar routes)
  const quickActions = [
    {
      title: "Employee Management",
      icon: <FaUsers className="text-lg" />,
      to: "/employees",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      hoverColor: "hover:from-blue-50 hover:to-white",
      borderColor: "hover:border-blue-200"
    },
    {
      title: "Group Management",
      icon: <FaLayerGroup className="text-lg" />,
      to: "/admin/groups",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      hoverColor: "hover:from-purple-50 hover:to-white",
      borderColor: "hover:border-purple-200"
    },
    {
      title: "Employees Attendance",
      icon: <FaUserClock className="text-lg" />,
      to: "/attendance",
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      hoverColor: "hover:from-green-50 hover:to-white",
      borderColor: "hover:border-green-200"
    },
    {
      title: "Leave Approvals",
      icon: <FaCalendarCheck className="text-lg" />,
      to: "/admin/admin-Leavemanage",
      color: "from-amber-500 to-amber-600",
      bgColor: "bg-amber-50",
      hoverColor: "hover:from-amber-50 hover:to-white",
      borderColor: "hover:border-amber-200"
    },
    {
      title: "Payroll",
      icon: <FaFileAlt className="text-lg" />,
      to: "/admin/payroll",
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50",
      hoverColor: "hover:from-red-50 hover:to-white",
      borderColor: "hover:border-red-200"
    },
    {
      title: "Announcements",
      icon: <FaBullhorn className="text-lg" />,
      to: "/admin/notices",
      color: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-50",
      hoverColor: "hover:from-indigo-50 hover:to-white",
      borderColor: "hover:border-indigo-200"
    },
    {
      title: "Holiday Calendar",
      icon: <FaCalendarAlt className="text-lg" />,
      to: "/admin/holiday-calendar",
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50",
      hoverColor: "hover:from-teal-50 hover:to-white",
      borderColor: "hover:border-teal-200"
    },
    {
      title: "Shift Management",
      icon: <FaChartPie className="text-lg" />,
      to: "/admin/settings",
      color: "from-pink-500 to-pink-600",
      bgColor: "bg-pink-50",
      hoverColor: "hover:from-pink-50 hover:to-white",
      borderColor: "hover:border-pink-200"
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* 1. Today's Attendance Overview */}
        <div 
          className="bg-white rounded-xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-all duration-200 border border-blue-700 border-l-4"
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

      {/* ✅ NEW TEAM OVERVIEW SECTION */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 🎂 Today's Birthdays */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                <FaBirthdayCake className="text-xl" />
              </div>
              <h3 className="font-bold text-gray-800">Today's Birthdays</h3>
            </div>
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
              {todaysBirthdays.length}
            </span>
          </div>
          
          {loadingTeamData ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : todaysBirthdays.length > 0 ? (
            <div className="space-y-3">
              {todaysBirthdays.slice(0, 5).map((person, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-orange-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{person.name}</p>
                    <p className="text-xs text-gray-500">{person.department} • {person.role}</p>
                  </div>
                </div>
              ))}
              {todaysBirthdays.length > 5 && (
                <p className="text-center text-sm text-gray-500 mt-2">
                  +{todaysBirthdays.length - 5} more birthdays today
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-400">No birthdays today</p>
            </div>
          )}
        </div>

        {/* 🏖️ On Leave Today */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FaUmbrellaBeach className="text-xl" />
              </div>
              <h3 className="font-bold text-gray-800">On Leave Today</h3>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
              {onLeaveToday.length}
            </span>
          </div>
          
          {loadingTeamData ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : onLeaveToday.length > 0 ? (
            <div className="space-y-3">
              {onLeaveToday.slice(0, 5).map((person, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{person.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {person.leaveType}
                      </span>
                      <span className="text-xs text-gray-500">{person.department}</span>
                    </div>
                  </div>
                </div>
              ))}
              {onLeaveToday.length > 5 && (
                <p className="text-center text-sm text-gray-500 mt-2">
                  +{onLeaveToday.length - 5} more on leave
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-400">No employees on leave today</p>
            </div>
          )}
        </div>

        {/* 🏠 Working Remotely */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg text-green-600">
                <FaLaptopHouse className="text-xl" />
              </div>
              <h3 className="font-bold text-gray-800">Working Remotely</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                {remoteWorkers.length}
              </span>
              {isGlobalWFH && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">
                  Global
                </span>
              )}
            </div>
          </div>
          
          {loadingTeamData ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : isGlobalWFH ? (
            <div className="text-center py-6 bg-green-50 rounded-lg">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-3">
                <FaLaptopHouse className="text-white text-2xl" />
              </div>
              <h4 className="font-bold text-green-800">Global Remote Day</h4>
              <p className="text-sm text-green-600 mt-1">Everyone is working from home today</p>
            </div>
          ) : remoteWorkers.length > 0 ? (
            <div>
              <div className="flex -space-x-3 mb-4">
                {remoteWorkers.slice(0, 6).map((worker, index) => (
                  <div 
                    key={index}
                    className="relative group"
                    title={`${worker.name} (${worker.department})`}
                  >
                    <div className={`w-10 h-10 rounded-full ring-2 ring-white bg-gradient-to-tr ${gradients[index % gradients.length]} flex items-center justify-center text-white font-bold text-sm`}>
                      {worker.name.charAt(0)}
                    </div>
                  </div>
                ))}
                {remoteWorkers.length > 6 && (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs ring-2 ring-white">
                    +{remoteWorkers.length - 6}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {remoteWorkers.slice(0, 3).map((worker, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium text-sm">{worker.name}</span>
                    <span className="text-xs text-gray-500">{worker.department}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-400">No employees working remotely</p>
            </div>
          )}
        </div>
      </div>

      {/* ✅ QUICK ACTIONS SECTION */}
      <div className="mt-8 bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <FaConnectdevelop className="text-xl" />
            </div>
            <h3 className="font-bold text-2xl text-gray-800">Quick Actions</h3>
          </div>
          <p className="text-sm text-gray-500">Navigate to frequently used admin sections</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => navigate(action.to)}
              className={`group bg-gradient-to-r from-white to-gray-50 ${action.hoverColor} border border-gray-200 ${action.borderColor} rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] text-left`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 group-hover:text-gray-900 transition-colors">
                  {action.title}
                </h4>
              </div>
              <FaAngleRight className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;