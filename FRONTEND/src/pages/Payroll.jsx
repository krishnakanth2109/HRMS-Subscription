import React, { useState, useEffect, useMemo } from "react";
import { getAttendanceByDateRange, getAllOvertimeRequests, getEmployees } from "../api";
import { getLeaveRequests } from "../api";

// Helper functions
const getWorkedStatus = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return "Working..";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= 8) return "Full Day";
  if (workedHours >= 4) return "Half Day";
  if (workedHours > 0) return "Quarter Day";
  return "N/A";
};

// Calculates the number of days between two dates, inclusive
const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  // Normalize to UTC midnight to avoid timezone issues in day calculation
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const LEAVE_YEAR_START_MONTH = 11;

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

const formatDate = (date) => date.toISOString().split('T')[0];

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter || monthFilter === "All") return true;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split('-');
  return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
};

const calculateEmployeeSandwichLeaves = (employeeLeaves, month, holidays = []) => {
  const approvedLeaves = employeeLeaves.filter(leave => 
    leave.status === 'Approved' && 
    (month === "All" || isDateInMonth(leave.from, month) || isDateInMonth(leave.to, month))
  );
  
  if (approvedLeaves.length === 0 && holidays.length === 0) return { count: 0, days: 0 };

  const approvedLeaveDates = new Set();
  approvedLeaves.forEach(leave => {
    let currentDate = new Date(leave.from);
    const endDate = new Date(leave.to);
    while (currentDate <= endDate) {
      approvedLeaveDates.add(formatDate(currentDate));
      currentDate = addDays(currentDate, 1);
    }
  });

  if (approvedLeaveDates.size === 0) return { count: 0, days: 0 };

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
    if (date.getDay() === 6) { // Saturday
      const followingMonday = addDays(date, 2);
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

const EmployeeDashboard = () => {
  // States
  const [attendanceData, setAttendanceData] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [attendanceStartDate, setAttendanceStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split("T")[0]);
  const [attendanceEndDate, setAttendanceEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState("All");

  // Fetch data functions
  const fetchHolidays = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/holidays");
      const holidaysData = await response.json();
      setHolidays(holidaysData);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      setHolidays([]);
    }
  };

  const fetchAllEmployeeData = async () => {
    try {
      const employees = await getEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive !== false).map(emp => {
        const currentExp = Array.isArray(emp.experienceDetails)
          ? emp.experienceDetails.find(exp => exp.lastWorkingDate === "Present")
          : null;

        return {
          employeeId: emp.employeeId,
          employeeName: emp.name,
          department: currentExp?.department || "N/A",
          role: currentExp?.role || "N/A",
          salary: currentExp?.salary ? `₹${Number(currentExp.salary).toLocaleString()}` : "N/A",
          email: emp.email || "N/A",
          phone: emp.phone || "N/A",
          joiningDate: currentExp?.joiningDate || "N/A",
          employmentType: currentExp?.employmentType || "N/A"
        };
      });
      setAllEmployees(activeEmployees);
    } catch (error) {
      console.error("Error fetching employee data:", error);
      setAllEmployees([]);
    }
  };

  const fetchAttendanceData = async () => {
    setAttendanceLoading(true);
    try {
      const [attendance, overtime] = await Promise.all([
        getAttendanceByDateRange(attendanceStartDate, attendanceEndDate),
        getAllOvertimeRequests()
      ]);

      const processedAttendance = Array.isArray(attendance) 
        ? attendance.map(item => ({ ...item, workedStatus: getWorkedStatus(item.punchIn, item.punchOut) }))
        : [];

      setAttendanceData(processedAttendance);
      setOvertimeData(overtime);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setAttendanceData([]);
      setOvertimeData([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchLeaveData = async () => {
    setLeaveLoading(true);
    try {
      const [leaves, employees] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setAllLeaveRequests(leaves);
      const empMap = new Map(employees.map((emp) => [emp.employeeId, emp.name]));
      setEmployeesMap(empMap);
      await fetchHolidays();
    } catch (error) {
      console.error("Error fetching leave data:", error);
      setAllLeaveRequests([]);
      setEmployeesMap(new Map());
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    fetchAllEmployeeData();
  }, [attendanceStartDate, attendanceEndDate]);

  useEffect(() => {
    fetchLeaveData();
  }, []);

  // Processed data
  const employeeAttendanceStats = useMemo(() => {
    if (!attendanceData.length) return [];

    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
      if (ot.status === 'APPROVED') acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
      return acc;
    }, {});

    const summary = attendanceData.reduce((acc, record) => {
      if (!acc[record.employeeId]) {
        acc[record.employeeId] = {
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          presentDays: 0, onTimeDays: 0, lateDays: 0, fullDays: 0, halfDays: 0, quarterDays: 0,
        };
      }

      const empRec = acc[record.employeeId];
      if (record.punchIn) {
        empRec.presentDays++;
        if (record.loginStatus === 'LATE') empRec.lateDays++;
        else if (record.loginStatus === 'ON_TIME') empRec.onTimeDays++;
      }

      if (record.workedStatus === "Full Day") empRec.fullDays++;
      else if (record.workedStatus === "Half Day") empRec.halfDays++;
      else if (record.workedStatus === "Quarter Day") empRec.quarterDays++;

      return acc;
    }, {});

    return Object.values(summary).map(employee => ({
      ...employee,
      approvedOT: approvedOTCounts[employee.employeeId] || 0
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [attendanceData, overtimeData]);

  const enrichedLeaveRequests = useMemo(() => {
    return allLeaveRequests.map((req) => ({
      ...req,
      employeeName: employeesMap.get(req.employeeId) || "Unknown",
    }));
  }, [allLeaveRequests, employeesMap]);

  const employeeLeaveStats = useMemo(() => {
    const stats = new Map();
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date();
    const { startDate, endDate } = getCurrentLeaveYear();

    uniqueEmployees.forEach(([empId, empName]) => {
      const employeeLeaves = enrichedLeaveRequests.filter(req => req.employeeId === empId);
      
      const approvedLeavesThisYear = employeeLeaves.filter(leave => {
        const leaveDate = new Date(leave.from);
        return leave.status === 'Approved' && leaveDate >= startDate && leaveDate <= endDate;
      });
      const usedLeavesDaysThisYear = approvedLeavesThisYear.reduce((total, leave) => total + calculateLeaveDays(leave.from, leave.to), 0);

      let monthsPassed = 0;
      if (today >= startDate) {
        monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1;
      }
      const earnedLeavesThisYear = Math.max(0, monthsPassed);
      const pendingLeaves = Math.max(0, earnedLeavesThisYear - usedLeavesDaysThisYear);

      const monthFilteredLeaves = employeeLeaves.filter(leave => 
        selectedMonth === "All" || 
        isDateInMonth(leave.from, selectedMonth) || 
        isDateInMonth(leave.to, selectedMonth)
      );

      const approvedLeaves = monthFilteredLeaves.filter(leave => leave.status === 'Approved');
      
      const totalLeaveDays = approvedLeaves.reduce((total, leave) => {
        return total + calculateLeaveDays(leave.from, leave.to);
      }, 0);

      const extraLeaves = Math.max(0, totalLeaveDays - 1);

      const sandwichData = calculateEmployeeSandwichLeaves(employeeLeaves, selectedMonth, holidays);

      stats.set(empId, {
        employeeId: empId,
        employeeName: empName,
        pendingLeaves: pendingLeaves,
        totalLeaveDays: totalLeaveDays,
        extraLeaves: extraLeaves,
        sandwichLeavesCount: sandwichData.count,
        sandwichLeavesDays: sandwichData.days
      });
    });

    return Array.from(stats.values());
  }, [enrichedLeaveRequests, employeesMap, selectedMonth, holidays]);

  const allMonths = useMemo(() => {
    const months = new Set();
    enrichedLeaveRequests.forEach((req) => {
      if (req.from) months.add(req.from.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [enrichedLeaveRequests]);

  const formatMonth = (monthStr) => {
    if (!monthStr || monthStr === "All") return "All Months";
    const [year, month] = monthStr.split("-");
    return `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Dashboard</h1>
          <p className="text-gray-600">Complete overview of employee data</p>
        </div>

        {/* Employee Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Employee Details</h2>
            <span className="text-gray-500">Total: {allEmployees.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employee</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Salary</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Joining Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employment Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allEmployees.length > 0 ? (
                  allEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp.employeeName}</div>
                        <div className="text-sm text-gray-500">{emp.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.salary}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.joiningDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.employmentType}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      No employee data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attendance Summary Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Attendance Summary</h2>
            <div className="flex gap-4">
              <div>
                <label className="text-sm text-gray-600 mr-2">From:</label>
                <input 
                  type="date" 
                  value={attendanceStartDate} 
                  onChange={(e) => setAttendanceStartDate(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mr-2">To:</label>
                <input 
                  type="date" 
                  value={attendanceEndDate} 
                  onChange={(e) => setAttendanceEndDate(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employee</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Present</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">On Time</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Late</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">OT Approved</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Full Days</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Half Days</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Quarter Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendanceLoading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Loading attendance data...
                    </td>
                  </tr>
                ) : employeeAttendanceStats.length > 0 ? (
                  employeeAttendanceStats.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp.employeeName}</div>
                        <div className="text-sm text-gray-500">{emp.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.presentDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.onTimeDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.lateDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.approvedOT}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.fullDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.halfDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.quarterDays}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      No attendance data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Summary Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Leave Summary</h2>
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1"
              >
                <option value="All">All Months</option>
                {allMonths.map((m) => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employee</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Pending Leaves</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Total Leave Days</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Extra Leaves (LOP)</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Sandwich Leaves</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Sandwich Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaveLoading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      Loading leave data...
                    </td>
                  </tr>
                ) : employeeLeaveStats.length > 0 ? (
                  employeeLeaveStats.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp.employeeName}</div>
                        <div className="text-sm text-gray-500">{emp.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.pendingLeaves}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.totalLeaveDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.extraLeaves}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.sandwichLeavesCount}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{emp.sandwichLeavesDays}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No leave data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;