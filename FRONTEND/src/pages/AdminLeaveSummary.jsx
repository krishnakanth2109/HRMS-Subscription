import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveAs } from "file-saver";
import { getLeaveRequests, getEmployees } from "../api";
import axios from "axios";

// --- LEAVE YEAR CONFIGURATION ---
const LEAVE_YEAR_START_MONTH = 11; // November

// --- HELPER FUNCTIONS ---

const getCurrentLeaveYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  let startYear = currentMonth < LEAVE_YEAR_START_MONTH ? currentYear - 1 : currentYear;

  const startDate = new Date(startYear, LEAVE_YEAR_START_MONTH - 1, 1);
  const endDate = new Date(startYear + 1, LEAVE_YEAR_START_MONTH - 1, 0);

  return { startDate, endDate };
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter || monthFilter === "All") return true;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split('-');
  return date.getFullYear() === parseInt(year) && 
         (date.getMonth() + 1) === parseInt(month);
};

const formatMonth = (monthStr) => {
  if (!monthStr || monthStr === "All") return "All Months";
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr === "-") return "-";
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const AdminLeaveSummary = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);

  const fetchHolidays = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/holidays");
      setHolidays(res.data);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const [leaves, employees] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
        ]);
        setAllRequests(leaves);

        const empMap = new Map(
          employees.map((emp) => [emp.employeeId, emp.name])
        );
        setEmployeesMap(empMap);
        
        await fetchHolidays();
      } catch (err) {
        console.error("Error fetching summary data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const enrichedRequests = useMemo(() => {
    return allRequests.map((req) => ({
      ...req,
      employeeName: employeesMap.get(req.employeeId) || "Unknown",
    }));
  }, [allRequests, employeesMap]);

  const allMonths = useMemo(() => {
    const months = new Set();
    enrichedRequests.forEach((req) => {
      if (req.from) months.add(req.from.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [enrichedRequests]);

  const calculateEmployeeSandwichLeaves = (employeeLeaves, month) => {
    const approvedLeaves = employeeLeaves.filter(leave => 
      leave.status === 'Approved' && 
      (month === "All" || isDateInMonth(leave.from, month) || isDateInMonth(leave.to, month))
    );
    
    if (approvedLeaves.length < 2 && holidays.length === 0) {
      return { count: 0, days: 0 };
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
      return { count: 0, days: 0 };
    }

    const sandwichLeaves = new Map();

    holidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const holidayStr = formatDate(holidayDate);
      
      if (month !== "All" && !isDateInMonth(holidayStr, month)) return;

      const dayBefore = addDays(holidayDate, -1);
      const dayAfter = addDays(holidayDate, 1);

      if (approvedLeaveDates.has(formatDate(dayBefore)) && approvedLeaveDates.has(formatDate(dayAfter))) {
        const key = `holiday-${formatDate(holidayDate)}`;
        if (!sandwichLeaves.has(key)) {
          sandwichLeaves.set(key, { type: 'holiday', days: 2 });
        }
      }
    });

    approvedLeaveDates.forEach(dateStr => {
      const date = new Date(dateStr);
      if (month !== "All" && !isDateInMonth(dateStr, month)) return;
      if (date.getDay() === 5) {
        const followingMonday = addDays(date, 3);
        const mondayStr = formatDate(followingMonday);
        if (month !== "All" && !isDateInMonth(mondayStr, month)) return;
        if (approvedLeaveDates.has(mondayStr)) {
          const key = `weekend-${dateStr}`;
          if (!sandwichLeaves.has(key)) {
            sandwichLeaves.set(key, { type: 'weekend', days: 2 });
          }
        }
      }
    });

    const count = sandwichLeaves.size;
    const days = Array.from(sandwichLeaves.values()).reduce((total, item) => total + item.days, 0);

    return { count, days };
  };

  const getSandwichLeaveReasons = (employeeId, leaveFrom, leaveTo) => {
    const reasons = [];
    const employeeLeaves = enrichedRequests.filter(req => 
      req.employeeId === employeeId && req.status === 'Approved'
    );
    
    const approvedLeaveDates = new Set();
    employeeLeaves.forEach(leave => {
      let currentDate = new Date(leave.from);
      const endDate = new Date(leave.to);
      while (currentDate <= endDate) {
        approvedLeaveDates.add(formatDate(currentDate));
        currentDate = addDays(currentDate, 1);
      }
    });

    const leaveFromDate = new Date(leaveFrom);
    const leaveToDate = new Date(leaveTo);
    
    holidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const holidayStr = formatDate(holidayDate);
      const dayBefore = formatDate(addDays(holidayDate, -1));
      const dayAfter = formatDate(addDays(holidayDate, 1));
      
      const leaveCoversDay = (dateStr) => {
        const date = new Date(dateStr);
        return date >= leaveFromDate && date <= leaveToDate;
      };
      
      if ((leaveCoversDay(dayBefore) && approvedLeaveDates.has(dayAfter)) ||
          (approvedLeaveDates.has(dayBefore) && leaveCoversDay(dayAfter))) {
        reasons.push(`Holiday Sandwich: Leave surrounds '${holiday.name}' (${holidayStr})`);
      }
    });

    let currentDate = new Date(leaveFrom);
    const endDate = new Date(leaveTo);
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      const dayOfWeek = currentDate.getDay();
      
      if (dayOfWeek === 5) { // Friday
        const followingMonday = formatDate(addDays(currentDate, 3));
        if (approvedLeaveDates.has(followingMonday) || 
            (new Date(followingMonday) >= leaveFromDate && new Date(followingMonday) <= leaveToDate)) {
          reasons.push(`Weekend Sandwich: Leave on Friday (${dateStr}) with Monday (${followingMonday})`);
        }
      }
      currentDate = addDays(currentDate, 1);
    }

    return reasons;
  };

  // Calculate employee statistics
  const employeeStats = useMemo(() => {
    const stats = new Map();
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date();
    const { startDate, endDate } = getCurrentLeaveYear();

    uniqueEmployees.forEach(([empId, empName]) => {
      const employeeLeaves = enrichedRequests.filter(req => req.employeeId === empId);
      
      // --- Yearly Pending Leaves Calculation ---
      const approvedLeavesThisYear = employeeLeaves.filter(leave => {
          const leaveDate = new Date(leave.from);
          return leave.status === 'Approved' && leaveDate >= startDate && leaveDate <= endDate;
      });
      const usedLeavesThisYear = approvedLeavesThisYear.length;

      let monthsPassed = 0;
      if (today >= startDate) {
          monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1;
      }
      const earnedLeavesThisYear = Math.max(0, monthsPassed);
      const pendingLeaves = Math.max(0, earnedLeavesThisYear - usedLeavesThisYear);

      // --- Monthly Stats Calculation ---
      const monthFilteredLeaves = employeeLeaves.filter(leave => 
        selectedMonth === "All" || 
        isDateInMonth(leave.from, selectedMonth) || 
        isDateInMonth(leave.to, selectedMonth)
      );

      const approvedLeaves = monthFilteredLeaves.filter(leave => leave.status === 'Approved');
      const approvedCount = approvedLeaves.length;
      // CORRECTED LOGIC: Extra leaves are those beyond 1 in a month
      const extraLeaves = approvedCount > 1 ? approvedCount - 1 : 0;
      
      const sandwichData = calculateEmployeeSandwichLeaves(employeeLeaves, selectedMonth);

      stats.set(empId, {
        employeeId: empId,
        employeeName: empName,
        pendingLeaves: pendingLeaves, // NEW
        approvedLeaves: approvedCount,
        extraLeaves: extraLeaves,
        sandwichLeavesCount: sandwichData.count,
        sandwichLeavesDays: sandwichData.days
      });
    });

    return Array.from(stats.values());
  }, [enrichedRequests, employeesMap, selectedMonth, holidays]);

  const filteredEmployeeStats = useMemo(() => {
    let filtered = [...employeeStats];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.employeeId.toLowerCase().includes(query) ||
        emp.employeeName.toLowerCase().includes(query)
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        return sortConfig.direction === 'asc' 
          ? aVal - bVal
          : bVal - aVal;
      });
    }

    return filtered;
  }, [employeeStats, searchQuery, sortConfig]);

  const totals = useMemo(() => {
    return filteredEmployeeStats.reduce((acc, emp) => ({
      pendingLeaves: acc.pendingLeaves + emp.pendingLeaves,
      approvedLeaves: acc.approvedLeaves + emp.approvedLeaves,
      extraLeaves: acc.extraLeaves + emp.extraLeaves,
      sandwichLeavesCount: acc.sandwichLeavesCount + emp.sandwichLeavesCount,
      sandwichLeavesDays: acc.sandwichLeavesDays + emp.sandwichLeavesDays,
    }), { pendingLeaves: 0, approvedLeaves: 0, extraLeaves: 0, sandwichLeavesCount: 0, sandwichLeavesDays: 0 });
  }, [filteredEmployeeStats]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportEmployeeStatsCSV = () => {
    const headers = ["Employee ID", "Employee Name", "Pending Leaves", "Approved Leaves", "Extra Leaves", "Sandwich Leaves", "Sandwich Days"];
    const rows = filteredEmployeeStats.map((emp) =>
      [emp.employeeId, `"${emp.employeeName}"`, emp.pendingLeaves, emp.approvedLeaves, emp.extraLeaves, emp.sandwichLeavesCount, emp.sandwichLeavesDays].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `employee_leave_stats_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleViewDetails = (employeeId) => {
    const employeeLeaves = enrichedRequests.filter(req => 
      req.employeeId === employeeId &&
      (selectedMonth === "All" || 
       isDateInMonth(req.from, selectedMonth) || 
       isDateInMonth(req.to, selectedMonth))
    );

    const sortedLeaves = employeeLeaves.sort((a, b) => 
      new Date(b.requestDate || b.from) - new Date(a.requestDate || a.from)
    );

    const leavesWithReasons = sortedLeaves.map(leave => ({
      ...leave,
      sandwichReasons: getSandwichLeaveReasons(employeeId, leave.from, leave.to)
    }));

    setEmployeeLeaveHistory(leavesWithReasons);
    setSelectedEmployee(employeeStats.find(emp => emp.employeeId === employeeId));
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800 font-semibold text-lg">Loading employee data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📊 Employee Leave Statistics
              </h1>
              <p className="text-gray-600">
                Comprehensive overview of all employee leave data
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportEmployeeStatsCSV}
              disabled={filteredEmployeeStats.length === 0}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200 mt-4 lg:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Export to CSV
            </motion.button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{filteredEmployeeStats.length}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totals.pendingLeaves}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Approved</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totals.approvedLeaves}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Extra</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totals.extraLeaves}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Sandwich Leaves</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totals.sandwichLeavesCount}</p>
                <p className="text-xs text-gray-500 mt-1">{totals.sandwichLeavesDays} days</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🥪</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔍 Search Employees
              </label>
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Filter by Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              >
                <option value="All">All Months</option>
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(searchQuery || selectedMonth !== "All") && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredEmployeeStats.length} employee{filteredEmployeeStats.length !== 1 ? 's' : ''}
                {selectedMonth !== "All" && ` for ${formatMonth(selectedMonth)}`}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedMonth("All");
                  setSortConfig({ key: null, direction: 'asc' });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900">Employee Leave Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              Click column headers to sort • {filteredEmployeeStats.length} total records
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('employeeId')} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-2">Employee ID{sortConfig.key === 'employeeId' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('employeeName')} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-2">Employee Name{sortConfig.key === 'employeeName' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('pendingLeaves')} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center justify-center gap-2">Pending Leaves{sortConfig.key === 'pendingLeaves' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('approvedLeaves')} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center justify-center gap-2">Approved Leaves{sortConfig.key === 'approvedLeaves' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('extraLeaves')} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center justify-center gap-2">LOP{sortConfig.key === 'extraLeaves' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('sandwichLeavesCount')} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center justify-center gap-2">Sandwich Leaves{sortConfig.key === 'sandwichLeavesCount' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('sandwichLeavesDays')} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center justify-center gap-2">Sandwich Days{sortConfig.key === 'sandwichLeavesDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredEmployeeStats.length > 0 ? (
                    filteredEmployeeStats.map((emp, index) => (
                      <motion.tr key={emp.employeeId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: index * 0.02 }} className="hover:bg-blue-50 transition duration-150">
                        <td className="px-6 py-4"><div className="text-sm font-bold text-gray-900">{emp.employeeId}</div></td>
                        <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{emp.employeeName}</div></td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full bg-blue-100 text-blue-800 font-bold text-sm shadow-sm">{emp.pendingLeaves}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full bg-green-100 text-green-800 font-bold text-sm shadow-sm">{emp.approvedLeaves}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${emp.extraLeaves > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{emp.extraLeaves}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${emp.sandwichLeavesCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>{emp.sandwichLeavesCount}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${emp.sandwichLeavesDays > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>{emp.sandwichLeavesDays}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => handleViewDetails(emp.employeeId)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-200 text-sm">View Details</button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-2xl">🔍</span></div>
                          <p className="text-lg font-semibold mb-2">No employees found</p>
                          <p className="text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">📋 Legend:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                <span><strong>Pending Leaves:</strong> Remaining leaves for the year (Nov-Oct)</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span><strong>Approved Leaves:</strong> Total approved in selected period</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                <span><strong>Extra Leaves:</strong> Leaves exceeding 1 per month</span>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showDetailsModal && selectedEmployee && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowDetailsModal(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white">
                      <h3 className="text-2xl font-bold">Leave History</h3>
                      <p className="text-blue-100 text-sm mt-1">{selectedEmployee.employeeName} ({selectedEmployee.employeeId})</p>
                    </div>
                    <button onClick={() => setShowDetailsModal(false)} className="text-white hover:text-gray-200 text-3xl font-bold transition">×</button>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="grid grid-cols-5 gap-4">
                     <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedEmployee.pendingLeaves}</p>
                      <p className="text-xs text-gray-600">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedEmployee.approvedLeaves}</p>
                      <p className="text-xs text-gray-600">Approved</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{selectedEmployee.extraLeaves}</p>
                      <p className="text-xs text-gray-600">Extra</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{selectedEmployee.sandwichLeavesCount}</p>
                      <p className="text-xs text-gray-600">Sandwich</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{selectedEmployee.sandwichLeavesDays}</p>
                      <p className="text-xs text-gray-600">Sandwich Days</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[60vh] p-6">
                  {employeeLeaveHistory.length > 0 ? (
                    <div className="space-y-4">
                      {employeeLeaveHistory.map((leave, index) => (
                        <motion.div key={leave._id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition duration-200">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-bold text-gray-900">{formatDisplayDate(leave.from)}<span className="mx-2 text-gray-400">→</span>{formatDisplayDate(leave.to)}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${leave.status === "Approved" ? "bg-green-100 text-green-800" : leave.status === "Rejected" ? "bg-red-100 text-red-800" : leave.status === "Pending" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>{leave.status}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><p className="text-gray-600 font-semibold">Leave Type:</p><p className="text-gray-900">{leave.leaveType || "-"}</p></div>
                                <div><p className="text-gray-600 font-semibold">Applied Date:</p><p className="text-gray-900">{formatDisplayDate(leave.requestDate || leave.createdAt)}</p></div>
                                <div className="col-span-2"><p className="text-gray-600 font-semibold">Reason:</p><p className="text-gray-900">{leave.reason || "-"}</p></div>
                                {leave.halfDaySession && (<div className="col-span-2"><p className="text-gray-600 font-semibold">Half Day Session:</p><p className="text-gray-900">{leave.halfDaySession}</p></div>)}
                              </div>
                            </div>
                          </div>
                          {leave.sandwichReasons && leave.sandwichReasons.length > 0 && (
                            <div className="mt-4 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-orange-600 text-xl mr-2">🥪</span>
                                <div className="flex-1">
                                  <p className="font-semibold text-orange-800 mb-2">Sandwich Leave Detected</p>
                                  {leave.sandwichReasons.map((reason, idx) => (<p key={idx} className="text-sm text-orange-700 mb-1">• {reason}</p>))}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-2xl">📭</span></div>
                      <p className="text-lg font-semibold mb-2">No leave history found</p>
                      <p className="text-sm">This employee has no leave records for the selected period</p>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button onClick={() => setShowDetailsModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-lg transition duration-200">Close</button>
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