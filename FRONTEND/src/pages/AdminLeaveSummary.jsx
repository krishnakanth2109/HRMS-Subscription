import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveAs } from "file-saver";
import { 
  FaSearch, FaFileDownload, FaEye, FaTimes, 
  FaCalendarAlt, FaFilter, FaUserTie, FaExclamationTriangle
} from "react-icons/fa";
import { 
  getLeaveRequests, 
  getEmployees, 
  getHolidays, 
  getAttendanceByDateRange, 
  getAllShifts            
} from "../api";

// --- HELPER FUNCTIONS ---

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Robust Date Formatter (YYYY-MM-DD)
const formatDate = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

// New specific filter check logic
const isDateInFilter = (dateStr, yearFilter, monthFilter) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, '0');

  if (yearFilter === "All") return true;
  if (yearFilter === y && monthFilter === "All") return true;
  return yearFilter === y && monthFilter === m;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr === "-") return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const MONTH_OPTIONS =[
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const AdminLeaveSummary = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const[holidays, setHolidays] = useState([]);
  
  // NEW: Separated Year and Month state
  const[selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const[showDetailsModal, setShowDetailsModal] = useState(false);
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);

  // Attendance & Shifts
  const [rawAttendance, setRawAttendance] = useState([]);
  const[shiftsMap, setShiftsMap] = useState({});

  const fetchHolidays = async () => {
    try {
      const data = await getHolidays();
      setHolidays(data ||[]);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const year = new Date().getFullYear();
        // Fetch long range to ensure we have all past available data
        const startOfYear = `${year - 10}-01-01`; 
        const todayStr = new Date().toISOString().split('T')[0];

        const[leaves, employees, attendanceData, shiftsData] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(startOfYear, todayStr),
          getAllShifts()
        ]);

        setAllRequests(leaves);
        setRawAttendance(Array.isArray(attendanceData) ? attendanceData :[]);

        const activeEmployees = employees.filter(emp => emp.isActive !== false);
        
        const empMap = new Map(
          activeEmployees.map((emp) => [emp.employeeId, emp.name])
        );
        setEmployeesMap(empMap);

        const sMap = {};
        if (Array.isArray(shiftsData)) {
            shiftsData.forEach(shift => {
                if (shift.employeeId) sMap[shift.employeeId] = shift;
            });
        } else if (shiftsData?.data) {
             shiftsData.data.forEach(shift => {
                if (shift.employeeId) sMap[shift.employeeId] = shift;
            });
        }
        setShiftsMap(sMap);

        await fetchHolidays();
      } catch (err) {
        console.error("Error fetching summary data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  },[]);

  // Dynamically calculate which years actually have data
  const availableYears = useMemo(() => {
    const years = new Set();
    years.add(new Date().getFullYear()); // Always ensure current year is an option
    
    allRequests.forEach(req => {
      if (req.from) years.add(new Date(req.from).getFullYear());
      if (req.to) years.add(new Date(req.to).getFullYear());
    });
    
    rawAttendance.forEach(att => {
      if (att.date) years.add(new Date(att.date).getFullYear());
    });
    
    return Array.from(years).sort((a, b) => b - a); // Sort descending
  }, [allRequests, rawAttendance]);

  const enrichedRequests = useMemo(
    () =>
      allRequests.map((req) => ({
        ...req,
        employeeName: employeesMap.get(req.employeeId) || "Unknown",
      })),[allRequests, employeesMap]
  );

  // --- CORE SANDWICH LOGIC ---
  const calculateSandwichData = (combinedLeaves, yearFilter, monthFilter) => {
    const activeLeaves = combinedLeaves.filter(
      (leave) =>
        isDateInFilter(leave.from, yearFilter, monthFilter) ||
        isDateInFilter(leave.to, yearFilter, monthFilter)
    );

    if (activeLeaves.length === 0 && holidays.length === 0) {
      return { count: 0, days: 0, details:[] };
    }

    const bookedMap = new Map();
    activeLeaves.forEach((leave) => {
      const isFullDay = !leave.halfDaySession;
      let curr = new Date(leave.from);
      const end = new Date(leave.to);
      while (curr <= end) {
        bookedMap.set(formatDate(curr), isFullDay);
        curr = addDays(curr, 1);
      }
    });

    let sandwichCount = 0;
    let sandwichDays = 0;
    const sandwichDetails =[];

    holidays.forEach((holiday) => {
      const hStartStr = formatDate(holiday.startDate);
      const hEndStr = formatDate(holiday.endDate || holiday.startDate);

      if (!isDateInFilter(hStartStr, yearFilter, monthFilter)) return;

      const hStart = new Date(hStartStr);
      const hEnd = new Date(hEndStr);
      
      const dayBeforeStr = formatDate(addDays(hStart, -1));
      const dayAfterStr = formatDate(addDays(hEnd, 1));

      const beforeIsFull = bookedMap.get(dayBeforeStr) === true;
      const afterIsFull = bookedMap.get(dayAfterStr) === true;

      if (beforeIsFull && afterIsFull) {
        const duration = calculateLeaveDays(hStart, hEnd);
        sandwichCount++;
        sandwichDays += duration;
        sandwichDetails.push(
          `Holiday Sandwich: '${holiday.name}' (${hStartStr})`
        );
      }
    });

    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay) continue;

      const d = new Date(dateStr);
      if (!isDateInFilter(dateStr, yearFilter, monthFilter)) continue;

      if (d.getDay() === 6) { 
        const mondayStr = formatDate(addDays(d, 2));
        if (bookedMap.get(mondayStr) === true) {
          sandwichCount++;
          sandwichDays += 1;
          sandwichDetails.push(
            `Weekend Sandwich: Sat (${dateStr}) & Mon (${mondayStr})`
          );
        }
      }
    }

    return { count: sandwichCount, days: sandwichDays, details: sandwichDetails };
  };

  // --- STATS CALCULATION (Per Employee) ---
  const employeeStats = useMemo(() => {
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date(); 
    today.setHours(0,0,0,0);

    return uniqueEmployees.map(([empId, empName]) => {
      const employeeLeaves = enrichedRequests.filter(
        (req) => req.employeeId === empId
      );

      const absents = [];
      const shift = shiftsMap[empId] || { weeklyOffDays: [0] }; 
      const weeklyOffs = shift.weeklyOffDays || [0];

      const employeePunches = new Set(
        rawAttendance
          .filter(r => r.employeeId === empId && r.punchIn)
          .map(r => formatDate(r.date))
      );

      let loopStart, loopEnd;

      if (selectedYear === "All") {
          const minYear = availableYears.length > 0 ? Math.min(...availableYears) : new Date().getFullYear();
          loopStart = new Date(minYear, 0, 1);
          loopEnd = new Date(); 
      } else if (selectedMonth === "All") {
          const y = parseInt(selectedYear);
          loopStart = new Date(y, 0, 1);
          loopEnd = new Date(y, 11, 31);
          if (loopEnd > today) loopEnd = new Date();
      } else {
          const y = parseInt(selectedYear);
          const m = parseInt(selectedMonth);
          loopStart = new Date(y, m - 1, 1);
          loopEnd = new Date(y, m, 0); 
          if (loopEnd > today) loopEnd = new Date(); 
      }

      const appliedLeaveDates = new Set();
      employeeLeaves.forEach(l => {
          if(l.status === 'Approved' || l.status === 'Pending') {
              let c = new Date(l.from);
              const e = new Date(l.to);
              while(c <= e) {
                  appliedLeaveDates.add(formatDate(c));
                  c = addDays(c, 1);
              }
          }
      });

      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDate(d); 
          const dayOfWeek = d.getDay();

          const isHol = holidays.some(h => {
             const startStr = formatDate(h.startDate);
             const endStr = formatDate(h.endDate || h.startDate);
             return dateStr >= startStr && dateStr <= endStr;
          });

          if (isHol) continue; 
          if (weeklyOffs.includes(dayOfWeek)) continue; 
          if (employeePunches.has(dateStr)) continue; 
          if (appliedLeaveDates.has(dateStr)) continue; 

          absents.push({
              _id: `absent-${empId}-${dateStr}`,
              from: dateStr,
              to: dateStr,
              status: "Approved", 
              leaveType: "Absent (System)",
              reason: "Not Logged In",
              isAbsentRecord: true
          });
      }

      const approvedLeavesOnly = employeeLeaves.filter(
        (leave) => leave.status === "Approved"
      );
      
      const leavesInMonth = approvedLeavesOnly.filter(
          (leave) =>
            isDateInFilter(leave.from, selectedYear, selectedMonth) ||
            isDateInFilter(leave.to, selectedYear, selectedMonth)
      );

      const normalLeaveDays = leavesInMonth.reduce(
        (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
        0
      );

      const absentDaysCount = absents.length;
      
      const sandwichData = calculateSandwichData([...approvedLeavesOnly, ...absents], 
        selectedYear, 
        selectedMonth
      );

      const totalConsumed = normalLeaveDays + absentDaysCount + sandwichData.days;
      
      // Basic credit logic, customize as needed
      const monthlyCredit = (selectedMonth === "All" && selectedYear !== "All") ? 12 : 1; 
      const pendingLeaves = Math.max(0, monthlyCredit - totalConsumed);
      const extraLeaves = Math.max(0, totalConsumed - monthlyCredit);

      return {
        employeeId: empId,
        employeeName: empName,
        pendingLeaves,
        totalLeaveDays: totalConsumed,
        normalLeaveDays, 
        absentDays: absentDaysCount, 
        extraLeaves,
        sandwichLeavesCount: sandwichData.count,
        sandwichLeavesDays: sandwichData.days,
        sandwichDetails: sandwichData.details,
        rawLeaves: employeeLeaves,
        rawAbsents: absents 
      };
    });
  },[enrichedRequests, employeesMap, selectedYear, selectedMonth, holidays, rawAttendance, shiftsMap, availableYears]);

  const filteredEmployeeStats = useMemo(() => {
    let filtered =[...employeeStats];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.employeeId.toLowerCase().includes(query) ||
          emp.employeeName.toLowerCase().includes(query)
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [employeeStats, searchQuery, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const exportEmployeeStatsCSV = () => {
    const headers =[
      "Employee ID",
      "Employee Name",
      "Pending Leaves",
      "Total Leave Days",
      "Applied Leaves",
      "Absent Days", 
      "Extra Leaves (LOP)",
      "Sandwich Count",
      "Sandwich Days",
    ];
    const rows = filteredEmployeeStats.map((emp) =>[
        emp.employeeId,
        `"${emp.employeeName}"`,
        emp.pendingLeaves,
        emp.totalLeaveDays,
        emp.normalLeaveDays,
        emp.absentDays,
        emp.extraLeaves,
        emp.sandwichLeavesCount,
        emp.sandwichLeavesDays,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `employee_leave_stats_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleViewDetails = (employeeId) => {
    const empStats = employeeStats.find((emp) => emp.employeeId === employeeId);
    if(!empStats) return;

    const leaves = empStats.rawLeaves.filter(
        (req) =>
          isDateInFilter(req.from, selectedYear, selectedMonth) ||
          isDateInFilter(req.to, selectedYear, selectedMonth)
    );
    
    const mergedHistory =[...leaves, ...empStats.rawAbsents].sort(
      (a, b) =>
        new Date(b.from) - new Date(a.from)
    );

    setEmployeeLeaveHistory(mergedHistory);
    setSelectedEmployee(empStats);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-semibold text-sm">
            Loading employee data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FaCalendarAlt className="text-blue-600" /> Employee Leave Statistics
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
              Comprehensive overview including Applied Leaves and Unplanned Absents.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportEmployeeStatsCSV}
            disabled={filteredEmployeeStats.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FaFileDownload size={16} /> Export to CSV
          </motion.button>
        </motion.div>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            <div className="md:col-span-6 relative">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Search Employees
              </label>
              <FaSearch className="absolute left-4 top-[35px] text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Filter Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
              >
                <option value="All">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Filter Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={selectedYear === "All"}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="All">All Months</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(searchQuery || selectedYear !== "All" || selectedMonth !== "All") && (
            <div className="mt-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs font-semibold text-blue-800 flex items-center gap-2">
                <FaFilter />
                Showing {filteredEmployeeStats.length} employee{filteredEmployeeStats.length !== 1 ? "s" : ""}
                {(selectedYear !== "All" || selectedMonth !== "All") &&
                  ` for ${selectedMonth !== "All" ? MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label + " " : ""}${selectedYear !== "All" ? selectedYear : ""}`}
              </div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedYear("All");
                  setSelectedMonth("All");
                  setSortConfig({ key: null, direction: "asc" });
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-white px-3 py-1.5 rounded-md border border-blue-200 shadow-sm"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>

        {/* Main Data Table Wrapper (With requested classes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-bold tracking-wider sticky top-0 z-20 shadow-sm">
                <tr>
                  <th onClick={() => handleSort("employeeId")} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition w-20">ID</th>
                  <th onClick={() => handleSort("employeeName")} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition">Employee</th>
                  <th onClick={() => handleSort("pendingLeaves")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Pending</th>
                  <th onClick={() => handleSort("totalLeaveDays")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Total Days Used</th>
                  <th onClick={() => handleSort("extraLeaves")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Extra (LOP)</th>
                  <th onClick={() => handleSort("sandwichLeavesDays")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Sandwich Days</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <AnimatePresence>
                  {filteredEmployeeStats.length > 0 ? (
                    filteredEmployeeStats.map((emp, index) => (
                      <motion.tr
                        key={emp.employeeId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.01 }}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">{emp.employeeId}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                              {emp.employeeName.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800">{emp.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${emp.pendingLeaves === 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                            {emp.pendingLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-green-50 text-green-700 font-bold text-xs shadow-sm border border-green-100">
                              {emp.totalLeaveDays}
                            </span>
                            <span className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">
                              {emp.normalLeaveDays} App + {emp.absentDays} Abs + {emp.sandwichLeavesDays} SW
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${emp.extraLeaves > 0 ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {emp.extraLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${emp.sandwichLeavesDays > 0 ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {emp.sandwichLeavesDays}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(emp.employeeId)}
                            className="bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg transition duration-200 text-xs flex items-center gap-1.5 mx-auto shadow-sm tooltip-container"
                            title="View detailed history"
                          >
                            <FaEye size={12} /> Details
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                           <FaUserTie size={32} className="mb-3 opacity-20" />
                           <p className="text-sm font-semibold text-gray-500">No employee records found matching your criteria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              📋 Statistical Legend:
            </h4>
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
                <span><strong className="text-gray-800">Pending:</strong> Monthly Credit - Consumed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-sm"></span>
                <span><strong className="text-gray-800">Total:</strong> Applied + Absent + Sandwich</span>
              </div>
              <div className="flex items-center gap-1.5">
                 <span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span>
                 <span><strong className="text-gray-800">Absent:</strong> Unplanned missing punch</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* DETAILS MODAL */}
        <AnimatePresence>
          {showDetailsModal && selectedEmployee && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setShowDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl border border-blue-100">
                       {selectedEmployee.employeeName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{selectedEmployee.employeeName}</h3>
                      <p className="text-xs font-mono text-gray-500 mt-0.5">ID: {selectedEmployee.employeeId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                {/* Modal Stats Row */}
                <div className="bg-gray-50/80 px-6 py-5 border-b border-gray-200 grid grid-cols-5 gap-3 shrink-0">
                  <div className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-xl font-black text-blue-600">{selectedEmployee.pendingLeaves}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Consumed</p>
                    <p className="text-xl font-black text-green-600">{selectedEmployee.totalLeaveDays}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Extra (LOP)</p>
                    <p className="text-xl font-black text-orange-600">{selectedEmployee.extraLeaves}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Absents</p>
                    <p className="text-xl font-black text-red-600">{selectedEmployee.absentDays}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sandwich</p>
                    <p className="text-xl font-black text-purple-600">{selectedEmployee.sandwichLeavesDays}</p>
                  </div>
                </div>

                {/* Modal Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                   {selectedEmployee.sandwichDetails && selectedEmployee.sandwichDetails.length > 0 && (
                      <div className="mb-6 bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <FaExclamationTriangle className="text-orange-500 mt-0.5" size={16} />
                          <div className="flex-1">
                            <p className="font-bold text-orange-800 text-sm mb-1.5">
                              Sandwich Leaves Detected
                            </p>
                            <ul className="space-y-1">
                              {selectedEmployee.sandwichDetails.map((reason, idx) => (
                                <li key={idx} className="text-xs font-medium text-orange-700">
                                  • {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                  {employeeLeaveHistory.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-gray-800 mb-3 border-b border-gray-100 pb-2">Leave & Absent Records</h4>
                      {employeeLeaveHistory.map((leave, index) => {
                          const isAbsentRecord = leave.isAbsentRecord;
                          return (
                            <div
                              key={leave._id || index}
                              className={`border p-4 rounded-xl transition hover:shadow-md ${
                                  isAbsentRecord ? "bg-red-50/50 border-red-100" : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-800">
                                    {formatDisplayDate(leave.from)}
                                    {leave.from !== leave.to && (
                                        <>
                                          <span className="mx-2 text-gray-400 text-xs">to</span>
                                          {formatDisplayDate(leave.to)}
                                        </>
                                    )}
                                  </span>
                                </div>
                                {isAbsentRecord ? (
                                    <span className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-800 border border-red-200 shadow-sm">
                                        ABSENT (No Punch)
                                    </span>
                                ) : (
                                    <span
                                      className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider shadow-sm border ${
                                        leave.status === "Approved"
                                          ? "bg-green-50 text-green-700 border-green-200"
                                          : leave.status === "Rejected"
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : leave.status === "Pending"
                                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                          : "bg-gray-50 text-gray-700 border-gray-200"
                                      }`}
                                    >
                                      {leave.status}
                                    </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Type:</span>
                                  <span className="font-bold text-gray-700">{leave.leaveType || "Absent"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
                                    {isAbsentRecord ? "Detected:" : "Applied:"}
                                  </span>
                                  <span className="font-medium text-gray-700">
                                    {formatDisplayDate(leave.requestDate || leave.createdAt || leave.from)}
                                  </span>
                                </div>
                                <div className="md:col-span-2 bg-white/60 p-2 rounded border border-gray-100 mt-1">
                                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block mb-0.5">Reason:</span>
                                  <span className="text-gray-700 italic font-medium">
                                    "{leave.reason || "System marked as absent due to missing punch"}"
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-sm font-semibold">No history records found.</p>
                    </div>
                  )}
                </div>
                
                {/* Modal Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition duration-200 shadow-sm"
                  >
                    Close Window
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminLeaveSummary;