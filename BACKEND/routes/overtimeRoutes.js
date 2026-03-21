// --- START OF FILE routes/overtimeRoutes.js ---
import express from "express";
import nodemailer from "nodemailer";
import Overtime from "../models/Overtime.js";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect);

/* ===============================================================
   SMTP TRANSPORTER
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

/* ===============================================================
   EMAIL TEMPLATE — Admin notified when employee applies overtime
=============================================================== */
const adminOvertimeRequestEmail = ({
  employeeName, employeeId, employeeEmail,
  date, type, requestedOn,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#b45309,#d97706,#f59e0b);
                     padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#fef3c7;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Overtime Management
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:800;">
              New Overtime Request
            </h1>
            <p style="margin:10px 0 0;color:#fef9c3;font-size:14px;opacity:0.95;">
              Action Required &mdash; Pending Your Approval
            </p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#fffbeb;border-bottom:3px solid #f59e0b;
                     padding:13px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#b45309;font-weight:600;">
              ⏱ An employee has submitted an overtime request for your review
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">
              <strong>${employeeName}</strong> has submitted a new overtime request
              and it is currently awaiting your approval.
            </p>

            <!-- Section: Employee Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Employee Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#fffbeb;border-radius:10px;padding:18px 20px;
                          border:1px solid #fde68a;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#78716c;width:38%;">Full Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${employeeName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #fef3c7;">
                    <td style="padding:9px 0;color:#78716c;">Employee ID</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${employeeId || "N/A"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #fef3c7;">
                    <td style="padding:9px 0;color:#78716c;">Email</td>
                    <td style="padding:9px 0;text-align:right;">
                      <a href="mailto:${employeeEmail}"
                         style="color:#d97706;text-decoration:none;font-weight:600;">
                        ${employeeEmail || "N/A"}
                      </a>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Section: Overtime Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Overtime Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Overtime Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${new Date(date).toLocaleDateString("en-IN", {
                        weekday: "long", year: "numeric",
                        month:   "long", day:  "numeric",
                      })}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Overtime Type</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#fef3c7;color:#92400e;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:700;
                                   text-transform:uppercase;">
                        ${type}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Current Status</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#e0f2fe;color:#0369a1;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:600;">
                        Pending
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Requested On</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${requestedOn}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Admin Portal</strong> to approve or
              reject this overtime request.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   EMAIL TEMPLATE — Employee notified when admin acts on overtime
=============================================================== */
const employeeOvertimeStatusEmail = ({
  employeeName, status, date, type, actionBy, actionDate,
}) => {
  const isApproved     = status === "APPROVED";
  const statusLabel    = status.charAt(0) + status.slice(1).toLowerCase();
  const statusColor    = isApproved ? "#10b981" : "#ef4444";
  const headerGradient = isApproved
    ? "linear-gradient(135deg,#059669,#10b981)"
    : "linear-gradient(135deg,#b91c1c,#ef4444)";
  const badgeBg    = isApproved ? "#d1fae5" : "#fee2e2";
  const badgeColor = isApproved ? "#065f46" : "#991b1b";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:${headerGradient};padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.75);
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Overtime Management
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:800;">
              Overtime Request ${statusLabel}
            </h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Official Overtime Status Notification
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;font-size:16px;color:#1f2937;">
              Dear <strong>${employeeName}</strong>,
            </p>
            <p style="margin:0 0 26px;font-size:15px;color:#4b5563;line-height:1.7;">
              Your overtime request has been reviewed and a decision has been made.
              Please find the details below.
            </p>

            <!-- Status Badge -->
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:26px;">
              <tr>
                <td align="center">
                  <span style="display:inline-block;background:${badgeBg};color:${badgeColor};
                               padding:10px 36px;border-radius:30px;font-size:16px;
                               font-weight:700;letter-spacing:1px;">
                    ${status}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Section: Overtime Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Overtime Request Summary
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Decision</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;
                               color:${statusColor};">
                      ${status}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Overtime Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${new Date(date).toLocaleDateString("en-IN", {
                        weekday: "long", year: "numeric",
                        month:   "long", day:  "numeric",
                      })}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Overtime Type</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#fef3c7;color:#92400e;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:700;
                                   text-transform:uppercase;">
                        ${type}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Action Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${actionDate}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;">Actioned By</td>
                    <td style="padding:12px 0 4px;text-align:right;font-weight:700;
                               color:#111827;">
                      ${actionBy}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
              ${isApproved
                ? "Your overtime has been approved. Please coordinate with your manager for scheduling."
                : "Your overtime request was not approved this time. Please contact your manager for more details."}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification regarding your overtime request.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ======================================================
   🧑‍💼 EMPLOYEE/MANAGER APPLY
====================================================== */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date, type } = req.body;
    const employeeEmail = req.user?.email || "";

    if (!employeeId || !employeeName || !date || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // CREATE WITH HIERARCHY
    const newOT = await Overtime.create({
      adminId:   req.user.adminId,
      companyId: req.user.company,
      employeeId,
      employeeName,
      date,
      type,
      status: "PENDING",
    });

    // Notify scoped Admin
    const admin = await Admin.findById(req.user.adminId);
    if (admin) {

      // ── In-app notification ────────────────────────────────────────────────
      await Notification.create({
        adminId:   admin._id,
        companyId: req.user.company,
        userId:    admin._id,
        title:     "New Overtime Request",
        message:   `${employeeName} requested overtime on ${date}`,
        type:      "overtime",
        isRead:    false,
      });

      // ── Email to scoped admin ──────────────────────────────────────────────
      if (admin.email) {
        try {
          const requestedOn = new Date().toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short",
          });
          await transporter.sendMail({
            from:    `"HRMS Overtime Notification" <${process.env.SMTP_USER}>`,
            to:      admin.email,
            subject: `New Overtime Request from ${employeeName}`,
            html:    adminOvertimeRequestEmail({
              employeeName,
              employeeId,
              employeeEmail,
              date,
              type,
              requestedOn,
            }),
          });
          console.log(`✅ Overtime request email sent to admin: ${admin.email}`);
        } catch (emailErr) {
          console.error("❌ Failed to send overtime request email to admin:", emailErr);
        }
      }
    }

    res.status(201).json({ message: "Overtime request submitted", data: newOT });
  } catch (err) {
    console.error("OT CREATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → GET ALL (SCOPED)
====================================================== */
router.get("/all", onlyAdmin, async (req, res) => {
  try {
    const list = await Overtime.find({ adminId: req.user._id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT ALL FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → UPDATE STATUS
====================================================== */
router.put("/update-status/:id", onlyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update ensuring ownership
    const updated = await Overtime.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Overtime request not found" });

    // Notify Employee
    const employee = await Employee.findOne({ employeeId: updated.employeeId });
    if (employee) {

      // ── In-app notification ────────────────────────────────────────────────
      await Notification.create({
        adminId:   req.user._id,
        companyId: updated.companyId,
        userId:    employee._id,
        title:     "Overtime Status Update",
        message:   `Your overtime request on ${updated.date} was ${status}`,
        type:      "overtime-status",
        isRead:    false,
      });

      // ── Email to employee ──────────────────────────────────────────────────
      if (employee.email) {
        try {
          const actionDate = new Date().toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short",
          });
          await transporter.sendMail({
            from:    `"Overtime Management" <${process.env.SMTP_USER}>`,
            to:      employee.email,
            subject: `Overtime Request ${status}: ${updated.date}`,
            html:    employeeOvertimeStatusEmail({
              employeeName: employee.name,
              status,
              date:         updated.date,
              type:         updated.type,
              actionBy:     req.user.name,
              actionDate,
            }),
          });
          console.log(`✅ Overtime status email sent to employee: ${employee.email}`);
        } catch (emailErr) {
          console.error("❌ Failed to send overtime status email to employee:", emailErr);
        }
      }
    }

    res.json({ message: "Status updated successfully", data: updated });
  } catch (err) {
    console.error("OT STATUS UPDATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ❌ EMPLOYEE CANCEL
====================================================== */
router.patch("/cancel/:id", async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);
    if (!overtime) return res.status(404).json({ message: "Overtime not found" });

    if (overtime.employeeId !== req.user.employeeId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (overtime.status !== "PENDING") {
      return res.status(400).json({ message: "Cannot cancel approved/rejected overtime" });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    // Notify scoped Admin
    const admin = await Admin.findById(overtime.adminId);
    if (admin) {
      await Notification.create({
        adminId:   admin._id,
        companyId: overtime.companyId,
        userId:    admin._id,
        title:     "Overtime Cancelled",
        message:   `${overtime.employeeName} cancelled overtime request on ${overtime.date}`,
        type:      "overtime",
        isRead:    false,
      });
    }

    res.json({ message: "Overtime cancelled successfully" });
  } catch (error) {
    console.error("Cancel OT failed:", error);
    res.status(500).json({ message: "Failed to cancel overtime request" });
  }
});

/* ======================================================
   👤 EMPLOYEE HISTORY
====================================================== */
router.get("/:employeeId", async (req, res) => {
  try {
    if (req.user.employeeId !== req.params.employeeId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const list = await Overtime.find({ employeeId: req.params.employeeId }).sort({ date: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN DELETE
====================================================== */
router.delete("/delete/:id", onlyAdmin, async (req, res) => {
  try {
    const removed = await Overtime.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    if (!removed) return res.status(404).json({ message: "Overtime not found" });
    res.json({ message: "Overtime deleted successfully" });
  } catch (err) {
    console.error("OT DELETE ERROR →", err);
    res.status(500).json({ message: "Failed to delete overtime request" });
  }
});

export default router;
// --- END OF FILE routes/overtimeRoutes.js ---