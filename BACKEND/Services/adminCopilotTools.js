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

  return {
    success: true,
    message: `📅 Attendance for **${targetDate}**: **${records.length}** employees clocked in.`,
    actionCard: {
      type: "admin_attendance_list_widget",
      title: `Live Attendance (${targetDate})`,
      data: {
        date: targetDate,
        totalPresent: records.length,
        records,
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

export const adminDraftPostNotice = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const { title = "Important Notice", description = "Notice description", meetingDate = null, meetingTime = null, recipients = "ALL" } = args;

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
    message: `Ready to broadcast notice: **${title}**. Click 'Confirm & Broadcast' below.`,
    actionCard: {
      type: "admin_confirm_post_notice",
      title: "Broadcast Company Notice",
      actionToken: token,
      data: {
        title,
        description,
        meetingDate,
        meetingTime,
        recipients,
      },
    },
  };
};

export const adminDraftUpdateShift = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const {
    shiftName = "General Shift",
    startTime = "09:30",
    endTime = "18:30",
    gracePeriod = 15,
    halfDayThreshold = 4,
    fullDayThreshold = 8,
  } = args;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_update_shift",
    adminId: adminId.toString(),
    shiftName,
    startTime,
    endTime,
    gracePeriod: Number(gracePeriod) || 15,
    halfDayThreshold: Number(halfDayThreshold) || 4,
    fullDayThreshold: Number(fullDayThreshold) || 8,
  });

  return {
    success: true,
    message: `Ready to update shift timing to **${startTime} - ${endTime}** (Grace: **${gracePeriod}m**).`,
    actionCard: {
      type: "admin_confirm_update_shift",
      title: "Update Shift Timings & Rules",
      actionToken: token,
      data: {
        shiftName,
        startTime,
        endTime,
        gracePeriod: Number(gracePeriod) || 15,
        halfDayThreshold: Number(halfDayThreshold) || 4,
        fullDayThreshold: Number(fullDayThreshold) || 8,
      },
    },
  };
};

export const adminDraftAddHoliday = async (args, loggedAdmin) => {
  const adminId = loggedAdmin._id;
  const { name = "Official Holiday", date = new Date().toISOString().slice(0, 10), type = "General" } = args;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_add_holiday",
    adminId: adminId.toString(),
    name,
    date,
    type,
  });

  return {
    success: true,
    message: `Ready to add holiday **${name}** on **${date}** to the company calendar.`,
    actionCard: {
      type: "admin_confirm_add_holiday",
      title: "Add Calendar Holiday",
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
  const { title = "Company Rule", content = "Rule details", category = "General" } = args;

  const token = generateAdminActionToken({
    actionType: "admin_confirm_post_rule",
    adminId: adminId.toString(),
    title,
    content,
    category,
  });

  return {
    success: true,
    message: `Ready to publish company rule: **${title}**.`,
    actionCard: {
      type: "admin_confirm_post_rule",
      title: "Publish Company Rule",
      actionToken: token,
      data: {
        title,
        content,
        category,
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
    case "admin_get_all_employees":
      return adminGetAllEmployees(toolArgs, loggedAdmin);
    case "admin_get_employee_profile":
      return adminGetEmployeeProfile(toolArgs, loggedAdmin);
    case "admin_get_shifts":
      return adminGetShifts(toolArgs, loggedAdmin);
    case "admin_get_holidays":
      return adminGetHolidays(toolArgs, loggedAdmin);
    case "admin_get_payroll_summary":
      return adminGetPayrollSummary(toolArgs, loggedAdmin);

    // Action Drafters
    case "admin_draft_approve_leave":
      return adminDraftApproveLeave(toolArgs, loggedAdmin);
    case "admin_draft_reject_leave":
      return adminDraftRejectLeave(toolArgs, loggedAdmin);
    case "admin_draft_approve_expense":
      return adminDraftApproveExpense(toolArgs, loggedAdmin);
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
    case "admin_draft_add_employee":
      return adminDraftAddEmployee(toolArgs, loggedAdmin);
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
