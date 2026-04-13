// --- START OF FILE controllers/leaveController.js ---

import LeaveRequest, { LeavePolicy } from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
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

/* ===============================================================
   HELPER: List all dates between from and to inclusive
=============================================================== */
function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to   = new Date(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ===============================================================
   HELPER: Count leave days (Full Day = 1, Half Day = 0.5)
=============================================================== */
function countLeaveDays(dates, leaveDayType) {
  return dates.length * (leaveDayType === "Half Day" ? 0.5 : 1);
}

/* ===============================================================
   ✅ FIX: HELPER: Get Current Annual Reset Cycle Start Date
=============================================================== */
function getCycleStartDateStr(resetMonthStr) {
  const now = new Date();
  let currentYear = now.getFullYear();
  const rMonth = parseInt(resetMonthStr || "1", 10);
  
  // If the current month is BEFORE the reset month, we are in the previous year's cycle
  if (now.getMonth() + 1 < rMonth) {
    currentYear--;
  }
  return `${currentYear}-${String(rMonth).padStart(2, "0")}-01`;
}

/* ===============================================================
   ✅ FIX: HELPER: Dynamically calculate Used Paid Days per Employee
   This completely isolates balances per employee and removes 
   the bug where one employee's leave decreases everyone's balance!
=============================================================== */
async function getUsedPaidDaysForEmployee(employeeId, leaveType, cycleStartDateStr) {
  if (!employeeId) return 0;
  
  // Find all Pending and Approved leaves for this employee
  const leaves = await LeaveRequest.find({
    employeeId,
    status: { $in: ["Pending", "Approved"] },
  }).lean();

  let used = 0;
  const targetType = leaveType.trim().toLowerCase();

  for (const leave of leaves) {
    if (leave.leaveType && leave.leaveType.trim().toLowerCase() === targetType) {
      for (const detail of leave.details || []) {
        // Count Paid days that happen on or after the current annual cycle start date
        if (detail.leavecategory === "Paid" && detail.date >= cycleStartDateStr) {
          used += (detail.leaveDayType === "Half Day" ? 0.5 : 1);
        }
      }
    }
  }
  return used;
}

/* ===============================================================
   ✅ NEW: HELPER: Get carried-forward days for a specific employee
   for a specific leave type in the current cycle.
   
   Carry-forward is stored per-policy at the admin level, but each
   employee gets their own personal carry-forward calculated as:
     unusedDaysFromPrevCycle = paidDaysLimit - usedPaidDaysInPrevCycle
   
   We store the carry-forward snapshot per employee in LeavePolicy
   using a sub-document (carriedForwardDays).
   
   For a truly per-employee carry-forward, we compute it dynamically
   from the previous cycle's usage when the cycle resets.
=============================================================== */
async function getCarriedForwardDays(adminId, employeeId, leaveType, policyDoc) {
  if (!policyDoc?.carryForwardEnabled) return 0;

  const policy = policyDoc.policies.find(
    (p) => p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
  );
  if (!policy) return 0;

  // carriedForwardDays on the policy is the global carry-forward set during last reset.
  // We use the per-employee prev-cycle calculation:
  //   Previous cycle start = one year before current cycle start
  const rMonth = parseInt(policyDoc.resetMonth || "1", 10);
  const now = new Date();
  let currentCycleYear = now.getFullYear();
  if (now.getMonth() + 1 < rMonth) currentCycleYear--;

  const prevCycleStart = `${currentCycleYear - 1}-${String(rMonth).padStart(2, "0")}-01`;
  const prevCycleEnd   = `${currentCycleYear}-${String(rMonth).padStart(2, "0")}-01`;

  // Count how many paid days this employee used in the PREVIOUS cycle
  const leaves = await LeaveRequest.find({
    employeeId,
    status: { $in: ["Approved"] },
  }).lean();

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

/* ===============================================================
   HELPER: Resolve paid/unpaid split for a new leave request
   ✅ UPDATED: Now considers carry-forward balance when enabled
=============================================================== */
async function resolveLeaveCategoryForRequest(adminId, employeeId, leaveType, leaveDayType, dates) {
  const totalDays = countLeaveDays(dates, leaveDayType);
  const policyDoc = await LeavePolicy.findOne({ adminId });
  if (!policyDoc) return { leavecategory: "UnPaid", paidDays: 0, unpaidDays: totalDays };

  const policy = policyDoc.policies.find(
    (p) => p.leaveType.trim().toLowerCase() === leaveType.trim().toLowerCase()
  );
  if (!policy || policy.paidDaysLimit === 0) {
    return { leavecategory: "UnPaid", paidDays: 0, unpaidDays: totalDays };
  }

  // ✅ Get accurate personal balance dynamically
  const cycleStart = getCycleStartDateStr(policyDoc.resetMonth);
  const personalUsedPaidDays = await getUsedPaidDaysForEmployee(employeeId, leaveType, cycleStart);

  // ✅ NEW: Add carry-forward days to effective limit when feature is ON
  let effectiveLimit = policy.paidDaysLimit;
  if (policyDoc.carryForwardEnabled) {
    const carriedDays = await getCarriedForwardDays(adminId, employeeId, leaveType, policyDoc);
    effectiveLimit = policy.paidDaysLimit + carriedDays;
  }

  const remaining = Math.max(0, effectiveLimit - personalUsedPaidDays);
  if (remaining >= totalDays)  return { leavecategory: "Paid",   paidDays: totalDays,  unpaidDays: 0 };
  if (remaining > 0)           return { leavecategory: "Paid",   paidDays: remaining,  unpaidDays: totalDays - remaining };
  return                              { leavecategory: "UnPaid", paidDays: 0,           unpaidDays: totalDays };
}

/* ===============================================================
   HELPER: Build per-day details with Paid/UnPaid per day
=============================================================== */
function buildDetailsWithCategory(dates, leaveType, leaveDayType, paidDaysAllowed) {
  let paidUsed = 0;
  return dates.map((date) => {
    const dayValue = leaveDayType === "Half Day" ? 0.5 : 1;
    const cat      = paidUsed < paidDaysAllowed ? "Paid" : "UnPaid";
    if (cat === "Paid") paidUsed += dayValue;
    return { date, leavecategory: cat, leaveType, leaveDayType };
  });
}

/* ===============================================================
   EMAIL TEMPLATES (Admin & Employee)
=============================================================== */
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

const employeeLeaveStatusEmail = ({ employeeName, status, from, to, leaveType, reason, approvedBy }) => {
  const statusColor    = status === "Approved" ? "#10b981" : "#ef4444";
  const headerGradient = status === "Approved" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#b91c1c,#ef4444)";
  return `
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">
        <tr><td style="background:${headerGradient};padding:35px 30px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">Leave Request ${status}</h1>
        </td></tr>
        <tr><td style="padding:35px 30px;">
          <p style="margin:0 0 18px;font-size:16px;color:#1f2937;">Dear <strong>${employeeName}</strong>,</p>
          <p style="margin:0 0 25px;font-size:15px;color:#4b5563;line-height:1.7;">Your leave request has been processed:</p>
          <table width="100%" style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:25px;">
            <tr><td>
              <table width="100%" style="font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:10px 0;color:#6b7280;">Status</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:${statusColor};">${status.toUpperCase()}</td></tr>
                <tr><td style="padding:10px 0;color:#6b7280;">Leave Type</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">${leaveType}</td></tr>
                <tr><td style="padding:10px 0;color:#6b7280;">Duration</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ===================================================================================
// EMPLOYEE — APPLY FOR LEAVE
// ===================================================================================
export const createLeave = async (req, res) => {
  try {
    const loggedUser = req.user;
    const { from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);
    const dates    = listDates(from, to);

    const { leavecategory, paidDays } = await resolveLeaveCategoryForRequest(
      loggedUser.adminId, 
      loggedUser.employeeId, // ✅ Pass employee ID to fetch personal balance
      leaveType, 
      leaveDayType, 
      dates
    );
    const details = buildDetailsWithCategory(dates, leaveType, leaveDayType, paidDays);

    const doc = await LeaveRequest.create({
      adminId:        loggedUser.adminId,
      companyId:      loggedUser.companyId || loggedUser.company || loggedUser.adminId,
      employeeId:     loggedUser.employeeId || null,
      from, to, reason,
      leaveType,
      leaveDayType, halfDaySession,
      leavecategory,
      monthKey,
      status: "Pending", approvedBy: "-", actionDate: "-",
      requestDate: new Date().toISOString().slice(0, 10),
      details,
    });

    const admin = await Admin.findById(loggedUser.adminId).lean();
    if (admin) {
      if (admin.email) {
        try {
          await transporter.sendMail({
            from:    `"HRMS Leave Notification" <${process.env.SMTP_USER}>`,
            to:      admin.email,
            subject: `New Leave Request from ${loggedUser.name}`,
            html:    adminLeaveNotificationEmail({
              name: loggedUser.name, employeeId: loggedUser.employeeId,
              email: loggedUser.email, leaveType, from, to, reason,
            }),
          });
        } catch (e) { console.error("❌ Leave email to admin failed:", e); }
      }
      const notif = await Notification.create({
        adminId: admin._id, companyId: doc.companyId,
        userId: admin._id.toString(), userType: "Admin",
        title: "New Leave Request",
        message: `${loggedUser.name} submitted a leave request (${from} → ${to})`,
        type: "leave", isRead: false,
      });
      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);
    }

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave request." });
  }
};

// ===================================================================================
// EMPLOYEE — MY LEAVES
// ===================================================================================
export const listLeavesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { month, status } = req.query;
    const query = { employeeId };
    if (month) query.monthKey = month;
    if (status && status !== "All") query.status = status;
    const docs = await LeaveRequest.find(query).sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("listLeavesForEmployee error:", err);
    res.status(500).json({ message: "Failed to fetch your leave requests." });
  }
};

// ===================================================================================
// ADMIN — ALL LEAVES
// ===================================================================================
export const adminListAllLeaves = async (req, res) => {
  try {
    const docs = await LeaveRequest.find({ adminId: req.user._id }).sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListAllLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ===================================================================================
// GET PER-DAY DETAILS
// ===================================================================================
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    const isAdmin = req.user.role === "admin";
    if (isAdmin) {
      if (doc.adminId && doc.adminId.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Unauthorized" });
    } else {
      if (doc.employeeId !== req.user.employeeId)
        return res.status(403).json({ message: "Unauthorized" });
    }
    res.json(doc.details || []);
  } catch (err) {
    console.error("getLeaveDetails error:", err);
    res.status(500).json({ message: "Failed to fetch leave details." });
  }
};

// ===================================================================================
// ADMIN — APPROVE / REJECT 
// ===================================================================================
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name;

    if (!["Approved", "Rejected", "Cancelled"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    // ✅ FIX: We no longer modify `LeavePolicy` databases manually here!
    // The balance is calculated fully dynamically on the fly based on the request's status!
    const doc = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { status, approvedBy, actionDate: new Date().toISOString().slice(0, 10) },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave request not found or unauthorized" });

    const employee = await Employee.findOne({ employeeId: doc.employeeId });
    if (employee) {
      const notif = await Notification.create({
        adminId: req.user._id, companyId: doc.companyId,
        userId: employee._id, userType: "Employee",
        title: "Leave Status Update",
        message: `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
        type: "leave-status", isRead: false,
      });
      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);

      if (employee.email) {
        try {
          await transporter.sendMail({
            from:    `"Leave Management" <${process.env.SMTP_USER}>`,
            to:      employee.email,
            subject: `Leave Request ${status}: ${doc.from} – ${doc.to}`,
            html:    employeeLeaveStatusEmail({
              employeeName: employee.name, status,
              from: doc.from, to: doc.to,
              leaveType: doc.leaveType, reason: doc.reason, approvedBy,
            }),
          });
        } catch (e) { console.error("❌ Leave status email to employee failed:", e); }
      }
    }

    return res.json(doc);
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
};

// ===================================================================================
// EMPLOYEE — CANCEL OWN PENDING LEAVE
// ===================================================================================
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });
    if (leave.employeeId !== req.user.employeeId) return res.status(403).json({ message: "Unauthorized" });
    if (leave.status !== "Pending") return res.status(400).json({ message: "Cannot cancel this leave" });

    await LeaveRequest.findByIdAndDelete(req.params.id);

    const admin = await Admin.findById(leave.adminId);
    if (admin) {
      const notif = await Notification.create({
        adminId: admin._id, companyId: leave.companyId,
        userId: admin._id.toString(), userType: "Admin",
        title: "Leave Cancelled",
        message: `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
        type: "leave", isRead: false,
      });
      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);
    }

    return res.json({ message: "Leave cancelled successfully" });
  } catch (err) {
    console.error("cancelLeave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===================================================================================
   ADMIN: GET LEAVE POLICY
=================================================================================== */
export const getLeavePolicyForAdmin = async (req, res) => {
  try {
    const policyDoc = await LeavePolicy.findOne({ adminId: req.user._id }).lean();
    return res.json(
      policyDoc || {
        policies: [],
        resetMonth: "01",
        sandwichLeaveEnabled:  false,
        unplannedAbsenceToLOP: false,
        carryForwardEnabled:   false, // ✅ NEW
      }
    );
  } catch (err) {
    console.error("getLeavePolicyForAdmin error:", err);
    res.status(500).json({ message: "Failed to fetch leave policy." });
  }
};

/* ===================================================================================
   ADMIN: UPSERT LEAVE POLICY  (create or update)
   Body: {
     policies: [{ leaveType, paidDaysLimit }],
     resetMonth: "01",
     sandwichLeaveEnabled:  true|false,
     unplannedAbsenceToLOP: true|false,
     carryForwardEnabled:   true|false,   // ✅ NEW
   }
=================================================================================== */
export const upsertLeavePolicy = async (req, res) => {
  try {
    const {
      policies,
      resetMonth,
      sandwichLeaveEnabled,
      unplannedAbsenceToLOP,
      carryForwardEnabled,   // ✅ NEW
    } = req.body;

    if (!Array.isArray(policies) || policies.length === 0)
      return res.status(400).json({ message: "policies array is required." });

    for (const p of policies) {
      if (!p.leaveType || typeof p.leaveType !== "string" || !p.leaveType.trim())
        return res.status(400).json({ message: "Each policy entry must have a non-empty leaveType." });
      if (typeof p.paidDaysLimit !== "number" || p.paidDaysLimit < 0)
        return res.status(400).json({ message: `paidDaysLimit must be ≥ 0 for "${p.leaveType}".` });
    }

    const deduped = [];
    const seen = new Set();
    for (const p of [...policies].reverse()) {
      const key = p.leaveType.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); deduped.unshift(p); }
    }

    let existing = await LeavePolicy.findOne({ adminId: req.user._id });

    if (!existing) {
      existing = await LeavePolicy.create({
        adminId:               req.user._id,
        companyId:             req.user.companyId || req.user.company || req.user._id,
        resetMonth:            resetMonth || "01",
        sandwichLeaveEnabled:  typeof sandwichLeaveEnabled  === "boolean" ? sandwichLeaveEnabled  : false,
        unplannedAbsenceToLOP: typeof unplannedAbsenceToLOP === "boolean" ? unplannedAbsenceToLOP : false,
        carryForwardEnabled:   typeof carryForwardEnabled   === "boolean" ? carryForwardEnabled   : false, // ✅ NEW
        policies: deduped.map((p) => ({ leaveType: p.leaveType.trim(), paidDaysLimit: p.paidDaysLimit })),
      });
    } else {
      existing.policies = deduped.map((p) => ({
        leaveType:     p.leaveType.trim(),
        paidDaysLimit: p.paidDaysLimit,
      }));
      existing.resetMonth = resetMonth || existing.resetMonth;

      // Only update flags if they are explicitly provided in the request body
      if (typeof sandwichLeaveEnabled  === "boolean") existing.sandwichLeaveEnabled  = sandwichLeaveEnabled;
      if (typeof unplannedAbsenceToLOP === "boolean") existing.unplannedAbsenceToLOP = unplannedAbsenceToLOP;
      if (typeof carryForwardEnabled   === "boolean") existing.carryForwardEnabled   = carryForwardEnabled; // ✅ NEW

      await existing.save();
    }

    res.json(existing);
  } catch (err) {
    console.error("upsertLeavePolicy error:", err);
    res.status(500).json({ message: "Failed to save leave policy." });
  }
};

/* ===================================================================================
   ADMIN: MANUALLY RESET usedPaidDays (Now deprecated, handled automatically by dates)
=================================================================================== */
export const resetUsedPaidDays = async (req, res) => {
  res.json({ message: "Reset successful. Balances are dynamically calculated by dates automatically now." });
};

/* ===================================================================================
   ✅ UPDATED: EMPLOYEE: GET LEAVE BALANCE
   Now includes carry-forward days per leave type when carryForwardEnabled is ON.
   Each employee sees their own effective balance = paidDaysLimit + carriedForward - used.
=================================================================================== */
export const getLeavePolicyBalanceForEmployee = async (req, res) => {
  try {
    const policyDoc = await LeavePolicy.findOne({ adminId: req.user.adminId }).lean();
    if (!policyDoc || !policyDoc.policies.length) {
      return res.json({
        balance: [],
        sandwichLeaveEnabled:  false,
        unplannedAbsenceToLOP: false,
        carryForwardEnabled:   false, // ✅ NEW
      });
    }

    const cycleStart = getCycleStartDateStr(policyDoc.resetMonth);

    // Map through the Admin's policies, but fetch actual history for the Employee
    const balancePromises = policyDoc.policies.map(async (p) => {
      const personalUsedPaidDays = await getUsedPaidDaysForEmployee(
        req.user.employeeId, 
        p.leaveType, 
        cycleStart
      );

      // ✅ NEW: Calculate carry-forward for this employee + leave type
      let carriedForwardDays = 0;
      if (policyDoc.carryForwardEnabled) {
        // We need a non-lean policyDoc for getCarriedForwardDays — pass the lean version
        // with the carryForwardEnabled flag set
        carriedForwardDays = await getCarriedForwardDays(
          req.user.adminId,
          req.user.employeeId,
          p.leaveType,
          policyDoc
        );
      }

      const effectiveLimit = p.paidDaysLimit + carriedForwardDays;

      return {
        leaveType:          p.leaveType,
        paidDaysLimit:      p.paidDaysLimit,
        carriedForwardDays, // ✅ NEW — shown in employee balance UI
        effectiveLimit,     // ✅ NEW — paidDaysLimit + carriedForwardDays
        usedPaidDays:       personalUsedPaidDays,
        remainingPaidDays:  Math.max(0, effectiveLimit - personalUsedPaidDays),
      };
    });

    const balance = await Promise.all(balancePromises);

    // ✅ Return balance AND all admin feature flags
    res.json({
      balance,
      sandwichLeaveEnabled:  policyDoc.sandwichLeaveEnabled  ?? false,
      unplannedAbsenceToLOP: policyDoc.unplannedAbsenceToLOP ?? false,
      carryForwardEnabled:   policyDoc.carryForwardEnabled   ?? false, // ✅ NEW
    });
  } catch (err) {
    console.error("getLeavePolicyBalanceForEmployee error:", err);
    res.status(500).json({ message: "Failed to fetch leave balance." });
  }
};
// --- END OF FILE controllers/leaveController.js ---