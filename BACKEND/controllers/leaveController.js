// --- START OF FILE controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import nodemailer from "nodemailer";

/* ===============================================================
   SMTP TRANSPORTER  (reads from .env — same pattern as your
   working Attendance controller)
=============================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// Helper: List dates
function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ===============================================================
   EMAIL TEMPLATE — Admin notified when employee applies leave
=============================================================== */
const adminLeaveNotificationEmail = ({ name, employeeId, email, leaveType, from, to, reason }) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:35px 30px;text-align:center;">
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">New Leave Request</h1>
            <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;opacity:0.9;">Action Required — Pending Approval</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 30px;">
            <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
              A new leave application has been submitted by <strong>${name}</strong>
              and is awaiting your review.
            </p>

            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:25px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;width:35%;">Employee Name</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Employee Email</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;">
                      <a href="mailto:${email}" style="color:#3b82f6;text-decoration:none;">${email || "N/A"}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Employee ID</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">${employeeId || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Leave Type</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#3b82f6;">${leaveType}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Duration</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 0;color:#6b7280;vertical-align:top;">Reason</td>
                    <td style="padding:12px 0 0;text-align:right;color:#4b5563;font-style:italic;">
                      "${reason || "No reason provided."}"
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the Admin Portal to approve or reject this request.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px;text-align:center;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} Attendance Management System<br/>
            This is an automated notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   EMAIL TEMPLATE — Employee notified when admin acts on leave
=============================================================== */
const employeeLeaveStatusEmail = ({ employeeName, status, from, to, leaveType, reason, approvedBy }) => {
  const statusColor    = status === "Approved" ? "#10b981" : "#ef4444";
  const headerGradient = status === "Approved"
    ? "linear-gradient(135deg,#059669,#10b981)"
    : "linear-gradient(135deg,#b91c1c,#ef4444)";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${headerGradient};padding:35px 30px;text-align:center;">
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">Leave Request ${status}</h1>
            <p style="margin:8px 0 0;color:#f0fdf4;font-size:14px;opacity:0.9;">Official Leave Management Notification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 30px;">
            <p style="margin:0 0 18px;font-size:16px;color:#1f2937;">
              Dear <strong>${employeeName}</strong>,
            </p>
            <p style="margin:0 0 25px;font-size:15px;color:#4b5563;line-height:1.7;">
              Your leave request has been processed. Below are the details:
            </p>

            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:25px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Status</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:${statusColor};">
                      ${status.toUpperCase()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Leave Type</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">${leaveType}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Duration</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Reason</td>
                    <td style="padding:10px 0;text-align:right;color:#4b5563;">${reason || "N/A"}</td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0;color:#6b7280;">Actioned By</td>
                    <td style="padding:12px 0;text-align:right;font-weight:bold;color:#111827;">${approvedBy}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;">
              For any queries please contact HR or your manager.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px;text-align:center;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} Attendance Management System<br/>
            This is an automated notification regarding your leave application.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ===================================================================================
// ✅ EMPLOYEE CREATES LEAVE  →  Email sent to the employee's scoped Admin ONLY
// ===================================================================================
export const createLeave = async (req, res) => {
  try {
    const loggedUser = req.user; // Employee
    const { from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);

    const details = listDates(from, to).map((date) => ({
      date,
      leavecategory: "UnPaid",
      leaveType,
      leaveDayType: from === to ? leaveDayType : "Full Day",
    }));

    // 1. CREATE LEAVE REQUEST (hierarchy preserved)
    const doc = await LeaveRequest.create({
      adminId:      loggedUser.adminId,
      companyId:    loggedUser.company,
      employeeId:   loggedUser.employeeId || null,
      employeeName: loggedUser.name || "Unknown",
      from,
      to,
      reason,
      leaveType,
      leaveDayType,
      halfDaySession,
      monthKey,
      status:      "Pending",
      approvedBy:  "-",
      actionDate:  "-",
      requestDate: new Date().toISOString().slice(0, 10),
      details,
    });

    // 2. FIND SCOPED ADMIN (only the admin who owns this employee)
    const admin = await Admin.findById(loggedUser.adminId).lean();

    if (admin) {

      // ── 2a. EMAIL to the scoped admin ──────────────────────────────────────
      if (admin.email) {
        try {
          await transporter.sendMail({
            from:    `"HRMS Leave Notification" <${process.env.SMTP_USER}>`,
            to:      admin.email,                            // scoped admin only
            subject: `New Leave Request from ${loggedUser.name}`,
            html:    adminLeaveNotificationEmail({
              name:       loggedUser.name,
              employeeId: loggedUser.employeeId,
              email:      loggedUser.email,
              leaveType,
              from,
              to,
              reason,
            }),
          });
          console.log(`✅ Leave notification email sent to admin: ${admin.email}`);
        } catch (emailErr) {
          console.error("❌ Failed to send leave notification email to admin:", emailErr);
        }
      }

      // ── 2b. IN-APP NOTIFICATION for scoped admin ───────────────────────────
      const notif = await Notification.create({
        adminId:   admin._id,
        companyId: loggedUser.company,
        userId:    admin._id.toString(),
        userType:  "Admin",
        title:     "New Leave Request",
        message:   `${loggedUser.name} submitted a leave request (${from} → ${to})`,
        type:      "leave",
        isRead:    false,
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
// FETCH USER LEAVES (EMPLOYEE)
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
// ADMIN LIST ALL LEAVES (SCOPED)
// ===================================================================================
export const adminListAllLeaves = async (req, res) => {
  try {
    const docs = await LeaveRequest.find({ adminId: req.user._id })
      .sort({ requestDate: -1 })
      .lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListAllLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ===================================================================================
// GET DETAILS (SCOPED)
// ===================================================================================
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });

    const isAdmin = req.user.role === "admin";

    if (isAdmin) {
      if (doc.adminId && doc.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Unauthorized access to another tenant's data" });
      }
    } else {
      if (doc.employeeId !== req.user.employeeId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    }

    res.json(doc.details || []);
  } catch (err) {
    console.error("getLeaveDetails error:", err);
    res.status(500).json({ message: "Failed to fetch leave details." });
  }
};

// ===================================================================================
// ✅ ADMIN UPDATES LEAVE STATUS  →  Email sent to the employee
// ===================================================================================
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status }  = req.body;
    const approvedBy  = req.user.name;

    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Scoped update — admin can only act on their own records
    const doc = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      {
        status,
        approvedBy,
        actionDate: new Date().toISOString().slice(0, 10),
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave request not found or unauthorized" });

    const employee = await Employee.findOne({ employeeId: doc.employeeId });

    if (employee) {

      // ── In-app notification for employee ──────────────────────────────────
      const notif = await Notification.create({
        adminId:   req.user._id,
        companyId: doc.companyId,
        userId:    employee._id,
        userType:  "Employee",
        title:     "Leave Status Update",
        message:   `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
        type:      "leave-status",
        isRead:    false,
      });

      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);

      // ── Email to employee ──────────────────────────────────────────────────
      if (employee.email) {
        try {
          await transporter.sendMail({
            from:    `"Leave Management" <${process.env.SMTP_USER}>`,
            to:      employee.email,
            subject: `Leave Request ${status}: ${doc.from} – ${doc.to}`,
            html:    employeeLeaveStatusEmail({
              employeeName: employee.name,
              status,
              from:      doc.from,
              to:        doc.to,
              leaveType: doc.leaveType,
              reason:    doc.reason,
              approvedBy,
            }),
          });
          console.log(`✅ Leave status email sent to employee: ${employee.email}`);
        } catch (emailErr) {
          console.error("❌ Failed to send leave status email to employee:", emailErr);
        }
      }
    }

    return res.json(doc);
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
};

// ===================================================================================
// EMPLOYEE CANCEL LEAVE
// ===================================================================================
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });

    // Ownership check
    if (leave.employeeId !== req.user.employeeId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (leave.status !== "Pending") {
      return res.status(400).json({ message: "Cannot cancel this leave" });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);

    // Notify scoped admin only
    const admin = await Admin.findById(leave.adminId);
    if (admin) {
      const notif = await Notification.create({
        adminId:   admin._id,
        companyId: leave.companyId,
        userId:    admin._id.toString(),
        userType:  "Admin",
        title:     "Leave Cancelled",
        message:   `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
        type:      "leave",
        isRead:    false,
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
// --- END OF FILE controllers/leaveController.js ---