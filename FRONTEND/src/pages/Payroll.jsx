import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import { FaFileExcel, FaSearch, FaCalendarAlt, FaChartBar } from "react-icons/fa";
import axios from "axios";
import { getAttendanceByDateRange, getLeaveRequests, getEmployees } from "../api";

// Fetch all overtime requests
const getAllOvertimeRequests = async () => {
  try {
    const response = await axios.get("http://localhost:5000/api/overtime");
    return response.data;
  } catch (error) {
    console.error("Error fetching overtime requests:", error);
    return [];
  }
};

// Fetch holidays
const getHolidays = async () => {
  try {
    const response = await axios.get("http://localhost:5000/api/holidays");
    return response.data;
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return [];
  }
};

// Helper function to calculate worked status
const getWorkedStatus = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return "Working..";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= 8) return "Full Day";
  else if (workedHours >= 4) return "Half Day";
  else if (workedHours > 0) return "Quarter Day";
  else return "N/A";
};

// Helper functions for sandwich leave calculation
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter || monthFilter === "All") return true;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split('-');
  return date.getFullYear() === parseInt(year) && 
         (date.getMonth() + 1) === parseInt(month);
};

const UnifiedEmployeeReport = () => {
  const todayISO = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(new Date().setDate(1)).toISOString().split("T")[0];

  // State management
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Data states
  const [attendanceData, setAttendanceData] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [employees, holidays] = await Promise.all([
          getEmployees(),
          getHolidays()
        ]);

        console.log("Employees fetched:", employees.length);
        
        // Create employee map
        const empMap = new Map(employees.map(emp => [emp.employeeId, emp.name]));
        setEmployeesMap(empMap);
        setHolidays(holidays);

        // Fetch attendance data
        const attendance = await getAttendanceByDateRange(startDate, endDate);
        console.log("Attendance records fetched:", attendance.length);
        
        // Process attendance data
        const processedAttendance = attendance.map(item => ({
          ...item,
          workedStatus: getWorkedStatus(item.punchIn, item.punchOut)
        }));
        setAttendanceData(processedAttendance);

        // Fetch overtime data
        const overtime = await getAllOvertimeRequests();
        console.log("Overtime requests fetched:", overtime.length);
        setOvertimeData(overtime);

        // Fetch leave requests
        const leaves = await getLeaveRequests();
        console.log("Leave requests fetched:", leaves.length);
        
        // Enrich leave requests with employee names
        const enrichedLeaves = leaves.map(leave => ({
          ...leave,
          employeeName: empMap.get(leave.employeeId) || "Unknown"
        }));
        setLeaveRequests(enrichedLeaves);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [startDate, endDate]);

  // Calculate sandwich leaves for an employee
  const calculateEmployeeSandwichLeaves = (employeeLeaves) => {
    const approvedLeaves = employeeLeaves.filter(leave => 
      leave.status === 'Approved' && 
      (isDateInMonth(leave.from, "All") || isDateInMonth(leave.to, "All"))
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

    const sandwichLeaves = new Map();

    // Check for Holiday Sandwiches
    holidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      const dayBefore = addDays(holidayDate, -1);
      const dayAfter = addDays(holidayDate, 1);

      if (approvedLeaveDates.has(formatDate(dayBefore)) && 
          approvedLeaveDates.has(formatDate(dayAfter))) {
        const key = `holiday-${formatDate(holidayDate)}`;
        if (!sandwichLeaves.has(key)) {
          sandwichLeaves.set(key, { type: 'holiday', days: 2 });
        }
      }
    });

    // Check for Weekend Sandwiches
    approvedLeaveDates.forEach(dateStr => {
      const date = new Date(dateStr);
      if (date.getDay() === 5) {
        const followingMonday = addDays(date, 3);
        const mondayStr = formatDate(followingMonday);
        
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

  // Unified employee statistics
  const unifiedEmployeeStats = useMemo(() => {
    const stats = new Map();

    // Get ALL unique employees from the employees map (not just from attendance/leave data)
    // This ensures we show all employees even if they have no attendance or leave records
    employeesMap.forEach((empName, empId) => {
      stats.set(empId, {
        employeeId: empId,
        employeeName: empName,
        // Initialize all metrics to 0
        presentDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        approvedOT: 0,
        fullDays: 0,
        halfDays: 0,
        quarterDays: 0,
        approvedLeaves: 0,
        extraLeaves: 0,
        sandwichLeavesCount: 0,
        sandwichLeavesDays: 0
      });
    });

    console.log("Total employees in map:", stats.size);

    // Calculate approved OT counts
    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
      if (ot.status === 'APPROVED') {
        acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
      }
      return acc;
    }, {});

    // Update attendance statistics for employees who have attendance records
    attendanceData.forEach(record => {
      const empId = record.employeeId;
      if (stats.has(empId)) {
        const empStats = stats.get(empId);
        
        if (record.punchIn) {
          empStats.presentDays++;
          if (record.loginStatus === 'LATE') {
            empStats.lateDays++;
          } else {
            empStats.onTimeDays++;
          }
        }

        if (record.workedStatus === 'Full Day') empStats.fullDays++;
        else if (record.workedStatus === 'Half Day') empStats.halfDays++;
        else if (record.workedStatus === 'Quarter Day') empStats.quarterDays++;
      }
    });

    // Update leave statistics for employees who have leave records
    leaveRequests.forEach(leave => {
      const empId = leave.employeeId;
      if (stats.has(empId)) {
        const empStats = stats.get(empId);
        if (leave.status === 'Approved') {
          empStats.approvedLeaves++;
        }
      }
    });

    // Calculate extra leaves and sandwich leaves for each employee
    stats.forEach((empStats, empId) => {
      // Extra leaves (exceeding 2 per month)
      if (empStats.approvedLeaves > 2) {
        empStats.extraLeaves = empStats.approvedLeaves - 2;
      }

      // Approved OT
      empStats.approvedOT = approvedOTCounts[empId] || 0;

      // Calculate sandwich leaves
      const empLeaves = leaveRequests.filter(l => l.employeeId === empId);
      const sandwichData = calculateEmployeeSandwichLeaves(empLeaves);
      empStats.sandwichLeavesCount = sandwichData.count;
      empStats.sandwichLeavesDays = sandwichData.days;
    });

    const result = Array.from(stats.values()).sort((a, b) => 
      a.employeeName.localeCompare(b.employeeName)
    );

    console.log("Final employee stats count:", result.length);
    return result;
  }, [attendanceData, overtimeData, leaveRequests, employeesMap, holidays]);

  // Filter and search
  const filteredStats = useMemo(() => {
    let filtered = [...unifiedEmployeeStats];

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
  }, [unifiedEmployeeStats, searchQuery, sortConfig]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredStats.reduce((acc, emp) => ({
      presentDays: acc.presentDays + emp.presentDays,
      onTimeDays: acc.onTimeDays + emp.onTimeDays,
      lateDays: acc.lateDays + emp.lateDays,
      approvedOT: acc.approvedOT + emp.approvedOT,
      fullDays: acc.fullDays + emp.fullDays,
      halfDays: acc.halfDays + emp.halfDays,
      quarterDays: acc.quarterDays + emp.quarterDays,
      approvedLeaves: acc.approvedLeaves + emp.approvedLeaves,
      extraLeaves: acc.extraLeaves + emp.extraLeaves,
      sandwichLeavesCount: acc.sandwichLeavesCount + emp.sandwichLeavesCount,
      sandwichLeavesDays: acc.sandwichLeavesDays + emp.sandwichLeavesDays,
    }), {
      presentDays: 0, onTimeDays: 0, lateDays: 0, approvedOT: 0,
      fullDays: 0, halfDays: 0, quarterDays: 0, approvedLeaves: 0,
      extraLeaves: 0, sandwichLeavesCount: 0, sandwichLeavesDays: 0
    });
  }, [filteredStats]);

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Export to Excel
  const exportToExcel = () => {
    const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";

    const formattedData = filteredStats.map(emp => ({
      "Employee ID": emp.employeeId,
      "Employee Name": emp.employeeName,
      "Present Days": emp.presentDays,
      "On-Time Days": emp.onTimeDays,
      "Late Days": emp.lateDays,
      "Approved OT": emp.approvedOT,
      "Full Days": emp.fullDays,
      "Half Days": emp.halfDays,
      "Quarter Days": emp.quarterDays,
      "Approved Leaves": emp.approvedLeaves,
      "Extra Leaves": emp.extraLeaves,
      "Sandwich Leaves": emp.sandwichLeavesCount,
      "Sandwich Days": emp.sandwichLeavesDays
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: fileType });
    FileSaver.saveAs(data, `Unified_Employee_Report_${startDate}_to_${endDate}${fileExtension}`);
  };

  if (loading) {
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
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <FaChartBar className="text-blue-600" />
                Unified Employee Report
              </h1>
              <p className="text-gray-600">
                Combined Attendance & Leave Statistics
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToExcel}
              disabled={filteredStats.length === 0}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200 mt-4 lg:mt-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaFileExcel />
              Export to Excel
            </motion.button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
            <p className="text-gray-600 text-xs font-semibold">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filteredStats.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-green-500">
            <p className="text-gray-600 text-xs font-semibold">Present Days</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.presentDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-xs font-semibold">Late Days</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.lateDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-500">
            <p className="text-gray-600 text-xs font-semibold">Approved OT</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.approvedOT}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-orange-500">
            <p className="text-gray-600 text-xs font-semibold">Approved Leaves</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.approvedLeaves}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-500">
            <p className="text-gray-600 text-xs font-semibold">Sandwich Leaves</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totals.sandwichLeavesCount}</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FaSearch className="text-blue-600" />
                Search Employees
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
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FaCalendarAlt className="text-blue-600" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FaCalendarAlt className="text-blue-600" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              />
            </div>
          </div>

          {(searchQuery || startDate !== firstDayOfMonth || endDate !== todayISO) && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredStats.length} employee{filteredStats.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStartDate(firstDayOfMonth);
                  setEndDate(todayISO);
                  setSortConfig({ key: null, direction: 'asc' });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>

        {/* Unified Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900">Unified Employee Statistics</h2>
            <p className="text-sm text-gray-600 mt-1">
              Click column headers to sort • {filteredStats.length} total records
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    onClick={() => handleSort('employeeId')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition sticky left-0 bg-gray-50 z-10"
                  >
                    <div className="flex items-center gap-1">
                      Employee ID
                      {sortConfig.key === 'employeeId' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('employeeName')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition sticky left-24 bg-gray-50 z-10"
                  >
                    <div className="flex items-center gap-1">
                      Employee Name
                      {sortConfig.key === 'employeeName' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  {/* Attendance Columns */}
                  <th onClick={() => handleSort('presentDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">Present{sortConfig.key === 'presentDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('onTimeDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">On-Time{sortConfig.key === 'onTimeDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('lateDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">Late{sortConfig.key === 'lateDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('approvedOT')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">OT{sortConfig.key === 'approvedOT' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('fullDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">Full{sortConfig.key === 'fullDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('halfDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">Half{sortConfig.key === 'halfDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('quarterDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-blue-50">
                    <div className="flex items-center justify-center gap-1">Quarter{sortConfig.key === 'quarterDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  {/* Leave Columns */}
                  <th onClick={() => handleSort('approvedLeaves')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-green-50">
                    <div className="flex items-center justify-center gap-1">Approved Leaves{sortConfig.key === 'approvedLeaves' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('extraLeaves')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-green-50">
                    <div className="flex items-center justify-center gap-1">Extra Leaves{sortConfig.key === 'extraLeaves' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('sandwichLeavesCount')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-green-50">
                    <div className="flex items-center justify-center gap-1">Sandwich Count{sortConfig.key === 'sandwichLeavesCount' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th onClick={() => handleSort('sandwichLeavesDays')} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition bg-green-50">
                    <div className="flex items-center justify-center gap-1">Sandwich Days{sortConfig.key === 'sandwichLeavesDays' && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredStats.length > 0 ? (
                    filteredStats.map((emp, index) => (
                      <motion.tr
                        key={emp.employeeId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-blue-50 transition duration-150"
                      >
                        <td className="px-4 py-3 sticky left-0 bg-white">
                          <div className="text-xs font-bold text-gray-900">{emp.employeeId}</div>
                        </td>
                        <td className="px-4 py-3 sticky left-24 bg-white">
                          <div className="text-xs font-medium text-gray-900 whitespace-nowrap">{emp.employeeName}</div>
                        </td>
                        {/* Attendance Metrics */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                            {emp.presentDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-green-100 text-green-800 font-bold text-xs">
                            {emp.onTimeDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.lateDays > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.lateDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.approvedOT > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.approvedOT}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-green-100 text-green-800 font-bold text-xs">
                            {emp.fullDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.halfDays > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.halfDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.quarterDays > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.quarterDays}
                          </span>
                        </td>
                        {/* Leave Metrics */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-green-100 text-green-800 font-bold text-xs">
                            {emp.approvedLeaves}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.extraLeaves > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.extraLeaves}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.sandwichLeavesCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.sandwichLeavesCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full font-bold text-xs ${
                            emp.sandwichLeavesDays > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {emp.sandwichLeavesDays}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={13} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🔍</span>
                          </div>
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

          {/* Legend */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">📋 Column Descriptions:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="bg-blue-50 p-2 rounded">
                <strong className="text-blue-700">Attendance Metrics (Blue):</strong>
                <ul className="mt-1 space-y-1">
                  <li>• <strong>Present:</strong> Days with punch-in</li>
                  <li>• <strong>On-Time:</strong> Not marked as late</li>
                  <li>• <strong>Late:</strong> Arrived after cutoff</li>
                  <li>• <strong>OT:</strong> Approved overtime requests</li>
                  <li>• <strong>Full/Half/Quarter:</strong> Work duration</li>
                </ul>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">Leave Metrics (Green):</strong>
                <ul className="mt-1 space-y-1">
                  <li>• <strong>Approved Leaves:</strong> Total approved</li>
                  <li>• <strong>Extra Leaves:</strong> Exceeding 2 per month</li>
                  <li>• <strong>Sandwich Count:</strong> Number of patterns</li>
                  <li>• <strong>Sandwich Days:</strong> Days counted</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-700">Sandwich Leaves:</strong>
                <p className="mt-1">Leaves taken around weekends or holidays to extend time off (e.g., Friday + Monday around weekend)</p>
              </div>
            </div>
          </div>

          {/* Totals Row */}
          <div className="px-6 py-4 bg-gradient-to-r from-gray-100 to-gray-200 border-t-2 border-gray-300">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-100">
                      TOTALS
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase sticky left-24 bg-gray-100">
                      {filteredStats.length} Employees
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-blue-700">{totals.presentDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-green-700">{totals.onTimeDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-red-700">{totals.lateDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-indigo-700">{totals.approvedOT}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-green-700">{totals.fullDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-yellow-700">{totals.halfDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-orange-700">{totals.quarterDays}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-green-700">{totals.approvedLeaves}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-orange-700">{totals.extraLeaves}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-purple-700">{totals.sandwichLeavesCount}</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-purple-700">{totals.sandwichLeavesDays}</th>
                  </tr>
                </thead>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UnifiedEmployeeReport;