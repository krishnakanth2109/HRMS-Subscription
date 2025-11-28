import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLeaveRequestsForEmployee,
  applyForLeave,
  cancelLeaveRequestById,
  getHolidays,
  getLeaveRequests, // To fetch other leaves
  getEmployees      // Added to fetch names
} from "../api";

const REASON_LIMIT = 50;

// --- LEAVE YEAR CONFIGURATION ---
const LEAVE_YEAR_START_MONTH = 1; // Nov

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

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
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

const getNextMonth = (monthStr) => {
  const { year, month } = getMonthFromString(monthStr);
  let nextYear = year;
  let nextMonth = month + 1;
  
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
};

const EmployeeLeavemanagement = () => {
  const [user, setUser] = useState(null);
  
  // Block past dates
  const today = new Date().toISOString().split("T")[0];
  
  // Holiday state
  const [holidays, setHolidays] = useState([]);
  const [sandwichLeaves, setSandwichLeaves] = useState([]);

  // All Employees Approved Leaves (For View & Overlap Check)
  const [allApprovedLeaves, setAllApprovedLeaves] = useState([]);
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
  
  // Overlap States
  const [overlappingColleagues, setOverlappingColleagues] = useState([]);
  const [expandOverlaps, setExpandOverlaps] = useState(false); // To toggle "Show all"

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
  
  // Sandwich leave warning state
  const [sandwichWarning, setSandwichWarning] = useState(null);
  const [showSandwichAlert, setShowSandwichAlert] = useState(false);

  // Stats states
  const [stats, setStats] = useState({
    monthlyAvailable: 1,    
    totalLeaveDays: 0,      
    extraLeaves: 0,         
    sandwichLeavesCount: 0, 
    sandwichDaysCount: 0,   
    pendingLeaves: 0,       
  });

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

  // Calculate MONTHLY stats
  useEffect(() => {
    if (!leaveList.length) return;

    const { startDate, endDate } = getCurrentLeaveYear();
    const currentMonthYear = selectedMonth;

    const { year: currentYear, month: currentMonth } = getMonthFromString(currentMonthYear);
    const { year: startYear, month: startMonth } = getMonthFromString(`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`);
    
    const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;
    const totalEarnedLeaves = Math.max(1, totalMonths); 

    const usedLeaves = leaveList.filter(leave => {
      if (leave.status !== 'Approved') return false;
      const leaveDate = new Date(leave.from);
      const leaveMonthYear = `${leaveDate.getFullYear()}-${String(leaveDate.getMonth() + 1).padStart(2, '0')}`;
      const leaveCompare = parseInt(leaveMonthYear.replace('-', ''));
      const currentCompare = parseInt(currentMonthYear.replace('-', ''));
      return leaveCompare <= currentCompare && leaveDate >= startDate && leaveDate <= endDate;
    }).length;

    const availableLeaves = Math.max(0, totalEarnedLeaves - usedLeaves);

    setStats(prev => ({
      ...prev,
      monthlyAvailable: availableLeaves,
      pendingLeaves: availableLeaves
    }));

  }, [leaveList, selectedMonth]);

  useEffect(() => {
    const approvedLeavesInMonth = filteredLeaveList.filter(leave => leave.status === 'Approved');
    const totalApprovedDays = approvedLeavesInMonth.reduce((total, leave) => {
      return total + calculateLeaveDays(leave.from, leave.to);
    }, 0);

    const extraLeavesInMonth = Math.max(0, totalApprovedDays - 1);
    const sandwichCount = sandwichLeaves.length;
    const sandwichDays = sandwichLeaves.reduce((total, sandwich) => {
      return total + 2;
    }, 0);

    setStats(prev => ({
      ...prev,
      totalLeaveDays: totalApprovedDays,
      extraLeaves: extraLeavesInMonth,
      sandwichLeavesCount: sandwichCount,
      sandwichDaysCount: sandwichDays,
    }));
  }, [filteredLeaveList, sandwichLeaves]);
  
  const fetchHolidays = useCallback(async () => {
    try {
      const data = await getHolidays();
      const formatted = data.map((h) => ({
        ...h,
        start: normalize(h.startDate),
        end: normalize(h.endDate || h.startDate), 
      }));
      setHolidays(formatted);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  }, []);

  // Fetch ALL leaves & Employees for overlap detection and team view
  const fetchAllEmployeesLeaves = useCallback(async () => {
    try {
      // Fetch both leaves and employee details to map names correctly
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
    } catch (err) {
      console.error("Error fetching all leaves/employees:", err);
    }
  }, []);

  // Fetch individual leaves
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
      fetchAllEmployeesLeaves(); // Trigger global fetch
    }
  }, [user, fetchLeaves, fetchHolidays, fetchAllEmployeesLeaves]);

  // --- SANDWICH LOGIC ---
  const calculateSandwichLeaves = useCallback(() => {
    const approvedLeaves = filteredLeaveList.filter(leave => leave.status === 'Approved');
    if (approvedLeaves.length === 0 && holidays.length === 0) {
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

    const newSandwichLeaves = [];
    const nextMonth = getNextMonth(selectedMonth);

    holidays.forEach(holiday => {
      let currentHoliDate = new Date(holiday.start);
      const endHoliDate = new Date(holiday.end);

      while (currentHoliDate <= endHoliDate) {
        const holidayStr = formatDate(currentHoliDate);
        const isInSelectedMonth = isDateInMonth(holidayStr, selectedMonth);
        const isInNextMonth = isDateInMonth(holidayStr, nextMonth);
        
        if (!isInSelectedMonth && !isInNextMonth) {
          currentHoliDate = addDays(currentHoliDate, 1);
          continue;
        }

        const dayBefore = addDays(currentHoliDate, -1);
        const dayAfter = addDays(currentHoliDate, 1);
        const dayBeforeStr = formatDate(dayBefore);
        const dayAfterStr = formatDate(dayAfter);

        const hasLeaveBefore = approvedLeaveDates.has(dayBeforeStr);
        const hasLeaveAfter = approvedLeaveDates.has(dayAfterStr);

        if (hasLeaveBefore && hasLeaveAfter) {
          const existingPattern = newSandwichLeaves.find(pattern => 
            pattern.dates.includes(holidayStr)
          );

          if (!existingPattern) {
            const monthContext = isInSelectedMonth ? selectedMonth : nextMonth;
            newSandwichLeaves.push({
              dates: `${dayBeforeStr}, ${holiday.name} (${holidayStr}), ${dayAfterStr}`,
              reason: `Leave approved on the day before and after the '${holiday.name}' holiday.`,
              month: monthContext,
              type: 'holiday'
            });
          }
        }
        currentHoliDate = addDays(currentHoliDate, 1);
      }
    });

    approvedLeaveDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const isInSelectedMonth = isDateInMonth(dateStr, selectedMonth);
      if (!isInSelectedMonth) return;

      if (date.getDay() === 6) { // Saturday
        const followingMonday = addDays(date, 2);
        const mondayStr = formatDate(followingMonday);
        const isMondayInSelectedMonth = isDateInMonth(mondayStr, selectedMonth);
        const isMondayInNextMonth = isDateInMonth(mondayStr, nextMonth);
        
        if (isMondayInSelectedMonth || isMondayInNextMonth) {
          if (approvedLeaveDates.has(mondayStr)) {
            const existingPattern = newSandwichLeaves.find(pattern => 
              pattern.dates.includes(dateStr) && pattern.dates.includes(mondayStr)
            );

            if (!existingPattern) {
              newSandwichLeaves.push({
                dates: `${dateStr} (Saturday) → ${mondayStr} (Monday)`,
                reason: 'Leave approved on a Saturday and the following Monday, sandwiching Sunday.',
                month: selectedMonth,
                type: 'weekend'
              });
            }
          }
        }
      }

      if (date.getDay() === 5) { // Friday
        const followingSunday = addDays(date, 2);
        const sundayStr = formatDate(followingSunday);
        if (isDateInMonth(sundayStr, selectedMonth)) {
          if (approvedLeaveDates.has(sundayStr)) {
            const existingPattern = newSandwichLeaves.find(pattern => 
              pattern.dates.includes(dateStr) && pattern.dates.includes(sundayStr)
            );

            if (!existingPattern) {
              newSandwichLeaves.push({
                dates: `${dateStr} (Friday) → ${sundayStr} (Sunday)`,
                reason: 'Leave approved on a Friday and the following Sunday.',
                month: selectedMonth,
                type: 'weekend'
              });
            }
          }
        }
      }
      
      // Friday to Tuesday Check
      if (date.getDay() === 5) {
        const followingTuesday = addDays(date, 4);
        const tuesdayStr = formatDate(followingTuesday);
        
        const isTuesdayInSelectedMonth = isDateInMonth(tuesdayStr, selectedMonth);
        const isTuesdayInNextMonth = isDateInMonth(tuesdayStr, nextMonth);
        
        if ((isTuesdayInSelectedMonth || isTuesdayInNextMonth) && approvedLeaveDates.has(tuesdayStr)) {
          const monday = addDays(date, 3);
          const mondayStr = formatDate(monday);
          const hasHolidayOnMonday = holidays.some(holiday => {
            let currentHoliDate = new Date(holiday.start);
            const endHoliDate = new Date(holiday.end);
            while (currentHoliDate <= endHoliDate) {
              if (formatDate(currentHoliDate) === mondayStr) return true;
              currentHoliDate = addDays(currentHoliDate, 1);
            }
            return false;
          });

          if (hasHolidayOnMonday) {
            const existingPattern = newSandwichLeaves.find(pattern => 
              pattern.dates.includes(dateStr) && pattern.dates.includes(tuesdayStr)
            );

            if (!existingPattern) {
              newSandwichLeaves.push({
                dates: `${dateStr} (Friday) → Holiday (Monday) → ${tuesdayStr} (Tuesday)`,
                reason: 'Leave approved on Friday and Tuesday, sandwiching a holiday weekend.',
                month: selectedMonth,
                type: 'extended-weekend'
              });
            }
          }
        }
      }
    });

    setSandwichLeaves(newSandwichLeaves);
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
    const nextMonth = getNextMonth(selectedMonth);

    holidays.forEach(holiday => {
      let currentHoliDate = new Date(holiday.start);
      const endHoliDate = new Date(holiday.end);

      while (currentHoliDate <= endHoliDate) {
        const holidayStr = formatDate(currentHoliDate);
        const dayBefore = formatDate(addDays(currentHoliDate, -1));
        const dayAfter = formatDate(addDays(currentHoliDate, 1));

        const isHolidayInScope = isDateInMonth(holidayStr, selectedMonth) || 
                                isDateInMonth(holidayStr, nextMonth);

        if (isHolidayInScope) {
          const hasBeforeLeave = approvedLeaveDates.has(dayBefore) || selectedDates.has(dayBefore);
          const hasAfterLeave = approvedLeaveDates.has(dayAfter) || selectedDates.has(dayAfter);

          if (hasBeforeLeave && hasAfterLeave) {
            const newlyCreated = selectedDates.has(dayBefore) || selectedDates.has(dayAfter);
            if (newlyCreated) {
              const monthContext = isDateInMonth(holidayStr, selectedMonth) ? 'this month' : 'next month';
              const msg = `Your selected dates create a sandwich leave around '${holiday.name}' (${holidayStr}) in ${monthContext}. Leaves on ${dayBefore} and ${dayAfter} surround this holiday.`;
              if(!warnings.some(w => w.message === msg)) {
                warnings.push({
                  type: 'holiday',
                  message: msg
                });
              }
            }
          }
        }
        currentHoliDate = addDays(currentHoliDate, 1);
      }
    });

    selectedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      if (date.getDay() === 6) { 
        const followingMonday = formatDate(addDays(date, 2));
        const isMondayInScope = isDateInMonth(followingMonday, selectedMonth) || 
                               isDateInMonth(followingMonday, nextMonth);
        
        if (isMondayInScope) {
          const hasMonday = approvedLeaveDates.has(followingMonday) || selectedDates.has(followingMonday);
          if (hasMonday) {
            const monthContext = isDateInMonth(followingMonday, selectedMonth) ? 'this month' : 'next month';
            const message = `Your selected dates create a sandwich leave around Sunday. Leaves on ${dateStr} (Saturday) and ${followingMonday} (Monday) in ${monthContext} will surround Sunday.`;
            if (!warnings.some(w => w.message === message)) {
              warnings.push({ type: 'weekend', message });
            }
          }
        }
      }

      if (date.getDay() === 5) { 
        const followingSunday = formatDate(addDays(date, 2));
        if (isDateInMonth(followingSunday, selectedMonth)) {
          const hasSunday = approvedLeaveDates.has(followingSunday) || selectedDates.has(followingSunday);
          if (hasSunday) {
            const message = `Your selected dates create a sandwich leave. Leaves on ${dateStr} (Friday) and ${followingSunday} (Sunday) will surround Saturday.`;
            if (!warnings.some(w => w.message === message)) {
              warnings.push({ type: 'weekend', message });
            }
          }
        }
      }
    });

    if (warnings.length > 0) {
      setSandwichWarning(warnings);
    } else {
      setSandwichWarning(null);
    }
  }, [filteredLeaveList, holidays, selectedMonth]);

  // Check Overlaps with Colleagues
  const checkColleagueOverlaps = useCallback((fromDate, toDate) => {
    if(!fromDate || !toDate) {
      setOverlappingColleagues([]);
      setExpandOverlaps(false); // Reset expansion on date change
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

  // Handle input changes with auto-reset & min date logic
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      let updated = {
        ...prev,
        [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
      };

      // Prevent selecting past dates at state level too (extra safety)
      if (name === "from" && value < today) {
        updated.from = today;
      }
      if (name === "to" && value < today) {
        updated.to = today;
      }

      // Auto-reset To when From changes
      if (name === "from") {
        if (updated.to && updated.to < value) {
          updated.to = value;
        }
      }

      // Auto-correct To if user manually picks older than From
      if (name === "to") {
        if (updated.from && value < updated.from) {
          updated.to = updated.from;
        }
      }

      const fromDate = updated.from;
      const toDate = updated.to;

      if (fromDate && toDate) {
        checkForSandwichLeave(fromDate, toDate);
        checkColleagueOverlaps(fromDate, toDate);
      } else {
        setSandwichWarning(null);
        setOverlappingColleagues([]);
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
      setOverlappingColleagues([]); 
      setShowSandwichAlert(false);
      setModalOpen(false);
      await fetchLeaves();
      await fetchAllEmployeesLeaves(); 
      
      setTimeout(() => {
        setSubmitSuccess("");
      }, 3000);
    } catch (err) {
      console.error("submit error", err);
      setSubmitError(err?.message || "Failed to submit leave request.");
    }
  };

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
      fetchAllEmployeesLeaves(); // Sync
      alert("Leave request cancelled successfully!");
    } catch (err) {
      console.error("cancel error", err);
      alert("Failed to cancel the leave request.");
    }
  };

  const renderStatusBadge = (status) => {
    const s = status || "Pending";
    const base = "px-3 py-1 rounded-full text-sm font-semibold shadow-sm ";
    if (s === "Pending") return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-300`}>{s}</span>;
    if (s === "Approved") return <span className={`${base} bg-green-100 text-green-800 border border-green-300`}>{s}</span>;
    if (s === "Rejected") return <span className={`${base} bg-red-100 text-red-800 border border-red-300`}>{s}</span>;
    if (s === "Cancelled") return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>{s}</span>;
    return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>{s}</span>;
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
    
    // Filter leaves where 'to' date is today or later
    return allApprovedLeaves
      .filter(l => {
        const endDate = new Date(l.to);
        endDate.setHours(0,0,0,0);
        return endDate >= todayDate && l.employeeId !== user?.employeeId;
      })
      .sort((a, b) => new Date(a.from) - new Date(b.from));
  }, [allApprovedLeaves, user]);

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
          
          <div className="flex gap-3 mt-4 lg:mt-0">
            {/* NEW BUTTON: Upcoming Team Leaves */}
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
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200"
            >
              📅 Apply for Leave
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8"
        >
          {/* Pending Leaves Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Pending Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingLeaves}</p>
                <p className="text-xs text-gray-500 mt-1">Your Available Leaves</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📥</span>
              </div>
            </div>
          </div>

          {/* Total Leave Days Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Leave Days</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalLeaveDays}</p>
                <p className="text-xs text-gray-500 mt-1">Days used this month</p>
              </div>
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                 <span className="text-2xl">📅</span>
              </div>
            </div>
          </div>

          {/* Approved Leaves Card (Counts requests) */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Approved Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{filteredLeaveList.filter(l => l.status === 'Approved').length}</p>
                <p className="text-xs text-gray-500 mt-1">Requests this month</p>
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
                <p className="text-xs text-gray-500 mt-1">Beyond 1 day this month</p>
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
                onClick={() => { fetchLeaves(); fetchAllEmployeesLeaves(); }}
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
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
                    <tr key={lv._id} className="hover:bg-blue-50 transition duration-150">
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

      {/* NEW MODAL: Upcoming Team Leaves */}
      <AnimatePresence>
        {upcomingModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
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
                  <h3 className="text-xl font-bold text-indigo-900">Upcoming Team Leaves</h3>
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
                           {/* Replaced Avatar with simple Name/ID Layout */}
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
                      min={today}
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
                      min={form.from || today}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                    />
                  </div>
                </div>

                {/* --- NEW OVERLAP NOTICE with VIEW ALL --- */}
                {overlappingColleagues.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-blue-700 uppercase mb-2">
                      📅 Heads up! Others on leave:
                    </p>
                    <ul className="text-xs text-blue-800 space-y-2">
                      {/* Show items: If expand is true show all, otherwise show top 3 */}
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

                    {/* Toggle Button for "View All" */}
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

export default EmployeeLeavemanagement;
