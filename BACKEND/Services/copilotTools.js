import jwt from "jsonwebtoken";
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
];

/* ============================================================================
   TRADITIONAL BACKEND HELPER: CHECK LEAVE BALANCE
============================================================================ */
export async function checkEmployeeLeaveBalance(adminId, employeeId, leaveType) {
  const policyDoc = await LeavePolicy.findOne({ adminId }).lean();
  let paidDaysLimit = 12; // Standard default

  if (policyDoc?.policies) {
    const policy = policyDoc.policies.find(
      (p) => p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
    );
    if (policy && typeof policy.paidDaysLimit === "number") {
      paidDaysLimit = policy.paidDaysLimit;
    }
  }

  const leaves = await LeaveRequest.find({
    employeeId: String(employeeId),
    status: "Approved",
  }).lean();

  let usedDays = 0;
  const targetType = leaveType.trim().toLowerCase();

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

  switch (toolName) {
    case "get_my_profile": {
      const emp = await Employee.findById(userId).select("-password").lean();
      if (!emp) return { error: "Employee profile record not found." };
      return {
        name: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        employeeId: emp.employeeId || emp._id,
        email: emp.email,
        department: emp.department || "General",
        designation: emp.designation || emp.role || "Employee",
        dateOfJoining: emp.joiningDate || emp.createdAt,
        phone: emp.phone || emp.mobile || "N/A",
      };
    }

    case "get_leave_balance": {
      const empIdStr = (user.employeeId || userId).toString();
      const leaves = await LeaveRequest.find({
        $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      }).sort({ createdAt: -1 }).lean();

      const approved = leaves.filter((l) => l.status === "Approved");
      const pending = leaves.filter((l) => l.status === "Pending");
      const rejected = leaves.filter((l) => l.status === "Rejected");

      let totalDaysTaken = 0;
      approved.forEach((l) => {
        totalDaysTaken += l.totalDays || (l.leaveDayType === "Half Day" ? 0.5 : 1);
      });

      return {
        totalApprovedLeaves: approved.length,
        totalPendingLeaves: pending.length,
        totalRejectedLeaves: rejected.length,
        totalApprovedDaysTaken: totalDaysTaken,
        standardEntitlements: {
          CasualLeave: "12 Days/Year",
          SickLeave: "10 Days/Year",
          PaidLeave: "15 Days/Year",
        },
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

      return {
        month: currentMonthPrefix,
        totalRecordsThisMonth: logs.length,
        presentDays: presentCount,
        lateMarks: lateCount,
        absentDays: absentCount,
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

      return {
        totalUpcomingHolidays: upcoming.length,
        holidays: upcoming.map((h) => ({
          name: h.name || h.title || h.holidayName,
          date: h.date,
          day: h.day || new Date(h.date).toLocaleDateString("en-US", { weekday: "long" }),
          type: h.type || "Official Holiday",
        })),
      };
    }

    case "get_my_shifts": {
      const emp = await Employee.findById(userId).lean();
      let shiftDetails = null;

      if (emp?.shiftId) {
        shiftDetails = await Shift.findById(emp.shiftId).lean();
      }

      if (!shiftDetails) {
        return {
          shiftName: "Standard General Shift",
          startTime: "09:00 AM",
          endTime: "06:00 PM",
          gracePeriodMinutes: 15,
          workDays: "Monday - Friday",
        };
      }

      return {
        shiftName: shiftDetails.name || shiftDetails.shiftName || "Regular Shift",
        startTime: shiftDetails.startTime || "09:00 AM",
        endTime: shiftDetails.endTime || "06:00 PM",
        gracePeriodMinutes: shiftDetails.gracePeriod || 15,
        workDays: shiftDetails.workDays || "Monday - Friday",
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

      if (!todayLog || !todayLog.punchIn) {
        return {
          message: `You haven't punched in for today (${todayStr}) yet. Please punch in first.`,
        };
      }

      if (todayLog.punchOut) {
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

    // ⚡ EXPENSE REIMBURSEMENT TOOLS
    case "get_my_expenses": {
      const expenses = await Expense.find({
        $or: [{ employeeId: userId }, { employeeCustomId: (user.employeeId || userId).toString() }],
      }).sort({ date: -1 }).limit(10).lean();

      const totalClaimed = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const approvedCount = expenses.filter((e) => e.status === "Approved").length;
      const pendingCount = expenses.filter((e) => e.status === "Pending").length;

      return {
        totalClaims: expenses.length,
        totalClaimedAmount: totalClaimed,
        approvedClaims: approvedCount,
        pendingClaims: pendingCount,
        expenses: expenses.map((e) => ({
          id: e._id,
          category: e.category,
          amount: e.amount,
          date: e.date ? new Date(e.date).toISOString().slice(0, 10) : "N/A",
          status: e.status,
          description: e.description,
        })),
        message: expenses.length === 0
          ? "You haven't submitted any expense claims yet."
          : `You have **${expenses.length} expense claims** (Total: ₹${totalClaimed.toLocaleString()}). ${pendingCount} pending approval.`,
      };
    }

    case "draft_expense_request": {
      const { amount, category = "General", description = "Expense claim submitted via AI Copilot", date } = toolArgs;
      if (!amount || isNaN(Number(amount))) {
        return { message: "Please specify the expense amount (e.g. ₹500, ₹1200)." };
      }

      const dateStr = date || new Date().toISOString().slice(0, 10);
      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_expense_request",
          amount: Number(amount),
          category,
          description,
          date: dateStr,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      return {
        actionCard: {
          type: "confirm_expense_request",
          title: "Expense Claim Confirmation",
          actionToken,
          data: {
            amount: Number(amount),
            category,
            description,
            date: dateStr,
            applicantName: user.name || "Employee",
          },
        },
        message: `I have prepared your expense claim of **₹${Number(amount).toLocaleString()}** (${category}). Please click 'Confirm & Submit Expense' below.`,
      };
    }

    // ⚡ OVERTIME (OT) TOOLS
    case "get_my_overtime": {
      const empIdStr = (user.employeeId || userId).toString();
      const otRecords = await Overtime.find({ employeeId: empIdStr })
        .sort({ date: -1 })
        .limit(10)
        .lean();

      const totalHours = otRecords.reduce((sum, ot) => sum + (ot.hours || 0), 0);
      const approvedHours = otRecords
        .filter((ot) => ot.status === "APPROVED")
        .reduce((sum, ot) => sum + (ot.hours || 0), 0);

      return {
        totalRequests: otRecords.length,
        totalHoursClaimed: totalHours,
        approvedHours,
        records: otRecords.map((ot) => ({
          date: ot.date,
          hours: ot.hours,
          fromTime: ot.fromTime,
          toTime: ot.toTime,
          status: ot.status,
          reason: ot.reason,
        })),
        message: otRecords.length === 0
          ? "You have no overtime claims recorded."
          : `You have **${otRecords.length} overtime records** (${totalHours} total hours, ${approvedHours} approved).`,
      };
    }

    case "draft_overtime_request": {
      const { hours, date, reason = "Overtime worked", fromTime = "18:00", toTime = "20:00" } = toolArgs;
      if (!hours || isNaN(Number(hours))) {
        return { message: "Please specify the number of overtime hours (e.g. 2 hours)." };
      }

      const dateStr = date || new Date().toISOString().slice(0, 10);
      const actionToken = jwt.sign(
        {
          sub: userId.toString(),
          actionType: "confirm_overtime_request",
          hours: Number(hours),
          date: dateStr,
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
          title: "Overtime Request Confirmation",
          actionToken,
          data: {
            hours: Number(hours),
            date: dateStr,
            fromTime,
            toTime,
            reason,
          },
        },
        message: `I have prepared your Overtime request for **${hours} hours** on ${dateStr} (${fromTime} - ${toTime}). Please click 'Confirm & Apply Overtime' below.`,
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
        message: `⚠️ **Important Action**: Are you sure you want to submit a formal Resignation Request with reason *"<strong>${reason}</strong>"*? Please click 'Confirm & Submit Resignation' below.`,
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

    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
};
