// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
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
  FaChartLine,
  FaFileSignature,
  // FontAwesome Icons for consistency
  FaBuilding,
  FaLaptop,
  FaClock,
  FaClipboardList,
  FaMapMarkerAlt,
  FaReceipt,
  FaCalendarDay,
  FaGift
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
  Sector,
  LabelList
} from "recharts";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import { HolidayCalendarContext } from "../context/HolidayCalendarContext";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees,
  getAdminWorkRecords,
  getFieldTrackingEmployees,
  getRecentFieldTrips,
  getAllExpenses
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
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [allResignations, setAllResignations] = useState([]);
  const [employeeWorkModes, setEmployeeWorkModes] = useState({});

  // --- Version 2.0 States ---
  const [todayWorkRecords, setTodayWorkRecords] = useState([]);
  const [trackingEmployees, setTrackingEmployees] = useState([]);
  const [fieldTrips, setFieldTrips] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState([]);

  // --- Individual Loading Skeletons ---
  const [loadingWork, setLoadingWork] = useState(true);
  const [loadingField, setLoadingField] = useState(true);
  const [loadingLate, setLoadingLate] = useState(true);
  const [loadingOperations, setLoadingOperations] = useState(true);

  // --- Holiday Context Consumption ---
  const { holidays } = useContext(HolidayCalendarContext);

  // --- Graph State ---
  const [viewMode, setViewMode] = useState("week"); // 'week' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentWeek, setCurrentWeek] = useState(0);
  const [chartRawData, setChartRawData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  // --- Pie Chart Hover State ---
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pieAnimationActive, setPieAnimationActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPieAnimationActive(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1); // Reset back to default (100% total)
  };

  // --- Window Resize and Pie sizing ---
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pieSize = useMemo(() => {
    if (windowWidth < 640) return 160; // Mobile
    if (windowWidth < 1024) return 180; // Tablet (wide)
    if (windowWidth < 1280) return 140; // lg (narrow)
    if (windowWidth < 1536) return 150; // xl (narrower than 2xl)
    return 180; // 2xl (wide)
  }, [windowWidth]);

  const { innerRadius, outerRadius } = useMemo(() => {
    switch (pieSize) {
      case 140:
        return { innerRadius: 45, outerRadius: 62 };
      case 150:
        return { innerRadius: 50, outerRadius: 68 };
      case 160:
        return { innerRadius: 52, outerRadius: 72 };
      case 180:
      default:
        return { innerRadius: 60, outerRadius: 80 };
    }
  }, [pieSize]);

  // Context-based stat cards
  const { statCards } = useMemo(
    () => getDashboardData(ctxEmployees, ctxLeaveRequests), [ctxEmployees, ctxLeaveRequests, getDashboardData]
  );

  // ── Fetch General Dashboard Data ──────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];

    // Set loading states to true
    setLoadingWork(true);
    setLoadingField(true);
    setLoadingLate(true);
    setLoadingOperations(true);

    const fetchGeneral = async () => {
      try {
        const [todayAtt, leavesData, empData, resignationData, profileRes] = await Promise.all([
          getAttendanceByDateRange(today, today).catch(() => []),
          getLeaveRequests().catch(() => []),
          getEmployees().catch(() => []),
          api.get("/api/resignations/admin/all").catch(() => ({ data: [] })),
          api.get("/api/admin/profile").catch(() => null)
        ]);

        setTodayAttendance(Array.isArray(todayAtt) ? todayAtt : []);
        setAllLeaves(Array.isArray(leavesData) ? leavesData : []);
        setAllEmployees(Array.isArray(empData) ? empData : []);
        setAllResignations(Array.isArray(resignationData.data) ? resignationData.data : []);
        if (profileRes && profileRes.data) {
          setProfile(profileRes.data);
        }
      } catch (err) {
        console.error("General dashboard fetch error:", err);
      }
    };

    const fetchWork = async () => {
      try {
        const res = await getAdminWorkRecords({ start_date: today, end_date: today });
        setTodayWorkRecords(res.data || []);
      } catch (err) {
        console.error("Work records fetch error:", err);
        setTodayWorkRecords([]);
      } finally {
        setLoadingWork(false);
      }
    };

    const fetchField = async () => {
      try {
        const [trackingRes, tripsRes] = await Promise.all([
          getFieldTrackingEmployees({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
          getRecentFieldTrips(100).catch(() => ({ data: [] }))
        ]);
        setTrackingEmployees(trackingRes.data || []);
        setFieldTrips(tripsRes.data || []);
      } catch (err) {
        console.error("Field tracking fetch error:", err);
        setTrackingEmployees([]);
        setFieldTrips([]);
      } finally {
        setLoadingField(false);
      }
    };

    const fetchLate = async () => {
      try {
        const res = await api.get("/api/attendance/all");
        setAllAttendanceRecords(res.data?.data || []);
      } catch (err) {
        console.error("Late requests fetch error:", err);
        setAllAttendanceRecords([]);
      } finally {
        setLoadingLate(false);
      }
    };

    const fetchOperations = async () => {
      try {
        const res = await getAllExpenses();
        setAllExpenses(res.data || []);
      } catch (err) {
        console.error("Expenses fetch error:", err);
        setAllExpenses([]);
      } finally {
        setLoadingOperations(false);
      }
    };

    // Run parallelized tasks
    await Promise.all([
      fetchGeneral(),
      fetchWork(),
      fetchField(),
      fetchLate(),
      fetchOperations()
    ]);

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
    } catch (err) {
      console.warn("AdminDashboard work mode fetch skipped:", err?.message || err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
          dob: e.personalDetails.dob,
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

  // ── Derived Data: Version 2.0 Stats ───────────────────────────────────────
  const todayDayName = useMemo(() => {
    const today = new Date();
    return viewMode === 'week'
      ? today.toLocaleDateString('en-US', { weekday: 'short' })
      : today.getDate().toString();
  }, [viewMode]);

  const processedChartData = useMemo(() => {
    return weeklyChartData.map(d => {
      const total = d.Present + d.Absent;
      const pct = total > 0 ? Math.round((d.Present / total) * 100) : 0;
      return {
        ...d,
        percentage: pct
      };
    });
  }, [weeklyChartData]);

  const graphStats = useMemo(() => {
    const validDays = processedChartData.filter(d => (d.Present + d.Absent) > 0);
    if (validDays.length === 0) {
      return { avg: 0, highest: "N/A", lowest: "N/A" };
    }

    let sumPct = 0;
    let highestPct = -1;
    let highestDay = "";
    let lowestPct = 101;
    let lowestDay = "";

    validDays.forEach(d => {
      sumPct += d.percentage;
      if (d.percentage > highestPct) {
        highestPct = d.percentage;
        highestDay = d.name;
      }
      if (d.percentage < lowestPct) {
        lowestPct = d.percentage;
        lowestDay = d.name;
      }
    });

    return {
      avg: Math.round(sumPct / validDays.length),
      highest: highestDay ? `${highestDay} (${highestPct}%)` : "N/A",
      lowest: lowestDay ? `${lowestDay} (${lowestPct}%)` : "N/A"
    };
  }, [processedChartData]);

  // Work Tracker Summary Metrics
  const workTrackerStats = useMemo(() => {
    const expected = activeEmployees.length;
    const morning = todayWorkRecords.length;
    const evening = todayWorkRecords.filter(r => r.evening_time || r.evening_description).length;
    const pending = todayWorkRecords.filter(r => r.status === "pending").length;
    const completionPct = expected > 0 ? Math.round((morning / expected) * 100) : 0;

    return { expected, morning, evening, pending, completionPct };
  }, [todayWorkRecords, activeEmployees]);

  // Attendance vs Reports Metrics
  const comparisonStats = useMemo(() => {
    const attendance = todayPresent.length;
    const reports = todayWorkRecords.length;
    const missing = Math.max(0, attendance - reports);
    const completionPct = attendance > 0 ? Math.round((reports / attendance) * 100) : 0;

    return { attendance, reports, missing, completionPct };
  }, [todayPresent, todayWorkRecords]);

  // Field Work Status Metrics
  const fieldWorkStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const active = trackingEmployees.filter(emp => emp.isFieldLive).length;
    const completed = fieldTrips.filter(trip => {
      if (trip.status !== "completed") return false;
      const tripDate = trip.startedAt ? new Date(trip.startedAt).toISOString().split('T')[0] : "";
      return tripDate === today;
    }).length;
    const pending = Math.max(0, trackingEmployees.length - active - completed);

    return { active, completed, pending };
  }, [trackingEmployees, fieldTrips]);

  // Late Correction Requests Metrics
  const lateRequestsStats = useMemo(() => {
    let pending = 0;
    let approvedToday = 0;
    let rejectedToday = 0;
    const today = new Date().toISOString().split("T")[0];

    allAttendanceRecords.forEach(emp => {
      if (emp.attendance) {
        emp.attendance.forEach(day => {
          if (day.lateCorrectionRequest?.hasRequest) {
            const reqStatus = day.lateCorrectionRequest.status;
            if (reqStatus === "PENDING") {
              pending++;
            } else if (reqStatus === "APPROVED" && day.date === today) {
              approvedToday++;
            } else if (reqStatus === "REJECTED" && day.date === today) {
              rejectedToday++;
            }
          }
        });
      }
    });

    return { pending, approvedToday, rejectedToday };
  }, [allAttendanceRecords]);

  // List of all Late Correction Requests
  const allLateRequestsList = useMemo(() => {
    const list = [];
    allAttendanceRecords.forEach(emp => {
      if (emp.attendance) {
        emp.attendance.forEach(day => {
          if (day.lateCorrectionRequest?.hasRequest) {
            const empInfo = activeEmployees.find(e => e.employeeId === emp.employeeId) || {};
            list.push({
              employeeId: emp.employeeId,
              name: empInfo.name || emp.employeeId,
              date: day.date,
              reason: day.lateCorrectionRequest.reason || "Late punch-in correction",
              status: day.lateCorrectionRequest.status,
              requestedAt: day.lateCorrectionRequest.requestedAt,
              dayLog: day
            });
          }
        });
      }
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allAttendanceRecords, activeEmployees]);

  // Today's Operations Card Metrics
  const operationsStats = useMemo(() => {
    const workReports = workTrackerStats.morning;
    const expenseClaims = allExpenses.filter(e => e.status === "Pending").length;
    const fieldVisits = fieldWorkStats.active + fieldWorkStats.completed;
    const lateRequests = lateRequestsStats.pending;

    return { workReports, expenseClaims, fieldVisits, lateRequests };
  }, [workTrackerStats, allExpenses, fieldWorkStats, lateRequestsStats]);

  // Upcoming Holidays (filtered for future and non-Sundays)
  const upcomingHolidays = useMemo(() => {
    if (!holidays) return [];
    const todayStr = new Date().toISOString().split("T")[0];
    return holidays
      .filter(h => h.date >= todayStr && h.name !== "Sunday" && h.description !== "Weekly holiday")
      .slice(0, 5)
      .map(h => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const holDate = new Date(h.date);
        holDate.setHours(0, 0, 0, 0);
        const diffTime = holDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...h,
          daysRemaining: diffDays,
        };
      });
  }, [holidays]);

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

  const showBirthdayProfile = (b) => {
    const formattedDob = b.dob
      ? new Date(b.dob).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "Not specified";

    const initials = getInitials(b.name);

    const colorMap = {
      "bg-blue-500": "#3b82f6",
      "bg-purple-500": "#a855f7",
      "bg-green-500": "#22c55e",
      "bg-yellow-500": "#eab308",
      "bg-red-500": "#ef4444",
      "bg-indigo-500": "#6366f1",
      "bg-teal-500": "#14b8a6",
      "bg-pink-500": "#ec4899",
    };
    const classColor = pickColor(b.name);
    const hexColor = colorMap[classColor] || "#6366f1";

    Swal.fire({
      html: `
        <div style="font-family: 'Outfit', 'Inter', sans-serif; text-align: center; padding: 10px 5px;">
          <!-- Header Profile Circle -->
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; color: white; font-size: 28px; font-weight: 800; border-radius: 50%; margin-bottom: 16px; border: 4px solid #f1f5f9; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background: ${hexColor};">
            ${initials}
          </div>
          
          <!-- Name and Role -->
          <h2 style="font-size: 20px; font-weight: 900; color: #1e293b; margin: 0 0 4px 0; letter-spacing: -0.025em;">
            ${b.name}
          </h2>
          <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; padding: 4px 12px; border-radius: 9999px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em;">
            ${b.role}
          </span>
          
          <!-- Information Fields -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; text-align: left; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #f0fdf4; color: #15803d; border-radius: 8px; font-size: 14px;">
                🎉
              </div>
              <div>
                <span style="display: block; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                  DATE OF BIRTH
                </span>
                <span style="font-size: 13px; font-weight: 700; color: #334155;">
                  ${formattedDob}
                </span>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #eff6ff; color: #1d4ed8; border-radius: 8px; font-size: 14px;">
                💼
              </div>
              <div>
                <span style="display: block; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                  DEPARTMENTAL ROLE
                </span>
                <span style="font-size: 13px; font-weight: 700; color: #334155;">
                  ${b.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'Dismiss',
      confirmButtonColor: '#6366f1',
      customClass: {
        popup: 'rounded-3xl shadow-2xl border border-slate-100 p-6',
        confirmButton: 'px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg hover:shadow-xl transition-all'
      },
      buttonsStyling: true
    });
  };

  // ==========================================
  // 3. HELPER RENDERING FUNCTIONS
  // ==========================================

  // Workforce Summary (Top Cards)
  const renderWorkforceSummary = () => {
    const isLoading = allEmployees.length === 0;
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse bg-white/70 backdrop-blur-md rounded-[20px] p-4 sm:p-5 h-[110px] sm:h-[130px] border border-gray-100/50 flex flex-col justify-between">
              <div className="h-9 w-9 sm:h-11 sm:w-11 bg-slate-200 rounded-xl"></div>
              <div className="space-y-1.5 mt-2 sm:mt-4">
                <div className="h-2.5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-5 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const presentCount = todayPresent.length;
    const wfhCount = remoteWorkers.length;
    const wfoCount = Math.max(0, presentCount - wfhCount);

    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-8 animate-fade-in">
        {/* Total Employees */}
        <div className="relative bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[20px] p-4 sm:p-5 shadow-lg overflow-hidden h-[110px] sm:h-[130px] flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group">
          <div className="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white opacity-10 transition-transform group-hover:scale-110"></div>
          <div className="absolute right-2 top-8 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white opacity-10"></div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white text-base sm:text-xl z-10">
            <FaUsers />
          </div>
          <div className="z-10 text-white">
            <p className="text-[10px] sm:text-xs font-semibold opacity-85 uppercase tracking-wider">Total Employees</p>
            <h3 className="text-xl sm:text-3xl font-bold tracking-tight mt-0.5">
              {activeEmployees.length || statCards.totalEmployees}
            </h3>
          </div>
        </div>

        {/* Today Present */}
        <Link
          to="/admin/today-overview"
          className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgb(0,0,0,0.035)] cursor-pointer group flex flex-col justify-between h-[110px] sm:h-[130px]"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-blue-50/50 rounded-xl flex items-center justify-center text-blue-550 text-base sm:text-xl">
            <FaLaptopCode />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Today Present</p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-[#2B3674] tracking-tight mt-0.5">
              {presentCount} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">Active</span>
            </h3>
          </div>
        </Link>

        {/* WFO Today */}
        <Link
          to="/admin/today-overview"
          className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgb(0,0,0,0.035)] cursor-pointer group flex flex-col justify-between h-[110px] sm:h-[130px]"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-indigo-50/50 rounded-xl flex items-center justify-center text-indigo-500 text-base sm:text-xl">
            <FaBuilding />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">WFO Today</p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-[#2B3674] tracking-tight mt-0.5">
              {wfoCount} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">Present</span>
            </h3>
          </div>
        </Link>

        {/* WFH Today */}
        <Link
          to="/admin/today-overview"
          className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgb(0,0,0,0.035)] cursor-pointer group flex flex-col justify-between h-[110px] sm:h-[130px]"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-purple-50/50 rounded-xl flex items-center justify-center text-purple-500 text-base sm:text-xl">
            <FaLaptop />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">WFH Today</p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-[#2B3674] tracking-tight mt-0.5">
              {wfhCount} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">Remote</span>
            </h3>
          </div>
        </Link>

        {/* Today Absent */}
        <Link
          to="/admin/today-overview"
          className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgb(0,0,0,0.035)] cursor-pointer group flex flex-col justify-between h-[110px] sm:h-[130px]"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-red-50/50 rounded-xl flex items-center justify-center text-red-500 text-sm sm:text-lg">
            <FaFileAlt />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Today Absent</p>
            <h3 className="text-xl sm:text-3xl font-bold text-[#2B3674] tracking-tight mt-0.5">{todayAbsentCount}</h3>
          </div>
        </Link>

        {/* Leave Requests */}
        <div
          onClick={() => navigate("/admin/admin-Leavemanage")}
          className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_40px_rgb(0,0,0,0.035)] cursor-pointer group flex flex-col justify-between h-[110px] sm:h-[130px]"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-amber-50/50 rounded-xl flex items-center justify-center text-amber-500 text-sm sm:text-lg">
            <FaPlane />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Leave Requests</p>
            <h3 className="text-xl sm:text-3xl font-bold text-[#2B3674] tracking-tight mt-0.5">{totalPendingLeavesCount}</h3>
          </div>
        </div>
      </div>
    );
  };

  // Attendance Graph Section
  const renderAttendanceChart = () => {
    if (loadingGraph) {
      return (
        <div className="bg-[#111C44] rounded-[24px] p-4 sm:p-6 shadow-xl h-[340px] sm:h-[360px] flex flex-col items-center justify-center text-white opacity-60">
          <div className="animate-pulse flex flex-col items-center gap-4 w-full px-4">
            <div className="h-6 bg-slate-700 rounded w-1/3 self-start mb-6"></div>
            <div className="h-40 bg-slate-700 rounded w-full"></div>
          </div>
        </div>
      );
    }

    if (weeklyChartData.length === 0) {
      return (
        <div className="bg-[#111C44] rounded-[24px] p-4 sm:p-6 shadow-xl h-[340px] sm:h-[360px] flex flex-col items-center justify-center text-white/50 text-sm">
          <FaCalendarAlt size={36} className="mb-3 opacity-40 text-[#39B8FF]" />
          <span>No attendance data available</span>
        </div>
      );
    }

    return (
      <div className="bg-[#111C44] rounded-[24px] p-4 sm:p-6 shadow-xl flex flex-col justify-between h-full min-h-[340px] sm:min-h-[360px] animate-fade-in">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div>
            <h3 className="text-white font-bold text-lg">
              {viewMode === 'week' ? "Weekly Attendance" : "Monthly Attendance"}
            </h3>
            {processedChartData.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#39B8FF] font-bold uppercase tracking-wider mt-1">
                <span>Avg: {graphStats.avg}%</span>
                <span>Peak: {graphStats.highest}</span>
                <span>Trough: {graphStats.lowest}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="bg-[#1B254B] text-white text-xs border border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>

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
                className="bg-[#1B254B] text-white text-xs border border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            )}
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-[250px] min-h-[250px] w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedChartData} barGap={4}>
              <defs>
                <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
                <linearGradient id="pGradToday" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.08)"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 600 }}
                dy={6}
                interval={viewMode === 'month' ? 2 : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 9 }}
              />

              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const present = data.Present || 0;
                    const absent = data.Absent || 0;
                    const total = present + absent;
                    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

                    return (
                      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-3 shadow-xl backdrop-blur-md text-white font-sans text-xs min-w-[150px]">
                        <p className="font-extrabold text-[12px] mb-2 text-[#38bdf8] border-b border-slate-700 pb-1">{label}</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Present:</span>
                            <span className="font-bold text-emerald-400">{present} ({rate}%)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Absent:</span>
                            <span className="font-bold text-rose-400">{absent}</span>
                          </div>
                          <div className="h-px bg-slate-700 my-1"></div>
                          <div className="flex items-center justify-between">
                            <span className="text-indigo-300 font-semibold">Attendance Rate:</span>
                            <span className="font-black text-[#38bdf8]">{rate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar
                dataKey="Present"
                radius={[4, 4, 0, 0]}
                barSize={viewMode === 'month' ? 4 : 8}
              >
                {processedChartData.map((entry, index) => {
                  const isToday = entry.name === todayDayName;
                  return <Cell key={`cell-${index}`} fill={isToday ? "url(#pGradToday)" : "url(#pGrad)"} />;
                })}
                <LabelList
                  dataKey="percentage"
                  position="top"
                  content={(props) => {
                    const { x, y, width, value } = props;
                    if (value === undefined || value === null || value === 0) return null;
                    return (
                      <text x={x + width / 2} y={y - 6} fill="#38bdf8" fontSize={8} fontWeight="bold" textAnchor="middle">
                        {value}%
                      </text>
                    );
                  }}
                />
              </Bar>
              <Bar
                dataKey="Absent"
                fill="url(#aGrad)"
                radius={[4, 4, 0, 0]}
                barSize={viewMode === 'month' ? 4 : 8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Department Distribution (Pie Chart)
  const renderDepartmentDistribution = () => {
    if (departmentData.length === 0) {
      return (
        <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-4 sm:p-6 shadow-sm border border-white/50 h-[340px] sm:h-[360px] flex flex-col items-center justify-center text-gray-400">
          <FaChartPie size={36} className="mb-2 opacity-30 text-indigo-500" />
          <span>No department data</span>
        </div>
      );
    }

    return (
      <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 flex flex-col justify-between h-full min-h-[340px] sm:min-h-[360px] animate-fade-in transition-all duration-200">
        <h3 className="text-[#2B3674] font-bold text-lg mb-2 shrink-0">
          Employee Distribution
        </h3>

        <div className="flex flex-col items-center justify-center gap-5 w-full overflow-hidden">
          {/* PieChart Wrapper */}
          <div
            className="relative shrink-0 flex items-center justify-center bg-white/20 rounded-full"
            style={{ width: pieSize, height: pieSize }}
          >
            <PieChart width={pieSize} height={pieSize}>
              <Pie
                data={departmentData}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                isAnimationActive={pieAnimationActive}
              >
                {departmentData.map((dept, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={COLORS[i % COLORS.length]}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate("/employees")}
                  />
                ))}
              </Pie>
            </PieChart>

            {/* Center text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="text-[#2B3674] font-black leading-none mb-0.5"
                style={{ fontSize: pieSize >= 180 ? '1.25rem' : pieSize >= 150 ? '1.1rem' : '0.95rem' }}
              >
                {activeIndex === -1 || departmentData.length === 0
                  ? activeEmployees.length
                  : departmentData[activeIndex].value}
              </span>
              <span
                className="text-gray-450 font-bold truncate text-center"
                style={{
                  fontSize: pieSize >= 180 ? '10px' : '9px',
                  maxWidth: pieSize >= 180 ? '100px' : pieSize >= 150 ? '80px' : '70px'
                }}
              >
                {activeIndex === -1 || departmentData.length === 0
                  ? "Employees"
                  : departmentData[activeIndex].name}
              </span>
              <span className="text-[9px] text-[#4318FF] font-bold leading-none mt-0.5">
                {activeIndex === -1 || departmentData.length === 0
                  ? "100%"
                  : `${((departmentData[activeIndex].value / totalEmployeesCount) * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>

          {/* Dynamic Scrollable Legend Panel below the Pie Chart */}
          <div className="w-full min-w-0 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar internal-scroll">
            <div className="grid grid-cols-2 gap-2">
              {departmentData.map((dept, idx) => {
                const isHovered = activeIndex === idx;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onClick={() => navigate("/employees")}
                    className={`flex items-center justify-between p-1.5 rounded-xl border transition-all duration-150 cursor-pointer ${isHovered ? "bg-slate-100/80 border-slate-200" : "bg-slate-50/30 border-slate-100/50 hover:bg-slate-50/70"
                      }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-[11px] font-bold text-slate-700 truncate">{dept.name}</span>
                    </div>
                    <span className="text-[9px] font-extrabold text-slate-500 shrink-0 bg-slate-100/50 px-1.5 py-0.5 rounded">
                      {dept.value} ({((dept.value / totalEmployeesCount) * 100).toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Percentage Bar */}
        <div className="mt-4 bg-[#F4F7FE] rounded-full h-3 w-full flex overflow-hidden shrink-0">
          {departmentData.map((dept, idx) => {
            const percentage = ((dept.value / totalEmployeesCount) * 100).toFixed(0);
            if (percentage === "0") return null;
            return (
              <div
                key={idx}
                className="flex items-center justify-center text-[8px] text-white font-bold transition-all duration-300 cursor-pointer"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: COLORS[idx % COLORS.length]
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(-1)}
                onClick={() => navigate("/employees")}
                title={`${dept.name}: ${percentage}%`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Work Tracker Summary Widget
  const renderWorkTracker = () => {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-4 sm:p-6 shadow-sm border border-white/50 w-full animate-fade-in">
        <h3 className="text-[#2B3674] font-bold text-lg mb-6 flex items-center gap-2">
          <FaClipboardList className="text-[#4318FF]" /> Operations & Tracker Summary
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sub-Widget 1: Daily Work Reports */}
          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Work Tracker</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {workTrackerStats.completionPct}% Complete
                </span>
              </div>
              <p className="text-sm font-black text-slate-800 mb-4">Daily Work Reports</p>
            </div>

            {loadingWork ? (
              <div className="animate-pulse space-y-3">
                <div className="h-2.5 bg-slate-200 rounded w-full"></div>
                <div className="h-2.5 bg-slate-200 rounded w-full"></div>
                <div className="h-2.5 bg-slate-200 rounded w-full"></div>
              </div>
            ) : todayWorkRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-400">
                <span className="text-2xl mb-1">📭</span>
                <p className="font-bold">No Reports Submitted</p>
                <p className="text-[10px]">Encourage team to log report.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Morning reports */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>Morning Reports</span>
                    <span>{workTrackerStats.morning} / {workTrackerStats.expected}</span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (workTrackerStats.morning / (workTrackerStats.expected || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Evening reports */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>Evening Reports</span>
                    <span>{workTrackerStats.evening} / {workTrackerStats.expected}</span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (workTrackerStats.evening / (workTrackerStats.expected || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Pending reports */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>Pending Reports</span>
                    <span>{workTrackerStats.pending}</span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (workTrackerStats.pending / (workTrackerStats.morning || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Widget 2: Attendance vs Reports */}
          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sync Ratio</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {comparisonStats.completionPct}% Synced
                </span>
              </div>
              <p className="text-sm font-black text-slate-800 mb-4">Attendance vs Reports</p>
            </div>

            {loadingWork ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : comparisonStats.attendance === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-400">
                <span className="text-2xl mb-1">⏰</span>
                <p className="font-bold">No Attendance Recorded</p>
                <p className="text-[10px]">No comparisons to display.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-semibold">Morning Attendance</span>
                  <span className="text-xs font-extrabold text-[#2B3674] bg-indigo-50 px-2.5 py-0.5 rounded-md">{comparisonStats.attendance}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-semibold">Morning Reports</span>
                  <span className="text-xs font-extrabold text-[#2B3674] bg-emerald-50 px-2.5 py-0.5 rounded-md">{comparisonStats.reports}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-slate-500 font-semibold">Missing Reports</span>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md ${comparisonStats.missing > 0 ? "text-rose-600 bg-rose-50 border border-rose-100" : "text-emerald-600 bg-emerald-50"
                    }`}>{comparisonStats.missing}</span>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Widget 3: Field Work Status */}
          <div
            onClick={() => navigate("/admin/field-tracking")}
            className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all duration-200 group"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field Tracking</span>
                <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                  Manage →
                </span>
              </div>
              <p className="text-sm font-black text-slate-800 mb-4">Field Work Status</p>
            </div>

            {loadingField ? (
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-slate-200 rounded w-full"></div>
              </div>
            ) : trackingEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-400">
                <span className="text-2xl mb-1">🚗</span>
                <p className="font-bold">No Field Work Today</p>
                <p className="text-[10px]">No workers in tracking mode.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Active */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-[#047857]">Active Trips</span>
                  </div>
                  <span className="text-sm font-black text-emerald-900">{fieldWorkStats.active}</span>
                </div>
                {/* Completed */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/60 border border-indigo-100/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span className="text-xs font-bold text-indigo-800">Completed Today</span>
                  </div>
                  <span className="text-sm font-black text-indigo-900">{fieldWorkStats.completed}</span>
                </div>
                {/* Pending */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/60 border border-amber-100/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-xs font-bold text-amber-800">Pending Trips</span>
                  </div>
                  <span className="text-sm font-black text-amber-900">{fieldWorkStats.pending}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Today's Operations Card
  const renderOperations = () => {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-4 sm:p-6 shadow-sm border border-white/50 animate-fade-in">
        <h3 className="text-[#2B3674] font-bold text-lg mb-4 flex items-center gap-2">
          <FaSyncAlt className="text-[#4318FF]" /> Today's Operations
        </h3>

        {loadingOperations || loadingWork || loadingField || loadingLate ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <FaClipboardList className="text-xs text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Work Reports</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400 font-semibold">Submitted</span>
                <span className="text-xl font-black text-[#2B3674]">{operationsStats.workReports}</span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <FaReceipt className="text-xs text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Expense Claims</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400 font-semibold">Pending</span>
                <span className="text-xl font-black text-[#2B3674]">{operationsStats.expenseClaims}</span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <FaMapMarkerAlt className="text-xs text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Field Visits</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400 font-semibold">Visits</span>
                <span className="text-xl font-black text-[#2B3674]">{operationsStats.fieldVisits}</span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <FaClock className="text-xs text-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Late Requests</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-400 font-semibold">Pending</span>
                <span className="text-xl font-black text-[#2B3674]">{operationsStats.lateRequests}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Upcoming Holidays Section
  const renderHolidays = () => {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-4 sm:p-6 shadow-sm border border-white/50 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[#2B3674] font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
            <FaCalendarDay className="text-[#4318FF] text-xs" /> Upcoming Holidays
          </h3>
          <button
            onClick={() => navigate("/admin/holiday-calendar")}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition"
          >
            View Calendar →
          </button>
        </div>

        {upcomingHolidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100/50">
            <span className="text-2xl mb-1">📭</span>
            <p className="font-bold">No Upcoming Holidays</p>
            <p className="text-[10px] opacity-80">Enjoy your work week.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingHolidays.map((hol, idx) => {
              const dateObj = new Date(hol.date);
              const dayStr = dateObj.toLocaleDateString("en-US", { day: "numeric", month: "short" });
              return (
                <div
                  key={hol.id || idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-slate-100/40 transition duration-150"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{hol.name}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">{hol.description || "Holiday"}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {dayStr}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">
                      {hol.daysRemaining === 0 ? "Today" : `${hol.daysRemaining} days left`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Late Login Requests Widget
  const renderLateRequests = () => {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-[24px] p-4 sm:p-6 shadow-sm border border-white/50 w-full animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[#2B3674] font-bold text-lg flex items-center gap-2">
            <FaClock className="text-[#4318FF]" /> Late Login Requests
          </h3>
          <button
            onClick={() => navigate("/admin/late-requests")}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
          >
            View All →
          </button>
        </div>

        {loadingLate ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-slate-200 rounded-xl"></div>
            <div className="h-12 bg-slate-200 rounded-xl"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats summary block */}
            <div className="lg:col-span-1 flex flex-col justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Request Stats</span>
                <p className="text-sm font-black text-slate-800 mb-4">Today's Summary</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between bg-[#FFF9E6] border border-[#FFEBA6] px-3.5 py-2 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending</span>
                  <span className="text-sm font-black text-amber-700">{lateRequestsStats.pending}</span>
                </div>
                <div className="flex items-center justify-between bg-[#EBFBF5] border border-[#B3F3D8] px-3.5 py-2 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved</span>
                  <span className="text-sm font-black text-emerald-700">{lateRequestsStats.approvedToday}</span>
                </div>
                <div className="flex items-center justify-between bg-[#FFF0F0] border border-[#FFCCD3] px-3.5 py-2 rounded-xl animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Rejected</span>
                  <span className="text-sm font-black text-rose-700">{lateRequestsStats.rejectedToday}</span>
                </div>
              </div>
            </div>

            {/* Recent requests list block */}
            <div className="lg:col-span-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">Recent Requests</span>
              {allLateRequestsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-400 bg-slate-50/30 rounded-2xl border border-slate-100/50 h-[80px]">
                  <p className="font-bold">No Late Requests Found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allLateRequestsList.slice(0, 3).map((req, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#F9FAFD] border border-gray-100 rounded-xl hover:border-indigo-100 transition duration-150">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#2B3674] truncate">{req.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                          Date: {req.date} | {req.reason}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 ${req.status === "PENDING" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                          req.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                            "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full font-sans text-gray-800 overflow-hidden flex flex-col"
      style={{ height: "calc(100vh - 70px)" }} // Adjust this 70px offset if your layout header is taller/shorter
    >

      {/* ================= INJECT CUSTOM CSS FOR SCROLLBAR & ANIMATIONS ================= */}
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

        /* Subtle Fade In Animation */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ================= MAIN CONTENT (Internally Scrollable Area) ================= */}
      <div className="relative z-10 w-full h-full overflow-y-auto p-4 sm:p-6 pb-20 internal-scroll">

        {(() => {
          const planExpiry = profile?.planExpiresAt ? new Date(profile.planExpiresAt) : null;
          const isFreePlan = profile?.plan ? profile.plan.toLowerCase().includes("free") : true;
          const isGracePeriod = !isFreePlan && planExpiry && new Date() > planExpiry && new Date() <= new Date(planExpiry.getTime() + 7 * 24 * 60 * 60 * 1000);
          const daysLeftInGrace = planExpiry ? Math.ceil((new Date(planExpiry.getTime() + 7 * 24 * 60 * 60 * 1000) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

          if (!isGracePeriod) return null;

          return (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4 animate-pulse mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-amber-800 text-sm font-black uppercase tracking-wider">Subscription Payment Overdue</p>
                  <p className="text-amber-700 text-xs font-semibold mt-0.5">
                    Your billing date was <strong>{planExpiry ? planExpiry.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "N/A"}</strong>. Please pay your bill within <strong>{daysLeftInGrace} days</strong> to prevent account suspension.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/admin/profile")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl tracking-wider transition-all shadow-md shrink-0 animate-bounce"
              >
                Pay Bill Now
              </button>
            </div>
          );
        })()}

        {/* 1. TOP STATS CARDS */}
        {renderWorkforceSummary()}

        {/* 2. CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Attendance Graph (Dynamic Week/Month) */}
          <div className="lg:col-span-2">
            {renderAttendanceChart()}
          </div>

          {/* Employee Distribution Card */}
          <div className="lg:col-span-1">
            {renderDepartmentDistribution()}
          </div>
        </div>

        {/* 3. MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">

          {/* LEFT COLUMN (Span 2) */}
          <div className="md:col-span-1 xl:col-span-2 flex flex-col gap-8">

            {/* RECENT LEAVE REQUESTS */}
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 transition-all duration-200">
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[18px] bg-slate-50/30 border border-slate-100/50 hover:bg-slate-50/60 transition-all duration-200 cursor-default gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs shrink-0`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#2B3674] truncate">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                            {item.dateLabel}
                          </p>
                        </div>
                      </div>

                      {/* Actions or Status Badge */}
                      <div className="flex items-center justify-end gap-3 sm:ml-auto">
                        {item.status === "Pending" ? (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleApprove(item._id)}
                              className="flex-1 sm:flex-none h-9 sm:w-9 sm:h-9 rounded-xl bg-[#E6F9F3] text-[#05CD99] flex items-center justify-center hover:bg-green-100 transition shadow-sm active:scale-95 animate-[fadeIn_0.15s_ease-out]"
                              title="Approve"
                            >
                              <FaCheck size={14} className="sm:text-xs" />
                              <span className="sm:hidden ml-2 font-bold text-xs uppercase tracking-wider">Approve</span>
                            </button>
                            <button
                              onClick={() => handleReject(item._id)}
                              className="flex-1 sm:flex-none h-9 sm:w-9 sm:h-9 rounded-xl bg-[#FEEFEE] text-[#EE5D50] flex items-center justify-center hover:bg-red-100 transition shadow-sm active:scale-95 animate-[fadeIn_0.15s_ease-out]"
                              title="Reject"
                            >
                              <FaTimes size={14} className="sm:text-xs" />
                              <span className="sm:hidden ml-2 font-bold text-xs uppercase tracking-wider">Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${item.status === "Approved"
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
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 transition-all duration-200">
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[18px] bg-slate-50/30 border border-slate-100/50 hover:bg-slate-50/60 transition-all duration-200 cursor-default gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs shrink-0`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#2B3674] truncate">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
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
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 transition-all duration-200">
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[18px] bg-slate-50/30 border border-slate-100/50 hover:bg-slate-50/60 transition-all duration-200 cursor-default gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${pickColor(item.name)} text-white font-bold flex items-center justify-center text-xs shrink-0`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#2B3674] truncate">
                            {item.name}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({item.role})
                            </span>
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                            Work From Home
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Row 4 (NEW): Work Tracker Widget */}
            {renderWorkTracker()}

            {/* Late Requests widget (Moved to Left Side) */}
            {renderLateRequests()}

          </div>

          {/* RIGHT COLUMN / SIDEBAR (Span 1) */}
          <div className="md:col-span-1 xl:col-span-1 flex flex-col gap-8">

            {/* Today's Operations Card (NEW) */}
            {renderOperations()}

            {/* QUICK ACTIONS - ALL ROUTES UPDATED FROM SIDEBAR MAP */}
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 transition-all duration-200">
              <h3 className="text-[#2B3674] font-bold text-lg mb-4 sm:mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 md:flex md:flex-col gap-3 sm:gap-4">
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
                    className="flex items-center justify-between w-full p-2.5 sm:p-3 rounded-xl border border-slate-100/60 hover:border-slate-200/80 hover:bg-slate-50/50 transition duration-150 bg-white cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${action.bg} flex items-center justify-center text-white text-xs sm:text-sm shrink-0`}
                      >
                        <action.icon />
                      </div>
                      <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-600 truncate">
                        {action.label}
                      </span>
                    </div>
                    <FaChevronRight className="text-gray-300 text-[10px] sm:text-xs shrink-0 hidden sm:block" />
                  </button>
                ))}
              </div>
            </div>

            {/* BIRTHDAYS CARD */}
            <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100/80 rounded-[24px] p-4 sm:p-6 transition-all duration-200">
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
                      <button
                        onClick={() => showBirthdayProfile(b)}
                        className={`w-8 h-8 rounded-full ${pickColor(b.name)} text-white font-bold flex items-center justify-center text-xs shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white`}
                        title="Click to view profile"
                      >
                        {getInitials(b.name)}
                      </button>
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
                    <button
                      key={i}
                      onClick={() => showBirthdayProfile(b)}
                      className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold -ml-2 first:ml-0 ${pickColor(b.name)} focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:scale-105 transition-transform duration-200 shadow-sm cursor-pointer`}
                      title={`${b.name} — ${b.role} (Click to view profile)`}
                    >
                      {getInitials(b.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Holidays widget (NEW) */}
            {renderHolidays()}

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
