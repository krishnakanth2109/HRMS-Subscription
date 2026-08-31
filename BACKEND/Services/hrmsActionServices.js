import mongoose from "mongoose";
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
import Notice from "../models/Notice.js";
import Shift from "../models/shiftModel.js";
import Employee from "../models/employeeModel.js";
import FieldWorkTrip from "../models/FieldWorkTrip.js";
import Message from "../models/Message.js";
import AttendanceRequest from "../models/AttendanceRequest.js";
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
export const servicePunchIn = async ({ loggedUser, date, note = "", latitude = null, longitude = null, lateReason = "", io = null }) => {
  const todayStr = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const userId = loggedUser._id || loggedUser.id;
  const empIdStr = (loggedUser.employeeId || userId).toString();

  // 1. Fetch Shift Data for Late Check
  const shift = (await Shift.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
  }).lean()) || {
    shiftStartTime: "09:30",
    lateGracePeriod: 15,
    fullDayHours: 9,
    halfDayHours: 4.5,
  };

  let loginStatus = "ON_TIME";
  let lateByMinutes = 0;

  try {
    const [shiftHour, shiftMin] = (shift.shiftStartTime || "09:30").split(":").map(Number);
    const shiftDate = new Date(now);
    shiftDate.setHours(shiftHour, shiftMin, 0, 0);

    const graceMinutes = shift.lateGracePeriod || 15;
    const lateCutoff = new Date(shiftDate.getTime() + graceMinutes * 60000);

    if (now > lateCutoff) {
      loginStatus = "LATE";
      const diffMs = now.getTime() - shiftDate.getTime();
      lateByMinutes = Math.floor(diffMs / 60000);
    }
  } catch (calcError) {
    console.error("Time calculation error in servicePunchIn:", calcError);
  }

  let attDoc = await Attendance.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
  });

  if (!attDoc) {
    attDoc = await Attendance.create({
      adminId: loggedUser.adminId || userId,
      companyId: loggedUser.company || loggedUser.companyId || userId,
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
      punchInLocation: latitude && longitude ? { latitude, longitude } : undefined,
      status: "WORKING",
      loginStatus,
      lateByMinutes,
      lateReason: lateReason || (loginStatus === "LATE" ? "Late punch in via Copilot" : ""),
      workedStatus: "FULL_DAY",
      attendanceCategory: "FULL_DAY",
      sessions: [{ punchIn: now }],
    });
  } else {
    if (todayEntry.status === "WORKING" && todayEntry.punchIn && !todayEntry.punchOut) {
      throw new Error(`Already punched in for today (${todayStr}).`);
    }
    todayEntry.punchIn = now;
    todayEntry.punchOut = undefined;
    todayEntry.isFinalPunchOut = false;
    if (latitude && longitude) {
      todayEntry.punchInLocation = { latitude, longitude };
    }
    todayEntry.status = "WORKING";
    todayEntry.loginStatus = loginStatus;
    todayEntry.lateByMinutes = lateByMinutes;
    if (lateReason) todayEntry.lateReason = lateReason;
    if (!todayEntry.sessions) todayEntry.sessions = [];
    todayEntry.sessions.push({ punchIn: now });
  }

  await attDoc.save();

  if (io) {
    io.emit("attendance:punchIn", { employeeId: empIdStr, time: now });
    io.emit("attendance:update", { employeeId: empIdStr, time: now, date: todayStr });
    if (loginStatus === "LATE") {
      io.emit("admin-notification", {
        adminId: loggedUser.adminId,
        message: `⏰ ${loggedUser.name || "Employee"} punched in late (${lateByMinutes} mins) for ${todayStr}.`,
      });
    }
  }

  return { date: todayStr, punchIn: now, status: "WORKING", loginStatus, lateByMinutes };
};

/* =========================================================================
   5. SHARED SERVICE: PUNCH OUT
========================================================================= */
export const servicePunchOut = async ({ loggedUser, date, note = "", latitude = null, longitude = null, earlyLeaveReason = "", io = null }) => {
  const todayStr = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const userId = loggedUser._id || loggedUser.id;
  const empIdStr = (loggedUser.employeeId || userId).toString();

  const attDoc = await Attendance.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
  });

  const todayEntry = attDoc?.attendance?.find((a) => a.date === todayStr);

  if (!todayEntry || (!todayEntry.punchIn && todayEntry.status !== "WORKING")) {
    throw new Error("Cannot punch out without prior punch in today.");
  }

  if (todayEntry.status === "COMPLETED" && todayEntry.punchOut && todayEntry.isFinalPunchOut) {
    throw new Error(`Already punched out for today (${todayStr}).`);
  }

  todayEntry.punchOut = now;
  if (latitude && longitude) {
    todayEntry.punchOutLocation = { latitude, longitude };
  }
  todayEntry.status = "COMPLETED";
  todayEntry.isFinalPunchOut = true;
  if (earlyLeaveReason) todayEntry.earlyLeaveReason = earlyLeaveReason;

  // Calculate session duration
  if (todayEntry.sessions && todayEntry.sessions.length > 0) {
    const lastSession = todayEntry.sessions[todayEntry.sessions.length - 1];
    if (!lastSession.punchOut) {
      lastSession.punchOut = now;
      lastSession.durationSeconds = Math.floor((now.getTime() - new Date(lastSession.punchIn).getTime()) / 1000);
    }
  }

  // Calculate total worked hours
  const totalWorkedSeconds = (todayEntry.sessions || []).reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const workedHours = totalWorkedSeconds / 3600;
  const workedH = Math.floor(workedHours);
  const workedM = Math.floor((totalWorkedSeconds % 3600) / 60);
  const workedS = Math.floor(totalWorkedSeconds % 60);

  todayEntry.workedHours = workedH;
  todayEntry.workedMinutes = workedM;
  todayEntry.workedSeconds = workedS;
  todayEntry.displayTime = `${workedH}h ${workedM}m ${workedS}s`;

  // Fetch shift for completion check
  const shift = (await Shift.findOne({
    $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
  }).lean()) || { fullDayHours: 9, halfDayHours: 4.5 };

  if (workedHours >= (shift.fullDayHours || 9)) {
    todayEntry.workedStatus = "FULL_DAY";
    todayEntry.attendanceCategory = "FULL_DAY";
  } else if (workedHours >= (shift.halfDayHours || 4.5)) {
    todayEntry.workedStatus = "HALF_DAY";
    todayEntry.attendanceCategory = "HALF_DAY";
  } else if (workedHours >= (shift.quarterDayHours || 2)) {
    todayEntry.workedStatus = "QUARTER_DAY";
    todayEntry.attendanceCategory = "ABSENT";
  } else {
    todayEntry.workedStatus = "HALF_DAY";
    todayEntry.attendanceCategory = "HALF_DAY";
  }

  await attDoc.save();

  if (io) {
    io.emit("attendance:punchOut", { employeeId: empIdStr, time: now });
    io.emit("attendance:update", { employeeId: empIdStr, time: now, date: todayStr });
    io.emit("admin-notification", {
      adminId: loggedUser.adminId,
      message: `🚪 ${loggedUser.name || "Employee"} punched out at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${workedHours.toFixed(1)}h worked).`,
    });
  }

  return {
    date: todayStr,
    punchOut: now,
    status: "COMPLETED",
    workedStatus: todayEntry.workedStatus,
    workedHours: workedHours.toFixed(2),
  };
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

/* =========================================================================
   12. SHARED SERVICE: PUNCH BREAK (TOGGLE / START / END BREAK)
========================================================================= */
export const servicePunchBreak = async ({ loggedUser, breakType = "Lunch Break", io = null }) => {
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();

  let attendance = await Attendance.findOne({
    $or: [{ employeeId }, { employeeId: loggedUser._id?.toString() }],
  });

  if (!attendance) {
    throw new Error("No attendance record found for your employee profile.");
  }

  let todayRecord = attendance.attendance.find((a) => a.date === todayStr);
  if (!todayRecord || !todayRecord.punchIn) {
    throw new Error("You must punch in first before starting or resuming a break.");
  }

  const hasOpenBreak = todayRecord.isOnBreak || (todayRecord.breakSessions || []).some((b) => !b.to);

  // ── CASE 1: RESUME FROM BREAK ──────────────────────────────────────────────
  if (hasOpenBreak) {
    const activeBreak = (todayRecord.breakSessions || []).slice().reverse().find((b) => !b.to);
    if (activeBreak) {
      activeBreak.to = now;
      activeBreak.durationSeconds = Math.max(0, (new Date(now) - new Date(activeBreak.from)) / 1000);
    }

    const totalBreakSec = (todayRecord.breakSessions || []).reduce((acc, b) => acc + (b.durationSeconds || 0), 0);
    todayRecord.totalBreakSeconds = totalBreakSec;

    todayRecord.isOnBreak = false;
    todayRecord.status = "WORKING";
    todayRecord.isFinalPunchOut = false;
    todayRecord.punchOut = undefined;

    if (!todayRecord.sessions) todayRecord.sessions = [];
    const openSess = todayRecord.sessions.find((s) => !s.punchOut);
    if (!openSess) {
      todayRecord.sessions.push({ punchIn: now, punchOut: null, durationSeconds: 0 });
    }

    await attendance.save();

    if (io) {
      io.emit("attendance:update", { employeeId, date: todayStr, action: "break_end", status: "WORKING" });
    }

    return {
      status: "RESUMED_WORKING",
      message: "Resumed work from break successfully. Happy working!",
      displayTime: todayRecord.displayTime,
    };
  }

  // ── CASE 2: START BREAK ───────────────────────────────────────────────────
  const currentSession = (todayRecord.sessions || []).find((s) => !s.punchOut);
  if (currentSession) {
    currentSession.punchOut = now;
    currentSession.durationSeconds = Math.max(0, (new Date(now) - new Date(currentSession.punchIn)) / 1000);
  }

  todayRecord.punchOut = now;
  todayRecord.status = "COMPLETED";
  todayRecord.isFinalPunchOut = false;
  todayRecord.isOnBreak = true;

  if (!todayRecord.breakSessions) todayRecord.breakSessions = [];
  todayRecord.breakSessions.push({ from: now, to: null, durationSeconds: 0 });

  let totalSeconds = 0;
  todayRecord.sessions.forEach((sess) => {
    if (sess.punchIn && sess.punchOut) {
      totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
    }
  });

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  todayRecord.workedHours = h;
  todayRecord.workedMinutes = m;
  todayRecord.workedSeconds = s;
  todayRecord.displayTime = `${h}h ${m}m ${s}s`;

  await attendance.save();

  if (io) {
    io.emit("attendance:update", { employeeId, date: todayStr, action: "break_start", status: "ON_BREAK" });
  }

  return {
    status: "ON_BREAK",
    message: `Break started successfully (${breakType}). Total worked so far: ${h}h ${m}m.`,
    displayTime: todayRecord.displayTime,
  };
};

/* =========================================================================
   13. SHARED SERVICE: SUBMIT LATE ARRIVAL CORRECTION
========================================================================= */
export const serviceSubmitLateCorrection = async ({ loggedUser, date, reason, requestedTime, io = null }) => {
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const timeStr = requestedTime || new Date().toISOString();

  let attendance = await Attendance.findOne({
    $or: [{ employeeId }, { employeeId: loggedUser._id?.toString() }],
  });

  if (!attendance) {
    throw new Error("Attendance record not found.");
  }

  let dayLog = attendance.attendance.find((a) => a.date === dateStr);
  if (!dayLog) {
    throw new Error(`No attendance record found for date ${dateStr}.`);
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthData = attendance.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

  if (monthData.used >= monthData.limit) {
    throw new Error("Monthly late correction request limit reached (max 5 per month).");
  }

  dayLog.lateCorrectionRequest = {
    hasRequest: true,
    status: "PENDING",
    requestedTime: new Date(timeStr),
    reason: reason || "Late arrival justification",
  };

  attendance.monthlyRequestLimits.set(currentMonth, { limit: monthData.limit, used: monthData.used + 1 });
  await attendance.save();

  const adminId = loggedUser.adminId || loggedUser._id;
  let notif = null;
  try {
    notif = await Notification.create({
      adminId,
      companyId: loggedUser.company || loggedUser.companyId || adminId,
      userId: adminId,
      userType: "Admin",
      title: "New Late Arrival Correction Request",
      message: `${loggedUser.name || "Employee"} submitted a late arrival justification for ${dateStr}.`,
      type: "attendance",
      isRead: false,
    });
  } catch (notifErr) {
    console.warn("⚠️ Late correction notification skipped:", notifErr.message);
  }

  if (io) {
    if (notif) {
      io.to(`admin_${adminId}`).emit("newNotification", notif);
      io.to(`user_${adminId}`).emit("newNotification", notif);
      io.emit("admin-notification", notif);
    }
    io.emit("attendance:lateNew", { employeeId, date: dateStr, message: `Late correction request from ${loggedUser.name}` });
  }

  return dayLog;
};

/* =========================================================================
   14. SHARED SERVICE: UPDATE WFH REQUEST
========================================================================= */
export const serviceUpdateWFH = async ({ loggedUser, requestId, fromDate, toDate, requestedMode = "WFH", reason, io = null }) => {
  const employeeId = (loggedUser.employeeId || loggedUser._id).toString();

  let targetReq = null;
  if (requestId) {
    targetReq = await WorkModeRequest.findById(requestId);
  } else {
    targetReq = await WorkModeRequest.findOne({
      $or: [{ employeeId }, { employeeId: loggedUser._id?.toString() }],
      status: "Pending",
    }).sort({ createdAt: -1 });
  }

  if (!targetReq) {
    throw new Error("No pending WFH/remote request found to update.");
  }

  if (fromDate) targetReq.fromDate = new Date(fromDate);
  if (toDate) targetReq.toDate = new Date(toDate);
  if (requestedMode) targetReq.requestedMode = requestedMode;
  if (reason) targetReq.reason = reason;

  await targetReq.save();

  const adminId = loggedUser.adminId || loggedUser._id;
  if (io) {
    io.emit("wfh:updated", targetReq);
  }

  return targetReq;
};

/* =========================================================================
   15. SHARED SERVICE: REPLY TO NOTICE
========================================================================= */
export const serviceReplyNotice = async ({ loggedUser, noticeId, message, io = null }) => {
  if (!noticeId) throw new Error("Notice ID is required.");
  if (!message) throw new Error("Reply message cannot be empty.");

  const notice = await Notice.findById(noticeId);
  if (!notice) throw new Error("Notice not found.");

  const replyObj = {
    employeeId: loggedUser._id,
    message: message.trim(),
    sentBy: "Employee",
    repliedAt: new Date(),
  };

  notice.replies.push(replyObj);
  await notice.save();

  if (io) {
    io.emit("notice:reply", { noticeId, reply: replyObj });
  }

  return replyObj;
};

/* =========================================================================
   16. SHARED SERVICE: UPDATE EMPLOYEE PROFILE DETAILS
========================================================================= */
export const serviceUpdateProfile = async ({ loggedUser, field, value, updates = {}, io = null }) => {
  const userId = loggedUser._id || loggedUser.id;
  const emp = await Employee.findById(userId);
  if (!emp) throw new Error("Employee profile record not found.");

  const updateFields = { ...updates };
  if (field && value !== undefined) {
    updateFields[field] = value;
  }

  const mongoSet = {};

  if (updateFields.name || updateFields.firstName) {
    const newName = (updateFields.name || updateFields.firstName).trim();
    mongoSet.name = newName;
    mongoSet.firstName = newName.split(" ")[0];
    if (newName.split(" ").length > 1) {
      mongoSet.lastName = newName.split(" ").slice(1).join(" ");
    }
  }
  if (updateFields.lastName) {
    mongoSet.lastName = updateFields.lastName.trim();
    if (emp.firstName) {
      mongoSet.name = `${emp.firstName} ${updateFields.lastName.trim()}`.trim();
    }
  }

  if (updateFields.email) {
    mongoSet.email = updateFields.email.trim();
  }
  if (updateFields.bloodGroup) {
    mongoSet["personalDetails.bloodGroup"] = updateFields.bloodGroup.trim();
    mongoSet["personal.bloodGroup"] = updateFields.bloodGroup.trim();
  }
  if (updateFields.qualification) {
    mongoSet["personalDetails.qualification"] = updateFields.qualification.trim();
    mongoSet["personal.qualification"] = updateFields.qualification.trim();
  }
  if (updateFields.gender) {
    const validGenders = ["Male", "Female", "Prefer not to say"];
    const normalizedGender = validGenders.find((g) => g.toLowerCase() === String(updateFields.gender).toLowerCase()) || updateFields.gender;
    mongoSet["personalDetails.gender"] = normalizedGender;
    mongoSet["personal.gender"] = normalizedGender;
  }
  if (updateFields.phone || updateFields.mobile) {
    mongoSet.phone = updateFields.phone || updateFields.mobile;
  }
  if (updateFields.address) {
    mongoSet.address = updateFields.address;
  }
  if (updateFields.dob) {
    mongoSet["personalDetails.dob"] = updateFields.dob;
    mongoSet["personal.dob"] = updateFields.dob;
  }
  if (updateFields.maritalStatus) {
    mongoSet["personalDetails.maritalStatus"] = updateFields.maritalStatus;
    mongoSet["personal.maritalStatus"] = updateFields.maritalStatus;
  }
  if (updateFields.emergencyContact || updateFields.emergencyPhone || updateFields.emergency) {
    mongoSet.emergency = updateFields.emergencyContact || updateFields.emergencyPhone || updateFields.emergency;
    mongoSet.emergencyContact = updateFields.emergencyContact || updateFields.emergencyPhone || updateFields.emergency;
  }
  if (updateFields.aadhaarNumber || updateFields.aadharNumber || updateFields.aadhaar || updateFields.aadhar) {
    const aadharVal = String(updateFields.aadhaarNumber || updateFields.aadharNumber || updateFields.aadhaar || updateFields.aadhar).trim();
    mongoSet["personalDetails.aadhaarNumber"] = aadharVal;
    mongoSet["personal.aadhaarNumber"] = aadharVal;
  }
  if (updateFields.panNumber || updateFields.pan) {
    const panVal = String(updateFields.panNumber || updateFields.pan).trim().toUpperCase();
    mongoSet["personalDetails.panNumber"] = panVal;
    mongoSet["personal.panNumber"] = panVal;
  }
  if (updateFields.nationality) {
    mongoSet["personalDetails.nationality"] = updateFields.nationality.trim();
    mongoSet["personal.nationality"] = updateFields.nationality.trim();
  }
  if (updateFields.accountNumber || updateFields.bankAccount || updateFields.account) {
    const accVal = String(updateFields.accountNumber || updateFields.bankAccount || updateFields.account).trim();
    mongoSet["bankDetails.accountNumber"] = accVal;
    mongoSet["bank.accountNumber"] = accVal;
  }
  if (updateFields.bankName) {
    mongoSet["bankDetails.bankName"] = updateFields.bankName.trim();
    mongoSet["bank.bankName"] = updateFields.bankName.trim();
  }
  if (updateFields.ifsc || updateFields.ifscCode) {
    const ifscVal = String(updateFields.ifsc || updateFields.ifscCode).trim().toUpperCase();
    mongoSet["bankDetails.ifsc"] = ifscVal;
    mongoSet["bank.ifsc"] = ifscVal;
  }
  if (updateFields.branch) {
    mongoSet["bankDetails.branch"] = updateFields.branch.trim();
    mongoSet["bank.branch"] = updateFields.branch.trim();
  }
  if (updateFields.bio) {
    mongoSet.bio = updateFields.bio.trim();
  }
  if (updateFields.linkedin) mongoSet["socialLinks.linkedin"] = updateFields.linkedin.trim();
  if (updateFields.github) mongoSet["socialLinks.github"] = updateFields.github.trim();
  if (updateFields.instagram) mongoSet["socialLinks.instagram"] = updateFields.instagram.trim();
  if (updateFields.website) mongoSet["socialLinks.website"] = updateFields.website.trim();

  const updatedEmp = await Employee.findByIdAndUpdate(
    userId,
    { $set: mongoSet },
    { new: true, runValidators: false }
  ).select("-password").lean();

  if (io) {
    io.emit("employee:updated", {
      employeeId: updatedEmp.employeeId,
      updatedFields: Object.keys(updateFields),
      employee: updatedEmp,
    });
    io.emit("admin-notification", {
      adminId: updatedEmp.adminId,
      message: `${updatedEmp.name} updated their profile details (${Object.keys(updateFields).join(", ")}).`,
    });
  }

  return updatedEmp;
};

/* =========================================================================
   17. SHARED SERVICE: CANCEL PENDING WFH REQUEST
========================================================================= */
export const serviceCancelWFH = async ({ loggedUser, requestId, io = null }) => {
  const employeeId = loggedUser.employeeId || loggedUser._id?.toString();
  let targetReq = null;

  if (requestId) {
    targetReq = await WorkModeRequest.findById(requestId);
  } else {
    targetReq = await WorkModeRequest.findOne({
      $or: [{ employeeId }, { employeeId: loggedUser._id?.toString() }],
      status: "Pending",
    }).sort({ createdAt: -1 });
  }

  if (!targetReq) {
    throw new Error("No pending WFH request found to cancel.");
  }

  await WorkModeRequest.findByIdAndDelete(targetReq._id);

  if (io) {
    io.emit("wfh:deleted", { id: targetReq._id });
  }

  return targetReq;
};

/* =========================================================================
   18. SHARED SERVICE: CANCEL PENDING EXPENSE CLAIM
========================================================================= */
export const serviceCancelExpense = async ({ loggedUser, expenseId, io = null }) => {
  const userId = loggedUser._id || loggedUser.id;
  let targetExpense = null;

  if (expenseId) {
    targetExpense = await Expense.findById(expenseId);
  } else {
    const queryOr = [{ employeeId: userId }];
    if (mongoose.Types.ObjectId.isValid(loggedUser.employeeId)) {
      queryOr.push({ employeeId: loggedUser.employeeId });
    }
    targetExpense = await Expense.findOne({
      $or: queryOr,
      status: "Pending",
    }).sort({ createdAt: -1 });
  }

  if (!targetExpense) {
    throw new Error("No pending expense claim found to cancel.");
  }

  await Expense.findByIdAndDelete(targetExpense._id);

  if (io) {
    io.emit("expense:deleted", { id: targetExpense._id });
  }

  return targetExpense;
};

/* =========================================================================
   19. SHARED SERVICE: CANCEL PENDING OVERTIME CLAIM
========================================================================= */
export const serviceCancelOvertime = async ({ loggedUser, overtimeId, io = null }) => {
  const userId = loggedUser._id || loggedUser.id;
  const empIdStr = (loggedUser.employeeId || userId).toString();

  let targetOT = null;
  if (overtimeId) {
    targetOT = await Overtime.findById(overtimeId);
  } else {
    targetOT = await Overtime.findOne({
      $or: [{ employeeId: empIdStr }, { employeeId: userId.toString() }],
      status: "PENDING",
    }).sort({ createdAt: -1 });
  }

  if (!targetOT) {
    throw new Error("No active pending overtime claim found to cancel.");
  }

  const cancelledDetails = {
    hours: targetOT.hours,
    date: targetOT.date,
    reason: targetOT.reason,
  };

  await Overtime.findByIdAndDelete(targetOT._id);

  if (io) {
    io.emit("overtime:deleted", { id: targetOT._id });
    io.emit("admin-notification", {
      adminId: targetOT.adminId,
      message: `${loggedUser.name || "Employee"} cancelled their ${cancelledDetails.hours}h overtime claim for ${cancelledDetails.date}.`,
    });
  }

  return cancelledDetails;
};

/* =========================================================================
   20. SHARED SERVICE: START FIELD WORK TRIP
========================================================================= */
export const serviceStartFieldWork = async ({ loggedUser, io = null }) => {
  const userId = loggedUser._id || loggedUser.id;
  const adminId = loggedUser.adminId;
  const companyId = loggedUser.company || loggedUser.companyId;

  // Check if an active trip already exists
  const existingActive = await FieldWorkTrip.findOne({
    employee: userId,
    status: "active",
  }).lean();

  if (existingActive) {
    return {
      tripId: existingActive._id,
      startedAt: existingActive.startedAt,
      isResumed: true,
      message: `Active field trip from ${new Date(existingActive.startedAt).toLocaleTimeString()} is already running.`,
    };
  }

  const newTrip = await FieldWorkTrip.create({
    adminId,
    companyId,
    employee: userId,
    employeeId: loggedUser.employeeId || userId.toString(),
    employeeName: loggedUser.name || "Employee",
    status: "active",
    startedAt: new Date(),
    path: [],
    stops: [],
    breaks: [],
  });

  if (io) {
    io.emit("fieldTracking:tripStarted", { trip: newTrip });
    io.emit("admin-notification", {
      adminId,
      message: `📍 ${loggedUser.name || "Employee"} started a field work trip.`,
    });
  }

  return {
    tripId: newTrip._id,
    startedAt: newTrip.startedAt,
    isResumed: false,
    message: "Field work trip successfully started and live tracking initialized.",
  };
};

/* =========================================================================
   21. SHARED SERVICE: END FIELD WORK TRIP
========================================================================= */
export const serviceEndFieldWork = async ({ loggedUser, tripId = null, io = null }) => {
  const userId = loggedUser._id || loggedUser.id;

  const query = { employee: userId, status: "active" };
  if (tripId) query._id = tripId;

  const activeTrip = await FieldWorkTrip.findOne(query).sort({ startedAt: -1 });
  if (!activeTrip) {
    throw new Error("No active field work trip found to stop.");
  }

  const endedAt = new Date();
  const durationMs = endedAt - new Date(activeTrip.startedAt);
  const durationMins = Math.round(durationMs / 60000);

  activeTrip.status = "completed";
  activeTrip.endedAt = endedAt;
  await activeTrip.save();

  if (io) {
    io.emit("fieldTracking:tripStopped", { tripId: activeTrip._id, employeeId: loggedUser.employeeId });
    io.emit("admin-notification", {
      adminId: activeTrip.adminId,
      message: `🏁 ${loggedUser.name || "Employee"} ended their field trip (${durationMins} mins).`,
    });
  }

  return {
    tripId: activeTrip._id,
    startedAt: activeTrip.startedAt,
    endedAt,
    durationMins,
    distanceKm: activeTrip.distanceKm || 0,
  };
};

/* =========================================================================
   22. SHARED SERVICE: SEND DIRECT MESSAGE / CONNECT
========================================================================= */
export const serviceSendMessage = async ({ loggedUser, receiverName, receiverId = null, messageText, io = null }) => {
  const senderId = loggedUser._id || loggedUser.id;
  const adminId = loggedUser.adminId;
  const companyId = loggedUser.company || loggedUser.companyId;

  let targetReceiver = null;
  if (receiverId) {
    targetReceiver = await Employee.findById(receiverId).lean();
  } else if (receiverName) {
    const rx = new RegExp(receiverName.trim(), "i");
    targetReceiver = await Employee.findOne({
      $or: [{ name: rx }, { email: rx }],
      _id: { $ne: senderId },
      $or: [{ adminId }, { company: companyId }],
    }).lean();
  }

  if (!targetReceiver) {
    throw new Error(`Colleague "${receiverName || "receiver"}" not found in your company directory.`);
  }

  const newMsg = await Message.create({
    adminId,
    companyId,
    sender: senderId,
    receiver: targetReceiver._id,
    message: messageText.trim(),
    isRead: false,
  });

  if (io) {
    io.to(targetReceiver._id.toString()).emit("newMessage", newMsg);
    io.emit("message:received", { receiverId: targetReceiver._id, senderId });
  }

  return {
    messageId: newMsg._id,
    receiverName: targetReceiver.name,
    receiverEmail: targetReceiver.email,
    sentAt: newMsg.createdAt,
    text: newMsg.message,
  };
};

/* ===============================================================
   22. REQUEST ON-TIME LOGIN / ATTENDANCE CORRECTION
=============================================================== */
export const serviceRequestOnTimeLogin = async ({
  loggedUser,
  date = new Date().toISOString().slice(0, 10),
  reason = "Late login correction requested via AI Copilot",
  requestedPunchIn = "09:30",
  io = null,
}) => {
  const employeeId = loggedUser.employeeId || loggedUser.id || loggedUser._id;
  const attendanceRecord = await Attendance.findOne({ employeeId });
  if (!attendanceRecord) {
    throw new Error("Attendance record not found for your account.");
  }

  const dayLog = attendanceRecord.attendance.find((a) => a.date === date);
  const currentPunchIn = dayLog?.punchIn ? new Date(dayLog.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "";

  // Check if a pending request already exists for this date
  const existing = await AttendanceRequest.findOne({
    employeeId,
    date,
    requestStatus: 'pending',
  });
  if (existing) {
    throw new Error(`An attendance correction request for ${date} is already pending admin review.`);
  }

  const newRequest = await AttendanceRequest.create({
    employeeId,
    adminId: attendanceRecord.adminId,
    companyId: attendanceRecord.companyId,
    employeeName: attendanceRecord.employeeName || loggedUser.name,
    date,
    currentStatus: dayLog?.status || "LATE",
    requestedStatus: "ON_TIME",
    currentPunchIn: currentPunchIn || "Late",
    requestedPunchIn: requestedPunchIn || "09:30",
    reason: reason.trim(),
    requestStatus: "pending",
  });

  if (attendanceRecord.adminId) {
    const notif = await Notification.create({
      adminId: attendanceRecord.adminId,
      companyId: attendanceRecord.companyId,
      userId: attendanceRecord.adminId,
      userType: "Admin",
      title: "New Attendance Correction Request",
      message: `${attendanceRecord.employeeName || loggedUser.name} requested on-time login correction for ${date} (${reason})`,
      type: "attendance-correction-request",
      date: new Date(),
    });
    if (io) {
      io.to(`user_${attendanceRecord.adminId.toString()}`).emit("newNotification", notif);
      io.to(`user_${attendanceRecord.adminId.toString()}`).emit("attendance:correctionNew", { employeeId, date });
      io.emit("hrmsAttendanceUpdated");
    }
  }

  return {
    success: true,
    message: `On-time login request submitted for ${date}. Admin has been notified for approval.`,
    request: newRequest,
  };
};



