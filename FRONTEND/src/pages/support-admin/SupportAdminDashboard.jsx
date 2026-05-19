import React, { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaUsers,
  FaUserClock,
  FaCalendarCheck,
  FaFileAlt,
  FaLaptopCode,
  FaChevronRight,
  FaChevronLeft,
  FaSyncAlt,
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
import { EmployeeContext } from "../../context/EmployeeContext";
import { AttendanceContext } from "../../context/AttendanceContext";
import { LeaveRequestContext } from "../../context/LeaveRequestContext";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees
} from "../../api";
import { AuthContext } from "../../context/AuthContext";

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

const formatWeekRange = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 3}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={10}
    />
  );
};

const SupportAdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const { employees: ctxEmployees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests: ctxLeaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  const [allEmployees, setAllEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [employeeWorkModes, setEmployeeWorkModes] = useState({});

  // Graph State
  const [viewMode, setViewMode] = useState("week");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentWeek, setCurrentWeek] = useState(0);
  const [chartRawData, setChartRawData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  const { statCards } = useMemo(
    () => getDashboardData(ctxEmployees, ctxLeaveRequests), [ctxEmployees, ctxLeaveRequests, getDashboardData]
  );

  const fetchDashboardData = useCallback(async () => {
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

      try {
        const { data } = await api.get("/api/admin/settings/employees-modes");
        if (data?.employees) {
          const modeMap = {};
          data.employees.forEach((e) => {
            modeMap[e.employeeId] = e.currentEffectiveMode || "WFO";
          });
          setEmployeeWorkModes(modeMap);
        }
      } catch (err) {
        console.warn("SupportAdminDashboard work mode fetch skipped:", err?.message || err);
      }
    } catch (err) {
      console.error("SupportAdminDashboard fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.isActive !== false && (e.status || "").toLowerCase() !== "deactive"), [allEmployees]
  );

  const empMap = useMemo(() => {
    const m = {};
    allEmployees.forEach((e) => { m[e.employeeId] = e; });
    return m;
  }, [allEmployees]);

  const weekDates = useMemo(() => {
    const formatDate = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    };

    if (viewMode === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      lastDay.setHours(23, 59, 59, 999);

      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        startDateObj: firstDay,
        endDateObj: lastDay
      };
    }

    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);

    const dayOfWeek = today.getDay();
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

  useEffect(() => {
    const fetchGraph = async () => {
      setLoadingGraph(true);
      try {
        const data = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setChartRawData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching graph data:", error);
        setChartRawData([]);
      } finally {
        setLoadingGraph(false);
      }
    };
    fetchGraph();
  }, [weekDates]);

  const weeklyChartData = useMemo(() => {
    const totalActive = activeEmployees.length || 1;
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

      if (loopDateNormalized > today) {
        data.push({
          name: dayName,
          Present: 0,
          Absent: 0
        });
        continue;
      }

      let presentCount = 0;
      chartRawData.forEach(att => {
        const attDate = att.date
          ? att.date.split("T")[0]
          : (att.punchIn ? new Date(att.punchIn).toISOString().split("T")[0] : null);

        if (attDate === dateStr && att.punchIn) {
          if (activeEmployees.some(e => e.employeeId === att.employeeId)) {
            presentCount++;
          }
        }
      });

      const onLeaveCount = allLeaves.filter(l =>
        l.status === 'Approved' &&
        dateStr >= l.from &&
        dateStr <= l.to
      ).length;

      const absentCount = Math.max(0, totalActive - presentCount - onLeaveCount);

      data.push({
        name: dayName,
        Present: presentCount,
        Absent: absentCount
      });
    }

    return data;
  }, [chartRawData, activeEmployees, allLeaves, weekDates, viewMode]);

  const todayPresent = useMemo(
    () => todayAttendance.filter((a) => !!a.punchIn),
    [todayAttendance]
  );
  const presentIds = useMemo(() => new Set(todayAttendance.map((a) => a.employeeId)), [todayAttendance]);

  const onLeaveTodayList = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
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
  }, [allLeaves, empMap]);

  const onLeaveIds = useMemo(() => new Set(onLeaveTodayList.map((l) => l.employeeId)), [onLeaveTodayList]);

  const todayAbsentCount = useMemo(() => {
    return activeEmployees.filter(
      (e) => !presentIds.has(e.employeeId) && !onLeaveIds.has(e.employeeId)
    ).length;
  }, [activeEmployees, presentIds, onLeaveIds]);

  const departmentData = useMemo(() => {
    const counts = {};
    activeEmployees.forEach((e) => {
      const { department } = getDeptRole(e);
      const deptName = department || "Unassigned";
      counts[deptName] = (counts[deptName] || 0) + 1;
    });

    return Object.keys(counts).map((dept) => ({
      name: dept,
      value: counts[dept],
    }));
  }, [activeEmployees]);

  const COLORS = [
    "#4f46e5",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  return (
    <div
      className="relative w-full font-sans text-gray-800 overflow-hidden flex flex-col"
      style={{ height: "calc(100vh - 70px)" }}
    >
      <style>{`
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

      <div className="relative z-10 w-full h-full overflow-y-auto p-6 pb-20 internal-scroll">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-[24px] p-6 mb-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
          <h2 className="text-2xl font-bold mb-2">Welcome Back, {user?.name || "Support Admin"}!</h2>
          <p className="text-indigo-100 text-sm max-w-xl">
            Here are the operational highlights and team performance statistics for today. You have full access to manage your team under Employee Management.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Employees */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl">
              <FaUsers />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Managed Employees</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {activeEmployees.length}
              </h3>
            </div>
          </div>

          {/* Today Present */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-green-600 text-xl">
              <FaLaptopCode />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Present</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {todayPresent.length}
              </h3>
            </div>
          </div>

          {/* Today Absent */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-red-600 text-xl">
              <FaFileAlt />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Absent</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {todayAbsentCount}
              </h3>
            </div>
          </div>
        </div>

        {/* Charts & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Graph */}
          <div className="lg:col-span-2 bg-[#111C44] rounded-[24px] p-6 shadow-xl flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-white font-bold text-lg">
                  {viewMode === 'week' ? "Weekly Attendance" : "Monthly Attendance"}
                </h3>
                {!loadingGraph && weeklyChartData.length > 0 && (
                  <p className="text-[#39B8FF] text-[10px] font-bold uppercase tracking-wider mt-1">
                    Peak {viewMode === 'week' ? "Day" : "Date"}: {
                      weeklyChartData.reduce((prev, current) => (prev.Present >= current.Present) ? prev : current).name
                    }
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="bg-[#1B254B] text-white text-xs border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>

                {viewMode === 'week' ? (
                  <div className="flex items-center gap-2 bg-[#1B254B] rounded-lg p-1">
                    <button
                      onClick={() => setCurrentWeek(currentWeek - 1)}
                      className="p-1.5 text-white hover:text-indigo-300"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    <span className="text-white text-[10px] min-w-[120px] text-center font-medium">
                      {formatWeekRange(weekDates.start, weekDates.end)}
                    </span>
                    <button
                      onClick={() => setCurrentWeek(currentWeek + 1)}
                      disabled={currentWeek >= 0}
                      className={`p-1.5 ${currentWeek >= 0 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:text-indigo-300'}`}
                    >
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                ) : (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                    className="bg-[#1B254B] text-white text-xs border-none rounded-lg px-3 py-1.5 outline-none"
                  />
                )}
              </div>
            </div>

            <div className="h-[250px] w-full">
              {loadingGraph ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">Loading Data...</div>
              ) : weeklyChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData}>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#fff", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#fff", fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        background: "#111C44",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Present" fill="url(#pGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="Absent" fill="url(#aGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Department distribution */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <h3 className="text-slate-800 font-bold text-lg mb-4">
              Team Distribution
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
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 max-h-[100px] overflow-y-auto no-scrollbar">
              {departmentData.map((dept, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-gray-600 truncate">{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SupportAdminDashboard;
