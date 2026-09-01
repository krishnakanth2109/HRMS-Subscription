import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import LeaveRequest, { LeavePolicy } from "../models/LeaveRequest.js";
import Holiday from "../models/Holiday.js";
import Attendance from "../models/Attendance.js";
import Shift from "../models/shiftModel.js";
import Employee from "../models/employeeModel.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Expense from "../models/Expense.js";
import Overtime from "../models/Overtime.js";
import PunchOutRequest from "../models/PunchOutRequest.js";
import TechnicalIssue from "../models/TechnicalIssue.js";
import Resignation from "../models/Resignation.js";
import PayrollRecord from "../models/PayrollRecord.js";
import Notice from "../models/Notice.js";
import DailyWorkEntry from "../models/DailyWorkEntry.js";
import Rule from "../models/Rule.js";
import Admin from "../models/adminModel.js";
import Company from "../models/CompanyModel.js";
import FieldWorkTrip from "../models/FieldWorkTrip.js";
import Message from "../models/Message.js";

/* ============================================================================
   TOOL DECLARATIONS FOR GEMINI FUNCTION CALLING & COPILOT NLU
============================================================================ */
export const copilotToolDeclarations = [
  {
    name: "get_my_profile",
    description: "Get profile information of the currently authenticated employee (name, email, department, designation, employee ID, join date).",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_leave_balance",
    description: "Get leave balance summary, used paid days, approved leaves, and pending leave requests for the logged-in employee.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_attendance",
    description: "Get attendance log summary for the current month (present days, absent days, late marks, total hours worked).",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_upcoming_holidays",
    description: "Get the list of upcoming company holidays for the current year.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_shifts",
    description: "Get the current shift schedule, work hours, and break details for the logged-in employee.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_expenses",
    description: "Get the list of submitted reimbursement and expense claims, amounts, and approval statuses.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_overtime",
    description: "Get overtime history, approved OT hours, and pending OT claims for the employee.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_payslip",
    description: "Get latest payslip and salary details, gross earned, net payable, and deductions.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_notices",
    description: "Get company broadcast notices, important announcements, and scheduled meetings.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_issues",
    description: "Get the list of support tickets or technical issues raised by the employee and their resolution status.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_resignation",
    description: "Get current resignation request status, notice period end date, and exit formalities progress.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "draft_leave_request",
    description: "Draft a leave application (Apply Leave) proactively. Resolves relative dates (today, tomorrow), leave types, and reasons.",
    parameters: {
      type: "OBJECT",
      properties: {
        from: { type: "STRING", description: "Start date in YYYY-MM-DD format" },
        to: { type: "STRING", description: "End date in YYYY-MM-DD format" },
        leaveType: { type: "STRING", description: "'Casual Leave', 'Sick Leave', 'Paid Leave'" },
        leaveDayType: { type: "STRING", description: "'Full Day' or 'Half Day'" },
        reason: { type: "STRING", description: "Reason for leave" },
      },
      required: ["from"],
    },
  },
  {
    name: "draft_cancel_leave",
    description: "Draft a cancellation request for an existing pending or approved leave application. Returns confirmation card or selectable options.",
    parameters: {
      type: "OBJECT",
      properties: {
        leaveRequestId: { type: "STRING", description: "MongoDB _id of the leave request to cancel" },
        from: { type: "STRING", description: "Start date of the leave to cancel (YYYY-MM-DD)" },
        reason: { type: "STRING", description: "Reason for cancellation" },
      },
    },
  },
  {
    name: "draft_wfh_request",
    description: "Draft a Work From Home (WFH) or Remote Work Request for user confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        fromDate: { type: "STRING", description: "Start date in YYYY-MM-DD format" },
        toDate: { type: "STRING", description: "End date in YYYY-MM-DD format" },
        reason: { type: "STRING", description: "Reason for requesting WFH" },
        requestedMode: { type: "STRING", description: "'WFH' or 'WFO'" },
      },
      required: ["fromDate"],
    },
  },
  {
    name: "draft_expense_request",
    description: "Draft a new reimbursement/expense claim for employee confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        amount: { type: "NUMBER", description: "Expense claim amount in INR" },
        category: { type: "STRING", description: "Category (e.g. Travel, Food, Internet, Equipment, General)" },
        description: { type: "STRING", description: "Short description of the expense" },
        date: { type: "STRING", description: "Date of expense (YYYY-MM-DD)" },
      },
      required: ["amount"],
    },
  },
  {
    name: "draft_overtime_request",
    description: "Draft an Overtime (OT) claim for employee confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        hours: { type: "NUMBER", description: "Number of overtime hours (e.g. 2, 3.5)" },
        date: { type: "STRING", description: "Date of overtime (YYYY-MM-DD)" },
        reason: { type: "STRING", description: "Reason or task worked on during OT" },
        fromTime: { type: "STRING", description: "Start time (e.g. 18:00)" },
        toTime: { type: "STRING", description: "End time (e.g. 20:00)" },
      },
      required: ["hours"],
    },
  },
  {
    name: "draft_punch_out_request",
    description: "Draft a missing/forgotten punch-out request for employee confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        originalDate: { type: "STRING", description: "Date of missing punch out (YYYY-MM-DD)" },
        time: { type: "STRING", description: "Punch out time (e.g. 18:30)" },
        reason: { type: "STRING", description: "Reason for missing punch out" },
      },
    },
  },
  {
    name: "draft_issue_request",
    description: "Draft a technical issue / support ticket for employee confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING", description: "Short title/subject of the issue" },
        message: { type: "STRING", description: "Detailed description of the issue" },
      },
      required: ["subject"],
    },
  },
  {
    name: "draft_resignation_request",
    description: "Draft a formal resignation submission for employee confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Reason for resignation" },
      },
      required: ["reason"],
    },
  },
  {
    name: "draft_punch_in",
    description: "Draft a Punch In attendance action for user confirmation. Returns confirmation card.",
    parameters: {
      type: "OBJECT",
      properties: {
        note: { type: "STRING", description: "Optional note for punch in" },
      },
    },
  },
  {
    name: "draft_punch_out",
    description: "Draft a Punch Out attendance action for user confirmation. Returns confirmation card.",
    parameters: {
      type: "OBJECT",
      properties: {
        note: { type: "STRING", description: "Optional note for punch out" },
      },
    },
  },
  {
    name: "draft_work_update",
    description: "Draft a Daily Work Update / Task Report for user confirmation and submission to admin.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Task title or summary of work done today" },
        description: { type: "STRING", description: "Detailed description of tasks completed" },
        percentage: { type: "NUMBER", description: "Work completion percentage (0-100)" },
        date: { type: "STRING", description: "Date of work entry (YYYY-MM-DD)" },
      },
    },
  },
  {
    name: "get_my_daily_work",
    description: "Get today's work entry status and list of recent work logs for the logged-in employee.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_my_leaves",
    description: "Get the list of recently applied leave requests, durations, and approval statuses.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_leave_policy",
    description: "Get official leave policy rules, allowed leave types, paid limits, carry forward, and sandwich rules.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_today_attendance",
    description: "Get today's attendance status: punch-in time, punch-out time, working hours, and late mark status.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_punch_corrections",
    description: "Get missing punch-out correction requests and their approval statuses.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_wfh_requests",
    description: "Get Work From Home / Remote work requests and their approval statuses.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_payslip_history",
    description: "Get historical payslips and salary breakdown across past months.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_company_rules",
    description: "Get official company rules, office timings, code of conduct, and disciplinary guidelines.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_my_team",
    description: "Get list of team members, colleagues, department co-workers, and contact information.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "draft_punch_break",
    description: "Toggle or start/end lunch break or tea break during working hours.",
    parameters: {
      type: "OBJECT",
      properties: {
        breakType: { type: "STRING", description: "'Lunch Break' or 'Tea Break'" },
      },
    },
  },
  {
    name: "draft_late_correction",
    description: "Draft a late arrival justification/correction request for today or a specific date.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "Date of late arrival (YYYY-MM-DD)" },
        reason: { type: "STRING", description: "Reason for late arrival" },
      },
      required: ["reason"],
    },
  },
  {
    name: "draft_update_wfh",
    description: "Draft an update/modification to an existing pending Work From Home request.",
    parameters: {
      type: "OBJECT",
      properties: {
        requestId: { type: "STRING", description: "WFH request ID to update" },
        fromDate: { type: "STRING", description: "Updated start date (YYYY-MM-DD)" },
        toDate: { type: "STRING", description: "Updated end date (YYYY-MM-DD)" },
        reason: { type: "STRING", description: "Updated reason for WFH" },
      },
    },
  },
  {
    name: "draft_notice_reply",
    description: "Draft a reply or comment to a company notice or announcement.",
    parameters: {
      type: "OBJECT",
      properties: {
        noticeId: { type: "STRING", description: "MongoDB ID of the notice" },
        message: { type: "STRING", description: "Reply message content" },
      },
      required: ["message"],
    },
  },
  {
    name: "draft_update_profile",
    description: "Update personal profile information such as gender, phone number, address, marital status, or emergency contact.",
    parameters: {
      type: "OBJECT",
      properties: {
        field: { type: "STRING", description: "Field to update: 'gender', 'phone', 'address', 'maritalStatus', 'emergencyContact', 'dob'" },
        value: { type: "STRING", description: "New value for the field" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "draft_cancel_wfh",
    description: "Cancel an active or pending Work From Home (WFH) / remote request.",
    parameters: {
      type: "OBJECT",
      properties: {
        requestId: { type: "STRING", description: "WFH request ID to cancel (optional if only 1 pending)" },
      },
    },
  },
  {
    name: "draft_cancel_expense",
    description: "Cancel a pending expense reimbursement claim.",
    parameters: {
      type: "OBJECT",
      properties: {
        expenseId: { type: "STRING", description: "Expense claim ID to cancel (optional if only 1 pending)" },
      },
    },
  },
  {
    name: "get_office_settings",
    description: "Get official office settings, workplace location, office timings, and remote work policy limits.",
    parameters: { type: "OBJECT", properties: {} },
  },
];

/* ============================================================================
   TRADITIONAL BACKEND HELPER: CHECK LEAVE BALANCE
============================================================================ */
export async function checkEmployeeLeaveBalance(adminId, employeeId, leaveType) {
  const policyDoc = await LeavePolicy.findOne({ adminId }).lean();
  let paidDaysLimit = 0;

  if (policyDoc?.policies && policyDoc.policies.length > 0) {
    const policy = policyDoc.policies.find(
      (p) => p.leaveType && p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
    );
    if (policy && typeof policy.paidDaysLimit === "number") {
      paidDaysLimit = policy.paidDaysLimit;
    } else if (policyDoc.policies[0]?.paidDaysLimit) {
      paidDaysLimit = policyDoc.policies[0].paidDaysLimit;
    }
  } else {
    // If no custom policy doc exists in DB, check standard policy defaults
    paidDaysLimit = 12;
  }

  const leaves = await LeaveRequest.find({
    employeeId: String(employeeId),
    status: "Approved",
  }).lean();

  let usedDays = 0;
  const targetType = (leaveType || "").trim().toLowerCase();

  for (const l of leaves) {
    if (l.leaveType && l.leaveType.trim().toLowerCase() === targetType) {
      usedDays += l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1);
    }
  }

  const remaining = Math.max(0, paidDaysLimit - usedDays);
  return { paidDaysLimit, usedDays, remaining };
}

/* ============================================================================
   TOOL EXECUTION LOGIC (Deterministic JavaScript)
============================================================================ */
export const executeCopilotTool = async (toolName, toolArgs, user) => {
  if (!user || (!user._id && !user.id)) {
    throw new Error("User authentication required to execute copilot tools.");
  }

  const userId = user._id || user.id;
  const empIdStr = (user.employeeId || userId).toString();

  switch (toolName) {
    case "get_my_profile": {
      const emp = await Employee.findById(userId).select("-password").lean();
      if (!emp) return { error: "Employee profile record not found." };
      const gender = emp.personal?.gender || "Not set";
      const name = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      return {
        name,
        employeeId: emp.employeeId || emp._id,
        email: emp.email,
        department: emp.department || "General",
        designation: emp.designation || emp.role || "Employee",
        dateOfJoining: emp.joiningDate || emp.createdAt,
        phone: emp.phone || emp.mobile || "N/A",
        gender,
        message: `👤 **Your Profile Information**:\n\n• **Name**: ${name}\n• **Employee ID**: ${emp.employeeId || emp._id}\n• **Department**: ${emp.department || "General"}\n• **Designation**: ${emp.designation || emp.role || "Employee"}\n• **Email**: ${emp.email}\n• **Phone**: ${emp.phone || emp.mobile || "N/A"}\n• **Gender**: ${gender}`,
      };
    }

    case "get_leave_balance": {
      const empIdStr = (user.employeeId || userId).toString();
      const adminIdObj = user.adminId || user._id;

      const [leaves, policyDoc] = await Promise.all([
        LeaveRequest.find({
          $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
        }).sort({ createdAt: -1 }).lean(),
        LeavePolicy.findOne({ adminId: adminIdObj }).lean(),
      ]);

      const approved = leaves.filter((l) => l.status === "Approved");
      const pending = leaves.filter((l) => l.status === "Pending");
      const rejected = leaves.filter((l) => l.status === "Rejected");

      let totalDaysTaken = 0;
      approved.forEach((l) => {
        totalDaysTaken += l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1);
      });

      const dynamicEntitlements = {};
      if (policyDoc?.policies && policyDoc.policies.length > 0) {
        policyDoc.policies.forEach((p) => {
          dynamicEntitlements[p.leaveType] = p.paidDaysLimit || 0;
        });
      } else {
        dynamicEntitlements["Casual Leave"] = 12;
        dynamicEntitlements["Sick Leave"] = 10;
        dynamicEntitlements["Paid Leave"] = 15;
      }

      const balances = Object.keys(dynamicEntitlements).map((type) => {
        const limit = dynamicEntitlements[type];
        let used = 0;
        approved.forEach((l) => {
          if (l.leaveType && l.leaveType.trim().toLowerCase() === type.trim().toLowerCase()) {
            used += l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1);
          }
        });
        const remaining = Math.max(0, limit - used);
        return {
          leaveType: type,
          totalLimit: limit,
          usedDays: used,
          remaining,
        };
      });

      const breakdownText = balances
        .map((b) => `• **${b.leaveType}**: **${b.remaining}** days remaining (${b.usedDays}/${b.totalLimit} used)`)
        .join("\n");

      const message = `📊 **Your Real-Time Leave Balances**:\n\n${breakdownText}\n\n• **Approved Requests**: ${approved.length} (${totalDaysTaken} total days taken)\n• **Pending Requests**: ${pending.length}\n\nWould you like to apply for leave?`;

      return {
        message,
        totalApprovedLeaves: approved.length,
        totalPendingLeaves: pending.length,
        totalRejectedLeaves: rejected.length,
        totalApprovedDaysTaken: totalDaysTaken,
        balances,
        standardEntitlements: dynamicEntitlements,
        recentRequests: leaves.slice(0, 5).map((l) => ({
          id: l._id,
          from: l.from,
          to: l.to,
          leaveType: l.leaveType,
          status: l.status,
          reason: l.reason,
        })),
      };
    }

    case "get_my_attendance": {
      const now = new Date();
      const currentMonthPrefix = now.toISOString().slice(0, 7);
      const empIdStr = (user.employeeId || userId).toString();

      const attDoc = await Attendance.findOne({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).lean();

      const logs = (attDoc?.attendance || []).filter((a) => a.date && a.date.startsWith(currentMonthPrefix));

      const presentCount = logs.filter((a) => a.status === "PRESENT" || a.status === "WORKING" || a.status === "COMPLETED" || a.status === "Present").length;
      const lateCount = logs.filter((a) => a.loginStatus === "LATE" || a.isLate).length;
      const absentCount = logs.filter((a) => a.status === "ABSENT" || a.status === "Absent").length;

      const message = `📅 **Attendance Summary (${currentMonthPrefix})**:\n\n• **Present Days**: ${presentCount}\n• **Late Marks**: ${lateCount}\n• **Absent Days**: ${absentCount}\n• **Total Logged Records**: ${logs.length}`;

      return {
        month: currentMonthPrefix,
        totalRecordsThisMonth: logs.length,
        presentDays: presentCount,
        lateMarks: lateCount,
        absentDays: absentCount,
        message,
        recentPunches: logs.slice(-5).map((a) => ({
          date: a.date,
          status: a.status,
          punchIn: a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A",
          punchOut: a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A",
        })),
      };
    }

    case "get_upcoming_holidays": {
      const todayStr = new Date().toISOString().slice(0, 10);
      const companyId = user.company || user.companyId || user.adminId;

      const holidays = await Holiday.find({
        $or: [{ companyId }, { adminId: user.adminId }, {}],
      })
        .sort({ date: 1 })
        .lean();

      const upcoming = holidays.filter((h) => h.date >= todayStr).slice(0, 5);

      const message = `🎉 **Upcoming Company Holidays**:\n\n${upcoming.map((h) => `• **${h.name}**: ${h.date} (${h.day}) - *${h.type}*`).join("\n")}`;

      return {
        totalUpcomingHolidays: upcoming.length,
        holidays: upcoming.map((h) => ({
          name: h.name || h.title || h.holidayName,
          date: h.date,
          day: h.day || new Date(h.date).toLocaleDateString("en-US", { weekday: "long" }),
          type: h.type || "Official Holiday",
        })),
        message: upcoming.length > 0 ? message : "No upcoming company holidays found for this period.",
      };
    }

    case "get_my_expenses": {
      const queryOr = [{ employeeId: userId }];
      if (mongoose.Types.ObjectId.isValid(user.employeeId)) {
        queryOr.push({ employeeId: user.employeeId });
      }
      const expenses = await Expense.find({
        $or: queryOr,
      }).sort({ createdAt: -1 }).limit(10).lean();

      const totalClaimed = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const approved = expenses.filter((e) => e.status === "Approved");
      const pending = expenses.filter((e) => e.status === "Pending");
      const approvedAmount = approved.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const pendingAmount = pending.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

      const message = expenses.length === 0
        ? "You have not submitted any expense reimbursement claims yet. Would you like to submit a new claim?"
        : `💰 **Expense Claims Summary**:\n\n• **Total Claimed**: ₹${totalClaimed.toLocaleString()} (${expenses.length} claims)\n• **Approved**: ₹${approvedAmount.toLocaleString()} (${approved.length} claims)\n• **Pending Review**: ₹${pendingAmount.toLocaleString()} (${pending.length} claims)\n\n**Recent Claims**:\n${expenses.slice(0, 3).map((e) => `• **${e.category}** (₹${Number(e.amount || 0).toLocaleString()} on ${e.date}): Status **${e.status}**`).join("\n")}`;

      return {
        totalClaims: expenses.length,
        totalClaimedAmount: totalClaimed,
        approvedAmount,
        pendingAmount,
        expenses: expenses.slice(0, 5).map((e) => ({
          id: e._id,
          amount: e.amount,
          category: e.category,
          date: e.date,
          status: e.status,
          description: e.description,
        })),
        message,
      };
    }

    case "draft_expense_request": {
      const amount = toolArgs.amount ? Number(toolArgs.amount) : 0;
      const category = toolArgs.category || "General";
      const description = toolArgs.description || `${category} expense claim`;
      const date = toolArgs.date || new Date().toISOString().slice(0, 10);

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_expense_request",
          amount,
          category,
          description,
          date,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_expense_request",
          title: "Expense Reimbursement Confirmation",
          actionToken,
          data: {
            amount,
            category,
            description,
            date,
            employeeName: user.name || "Employee",
          },
        },
        message: `I have prepared your **${category} Reimbursement Claim** for **₹${amount?.toLocaleString() || "0"}** on ${date}.\n\nPlease review, edit if needed, and click **Confirm & Submit Claim** below.`,
      };
    }

    case "get_my_overtime": {
      const empIdStr = (user.employeeId || userId).toString();
      const records = await Overtime.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).sort({ createdAt: -1 }).limit(10).lean();

      const totalHours = records.reduce((acc, curr) => acc + Number(curr.hours || 0), 0);
      const approved = records.filter((r) => r.status === "Approved");
      const pending = records.filter((r) => r.status === "Pending");
      const approvedHours = approved.reduce((acc, curr) => acc + Number(curr.hours || 0), 0);
      const pendingHours = pending.reduce((acc, curr) => acc + Number(curr.hours || 0), 0);

      const message = records.length === 0
        ? "You have no overtime claims recorded. Would you like to apply for overtime hours?"
        : `⏱️ **Overtime (OT) Summary**:\n\n• **Total Claimed**: ${totalHours} hours (${records.length} logs)\n• **Approved**: ${approvedHours} hours\n• **Pending**: ${pendingHours} hours\n\n**Recent Overtime Logs**:\n${records.slice(0, 3).map((r) => `• **${r.hours} hrs** on ${r.date}: Status **${r.status}** (${r.reason})`).join("\n")}`;

      return {
        totalRecords: records.length,
        totalHours,
        approvedHours,
        pendingHours,
        records: records.slice(0, 5).map((r) => ({
          id: r._id,
          hours: r.hours,
          date: r.date,
          status: r.status,
          reason: r.reason,
        })),
        message,
      };
    }

    case "draft_overtime_request": {
      const hours = toolArgs.hours ? Number(toolArgs.hours) : 0;
      const date = toolArgs.date || new Date().toISOString().slice(0, 10);
      const reason = toolArgs.reason || "Overtime worked";
      const fromTime = toolArgs.fromTime || "18:00";
      const toTime = toolArgs.toTime || "20:00";

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_overtime_request",
          hours,
          date,
          reason,
          fromTime,
          toTime,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_overtime_request",
          title: "Overtime (OT) Claim Confirmation",
          actionToken,
          data: {
            hours,
            date,
            reason,
            fromTime,
            toTime,
            employeeName: user.name || "Employee",
          },
        },
        message: `I have prepared your Overtime Claim for **${hours} hours** on ${date} (${fromTime} - ${toTime}).\n\nPlease review and click **Confirm & Submit OT** below.`,
      };
    }

    case "get_my_shifts": {
      const emp = await Employee.findById(userId).lean();
      let shiftDetails = null;

      if (emp?.shiftId) {
        shiftDetails = await Shift.findById(emp.shiftId).lean();
      }

      if (!shiftDetails) {
        const adminId = user.adminId || user._id;
        shiftDetails = await Shift.findOne({
          $or: [{ adminId }, { companyId: user.company }],
        }).lean();
      }

      const shiftName = shiftDetails?.name || shiftDetails?.shiftName || "Standard General Shift";
      const startTime = shiftDetails?.startTime || "09:00 AM";
      const endTime = shiftDetails?.endTime || "06:00 PM";
      const gracePeriodMinutes = shiftDetails?.gracePeriod || 15;
      const workDays = shiftDetails?.workDays || "Monday - Friday";

      return {
        shiftName,
        startTime,
        endTime,
        gracePeriodMinutes,
        workDays,
        message: `Your shift schedule is **${shiftName}** (${startTime} - ${endTime}). Grace period: **${gracePeriodMinutes} mins**. Working days: **${workDays}**.`,
      };
    }

    // ⚡ PROACTIVE LEAVE APPLICATION DRAFTING WITH AUTOMATIC BALANCE CHECK
    case "draft_leave_request": {
      const from = toolArgs.from;
      const to = toolArgs.to || from;
      const leaveType = toolArgs.leaveType || "Casual Leave";
      const leaveDayType = toolArgs.leaveDayType || "Full Day";
      const reason = toolArgs.reason || "Casual leave application";

      if (!from) {
        return {
          error: "Please specify the leave date.",
        };
      }

      const d1 = new Date(from);
      const d2 = new Date(to);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;
      const totalDays = leaveDayType === "Half Day" ? 0.5 : Math.max(1, diffDays);

      // Traditional Backend Balance Check
      const adminIdObj = user.adminId || user._id;
      const empIdStr = (user.employeeId || userId).toString();
      const { remaining } = await checkEmployeeLeaveBalance(adminIdObj, empIdStr, leaveType);

      if (remaining <= 0) {
        return {
          message: `⚠️ You currently have 0 days remaining in your **${leaveType}** balance. Would you like to apply for Unpaid Leave or select a different leave type?`,
          insufficientBalance: true,
          remainingBalance: 0,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_leave_application",
          from,
          to,
          leaveType,
          leaveDayType,
          reason,
          totalDays,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_leave_application",
          title: "Leave Application Confirmation",
          actionToken,
          data: {
            from,
            to,
            leaveType,
            leaveDayType,
            reason,
            totalDays,
            remainingBalance: remaining,
            applicantName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
          },
        },
        message: `I have prepared your **${leaveType}** request for ${from} to ${to} (${totalDays} day(s)). You have **${remaining} day(s)** remaining. Please review and click 'Confirm & Submit' below.`,
      };
    }

    case "draft_cancel_leave": {
      const { leaveRequestId, from, reason = "Requested by employee via AI Copilot" } = toolArgs;
      const empIdStr = (user.employeeId || userId).toString();

      let targetLeave = null;

      if (leaveRequestId) {
        targetLeave = await LeaveRequest.findById(leaveRequestId).lean();
      } else if (from) {
        targetLeave = await LeaveRequest.findOne({
          $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
          from,
          status: { $in: ["Pending", "Approved"] },
        }).lean();
      } else {
        const activeLeaves = await LeaveRequest.find({
          $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
          status: { $in: ["Pending", "Approved"] },
        }).sort({ createdAt: -1 }).lean();

        if (!activeLeaves || activeLeaves.length === 0) {
          return {
            message: "You currently have no active or pending leave requests to cancel.",
          };
        }

        if (activeLeaves.length > 1) {
          const leaveOptions = activeLeaves.map((l) => {
            const token = jwt.sign(
              {
                sub: userId.toString(),
                actionType: "confirm_cancel_leave",
                leaveRequestId: l._id.toString(),
                from: l.from,
                to: l.to,
                leaveType: l.leaveType,
                reason: l.reason || "Cancelled by employee via AI Copilot",
              },
              process.env.JWT_SECRET,
              { expiresIn: "30m" }
            );

            return {
              id: l._id.toString(),
              leaveType: l.leaveType,
              from: l.from,
              to: l.to,
              totalDays: l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1),
              leaveDayType: l.leaveDayType || "Full Day",
              reason: l.reason || "Leave request",
              status: l.status,
              actionToken: token,
            };
          });

          return {
            actionCard: {
              type: "select_leave_to_cancel",
              title: "Select Leave to Cancel",
              options: leaveOptions,
            },
            message: `You have **${activeLeaves.length} active leave requests**. Please select the leave you would like to cancel:`,
          };
        }

        targetLeave = activeLeaves[0];
      }

      if (!targetLeave) {
        return { error: "No matching active leave request found to cancel." };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_cancel_leave",
          leaveRequestId: targetLeave._id.toString(),
          from: targetLeave.from,
          to: targetLeave.to,
          leaveType: targetLeave.leaveType,
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_cancel_leave",
          title: "Cancel Leave Confirmation",
          actionToken,
          data: {
            leaveRequestId: targetLeave._id,
            from: targetLeave.from,
            to: targetLeave.to,
            leaveType: targetLeave.leaveType,
            reason,
          },
        },
        message: `Are you sure you want to cancel your ${targetLeave.leaveType} from ${targetLeave.from} to ${targetLeave.to}? Please click 'Confirm & Cancel Leave' below.`,
      };
    }

    case "draft_wfh_request": {
      const fromDate = toolArgs.fromDate;
      const toDate = toolArgs.toDate || fromDate;
      const requestedMode = toolArgs.requestedMode || "WFH";
      const reason = toolArgs.reason || "Work from home request";

      if (!fromDate) {
        return {
          error: "Please specify the WFH date.",
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_wfh_request",
          fromDate,
          toDate,
          requestedMode,
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_wfh_request",
          title: "Work From Home (WFH) Request Confirmation",
          actionToken,
          data: {
            fromDate,
            toDate,
            requestedMode,
            reason,
            applicantName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
          },
        },
        message: `I have prepared your ${requestedMode} request for ${fromDate} to ${toDate}. Please review and click 'Confirm & Apply WFH' to submit.`,
      };
    }

    case "draft_punch_in": {
      const { note = "Punched in via AI Copilot" } = toolArgs;
      const todayStr = new Date().toISOString().slice(0, 10);
      const empIdStr = (user.employeeId || userId).toString();

      const attDoc = await Attendance.findOne({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).lean();

      const todayLog = attDoc?.attendance?.find((a) => a.date === todayStr);

      if (todayLog && (todayLog.status === "WORKING" || todayLog.punchIn) && !todayLog.punchOut) {
        return {
          message: `You are already punched in for today (${todayStr}) at ${new Date(todayLog.punchIn).toLocaleTimeString()}.`,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_punch_in",
          date: todayStr,
          note,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_punch_in",
          title: "Punch In Confirmation",
          actionToken,
          data: {
            date: todayStr,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            note,
          },
        },
        message: `Ready to Punch In for today (${todayStr})? Please click 'Confirm & Punch In' below.`,
      };
    }

    case "draft_punch_out": {
      const { note = "Punched out via AI Copilot" } = toolArgs;
      const todayStr = new Date().toISOString().slice(0, 10);
      const empIdStr = (user.employeeId || userId).toString();

      const attDoc = await Attendance.findOne({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).lean();

      const todayLog = attDoc?.attendance?.find((a) => a.date === todayStr);

      if (!todayLog || (!todayLog.punchIn && todayLog.status !== "WORKING")) {
        return {
          message: `You haven't punched in for today (${todayStr}) yet. Please punch in first.`,
        };
      }

      if (todayLog.status !== "WORKING" && todayLog.punchOut && todayLog.isFinalPunchOut) {
        return {
          message: `You have already completed your punch out for today (${todayStr}) at ${new Date(todayLog.punchOut).toLocaleTimeString()}.`,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_punch_out",
          date: todayStr,
          note,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_punch_out",
          title: "Punch Out Confirmation",
          actionToken,
          data: {
            date: todayStr,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            note,
          },
        },
        message: `Ready to Punch Out for today (${todayStr})? Please click 'Confirm & Punch Out' below.`,
      };
    }

    case "draft_punch_break": {
      const { breakType = "Lunch Break" } = toolArgs;
      const todayStr = new Date().toISOString().slice(0, 10);
      const empIdStr = (user.employeeId || userId).toString();

      const attDoc = await Attendance.findOne({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).lean();

      const todayLog = attDoc?.attendance?.find((a) => a.date === todayStr);

      if (!todayLog || !todayLog.punchIn) {
        return {
          message: `You must punch in first before taking or resuming a break.`,
        };
      }

      const isOnBreak = !!todayLog.isOnBreak;
      const actionTitle = isOnBreak ? "Resume Work from Break Confirmation" : "Break Time Confirmation";
      const actionMessage = isOnBreak
        ? `Ready to resume work from break? Click 'Confirm & Resume Work' below.`
        : `Ready to record **${breakType}**? Click 'Confirm & Start Break' below (or click to resume if currently on break).`;

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_punch_break",
          breakType,
          isOnBreak,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_punch_break",
          title: actionTitle,
          actionToken,
          data: {
            breakType: isOnBreak ? "Resume Work" : breakType,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            employeeName: user.name || "Employee",
            isOnBreak,
          },
        },
        message: actionMessage,
      };
    }

    // ⚡ ON-TIME LOGIN / LATE ARRIVAL JUSTIFICATION REQUEST
    case "draft_request_ontime_login":
    case "draft_late_correction": {
      const { date, reason = "On-time login requested via AI Copilot", requestedPunchIn = "09:30" } = toolArgs;
      const dateStr = date || new Date().toISOString().slice(0, 10);

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          actionType: "confirm_request_ontime_login",
          date: dateStr,
          reason,
          requestedPunchIn,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_request_ontime_login",
          title: "Request On-Time Login Confirmation",
          actionToken,
          data: {
            date: dateStr,
            requestedPunchIn,
            reason,
            applicantName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
          },
        },
        message: `I have prepared your **On-Time Login Request** for **${dateStr}** (${requestedPunchIn}). Please click 'Confirm & Submit Request' below.`,
      };
    }

    // ⚡ MISSING PUNCH-OUT CORRECTION
    case "draft_punch_out_request": {
      const { originalDate, time = "18:30", reason = "Forgot to punch out" } = toolArgs;
      const dateStr = originalDate || new Date().toISOString().slice(0, 10);
      const requestedPunchOut = new Date(`${dateStr}T${time}:00`);

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_punch_out_request",
          originalDate: dateStr,
          requestedPunchOut: requestedPunchOut.toISOString(),
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_punch_out_request",
          title: "Missing Punch-Out Request Confirmation",
          actionToken,
          data: {
            originalDate: dateStr,
            time,
            reason,
          },
        },
        message: `I have prepared a Missing Punch-Out Request for **${dateStr} at ${time}**. Please click 'Confirm & Submit Request' below.`,
      };
    }

    // ⚡ PAYSLIP & SALARY TOOL
    case "get_my_payslip": {
      const empIdStr = (user.employeeId || userId).toString();
      const records = await PayrollRecord.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).sort({ "payPeriod.monthIdentifier": -1 }).limit(3).lean();

      if (!records || records.length === 0) {
        return {
          message: "No published payslip records found for your account yet.",
        };
      }

      const latest = records[0];
      return {
        month: latest.payPeriod?.monthIdentifier,
        netPayableSalary: latest.salaryDetails?.netPayableSalary,
        grossEarned: latest.salaryDetails?.grossEarned,
        totalDeductions: latest.salaryDetails?.totalDeductions,
        workedDays: latest.attendanceSummary?.workedDays,
        recentMonths: records.map((r) => ({
          month: r.payPeriod?.monthIdentifier,
          net: r.salaryDetails?.netPayableSalary,
        })),
        message: `Your latest payslip (**${latest.payPeriod?.monthIdentifier}**) is available. Net Salary: **₹${latest.salaryDetails?.netPayableSalary?.toLocaleString()}** (Gross: ₹${latest.salaryDetails?.grossEarned?.toLocaleString()}, Deductions: ₹${latest.salaryDetails?.totalDeductions?.toLocaleString()}).`,
      };
    }

    // ⚡ NOTICES & MEETINGS
    case "get_my_notices": {
      const companyId = user.company || user.companyId || user.adminId;
      const notices = await Notice.find({
        $or: [{ companyId }, { adminId: user.adminId }, {}],
      }).sort({ createdAt: -1 }).limit(5).lean();

      const meetings = notices.filter((n) => n.meetingDate);

      return {
        totalNotices: notices.length,
        upcomingMeetingsCount: meetings.length,
        notices: notices.map((n) => ({
          title: n.title,
          description: n.description,
          date: n.date ? new Date(n.date).toISOString().slice(0, 10) : "N/A",
          meetingDate: n.meetingDate,
          meetingTime: n.meetingTime,
        })),
        message: notices.length === 0
          ? "No new company notices or meetings at this time."
          : `Found **${notices.length} recent notices** (including ${meetings.length} scheduled meetings).`,
      };
    }

    // ⚡ ISSUES & GRIEVANCES
    case "get_my_issues": {
      const issues = await TechnicalIssue.find({ raisedBy: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return {
        totalIssues: issues.length,
        issues: issues.map((iss) => ({
          id: iss._id,
          subject: iss.subject,
          status: iss.status,
          createdAt: iss.createdAt ? new Date(iss.createdAt).toISOString().slice(0, 10) : "N/A",
          resolvedMessage: iss.resolvedMessage,
        })),
        message: issues.length === 0
          ? "You haven't raised any support issues or tickets."
          : `You have **${issues.length} support tickets** (${issues.filter((i) => i.status === "pending").length} pending).`,
      };
    }

    case "draft_issue_request": {
      const { subject, message = "Support ticket submitted via AI Copilot" } = toolArgs;
      if (!subject) {
        return { message: "Please describe the issue or support request (e.g. 'AC not working on 3rd floor')." };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_issue_request",
          subject,
          message,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_issue_request",
          title: "Support Ticket Confirmation",
          actionToken,
          data: {
            subject,
            message,
            raisedByName: user.name || "Employee",
          },
        },
        message: `Ready to submit support ticket **"${subject}"** to administration? Please click 'Confirm & Submit Ticket' below.`,
      };
    }

    // ⚡ RESIGNATION STATUS & DRAFTING
    case "get_my_resignation": {
      const empIdStr = (user.employeeId || userId).toString();
      const resDoc = await Resignation.findOne({ employeeId: empIdStr }).lean();

      if (!resDoc) {
        return {
          message: "You do not have any active resignation requests on file.",
        };
      }

      return {
        status: resDoc.status,
        submittedAt: resDoc.submittedAt ? new Date(resDoc.submittedAt).toISOString().slice(0, 10) : "N/A",
        noticePeriodDays: resDoc.noticePeriodDays || 0,
        noticePeriodEndDate: resDoc.noticePeriodEndDate ? new Date(resDoc.noticePeriodEndDate).toISOString().slice(0, 10) : "TBD",
        adminRemark: resDoc.adminRemark || "Under review",
        message: `Your resignation request status is currently **${resDoc.status}** (Submitted: ${resDoc.submittedAt ? new Date(resDoc.submittedAt).toLocaleDateString() : "N/A"}). Notice period end date: **${resDoc.noticePeriodEndDate ? new Date(resDoc.noticePeriodEndDate).toLocaleDateString() : "Pending admin decision"}**.`,
      };
    }

    case "draft_resignation_request": {
      const { reason = "Personal reasons" } = toolArgs;
      const empIdStr = (user.employeeId || userId).toString();

      const existing = await Resignation.findOne({
        employeeId: empIdStr,
        status: { $in: ["Pending", "Approved", "Exit Formalities"] },
      }).lean();

      if (existing) {
        return {
          message: `⚠️ You already have an active resignation request under review (Status: **${existing.status}**).`,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_resignation_request",
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_resignation_request",
          title: "Resignation Request Confirmation",
          actionToken,
          data: {
            reason,
            employeeName: user.name || "Employee",
            department: user.department || "General",
          },
        },
        message: `⚠️ **Important Action**: Are you sure you want to submit a formal Resignation Request with reason *"${reason}"*? Please click 'Confirm & Submit Resignation' below.`,
      };
    }

    case "draft_work_update": {
      const title = (toolArgs.title || "Daily Work Update").trim();
      const description = (toolArgs.description || toolArgs.title || "Work completed for today").trim();
      const percentage = toolArgs.percentage !== undefined ? Number(toolArgs.percentage) : 100;
      const dateStr = toolArgs.date || new Date().toISOString().slice(0, 10);

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_work_update",
          title,
          description,
          percentage,
          date: dateStr,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_work_update",
          title: "Daily Work Update Confirmation",
          actionToken,
          data: {
            title,
            description,
            percentage,
            date: dateStr,
            employeeName: user.name || "Employee",
          },
        },
        message: `I have prepared your **Daily Work Update** for **${dateStr}** (${percentage}% complete):\n\n• **Title**: ${title}\n• **Summary**: ${description}\n\nPlease review, edit if needed, and click **Confirm & Submit** to record your work.`,
      };
    }

    case "get_my_daily_work": {
      const todayDate = new Date(new Date().toISOString().slice(0, 10));
      const todayEntry = await DailyWorkEntry.findOne({
        employeeId: userId,
        date: todayDate,
      }).lean();

      const recentEntries = await DailyWorkEntry.find({
        employeeId: userId,
      })
        .sort({ date: -1 })
        .limit(5)
        .lean();

      return {
        todayStatus: todayEntry ? "Submitted" : "Not Submitted",
        todayEntry: todayEntry || null,
        recentEntries: recentEntries || [],
        message: todayEntry
          ? `You have submitted your daily work for today (**${todayEntry.morning_title || "Daily Work"}** - ${todayEntry.employee_submitted_percentage || 100}%).`
          : `You have not yet submitted a daily work update for today. Would you like to submit your work summary?`,
      };
    }

    case "get_my_leaves": {
      const empIdStr = (user.employeeId || userId).toString();
      const leaves = await LeaveRequest.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!leaves || leaves.length === 0) {
        return {
          totalLeaves: 0,
          leaves: [],
          message: "You have not submitted any leave applications yet.",
        };
      }

      return {
        totalLeaves: leaves.length,
        leaves: leaves.map((l) => ({
          id: l._id,
          leaveType: l.leaveType,
          from: l.from,
          to: l.to,
          days: l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1),
          status: l.status,
          reason: l.reason,
          appliedOn: l.requestDate || (l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : "N/A"),
        })),
        message: `You have **${leaves.length} recent leave application(s)**. Latest: **${leaves[0].leaveType}** (${leaves[0].from} to ${leaves[0].to}) - Status: **${leaves[0].status}**.`,
      };
    }

    case "get_leave_policy": {
      const adminIdObj = user.adminId || user._id;
      let policyDoc = await LeavePolicy.findOne({ adminId: adminIdObj }).lean();
      if (!policyDoc && user.company) {
        policyDoc = await LeavePolicy.findOne({ companyId: user.company }).lean();
      }

      const policies = (policyDoc?.policies && policyDoc.policies.length > 0)
        ? policyDoc.policies
        : [
            { leaveType: "Casual Leave", paidDaysLimit: 0 },
            { leaveType: "Sick Leave", paidDaysLimit: 0 },
            { leaveType: "Paid Leave", paidDaysLimit: 0 },
          ];

      return {
        policies: policies.map((p) => ({
          type: p.leaveType,
          paidDaysPerYear: p.paidDaysLimit || 0,
          carriedForward: p.carriedForwardDays || 0,
        })),
        sandwichLeaveActive: !!policyDoc?.sandwichLeaveEnabled,
        carryForwardActive: !!policyDoc?.carryForwardEnabled,
        message: policyDoc?.policies?.length > 0
          ? `Your company offers: ${policies.map((p) => `**${p.leaveType}** (${p.paidDaysLimit || 0} days)`).join(", ")}. Sandwich rule: **${policyDoc?.sandwichLeaveEnabled ? "Active" : "Disabled"}**. Carry forward: **${policyDoc?.carryForwardEnabled ? "Active" : "Disabled"}**.`
          : "Standard company leave policies apply. You can apply for Casual, Sick, or Paid Leave.",
      };
    }

    case "get_today_attendance": {
      const todayStr = new Date().toISOString().slice(0, 10);
      const empIdStr = (user.employeeId || userId).toString();

      const attDoc = await Attendance.findOne({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).lean();

      const todayLog = (attDoc?.attendance || []).find((a) => a.date === todayStr);

      if (!todayLog) {
        return {
          date: todayStr,
          status: "Not Punched In",
          punchIn: null,
          punchOut: null,
          message: `You have **not punched in** yet for today (${todayStr}). Would you like to punch in now?`,
        };
      }

      const inTime = todayLog.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A";
      const outTime = todayLog.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not punched out";

      return {
        date: todayStr,
        status: todayLog.status || "PRESENT",
        punchIn: inTime,
        punchOut: outTime,
        isLate: !!todayLog.isLate || todayLog.loginStatus === "LATE",
        message: `Today's Attendance (${todayStr}): **Punched In at ${inTime}** | Punch Out: **${outTime}** | Status: **${todayLog.status || "PRESENT"}**${todayLog.isLate ? " (Late Mark)" : ""}.`,
      };
    }

    case "get_my_punch_corrections": {
      const empIdStr = (user.employeeId || userId).toString();
      const requests = await PunchOutRequest.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return {
        totalRequests: requests.length,
        requests: requests.map((r) => ({
          id: r._id,
          date: r.originalDate,
          requestedPunchOut: r.requestedPunchOut,
          status: r.status,
          reason: r.reason,
        })),
        message: requests.length > 0
          ? `You have **${requests.length} punch-out correction request(s)** on file. Latest for **${requests[0].originalDate}** (Status: **${requests[0].status}**).`
          : "You have no pending punch-out correction requests.",
      };
    }

    case "get_my_wfh_requests": {
      const empIdStr = (user.employeeId || userId).toString();
      const requests = await WorkModeRequest.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return {
        totalRequests: requests.length,
        requests: requests.map((w) => ({
          id: w._id,
          mode: w.requestedMode,
          fromDate: w.fromDate ? new Date(w.fromDate).toISOString().slice(0, 10) : "N/A",
          toDate: w.toDate ? new Date(w.toDate).toISOString().slice(0, 10) : "N/A",
          status: w.status,
          reason: w.reason,
        })),
        message: requests.length > 0
          ? `You have **${requests.length} remote work (WFH) request(s)**. Latest: **${requests[0].requestedMode}** from ${requests[0].fromDate ? new Date(requests[0].fromDate).toISOString().slice(0, 10) : ""} - Status: **${requests[0].status}**.`
          : "You have no active WFH/remote work requests.",
      };
    }

    case "get_payslip_history": {
      const empIdStr = (user.employeeId || userId).toString();
      const records = await PayrollRecord.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      })
        .sort({ year: -1, month: -1 })
        .limit(6)
        .lean();

      return {
        totalPayslips: records.length,
        payslips: records.map((p) => ({
          monthYear: `${p.month}/${p.year}`,
          netSalary: p.netSalary || p.netPay || 0,
          grossSalary: p.grossSalary || p.totalEarnings || 0,
          deductions: p.totalDeductions || 0,
          status: p.status || "Paid",
        })),
        message: records.length > 0
          ? `Found **${records.length} recent payslip(s)**. Latest for **${records[0].month}/${records[0].year}**: Net Salary ₹${Number(records[0].netSalary || 0).toLocaleString()}.`
          : "No published payslip records found for your profile.",
      };
    }

    case "get_company_rules": {
      const companyId = user.company || user.companyId || user.adminId;
      const rules = await Rule.find({
        $or: [{ companyId }, { adminId: user.adminId }, {}],
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!rules || rules.length === 0) {
        return {
          totalRules: 0,
          rules: [],
          message: "No specific company rules or guidelines uploaded yet. Standard workplace policies apply.",
        };
      }

      return {
        totalRules: rules.length,
        rules: rules.map((r) => ({
          title: r.title,
          category: r.category || "General",
          description: r.description,
        })),
        message: `**Company Rules & Guidelines (${rules.length} entries)**:\n\n${rules.map((r) => `• **${r.title}** (${r.category}): ${r.description}`).join("\n")}`,
      };
    }

    case "get_my_team": {
      const emp = await Employee.findById(userId).lean();
      const department = emp?.department || "General";
      const companyId = user.company || user.companyId || user.adminId;

      const colleagues = await Employee.find({
        department,
        _id: { $ne: userId },
        status: { $ne: "deactive" },
      })
        .select("name firstName lastName email designation phone")
        .limit(10)
        .lean();

      return {
        department,
        totalColleagues: colleagues.length,
        members: colleagues.map((c) => ({
          name: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          designation: c.designation || "Team Member",
          email: c.email,
          phone: c.phone || "N/A",
        })),
        message: `Your **${department} Department Team** (${colleagues.length} members):\n\n${colleagues.map((c) => `• **${c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim()}** - ${c.designation || "Member"} (${c.email})`).join("\n")}`,
      };
    }

    case "draft_punch_break": {
      const breakType = toolArgs.breakType || "Lunch Break";
      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_punch_break",
          breakType,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_punch_break",
          title: "Break Time Confirmation",
          actionToken,
          data: {
            breakType,
            employeeName: user.name || "Employee",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        },
        message: `Ready to record **${breakType}**? Click 'Confirm & Start Break' below (or click to resume if currently on break).`,
      };
    }

    case "draft_late_correction": {
      const date = toolArgs.date || new Date().toISOString().slice(0, 10);
      const reason = toolArgs.reason || "Late arrival justification";
      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_late_correction",
          date,
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_late_correction",
          title: "Late Arrival Justification Confirmation",
          actionToken,
          data: {
            date,
            reason,
            employeeName: user.name || "Employee",
          },
        },
        message: `I have prepared your Late Arrival Justification for **${date}**:\n\n• **Reason**: ${reason}\n\nPlease review and click 'Confirm & Submit Justification' below.`,
      };
    }

    case "draft_update_wfh": {
      const empIdStr = (user.employeeId || userId).toString();
      let targetReq = null;

      if (toolArgs.requestId) {
        targetReq = await WorkModeRequest.findById(toolArgs.requestId).lean();
      } else {
        targetReq = await WorkModeRequest.findOne({
          $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
          status: "Pending",
        }).sort({ createdAt: -1 }).lean();
      }

      if (!targetReq) {
        return { message: "No active pending WFH request found to modify." };
      }

      const fromDate = toolArgs.fromDate || (targetReq.fromDate ? new Date(targetReq.fromDate).toISOString().slice(0, 10) : "");
      const toDate = toolArgs.toDate || (targetReq.toDate ? new Date(targetReq.toDate).toISOString().slice(0, 10) : fromDate);
      const reason = toolArgs.reason || targetReq.reason || "Updated WFH request";
      const requestedMode = toolArgs.requestedMode || targetReq.requestedMode || "WFH";

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_update_wfh",
          requestId: targetReq._id.toString(),
          fromDate,
          toDate,
          requestedMode,
          reason,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_update_wfh",
          title: "Update WFH Request Confirmation",
          actionToken,
          data: {
            requestId: targetReq._id,
            fromDate,
            toDate,
            requestedMode,
            reason,
          },
        },
        message: `Update your pending **${requestedMode}** request to **${fromDate} to ${toDate}** (Reason: *${reason}*)? Click 'Confirm & Update' below.`,
      };
    }

    case "draft_notice_reply": {
      const { noticeId, message: replyMsg } = toolArgs;
      let targetNotice = null;

      if (noticeId) {
        targetNotice = await Notice.findById(noticeId).lean();
      } else {
        const companyId = user.company || user.companyId || user.adminId;
        targetNotice = await Notice.findOne({
          $or: [{ companyId }, { adminId: user.adminId }, {}],
        }).sort({ createdAt: -1 }).lean();
      }

      if (!targetNotice) {
        return { message: "No active announcement found to reply to." };
      }

      const cleanMessage = (replyMsg || "Thank you for the update.").trim();
      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_notice_reply",
          noticeId: targetNotice._id.toString(),
          message: cleanMessage,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_notice_reply",
          title: "Post Reply to Notice Confirmation",
          actionToken,
          data: {
            noticeId: targetNotice._id,
            noticeTitle: targetNotice.title,
            message: cleanMessage,
            employeeName: user.name || "Employee",
          },
        },
        message: `Ready to post reply on **"${targetNotice.title}"**:\n\n*"${cleanMessage}"*\n\nClick 'Confirm & Post Reply' below.`,
      };
    }

    case "get_office_settings": {
      const adminId = user.adminId || user._id;
      const [adminDoc, companyDoc, shiftDoc] = await Promise.all([
        Admin.findById(adminId).lean(),
        user.company ? Company.findById(user.company).lean() : null,
        Shift.findOne({ $or: [{ adminId }, { companyId: user.company }] }).lean(),
      ]);

      const officeLocation = companyDoc?.address || adminDoc?.address || "Main Corporate Office";
      const companyName = companyDoc?.companyName || adminDoc?.companyName || "Company";
      const startTime = shiftDoc?.startTime || "09:00 AM";
      const endTime = shiftDoc?.endTime || "06:00 PM";
      const gracePeriod = shiftDoc?.gracePeriod || 15;
      const workDays = shiftDoc?.workDays || "Monday - Friday";

      return {
        companyName,
        officeLocation,
        officeTimings: `${startTime} - ${endTime} (${workDays})`,
        gracePeriod: `${gracePeriod} minutes`,
        wfhPolicy: "Submit request via Work Mode Request module or Copilot for manager approval.",
        message: `🏢 **${companyName} Office Guidelines**:\n\n• **Location**: ${officeLocation}\n• **Working Hours**: ${startTime} - ${endTime} (${workDays})\n• **Grace Period**: ${gracePeriod} minutes\n• **Remote Work / WFH**: Allowed upon manager approval.`,
      };
    }

    case "draft_update_profile": {
      const field = toolArgs.field || "gender";
      let value = toolArgs.value;
      if (!value) {
        return { error: `Please specify the new ${field} value.` };
      }

      if (field === "gender") {
        const validGenders = ["Male", "Female", "Prefer not to say"];
        const normalized = validGenders.find((g) => g.toLowerCase() === String(value).toLowerCase());
        if (normalized) value = normalized;
      }

      const emp = await Employee.findById(userId).lean();
      let oldValue = "Not set";
      if (field === "email") {
        oldValue = emp?.email || "Not set";
      } else if (field === "bloodGroup") {
        oldValue = emp?.personalDetails?.bloodGroup || emp?.personal?.bloodGroup || "Not set";
      } else if (field === "gender") {
        oldValue = emp?.personalDetails?.gender || emp?.personal?.gender || "Not set";
      } else if (field === "aadhaarNumber" || field === "aadhar" || field === "aadharNumber") {
        oldValue = emp?.personalDetails?.aadhaarNumber || emp?.personal?.aadhaarNumber || "Not set";
      } else if (field === "panNumber" || field === "pan") {
        oldValue = emp?.personalDetails?.panNumber || emp?.personal?.panNumber || "Not set";
      } else if (field === "nationality") {
        oldValue = emp?.personalDetails?.nationality || emp?.personal?.nationality || "Not set";
      } else if (field === "accountNumber" || field === "bankAccount") {
        oldValue = emp?.bankDetails?.accountNumber || emp?.bank?.accountNumber || "Not set";
      } else if (field === "bankName") {
        oldValue = emp?.bankDetails?.bankName || emp?.bank?.bankName || "Not set";
      } else if (field === "ifsc" || field === "ifscCode") {
        oldValue = emp?.bankDetails?.ifsc || emp?.bank?.ifsc || "Not set";
      } else if (field === "branch") {
        oldValue = emp?.bankDetails?.branch || emp?.bank?.branch || "Not set";
      } else if (field === "emergency" || field === "emergencyContact" || field === "emergencyPhone") {
        oldValue = emp?.emergency || emp?.emergencyContact || emp?.emergencyPhone || "Not set";
      } else if (field === "linkedin" || field === "github" || field === "instagram" || field === "website") {
        oldValue = emp?.socialLinks?.[field] || "Not set";
      } else {
        oldValue = emp?.[field] || emp?.personalDetails?.[field] || emp?.personal?.[field] || emp?.bankDetails?.[field] || "Not set";
      }

      const actionToken = jwt.sign(
        {
          sub: userId,
          userId: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          adminId: user.adminId,
          actionType: "confirm_update_profile",
          field,
          value,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_update_profile",
          title: "Update Profile Confirmation",
          actionToken,
          data: {
            field,
            oldValue,
            value,
            employeeName: user.name || "Employee",
          },
        },
        message: `Ready to update your profile **${field}** from *"${oldValue}"* to **"${value}"**.\n\nPlease confirm below to apply this update to your employee record.`,
      };
    }

    case "draft_cancel_wfh": {
      const { requestId } = toolArgs;
      const employeeId = user.employeeId || userId.toString();

      let targetReq = null;
      if (requestId) {
        targetReq = await WorkModeRequest.findById(requestId).lean();
      } else {
        targetReq = await WorkModeRequest.findOne({
          $or: [{ employeeId }, { employeeId: userId.toString() }],
          status: "Pending",
        }).sort({ createdAt: -1 }).lean();
      }

      if (!targetReq) {
        return {
          message: "You currently have no pending Work From Home (WFH) requests to cancel.",
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_cancel_wfh",
          requestId: targetReq._id.toString(),
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_cancel_wfh",
          title: "Cancel WFH Request Confirmation",
          actionToken,
          data: {
            requestId: targetReq._id,
            mode: targetReq.requestedMode || "WFH",
            fromDate: targetReq.fromDate ? new Date(targetReq.fromDate).toISOString().slice(0, 10) : "N/A",
            toDate: targetReq.toDate ? new Date(targetReq.toDate).toISOString().slice(0, 10) : "N/A",
            reason: targetReq.reason || "WFH request",
          },
        },
        message: `Are you sure you want to cancel your pending **${targetReq.requestedMode || "WFH"}** request for ${targetReq.fromDate ? new Date(targetReq.fromDate).toISOString().slice(0, 10) : ""} to ${targetReq.toDate ? new Date(targetReq.toDate).toISOString().slice(0, 10) : ""}? Please click 'Confirm & Cancel WFH' below.`,
      };
    }

    case "draft_cancel_expense": {
      const { expenseId } = toolArgs;

      let targetExpense = null;
      if (expenseId) {
        targetExpense = await Expense.findById(expenseId).lean();
      } else {
        const queryOr = [{ employeeId: userId }];
        if (mongoose.Types.ObjectId.isValid(user.employeeId)) {
          queryOr.push({ employeeId: user.employeeId });
        }
        targetExpense = await Expense.findOne({
          $or: queryOr,
          status: "Pending",
        }).sort({ createdAt: -1 }).lean();
      }

      if (!targetExpense) {
        return {
          message: "You currently have no pending expense claims to cancel.",
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_cancel_expense",
          expenseId: targetExpense._id.toString(),
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_cancel_expense",
          title: "Cancel Expense Claim Confirmation",
          actionToken,
          data: {
            expenseId: targetExpense._id,
            amount: targetExpense.amount,
            category: targetExpense.category,
            date: targetExpense.date,
            description: targetExpense.description,
          },
        },
        message: `Are you sure you want to cancel your pending **${targetExpense.category}** claim of **₹${targetExpense.amount?.toLocaleString()}**? Please click 'Confirm & Cancel Claim' below.`,
      };
    }

    case "draft_cancel_overtime": {
      const { overtimeId } = toolArgs;
      const empIdStr = (user.employeeId || userId).toString();

      let targetOT = null;
      if (overtimeId) {
        targetOT = await Overtime.findById(overtimeId).lean();
      } else {
        targetOT = await Overtime.findOne({
          $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
          status: "PENDING",
        }).sort({ createdAt: -1 }).lean();
      }

      if (!targetOT) {
        return {
          message: "You currently have no pending overtime claims to cancel.",
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_cancel_overtime",
          overtimeId: targetOT._id.toString(),
          hours: targetOT.hours,
          date: targetOT.date,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_cancel_overtime",
          title: "Cancel Overtime Claim Confirmation",
          actionToken,
          data: {
            overtimeId: targetOT._id,
            hours: targetOT.hours,
            date: targetOT.date,
            reason: targetOT.reason,
            fromTime: targetOT.fromTime,
            toTime: targetOT.toTime,
          },
        },
        message: `Are you sure you want to cancel your pending overtime claim for **${targetOT.hours} hours** on **${targetOT.date}**? Please click 'Confirm & Cancel Claim' below.`,
      };
    }

    // =========================================================================
    // 📊 DASHBOARD SUMMARY OVERVIEW TOOL
    // =========================================================================
    case "get_dashboard_summary": {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const companyId = user.company || user.companyId;
      const adminId = user.adminId || user._id;

      // 1. Fetch Attendance Today
      const todayAtt = await Attendance.findOne({
        $or: [{ employeeId: user.employeeId }, { employeeId: userId.toString() }, { employeeId: empIdStr }],
        date: todayStr,
      }).lean();

      // 2. Fetch Leave Balances
      let leaveBal = null;
      try {
        leaveBal = await checkEmployeeLeaveBalance(user);
      } catch (e) {
        leaveBal = { casualLeave: "N/A", sickLeave: "N/A", paidLeave: "N/A" };
      }

      // 3. Pending Requests Counts
      const [pendingLeaves, pendingWfh, pendingExpenses, pendingOT, activeTrip, upcomingHoliday, unreadNotices] = await Promise.all([
        LeaveRequest.countDocuments({
          $or: [{ employeeId: user.employeeId }, { employeeId: userId.toString() }],
          status: "Pending",
        }),
        WorkModeRequest.countDocuments({
          $or: [{ employeeId: user.employeeId }, { employeeId: userId.toString() }],
          status: "Pending",
        }),
        Expense.countDocuments({
          $or: [{ employeeId: userId }, ...(mongoose.Types.ObjectId.isValid(user.employeeId) ? [{ employeeId: user.employeeId }] : [])],
          status: "PENDING",
        }),
        Overtime.countDocuments({
          $or: [{ employeeId: user.employeeId }, { employeeId: userId.toString() }],
          status: "PENDING",
        }),
        FieldWorkTrip.findOne({
          employee: userId,
          status: "active",
        }).lean(),
        Holiday.findOne({
          $or: [{ adminId }, { companyId }],
          date: { $gte: todayStr },
        }).sort({ date: 1 }).lean(),
        Notice.countDocuments({
          $or: [{ adminId }, { companyId }],
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

      const punchStatus = todayAtt?.punchIn
        ? (todayAtt?.punchOut ? `Punched Out at ${todayAtt.punchOut}` : `Punched In at ${todayAtt.punchIn}`)
        : "Not punched in yet";

      const activeBreak = todayAtt?.breaks?.find((b) => !b.breakOut);
      const breakStatus = activeBreak ? `On Break (since ${activeBreak.breakIn})` : "Working (No active break)";

      const totalPending = pendingLeaves + pendingWfh + pendingExpenses + pendingOT;

      const summaryData = {
        employeeName: user.name || "Employee",
        date: todayStr,
        punchStatus,
        breakStatus,
        punchedIn: !!todayAtt?.punchIn,
        punchedOut: !!todayAtt?.punchOut,
        isOnBreak: !!activeBreak,
        leaveBalances: {
          casual: leaveBal?.casualLeave ?? 0,
          sick: leaveBal?.sickLeave ?? 0,
          paid: leaveBal?.paidLeave ?? 0,
        },
        pendingCounts: {
          total: totalPending,
          leaves: pendingLeaves,
          wfh: pendingWfh,
          expenses: pendingExpenses,
          overtime: pendingOT,
        },
        fieldWorkActive: !!activeTrip,
        activeTripStarted: activeTrip ? activeTrip.startedAt : null,
        nextHoliday: upcomingHoliday ? `${upcomingHoliday.title || upcomingHoliday.name} (${upcomingHoliday.date})` : "No upcoming holidays",
        unreadNoticesCount: unreadNotices,
      };

      const message = `📊 **Daily Overview & Dashboard Summary (${todayStr})**:\n\n` +
        `• **Attendance Status**: ${punchStatus}\n` +
        `• **Current Break**: ${breakStatus}\n` +
        `• **Leave Balance**: Casual: **${summaryData.leaveBalances.casual}**, Sick: **${summaryData.leaveBalances.sick}**, Paid: **${summaryData.leaveBalances.paid}**\n` +
        `• **Pending Requests**: **${totalPending}** pending (${pendingLeaves} leaves, ${pendingWfh} WFH, ${pendingExpenses} expenses, ${pendingOT} OT)\n` +
        `• **Field Work**: ${activeTrip ? `Active (Started: ${new Date(activeTrip.startedAt).toLocaleTimeString()})` : "No active trip"}\n` +
        `• **Next Holiday**: ${summaryData.nextHoliday}\n` +
        `• **Recent Notices**: ${unreadNotices} in last 7 days`;

      return {
        ...summaryData,
        message,
        actionCard: {
          type: "dashboard_summary_widget",
          title: "Employee Dashboard Summary",
          data: summaryData,
        },
      };
    }

    // =========================================================================
    // 📍 FIELD WORK & LOCATION TRACKING TOOLS
    // =========================================================================
    case "get_field_work_history": {
      const trips = await FieldWorkTrip.find({
        employee: userId,
      })
        .sort({ startedAt: -1 })
        .limit(5)
        .lean();

      const activeTrip = trips.find((t) => t.status === "active");

      const message = trips.length === 0
        ? "You have not recorded any field work trips yet. You can start one anytime by saying *'start field trip'*."
        : `📍 **Your Recent Field Work Trips**:\n\n` +
          trips
            .map((t, idx) => {
              const start = new Date(t.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const end = t.endedAt ? new Date(t.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In Progress";
              const statusTag = t.status === "active" ? "🟢 Active" : "✅ Completed";
              return `${idx + 1}. **${new Date(t.startedAt).toISOString().slice(0, 10)}** (${start} - ${end}) • ${statusTag} • ${(t.distanceKm || 0).toFixed(1)} km`;
            })
            .join("\n");

      return {
        trips,
        activeTrip: activeTrip || null,
        message,
        actionCard: {
          type: "field_work_widget",
          title: "Field Work & Location History",
          data: { trips, activeTrip: activeTrip || null },
        },
      };
    }

    case "draft_start_field_work": {
      const activeTrip = await FieldWorkTrip.findOne({
        employee: userId,
        status: "active",
      }).lean();

      if (activeTrip) {
        return {
          message: `You already have an active field work trip in progress started at **${new Date(activeTrip.startedAt).toLocaleTimeString()}**. You can say *'end field trip'* when you finish.`,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          adminId: user.adminId,
          companyId: user.company || user.companyId,
          actionType: "confirm_start_field_work",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_start_field_work",
          title: "Start Field Work Trip Confirmation",
          actionToken,
          data: {
            employeeName: user.name || "Employee",
            time: new Date().toLocaleTimeString(),
            date: new Date().toISOString().slice(0, 10),
          },
        },
        message: "Ready to start your **Field Work Trip** and initialize live location tracking. Please confirm below.",
      };
    }

    case "draft_end_field_work": {
      const activeTrip = await FieldWorkTrip.findOne({
        employee: userId,
        status: "active",
      }).lean();

      if (!activeTrip) {
        return {
          message: "You do not have any active field work trip currently running to end.",
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          tripId: activeTrip._id.toString(),
          actionType: "confirm_end_field_work",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_end_field_work",
          title: "End Field Work Trip Confirmation",
          actionToken,
          data: {
            tripId: activeTrip._id,
            startedAt: activeTrip.startedAt,
            distanceKm: activeTrip.distanceKm || 0,
            startTimeFormatted: new Date(activeTrip.startedAt).toLocaleTimeString(),
          },
        },
        message: `Ready to complete your active field work trip started at **${new Date(activeTrip.startedAt).toLocaleTimeString()}**. Please confirm below to save the trip.`,
      };
    }

    // =========================================================================
    // 💬 CONNECT & DIRECT MESSAGING TOOLS
    // =========================================================================
    case "draft_send_message": {
      const receiverName = toolArgs.receiverName || toolArgs.name || "";
      const messageText = toolArgs.messageText || toolArgs.text || toolArgs.message || "";

      if (!receiverName) {
        return { error: "Please specify who you want to message (e.g. 'send message to John: Hello')." };
      }
      if (!messageText) {
        return { error: `Please specify the message you would like to send to ${receiverName}.` };
      }

      const rx = new RegExp(receiverName.trim(), "i");
      const targetEmp = await Employee.findOne({
        $or: [{ name: rx }, { email: rx }],
        _id: { $ne: userId },
        $or: [{ adminId: user.adminId }, { company: user.company || user.companyId }],
      }).lean();

      if (!targetEmp) {
        return {
          error: `Could not find any colleague named "${receiverName}" in your company directory. You can check 'view my team' for the full list.`,
        };
      }

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          receiverId: targetEmp._id.toString(),
          receiverName: targetEmp.name,
          messageText: messageText.trim(),
          actionType: "confirm_send_message",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_send_message",
          title: "Send Colleague Message Confirmation",
          actionToken,
          data: {
            receiverName: targetEmp.name,
            receiverEmail: targetEmp.email,
            receiverDepartment: targetEmp.department || "General",
            messageText: messageText.trim(),
          },
        },
        message: `Ready to send your message to **${targetEmp.name}**:\n\n> *"${messageText.trim()}"*\n\nPlease confirm below to deliver this message.`,
      };
    }

    case "draft_request_ontime_login": {
      const date = toolArgs.date || new Date().toISOString().slice(0, 10);
      const reason = toolArgs.reason || "Late login correction request";
      const requestedPunchIn = toolArgs.requestedPunchIn || "09:30";

      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          employeeId: user.employeeId || userId.toString(),
          date,
          reason,
          requestedPunchIn,
          actionType: "confirm_request_ontime_login",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_request_ontime_login",
          title: "Request On-Time Login Confirmation",
          actionToken,
          data: {
            date,
            reason,
            requestedStatus: "ON_TIME",
            requestedTime: requestedPunchIn,
            applicantName: user.name || "Employee",
          },
        },
        message: `Ready to submit an On-Time Login request for **${date}** (Reason: *${reason}*). Please confirm below to submit to Admin for approval.`,
      };
    }

    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
};

