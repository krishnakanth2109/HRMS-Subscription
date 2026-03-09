// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaUsers,
  FaUserClock,
  FaCalendarCheck,
  FaFileAlt,
  FaBullhorn,
  FaCalendarAlt,
  FaChartPie,
  FaCheck,
  FaTimes,
  FaLaptopCode,
  FaPlane,
  FaChevronRight,
  FaChevronLeft,
  FaSyncAlt,
  FaChartLine // Added for Leave Summary
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Sector
} from "recharts";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees
} from "../api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-pink-500",
];
const pickColor = (name = "") =>
  avatarColors[name.charCodeAt(0) % avatarColors.length];

const getDeptRole = (emp) => {
  const exp = Array.isArray(emp.experienceDetails)
    ? emp.experienceDetails.find((e) => e.lastWorkingDate === "Present") ||
    emp.experienceDetails[0]
    : null;
  return {
    department: emp.currentDepartment || exp?.department || "Unassigned",
    role: emp.currentRole || exp?.role || "—",
  };
};

const formatLeaveDate = (from) => {
  if (!from) return "";
  const d = new Date(from);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
};

const formatWeekRange = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

// ─── Pie Active Shape (Updated for Hover Expansion) ───────────────────────────

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 3} // Expands hovered slice slightly
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={10}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const { employees: ctxEmployees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests: ctxLeaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [allEmployees, setAllEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [employeeWorkModes, setEmployeeWorkModes] = useState({});
  const [loadingData, setLoadingData] = useState(true);

  // --- Graph State ---
  const [viewMode, setViewMode] = useState("week"); // 'week' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentWeek, setCurrentWeek] = useState(0);
  const [chartRawData, setChartRawData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  // --- Pie Chart Hover State ---
  const [activeIndex, setActiveIndex] = useState(-1);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1); // Reset back to default (100% total)
  };

  // Context-based stat cards
  const { statCards } = useMemo(
    () => getDashboardData(ctxEmployees, ctxLeaveRequests), [ctxEmployees, ctxLeaveRequests, getDashboardData]
  );

  // ── Fetch General Dashboard Data ──────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [todayAtt, leavesData, empData] = await Promise.all([
        getAttendanceByDateRange(today, today).catch(() => []),
        getLeaveRequests().catch(() => []),
        getEmployees().catch(() => []),
      ]);

      setTodayAttendance(Array.isArray(todayAtt) ? todayAtt : []);
      setAllLeaves(Array.isArray(leavesData) ? leavesData : []);
      setAllEmployees(Array.isArray(empData) ? empData : []);

      // Fetch work modes for remote detection
      try {
        const { data } = await api.get("/api/admin/settings/employees-modes");
        if (data?.employees) {
          const modeMap = {};
          data.employees.forEach((e) => {
            modeMap[e.employeeId] = e.currentEffectiveMode || "WFO";
          });
          setEmployeeWorkModes(modeMap);
        }
      } catch (_) { }
    } catch (err) {
      console.error("AdminDashboard fetchDashboardData error:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ── Derived Data: Active Employees ───────────────────────────────────────
  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.isActive !== false && (e.status || "").toLowerCase() !== "deactive"), [allEmployees]
  );

  const empMap = useMemo(() => {
    const m = {};
    allEmployees.forEach((e) => { m[e.employeeId] = e; });
    return m;
  }, [allEmployees]);

  // ── Date Range Logic ─────────────────────────────────────────────────────
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

    // Weekly View Logic
    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);

    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon

    // Adjust to make Monday the start of the week
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: formatDate(monday),
      end: formatDate(sunday),
      startDateObj: monday,
      endDateObj: sunday
    };
  }, [currentWeek, viewMode, selectedMonth]);

  // ── Fetch Chart Data (Dynamic) ───────────────────────────────────────────
  useEffect(() => {
    const fetchGraph = async () => {
      setLoadingGraph(true);
      try {
        const data = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setChartRawData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching attendance graph data:", error);
        setChartRawData([]);
      } finally {
        setLoadingGraph(false);
      }
    };
    fetchGraph();
  }, [weekDates]);

  // ── Chart Data Processing ────────────────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const totalActive = activeEmployees.length || 1;
    const data = [];

    // Normalize "Today" to midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Strictly use 7 days for 'week' mode to avoid 8th day
    const iterations = viewMode === 'week'
      ? 7
      : Math.ceil((weekDates.endDateObj - weekDates.startDateObj) / (1000 * 3600 * 24)) + 1;

    const startObj = new Date(weekDates.startDateObj);

    for (let i = 0; i < iterations; i++) {
      const loopDate = new Date(startObj);
      loopDate.setDate(startObj.getDate() + i);

      const loopDateNormalized = new Date(loopDate);
      loopDateNormalized.setHours(0, 0, 0, 0);

      const offset = loopDate.getTimezoneOffset() * 60000;
      const dateStr = new Date(loopDate.getTime() - offset).toISOString().slice(0, 10);

      const dayName = viewMode === 'week'
        ? loopDate.toLocaleDateString('en-US', { weekday: 'short' })
        : loopDate.getDate().toString();

      // Check if date is in future (Don't show bars)
      if (loopDateNormalized > today) {
        data.push({
          name: dayName,
          Present: 0,
          Absent: 0
        });
        continue;
      }

      // Count Present for this specific date
      let presentCount = 0;
      chartRawData.forEach(att => {
        const attDate = att.date
          ? att.date.split("T")[0]
          : (att.punchIn ? new Date(att.punchIn).toISOString().split("T")[0] : null);

        if (attDate === dateStr && att.punchIn) {
          // Ensure employee is active
          if (activeEmployees.some(e => e.employeeId === att.employeeId)) {
            presentCount++;
          }
        }
      });

      // Calculate Leaves for this date
      const onLeaveCount = allLeaves.filter(l =>
        l.status === 'Approved' &&
        dateStr >= l.from &&
        dateStr <= l.to
      ).length;

      // Calculate Absent
      const absentCount = Math.max(0, totalActive - presentCount - onLeaveCount);

      data.push({
        name: dayName,
        Present: presentCount,
        Absent: absentCount
      });
    }

    return data;
  }, [chartRawData, activeEmployees, allLeaves, weekDates, viewMode]);

  // ── Other Derived Stats (Today) ──────────────────────────────────────────

  const todayStr = new Date().toISOString().split("T")[0];

  // Today Present
  const todayPresent = useMemo(
    () => todayAttendance.filter((a) => !!a.punchIn),
    [todayAttendance]
  );
  const presentIds = useMemo(() => new Set(todayAttendance.map((a) => a.employeeId)), [todayAttendance]);

  // Today Leaves List
  const onLeaveTodayList = useMemo(() => {
    return allLeaves
      .filter(
        (l) =>
          l.status === "Approved" &&
          todayStr >= l.from &&
          todayStr <= l.to
      )
      .map((l) => {
        const emp = empMap[l.employeeId] || {};
        const { role } = getDeptRole(emp);
        return {
          employeeId: l.employeeId,
          name: emp.name || l.employeeName || l.employeeId,
          role,
          leaveType: l.leaveType || "Leave",
          from: l.from,
        };
      });
  }, [allLeaves, empMap, todayStr]);

  const onLeaveIds = useMemo(() => new Set(onLeaveTodayList.map((l) => l.employeeId)), [onLeaveTodayList]);

  // Today Absent
  const todayAbsentCount = useMemo(() => {
    return activeEmployees.filter(
      (e) => !presentIds.has(e.employeeId) && !onLeaveIds.has(e.employeeId)
    ).length;
  }, [activeEmployees, presentIds, onLeaveIds]);

  // Total Pending Count
  const totalPendingLeavesCount = useMemo(() => {
    return allLeaves.filter(l => l.status === "Pending").length;
  }, [allLeaves]);

  // Recent Leave Requests
  const recentLeaves = useMemo(
    () =>
      allLeaves
        .sort((a, b) => new Date(b.createdAt || b.appliedDate || 0) - new Date(a.createdAt || a.appliedDate || 0))
        .map((l) => {
          const emp = empMap[l.employeeId] || {};
          const { role } = getDeptRole(emp);
          return {
            ...l,
            name: emp.name || l.employeeName || l.employeeId,
            role,
            status: l.status,
            dateLabel: `${l.leaveType || "Leave"}, ${formatLeaveDate(l.from)}`,
          };
        })
        .slice(0, 4), [allLeaves, empMap]
  );

  // Working Remotely
  const remoteWorkers = useMemo(() => {
    return todayPresent
      .filter((a) => (employeeWorkModes[a.employeeId] || "WFO") === "WFH")
      .map((a) => {
        const emp = empMap[a.employeeId] || {};
        const { role } = getDeptRole(emp);
        return {
          employeeId: a.employeeId,
          name: emp.name || a.employeeName || a.employeeId,
          role,
        };
      });
  }, [todayPresent, employeeWorkModes, empMap]);

  // Birthdays
  const { todayBirthdays, upcomingBirthdays } = useMemo(() => {
    const todayM = new Date().getMonth();
    const todayD = new Date().getDate();

    const birthdayEmployees = activeEmployees
      .filter((e) => e.personalDetails?.dob)
      .map((e) => {
        const dob = new Date(e.personalDetails.dob);
        return {
          name: e.name,
          role: getDeptRole(e).role,
          month: dob.getMonth(),
          day: dob.getDate(),
        };
      });

    const todayB = birthdayEmployees.filter(
      (b) => b.month === todayM && b.day === todayD
    );

    const upcoming = birthdayEmployees
      .filter((b) => {
        const thisYear = new Date().getFullYear();
        let bdDate = new Date(thisYear, b.month, b.day);
        if (bdDate <= new Date()) bdDate.setFullYear(thisYear + 1);
        const diff = bdDate - new Date();
        return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => {
        const yr = new Date().getFullYear();
        const da = new Date(yr, a.month, a.day);
        const db = new Date(yr, b.month, b.day);
        if (da < new Date()) da.setFullYear(yr + 1);
        if (db < new Date()) db.setFullYear(yr + 1);
        return da - db;
      })
      .slice(0, 5);

    return { todayBirthdays: todayB, upcomingBirthdays: upcoming };
  }, [activeEmployees]);

  // Employee Distribution (Dynamic Departments)
  const departmentData = useMemo(() => {
    const counts = {};
    activeEmployees.forEach((e) => {
      // Use helper to get Dept safely
      const { department } = getDeptRole(e);
      const deptName = department || "Unassigned";
      counts[deptName] = (counts[deptName] || 0) + 1;
    });

    return Object.keys(counts).map((dept) => ({
      name: dept,
      value: counts[dept], // Recharts Pie expects 'value'
    }));
  }, [activeEmployees]);

  const totalEmployeesCount = activeEmployees.length || 1; // Safely divide by this

  // Extended Color Palette for dynamic departments
  const COLORS = [
    "#4f46e5", // Indigo
    "#0ea5e9", // Sky
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#14b8a6", // Teal
  ];

  // Actions
  const handleApprove = async (leaveId) => {
    try {
      const { approveLeaveRequestById } = await import("../api");
      await approveLeaveRequestById(leaveId);
      fetchDashboardData();
    } catch (e) { console.error(e); }
  };

  const handleReject = async (leaveId) => {
    try {
      const { rejectLeaveRequestById } = await import("../api");
      await rejectLeaveRequestById(leaveId);
      fetchDashboardData();
    } catch (e) { console.error(e); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (

    <div
      className="relative w-full font-sans text-gray-800 overflow-hidden flex flex-col"
      style={{ height: "calc(100vh - 70px)" }} // Adjust this 70px offset if your layout header is taller/shorter
    >

      {/* ================= INJECT CUSTOM CSS FOR SCROLLBAR ================= */}
      <style>{`
        /* Custom nice scrollbar for the internal content container */
        .internal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .internal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .internal-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .internal-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      {/* ================= MAIN CONTENT (Internally Scrollable Area) ================= */}
      <div className="relative z-10 w-full h-full overflow-y-auto p-6 pb-20 internal-scroll">

        {/* 1. TOP STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Employees */}
          <div className="relative bg-blue-500 rounded-[20px] p-5 shadow-lg overflow-hidden h-[130px] flex flex-col justify-between transition-transform hover:scale-[1.02]">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white opacity-10"></div>
            <div className="absolute right-2 top-8 w-16 h-16 rounded-full bg-white opacity-10"></div>
            <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white text-xl z-10">
              <FaUsers />
            </div>
            <div className="z-10 text-white">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">Total Employees</p>
              <h3 className="text-3xl font-bold tracking-tight">
                {activeEmployees.length || statCards.totalEmployees}
              </h3>
            </div>
          </div>

          {/* Present - Clickable (UPDATED ROUTE) */}
          <Link
            to="/admin/today-overview"
            className="bg-white rounded-[20px] p-5 shadow-sm h-[130px] flex flex-col justify-between border border-gray-100 transition-all hover:shadow-md hover:border-blue-200 cursor-pointer"
          >
            <div className="w-11 h-11 bg-[#F4F7FE] rounded-xl flex items-center justify-center text-[#4318FF] text-xl">
              <FaLaptopCode />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Present</p>
              <h3 className="text-3xl font-bold text-[#2B3674] tracking-tight">{todayPresent.length}</h3>
            </div>
          </Link>

          {/* Absent - Clickable (UPDATED ROUTE) */}
          <Link
            to="/admin/today-overview"
            className="bg-white rounded-[20px] p-5 shadow-sm h-[130px] flex flex-col justify-between border border-gray-100 transition-all hover:shadow-md hover:border-red-100 cursor-pointer"
          >
            <div className="w-11 h-11 bg-[#F4F7FE] rounded-xl flex items-center justify-center text-[#4318FF] text-lg">
              <FaFileAlt />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Absent</p>
              <h3 className="text-3xl font-bold text-[#2B3674] tracking-tight">{todayAbsentCount}</h3>
            </div>
          </Link>

          {/* Leave Requests */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm h-[130px] flex flex-col justify-between border border-gray-100 transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-[#F4F7FE] rounded-xl flex items-center justify-center text-[#4318FF] text-lg">
              <FaPlane />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Leave Requests</p>
              <h3 className="text-3xl font-bold text-[#2B3674] tracking-tight">{totalPendingLeavesCount}</h3>
            </div>
          </div>
        </div>

        {/* 2. CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Attendance Graph (Dynamic Week/Month) */}
          <div className="lg:col-span-2 bg-[#111C44] rounded-[24px] p-6 shadow-xl flex flex-col">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex flex-col">
                <h3 className="text-white font-bold text-lg">
                  {viewMode === 'week' ? "Weekly Attendance" : "Monthly Attendance"}
                </h3>
                {/* Updated: Peak Day/Date Logic */}
                {!loadingGraph && weeklyChartData.length > 0 && (
                  <p className="text-[#39B8FF] text-[10px] font-bold uppercase tracking-wider mt-1">
                    Peak {viewMode === 'week' ? "Day" : "Date"}: {
                      weeklyChartData.reduce((prev, current) => (prev.Present >= current.Present) ? prev : current).name
                    }
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                {/* View Toggle */}
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="bg-[#1B254B] text-white text-xs border border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>

                {/* Navigation */}
                {viewMode === 'week' ? (
                  <div className="flex items-center gap-2 bg-[#1B254B] rounded-lg p-1">
                    <button
                      onClick={() => setCurrentWeek(currentWeek - 1)}
                      className="p-1.5 text-white hover:text-indigo-300 transition"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    <span className="text-white text-[10px] min-w-[120px] text-center font-medium">
                      {formatWeekRange(weekDates.start, weekDates.end)}
                    </span>
                    <button
                      onClick={() => setCurrentWeek(currentWeek + 1)}
                      disabled={currentWeek >= 0}
                      className={`p-1.5 transition ${currentWeek >= 0 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:text-indigo-300'}`}
                    >
                      <FaChevronRight size={10} />
                    </button>
                    {currentWeek !== 0 && (
                      <button onClick={() => setCurrentWeek(0)} className="ml-1 p-1.5 text-indigo-400 hover:text-indigo-300" title="Reset to Current Week">
                        <FaSyncAlt size={10} />
                      </button>
                    )}
                  </div>
                ) : (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                    className="bg-[#1B254B] text-white text-xs border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                )}

                {/* Legend */}
                <div className="hidden xl:flex gap-3 ml-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#39B8FF]"></span>
                    <span className="text-white text-[10px]">Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7551FF]"></span>
                    <span className="text-white text-[10px]">Absent</span>
                  </div>
                </div>
              </div>
            </div>
x
            {/* Chart Area */}
            <div className="h-[250px] w-full">
              {loadingGraph ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">Loading Data...</div>
              ) : weeklyChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData} barGap={4}>
                    <defs>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#86DBFF" />
                        <stop offset="100%" stopColor="#E0F7FF" />
                      </linearGradient>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#AD6DFF" />
                        <stop offset="100%" stopColor="#7B2CFF" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#fff", fontSize: 10 }}
                      dy={10}
                      interval={viewMode === 'month' ? 2 : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#fff", fontSize: 10 }}
                    />

                    {/* UPDATED: Added itemSorter to show Present first */}
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      itemSorter={(item) => (item.dataKey === 'Present' ? -1 : 1)}
                      contentStyle={{
                        background: "#111C44",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                        borderRadius: "8px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
                      }}
                    />

                    <Bar
                      dataKey="Present"
                      fill="url(#pGrad)"
                      radius={[4, 4, 4, 4]}
                      barSize={viewMode === 'month' ? 6 : 12}
                    />
                    <Bar
                      dataKey="Absent"
                      fill="url(#aGrad)"
                      radius={[4, 4, 4, 4]}
                      barSize={viewMode === 'month' ? 6 : 12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Employee Distribution Card - DYNAMIC HOVER LOGIC ADDED HERE */}
          <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
            <h3 className="text-[#2B3674] font-bold text-lg mb-4">
              Employee Distribution
            </h3>
            <div className="flex justify-center h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {departmentData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic Center Text Overlay */}
              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[#2B3674] font-bold text-xl">
                  {activeIndex === -1 || departmentData.length === 0
                    ? "100%"
                    : `${((departmentData[activeIndex].value / totalEmployeesCount) * 100).toFixed(0)}%`}
                </span>
                <span className="text-gray-400 text-[10px]">
                  {activeIndex === -1 || departmentData.length === 0
                    ? "Total"
                    : departmentData[activeIndex].name}
                </span>
              </div>

              {/* Dynamic Legend */}
              <div className="absolute top-0 right-0 text-right space-y-1 h-[180px] overflow-y-auto pr-2 custom-scrollbar internal-scroll">
                <div>
                  <p className="text-xs font-bold text-[#2B3674]">Total</p>
                  <p className="text-[10px] text-gray-400">{activeEmployees.length} members</p>
                </div>
                {departmentData.map((dept, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <p className="text-xs font-bold text-[#2B3674]">{dept.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-400">{dept.value} members</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Percentage Bar */}
            <div className="mt-4 bg-[#F4F7FE] rounded-full h-4 w-full flex overflow-hidden">
              {departmentData.map((dept, idx) => {
                const percentage = ((dept.value / totalEmployeesCount) * 100).toFixed(0);
                if (percentage === "0") return null;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-center text-[8px] text-white font-bold transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: COLORS[idx % COLORS.length]
                    }}
                    title={`${dept.name}: ${percentage}%`}
                  >
                    {percentage}%
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* 3. MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* LEFT COLUMN (Span 2) */}
          <div className="xl:col-span-2 flex flex-col gap-8">

            {/* RECENT LEAVE REQUESTS */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#2B3674] font-bold text-lg">
                  Recent Leave Requests ({recentLeaves.length})
                </h3>
                {/* UPDATED ROUTE HERE */}
                <button
                  className="text-xs font-bold text-teal-400 uppercase"
                  onClick={() => navigate("/admin/admin-Leavemanage")}
                >
                  View All
                </button>
              </div>

              <div className="space-y-4">
                {recentLeaves.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No pending leave requests
                  </p>
                ) : (
                  recentLeaves.map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="flex items-center justify-between p-3 rounded-[14px] bg-[#F9FAFD] border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#2B3674]">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.dateLabel}
                          </p>
                        </div>
                      </div>
                      {/* Actions or Status Badge */}
                      <div className="flex gap-3">
                        {item.status === "Pending" ? (
                          <>
                            <button
                              onClick={() => handleApprove(item._id)}
                              className="w-8 h-8 rounded-[8px] bg-[#E6F9F3] text-[#05CD99] flex items-center justify-center hover:bg-green-200 transition"
                              title="Approve"
                            >
                              <FaCheck size={12} />
                            </button>
                            <button
                              onClick={() => handleReject(item._id)}
                              className="w-8 h-8 rounded-[8px] bg-[#FEEFEE] text-[#EE5D50] flex items-center justify-center hover:bg-red-200 transition"
                              title="Reject"
                            >
                              <FaTimes size={12} />
                            </button>
                          </>
                        ) : (
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full ${item.status === "Approved"
                                ? "bg-[#E6F9F3] text-[#05CD99]"
                                : "bg-[#FEEFEE] text-[#EE5D50]"
                              }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ON LEAVE TODAY */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#2B3674] font-bold text-lg">
                  On Leave Today ({onLeaveTodayList.length})
                </h3>
                {/* UPDATED ROUTE HERE */}
                <button
                  className="text-xs font-bold text-teal-400 uppercase"
                  onClick={() => navigate("/admin/admin-Leavemanage")}
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {onLeaveTodayList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No one is on leave today
                  </p>
                ) : (
                  onLeaveTodayList.map((item, idx) => (
                    <div
                      key={item.employeeId + idx}
                      className="flex items-center justify-between p-3 rounded-[14px] bg-[#F9FAFD] border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#2B3674]">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.leaveType}, {formatLeaveDate(item.from)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* WORKING REMOTELY */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#2B3674] font-bold text-lg">
                  Working Remotely ({remoteWorkers.length})
                </h3>
                {/* UPDATED ROUTE HERE */}
                <button
                  className="text-xs font-bold text-teal-400 uppercase"
                  onClick={() => navigate("/attendance")}
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {remoteWorkers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No one is working remotely today
                  </p>
                ) : (
                  remoteWorkers.map((item, idx) => (
                    <div
                      key={item.employeeId + idx}
                      className="flex items-center justify-between p-3 rounded-[14px] bg-[#F9FAFD] border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#2B3674]">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Work From Home
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (Span 1) */}
          <div className="xl:col-span-1 flex flex-col gap-8">

            {/* QUICK ACTIONS - ALL ROUTES UPDATED FROM SIDEBAR MAP */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
              <h3 className="text-[#2B3674] font-bold text-lg mb-6">Quick Actions</h3>
              <div className="flex flex-col gap-4">
                {[
                  { icon: FaUsers, label: "Employee Management", bg: "bg-blue-500", path: "/employees" },
                  { icon: FaChartLine, label: "Leave Summary", bg: "bg-purple-500", path: "/admin/leave-summary" },
                  { icon: FaUserClock, label: "Employees Attendance", bg: "bg-green-500", path: "/attendance" },
                  { icon: FaCalendarCheck, label: "Leave Approvals", bg: "bg-yellow-500", path: "/admin/admin-Leavemanage" },
                  { icon: FaFileAlt, label: "Payroll", bg: "bg-red-500", path: "/admin/payroll" },
                  { icon: FaBullhorn, label: "Announcements", bg: "bg-indigo-500", path: "/admin/notices" },
                  { icon: FaCalendarAlt, label: "Holiday Calendar", bg: "bg-teal-500", path: "/admin/holiday-calendar" },
                  { icon: FaChartPie, label: "Shift Management", bg: "bg-pink-500", path: "/admin/settings" },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigate(action.path)}
                    className="flex items-center justify-between w-full p-3 rounded-xl border border-gray-100 hover:shadow-md transition bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center text-white text-sm`}
                      >
                        <action.icon />
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {action.label}
                      </span>
                    </div>
                    <FaChevronRight className="text-gray-300 text-xs" />
                  </button>
                ))}
              </div>
            </div>

            {/* BIRTHDAYS CARD */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/50">
              <h3 className="text-[#2B3674] font-bold text-sm mb-4">
                Today Birthdays ({todayBirthdays.length})
              </h3>

              {todayBirthdays.length === 0 ? (
                <p className="text-xs text-gray-400 mb-4">No birthdays today</p>
              ) : (
                todayBirthdays.map((b, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-r from-orange-300 to-red-300 rounded-xl p-3 flex items-center justify-between mb-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${pickColor(b.name)} text-white font-bold flex items-center justify-center text-xs shadow-sm`}
                      >
                        {getInitials(b.name)}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-[#2B3674]">
                          {b.name}{" "}
                          <span className="font-normal opacity-70">({b.role})</span>
                        </p>
                      </div>
                    </div>
                    <button className="bg-[#FF8F8F] text-white text-[10px] font-bold py-1 px-3 rounded-lg shadow-sm">
                      Send Wishes
                    </button>
                  </div>
                ))
              )}

              <h3 className="text-[#2B3674] font-bold text-sm mb-4">
                Upcoming Birthdays ({upcomingBirthdays.length})
              </h3>

              {upcomingBirthdays.length === 0 ? (
                <p className="text-xs text-gray-400">No upcoming birthdays in 30 days</p>
              ) : (
                <div className="flex items-center ml-2">
                  {upcomingBirthdays.map((b, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold -ml-2 first:ml-0 ${pickColor(b.name)}`}
                      title={`${b.name} — ${b.role}`}
                    >
                      {getInitials(b.name)}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
// --- END OF FILE AdminDashboard.jsx ---