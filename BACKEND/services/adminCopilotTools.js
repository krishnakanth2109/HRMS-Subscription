// ============================================================================
// 🛠️ ADMIN COPILOT TOOLS & DRAFT ACTION ENGINE
// Read-Only Real-Time Tenant Analytics & Signed Action Card Generators
// ============================================================================

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Employee from "../models/employeeModel.js";
import Attendance from "../models/Attendance.js";
import AttendanceRequest from "../models/AttendanceRequest.js";
import LeaveRequest from "../models/LeaveRequest.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Expense from "../models/Expense.js";
import Overtime from "../models/Overtime.js";
import PunchOutRequest from "../models/PunchOutRequest.js";
import TechnicalIssue from "../models/TechnicalIssue.js";
import Resignation from "../models/Resignation.js";
import Notice from "../models/Notice.js";
import Shift from "../models/shiftModel.js";
import Holiday from "../models/Holiday.js";
import Rule from "../models/Rule.js";
import PayrollRecord from "../models/PayrollRecord.js";
import LiveTracking from "../models/LiveTrackingModel.js";
import IdleTime from "../models/IdleTimeModel.js";
import OfficeSettings from "../models/OfficeSettings.js";
import DailyWorkEntry from "../models/DailyWorkEntry.js";
import SupportAdmin from "../models/supportAdminModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "default_hrms_super_secret_jwt_key_2026";

export const generateAdminActionToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      sub: payload.adminId,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
};

/* =========================================================================
   📊 1. ADMIN ANALYTICS & DASHBOARD METRICS
========================================================================= */
export const adminGetDashboardSummary = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const todayStr = new Date().toISOString().slice(0, 10);

  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  // 1. Employee Counts
  const totalEmployees = await Employee.countDocuments(tenantFilter);
  const activeEmployees = await Employee.countDocuments({ ...tenantFilter, status: "Active" });
  const inactiveEmployees = totalEmployees - activeEmployees;

  // 2. Attendance Summary Today
  const attendanceDocs = await Attendance.find(tenantFilter).lean();
  let presentCount = 0;
  let onBreakCount = 0;
  let lateCount = 0;
  let completedCount = 0;

  attendanceDocs.forEach((doc) => {
    const today = (doc.attendance || []).find((a) => a.date === todayStr);
    if (today && today.punchIn) {
      presentCount++;
      if (today.isOnBreak) onBreakCount++;
      if (today.loginStatus === "LATE") lateCount++;
      if (today.status === "COMPLETED" || today.isFinalPunchOut) completedCount++;
    }
  });

  // 3. Approved Leaves & WFH Today
  const leavesToday = await LeaveRequest.find({
    ...tenantFilter,
    status: "Approved",
    from: { $lte: todayStr },
    to: { $gte: todayStr },
  }).countDocuments();

  const wfhToday = await WorkModeRequest.find({
    ...tenantFilter,
    status: "Approved",
    fromDate: { $lte: new Date(todayStr) },
    toDate: { $gte: new Date(todayStr) },
    requestedMode: "WFH",
  }).countDocuments();

  const absentEstimated = Math.max(0, activeEmployees - presentCount - leavesToday - wfhToday);

  // 4. Pending Approvals
  const pendingLeaves = await LeaveRequest.countDocuments({ ...tenantFilter, status: "Pending" });
  const pendingExpenses = await Expense.countDocuments({ ...tenantFilter, status: "Pending" });
  const pendingWFH = await WorkModeRequest.countDocuments({ ...tenantFilter, status: "Pending" });
  const pendingOvertime = await Overtime.countDocuments({ ...tenantFilter, status: "PENDING" });
  const pendingAttendanceRequests = await AttendanceRequest.countDocuments({ ...tenantFilter, requestStatus: "pending" });
  const pendingResignations = await Resignation.countDocuments({ adminId, status: "Pending" });
  const openIssues = await TechnicalIssue.countDocuments({ ...tenantFilter, status: { $in: ["pending", "in_progress"] } });

  return {
    success: true,
    message: `📊 **Organization Overview Today (${todayStr})**:\n• Total Staff: **${totalEmployees}** (${activeEmployees} Active)\n• Present: **${presentCount}** | On Break: **${onBreakCount}** | Late: **${lateCount}**\n• On Leave: **${leavesToday}** | WFH: **${wfhToday}** | Absent: **${absentEstimated}**\n• Pending Approvals: **${pendingLeaves} Leaves**, **${pendingExpenses} Expenses**, **${pendingAttendanceRequests} Attendance Req**, **${pendingWFH} WFH**, **${pendingOvertime} OT**`,
    actionCard: {
      type: "admin_dashboard_widget",
      title: "Organization Analytics Overview",
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        today: todayStr,
        presentCount,
        onBreakCount,
        lateCount,
        completedCount,
        leavesToday,
        wfhToday,
        absentEstimated,
        pendingApprovals: {
          leaves: pendingLeaves,
          expenses: pendingExpenses,
          attendanceRequests: pendingAttendanceRequests,
          wfh: pendingWFH,
          overtime: pendingOvertime,
          resignations: pendingResignations,
          issues: openIssues,
        },
      },
    },
  };
};

export const adminGetTodayAttendance = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const targetDate = args?.date || new Date().toISOString().slice(0, 10);
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  const employees = await Employee.find(tenantFilter).select("employeeId name department designation").lean();
  const empMap = {};
  employees.forEach((e) => {
    empMap[e.employeeId] = e;
  });

  const attendanceDocs = await Attendance.find(tenantFilter).lean();
  const records = [];

  attendanceDocs.forEach((doc) => {
    const day = (doc.attendance || []).find((a) => a.date === targetDate);
    if (day && day.punchIn) {
      const empInfo = empMap[doc.employeeId] || { name: doc.employeeName || "Employee", department: "General" };
      records.push({
        employeeId: doc.employeeId,
        name: empInfo.name,
        department: empInfo.department,
        punchIn: new Date(day.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        punchOut: day.punchOut ? new Date(day.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (day.isOnBreak ? "On Break" : "In Progress"),
        status: day.isOnBreak ? "ON BREAK" : (day.status === "COMPLETED" ? "COMPLETED" : "WORKING"),
        loginStatus: day.loginStatus || "ON_TIME",
        workedTime: day.displayTime || (day.workedHours ? `${day.workedHours}h ${day.workedMinutes || 0}m` : "Active"),
      });
    }
  });

  let filteredRecords = records;
  if (args?.employeeName) {
    const term = args.employeeName.toLowerCase();
    filteredRecords = filteredRecords.filter((r) => r.name.toLowerCase().includes(term) || r.employeeId.toLowerCase().includes(term));
  }
  if (args?.department) {
    const deptTerm = args.department.toLowerCase();
    filteredRecords = filteredRecords.filter((r) => r.department && r.department.toLowerCase().includes(deptTerm));
  }

  const deptLabel = args?.department ? ` (${args.department} Dept)` : "";

  return {
    success: true,
    message: args?.employeeName && filteredRecords.length > 0
      ? `📅 Attendance for **${filteredRecords[0].name}** (${targetDate}): Punch-In: **${filteredRecords[0].punchIn}**, Status: **${filteredRecords[0].status}**, Worked: **${filteredRecords[0].workedTime}**`
      : `📅 Attendance for **${targetDate}**${deptLabel}: **${filteredRecords.length}** employee(s) clocked in.`,
    actionCard: {
      type: "admin_attendance_list_widget",
      title: `Live Attendance (${targetDate})${deptLabel}`,
      data: {
        date: targetDate,
        totalPresent: filteredRecords.length,
        records: filteredRecords,
      },
    },
  };
};

export const adminGetAbsentEmployees = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const todayStr = args?.date || new Date().toISOString().slice(0, 10);
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }], status: "Active" };

  const employees = await Employee.find(tenantFilter).select("employeeId name department email phone").lean();
  const attendanceDocs = await Attendance.find({ $or: [{ adminId }, { companyId: companyId || adminId }] }).lean();

  const clockedInIds = new Set();
  attendanceDocs.forEach((doc) => {
    const today = (doc.attendance || []).find((a) => a.date === todayStr);
    if (today && today.punchIn) {
      clockedInIds.add(doc.employeeId);
    }
  });

  const leavesToday = await LeaveRequest.find({
    $or: [{ adminId }, { companyId: companyId || adminId }],
    status: "Approved",
    from: { $lte: todayStr },
    to: { $gte: todayStr },
  }).lean();
  const leaveEmpIds = new Set(leavesToday.map((l) => l.employeeId));

  const absentList = employees.filter((e) => !clockedInIds.has(e.employeeId) && !leaveEmpIds.has(e.employeeId));

  return {
    success: true,
    message: `🚨 **Absent Employees Today (${todayStr})**: **${absentList.length}** employee(s) have not clocked in.`,
    actionCard: {
      type: "admin_absent_list_widget",
      title: `Absent Employees (${todayStr})`,
      data: {
        count: absentList.length,
        absentList,
      },
    },
  };
};

export const adminGetLateEmployees = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const todayStr = args?.date || new Date().toISOString().slice(0, 10);
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  const employees = await Employee.find(tenantFilter).select("employeeId name department phone").lean();
  const empMap = {};
  employees.forEach((e) => {
    empMap[e.employeeId] = e;
  });

  const attendanceDocs = await Attendance.find(tenantFilter).lean();
  const lateList = [];

  attendanceDocs.forEach((doc) => {
    const day = (doc.attendance || []).find((a) => a.date === todayStr);
    if (day && day.punchIn && day.loginStatus === "LATE") {
      const empInfo = empMap[doc.employeeId] || { name: doc.employeeName || "Employee", department: "General" };
      lateList.push({
        employeeId: doc.employeeId,
        name: empInfo.name,
        department: empInfo.department,
        punchIn: new Date(day.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        lateByMinutes: day.lateByMinutes || 0,
        lateCorrectionStatus: day.lateCorrectionRequest?.status || "None",
        lateReason: day.lateCorrectionRequest?.reason || "No reason submitted",
      });
    }
  });

  return {
    success: true,
    message: `⏰ **Late Arrivals Today (${todayStr})**: **${lateList.length}** employee(s) clocked in late.`,
    actionCard: {
      type: "admin_late_list_widget",
      title: `Late Arrivals (${todayStr})`,
      data: {
        count: lateList.length,
        lateList,
      },
    },
  };
};

export const adminGetPendingApprovals = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  const [leaves, expenses, wfh, overtime, punchOuts, attendanceRequests, resignations] = await Promise.all([
    LeaveRequest.find({ ...tenantFilter, status: "Pending" }).limit(10).lean(),
    Expense.find({ ...tenantFilter, status: "Pending" }).limit(10).lean(),
    WorkModeRequest.find({ ...tenantFilter, status: "Pending" }).limit(10).lean(),
    Overtime.find({ ...tenantFilter, status: "PENDING" }).limit(10).lean(),
    PunchOutRequest.find({ ...tenantFilter, status: "Pending" }).limit(10).lean(),
    AttendanceRequest.find({ ...tenantFilter, requestStatus: "pending" }).limit(10).lean(),
    Resignation.find({ adminId, status: "Pending" }).limit(10).lean(),
  ]);

  const total = leaves.length + expenses.length + wfh.length + overtime.length + punchOuts.length + attendanceRequests.length + resignations.length;

  return {
    success: true,
    message: `📋 **Pending Approvals Summary**: You have **${total}** items waiting for approval.`,
    actionCard: {
      type: "admin_pending_approvals_widget",
      title: "Pending Approvals Hub",
      data: {
        total,
        leaves: leaves.map((l) => ({ id: l._id, employee: l.requesterName || l.employeeId, dates: `${l.from} to ${l.to}`, type: l.leaveType, reason: l.reason })),
        expenses: expenses.map((e) => ({ id: e._id, employee: e.employeeName, amount: e.amount, category: e.category, date: e.date })),
        wfh: wfh.map((w) => ({ id: w._id, employee: w.employeeName, mode: w.requestedMode, reason: w.reason })),
        overtime: overtime.map((o) => ({ id: o._id, employee: o.employeeName, hours: o.hours, date: o.date, reason: o.reason })),
        punchOuts: punchOuts.map((p) => ({ id: p._id, employee: p.employeeName, date: p.originalDate, reason: p.reason })),
        attendanceRequests: attendanceRequests.map((a) => ({ id: a._id, employee: a.employeeName, date: a.date, requested: a.requestedPunchIn || a.requestedStatus, reason: a.reason })),
        resignations: resignations.map((r) => ({ id: r._id, employee: r.employeeName, reason: r.reason })),
      },
    },
  };
};

export const adminGetLeaveRequests = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  const query = { ...tenantFilter };

  const monthNameMap = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };

  let targetMonth = args?.month || "";
  let monthNum = "";
  if (targetMonth) {
    const cleanMonth = targetMonth.toLowerCase().trim();
    monthNum = monthNameMap[cleanMonth] || (cleanMonth.length === 2 ? cleanMonth : "");
  }

  const currentYear = new Date().getFullYear();
  if (monthNum) {
    const year = args?.year || currentYear;
    const monthPrefix = `${year}-${monthNum}`;
    query.$or = [
      { from: new RegExp(`^${monthPrefix}`) },
      { to: new RegExp(`^${monthPrefix}`) },
      { from: { $lte: `${monthPrefix}-31` }, to: { $gte: `${monthPrefix}-01` } },
    ];
  }

  if (args?.status && args.status !== "all") {
    query.status = new RegExp(`^${args.status}$`, "i");
  }

  if (args?.employeeName) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { requesterName: new RegExp(args.employeeName, "i") },
        { employeeId: args.employeeName },
      ],
    });
  }

  const leaves = await LeaveRequest.find(query).sort({ createdAt: -1 }).limit(30).lean();

  const monthLabel = targetMonth ? `for ${targetMonth.toUpperCase()}` : "";
  const pendingCount = leaves.filter((l) => l.status === "Pending").length;
  const approvedCount = leaves.filter((l) => l.status === "Approved").length;

  return {
    success: true,
    message: `🏖️ **Leave Requests ${monthLabel}**: Found **${leaves.length}** leave request(s) (${pendingCount} pending, ${approvedCount} approved).`,
    actionCard: {
      type: "admin_leave_list_widget",
      title: `Leave Requests ${monthLabel || "Overview"}`,
      data: {
        total: leaves.length,
        pendingCount,
        approvedCount,
        leaves: leaves.map((l) => ({
          id: l._id.toString(),
          employee: l.requesterName || l.employeeId,
          type: l.leaveType,
          dates: `${l.from} to ${l.to}`,
          reason: l.reason || "N/A",
          status: l.status,
          appliedOn: l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "--",
        })),
      },
    },
  };
};

/* =========================================================================
   👥 2. EMPLOYEE DIRECTORY & PROFILE LOOKUP
========================================================================= */
export const adminGetAllEmployees = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const query = { $or: [{ adminId }, { companyId: companyId || adminId }] };

  if (args?.department) {
    query.department = new RegExp(args.department, "i");
  }
  if (args?.status) {
    query.status = args.status;
  }

  const employees = await Employee.find(query)
    .select("employeeId name firstName lastName email department designation salary phone status joiningDate")
    .limit(30)
    .lean();

  return {
    success: true,
    message: `👥 **Employee Directory**: Found **${employees.length}** employees.`,
    actionCard: {
      type: "admin_employee_directory_widget",
      title: "Employee Directory",
      data: {
        total: employees.length,
        employees,
      },
    },
  };
};

export const adminGetEmployeeProfile = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.query || args?.employeeName || args?.employeeId;

  if (!term) {
    throw new Error("Please specify an employee name or employee ID to view their profile.");
  }

  const emp = await Employee.findOne({
    $or: [
      { employeeId: term },
      { name: new RegExp(term, "i") },
      { firstName: new RegExp(term, "i") },
      { email: term.toLowerCase() },
      { _id: mongoose.isValidObjectId(term) ? term : null },
    ],
    $and: [{ $or: [{ adminId }, { companyId: companyId || adminId }] }],
  }).lean();

  if (!emp) {
    throw new Error(`Employee matching '${term}' not found in your organization.`);
  }

  // Get leave balance & attendance summary
  const [leaves, attendanceDoc] = await Promise.all([
    LeaveRequest.find({ employeeId: emp.employeeId, status: "Approved" }).lean(),
    Attendance.findOne({ $or: [{ employeeId: emp.employeeId }, { employeeId: emp._id.toString() }] }).lean(),
  ]);

  return {
    success: true,
    message: `👤 **Employee Profile**: ${emp.name} (${emp.employeeId})\n• Department: **${emp.department || "N/A"}** | Role: **${emp.designation || "N/A"}**\n• Status: **${emp.status || "Active"}** | Salary: **₹${(emp.salary || 0).toLocaleString()}**\n• Email: **${emp.email}** | Phone: **${emp.phone || "N/A"}**`,
    actionCard: {
      type: "admin_employee_profile_widget",
      title: `Employee Profile: ${emp.name}`,
      data: {
        employee: emp,
        approvedLeavesCount: leaves.length,
        attendanceHistoryDays: (attendanceDoc?.attendance || []).length,
      },
    },
  };
};

/* =========================================================================
   ⚙️ 3. SHIFTS, HOLIDAYS & POLICIES
========================================================================= */
export const adminGetShifts = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const shifts = await Shift.find({ $or: [{ adminId }, { companyId: companyId || adminId }] }).lean();

  return {
    success: true,
    message: `⏰ Found **${shifts.length}** configured shift(s).`,
    actionCard: {
      type: "admin_shifts_widget",
      title: "Shift Timings & Rules",
      data: shifts,
    },
  };
};

export const adminGetHolidays = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const holidays = await Holiday.find({ $or: [{ adminId }, { companyId: companyId || adminId }] })
    .sort({ date: 1 })
    .lean();

  return {
    success: true,
    message: `📅 Holiday calendar contains **${holidays.length}** official holiday(s).`,
    actionCard: {
      type: "admin_holidays_widget",
      title: "Company Holiday Calendar",
      data: holidays,
    },
  };
};

export const adminGetNotices = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const notices = await Notice.find({
    $or: [{ adminId }, { companyId: companyId || adminId }],
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
    success: true,
    message: `📢 Found **${notices.length}** broadcast notice(s)/announcement(s).`,
    actionCard: {
      type: "admin_notices_widget",
      title: "Company Announcements & Notices",
      data: {
        total: notices.length,
        notices: notices.map((n) => ({
          id: n._id.toString(),
          title: n.title,
          description: n.description,
          category: n.category || "General",
          date: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "--",
        })),
      },
    },
  };
};

export const adminGetPayrollSummary = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const month = args?.month || new Date().toISOString().slice(0, 7);

  const records = await PayrollRecord.find({
    $or: [{ adminId }, { companyId: companyId || adminId }],
    month,
  }).lean();

  const totalGross = records.reduce((acc, r) => acc + (r.grossSalary || r.basicSalary || 0), 0);
  const totalNet = records.reduce((acc, r) => acc + (r.netSalary || 0), 0);
  const totalDeductions = records.reduce((acc, r) => acc + (r.deductions || 0), 0);

  return {
    success: true,
    message: `💵 **Payroll Summary (${month})**:\n• Processed: **${records.length}** records\n• Total Outlay: **₹${totalGross.toLocaleString()}**\n• Net Disbursed: **₹${totalNet.toLocaleString()}**\n• Total Deductions: **₹${totalDeductions.toLocaleString()}**`,
    actionCard: {
      type: "admin_payroll_summary_widget",
      title: `Payroll Summary: ${month}`,
      data: {
        month,
        totalRecords: records.length,
        totalGross,
        totalNet,
        totalDeductions,
        records: records.slice(0, 10),
      },
    },
  };
};

export const adminGetIdleTracking = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }], status: "Active" };

  const todayStr = args?.date || new Date().toISOString().slice(0, 10);

  const employees = await Employee.find(tenantFilter)
    .select("employeeId name department designation email phone")
    .lean();

  const empIds = employees.map((e) => e.employeeId);
  const liveDocs = await LiveTracking.find({ employeeId: { $in: empIds } }).lean();

  const employeeTrackingList = [];
  let idleCount = 0;
  let workingCount = 0;
  let offlineCount = 0;

  employees.forEach((emp) => {
    const liveDoc = liveDocs.find((d) => d.employeeId === emp.employeeId);
    let todayData = null;
    if (liveDoc?.dates) {
      if (liveDoc.dates instanceof Map) {
        todayData = liveDoc.dates.get(todayStr);
      } else {
        todayData = liveDoc.dates[todayStr];
      }
    }

    const currentStatus = todayData?.currentStatus || "OFFLINE";
    const idleSeconds = todayData?.trackedIdleSeconds || 0;
    const workSeconds = todayData?.trackedWorkSeconds || 0;

    const idleMins = Math.round(idleSeconds / 60);
    const workHours = (workSeconds / 3600).toFixed(1);

    if (currentStatus === "IDLE") idleCount++;
    else if (currentStatus === "WORKING") workingCount++;
    else offlineCount++;

    let idleDisplay = `${idleMins}m`;
    if (idleMins >= 60) {
      const h = Math.floor(idleMins / 60);
      const m = idleMins % 60;
      idleDisplay = `${h}h ${m}m`;
    }

    employeeTrackingList.push({
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department || "General",
      status: currentStatus,
      idleTimeFormatted: idleDisplay,
      idleSeconds,
      workHoursFormatted: `${workHours}h`,
      activeWindow: todayData?.activeWindow || "N/A",
      idleSessionsCount: (todayData?.idleTimeline || []).length,
      lastPing: todayData?.lastPing ? new Date(todayData.lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A",
      screenshotUrl: todayData?.currentIdleScreenshot || null,
    });
  });

  employeeTrackingList.sort((a, b) => {
    const order = { IDLE: 0, WORKING: 1, OFFLINE: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  let filteredList = employeeTrackingList;
  if (args?.employeeName) {
    const term = args.employeeName.toLowerCase();
    filteredList = employeeTrackingList.filter((e) => e.name.toLowerCase().includes(term) || e.employeeId.toLowerCase().includes(term));
  }

  return {
    success: true,
    message: `⏱️ **Live Activity & Idle Tracking (${todayStr})**:\n• **${idleCount}** Idle | **${workingCount}** Active Working | **${offlineCount}** Offline\n• Total Staff Monitored: **${employees.length}**`,
    actionCard: {
      type: "admin_idle_tracking_widget",
      title: `Live Activity & Idle Tracking (${todayStr})`,
      data: {
        date: todayStr,
        totalEmployees: employees.length,
        idleCount,
        workingCount,
        offlineCount,
        records: filteredList,
      },
    },
  };
};

export const adminGetOfficeSettings = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const settings = await OfficeSettings.findOne({
    $or: [{ adminId }, { companyId: companyId || adminId }],
  }).lean();

  if (!settings) {
    return {
      success: true,
      message: `📍 **Office & Location Settings**:\n• Global Work Mode: **WFO** (Work from Office)\n• Allowed Geofence Radius: **200 meters**\n• Location: Not yet configured`,
    };
  }

  const loc = settings.officeLocation || {};
  const latStr = loc.latitude ? loc.latitude.toFixed(6) : "N/A";
  const lngStr = loc.longitude ? loc.longitude.toFixed(6) : "N/A";

  return {
    success: true,
    message: `📍 **Office Location & Geofencing Settings**:\n• **Global Mode**: **${settings.globalWorkMode || "WFO"}**\n• **Geofence Radius**: **${settings.allowedRadius || 200} meters**\n• **Coordinates**: Latitude: \`${latStr}\`, Longitude: \`${lngStr}\`\n• **Screenshot Interval**: Every **${settings.screenshotIntervalMinutes || 5} minutes**\n• **Accurate GPS Enforced**: **${settings.requireAccurateLocation ? "Yes" : "No"}**`,
    actionCard: {
      type: "admin_office_settings_widget",
      title: "Office Location & Work Mode Settings",
      data: {
        globalWorkMode: settings.globalWorkMode || "WFO",
        allowedRadius: settings.allowedRadius || 200,
        latitude: latStr,
        longitude: lngStr,
        screenshotIntervalMinutes: settings.screenshotIntervalMinutes || 5,
        overridesCount: (settings.employeeWorkModes || []).length,
      },
    },
  };
};

export const adminGetPerformanceReports = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const tenantFilter = { $or: [{ adminId }, { companyId: companyId || adminId }], status: "Active" };

  const todayStr = args?.date || new Date().toISOString().slice(0, 10);
  const startOfDay = new Date(todayStr); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(todayStr); endOfDay.setHours(23, 59, 59, 999);

  const employees = await Employee.find(tenantFilter)
    .select("employeeId name department designation")
    .lean();

  const empMap = {};
  employees.forEach((e) => { empMap[e._id.toString()] = e; });

  const entries = await DailyWorkEntry.find({
    employeeId: { $in: employees.map((e) => e._id) },
    date: { $gte: startOfDay, $lte: endOfDay },
  }).lean();

  const totalSubmitted = entries.length;
  const approved = entries.filter((e) => e.status === "approved").length;
  const pending = entries.filter((e) => e.status === "pending").length;

  const records = entries.map((e) => {
    const emp = empMap[e.employeeId?.toString()] || { name: "Employee", department: "General" };
    return {
      id: e._id.toString(),
      employeeName: emp.name,
      department: emp.department,
      morningTitle: e.morning_title,
      submittedPercentage: e.employee_submitted_percentage || 0,
      approvedPercentage: e.daily_work_percentage || 0,
      status: e.status,
    };
  });

  return {
    success: true,
    message: `📊 **Performance & Work Reports (${todayStr})**:\n• Submitted: **${totalSubmitted}/${employees.length}** employees\n• Approved: **${approved}** | Pending: **${pending}**`,
    actionCard: {
      type: "admin_performance_widget",
      title: `Daily Work Reports (${todayStr})`,
      data: {
        date: todayStr,
        totalEmployees: employees.length,
        totalSubmitted,
        approvedCount: approved,
        pendingCount: pending,
        records,
      },
    },
  };
};

export const adminGetSupportAdmins = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;

  const supportAdmins = await SupportAdmin.find({ adminId })
    .select("name email role department employeeId status createdAt")
    .lean();

  return {
    success: true,
    message: `🛡️ **Support Admin Management**: Found **${supportAdmins.length}** support admin(s)/manager(s).`,
    actionCard: {
      type: "admin_support_admins_widget",
      title: "Support Admin Management",
      data: {
        total: supportAdmins.length,
        admins: supportAdmins.map((s) => ({
          id: s._id.toString(),
          name: s.name,
          email: s.email,
          role: s.role || "support-admin",
          department: s.department || "General",
          status: s.status || "Active",
          addedOn: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "--",
        })),
      },
    },
  };
};

export const adminGetCompanyRules = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const rules = await Rule.find({
    $or: [{ adminId }, { companyId: companyId || adminId }],
  })
    .sort({ createdAt: -1 })
    .lean();

  if (rules.length === 0) {
    return {
      success: true,
      message: "📜 **Company Rules & Guidelines**:\nNo company rules have been published yet. You can type **`publish rule: [title] - [content]`** to create one.",
      actionCard: {
        type: "admin_rules_widget",
        title: "Company Rules & Policies",
        data: {
          total: 0,
          rules: [],
        },
      },
    };
  }

  const listText = rules
    .map((r, i) => `${i + 1}. **${r.title}** (${r.category || "General"}):\n   ${r.description}`)
    .join("\n\n");

  return {
    success: true,
    message: `📜 **Company Rules & Policies (${rules.length} Published)**:\n\n${listText}`,
    actionCard: {
      type: "admin_rules_widget",
      title: "Company Rules & Policies",
      data: {
        total: rules.length,
        rules: rules.map((r) => ({
          id: r._id.toString(),
          title: r.title,
          description: r.description,
          category: r.category || "General",
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "--",
        })),
      },
    },
  };
};

/* =========================================================================
   ✍️ 4. DRAFT ACTION GENERATORS (SIGNED ACTION TOKENS)
========================================================================= */
export const adminDraftApproveLeave = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.leaveId || args?.employeeName || args?.employeeId;

  let leave = null;
  if (mongoose.isValidObjectId(term)) {
    leave = await LeaveRequest.findById(term);
  }

  if (!leave) {
    leave = await LeaveRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Pending",
      $or: [{ requesterName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ createdAt: -1 });
  }

  if (!leave) {
    throw new Error(`No pending leave request found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_leave",
    adminId: adminId.toString(),
    leaveId: leave._id.toString(),
    employeeId: leave.employeeId,
    employeeName: leave.requesterName || leave.employeeId,
    from: leave.from,
    to: leave.to,
    leaveType: leave.leaveType,
  });

  return {
    success: true,
    message: `Ready to approve **${leave.leaveType}** for **${leave.requesterName || leave.employeeId}** (${leave.from} to ${leave.to}). Click 'Confirm Approval' below.`,
    actionCard: {
      type: "admin_confirm_approve_leave",
      title: "Approve Leave Request",
      actionToken: token,
      data: {
        leaveId: leave._id.toString(),
        employeeName: leave.requesterName || leave.employeeId,
        leaveType: leave.leaveType,
        dates: `${leave.from} to ${leave.to}`,
        reason: leave.reason,
        adminComment: "Approved by Admin via Copilot",
      },
    },
  };
};

export const adminDraftRejectLeave = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.leaveId || args?.employeeName || args?.employeeId;

  let leave = null;
  if (mongoose.isValidObjectId(term)) {
    leave = await LeaveRequest.findById(term);
  }

  if (!leave) {
    leave = await LeaveRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Pending",
      $or: [{ requesterName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ createdAt: -1 });
  }

  if (!leave) {
    throw new Error(`No pending leave request found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_reject_leave",
    adminId: adminId.toString(),
    leaveId: leave._id.toString(),
    employeeName: leave.requesterName || leave.employeeId,
    reason: args?.reason || "Rejected by Administrator",
  });

  return {
    success: true,
    message: `Confirm rejection for **${leave.requesterName || leave.employeeId}**'s leave request?`,
    actionCard: {
      type: "admin_confirm_reject_leave",
      title: "Reject Leave Request",
      actionToken: token,
      data: {
        leaveId: leave._id.toString(),
        employeeName: leave.requesterName || leave.employeeId,
        dates: `${leave.from} to ${leave.to}`,
        reason: args?.reason || "Operational constraints",
      },
    },
  };
};

export const adminDraftApproveExpense = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.expenseId || args?.employeeName;

  let exp = null;
  if (mongoose.isValidObjectId(term)) {
    exp = await Expense.findById(term);
  }

  if (!exp) {
    exp = await Expense.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Pending",
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeCustomId: term }],
    }).sort({ createdAt: -1 });
  }

  if (!exp) {
    throw new Error(`No pending expense claim found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_expense",
    adminId: adminId.toString(),
    expenseId: exp._id.toString(),
    allocatedAmount: exp.amount,
  });

  return {
    success: true,
    message: `Ready to approve expense claim of **₹${exp.amount.toLocaleString()}** (${exp.category}) for **${exp.employeeName}**.`,
    actionCard: {
      type: "admin_confirm_approve_expense",
      title: "Approve Expense Claim",
      actionToken: token,
      data: {
        expenseId: exp._id.toString(),
        employeeName: exp.employeeName,
        category: exp.category,
        amount: exp.amount,
        allocatedAmount: exp.amount,
        description: exp.description || "N/A",
      },
    },
  };
};

export const adminDraftRejectExpense = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.expenseId || args?.employeeName;

  let exp = null;
  if (mongoose.isValidObjectId(term)) {
    exp = await Expense.findById(term);
  }

  if (!exp) {
    exp = await Expense.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: { $in: ["Pending", "PENDING", "pending"] },
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeCustomId: term }],
    }).sort({ createdAt: -1 });
  }

  if (!exp) {
    throw new Error(`No pending expense claim found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_reject_expense",
    adminId: adminId.toString(),
    expenseId: exp._id.toString(),
    reason: args?.reason || "Expense claim rejected by administrator",
  });

  return {
    success: true,
    message: `Ready to reject expense claim of **₹${exp.amount.toLocaleString()}** for **${exp.employeeName}**.`,
    actionCard: {
      type: "admin_confirm_reject_expense",
      title: "Reject Expense Claim",
      actionToken: token,
      data: {
        expenseId: exp._id.toString(),
        employeeName: exp.employeeName,
        category: exp.category,
        amount: exp.amount,
        reason: args?.reason || "Expense claim rejected by administrator",
      },
    },
  };
};

export const adminDraftApproveWFH = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.requestId || args?.employeeName;

  let wfh = null;
  if (mongoose.isValidObjectId(term)) {
    wfh = await WorkModeRequest.findById(term);
  }

  if (!wfh) {
    wfh = await WorkModeRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Pending",
      employeeName: new RegExp(term, "i"),
    }).sort({ createdAt: -1 });
  }

  if (!wfh) {
    throw new Error(`No pending WFH request found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_wfh",
    adminId: adminId.toString(),
    requestId: wfh._id.toString(),
    employeeName: wfh.employeeName,
    adminComment: "Approved via Admin Copilot",
  });

  return {
    success: true,
    message: `Ready to approve **${wfh.requestedMode}** request for **${wfh.employeeName}**.`,
    actionCard: {
      type: "admin_confirm_approve_wfh",
      title: "Approve WFH Request",
      actionToken: token,
      data: {
        requestId: wfh._id.toString(),
        employeeName: wfh.employeeName,
        requestedMode: wfh.requestedMode,
        reason: wfh.reason,
        adminComment: "Approved via Admin Copilot",
      },
    },
  };
};

export const adminDraftAddEmployee = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const {
    firstName = "New",
    lastName = "Employee",
    email = "",
    department = "Engineering",
    designation = "Software Engineer",
    salary = 50000,
    phone = "",
  } = args;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_add_employee",
    adminId: adminId.toString(),
    firstName,
    lastName,
    email,
    department,
    designation,
    salary: Number(salary) || 50000,
    phone,
  });

  return {
    success: true,
    message: `Ready to create employee **${firstName} ${lastName}** (${email}) in **${department}**. Please review details below:`,
    actionCard: {
      type: "admin_confirm_add_employee",
      title: "Create New Employee Profile",
      actionToken: token,
      data: {
        firstName,
        lastName,
        email,
        department,
        designation,
        salary: Number(salary) || 50000,
        phone,
      },
    },
  };
};


export const adminDraftApproveOvertime = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.overtimeId || args?.employeeName;

  let ot = null;
  if (mongoose.isValidObjectId(term)) {
    ot = await Overtime.findById(term);
  }
  if (!ot) {
    ot = await Overtime.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "PENDING",
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ createdAt: -1 });
  }

  if (!ot) {
    throw new Error(`No pending overtime claim found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_overtime",
    adminId: adminId.toString(),
    overtimeId: ot._id.toString(),
    employeeName: ot.employeeName,
    hours: ot.hours,
  });

  return {
    success: true,
    message: `Ready to approve **${ot.hours} hours** overtime for **${ot.employeeName}** on ${ot.date}.`,
    actionCard: {
      type: "admin_confirm_approve_overtime",
      title: "Approve Overtime Claim",
      actionToken: token,
      data: {
        overtimeId: ot._id.toString(),
        employeeName: ot.employeeName,
        hours: ot.hours,
        date: ot.date,
        reason: ot.reason,
      },
    },
  };
};

export const adminDraftApproveLate = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.employeeName || args?.employeeId;
  const todayStr = args?.date || new Date().toISOString().slice(0, 10);

  const attendanceDoc = await Attendance.findOne({
    $or: [{ adminId }, { companyId: companyId || adminId }],
    $or: [{ employeeName: new RegExp(term, "i") }, { employeeId: term }],
  });

  if (!attendanceDoc) {
    throw new Error(`Attendance record not found for '${term}'.`);
  }

  const record = (attendanceDoc.attendance || []).find((a) => a.date === todayStr);
  if (!record || !record.lateCorrectionRequest) {
    throw new Error(`No pending late login justification found for '${term}' on ${todayStr}.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_late",
    adminId: adminId.toString(),
    attendanceId: attendanceDoc._id.toString(),
    date: todayStr,
    employeeName: attendanceDoc.employeeName,
  });

  return {
    success: true,
    message: `Ready to approve late login justification for **${attendanceDoc.employeeName}** on ${todayStr}.`,
    actionCard: {
      type: "admin_confirm_approve_late",
      title: "Approve Late Login Justification",
      actionToken: token,
      data: {
        attendanceId: attendanceDoc._id.toString(),
        employeeName: attendanceDoc.employeeName,
        date: todayStr,
        reason: record.lateCorrectionRequest.reason,
      },
    },
  };
};

export const adminDraftApprovePunchOut = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.requestId || args?.employeeName;

  let req = null;
  if (mongoose.isValidObjectId(term)) {
    req = await PunchOutRequest.findById(term);
  }
  if (!req) {
    req = await PunchOutRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Pending",
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ requestDate: -1 });
  }

  if (!req) {
    throw new Error(`No pending missing punch-out request found for '${term}'.`);
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_punch_out",
    adminId: adminId.toString(),
    requestId: req._id.toString(),
    employeeName: req.employeeName,
    date: req.originalDate,
  });

  return {
    success: true,
    message: `Ready to approve missing punch-out request for **${req.employeeName}** on ${req.originalDate}.`,
    actionCard: {
      type: "admin_confirm_approve_punch_out",
      title: "Approve Missing Punch-Out",
      actionToken: token,
      data: {
        requestId: req._id.toString(),
        employeeName: req.employeeName,
        date: req.originalDate,
        reason: req.reason,
      },
    },
  };
};

export const adminDraftApproveAttendanceRequest = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.requestId || args?.employeeName;

  let req = null;
  if (term && mongoose.isValidObjectId(term)) {
    req = await AttendanceRequest.findById(term);
  }
  if (!req && term && term !== "all") {
    req = await AttendanceRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      requestStatus: "pending",
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ requestedAt: -1 });
  }
  if (!req) {
    req = await AttendanceRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      requestStatus: "pending",
    }).sort({ requestedAt: -1 });
  }

  if (!req) {
    throw new Error(term && term !== "all" ? `No pending attendance request found for '${term}'.` : "No pending attendance requests found.");
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_attendance_request",
    adminId: adminId.toString(),
    requestId: req._id.toString(),
    employeeName: req.employeeName,
    date: req.date,
  });

  return {
    success: true,
    message: `Ready to approve attendance request for **${req.employeeName}** on ${req.date}. Requested: **${req.requestedPunchIn || req.requestedStatus || "Correction"}** (Reason: ${req.reason}).`,
    actionCard: {
      type: "admin_confirm_approve_attendance_request",
      title: "Approve Attendance Request",
      actionToken: token,
      data: {
        requestId: req._id.toString(),
        employeeName: req.employeeName,
        date: req.date,
        originalTime: req.currentPunchIn || "N/A",
        requestedTime: req.requestedPunchIn || req.requestedStatus || "Correction",
        reason: req.reason,
      },
    },
  };
};

export const adminDraftRejectAttendanceRequest = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args?.requestId || args?.employeeName;

  let req = null;
  if (term && mongoose.isValidObjectId(term)) {
    req = await AttendanceRequest.findById(term);
  }
  if (!req && term && term !== "all") {
    req = await AttendanceRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      requestStatus: "pending",
      $or: [{ employeeName: new RegExp(term, "i") }, { employeeId: term }],
    }).sort({ requestedAt: -1 });
  }
  if (!req) {
    req = await AttendanceRequest.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      requestStatus: "pending",
    }).sort({ requestedAt: -1 });
  }

  if (!req) {
    throw new Error("No pending attendance requests found to reject.");
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_reject_attendance_request",
    adminId: adminId.toString(),
    requestId: req._id.toString(),
    employeeName: req.employeeName,
    date: req.date,
    adminComment: args?.reason || "Rejected by administrator",
  });

  return {
    success: true,
    message: `Ready to reject attendance request for **${req.employeeName}** on ${req.date}.`,
    actionCard: {
      type: "admin_confirm_reject_attendance_request",
      title: "Reject Attendance Request",
      actionToken: token,
      data: {
        requestId: req._id.toString(),
        employeeName: req.employeeName,
        date: req.date,
        reason: args?.reason || "Rejected by administrator",
      },
    },
  };
};

export const adminDraftUpdateAdminProfile = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const updates = {};

  if (args.phone) updates.phone = String(args.phone).trim();
  if (args.name) updates.name = String(args.name).trim();
  if (args.department) updates.department = String(args.department).trim();
  if (args.address) updates.address = String(args.address).trim();
  if (args.emergencyPhone) updates.emergencyPhone = String(args.emergencyPhone).trim();

  if (Object.keys(updates).length === 0) {
    throw new Error("Please specify at least one field to update in your profile (e.g. phone, department, name).");
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_update_admin_profile",
    adminId: adminId.toString(),
    updates,
  });

  return {
    success: true,
    message: `Ready to update your profile details: ${Object.keys(updates).map(k => `**${k}**: ${updates[k]}`).join(", ")}.`,
    actionCard: {
      type: "admin_confirm_update_admin_profile",
      title: "Update Admin Profile",
      actionToken: token,
      data: {
        ...updates,
      },
    },
  };
};

export const adminDraftUpdateEmployee = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args.employeeId || args.employeeName;

  const emp = await Employee.findOne({
    $or: [
      { employeeId: term },
      { name: new RegExp(term, "i") },
      { firstName: new RegExp(term, "i") },
      { _id: mongoose.isValidObjectId(term) ? term : null },
    ],
    $and: [{ $or: [{ adminId }, { companyId: companyId || adminId }] }],
  });

  if (!emp) {
    throw new Error(`Employee '${term}' not found.`);
  }

  const updates = {};
  if (args.phone) updates.phone = String(args.phone).trim();
  if (args.department) updates.department = String(args.department).trim();
  if (args.designation) updates.designation = String(args.designation).trim();
  if (args.salary !== undefined) updates.salary = Number(args.salary);
  if (args.status) updates.status = String(args.status);

  const token = generateAdminActionToken({
    actionType: "admin_confirm_update_employee",
    adminId: adminId.toString(),
    employeeId: emp.employeeId,
    employeeName: emp.name,
    updates,
  });

  return {
    success: true,
    message: `Ready to update employee **${emp.name}** (${emp.employeeId}): ${Object.keys(updates).map(k => `**${k}**: ${updates[k]}`).join(", ")}.`,
    actionCard: {
      type: "admin_confirm_update_employee",
      title: `Update Employee: ${emp.name}`,
      actionToken: token,
      data: {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        ...updates,
      },
    },
  };
};

export const adminDraftToggleMobileAccess = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const enabled = args.enabled !== undefined ? Boolean(args.enabled) : true;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_toggle_mobile_access",
    adminId: adminId.toString(),
    enabled,
  });

  return {
    success: true,
    message: `Ready to ${enabled ? "enable" : "disable"} mobile attendance access for employees.`,
    actionCard: {
      type: "admin_confirm_toggle_mobile_access",
      title: `${enabled ? "Enable" : "Disable"} Mobile Attendance Access`,
      actionToken: token,
      data: {
        setting: "Mobile Attendance Access",
        action: enabled ? "Enable" : "Disable",
      },
    },
  };
};

export const adminDraftAssignTask = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args.employeeId || args.employeeName;
  const title = args.title || "Complete Assigned Project Task";
  const description = args.description || args.title || "Assigned via AI Copilot";

  let emp = null;
  if (term) {
    emp = await Employee.findOne({
      $or: [
        { employeeId: term },
        { name: new RegExp(term, "i") },
        { firstName: new RegExp(term, "i") },
        { _id: mongoose.isValidObjectId(term) ? term : null },
      ],
      $and: [{ $or: [{ adminId }, { companyId: companyId || adminId }] }],
    });
  }

  if (!emp) {
    emp = await Employee.findOne({
      $or: [{ adminId }, { companyId: companyId || adminId }],
      status: "Active",
    });
  }

  if (!emp) {
    throw new Error("No employee found in your organization to assign a task.");
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_assign_task",
    adminId: adminId.toString(),
    employeeId: emp.employeeId,
    employeeName: emp.name,
    title,
    description,
  });

  return {
    success: true,
    message: `Ready to assign task **'${title}'** to **${emp.name}** (${emp.employeeId}).`,
    actionCard: {
      type: "admin_confirm_assign_task",
      title: `Assign Task: ${emp.name}`,
      actionToken: token,
      data: {
        employeeName: emp.name,
        employeeId: emp.employeeId,
        title,
        description,
      },
    },
  };
};

export const adminDraftApproveWorkReport = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args.entryId || args.employeeName || args.employeeId;

  let entry = null;
  if (term && mongoose.isValidObjectId(term)) {
    entry = await DailyWorkEntry.findById(term).populate("employeeId");
  }

  if (!entry && term) {
    const emp = await Employee.findOne({
      name: { $regex: new RegExp(term.trim(), "i") },
      $or: [{ adminId }, { companyId: companyId || adminId }],
    });
    if (emp) {
      entry = await DailyWorkEntry.findOne({ employeeId: emp._id }).sort({ date: -1 }).populate("employeeId");
    }
  }

  const empName = entry?.employeeId?.name || term || "Employee";
  const percentage = args.percentage || entry?.employee_submitted_percentage || 100;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_work_report",
    adminId: adminId.toString(),
    entryId: entry?._id ? entry._id.toString() : undefined,
    employeeName: empName,
    percentage: Number(percentage),
  });

  return {
    success: true,
    message: `Ready to approve daily work report for **${empName}** with score **${percentage}%**.`,
    actionCard: {
      type: "admin_confirm_approve_work_report",
      title: `Approve Work Report: ${empName}`,
      actionToken: token,
      data: {
        employee: empName,
        task: entry?.morning_title || "Daily Work Report",
        percentage: `${percentage}%`,
        date: entry?.date ? new Date(entry.date).toLocaleDateString() : new Date().toLocaleDateString(),
        status: "Approved",
      },
    },
  };
};

export const adminDraftRejectWorkReport = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const term = args.entryId || args.employeeName || args.employeeId;

  let entry = null;
  if (term && mongoose.isValidObjectId(term)) {
    entry = await DailyWorkEntry.findById(term).populate("employeeId");
  }

  if (!entry && term) {
    const emp = await Employee.findOne({
      name: { $regex: new RegExp(term.trim(), "i") },
      $or: [{ adminId }, { companyId: companyId || adminId }],
    });
    if (emp) {
      entry = await DailyWorkEntry.findOne({ employeeId: emp._id }).sort({ date: -1 }).populate("employeeId");
    }
  }

  const empName = entry?.employeeId?.name || term || "Employee";

  const token = generateAdminActionToken({
    actionType: "admin_confirm_reject_work_report",
    adminId: adminId.toString(),
    entryId: entry?._id ? entry._id.toString() : undefined,
    employeeName: empName,
  });

  return {
    success: true,
    message: `Ready to reject daily work report for **${empName}**.`,
    actionCard: {
      type: "admin_confirm_reject_work_report",
      title: `Reject Work Report: ${empName}`,
      actionToken: token,
      data: {
        employee: empName,
        task: entry?.morning_title || "Daily Work Report",
        date: entry?.date ? new Date(entry.date).toLocaleDateString() : new Date().toLocaleDateString(),
        status: "Rejected",
      },
    },
  };
};

export const adminDraftApproveResignation = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const target = args.employeeName || args.employee || args.name || "";
  const query = { adminId, status: "Pending" };
  if (target) {
    query.employeeName = new RegExp(target.trim(), "i");
  }

  const reqDoc = await Resignation.findOne(query).sort({ createdAt: -1 }).lean();
  if (!reqDoc) {
    return {
      success: false,
      message: target
        ? `No pending resignation request found for employee "${target}".`
        : "No pending resignation requests waiting for approval.",
    };
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_approve_resignation",
    adminId: adminId.toString(),
    resignationId: reqDoc._id.toString(),
    employeeName: reqDoc.employeeName,
    reason: reqDoc.reason,
    adminRemark: args.adminRemark || "Resignation approved by management.",
  });

  return {
    success: true,
    message: `Ready to approve resignation for **${reqDoc.employeeName}** (Reason: *${reqDoc.reason}*).`,
    actionCard: {
      type: "admin_confirm_approve_resignation",
      title: "Approve Resignation",
      actionToken: token,
      data: {
        employeeName: reqDoc.employeeName,
        reason: reqDoc.reason,
        adminRemark: "Resignation approved by management.",
      },
    },
  };
};

export const adminDraftRejectResignation = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const target = args.employeeName || args.employee || args.name || "";
  const query = { adminId, status: "Pending" };
  if (target) {
    query.employeeName = new RegExp(target.trim(), "i");
  }

  const reqDoc = await Resignation.findOne(query).sort({ createdAt: -1 }).lean();
  if (!reqDoc) {
    return {
      success: false,
      message: target
        ? `No pending resignation request found for employee "${target}".`
        : "No pending resignation requests waiting for review.",
    };
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_reject_resignation",
    adminId: adminId.toString(),
    resignationId: reqDoc._id.toString(),
    employeeName: reqDoc.employeeName,
    reason: reqDoc.reason,
    adminRemark: args.adminRemark || "Resignation retained / rejected.",
  });

  return {
    success: true,
    message: `Ready to reject resignation for **${reqDoc.employeeName}**.`,
    actionCard: {
      type: "admin_confirm_reject_resignation",
      title: "Reject Resignation",
      actionToken: token,
      data: {
        employeeName: reqDoc.employeeName,
        reason: reqDoc.reason,
        adminRemark: "Resignation retained / rejected.",
      },
    },
  };
};

export const adminDraftResolveIssue = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const target = args.subject || args.title || args.issue || "";
  const query = {
    $or: [{ adminId }, { companyId: companyId || adminId }],
    status: { $in: ["pending", "in_progress", "Open", "Pending"] },
  };
  if (target) {
    query.subject = new RegExp(target.trim(), "i");
  }

  const issueDoc = await TechnicalIssue.findOne(query).sort({ createdAt: -1 }).lean();
  if (!issueDoc) {
    return {
      success: false,
      message: target
        ? `No open support ticket found matching "${target}".`
        : "No open support tickets waiting for resolution.",
    };
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_resolve_issue",
    adminId: adminId.toString(),
    issueId: issueDoc._id.toString(),
    subject: issueDoc.subject,
    status: "resolved",
    reply: args.reply || "Issue resolved by administrator via AI Copilot.",
  });

  return {
    success: true,
    message: `Ready to resolve support ticket **${issueDoc.subject}** (${issueDoc.category}).`,
    actionCard: {
      type: "admin_confirm_resolve_issue",
      title: "Resolve Support Ticket",
      actionToken: token,
      data: {
        subject: issueDoc.subject,
        category: issueDoc.category,
        status: "Resolved",
        reply: "Issue resolved by administrator via AI Copilot.",
      },
    },
  };
};

export const adminDraftUpdateShift = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;
  const employeeName = args.employeeName || args.targetEmployee || "";
  const shiftName = args.shiftName || "General Shift";
  const startTime = args.startTime || "09:30";
  const endTime = args.endTime || "18:30";
  const gracePeriod = Number(args.gracePeriod) || 15;
  const halfDayThreshold = Number(args.halfDayThreshold || args.halfDayHours) || 4;
  const fullDayThreshold = Number(args.fullDayThreshold || args.fullDayHours) || 8;

  let emp = null;
  if (employeeName && employeeName !== "all" && employeeName !== "General Shift") {
    emp = await Employee.findOne({
      $or: [{ adminId }, { company: companyId || adminId }, { companyId: companyId || adminId }],
      $or: [
        { name: new RegExp(employeeName.trim(), "i") },
        { employeeId: employeeName.trim() },
        { email: new RegExp(employeeName.trim(), "i") },
      ],
    }).lean();
  }

  const token = generateAdminActionToken({
    actionType: "admin_confirm_update_shift",
    adminId: adminId.toString(),
    employeeName: emp ? emp.name : (employeeName || "General Shift"),
    employeeId: emp ? emp.employeeId : null,
    shiftName,
    startTime,
    endTime,
    gracePeriod,
    halfDayThreshold,
    fullDayThreshold,
  });

  const targetMsg = emp ? `for **${emp.name}** (${emp.employeeId})` : "for organization";
  return {
    success: true,
    message: `Ready to update shift timing ${targetMsg} to **${startTime} - ${endTime}** (Grace: ${gracePeriod}m).`,
    actionCard: {
      type: "admin_confirm_update_shift",
      title: emp ? `Update Shift: ${emp.name}` : "Update Shift Timings",
      actionToken: token,
      data: {
        target: emp ? `${emp.name} (${emp.employeeId})` : "All Employees",
        shiftName,
        startTime,
        endTime,
        gracePeriod,
        halfDayThreshold,
        fullDayThreshold,
      },
    },
  };
};

export const adminDraftPostNotice = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const title = args.title || "Company Notice";
  const description = args.description || title;
  const meetingDate = args.meetingDate || "";
  const meetingTime = args.meetingTime || "";
  const recipients = args.recipients || "ALL";

  const token = generateAdminActionToken({
    actionType: "admin_confirm_post_notice",
    adminId: adminId.toString(),
    title,
    description,
    meetingDate,
    meetingTime,
    recipients,
  });

  return {
    success: true,
    message: `Ready to broadcast company notice **'${title}'**.`,
    actionCard: {
      type: "admin_confirm_post_notice",
      title: "Broadcast Company Notice",
      actionToken: token,
      data: {
        title,
        description,
        meetingDate: meetingDate || "N/A",
        meetingTime: meetingTime || "N/A",
        recipients,
      },
    },
  };
};

export const adminDraftAddHoliday = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const name = args.name || "Company Holiday";
  const date = args.date || new Date().toISOString().slice(0, 10);
  const type = args.type || "General";

  const token = generateAdminActionToken({
    actionType: "admin_confirm_add_holiday",
    adminId: adminId.toString(),
    name,
    date,
    type,
  });

  return {
    success: true,
    message: `Ready to add holiday **'${name}'** on **${date}** to company calendar.`,
    actionCard: {
      type: "admin_confirm_add_holiday",
      title: "Add Company Holiday",
      actionToken: token,
      data: {
        name,
        date,
        type,
      },
    },
  };
};

export const adminDraftPostRule = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const title = args.title || "Company Rule";
  const content = args.content || title;
  const category = args.category || "General";

  const token = generateAdminActionToken({
    actionType: "admin_confirm_post_rule",
    adminId: adminId.toString(),
    title,
    content,
    category,
  });

  return {
    success: true,
    message: `Ready to publish company rule **'${title}'**.`,
    actionCard: {
      type: "admin_confirm_post_rule",
      title: "Publish Workplace Rule",
      actionToken: token,
      data: {
        title,
        content,
        category,
      },
    },
  };
};

/* =========================================================================
   ⚡ MAIN ADMIN TOOL EXECUTOR
========================================================================= */
export const executeAdminCopilotTool = async (toolName, toolArgs, loggedAdmin) => {
  switch (toolName) {
    case "admin_get_dashboard_summary":
      return adminGetDashboardSummary(toolArgs, loggedAdmin);
    case "admin_get_today_attendance":
      return adminGetTodayAttendance(toolArgs, loggedAdmin);
    case "admin_get_absent_employees":
      return adminGetAbsentEmployees(toolArgs, loggedAdmin);
    case "admin_get_late_employees":
      return adminGetLateEmployees(toolArgs, loggedAdmin);
    case "admin_get_pending_approvals":
      return adminGetPendingApprovals(toolArgs, loggedAdmin);
    case "admin_get_leave_requests":
      return adminGetLeaveRequests(toolArgs, loggedAdmin);
    case "admin_get_all_employees":
      return adminGetAllEmployees(toolArgs, loggedAdmin);
    case "admin_get_employee_profile":
      return adminGetEmployeeProfile(toolArgs, loggedAdmin);
    case "admin_get_shifts":
      return adminGetShifts(toolArgs, loggedAdmin);
    case "admin_get_holidays":
      return adminGetHolidays(toolArgs, loggedAdmin);
    case "admin_get_notices":
      return adminGetNotices(toolArgs, loggedAdmin);
    case "admin_get_payroll_summary":
      return adminGetPayrollSummary(toolArgs, loggedAdmin);
    case "admin_get_idle_tracking":
      return adminGetIdleTracking(toolArgs, loggedAdmin);
    case "admin_get_office_settings":
      return adminGetOfficeSettings(toolArgs, loggedAdmin);
    case "admin_get_performance_reports":
      return adminGetPerformanceReports(toolArgs, loggedAdmin);
    case "admin_get_support_admins":
      return adminGetSupportAdmins(toolArgs, loggedAdmin);
    case "admin_get_company_rules":
      return adminGetCompanyRules(toolArgs, loggedAdmin);

    // Action Drafters
    case "admin_draft_approve_leave":
      return adminDraftApproveLeave(toolArgs, loggedAdmin);
    case "admin_draft_reject_leave":
      return adminDraftRejectLeave(toolArgs, loggedAdmin);
    case "admin_draft_approve_expense":
      return adminDraftApproveExpense(toolArgs, loggedAdmin);
    case "admin_draft_reject_expense":
      return adminDraftRejectExpense(toolArgs, loggedAdmin);
    case "admin_draft_approve_wfh":
      return adminDraftApproveWFH(toolArgs, loggedAdmin);
    case "admin_draft_approve_overtime":
      return adminDraftApproveOvertime(toolArgs, loggedAdmin);
    case "admin_draft_approve_late":
      return adminDraftApproveLate(toolArgs, loggedAdmin);
    case "admin_draft_approve_punch_out":
      return adminDraftApprovePunchOut(toolArgs, loggedAdmin);
    case "admin_draft_approve_attendance_request":
      return adminDraftApproveAttendanceRequest(toolArgs, loggedAdmin);
    case "admin_draft_reject_attendance_request":
      return adminDraftRejectAttendanceRequest(toolArgs, loggedAdmin);
    case "admin_draft_approve_resignation":
      return adminDraftApproveResignation(toolArgs, loggedAdmin);
    case "admin_draft_reject_resignation":
      return adminDraftRejectResignation(toolArgs, loggedAdmin);
    case "admin_draft_resolve_issue":
      return adminDraftResolveIssue(toolArgs, loggedAdmin);
    case "admin_draft_add_employee":
      return adminDraftAddEmployee(toolArgs, loggedAdmin);
    case "admin_draft_update_employee":
      return adminDraftUpdateEmployee(toolArgs, loggedAdmin);
    case "admin_draft_update_admin_profile":
      return adminDraftUpdateAdminProfile(toolArgs, loggedAdmin);
    case "admin_draft_toggle_mobile_access":
      return adminDraftToggleMobileAccess(toolArgs, loggedAdmin);
    case "admin_draft_assign_task":
      return adminDraftAssignTask(toolArgs, loggedAdmin);
    case "admin_draft_approve_work_report":
      return adminDraftApproveWorkReport(toolArgs, loggedAdmin);
    case "admin_draft_reject_work_report":
      return adminDraftRejectWorkReport(toolArgs, loggedAdmin);
    case "admin_draft_post_notice":
      return adminDraftPostNotice(toolArgs, loggedAdmin);
    case "admin_draft_update_shift":
      return adminDraftUpdateShift(toolArgs, loggedAdmin);
    case "admin_draft_add_holiday":
      return adminDraftAddHoliday(toolArgs, loggedAdmin);
    case "admin_draft_post_rule":
      return adminDraftPostRule(toolArgs, loggedAdmin);

    default:
      throw new Error(`Unknown admin copilot tool: ${toolName}`);
  }
};
