import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLeaveRequestsForEmployee,
  applyForLeave,
  cancelLeaveRequestById,
} from "../api";
import axios from "axios";

const REASON_LIMIT = 50;

// --- LEAVE YEAR CONFIGURATION ---
// The month the leave year starts (1 = Jan, 11 = Nov)
const LEAVE_YEAR_START_MONTH = 11;

// --- HELPER FUNCTIONS ---

// Gets the start and end dates of the current leave year based on today's date
const getCurrentLeaveYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // JS month is 0-indexed
  const currentYear = today.getFullYear();

  let startYear;
  if (currentMonth < LEAVE_YEAR_START_MONTH) {
    // If we are in Jan-Oct, the leave year started last year
    startYear = currentYear - 1;
  } else {
    // If we are in Nov-Dec, the leave year started this year
    startYear = currentYear;
  }

  const startDate = new Date(startYear, LEAVE_YEAR_START_MONTH - 1, 1);
  const endDate = new Date(startYear + 1, LEAVE_YEAR_START_MONTH - 1, 0); // Day 0 of next month is the last day of the current

  return { startDate, endDate };
};

// Generates month options (e.g., "2025-11") for the current leave year
const getMonthsForCurrentLeaveYear = () => {
  const { startDate } = getCurrentLeaveYear();
  const options = [];
  // Loop for 12 months from the start of the leave year
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const year = monthDate.getFullYear();
    const month = String(monthDate.getMonth() + 1).padStart(2, '0');
    options.push(`${year}-${month}`);
  }
  return options;
};

// Convert "2025-11" → "November 2025"
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

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter) return false;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split('-');
  return date.getFullYear() === parseInt(year) && 
         (date.getMonth() + 1) === parseInt(month);
};


const LeaveWithModal = () => {
  const [user, setUser] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [sandwichLeaves, setSandwichLeaves] = useState([]);

  useEffect(() => {
    const saved = sessionStorage.getItem("hrmsUser") || localStorage.getItem("hrmsUser");
    if (saved) setUser(JSON.parse(saved));
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
  const [detailsMap, setDetailsMap] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [detailsError, setDetailsError] = useState({});

  // form / modal
  const [form, setForm] = useState({
    from: "",
    to: "",
    reason: "",
    halfDaySession: "",
    leaveType: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  
  // Sandwich leave warning state
  const [sandwichWarning, setSandwichWarning] = useState(null);
  const [showSandwichAlert, setShowSandwichAlert] = useState(false);

  // expanded row
  const [expandedId, setExpandedId] = useState(null);

  // Stats states
  const [stats, setStats] = useState({
    approvedLeaves: 0,      // For selected month
    extraLeaves: 0,         // For selected month
    sandwichLeavesCount: 0, // For selected month
    sandwichDaysCount: 0,   // For selected month
    pendingLeaves: 0,       // Year-to-date
  });

  // Filtered leave list based on selected month and status
  const filteredLeaveList = useMemo(() => {
    return leaveList.filter(leave => {
      const matchesMonth = selectedMonth === "all" || 
        isDateInMonth(leave.from, selectedMonth) || 
        isDateInMonth(leave.to, selectedMonth);
      
      const matchesStatus = selectedStatus === "All" || leave.status === selectedStatus;
      
      return matchesMonth && matchesStatus;
    });
  }, [leaveList, selectedMonth, selectedStatus]);

  // Calculate YEARLY pending leaves based on the entire leave history for the current leave year
  useEffect(() => {
    if (!leaveList.length) return;

    const { startDate, endDate } = getCurrentLeaveYear();
    const today = new Date();

    // Filter for approved leaves within the current leave year
    const approvedLeavesThisYear = leaveList.filter(leave => {
        const leaveDate = new Date(leave.from);
        return leave.status === 'Approved' && leaveDate >= startDate && leaveDate <= endDate;
    });
    const usedLeavesThisYear = approvedLeavesThisYear.length;
    
    // Calculate how many months have passed in the current leave year
    let monthsPassed = 0;
    if (today >= startDate) {
        monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1;
    }
    const earnedLeavesThisYear = Math.max(0, monthsPassed);

    // Calculate pending leaves for the year
    const pending = Math.max(0, earnedLeavesThisYear - usedLeavesThisYear);
    
    setStats(prev => ({
        ...prev,
        pendingLeaves: pending,
    }));

  }, [leaveList]);

  // Calculate MONTHLY stats (Approved, Extra, Sandwich) based on the currently filtered list
  useEffect(() => {
    // Count approved leaves in the selected month
    const approvedInMonth = filteredLeaveList.filter(leave => leave.status === 'Approved').length;
    
    // NEW LOGIC: Extra leaves are any beyond the 1 allotted for the month
    const extraLeavesInMonth = Math.max(0, approvedInMonth - 1);

    // Sandwich leaves calculation for the month
    const sandwichCount = sandwichLeaves.length;
    const sandwichDays = sandwichLeaves.reduce((total) => total + 2, 0);

    setStats(prev => ({
      ...prev,
      approvedLeaves: approvedInMonth,
      extraLeaves: extraLeavesInMonth,
      sandwichLeavesCount: sandwichCount,
      sandwichDaysCount: sandwichDays,
    }));
  }, [filteredLeaveList, sandwichLeaves]);
  
  // Fetch holidays from the backend API
  const fetchHolidays = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/holidays");
      setHolidays(res.data);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  // Fetch all leaves for the employee to ensure accurate year-long calculations
  const fetchLeaves = useCallback(async () => {
    if (!user?.employeeId) {
      setLeaveList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (typeof getLeaveRequestsForEmployee === "function") {
        try {
          const maybeResult = await getLeaveRequestsForEmployee(user.employeeId);
          if (Array.isArray(maybeResult)) {
            setLeaveList(maybeResult);
            return;
          }
        } catch (err) {}
      }

      // Fallback implementation - fetches all leaves for the user
      const API_BASE = "http://localhost:5000/api/leaves";
      const url = new URL(API_BASE, window.location.origin);
      url.searchParams.set("employeeId", user.employeeId);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch leave list");
      
      const data = await res.json();
      const normalized = (data || []).map((d) => ({
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
    } catch (err) {
      console.error(err);
      setError("Failed to load leaves.");
      setLeaveList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    if (user) {
      fetchLeaves();
      fetchHolidays();
    }
  }, [user, fetchLeaves]);

  // SANDWICH LEAVE CALCULATION (for selected month)
  const calculateSandwichLeaves = useCallback(() => {
    const approvedLeaves = filteredLeaveList.filter(leave => leave.status === 'Approved');
    if (approvedLeaves.length < 2 && holidays.length === 0) {
      setSandwichLeaves([]);
      return;
    }

    const approvedLeaveDates = new Set();
    approvedLeaves.forEach(leave => {
      let currentDate = new Date(leave.from);
      const endDate = new Date(leave.to);
      while (currentDate <= endDate) {
        approvedLeaveDates.add(formatDate(currentDate));
        currentDate = addDays(currentDate, 1);
      }
    });

    if (approvedLeaveDates.size === 0) {
        setSandwichLeaves([]);
        return;
    }

    const newSandwichLeaves = new Map();

    holidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const holidayStr = formatDate(holidayDate);
      
      if (selectedMonth && !isDateInMonth(holidayStr, selectedMonth)) return;

      const dayBefore = addDays(holidayDate, -1);
      const dayAfter = addDays(holidayDate, 1);

      if (approvedLeaveDates.has(formatDate(dayBefore)) && approvedLeaveDates.has(formatDate(dayAfter))) {
        const key = `holiday-${formatDate(holidayDate)}`;
        if (!newSandwichLeaves.has(key)) {
            newSandwichLeaves.set(key, {
                dates: `${formatDate(dayBefore)}, ${holiday.name} (Holiday), ${formatDate(dayAfter)}`,
                reason: `Leave approved on the day before and after the '${holiday.name}' holiday.`,
                month: selectedMonth
            });
        }
      }
    });

    approvedLeaveDates.forEach(dateStr => {
        const date = new Date(dateStr);
        if (selectedMonth && !isDateInMonth(dateStr, selectedMonth)) return;

        if (date.getDay() === 5) { // Friday
            const followingMonday = addDays(date, 3);
            const mondayStr = formatDate(followingMonday);
            if (selectedMonth && !isDateInMonth(mondayStr, selectedMonth)) return;

            if (approvedLeaveDates.has(mondayStr)) {
                 const key = `weekend-${dateStr}`;
                 if (!newSandwichLeaves.has(key)) {
                     newSandwichLeaves.set(key, {
                        dates: `${dateStr} (Friday) → ${mondayStr} (Monday)`,
                        reason: 'Leave approved on a Friday and the following Monday, sandwiching the weekend.',
                        month: selectedMonth
                     });
                 }
            }
        }
    });

    setSandwichLeaves(Array.from(newSandwichLeaves.values()));
  }, [filteredLeaveList, holidays, selectedMonth]);

  useEffect(() => {
    calculateSandwichLeaves();
  }, [filteredLeaveList, holidays, selectedMonth, calculateSandwichLeaves]);

  // Check for sandwich leave
  const checkForSandwichLeave = useCallback((fromDate, toDate) => {
    if (!fromDate || !toDate) {
      setSandwichWarning(null);
      return;
    }

    const approvedLeaves = filteredLeaveList.filter(leave => leave.status === 'Approved');
    const approvedLeaveDates = new Set();
    approvedLeaves.forEach(leave => {
      let currentDate = new Date(leave.from);
      const endDate = new Date(leave.to);
      while (currentDate <= endDate) {
        approvedLeaveDates.add(formatDate(currentDate));
        currentDate = addDays(currentDate, 1);
      }
    });

    const selectedDates = new Set();
    let currentDate = new Date(fromDate);
    const endDate = new Date(toDate);
    while (currentDate <= endDate) {
      selectedDates.add(formatDate(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    const warnings = [];

    holidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const holidayStr = formatDate(holidayDate);
      const dayBefore = formatDate(addDays(holidayDate, -1));
      const dayAfter = formatDate(addDays(holidayDate, 1));

      const hasBeforeLeave = approvedLeaveDates.has(dayBefore) || selectedDates.has(dayBefore);
      const hasAfterLeave = approvedLeaveDates.has(dayAfter) || selectedDates.has(dayAfter);

      if (hasBeforeLeave && hasAfterLeave) {
        const newlyCreated = selectedDates.has(dayBefore) || selectedDates.has(dayAfter);
        if (newlyCreated) {
          warnings.push({
            type: 'holiday',
            message: `Your selected dates create a sandwich leave around '${holiday.name}' (${holidayStr}). Leaves on ${dayBefore} and ${dayAfter} surround this holiday.`
          });
        }
      }
    });

    selectedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      if (date.getDay() === 5) {
        const followingMonday = formatDate(addDays(date, 3));
        const hasMonday = approvedLeaveDates.has(followingMonday) || selectedDates.has(followingMonday);
        if (hasMonday && selectedDates.has(followingMonday)) {
          const message = `Your selected dates create a sandwich leave around the weekend. Leaves on ${dateStr} (Friday) and ${followingMonday} (Monday) surround the weekend.`;
          if (!warnings.some(w => w.message === message)) {
            warnings.push({ type: 'weekend', message });
          }
        }
      }
    });

    if (warnings.length > 0) {
      setSandwichWarning(warnings);
    } else {
      setSandwichWarning(null);
    }
  }, [filteredLeaveList, holidays]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = {
        ...prev,
        [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
      };
      
      if (name === "from" || name === "to") {
        const fromDate = name === "from" ? value : prev.from;
        const toDate = name === "to" ? value : prev.to;
        checkForSandwichLeave(fromDate, toDate);
      }
      
      return updated;
    });
    setSubmitError("");
    setSubmitSuccess("");
  };

  // Submit leave
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { from, to, reason, halfDaySession, leaveType } = form;
    if (!from || !to || !reason || !leaveType) {
      setSubmitError("All fields are required.");
      return;
    }
    
    if (sandwichWarning && sandwichWarning.length > 0) {
      setShowSandwichAlert(true);
      return;
    }
    
    await submitLeaveRequest();
  };

  // Actual submission function
  const submitLeaveRequest = async () => {
    const { from, to, reason, halfDaySession, leaveType } = form;
    setSubmitError("");
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

      let applied = false;
      if (typeof applyForLeave === "function") {
        try {
          await applyForLeave(payload);
          applied = true;
        } catch (err) {}
      }

      if (!applied) {
        const API_BASE = "http://localhost:5000/api/leaves";
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "Submit failed");
        }
      }

      playRequestSound();
      setSubmitSuccess("Leave request submitted successfully!");
      setForm({
        from: "",
        to: "",
        reason: "",
        halfDaySession: "",
        leaveType: "",
      });
      setSandwichWarning(null);
      setShowSandwichAlert(false);
      setShowForm(false);
      setModalOpen(false);
      await fetchLeaves();
      
      setTimeout(() => {
        setSubmitSuccess("");
      }, 3000);
    } catch (err) {
      console.error("submit error", err);
      setSubmitError(err?.message || "Failed to submit leave request.");
    }
  };

  // Cancel leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      let canceled = false;
      if (typeof cancelLeaveRequestById === "function") {
        try {
          await cancelLeaveRequestById(leaveId);
          canceled = true;
        } catch (err) {}
      }
      if (!canceled) {
        const API_BASE = "http://localhost:5000/api/leaves";
        let res = await fetch(`${API_BASE}/${leaveId}`, { method: "DELETE" });
        if (!res.ok) {
          res = await fetch(`${API_BASE}/${leaveId}/cancel`, { method: "POST" });
          if (!res.ok) throw new Error("Cancel failed");
        }
      }
      await fetchLeaves();
      alert("Leave request cancelled successfully!");
    } catch (err) {
      console.error("cancel error", err);
      alert("Failed to cancel the leave request.");
    }
  };

  // Toggle details
  const toggleDetails = async (leaveId) => {
    if (expandedId === leaveId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(leaveId);

    if (detailsMap[leaveId]) return;

    setLoadingDetails((prev) => ({ ...prev, [leaveId]: true }));
    setDetailsError((prev) => ({ ...prev, [leaveId]: "" }));
    try {
      const API_BASE = "http://localhost:5000/api/leaves";
      const res = await fetch(`${API_BASE}/${leaveId}/details`);
      if (!res.ok) {
        throw new Error("Details endpoint not available");
      }
      const d = await res.json();
      setDetailsMap((prev) => ({ ...prev, [leaveId]: Array.isArray(d) ? d : [] }));
    } catch (err) {
      console.warn("details fetch failed", err);
      setDetailsError((prev) => ({ ...prev, [leaveId]: "Details not available." }));
      setDetailsMap((prev) => ({ ...prev, [leaveId]: [] }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [leaveId]: false }));
    }
  };

  // Render status badge
  const renderStatusBadge = (status) => {
    const s = status || "Pending";
    const base = "px-3 py-1 rounded-full text-sm font-semibold shadow-sm ";
    if (s === "Pending") return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-300`}>{s}</span>;
    if (s === "Approved") return <span className={`${base} bg-green-100 text-green-800 border border-green-300`}>{s}</span>;
    if (s === "Rejected") return <span className={`${base} bg-red-100 text-red-800 border border-red-300`}>{s}</span>;
    if (s === "Cancelled") return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>{s}</span>;
    return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>{s}</span>;
  };

  // Format date for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === "-") return "-";
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Render
  if (loading) return (
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Leave Management</h1>
            <p className="text-gray-600">Welcome back, <span className="font-semibold text-blue-600">{user.name || user.employeeId}</span></p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200 mt-4 lg:mt-0"
          >
            📅 Apply for Leave
          </motion.button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Pending Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Pending Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingLeaves}</p>
                <p className="text-xs text-gray-500 mt-1">Remaining this year</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📥</span>
              </div>
            </div>
          </div>

          {/* Approved Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Approved Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.approvedLeaves}</p>
                <p className="text-xs text-gray-500 mt-1">Approved this month</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          {/* Extra Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Extra Leaves Taken</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.extraLeaves}</p>
                <p className="text-xs text-gray-500 mt-1">Beyond 1 leave this month</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
          </div>

          {/* Sandwich Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Sandwich Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.sandwichLeavesCount}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.sandwichDaysCount} days counted</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🥪</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full lg:w-64 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full lg:w-64 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 text-right">
              <button
                onClick={fetchLeaves}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition duration-200"
              >
                🔄 Refresh
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
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">From-To</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">HalfDay</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Applied</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Approved By</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details / Cancel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Loading leave requests...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeaveList.length > 0 ? (
                  filteredLeaveList.map((lv) => (
                    <React.Fragment key={lv._id}>
                      <tr className="hover:bg-blue-50 transition duration-150">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDisplayDate(lv.from)} 
                            <span className="mx-2 text-gray-400">→</span>
                            {formatDisplayDate(lv.to)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs">{lv.reason || "-"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {lv.halfDaySession || "Full Day"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {lv.leaveType || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{formatDisplayDate(lv.actionDate)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{formatDisplayDate(lv.requestDate)}</div>
                        </td>
                        <td className="px-6 py-4">
                          {renderStatusBadge(lv.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{lv.approvedBy || "-"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleDetails(lv._id)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 rounded-lg border border-blue-200 hover:border-blue-300 transition duration-200"
                            >
                              {expandedId === lv._id ? "Hide" : "Show"} Details
                            </button>
                            {lv.status === "Pending" && (
                              <button
                                onClick={() => handleCancelLeave(lv._id)}
                                className="text-red-600 hover:text-red-800 font-medium text-sm px-3 py-1 rounded-lg border border-red-200 hover:border-red-300 transition duration-200"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedId === lv._id && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <h4 className="font-semibold text-gray-900 mb-3">Leave Request Details</h4>
                              {loadingDetails[lv._id] ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                  <span className="ml-2 text-gray-600">Loading details...</span>
                                </div>
                              ) : detailsError[lv._id] ? (
                                <div className="text-center text-gray-500 py-4">{detailsError[lv._id]}</div>
                              ) : detailsMap[lv._id] && detailsMap[lv._id].length > 0 ? (
                                <div className="space-y-2">
                                  {detailsMap[lv._id].map((d, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                      <span className="text-sm font-medium text-gray-700">{d.date || "-"}</span>
                                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        d.leavecategory === "Paid" 
                                          ? "bg-green-100 text-green-800" 
                                          : "bg-red-100 text-red-800"
                                      }`}>
                                        {d.leavecategory || "-"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center text-gray-500 py-4">No additional details available.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">📝</span>
                        </div>
                        <p className="text-lg font-semibold mb-2">No leave requests found</p>
                        <p className="text-sm">No leaves found for {formatMonth(selectedMonth)} with status "{selectedStatus}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Sandwich Leaves Section */}
        {sandwichLeaves.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
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

      {/* Leave Application Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
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
                    <input 
                      type="date" 
                      name="from" 
                      value={form.from} 
                      onChange={handleChange}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                    <input 
                      type="date" 
                      name="to" 
                      value={form.to} 
                      onChange={handleChange}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                    />
                  </div>
                </div>

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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Leave Type</label>
                  <select 
                    name="leaveType" 
                    value={form.leaveType} 
                    onChange={handleChange}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                  >
                    <option value="">Select Leave Type</option>
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                    <option value="PAID">Paid Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason <span className="text-gray-400 text-xs">({form.reason.length}/{REASON_LIMIT})</span>
                  </label>
                  <input
                    type="text"
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    maxLength={REASON_LIMIT}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                    placeholder="Brief reason for your leave"
                  />
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sandwich Alert Modal */}
      <AnimatePresence>
        {showSandwichAlert && sandwichWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Sandwich Leave Detected</h3>
              </div>
              
              <div className="mb-6 space-y-3">
                {sandwichWarning.map((warning, index) => (
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
                    submitLeaveRequest();
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveWithModal;