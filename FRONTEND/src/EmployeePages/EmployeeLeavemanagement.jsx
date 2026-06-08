  // --- START OF FILE EmployeeLeavemanagement.jsx ---

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCalendarAlt, FaChevronDown, FaFilter, FaListUl, FaSyncAlt, FaThLarge } from "react-icons/fa";
import Swal from "sweetalert2"; // ✅ ADDED: SweetAlert import
import ModalWrapper from "../components/ModalWrapper";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import api, {
  getLeaveRequestsForEmployee,
  applyForLeave,
  cancelLeaveRequestById,
  getHolidays,
  getLeaveRequests,
  getEmployees,
  getAttendanceForEmployee,
  getShiftByEmployeeId // ✅ ADDED: To get week off days
} from "../api";

const REASON_LIMIT = 100; // Max characters for reason input

// --- LEAVE YEAR CONFIGURATION ---
const LEAVE_YEAR_START_MONTH = 1; // Jan

// --- HELPER FUNCTIONS ---

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const getCurrentLeaveYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  let startYear;
  if (currentMonth < LEAVE_YEAR_START_MONTH) {
    startYear = currentYear - 1;
  } else {
    startYear = currentYear;
  }

  const startDate = new Date(startYear, LEAVE_YEAR_START_MONTH - 1, 1);
  const endDate = new Date(startYear + 1, LEAVE_YEAR_START_MONTH - 1, 0);

  return { startDate, endDate };
};

const getMonthsForCurrentLeaveYear = () => {
  const { startDate } = getCurrentLeaveYear();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const year = monthDate.getFullYear();
    const month = String(monthDate.getMonth() + 1).padStart(2, '0');
    options.push(`${year}-${month}`);
  }
  return options;
};

const formatMonth = (monthStr) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

const playRequestSound = () => {
  try {
    const audio = new Audio("/sounds/request-button.mp3");
    audio.play().catch(() => {});
  } catch {}
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Timezone safe formatter
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalize = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter) return false;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split('-');
  return date.getFullYear() === parseInt(year) && 
         (date.getMonth() + 1) === parseInt(month);
};

const getMonthFromString = (monthStr) => {
  if (!monthStr) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [year, month] = monthStr.split('-');
  return { year: parseInt(year), month: parseInt(month) };
};

// Convert Date to YYYY-MM-DD for accurate comparison
const toISODateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayOfWeek = (dateStr) => {
  if (!dateStr) return -1;
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay();
};

const parseISODate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const EmployeeLeavemanagement = () => {
  const [user, setUser] = useState(null);
  
  // ✅ ADDED: State for attendance data and unplanned absences
  const [attendanceData, setAttendanceData] = useState([]);
  const [unplannedAbsences, setUnplannedAbsences] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [shiftDetails, setShiftDetails] = useState(null); // ✅ ADDED: For week off days
  const [loadingShift, setLoadingShift] = useState(false);

  // ✅ ADDED: State for dynamic leave policies fetched from backend
  const [leavePolicies, setLeavePolicies] = useState([]);

  // ✅ Admin-controlled feature flags
  // sandwichLeaveEnabled  → if false, no sandwich calc runs anywhere
  // unplannedAbsenceToLOP → if false, unplanned absences are NOT added to LOP
  // carryForwardEnabled   → if true, unused days from prev cycle carry forward
  const [sandwichLeaveEnabled,  setSandwichLeaveEnabled]  = useState(false);
  const [unplannedAbsenceToLOP, setUnplannedAbsenceToLOP] = useState(false);
  const [carryForwardEnabled,   setCarryForwardEnabled]   = useState(false); // ✅ NEW
  
  // ✅ ADDED: State for LOP warning
  const [showLOPWarning, setShowLOPWarning] = useState(false);
  const [LOPWarningDetails, setLOPWarningDetails] = useState({
    pendingLeaves: 0,
    requestedDays: 0,
    willBeLOP: 0
  });
  
  // Use ref to track if data has been loaded
  const dataLoadedRef = useRef({
    leaves: false,
    holidays: false,
    attendance: false,
    allLeaves: false,
    shift: false,
    policy: false // Track policy load
  });

  // --- UPDATED DATE LOGIC: Allow past dates (Present Month or 7 days ago) ---
  const minSelectionDate = useMemo(() => {
    const now = new Date();
    
    // 1. Calculate 7 days ago
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    // 2. Calculate Start of Current Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 3. Take the earlier of the two to be permissible
    const earliestAllowed = sevenDaysAgo < startOfMonth ? sevenDaysAgo : startOfMonth;
    
    // Format to YYYY-MM-DD
    return formatDate(earliestAllowed);
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  
  // Holiday state
  const [holidays, setHolidays] = useState([]);
  const [sandwichLeaves, setSandwichLeaves] = useState([]);

  // All Employees Approved Leaves (For View & Overlap Check)
  const [allApprovedLeaves, setAllApprovedLeaves] = useState([]);
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
  const [unplannedAbsenceView, setUnplannedAbsenceView] = useState("grid");
  
  // Overlap States
  const [overlappingColleagues, setOverlappingColleagues] = useState([]);
  const [expandOverlaps, setExpandOverlaps] = useState(false);

  // Load user from storage
  useEffect(() => {
    const saved = sessionStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  // filters
  const monthOptions = useMemo(() => getMonthsForCurrentLeaveYear(), []);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const statusOptions = ["All", "Pending", "Approved", "Rejected", "Cancelled"];
  const [selectedStatus, setSelectedStatus] = useState("All");

  // table & details
  const [leaveList, setLeaveList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // form / modal
  const [form, setForm] = useState({
    from: "",
    to: "",
    reason: "",
    halfDaySession: "",
    leaveType: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Sandwich leave warning state
  const [sandwichWarning, setSandwichWarning] = useState(null);
  const [showSandwichAlert, setShowSandwichAlert] = useState(false);

  // Stats states
  const [stats, setStats] = useState({
    monthlyAvailable: 0,
    totalLeaveDays: 0,
    normalLeaveDays: 0,
    extraLeaves: 0,
    sandwichLeavesCount: 0,
    sandwichDaysCount: 0,
    pendingLeaves: 0,
    unplannedAbsenceDays: 0,
  });

  // ✅ OPTIMIZED: Function to calculate unplanned absences WITH WEEK OFF & HOLIDAY EXCLUSION
  const calculateUnplannedAbsences = useCallback((attendanceData, holidaysList, leavesList, monthStr, shiftData) => {
    if (!attendanceData.length || !monthStr) {
      setUnplannedAbsences([]);
      return [];
    }
    
    const { year, month } = getMonthFromString(monthStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all dates in selected month up to today
    const datesInMonth = [];
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate && currentDate <= today) {
      datesInMonth.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // ✅ GET WEEK OFF DAYS FROM SHIFT DATA (0 = Sunday, 1 = Monday, etc.)
    const weekOffDays = shiftData?.weeklyOffDays || [0]; // Default to Sunday if no shift data
    
    const absences = [];
    
    datesInMonth.forEach(date => {
      const dateStr = toISODateString(date);
      const dayOfWeek = date.getDay();
      
      // ✅ SKIP if it's a week off (from shift data)
      if (weekOffDays.includes(dayOfWeek)) {
        return; // Don't count week offs as absences
      }
      
      // ✅ SKIP if it's a holiday
      const isHoliday = holidaysList.some(h => {
        const hStart = new Date(h.startDate);
        const hEnd = new Date(h.endDate || h.startDate);
        hStart.setHours(0, 0, 0, 0);
        hEnd.setHours(23, 59, 59, 999);
        return date >= hStart && date <= hEnd;
      });
      
      if (isHoliday) return;
      
      // Check if there's an approved leave for this date
      const hasApprovedLeave = leavesList.some(leave => {
        if (leave.status !== 'Approved') return false;
        const leaveStart = new Date(leave.from);
        const leaveEnd = new Date(leave.to);
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(23, 59, 59, 999);
        return date >= leaveStart && date <= leaveEnd;
      });
      
      if (hasApprovedLeave) return;
      
      // Check attendance record
      const attendanceRecord = attendanceData.find(a => {
        const recordDate = a.date ? new Date(a.date) : null;
        return recordDate && toISODateString(recordDate) === dateStr;
      });
      
      // If no attendance record or status indicates absence
      if (!attendanceRecord) {
        absences.push({
          date: dateStr,
          dateObj: new Date(date),
          reason: "No attendance record found",
          type: "UNPLANNED"
        });
      } else if (attendanceRecord.status === "Absent" || 
                 attendanceRecord.status === "ABSENT" ||
                 attendanceRecord.workedStatus === "Absent") {
        absences.push({
          date: dateStr,
          dateObj: new Date(date),
          reason: "Marked as absent in attendance",
          type: "UNPLANNED"
        });
      }
    });
    
    // ✅ NEW: If admin disabled unplanned-absence-to-LOP, treat as zero absences
    // Absences are still calculated internally but NOT surfaced to affect leave balance
    if (!unplannedAbsenceToLOP) {
      setUnplannedAbsences([]);
      return [];
    }

    setUnplannedAbsences(absences);
    return absences;
  }, [unplannedAbsenceToLOP]);

  // Filtered leave list
  const filteredLeaveList = useMemo(() => {
    return leaveList.filter(leave => {
      const matchesMonth = selectedMonth === "all" || 
        isDateInMonth(leave.from, selectedMonth) || 
        isDateInMonth(leave.to, selectedMonth);
      
      const matchesStatus = selectedStatus === "All" || leave.status === selectedStatus;
      
      return matchesMonth && matchesStatus;
    });
  }, [leaveList, selectedMonth, selectedStatus]);

  // ✅ UPDATED STATS CALCULATION: Fully dynamic from admin leave policy
  // When carryForwardEnabled is ON, effectiveLimit = paidDaysLimit + carriedForwardDays
  useEffect(() => {
    // ── 1. Dynamic leave credit from admin policy ──────────────────────────
    // If carryForwardEnabled and effectiveLimit is returned from the API, use it.
    // Otherwise fall back to paidDaysLimit.
    const totalCredit = leavePolicies.reduce((sum, p) => {
      const limit = carryForwardEnabled && p.effectiveLimit != null
        ? p.effectiveLimit
        : (p.paidDaysLimit || 0);
      return sum + limit;
    }, 0);
    // How many paid days this employee has already used (across all types)
    const totalUsedPaid = leavePolicies.reduce((sum, p) => sum + (p.usedPaidDays || 0), 0);
    // Remaining paid balance — this is the "Leave Balance" shown on the card
    const remainingPaidBalance = Math.max(0, totalCredit - totalUsedPaid);
    // Total carry-forward days across all types (for display in balance card)
    const totalCarriedForward = leavePolicies.reduce((sum, p) => sum + (p.carriedForwardDays || 0), 0);

    // ── 2. Approved days consumed in the selected month ────────────────────
    const approvedLeavesInMonth = filteredLeaveList.filter(leave => leave.status === 'Approved');
    const approvedDaysCount = approvedLeavesInMonth.reduce((total, leave) => {
      return total + calculateLeaveDays(leave.from, leave.to);
    }, 0);

    // ── 3. Sandwich gap days ───────────────────────────────────────────────
    const sandwichGapDays = sandwichLeaves.reduce((total, sandwich) => {
      return total + (sandwich.daysCount || 0);
    }, 0);

    // ── 4. Unplanned absence days ──────────────────────────────────────────
    const unplannedAbsenceDays = unplannedAbsences.length;

    // ── 5. Total consumed (approved + sandwich + unplanned) ────────────────
    const totalConsumed = approvedDaysCount + sandwichGapDays + unplannedAbsenceDays;

    // ── 6. LOP = days consumed beyond the paid balance ─────────────────────
    // If no policy configured yet fall back to 0 so nothing shows as LOP
    const lopDays = totalCredit > 0 ? Math.max(0, totalConsumed - totalCredit) : 0;

    setStats({
      monthlyAvailable: remainingPaidBalance,   // remaining paid days from admin policy
      pendingLeaves: remainingPaidBalance,       // same value — used in LOP warning check
      totalLeaveDays: totalConsumed,
      normalLeaveDays: approvedDaysCount,
      extraLeaves: lopDays,                     // LOP days (beyond policy limit)
      sandwichLeavesCount: sandwichLeaves.length,
      sandwichDaysCount: sandwichGapDays,
      unplannedAbsenceDays: unplannedAbsenceDays,
      // Store totals for the LOP card subtitle and carry-forward display
      totalCredit,
      totalUsedPaid,
      totalCarriedForward,                      // ✅ NEW — for carry-forward badge
    });
  }, [filteredLeaveList, sandwichLeaves, unplannedAbsences, selectedMonth, leavePolicies, carryForwardEnabled]);
  
  const fetchHolidays = useCallback(async () => {
    try {
      const data = await getHolidays();
      const formatted = data.map((h) => ({
        ...h,
        start: normalize(h.startDate),
        end: normalize(h.endDate || h.startDate), 
      }));
      setHolidays(formatted);
      dataLoadedRef.current.holidays = true;
    } catch (err) {
      console.error("Error fetching holidays:", err);
      dataLoadedRef.current.holidays = true;
    }
  }, []);

  // ✅ ADDED: Fetch shift details for week off days
  const fetchShiftDetails = useCallback(async (empId) => {
    if (!empId || dataLoadedRef.current.shift) return;
    
    setLoadingShift(true);
    try {
      const shiftRes = await getShiftByEmployeeId(empId);
      setShiftDetails(shiftRes);
      dataLoadedRef.current.shift = true;
    } catch (err) {
      console.error("Error fetching shift details:", err);
      // Use default if API fails
      setShiftDetails({ weeklyOffDays: [0] }); // Default to Sunday
      dataLoadedRef.current.shift = true;
    } finally {
      setLoadingShift(false);
    }
  }, []);

  // ✅ NEW: Fetch dynamic leave policies from backend
  const fetchLeavePolicies = useCallback(async () => {
    if (dataLoadedRef.current.policy) return;
    try {
      const { data } = await api.get("/api/leaves/balance");
      
      if (data) {
        // API now returns { balance, sandwichLeaveEnabled, unplannedAbsenceToLOP, carryForwardEnabled }
        // Handle both the new shape and the old bare-array shape for backwards compatibility
        if (Array.isArray(data)) {
          // Legacy bare-array response
          setLeavePolicies(data);
        } else {
          setLeavePolicies(Array.isArray(data.balance) ? data.balance : []);
          if (typeof data.sandwichLeaveEnabled  === "boolean") setSandwichLeaveEnabled(data.sandwichLeaveEnabled);
          if (typeof data.unplannedAbsenceToLOP === "boolean") setUnplannedAbsenceToLOP(data.unplannedAbsenceToLOP);
          if (typeof data.carryForwardEnabled   === "boolean") setCarryForwardEnabled(data.carryForwardEnabled); // ✅ NEW
        }
      }
      dataLoadedRef.current.policy = true;
    } catch (err) {
      console.error("Error fetching leave policies:", err);
      dataLoadedRef.current.policy = true;
    }
  }, []);

  // Fetch ALL leaves & Employees for overlap detection and team view
  const fetchAllEmployeesLeaves = useCallback(async () => {
    try {
      const [allLeaves, allEmployees] = await Promise.all([
        getLeaveRequests(),
        getEmployees()
      ]);

      // Create a map of ID -> Name
      const employeeMap = new Map();
      if (Array.isArray(allEmployees)) {
        allEmployees.forEach(emp => {
          employeeMap.set(emp.employeeId, emp.name);
        });
      }

      // Filter only approved leaves and attach names
      const approved = allLeaves
        .filter(l => l.status === 'Approved')
        .map(l => ({
          ...l,
          employeeName: employeeMap.get(l.employeeId) || l.employeeName || "Unknown Employee"
        }));

      setAllApprovedLeaves(approved);
      dataLoadedRef.current.allLeaves = true;
    } catch (err) {
      console.error("Error fetching all leaves/employees:", err);
      dataLoadedRef.current.allLeaves = true;
    }
  }, []);

  // ✅ OPTIMIZED: Fetch attendance data
  const fetchAttendance = useCallback(async (empId) => {
    if (!empId || dataLoadedRef.current.attendance) return;
    
    setLoadingAttendance(true);
    try {
      const attendanceRes = await getAttendanceForEmployee(empId);
      const attendanceData = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes?.data || []);
      setAttendanceData(attendanceData);
      dataLoadedRef.current.attendance = true;
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setAttendanceData([]);
      dataLoadedRef.current.attendance = true;
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  // Fetch individual leaves
  const fetchLeaves = useCallback(async (empId) => {
    if (!empId) {
      setLeaveList([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      let leavesData = [];
      
      if (typeof getLeaveRequestsForEmployee === "function") {
        try {
          const maybeResult = await getLeaveRequestsForEmployee(empId);
          if (Array.isArray(maybeResult)) {
            leavesData = maybeResult;
          }
        } catch (err) {
          console.warn("Failed to fetch leaves via function, trying API directly", err);
        }
      }

      // Fallback to API if function fails
      if (!leavesData.length) {
        const { data } = await api.get(`/api/leaves/${empId}`);
        leavesData = data || [];
      }

      const normalized = leavesData.map((d) => ({
        _id: d._id || d.id,
        from: d.from,
        to: d.to,
        reason: d.reason,
        halfDaySession: d.halfDaySession || d.halfDay || "",
        leaveType: d.leaveType || d.type || "",
        actionDate: d.actionDate || d.action_date || "-",
        requestDate: d.requestDate || d.request_date || d.createdAt || "-",
        approvedBy: d.approvedBy || d.approved_by || "-",
        status: d.status || "Pending",
      }));
      
      setLeaveList(normalized);
      dataLoadedRef.current.leaves = true;
    } catch (err) {
      console.error("Error fetching leaves:", err);
      setError("Failed to load leaves.");
      setLeaveList([]);
      dataLoadedRef.current.leaves = true;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ UPDATED: Fetch all data including shift details & policies
  const fetchAllData = useCallback(async () => {
    if (!user?.employeeId) return;
    
    // Reset loading flags
    dataLoadedRef.current = {
      leaves: false,
      holidays: false,
      attendance: false,
      allLeaves: false,
      shift: false,
      policy: false
    };
    
    try {
      // Fetch in parallel where possible
      await Promise.all([
        fetchLeaves(user.employeeId),
        fetchHolidays(),
        fetchAttendance(user.employeeId),
        fetchAllEmployeesLeaves(),
        fetchShiftDetails(user.employeeId),
        fetchLeavePolicies() // <--- NEW FETCH
      ]);
    } catch (error) {
      console.error("Error fetching all data:", error);
    }
  }, [user, fetchLeaves, fetchHolidays, fetchAttendance, fetchAllEmployeesLeaves, fetchShiftDetails, fetchLeavePolicies]);

  // Initial data load
  useEffect(() => {
    if (user?.employeeId) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  // ✅ UPDATED: Calculate absences when all data is loaded (including shift)
  useEffect(() => {
    if (dataLoadedRef.current.leaves && 
        dataLoadedRef.current.holidays && 
        dataLoadedRef.current.attendance &&
        dataLoadedRef.current.shift &&
        attendanceData.length > 0) {
      calculateUnplannedAbsences(attendanceData, holidays, leaveList, selectedMonth, shiftDetails);
    }
  }, [attendanceData, holidays, leaveList, selectedMonth, shiftDetails, calculateUnplannedAbsences]);

  // Recalculate when month changes
  useEffect(() => {
    if (attendanceData.length > 0 && holidays.length > 0 && leaveList.length > 0 && shiftDetails) {
      calculateUnplannedAbsences(attendanceData, holidays, leaveList, selectedMonth, shiftDetails);
    }
  }, [selectedMonth, attendanceData, holidays, leaveList, shiftDetails, calculateUnplannedAbsences]);

  // --- UPDATED SANDWICH LOGIC (DASHBOARD DISPLAY) ---
  const calculateSandwichLeaves = useCallback(() => {
    // ✅ NEW: If admin turned off sandwich leave, clear and bail out
    if (!sandwichLeaveEnabled) {
      setSandwichLeaves([]);
      return;
    }

    const approvedLeaves = filteredLeaveList.filter(leave => leave.status === 'Approved');
    if (approvedLeaves.length === 0 && holidays.length === 0) {
      setSandwichLeaves([]);
      return;
    }

    // MAP: DateString -> isFullDay (Boolean)
    const approvedLeaveMap = new Map();

    approvedLeaves.forEach(leave => {
      // Determine if this leave is "Full Day"
      const isFullDay = !leave.halfDaySession; 
      let currentDate = new Date(leave.from);
      const endDate = new Date(leave.to);
      while (currentDate <= endDate) {
        approvedLeaveMap.set(formatDate(currentDate), isFullDay);
        currentDate = addDays(currentDate, 1);
      }
    });

    const newSandwichLeaves = [];
    
    // 1. Holiday Sandwiches
    holidays.forEach(holiday => {
      const holidayStart = new Date(holiday.start);
      const holidayEnd = new Date(holiday.end);
      
      const dayBefore = addDays(holidayStart, -1);
      const dayAfter = addDays(holidayEnd, 1);
      const dayBeforeStr = formatDate(dayBefore);
      const dayAfterStr = formatDate(dayAfter);

      // Check if both surrounding days exist in map AND are Full Day
      const isBeforeFullDay = approvedLeaveMap.get(dayBeforeStr) === true;
      const isAfterFullDay = approvedLeaveMap.get(dayAfterStr) === true;

      if (isBeforeFullDay && isAfterFullDay) {
        const isBeforeInMonth = isDateInMonth(dayBeforeStr, selectedMonth);
        const isAfterInMonth = isDateInMonth(dayAfterStr, selectedMonth);
        
        if (isBeforeInMonth || isAfterInMonth) {
          const patternKey = `${dayBeforeStr}|${dayAfterStr}`;
          const existingPattern = newSandwichLeaves.find(p => p.key === patternKey);
          
          if (!existingPattern) {
             const duration = calculateLeaveDays(holidayStart, holidayEnd);
             newSandwichLeaves.push({
              key: patternKey,
              dates: `${dayBeforeStr} & ${dayAfterStr}`,
              reason: `Sandwich around holiday: ${holiday.name}. Holiday period counted as leave.`,
              month: selectedMonth,
              type: 'holiday',
              daysCount: duration
            });
          }
        }
      }
    });

    // 2. Weekend Sandwiches (Sat/Mon) - BUT CONSIDER WEEK OFF DAYS
    for (const [dateStr, isFullDay] of approvedLeaveMap.entries()) {
      if (!isFullDay) continue; 

      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      
      // Get week off days from shift
      const weekOffDays = shiftDetails?.weeklyOffDays || [0];
      
      // Check if next consecutive days are week offs
      let consecutiveWeekOffCount = 0;
      let checkDate = new Date(date);
      
      // Count consecutive week off days after this date
      for (let i = 1; i <= 7; i++) {
        checkDate.setDate(date.getDate() + i);
        const checkDayOfWeek = checkDate.getDay();
        if (weekOffDays.includes(checkDayOfWeek)) {
          consecutiveWeekOffCount++;
        } else {
          break;
        }
      }
      
      // If we have consecutive week offs and the day after them is also a leave
      if (consecutiveWeekOffCount > 0) {
        const dayAfterWeekOffs = addDays(date, consecutiveWeekOffCount + 1);
        const dayAfterWeekOffsStr = formatDate(dayAfterWeekOffs);
        
        if (approvedLeaveMap.get(dayAfterWeekOffsStr) === true) {
          const patternKey = `${dateStr}|${dayAfterWeekOffsStr}`;
          const existingPattern = newSandwichLeaves.find(p => p.key === patternKey);

          if (!existingPattern && (isDateInMonth(dateStr, selectedMonth) || isDateInMonth(dayAfterWeekOffsStr, selectedMonth))) {
            newSandwichLeaves.push({
              key: patternKey,
              dates: `${dateStr} & ${dayAfterWeekOffsStr}`,
              reason: `Full Day leaves sandwiching ${consecutiveWeekOffCount} week off day(s). Week off(s) counted as leave.`,
              month: selectedMonth,
              type: 'weekend',
              daysCount: consecutiveWeekOffCount
            });
          }
        }
      }
    }

    setSandwichLeaves(newSandwichLeaves);
  }, [filteredLeaveList, holidays, selectedMonth, shiftDetails, sandwichLeaveEnabled]);

  useEffect(() => {
    calculateSandwichLeaves();
  }, [filteredLeaveList, holidays, selectedMonth, shiftDetails, sandwichLeaveEnabled, calculateSandwichLeaves]);

  // Check Overlaps with Colleagues
  const checkColleagueOverlaps = useCallback((fromDate, toDate) => {
    if(!fromDate || !toDate) {
      setOverlappingColleagues([]);
      setExpandOverlaps(false);
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    const overlaps = allApprovedLeaves.filter(leave => {
      // Skip own leaves
      if(leave.employeeId === user?.employeeId) return false;

      const lStart = new Date(leave.from);
      const lEnd = new Date(leave.to);
      lStart.setHours(0,0,0,0);
      lEnd.setHours(0,0,0,0);

      // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
      return (start <= lEnd && end >= lStart);
    });

    setOverlappingColleagues(overlaps);
  }, [allApprovedLeaves, user]);

  // ✅ NEW: Check if leave will be LOP and show warning
  const checkLOPWarning = useCallback((fromDate, toDate) => {
    if (!fromDate || !toDate) {
      setShowLOPWarning(false);
      return false;
    }
    
    const start = new Date(fromDate);
    const end = new Date(toDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    // Calculate requested days (excluding week offs and holidays)
    let requestedDays = 0;
    let currentDate = new Date(start);
    
    // Get week off days
    const weekOffDays = shiftDetails?.weeklyOffDays || [0];
    
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      
      // Skip week offs
      if (weekOffDays.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Skip holidays
      const isHoliday = holidays.some(h => {
        const hStart = new Date(h.startDate);
        const hEnd = new Date(h.endDate || h.startDate);
        hStart.setHours(0, 0, 0, 0);
        hEnd.setHours(23, 59, 59, 999);
        return currentDate >= hStart && currentDate <= hEnd;
      });
      
      if (!isHoliday) {
        requestedDays++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // ✅ FIX: Compute remaining paid balance directly from leavePolicies
    // so LOP warning is accurate regardless of whether stats have updated yet.
    // When carryForwardEnabled, use effectiveLimit (= paidDaysLimit + carriedForwardDays)
    const totalCredit = leavePolicies.reduce((sum, p) => {
      const limit = carryForwardEnabled && p.effectiveLimit != null
        ? p.effectiveLimit
        : (p.paidDaysLimit || 0);
      return sum + limit;
    }, 0);
    const totalUsed   = leavePolicies.reduce((sum, p) => sum + (p.usedPaidDays  || 0), 0);
    const remainingBalance = Math.max(0, totalCredit - totalUsed);

    // If no policy is configured yet, don't show a LOP warning
    if (totalCredit === 0) return false;

    const willBeLOP = Math.max(0, requestedDays - remainingBalance);

    if (willBeLOP > 0) {
      setLOPWarningDetails({
        pendingLeaves: remainingBalance,
        requestedDays,
        willBeLOP
      });
      return true;
    }

    return false;
  }, [leavePolicies, shiftDetails, holidays]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let updated = {
      ...form,
      [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
    };

    // Prevent selecting past dates beyond the allowed minSelectionDate
    if (name === "from" && value < minSelectionDate) {
      updated.from = minSelectionDate;
    }
    if (name === "to" && value < minSelectionDate) {
      updated.to = minSelectionDate;
    }

    // Auto-reset To when From changes
    if (name === "from" && updated.to && updated.to < value) {
      updated.to = value;
    }

    // Auto-correct To if user manually picks older than From
    if (name === "to" && updated.from && value < updated.from) {
      updated.to = updated.from;
    }

    // Reset halfDaySession if date range is > 1 day
    if (updated.from && updated.to && updated.from !== updated.to) {
      updated.halfDaySession = ""; 
    }

    setForm(updated);

    // Only run expensive date overlapping checks if we changed dates/types, NOT when typing the reason!
    if (name !== "reason") {
      const fromDate = updated.from;
      const toDate = updated.to;

      if (fromDate && toDate) {
        checkForSandwichLeave(fromDate, toDate);
        checkColleagueOverlaps(fromDate, toDate);
        checkLOPWarning(fromDate, toDate);
      } else {
        setSandwichWarning(null);
        setOverlappingColleagues([]);
        setShowLOPWarning(false);
      }
    }

    setSubmitError("");
    setSubmitSuccess("");
  };

  // Check for sandwich leave
  const checkForSandwichLeave = useCallback((fromDate, toDate) => {
    // ✅ NEW: If admin disabled sandwich leave, clear any warning and do nothing
    if (!sandwichLeaveEnabled) {
      setSandwichWarning(null);
      return;
    }

    const approvedLeaves = filteredLeaveList.filter(leave => leave.status === 'Approved');
    const bookedMap = new Map();
    const currentSelectedDates = new Set();

    approvedLeaves.forEach(leave => {
      const isFullDay = !leave.halfDaySession;
      let curr = new Date(leave.from);
      const end = new Date(leave.to);
      while (curr <= end) {
        bookedMap.set(formatDate(curr), isFullDay);
        curr = addDays(curr, 1);
      }
    });

    const isCurrentSelectionFullDay = !(form.from === form.to && form.halfDaySession);

    let selStart = new Date(fromDate);
    const selEnd = new Date(toDate);
    while (selStart <= selEnd) {
      const fDate = formatDate(selStart);
      currentSelectedDates.add(fDate);
      bookedMap.set(fDate, isCurrentSelectionFullDay); 
      selStart = addDays(selStart, 1);
    }

    const warnings = [];

    // Check Holiday Sandwiches
    holidays.forEach(holiday => {
      const hStart = new Date(holiday.start);
      const hEnd = new Date(holiday.end);
      const dayBefore = formatDate(addDays(hStart, -1));
      const dayAfter = formatDate(addDays(hEnd, 1));

      const beforeIsFull = bookedMap.get(dayBefore) === true;
      const afterIsFull = bookedMap.get(dayAfter) === true;

      if (beforeIsFull && afterIsFull) {
        if (currentSelectedDates.has(dayBefore) || currentSelectedDates.has(dayAfter)) {
           const msg = `Sandwich Detected: Full Day leaves surround '${holiday.name}'. The holiday period will be counted as leave(s).`;
           if (!warnings.some(w => w.message === msg)) {
             warnings.push({ type: 'holiday', message: msg });
           }
        }
      }
    });

    // Check Weekend Sandwiches - CONSIDER WEEK OFF DAYS
    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay) continue; 
      const d = new Date(dateStr);
      const dayOfWeek = d.getDay();
      
      // Get week off days
      const weekOffDays = shiftDetails?.weeklyOffDays || [0];
      
      // Check consecutive week offs after this date
      let consecutiveWeekOffCount = 0;
      let checkDate = new Date(d);
      
      for (let i = 1; i <= 7; i++) {
        checkDate.setDate(d.getDate() + i);
        const checkDayOfWeek = checkDate.getDay();
        if (weekOffDays.includes(checkDayOfWeek)) {
          consecutiveWeekOffCount++;
        } else {
          break;
        }
      }
      
      // If we have consecutive week offs
      if (consecutiveWeekOffCount > 0) {
        const dayAfterWeekOffs = addDays(d, consecutiveWeekOffCount + 1);
        const dayAfterWeekOffsStr = formatDate(dayAfterWeekOffs);
        
        if (bookedMap.get(dayAfterWeekOffsStr) === true) {
          if (currentSelectedDates.has(dateStr) || currentSelectedDates.has(dayAfterWeekOffsStr)) {
            const msg = `Sandwich Detected: Full Day leaves sandwiching ${consecutiveWeekOffCount} week off day(s). Week off(s) will be counted as leave.`;
             if (!warnings.some(w => w.message === msg)) {
               warnings.push({ type: 'weekend', message: msg });
             }
          }
        }
      }
    }

    if (warnings.length > 0) {
      setSandwichWarning(warnings);
    } else {
      setSandwichWarning(null);
    }
  }, [filteredLeaveList, holidays, selectedMonth, form.halfDaySession, form.from, form.to, shiftDetails, sandwichLeaveEnabled]);

  // ✅ ADDED: Optimize reason using Gemini API
  const handleOptimizeReason = async () => {
    if (!form.reason) return;
    setIsOptimizing(true);
    try {
      const response = await api.post("/api/ai/optimize-reason", { reason: form.reason });
      const data = response.data;
      
      if (data.optimizedReason) {
        setForm(prev => ({
          ...prev,
          reason: data.optimizedReason.slice(0, REASON_LIMIT)
        }));
      }
    } catch (err) {
      console.error("Error optimizing reason:", err);
      Swal.fire({
        icon: 'error',
        title: 'Optimization Failed',
        text: err.message || 'Could not optimize the reason. Please try again later.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // ✅ UPDATED: Submit leave with LOP check
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { from, to, reason, halfDaySession, leaveType } = form;
    if (!from || !to || !reason || !leaveType) {
      // SweetAlert validation
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'All fields are required.',
        confirmButtonColor: '#3085d6'
      });
      setSubmitError("All fields are required.");
      return;
    }

    if (getDayOfWeek(from) === 0 || getDayOfWeek(to) === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sunday Selected',
        text: 'Sundays are week offs. Start and end dates cannot be Sundays.',
        confirmButtonColor: '#3085d6'
      });
      setSubmitError("Start and end dates cannot be Sundays.");
      return;
    }
    
    // First check for sandwich warning (only if admin has the feature ON)
    if (sandwichLeaveEnabled && sandwichWarning && sandwichWarning.length > 0) {
      setShowSandwichAlert(true);
      return;
    }
    
    // Then check for LOP warning
    const hasLOPWarning = checkLOPWarning(from, to);
    if (hasLOPWarning) {
      setShowLOPWarning(true);
      return;
    }
    
    // If no warnings, proceed with submission
    await submitLeaveRequest();
  };

  const submitLeaveRequest = async () => {
    const { from, to, reason, halfDaySession, leaveType } = form;
    setSubmitError("");

    // SweetAlert Loading state to prevent multiple clicks
    Swal.fire({
      title: 'Submitting Request...',
      text: 'Please wait while we process your leave.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const payload = {
        employeeId: user.employeeId,
        employeeName: user.name,
        from,
        to,
        reason,
        leaveType,
        leaveDayType: from === to && halfDaySession ? "Half Day" : "Full Day",
        halfDaySession: from === to ? halfDaySession || "" : "",
      };

      if (typeof applyForLeave === "function") {
        await applyForLeave(payload);
      } else {
        await api.post("/api/leaves/apply", payload);
      }

      playRequestSound();
      
      // Show SweetAlert Success
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Leave request submitted successfully!',
        timer: 3000,
        showConfirmButton: false
      });

      setSubmitSuccess("Leave request submitted successfully!");
      setForm({
        from: "",
        to: "",
        reason: "",
        halfDaySession: "",
        leaveType: "",
      });
      setSandwichWarning(null);
      setOverlappingColleagues([]); 
      setShowSandwichAlert(false);
      setShowLOPWarning(false);
      setModalOpen(false);
      
      // Refresh data
      await fetchAllData();
      
      setTimeout(() => {
        setSubmitSuccess("");
      }, 3000);
    } catch (err) {
      console.error("submit error", err);
      const errMsg = err.response?.data?.message || err?.message || "Failed to submit leave request.";
      // Show SweetAlert Error
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: errMsg,
        confirmButtonColor: '#d33'
      });
      setSubmitError(errMsg);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    // SweetAlert confirmation for cancelling leave
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to cancel this leave request?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, cancel it!'
    });

    if (!result.isConfirmed) return;

    // Show loading alert during cancellation
    Swal.fire({
      title: 'Cancelling...',
      text: 'Please wait',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      let canceled = false;
      if (typeof cancelLeaveRequestById === "function") {
        try {
          await cancelLeaveRequestById(leaveId);
          canceled = true;
        } catch (err) {
          console.error("Error cancelling leave via function:", err);
        }
      }
      if (!canceled) {
        await api.delete(`/api/leaves/cancel/${leaveId}`);
      }
      await fetchAllData();
      
      // Show cancel success alert
      Swal.fire({
        icon: 'success',
        title: 'Cancelled!',
        text: 'Leave request cancelled successfully!',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error("cancel error", err);
      // Show cancel error alert
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to cancel the leave request.',
        confirmButtonColor: '#d33'
      });
    }
  };

  const renderStatusBadge = (status) => {
    const s = status || "Pending";
    const base = "px-3 py-1 rounded-full text-sm font-semibold shadow-sm ";
    if (s === "Pending") return <span className={`${base} bg-yellow-100 text-yellow-700 border border-yellow-300`}>{s}</span>;
    if (s === "Approved") return <span className={`${base} bg-green-100 text-green-700 border border-green-300`}>{s}</span>;
    if (s === "Rejected") return <span className={`${base} bg-red-100 text-red-700 border border-red-300`}>{s}</span>;
    if (s === "Cancelled") return <span className={`${base} bg-gray-100 text-gray-700 border border-gray-300`}>{s}</span>;
    return <span className={`${base} bg-gray-100 text-gray-700 border border-gray-300`}>{s}</span>;
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === "-") return "-";
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter Upcoming Leaves for Modal
  const upcomingTeamLeaves = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    
    return allApprovedLeaves
      .filter(l => {
        const endDate = new Date(l.to);
        endDate.setHours(0,0,0,0);
        return endDate >= todayDate && l.employeeId !== user?.employeeId;
      })
      .sort((a, b) => new Date(a.from) - new Date(b.from));
  }, [allApprovedLeaves, user]);

  // Refresh all data
  const handleRefresh = () => {
    dataLoadedRef.current = {
      leaves: false,
      holidays: false,
      attendance: false,
      allLeaves: false,
      shift: false,
      policy: false
    };
    fetchAllData();
  };

  const handleOpenModal = async () => {
    // Reset policy loaded ref so it forces a fresh fetch
    dataLoadedRef.current.policy = false;
    await fetchLeavePolicies();
    setModalOpen(true);
  };

  if (loading && !leaveList.length) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-blue-800 font-semibold">Loading your leave data...</p>
      </div>
    </div>
  );
  
  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-gray-600 mb-6">Employee data not found. Please log in again.</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200"
        >
          Reload Page
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row items-start lg:items-center border border-gray-200 shadow-sm bg-white rounded-2xl p-4 justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Leave Management</h1>
            <p className="text-gray-600">Welcome back, <span className="font-semibold text-blue-600">{user.name || user.employeeId}</span></p>
          </div>
          
          <div className="flex gap-3 mt-4 lg:mt-0">
            {/* Team Leaves Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setUpcomingModalOpen(true)}
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 font-bold px-6 py-3 rounded-xl shadow-md transition duration-200 flex items-center"
            >
              👥 Team Leaves
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenModal}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200"
            >
              📅 Apply for Leave
            </motion.button>
          </div>
        </motion.div>

        {/* ✅ UPDATED Stats Cards - Fully Responsive Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 mb-8 w-full"
        >
          {/* Pending Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 border-l-4 border-blue-500 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-gray-500 text-[8px] md:text-sm font-black uppercase tracking-tight md:tracking-widest truncate">Leave Balance</p>
                <p className="text-xl md:text-4xl font-black text-gray-900 mt-0.5 md:mt-2">{stats.pendingLeaves}</p>
              </div>
              <div className="w-8 h-8 md:w-14 md:h-14 bg-blue-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                <span className="text-base md:text-3xl">📥</span>
              </div>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[8px] md:text-xs text-gray-500 font-bold leading-tight truncate">
                {stats.totalCredit > 0 ? `${stats.pendingLeaves}/${stats.totalCredit} Paid` : "No Policy"}
              </p>
              {carryForwardEnabled && stats.totalCarriedForward > 0 && (
                <p className="text-[8px] md:text-xs text-emerald-600 font-black mt-0.5 truncate">
                  ↩ CF: {stats.totalCarriedForward}
                </p>
              )}
            </div>
          </div>

          {/* Total Leave Days Card */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 border-l-4 border-cyan-500 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-gray-500 text-[8px] md:text-sm font-black uppercase tracking-tight md:tracking-widest truncate">Overall Leaves</p>
                <p className="text-xl md:text-4xl font-black text-gray-900 mt-0.5 md:mt-2">{stats.totalLeaveDays}</p>
              </div>
              <div className="w-8 h-8 md:w-14 md:h-14 bg-cyan-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                 <span className="text-base md:text-3xl">📅</span>
              </div>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[8px] md:text-xs text-gray-500 font-bold leading-tight truncate">
                {stats.normalLeaveDays}N + {stats.sandwichDaysCount}S
              </p>
            </div>
          </div>

          {/* Unplanned Absences Card */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 border-l-4 border-red-500 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-gray-500 text-[8px] md:text-sm font-black uppercase tracking-tight md:tracking-widest truncate">Unplanned</p>
                <p className="text-xl md:text-4xl font-black text-gray-900 mt-0.5 md:mt-2">{stats.unplannedAbsenceDays}</p>
              </div>
              <div className="w-8 h-8 md:w-14 md:h-14 bg-red-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                <span className="text-base md:text-3xl">⚠️</span>
              </div>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[8px] md:text-xs text-red-500 font-black uppercase tracking-widest truncate">Absences</p>
            </div>
          </div>

          {/* LOP Days Card */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 border-l-4 border-orange-500 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-gray-500 text-[8px] md:text-sm font-black uppercase tracking-tight md:tracking-widest truncate">LOP Days</p>
                <p className="text-xl md:text-4xl font-black text-gray-900 mt-0.5 md:mt-2">{stats.extraLeaves}</p>
              </div>
              <div className="w-8 h-8 md:w-14 md:h-14 bg-orange-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                <span className="text-base md:text-3xl">🚫</span>
              </div>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[8px] md:text-xs text-orange-600 font-black uppercase tracking-widest truncate">Beyond Limit</p>
            </div>
          </div>

          {/* Total Requests Card */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-6 border-l-4 border-emerald-500 flex flex-col justify-between min-h-[110px] md:min-h-0 sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-gray-500 text-[8px] md:text-sm font-black uppercase tracking-tight md:tracking-widest truncate">Requests</p>
                <p className="text-xl md:text-4xl font-black text-gray-900 mt-0.5 md:mt-2">{leaveList.length}</p>
              </div>
              <div className="w-8 h-8 md:w-14 md:h-14 bg-emerald-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                <span className="text-base md:text-3xl">🚀</span>
              </div>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[8px] md:text-xs text-emerald-600 font-black uppercase tracking-widest truncate">Total History</p>
            </div>
          </div>
        </motion.div>

        {/* ✅ ADDED: Week Off Info Card */}
        {shiftDetails && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-indigo-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Week Off Information</h3>
                <p className="text-gray-700">
                  Your week off days:{" "}
                  <span className="font-semibold text-indigo-600">
                    {shiftDetails.weeklyOffDays?.map(day => {
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return days[day];
                    }).join(', ')}
                  </span>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Week off days and holidays are excluded from unplanned absence calculations.
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="w-full lg:w-72">
              <label className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FaCalendarAlt size={12} />
                </span>
                Filter by Month
              </label>
              <div className="relative w-full">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-12 w-full appearance-none rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-4 pl-11 pr-11 text-sm font-black text-slate-800 shadow-sm outline-none transition duration-200 hover:border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m)}
                    </option>
                  ))}
                </select>
                <FaCalendarAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
                <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              </div>
            </div>

            <div className="w-full lg:w-72">
              <label className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FaFilter size={12} />
                </span>
                Filter by Status
              </label>
              <div className="relative w-full">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-12 w-full appearance-none rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-4 pl-11 pr-11 text-sm font-black text-slate-800 shadow-sm outline-none transition duration-200 hover:border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <FaFilter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={14} />
                <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              </div>
            </div>

            <div className="flex w-full justify-start lg:ml-auto lg:w-auto">
              <button
                onClick={handleRefresh}
                disabled={loadingAttendance || loadingShift}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-5 text-sm font-black text-white shadow-lg shadow-slate-200 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaSyncAlt className={(loadingAttendance || loadingShift) ? "animate-spin" : ""} size={14} />
                {(loadingAttendance || loadingShift) ? "Refreshing..." : "Refresh Data"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Leave Requests Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Your Leave Requests</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing leaves for {formatMonth(selectedMonth)} • {selectedStatus === "All" ? "All Statuses" : selectedStatus}
            </p>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">From-To</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Reason</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">HalfDay</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Approved By</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                        Syncing Leave History...
                      </div>
                    </td>
                  </tr>
                ) : filteredLeaveList.length > 0 ? (
                  filteredLeaveList.map((lv) => (
                    <tr key={lv._id} className="hover:bg-blue-50/30 transition duration-150">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-black text-gray-800 flex items-center gap-2">
                          <FaCalendarAlt className="text-blue-500 text-xs" />
                          {formatDisplayDate(lv.from)} 
                          <span className="text-gray-300 font-normal">→</span>
                          {formatDisplayDate(lv.to)}
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold ml-5 uppercase tracking-widest mt-0.5">Applied: {formatDisplayDate(lv.requestDate)}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs text-gray-600 max-w-xs font-medium italic">"{lv.reason || "-"}"</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${lv.halfDaySession ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {lv.halfDaySession || "Full Day"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                          {lv.leaveType || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {renderStatusBadge(lv.status)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-gray-700">{lv.approvedBy || "-"}</div>
                        {lv.actionDate && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{formatDisplayDate(lv.actionDate)}</p>}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {lv.status === "Pending" && (
                          <button
                            onClick={() => handleCancelLeave(lv._id)}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-all active:scale-95 shadow-sm"
                          >
                            Cancel Request
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-black uppercase tracking-widest text-[10px]">
                      No leave requests found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-5 p-4 bg-slate-50/50">
            {loading ? (
               <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-3 bg-white rounded-3xl border border-dashed border-slate-200">
                 <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                 Updating History...
               </div>
            ) : filteredLeaveList.length > 0 ? (
              filteredLeaveList.map((lv) => (
                <div key={lv._id} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4 transition-all active:scale-[0.98]">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                      <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                        <FaCalendarAlt className="text-blue-500 text-[10px]" />
                        {formatDisplayDate(lv.from)} 
                        <span className="text-slate-300 font-normal">→</span>
                        {formatDisplayDate(lv.to)}
                      </div>
                    </div>
                    {renderStatusBadge(lv.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50/50 p-2.5 rounded-2xl border border-blue-100/50">
                      <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">Type</span>
                      <span className="text-[10px] font-black text-blue-700 uppercase truncate block">{lv.leaveType || "Normal"}</span>
                    </div>
                    <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-100/50">
                      <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">Session</span>
                      <span className="text-[10px] font-black text-amber-700 uppercase truncate block">{lv.halfDaySession || "Full Day"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason</span>
                    <p className="text-[11px] text-slate-600 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 italic font-medium leading-relaxed">
                      "{lv.reason || "No reason provided"}"
                    </p>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50/30 px-3 py-2 rounded-xl border border-slate-100/50">
                    <div>
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Applied</span>
                      <span className="text-[9px] font-bold text-slate-500">{formatDisplayDate(lv.requestDate)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Approved</span>
                      <span className="text-[9px] font-bold text-slate-800">{lv.approvedBy || "Pending"}</span>
                    </div>
                  </div>

                  {lv.status === "Pending" && (
                    <button
                      onClick={() => handleCancelLeave(lv._id)}
                      className="w-full bg-red-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-transform"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                No leave requests found for this month
              </div>
            )}
          </div>
        </motion.div>

        {/* ✅ UPDATED: Unplanned Absences Section with Week Off info */}
        {unplannedAbsences.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg border border-red-200 mb-8 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
                  <span className="text-xl text-white">⚠️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Unplanned Absences</h2>
                  <p className="text-red-100 text-sm">
                    Days marked as absent without leave application for {formatMonth(selectedMonth)} • {unplannedAbsences.length} day{unplannedAbsences.length !== 1 ? 's' : ''}
                  </p>
                </div>
                </div>
                <div className="flex rounded-2xl bg-white/15 p-1 ring-1 ring-white/20 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setUnplannedAbsenceView("list")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                      unplannedAbsenceView === "list"
                        ? "bg-white text-red-600 shadow-sm"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <FaListUl size={12} /> List View
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnplannedAbsenceView("grid")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                      unplannedAbsenceView === "grid"
                        ? "bg-white text-red-600 shadow-sm"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <FaThLarge size={12} /> Grid View
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 text-sm mb-3">
                  The following working days (excluding week offs and holidays) were marked as "Absent" in your attendance record but you did not apply for leave:
                </p>
                
                {/* Week Off Info */}
                {shiftDetails && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      <span className="font-semibold">Note:</span> Week offs ({shiftDetails.weeklyOffDays?.map(day => {
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        return days[day];
                      }).join(', ')}) and holidays are excluded from this calculation.
                    </p>
                  </div>
                )}
              </div>
              
              {unplannedAbsenceView === "grid" ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {unplannedAbsences.map((absence, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow-md transition duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {formatDisplayDate(absence.date)}
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            {absence.dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                        </div>
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 text-xs font-bold">ABS</span>
                        </div>
                      </div>
                      <p className="text-gray-700 text-xs mt-2">{absence.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-red-100 overflow-hidden rounded-2xl border border-red-100 bg-white">
                  {unplannedAbsences.map((absence, index) => (
                    <div key={index} className="flex flex-col gap-3 bg-red-50/50 p-4 transition hover:bg-red-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-[10px] font-black uppercase tracking-widest text-red-600">
                          ABS
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{formatDisplayDate(absence.date)}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {absence.dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed text-slate-600 sm:max-w-xl sm:text-right">
                        {absence.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm flex items-center">
                  <span className="mr-2">💡</span>
                  <strong>Note:</strong> These unplanned absences are automatically counted in your total leave days and contribute to your extra leaves calculation. To avoid these, please apply for leave in advance.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sandwich Leaves Section */}
        {sandwichLeaves.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg border border-orange-200 mb-8 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
                  <span className="text-xl text-white">🥪</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Sandwich Leaves Detected</h2>
                  <p className="text-orange-100 text-sm">
                    Sandwich leaves for {formatMonth(selectedMonth)} • {sandwichLeaves.length} pattern{sandwichLeaves.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {sandwichLeaves.map((leave, index) => (
                  <div key={index} className="bg-orange-50 border border-orange-200 rounded-xl p-4 hover:shadow-md transition duration-200">
                    <div className="flex items-start">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                        <span className="text-orange-600 text-sm">{(index + 1)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-2">{leave.dates}</p>
                        <p className="text-gray-700 text-xs leading-relaxed">{leave.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm flex items-center">
                  <span className="mr-2">💡</span>
                  <strong>Note:</strong> Sandwich leaves are automatically detected when your approved leaves create extended weekends or holiday bridges within the selected month.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Team Leaves Modal */}
      <AnimatePresence>
        {upcomingModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={() => setUpcomingModalOpen(false)}
          >
             <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-indigo-50 flex justify-between items-center sticky top-0">
                <div>
                  <h3 className="text-xl font-bold text-indigo-800">Upcoming Team Leaves</h3>
                  <p className="text-sm text-indigo-600">Approved leaves of your colleagues from today onwards.</p>
                </div>
                <button 
                  onClick={() => setUpcomingModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="p-6">
                {upcomingTeamLeaves.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingTeamLeaves.map((leave) => (
                      <div key={leave._id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                         <div className="flex items-center gap-4">
                           <div className="flex-1">
                             <p className="font-bold text-gray-800 text-lg">{leave.employeeName}</p>
                             <p className="text-xs text-gray-500 uppercase font-semibold">ID: {leave.employeeId}</p>
                           </div>
                         </div>
                         <div className="mt-2 sm:mt-0 text-right">
                           <div className="bg-indigo-50 px-3 py-1 rounded-lg inline-block">
                             <p className="text-sm font-semibold text-indigo-800">
                               {formatDisplayDate(leave.from)} <span className="text-gray-400">→</span> {formatDisplayDate(leave.to)}
                             </p>
                           </div>
                           <p className="text-xs text-gray-500 mt-1">{calculateLeaveDays(leave.from, leave.to)} Day(s) • {leave.leaveType}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-3">🌴</div>
                    <p className="text-gray-500 font-medium">No upcoming approved leaves found for other employees.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Application Modal */}
      <ModalWrapper isOpen={modalOpen} onClose={() => setModalOpen(false)} containerClass="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">Apply for Leave</h3>
            <button
              onClick={() => setModalOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
              <DatePicker
                selected={parseISODate(form.from)}
                onChange={(date) => {
                  if (!date) {
                    handleChange({ target: { name: "from", value: "" } });
                    return;
                  }
                  handleChange({ target: { name: "from", value: formatDate(date) } });
                }}
                minDate={parseISODate(minSelectionDate)}
                filterDate={(date) => date.getDay() !== 0}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                dateFormat="dd-MM-yyyy"
                placeholderText="Select Start Date"
                wrapperClassName="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
              <DatePicker
                selected={parseISODate(form.to)}
                onChange={(date) => {
                  if (!date) {
                    handleChange({ target: { name: "to", value: "" } });
                    return;
                  }
                  handleChange({ target: { name: "to", value: formatDate(date) } });
                }}
                minDate={form.from ? parseISODate(form.from) : parseISODate(minSelectionDate)}
                filterDate={(date) => date.getDay() !== 0}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                dateFormat="dd-MM-yyyy"
                placeholderText="Select End Date"
                wrapperClassName="w-full"
              />
            </div>
          </div>

          {/* Overlap Notice */}
          {overlappingColleagues.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-700 uppercase mb-2">
                📅 Heads up! Others on leave:
              </p>
              <ul className="text-xs text-blue-800 space-y-2">
                {(expandOverlaps ? overlappingColleagues : overlappingColleagues.slice(0, 3)).map((col, idx) => (
                  <li key={idx} className="flex justify-between items-start border-b border-blue-100 pb-1 last:border-0 last:pb-0">
                    <div>
                      <span className="font-bold">{col.employeeName}</span>
                      <span className="text-[10px] text-blue-600 ml-1">({col.employeeId})</span>
                    </div>
                    <span className="opacity-70 text-[10px] whitespace-nowrap">
                      {formatDisplayDate(col.from)} - {formatDisplayDate(col.to)}
                    </span>
                  </li>
                ))}
              </ul>

              {overlappingColleagues.length > 3 && (
                 <div className="mt-2 text-right">
                   {!expandOverlaps ? (
                     <button 
                        type="button" 
                        onClick={() => setExpandOverlaps(true)}
                        className="text-xs text-blue-600 font-bold hover:text-blue-800 hover:underline"
                     >
                       and {overlappingColleagues.length - 3} others...
                     </button>
                   ) : (
                      <button 
                        type="button" 
                        onClick={() => setExpandOverlaps(false)}
                        className="text-xs text-blue-600 font-bold hover:text-blue-800 hover:underline"
                      >
                        Show less
                      </button>
                   )}
                 </div>
              )}
            </div>
          )}

          {form.from && form.to && form.from === form.to && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Half Day Session</label>
              <select 
                name="halfDaySession" 
                value={form.halfDaySession} 
                onChange={handleChange}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              >
                <option value="">Full Day</option>
                <option value="Morning Half">Morning Half</option>
                <option value="Afternoon Half">Afternoon Half</option>
              </select>
            </div>
          )}

          {/* Sandwich Warning */}
          {sandwichWarning && sandwichWarning.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <div className="flex items-start">
                <span className="text-yellow-600 text-xl mr-2">⚠️</span>
                <div>
                  <p className="font-semibold text-yellow-800 mb-2">Sandwich Leave Warning</p>
                  {sandwichWarning.map((warning, index) => (
                    <p key={index} className="text-sm text-yellow-700 mb-1">{warning.message}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ✅ UPDATED: Dynamic Leave Types with carry-forward info */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Leave Type</label>
            <select 
              name="leaveType" 
              value={form.leaveType} 
              onChange={handleChange}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
            >
              <option value="">Select Leave Type</option>
              {leavePolicies.length > 0 ? (
                leavePolicies.map((policy, idx) => {
                  const cf = carryForwardEnabled && policy.carriedForwardDays > 0
                    ? ` +${policy.carriedForwardDays} carried`
                    : "";
                  return (
                    <option key={idx} value={policy.leaveType}>
                      {policy.leaveType} (Paid remaining: {policy.remainingPaidDays}{cf})
                    </option>
                  );
                })
              ) : (
                <>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                </>
              )}
              <option value="Loss of Pay">Loss of Pay (LOP)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Reason <span className="text-gray-400 text-xs">({form.reason.length}/{REASON_LIMIT})</span>
            </label>
            <textarea
              name="reason"
              value={form.reason}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              maxLength={REASON_LIMIT}
              rows={3}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200 resize-none"
              placeholder="Brief reason for your leave"
            />
            {form.reason && (
              <button
                type="button"
                onClick={handleOptimizeReason}
                disabled={isOptimizing}
                className="mt-2 text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50"
              >
                {isOptimizing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></div>
                    Optimizing...
                  </>
                ) : (
                  <>✨ AI Generate</>
                )}
              </button>
            )}
          </div>

          {submitError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
              <p className="text-red-700 font-semibold">{submitError}</p>
            </div>
          )}

          {submitSuccess && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
              <p className="text-green-700 font-semibold">{submitSuccess}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition duration-200"
            >
              Submit Leave Request
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-xl transition duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </ModalWrapper>

      {/* Sandwich Alert Modal */}
      <ModalWrapper isOpen={showSandwichAlert && !!sandwichWarning} onClose={() => setShowSandwichAlert(false)} containerClass="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Sandwich Leave Detected</h3>
        </div>
        
        <div className="mb-6 space-y-3">
          {sandwichWarning?.map((warning, index) => (
            <div key={index} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <p className="text-sm text-gray-700">{warning.message}</p>
            </div>
          ))}
        </div>

        <p className="text-gray-600 mb-6">
          Do you want to proceed with this leave request?
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowSandwichAlert(false);
              const hasLOPWarning = checkLOPWarning(form.from, form.to);
              if (hasLOPWarning) {
                setShowLOPWarning(true);
              } else {
                submitLeaveRequest();
              }
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-xl transition duration-200"
          >
            Yes, Proceed
          </button>
          <button
            onClick={() => {
              setShowSandwichAlert(false);
            }}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-4 py-3 rounded-xl transition duration-200"
          >
            Cancel
          </button>
        </div>
      </ModalWrapper>

      {/* ✅ NEW: LOP Warning Modal */}
      <ModalWrapper isOpen={showLOPWarning} onClose={() => setShowLOPWarning(false)} containerClass="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-2xl text-red-600">💰</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Loss of Pay (LOP) Warning</h3>
        </div>
        
        <div className="mb-6 space-y-3">
          <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> You have exceeded your available paid leave balance!
              The extra day(s) will be marked as <strong>Loss of Pay (LOP)</strong>.
            </p>
          </div>
          
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Remaining Paid Leave Balance:</span>
                <span className="text-sm font-semibold">{LOPWarningDetails.pendingLeaves} day(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Requested Leave Days:</span>
                <span className="text-sm font-semibold">{LOPWarningDetails.requestedDays} day(s)</span>
              </div>
              <div className="flex justify-between border-t border-yellow-200 pt-2">
                <span className="text-sm font-semibold text-red-600">Will be marked as LOP:</span>
                <span className="text-sm font-bold text-red-600">{LOPWarningDetails.willBeLOP} day(s)</span>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> LOP (Loss of Pay) leaves will result in salary deduction. Are you sure you want to proceed?
            </p>
          </div>
        </div>

        <p className="text-gray-600 mb-6">
          Do you want to continue with this leave request as LOP?
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowLOPWarning(false);
              submitLeaveRequest();
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-3 rounded-xl transition duration-200"
          >
            Yes, Proceed as LOP
          </button>
          <button
            onClick={() => {
              setShowLOPWarning(false);
            }}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-4 py-3 rounded-xl transition duration-200"
          >
            Cancel Request
          </button>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default EmployeeLeavemanagement;
// --- END OF FILE EmployeeLeavemanagement.jsx ---
