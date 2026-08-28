import LeaveRequest, { LeavePolicy } from "../models/LeaveRequest.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Attendance from "../models/Attendance.js";
import Notification from "../models/notificationModel.js";
import Admin from "../models/adminModel.js";
import Company from "../models/CompanyModel.js";
import Expense from "../models/Expense.js";
import Overtime from "../models/Overtime.js";
import PunchOutRequest from "../models/PunchOutRequest.js";
import TechnicalIssue from "../models/TechnicalIssue.js";
import Resignation from "../models/Resignation.js";
import DailyWorkEntry from "../models/DailyWorkEntry.js";
import nodemailer from "nodemailer";

/* ===============================================================
   SMTP TRANSPORTER
=============================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function countLeaveDays(dates, leaveDayType) {
  return dates.length * (leaveDayType === "Half Day" ? 0.5 : 1);
}

function getCycleStartDateStr(resetMonthStr) {
  const now = new Date();
  let currentYear = now.getFullYear();
  const rMonth = parseInt(resetMonthStr || "1", 10);
  if (now.getMonth() + 1 < rMonth) {
    currentYear--;
  }
  return `${currentYear}-${String(rMonth).padStart(2, "0")}-01`;
}

function leaveQueryForRequester(employeeId, requesterType = "employee") {
  const base = { employeeId: String(employeeId), status: "Approved" };
  if (requesterType === "support-admin") {
    return { ...base, requesterType: "support-admin" };
  }
  return { ...base, $or: [{ requesterType: "employee" }, { requesterType: { $exists: false } }] };
}

async function getUsedPaidDaysForEmployee(employeeId, leaveType, cycleStartDateStr, requesterType = "employee") {
  if (!employeeId) return 0;
  const leaves = await LeaveRequest.find(leaveQueryForRequester(employeeId, requesterType)).lean();

  let used = 0;
  const targetType = leaveType.trim().toLowerCase();

  for (const leave of leaves) {
    if (leave.leaveType && leave.leaveType.trim().toLowerCase() === targetType) {
      for (const detail of leave.details || []) {
        if (detail.leavecategory === "Paid" && detail.date >= cycleStartDateStr) {
          used += detail.leaveDayType === "Half Day" ? 0.5 : 1;
        }
      }
    }
  }
  return used;
}

async function getCarriedForwardDays(adminId, employeeId, leaveType, policyDoc, requesterType = "employee") {
  if (!policyDoc?.carryForwardEnabled) return 0;

  const policy = policyDoc.policies.find(
    (p) => p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
  );
  if (!policy) return 0;

  const rMonth = parseInt(policyDoc.resetMonth || "1", 10);
  const now = new Date();
  let currentCycleYear = now.getFullYear();
  if (now.getMonth() + 1 < rMonth) currentCycleYear--;

  const prevCycleStart = `${currentCycleYear - 1}-${String(rMonth).padStart(2, "0")}-01`;
  const prevCycleEnd = `${currentCycleYear}-${String(rMonth).padStart(2, "0")}-01`;

  const approvedQuery =
    requesterType === "support-admin"
      ? { employeeId: String(employeeId), status: "Approved", requesterType: "support-admin" }
      : {
          employeeId: String(employeeId),
          status: "Approved",
          $or: [{ requesterType: "employee" }, { requesterType: { $exists: false } }],
        };

  const leaves = await LeaveRequest.find(approvedQuery).lean();

  let usedInPrevCycle = 0;
  const targetType = leaveType.trim().toLowerCase();

  for (const leave of leaves) {
    if (leave.leaveType && leave.leaveType.trim().toLowerCase() === targetType) {
      for (const detail of leave.details || []) {
        if (
          detail.leavecategory === "Paid" &&
          detail.date >= prevCycleStart &&
          detail.date < prevCycleEnd
        ) {
          usedInPrevCycle += detail.leaveDayType === "Half Day" ? 0.5 : 1;
        }
      }
    }
  }

  const unusedFromPrevCycle = Math.max(0, policy.paidDaysLimit - usedInPrevCycle);
  return unusedFromPrevCycle;
}

async function resolveLeaveCategoryForRequest(adminId, employeeId, leaveType, leaveDayType, dates, requesterType = "employee") {
  const totalDays = countLeaveDays(dates, leaveDayType);
  const policyDoc = await LeavePolicy.findOne({ adminId });
  if (!policyDoc) return { leavecategory: "UnPaid", paidDays: 0, unpaidDays: totalDays };

  const policy = policyDoc.policies.find(
    (p) => p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
  );
  if (!policy || policy.paidDaysLimit === 0) {
    return { leavecategory: "UnPaid", paidDays: 0, unpaidDays: totalDays };
  }

  const cycleStart = getCycleStartDateStr(policyDoc.resetMonth);
  const personalUsedPaidDays = await getUsedPaidDaysForEmployee(employeeId, leaveType, cycleStart, requesterType);

  let effectiveLimit = policy.paidDaysLimit;
  if (policyDoc.carryForwardEnabled) {
    const carriedDays = await getCarriedForwardDays(adminId, employeeId, leaveType, policyDoc, requesterType);
    effectiveLimit = policy.paidDaysLimit + carriedDays;
  }

  const remaining = Math.max(0, effectiveLimit - personalUsedPaidDays);
  if (remaining >= totalDays) return { leavecategory: "Paid", paidDays: totalDays, unpaidDays: 0 };
  if (remaining > 0) return { leavecategory: "Paid", paidDays: remaining, unpaidDays: totalDays - remaining };
  return { leavecategory: "UnPaid", paidDays: 0, unpaidDays: totalDays };
}

function buildDetailsWithCategory(dates, leaveType, leaveDayType, paidDaysAllowed) {
  let paidUsed = 0;
  return dates.map((date) => {
    const dayValue = leaveDayType === "Half Day" ? 0.5 : 1;
    const cat = paidUsed < paidDaysAllowed ? "Paid" : "UnPaid";
    if (cat === "Paid") paidUsed += dayValue;
    return { date, leavecategory: cat, leaveType, leaveDayType };
  });
}

const adminLeaveNotificationEmail = ({ name, employeeId, email, leaveType, from, to, reason }) => `
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:35px 30px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">New Leave Request</h1>
          <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;opacity:0.9;">Action Required — Pending Approval</p>
        </td></tr>
        <tr><td style="padding:35px 30px;">
          <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
            A new leave application has been submitted by <strong>${name}</strong> and is awaiting your review.
          </p>
          <table width="100%" style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:25px;">
            <tr><td>
              <table width="100%" style="font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:10px 0;color:#6b7280;width:35%;">Employee Name</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">${name}</td></tr>
                <tr><td style="padding:10px 0;color:#6b7280;">Employee Email</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;">${email || "N/A"}</td></tr>
                <tr><td style="padding:10px 0;color:#6b7280;">Leave Type</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#3b82f6;">${leaveType}</td></tr>
                <tr><td style="padding:10px 0;color:#6b7280;">Duration</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}</td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">Please log in to the Admin Portal to approve or reject this request.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

/* =========================================================================
   1. SHARED SERVICE: APPLY LEAVE
========================================================================= */
export const serviceApplyLeave = async ({ loggedUser, from, to, reason, leaveType, leaveDayType, halfDaySession = "", io = null }) => {
  if (!from || !to || !reason || !leaveType || !leaveDayType) {
    throw new Error("Missing required fields (from, to, reason, leaveType, leaveDayType).");
  }

  const isSupportAdmin = loggedUser.role === "support-admin";
  const requesterKey = isSupportAdmin
    ? String(loggedUser.actualId || loggedUser._id)
    : String(loggedUser.employeeId || loggedUser._id);

  let adminIdForLeave = loggedUser.adminId || loggedUser._id;
  let companyIdForLeave = loggedUser.companyId || loggedUser.company || loggedUser.adminId || loggedUser._id;

  if (isSupportAdmin) {
    if (!adminIdForLeave) {
      throw new Error("Support admin is not linked to an organization.");
    }
    const company = await Company.findOne({ adminId: adminIdForLeave }).select("_id").lean();
    if (company?._id) {
      companyIdForLeave = company._id;
    }
  }

  const requesterType = isSupportAdmin ? "support-admin" : "employee";
  const requesterName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || loggedUser.email || "Employee";

  const monthKey = from.slice(0, 7);
  const dates = listDates(from, to);
  const totalDays = countLeaveDays(dates, leaveDayType);

  const { leavecategory = "UnPaid", paidDays = 0 } = await resolveLeaveCategoryForRequest(
    adminIdForLeave,
    requesterKey,
    leaveType,
    leaveDayType,
    dates,
    requesterType
  );

  const details = buildDetailsWithCategory(dates, leaveType, leaveDayType, paidDays);

  const newLeave = await LeaveRequest.create({
    adminId: adminIdForLeave,
    companyId: companyIdForLeave,
    employeeId: requesterKey,
    requesterType,
    requesterName,
    from,
    to,
    reason,
    leaveType,
    leaveDayType,
    halfDaySession,
    leavecategory,
    totalDays,
    status: "Pending",
    monthKey,
    requestDate: new Date().toISOString().slice(0, 10),
    actionDate: "-",
    approvedBy: "-",
    details,
  });

  console.log("💾 [serviceApplyLeave] Created leave in MongoDB:", {
    id: newLeave._id,
    adminId: newLeave.adminId,
    companyId: newLeave.companyId,
    employeeId: newLeave.employeeId,
    status: newLeave.status,
    from: newLeave.from,
    to: newLeave.to,
  });

  // 🔔 Notify Admin
  const adminObj = await Admin.findById(adminIdForLeave).select("email").lean();
  let notif = null;
  try {
    notif = await Notification.create({
      adminId: adminIdForLeave,
      companyId: companyIdForLeave,
      userId: adminIdForLeave,
      userType: "Admin",
      title: "New Leave Application",
      message: `${requesterName} has applied for ${leaveType} (${from} to ${to}).`,
      type: "leave",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Leave notification creation skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminIdForLeave}`).emit("newNotification", notif);
      io.to(`user_${adminIdForLeave}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("leave:new", newLeave);
    io.emit("leave:created", { leaveId: newLeave._id, adminId: adminIdForLeave });
  }

  if (adminObj?.email) {
    try {
      await transporter.sendMail({
        from: `"Leave Management" <${process.env.SMTP_USER}>`,
        to: adminObj.email,
        subject: `New Leave Request: ${requesterName} (${leaveType})`,
        html: adminLeaveNotificationEmail({
          name: requesterName,
          employeeId: requesterKey,
          email: loggedUser.email,
          leaveType,
          from,
          to,
          reason,
        }),
      });
    } catch (emailErr) {
      console.error("❌ Leave notification email failed:", emailErr.message);
    }
  }

  return newLeave;
};

/* =========================================================================
   2. SHARED SERVICE: CANCEL LEAVE
========================================================================= */
export const serviceCancelLeave = async ({ loggedUser, leaveRequestId, io = null }) => {
  const leave = await LeaveRequest.findById(leaveRequestId);
  if (!leave) {
    throw new Error("Leave request record not found.");
  }

  const isSupportAdmin = loggedUser.role === "support-admin";
  const userKey = isSupportAdmin ? String(loggedUser.actualId || loggedUser._id) : String(loggedUser.employeeId);

  if (leave.employeeId !== userKey) {
    throw new Error("Unauthorized to cancel this leave request.");
  }

  if (leave.status !== "Pending") {
    throw new Error("Only pending leave requests can be cancelled.");
  }

  leave.status = "Cancelled";
  await leave.save();

  if (io) {
    io.emit("leave:updated", { leaveId: leave._id });
  }

  return leave;
};

/* =========================================================================
   3. SHARED SERVICE: APPLY WORK FROM HOME (WFH)
========================================================================= */
export const serviceApplyWFH = async ({ loggedUser, fromDate, toDate, requestedMode = "WFH", reason, io = null }) => {
  if (!fromDate || !toDate || !reason) {
    throw new Error("Missing required fields (fromDate, toDate, reason).");
  }

  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || loggedUser._id;

  const wfhDoc = await WorkModeRequest.create({
    adminId,
    companyId,
    employeeId: (loggedUser.employeeId || loggedUser._id).toString(),
    employeeName: loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee",
    department: loggedUser.department || "General",
    requestType: "Temporary",
    fromDate: new Date(fromDate),
    toDate: new Date(toDate),
    requestedMode,
    reason,
    status: "Pending",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "New Work Mode Request",
      message: `${wfhDoc.employeeName} requested ${requestedMode} from ${fromDate} to ${toDate}.`,
      type: "workmode",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ WorkMode notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("workMode:newRequest", wfhDoc);
    io.emit("workMode:new", wfhDoc);
  }

  return wfhDoc;
};

/* =========================================================================
   4. SHARED SERVICE: PUNCH IN
========================================================================= */
export const servicePunchIn = async ({ loggedUser, date, note = "", io = null }) => {
  const todayStr = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const empIdStr = (loggedUser.employeeId || loggedUser._id).toString();

  let attDoc = await Attendance.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: (loggedUser._id || loggedUser.id).toString() }],
  });

  if (!attDoc) {
    attDoc = await Attendance.create({
      adminId: loggedUser.adminId || loggedUser._id,
      companyId: loggedUser.company || loggedUser.companyId || loggedUser._id,
      employeeId: empIdStr,
      employeeName: loggedUser.name || "Employee",
      attendance: [],
    });
  }

  let todayEntry = attDoc.attendance.find((a) => a.date === todayStr);

  if (!todayEntry) {
    attDoc.attendance.push({
      date: todayStr,
      punchIn: now,
      status: "WORKING",
      loginStatus: "ON_TIME",
      workedStatus: "FULL_DAY",
      attendanceCategory: "FULL_DAY",
      sessions: [{ punchIn: now }],
    });
  } else {
    if (todayEntry.status === "WORKING" && todayEntry.punchIn && !todayEntry.punchOut) {
      throw new Error(`Already punched in for today (${todayStr}).`);
    }
    todayEntry.punchIn = now;
    todayEntry.status = "WORKING";
    todayEntry.sessions.push({ punchIn: now });
  }

  await attDoc.save();

  if (io) {
    io.emit("attendance:punchIn", { employeeId: empIdStr, time: now });
  }

  return { date: todayStr, punchIn: now, status: "WORKING" };
};

/* =========================================================================
   5. SHARED SERVICE: PUNCH OUT
========================================================================= */
export const servicePunchOut = async ({ loggedUser, date, note = "", io = null }) => {
  const todayStr = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const empIdStr = (loggedUser.employeeId || loggedUser._id).toString();

  const attDoc = await Attendance.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: (loggedUser._id || loggedUser.id).toString() }],
  });

  const todayEntry = attDoc?.attendance?.find((a) => a.date === todayStr);

  if (!todayEntry || !todayEntry.punchIn) {
    throw new Error("Cannot punch out without prior punch in today.");
  }

  if (todayEntry.punchOut) {
    throw new Error(`Already punched out for today (${todayStr}).`);
  }

  todayEntry.punchOut = now;
  todayEntry.status = "COMPLETED";
  todayEntry.isFinalPunchOut = true;

  if (todayEntry.sessions && todayEntry.sessions.length > 0) {
    const lastSession = todayEntry.sessions[todayEntry.sessions.length - 1];
    if (!lastSession.punchOut) {
      lastSession.punchOut = now;
      lastSession.durationSeconds = Math.floor((now.getTime() - new Date(lastSession.punchIn).getTime()) / 1000);
    }
  }

  await attDoc.save();

  if (io) {
    io.emit("attendance:punchOut", { employeeId: empIdStr, time: now });
  }

  return { date: todayStr, punchOut: now, status: "COMPLETED" };
};

/* =========================================================================
   6. SHARED SERVICE: SUBMIT EXPENSE CLAIM
========================================================================= */
export const serviceApplyExpense = async ({ loggedUser, category, amount, description, date, io = null }) => {
  if (!amount || isNaN(Number(amount))) {
    throw new Error("Valid expense amount is required.");
  }

  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || loggedUser.adminId;
  const employeeId = loggedUser._id || loggedUser.id;
  const employeeCustomId = (loggedUser.employeeId || loggedUser.customId || employeeId).toString();
  const employeeName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";

  const expenseDoc = await Expense.create({
    adminId,
    companyId,
    employeeId,
    employeeCustomId,
    employeeName,
    category: category || "General",
    amount: Number(amount),
    date: date ? new Date(date) : new Date(),
    description: description || "Expense claim submitted via AI Copilot",
    status: "Pending",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "New Expense Claim",
      message: `${employeeName} submitted an expense claim of ₹${amount} (${category || "General"}).`,
      type: "expense",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Expense notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("expense:new", expenseDoc);
    io.emit("expense:created", expenseDoc);
  }

  return expenseDoc;
};

/* =========================================================================
   7. SHARED SERVICE: SUBMIT OVERTIME CLAIM
========================================================================= */
export const serviceApplyOvertime = async ({ loggedUser, date, hours, reason, fromTime, toTime, type = "INCENTIVE_OT", io = null }) => {
  if (!hours || isNaN(Number(hours))) {
    throw new Error("Valid overtime hours required.");
  }

  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || loggedUser.adminId;
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();
  const employeeName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";
  const dateStr = date || new Date().toISOString().slice(0, 10);

  const otDoc = await Overtime.create({
    adminId,
    companyId,
    employeeId,
    employeeName,
    date: dateStr,
    type,
    hours: Number(hours),
    reason: reason || "Overtime claim submitted via AI Copilot",
    fromTime: fromTime || "18:00",
    toTime: toTime || "20:00",
    status: "PENDING",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "New Overtime Request",
      message: `${employeeName} requested ${hours} hours Overtime for ${dateStr}.`,
      type: "overtime",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Overtime notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.to(`user_${adminId}`).emit("overtime:new", otDoc);
    io.emit("overtime:new", otDoc);
  }

  return otDoc;
};

/* =========================================================================
   8. SHARED SERVICE: REQUEST PUNCH OUT
========================================================================= */
export const serviceRequestPunchOut = async ({ loggedUser, originalDate, requestedPunchOut, reason, io = null }) => {
  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || loggedUser.adminId;
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();
  const employeeName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";
  const dateStr = originalDate || new Date().toISOString().slice(0, 10);

  const punchOutTime = requestedPunchOut ? new Date(requestedPunchOut) : new Date();

  const reqDoc = await PunchOutRequest.create({
    adminId,
    companyId,
    employeeId,
    employeeName,
    originalDate: dateStr,
    requestedPunchOut: punchOutTime,
    reason: reason || "Requested missing punch-out via AI Copilot",
    status: "Pending",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "New Punch Out Request",
      message: `${employeeName} requested punch-out correction for ${dateStr}.`,
      type: "attendance-correction-request",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ PunchOutRequest notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("punchout:new", reqDoc);
    io.emit("punchOutRequest:new", reqDoc);
    io.emit("attendance:correctionNew", reqDoc);
  }

  return reqDoc;
};

/* =========================================================================
   9. SHARED SERVICE: SUBMIT ISSUE / GRIEVANCE
========================================================================= */
export const serviceSubmitIssue = async ({ loggedUser, subject, message, io = null }) => {
  if (!subject || !message) {
    throw new Error("Issue subject and message are required.");
  }

  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || loggedUser.adminId;
  const raisedBy = loggedUser._id || loggedUser.id;
  const raisedByName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";
  const raisedByEmail = loggedUser.email || "";

  const issueDoc = await TechnicalIssue.create({
    adminId,
    companyId,
    subject,
    message,
    raisedBy,
    raisedByName,
    raisedByEmail,
    role: "employee",
    status: "pending",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "New Support Ticket Raised",
      message: `${raisedByName} reported an issue: ${subject}`,
      type: "issue",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ TechnicalIssue notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("issue:new", issueDoc);
  }

  return issueDoc;
};

/* =========================================================================
   10. SHARED SERVICE: SUBMIT RESIGNATION
========================================================================= */
export const serviceSubmitResignation = async ({ loggedUser, reason, resignationLetterHtml, io = null }) => {
  const adminId = loggedUser.adminId || loggedUser._id;
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();
  const employeeName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";
  const employeeEmail = loggedUser.email || "";

  const existing = await Resignation.findOne({
    employeeId,
    status: { $in: ["Pending", "Approved", "Exit Formalities"] },
  });

  if (existing) {
    throw new Error("You already have an active resignation request under review.");
  }

  const resDoc = await Resignation.create({
    adminId,
    employeeId,
    employeeName,
    employeeEmail,
    companyName: loggedUser.companyName || "Company",
    department: loggedUser.department || "General",
    designation: loggedUser.designation || "Employee",
    reason: reason || "Personal reasons",
    resignationLetterHtml: resignationLetterHtml || `<p>${reason || "I hereby tender my resignation."}</p>`,
    submittedAt: new Date(),
    status: "Pending",
  });

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId: loggedUser.company || loggedUser.companyId || adminId,
      userId: adminId,
      userType: "Admin",
      title: "New Resignation Request",
      message: `${employeeName} has submitted a resignation request.`,
      type: "resignation",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Resignation notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("resignation:new", resDoc);
  }

  return resDoc;
};

/* =========================================================================
   11. SHARED SERVICE: SUBMIT DAILY WORK UPDATE
========================================================================= */
export const serviceSubmitWorkUpdate = async ({ loggedUser, title, description, percentage = 100, date, io = null }) => {
  if (!description && !title) {
    throw new Error("Work update title or description is required.");
  }

  const adminId = loggedUser.adminId || loggedUser._id;
  const companyId = loggedUser.company || loggedUser.companyId || adminId;
  const employeeId = loggedUser._id || loggedUser.id;
  const employeeName = loggedUser.name || `${loggedUser.firstName || ""} ${loggedUser.lastName || ""}`.trim() || "Employee";

  const todayStr = date || new Date().toISOString().slice(0, 10);
  const dateObj = new Date(todayStr);

  let entry = await DailyWorkEntry.findOne({ employeeId, date: dateObj });

  const currentTimeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (!entry) {
    entry = await DailyWorkEntry.create({
      employeeId,
      date: dateObj,
      morning_title: title || "Daily Work Update",
      morning_description: description || title || "Work logged via AI Copilot",
      morning_time: currentTimeStr,
      evening_description: description || "",
      evening_time: currentTimeStr,
      employee_submitted_percentage: Number(percentage) || 100,
      status: "pending",
    });
  } else {
    entry.evening_description = description || entry.evening_description || title;
    entry.evening_time = currentTimeStr;
    if (percentage !== undefined && percentage !== null) entry.employee_submitted_percentage = Number(percentage);
    if (title && !entry.morning_title) entry.morning_title = title;
    await entry.save();
  }

  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId,
      userId: adminId,
      userType: "Admin",
      title: "Daily Work Update Submitted",
      message: `${employeeName} submitted daily work update for ${todayStr} (${percentage}% completed).`,
      type: "daily-work",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Daily work notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("work:new", entry);
    io.emit("work:updated", entry);
  }

  return entry;
};
