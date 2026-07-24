import React, { useState, useMemo, useCallback } from "react";
import { AttendanceContext } from "./AttendanceContext";

// --- Mock Backend Data ---

// Data structure for the Employee Attendance Profile page
const employeeProfileData = {
  "EMP101": { // Data for John Doe
    "2025-09": {
      profile: { employeeId: "EMP101", employeeName: "John Doe" },
      monthlySummary: { present_days: 2, half_days: 0, absent_days: 1, on_leave_days: 0, holiday_days: 1 },
      workHoursSummary: { totalWorkHours: 17.5, totalWorkedHours: 16.5, totalIdleTime: 1.0 },
      leaveSummary: { applied: 0, approved: 0, rejected: 0, pending: 0 },
      sandwichLeave: { count: 0, dates: [] },
      dailyRecords: [
        { id: 6, date: "2025-09-05", status: "Absent", isHalfDay: false, punchIn: null, punchOut: null, workHours: 0, workedHours: 0, idleTime: 0 },
        { id: 7, date: "2025-09-04", status: "Present", isHalfDay: false, punchIn: "09:30", punchOut: "18:30", workHours: 9.0, workedHours: 8.5, idleTime: 0.5 },
        { id: 8, date: "2025-09-03", status: "Present", isHalfDay: false, punchIn: "10:00", punchOut: "18:30", workHours: 8.5, workedHours: 8.0, idleTime: 0.5 },
        { id: 5, date: "2025-09-01", status: "Holiday", isHalfDay: false, punchIn: null, punchOut: null, workHours: 0, workedHours: 0, idleTime: 0 },
      ]
    },
    "2025-08": {
      profile: { employeeId: "EMP101", employeeName: "John Doe" },
      monthlySummary: { present_days: 18, half_days: 0, absent_days: 0, on_leave_days: 3, holiday_days: 0 },
      workHoursSummary: { totalWorkHours: 162.0, totalWorkedHours: 155.0, totalIdleTime: 7.0 },
      leaveSummary: { applied: 1, approved: 1, rejected: 0, pending: 0 },
      sandwichLeave: { count: 1, dates: [{ date: "2025-08-10", name: "Weekend Holiday"}] },
      dailyRecords: [
        { id: 12, date: "2025-08-28", status: "Leave", isHalfDay: false, punchIn: null, punchOut: null, workHours: 0, workedHours: 0, idleTime: 0 },
      ]
    }
  },
  "EMP102": { // Data for Alice Johnson
     "2025-09": {
      profile: { employeeId: "EMP102", employeeName: "Alice Johnson" },
      monthlySummary: { present_days: 2, half_days: 1, absent_days: 0, on_leave_days: 1, holiday_days: 1 },
      workHoursSummary: { totalWorkHours: 23.4, totalWorkedHours: 21.4, totalIdleTime: 2.0 },
      leaveSummary: { applied: 1, approved: 0, rejected: 0, pending: 1 },
      sandwichLeave: { count: 0, dates: [] },
      dailyRecords: [
        { id: 1, date: "2025-09-05", status: "Present", isHalfDay: false, punchIn: "09:30", punchOut: "18:30", workHours: 9.0, workedHours: 8.5, idleTime: 0.5 },
        { id: 2, date: "2025-09-04", status: "Present", isHalfDay: true, punchIn: "13:00", punchOut: "18:30", workHours: 5.5, workedHours: 4.5, idleTime: 1.0 },
        { id: 3, date: "2025-09-03", status: "Leave", isHalfDay: false, punchIn: null, punchOut: null, workHours: 0, workedHours: 0, idleTime: 0 },
        { id: 4, date: "2025-09-02", status: "Present", isHalfDay: false, punchIn: "09:35", punchOut: "18:30", workHours: 8.9, workedHours: 8.4, idleTime: 0.5 },
        { id: 5, date: "2025-09-01", status: "Holiday", isHalfDay: false, punchIn: null, punchOut: null, workHours: 0, workedHours: 0, idleTime: 0 },
      ]
    }
  }
};

// Raw daily attendance records, preserved for any component that might need them
const mockDailyAttendance = [
  // John Doe (EMP101)
  { id: 6, employeeId: "EMP101", date: "2025-09-05", status: "Absent" },
  { id: 7, employeeId: "EMP101", date: "2025-09-04", status: "Present" },
  { id: 8, employeeId: "EMP101", date: "2025-09-03", status: "Present" },
  { id: 12, employeeId: "EMP101", date: "2025-08-28", status: "Leave" },
  // Alice Johnson (EMP102)
  { id: 1, employeeId: "EMP102", date: "2025-09-05", status: "Present" },
  { id: 2, employeeId: "EMP102", date: "2025-09-04", status: "Present" },
  { id: 3, employeeId: "EMP102", date: "2025-09-03", status: "Leave" },
  { id: 11, employeeId: "EMP102", date: "2025-08-29", status: "Present" },
  { id: 16, employeeId: "EMP102", date: "2025-08-28", status: "Absent" },
  // Priya Sharma (EMP104)
  { id: 13, employeeId: "EMP104", date: "2025-09-05", status: "Present" },
  { id: 14, employeeId: "EMP104", date: "2025-09-04", status: "Present" },
  { id: 15, employeeId: "EMP104", date: "2025-08-27", status: "Holiday" },
];

export const AttendanceProvider = ({ children }) => {
  const [attendanceRecords] = useState(mockDailyAttendance);

  // --- LOGIC FOR EmployeeAttendanceProfile PAGE ---
  const getEmployeeAttendanceProfile = useCallback((employeeId, yearMonth) => {
    return employeeProfileData[employeeId]?.[yearMonth] || null;
  }, []);

  const getAvailableMonthsForEmployee = useCallback((employeeId) => {
    if (!employeeProfileData[employeeId]) return [];
    return Object.keys(employeeProfileData[employeeId]).sort((a, b) => b.localeCompare(a));
  }, []);

  // --- NEW LOGIC FOR AdminDashboard PAGE ---
  const getDashboardData = useCallback((employees, leaveRequests) => {
    const today = new Date().toISOString().split("T")[0];
    
    // 1. Process Employee Data: Filter for active and correctly extract department
    const activeEmployees = employees
      .filter(emp => emp.isActive)
      .map(emp => {
        const currentExperience = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present");
        return { ...emp, department: currentExperience?.department || "N/A" };
      });

    const departmentSet = new Set(activeEmployees.map(emp => emp.department));

    // 2. Calculate Stat Card Metrics
    const onLeaveTodayCount = attendanceRecords.filter(record => {
      const isToday = record.date === today;
      const onLeave = record.status === "Leave";
      const isActive = activeEmployees.some(emp => emp.employeeId === record.employeeId);
      return isToday && onLeave && isActive;
    }).length;

    const pendingLeavesCount = leaveRequests.filter(req => req.status === "Pending").length;

    const statCards = {
      totalEmployees: activeEmployees.length,
      onLeaveToday: onLeaveTodayCount,
      pendingLeaves: pendingLeavesCount,
      totalDepartments: departmentSet.size,
    };

    return {
      statCards,
      activeEmployees,
      departmentList: [...departmentSet].sort(),
    };
  }, [attendanceRecords]);

  // --- CONTEXT VALUE ---
  // Memoize the context value to prevent unnecessary re-renders.
  const contextValue = useMemo(() => ({
    // For EmployeeAttendanceProfile page
    getEmployeeAttendanceProfile,
    getAvailableMonthsForEmployee,

    // For AdminDashboard page
    getDashboardData,

    // For other potential components
    attendanceRecords,
  }), [
    attendanceRecords, 
    getEmployeeAttendanceProfile, 
    getAvailableMonthsForEmployee,
    getDashboardData
  ]);

  return (
    <AttendanceContext.Provider value={contextValue}>
      {children}
    </AttendanceContext.Provider>
  );
};