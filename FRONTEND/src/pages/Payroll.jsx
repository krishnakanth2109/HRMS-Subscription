import React, { useState, useEffect, useMemo } from "react";
import { getAttendanceByDateRange, getAllOvertimeRequests, getEmployees } from "../api";
import { getLeaveRequests } from "../api";

// ===========================
// Helper: Worked Status
// ===========================
const getWorkedStatus = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return "Working..";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= 8) return "Full Day";
  if (workedHours >= 4) return "Half Day";
  if (workedHours > 0) return "Quarter Day";
  return "N/A";
};

// ===========================
// Leave Day Calculation
// ===========================
const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate) || isNaN(toDate)) return 0;

  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);

  const diffTime = Math.abs(toDate - fromDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// ===========================
// Leave Year (Nov → Oct)
// ===========================
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

// ===========================
// Helpers
// ===========================
const addDays = (date, days) => {
  const result = new Date(date);
  if (isNaN(result)) return result;
  result.setDate(result.getDate() + days);
  return result;
};

const safeDate = (value) => {
  const d = new Date(value);
  return isNaN(d) ? null : d;
};

const formatDate = (dateObj) => {
  if (!dateObj || isNaN(dateObj)) return null;
  return dateObj.toISOString().split("T")[0];
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || monthFilter === "All") return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;

  const [year, month] = monthFilter.split("-");
  return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
};

// ===========================
// FIXED SANDWICH LEAVE CALCULATION
// Rule A: Only 2 days per holiday block
// ===========================
const calculateEmployeeSandwichLeaves = (employeeLeaves, month, holidays = []) => {
  const approvedLeaves = employeeLeaves.filter(
    (leave) =>
      leave.status === "Approved" &&
      (month === "All" || isDateInMonth(leave.from, month) || isDateInMonth(leave.to, month))
  );

  if (approvedLeaves.length === 0) return { count: 0, days: 0 };

  const approvedDates = new Set();

  approvedLeaves.forEach((leave) => {
    const start = safeDate(leave.from);
    const end = safeDate(leave.to);
    if (!start || !end) return;

    let current = new Date(start);
    while (current <= end) {
      approvedDates.add(formatDate(current));
      current = addDays(current, 1);
    }
  });

  if (approvedDates.size === 0) return { count: 0, days: 0 };

  const sandwichLeaves = new Map();

  // 🔥 HOLIDAY SANDWICH RULE (Only 2 days per block)
  holidays.forEach((holiday) => {
    const start = safeDate(holiday.startDate);
    const end = safeDate(holiday.endDate);
    if (!start || !end) return;

    const dayBefore = formatDate(addDays(start, -1));
    const dayAfter = formatDate(addDays(end, 1));

    if (approvedDates.has(dayBefore) && approvedDates.has(dayAfter)) {
      sandwichLeaves.set(`holiday-${holiday.startDate}`, {
        type: "holiday",
        days: 2, // Always 2 days (Rule A)
      });
    }
  });

  // WEEKEND SANDWICH (Saturday → Monday)
  approvedDates.forEach((dateStr) => {
    const d = safeDate(dateStr);
    if (!d || d.getDay() !== 6) return; // Saturday

    const monday = formatDate(addDays(d, 2));
    if (approvedDates.has(monday)) {
      sandwichLeaves.set(`weekend-${dateStr}`, { type: "weekend", days: 2 });
    }
  });

  let count = sandwichLeaves.size;
  let days = Array.from(sandwichLeaves.values()).reduce((acc, x) => acc + x.days, 0);

  return { count, days };
};

// ===========================
// MAIN COMPONENT
// ===========================
const EmployeeDashboard = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);

  const [attendanceStartDate, setAttendanceStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [attendanceEndDate, setAttendanceEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState("All");

  // ===========================
  // Fetch Holidays
  // ===========================
  const fetchHolidays = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/holidays");
      const data = await res.json();
      setHolidays(data);
    } catch (e) {
      console.error("Holiday Fetch Error:", e);
      setHolidays([]);
    }
  };

  // ===========================
  // Fetch Employees
  // ===========================
  const fetchAllEmployeeData = async () => {
    try {
      const employees = await getEmployees();
      const activeEmployees = employees
        .filter((emp) => emp.isActive !== false)
        .map((emp) => {
          const currentExp = Array.isArray(emp.experienceDetails)
            ? emp.experienceDetails.find((exp) => exp.lastWorkingDate === "Present")
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
            employmentType: currentExp?.employmentType || "N/A",
          };
        });

      setAllEmployees(activeEmployees);
    } catch (error) {
      console.error("Employee Fetch Error:", error);
      setAllEmployees([]);
    }
  };

  // ===========================
  // Fetch Attendance
  // ===========================
  const fetchAttendanceData = async () => {
    setAttendanceLoading(true);
    try {
      const [attendance, overtime] = await Promise.all([
        getAttendanceByDateRange(attendanceStartDate, attendanceEndDate),
        getAllOvertimeRequests(),
      ]);

      const processed = Array.isArray(attendance)
        ? attendance.map((item) => ({
            ...item,
            workedStatus: getWorkedStatus(item.punchIn, item.punchOut),
          }))
        : [];

      setAttendanceData(processed);
      setOvertimeData(overtime);
    } catch (e) {
      console.error("Attendance Fetch Error:", e);
      setAttendanceData([]);
      setOvertimeData([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // ===========================
  // Fetch Leave Data
  // ===========================
  const fetchLeaveData = async () => {
    setLeaveLoading(true);
    try {
      const [leaves, employees] = await Promise.all([getLeaveRequests(), getEmployees()]);

      setAllLeaveRequests(leaves);
      setEmployeesMap(new Map(employees.map((emp) => [emp.employeeId, emp.name])));

      await fetchHolidays();
    } catch (e) {
      console.error("Leave Fetch Error:", e);
    } finally {
      setLeaveLoading(false);
    }
  };

  // ===========================
  // Use Effects
  // ===========================
  useEffect(() => {
    fetchAttendanceData();
    fetchAllEmployeeData();
  }, [attendanceStartDate, attendanceEndDate]);

  useEffect(() => {
    fetchLeaveData();
  }, []);

  // ===========================
  // Compute Attendance Stats
  // ===========================
  const employeeAttendanceStats = useMemo(() => {
    if (!attendanceData.length) return [];

    const otApproved = overtimeData.reduce((acc, ot) => {
      if (ot.status === "APPROVED") acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
      return acc;
    }, {});

    const summary = attendanceData.reduce((acc, rec) => {
      if (!acc[rec.employeeId]) {
        acc[rec.employeeId] = {
          employeeId: rec.employeeId,
          employeeName: rec.employeeName,
          presentDays: 0,
          onTimeDays: 0,
          lateDays: 0,
          fullDays: 0,
          halfDays: 0,
          quarterDays: 0,
        };
      }

      const emp = acc[rec.employeeId];

      if (rec.punchIn) {
        emp.presentDays++;
        if (rec.loginStatus === "LATE") emp.lateDays++;
        else emp.onTimeDays++;
      }

      if (rec.workedStatus === "Full Day") emp.fullDays++;
      else if (rec.workedStatus === "Half Day") emp.halfDays++;
      else if (rec.workedStatus === "Quarter Day") emp.quarterDays++;

      return acc;
    }, {});

    return Object.values(summary)
      .map((emp) => ({
        ...emp,
        approvedOT: otApproved[emp.employeeId] || 0,
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [attendanceData, overtimeData]);

  // ===========================
  // Attach Employee Names to Leaves
  // ===========================
  const enrichedLeaveRequests = useMemo(() => {
    return allLeaveRequests.map((req) => ({
      ...req,
      employeeName: employeesMap.get(req.employeeId) || "Unknown",
    }));
  }, [allLeaveRequests, employeesMap]);

  // ===========================
  // Leave Stats
  // ===========================
  const employeeLeaveStats = useMemo(() => {
    const stats = new Map();
    const { startDate, endDate } = getCurrentLeaveYear();
    const today = new Date();

    employeesMap.forEach((name, empId) => {
      const leaves = enrichedLeaveRequests.filter((l) => l.employeeId === empId);

      const approvedThisYear = leaves.filter((l) => {
        const d = safeDate(l.from);
        return l.status === "Approved" && d && d >= startDate && d <= endDate;
      });

      const usedDays = approvedThisYear.reduce(
        (sum, l) => sum + calculateLeaveDays(l.from, l.to),
        0
      );

      let monthsPassed =
        today >= startDate
          ? today.getMonth() - startDate.getMonth() + 1 + (today.getFullYear() - startDate.getFullYear()) * 12
          : 0;

      const earned = Math.max(0, monthsPassed);
      const pending = Math.max(0, earned - usedDays);

      const leavesMonthFiltered = leaves.filter(
        (l) => selectedMonth === "All" || isDateInMonth(l.from, selectedMonth)
      );

      const approvedFiltered = leavesMonthFiltered.filter((l) => l.status === "Approved");

      const totalLeaveDays = approvedFiltered.reduce(
        (sum, l) => sum + calculateLeaveDays(l.from, l.to),
        0
      );

      const extraLeaves = Math.max(0, totalLeaveDays - 1);

      const sandwich = calculateEmployeeSandwichLeaves(leaves, selectedMonth, holidays);

      stats.set(empId, {
        employeeId: empId,
        employeeName: name,
        pendingLeaves: pending,
        totalLeaveDays,
        extraLeaves,
        sandwichLeavesCount: sandwich.count,
        sandwichLeavesDays: sandwich.days,
      });
    });

    return Array.from(stats.values());
  }, [enrichedLeaveRequests, selectedMonth, holidays, employeesMap]);

  const allMonths = useMemo(() => {
    const set = new Set();
    enrichedLeaveRequests.forEach((l) => {
      if (l.from) set.add(l.from.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [enrichedLeaveRequests]);

  const formatMonth = (m) => {
    if (m === "All") return "All Months";
    const [year, month] = m.split("-");
    return `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`;
  };

  // ===========================
  // UI Rendering
  // ===========================
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Dashboard</h1>
          <p className="text-gray-600">Complete overview of employee data</p>
        </div>

        {/* EMPLOYEE DETAILS */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Employee Details</h2>
            <span className="text-gray-500">Total: {allEmployees.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Dept</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Salary</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Joining</th>
                  <th className="px-4 py-3 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {allEmployees.map((e) => (
                  <tr key={e.employeeId} className="border-b">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.employeeName}</div>
                      <div className="text-gray-500 text-sm">{e.employeeId}</div>
                    </td>
                    <td className="px-4 py-3">{e.department}</td>
                    <td className="px-4 py-3">{e.role}</td>
                    <td className="px-4 py-3">{e.salary}</td>
                    <td className="px-4 py-3">{e.email}</td>
                    <td className="px-4 py-3">{e.phone}</td>
                    <td className="px-4 py-3">{e.joiningDate}</td>
                    <td className="px-4 py-3">{e.employmentType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ATTENDANCE SUMMARY */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Attendance Summary</h2>

            <div className="flex gap-4">
              <div>
                <label>From: </label>
                <input
                  type="date"
                  value={attendanceStartDate}
                  onChange={(e) => setAttendanceStartDate(e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </div>
              <div>
                <label>To: </label>
                <input
                  type="date"
                  value={attendanceEndDate}
                  onChange={(e) => setAttendanceEndDate(e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-center">Present</th>
                  <th className="px-4 py-3 text-center">On Time</th>
                  <th className="px-4 py-3 text-center">Late</th>
                  <th className="px-4 py-3 text-center">OT Approved</th>
                  <th className="px-4 py-3 text-center">Full</th>
                  <th className="px-4 py-3 text-center">Half</th>
                  <th className="px-4 py-3 text-center">Quarter</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLoading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  employeeAttendanceStats.map((emp) => (
                    <tr key={emp.employeeId} className="border-b">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{emp.employeeName}</div>
                        <div className="text-gray-500 text-sm">{emp.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{emp.presentDays}</td>
                      <td className="px-4 py-3 text-center">{emp.onTimeDays}</td>
                      <td className="px-4 py-3 text-center">{emp.lateDays}</td>
                      <td className="px-4 py-3 text-center">{emp.approvedOT}</td>
                      <td className="px-4 py-3 text-center">{emp.fullDays}</td>
                      <td className="px-4 py-3 text-center">{emp.halfDays}</td>
                      <td className="px-4 py-3 text-center">{emp.quarterDays}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LEAVE SUMMARY */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Leave Summary</h2>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="All">All Months</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-center">Pending</th>
                  <th className="px-4 py-3 text-center">Days</th>
                  <th className="px-4 py-3 text-center">Extra (LOP)</th>
                  <th className="px-4 py-3 text-center">Sandwich</th>
                  <th className="px-4 py-3 text-center">Sandwich Days</th>
                </tr>
              </thead>
              <tbody>
                {leaveLoading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  employeeLeaveStats.map((emp) => (
                    <tr key={emp.employeeId} className="border-b">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{emp.employeeName}</div>
                        <div className="text-gray-500 text-sm">{emp.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{emp.pendingLeaves}</td>
                      <td className="px-4 py-3 text-center">{emp.totalLeaveDays}</td>
                      <td className="px-4 py-3 text-center">{emp.extraLeaves}</td>
                      <td className="px-4 py-3 text-center">{emp.sandwichLeavesCount}</td>
                      <td className="px-4 py-3 text-center">{emp.sandwichLeavesDays}</td>
                    </tr>
                  ))
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
