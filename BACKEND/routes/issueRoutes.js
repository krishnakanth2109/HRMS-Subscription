// --- START OF FILE routes/issueRoutes.js ---
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import TechnicalIssue from "../models/TechnicalIssue.js";
import MasterAdmin from "../models/MasterAdmin.js";

const router = express.Router();

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
   EMAIL TEMPLATE — Admin notified when issue is raised
=============================================================== */
const adminNewIssueEmail = ({
  raisedByName, raisedByEmail, role,
  subject, message, imageCount,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#ddd6fe;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
              Technical Support System
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;">
              New Technical Issue Raised
            </h1>
            <p style="margin:10px 0 0;color:#e0e7ff;font-size:14px;opacity:0.9;">
              Action Required &mdash; Pending Your Review &amp; Approval
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">
              A new technical issue has been submitted by <strong>${raisedByName}</strong>
              and requires your review before it is escalated to the support team.
            </p>

            <!-- Section: Raised By -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Raised By
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${raisedByName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Email</td>
                    <td style="padding:9px 0;text-align:right;">
                      <a href="mailto:${raisedByEmail}"
                         style="color:#4f46e5;text-decoration:none;font-weight:600;">
                        ${raisedByEmail || "N/A"}
                      </a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Role</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#ede9fe;color:#5b21b6;padding:3px 12px;
                                   border-radius:20px;font-size:13px;font-weight:600;
                                   text-transform:capitalize;">
                        ${role}
                      </span>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Section: Issue Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Issue Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Subject</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${subject}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Attachments</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${imageCount > 0 ? `${imageCount} image${imageCount > 1 ? "s" : ""} attached` : "No attachments"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">
                      Description
                    </td>
                    <td style="padding:12px 0 4px;text-align:right;color:#4b5563;
                                font-style:italic;line-height:1.6;">
                      &ldquo;${message}&rdquo;
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Admin Portal</strong> to review and approve or
              reject this issue so it can be escalated to technical support.
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
   EMAIL TEMPLATE — Raiser notified when admin approves / rejects
=============================================================== */
const raiserIssueStatusEmail = ({
  raisedByName, status, subject, message, resolvedMessage, actionBy,
}) => {
  const isApproved     = status === "approved";
  const isRejected     = status === "rejected";
  const statusLabel    = status.charAt(0).toUpperCase() + status.slice(1);
  const statusColor    = isApproved ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b";
  const headerGradient = isApproved
    ? "linear-gradient(135deg,#059669,#10b981)"
    : isRejected
    ? "linear-gradient(135deg,#b91c1c,#ef4444)"
    : "linear-gradient(135deg,#b45309,#f59e0b)";
  const badgeBg    = isApproved ? "#d1fae5" : isRejected ? "#fee2e2" : "#fef3c7";
  const badgeColor = isApproved ? "#065f46" : isRejected ? "#991b1b" : "#92400e";

  const bodyNote = isApproved
    ? "Your issue has been approved and will now be escalated to the technical support team for resolution."
    : isRejected
    ? "Your issue has been reviewed and unfortunately could not be approved at this time."
    : "Your issue has been successfully resolved by the technical support team.";

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
            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.75);
                      letter-spacing:2px;text-transform:uppercase;font-weight:600;">
              Technical Support System
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;">
              Issue ${statusLabel}
            </h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Official Technical Issue Status Notification
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;font-size:16px;color:#1f2937;">
              Dear <strong>${raisedByName}</strong>,
            </p>
            <p style="margin:0 0 26px;font-size:15px;color:#4b5563;line-height:1.7;">
              ${bodyNote}
            </p>

            <!-- Status Badge -->
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:26px;">
              <tr>
                <td align="center">
                  <span style="display:inline-block;background:${badgeBg};color:${badgeColor};
                               padding:10px 36px;border-radius:30px;font-size:16px;font-weight:700;
                               letter-spacing:1px;">
                    ${statusLabel.toUpperCase()}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Section: Issue Summary -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Your Issue Summary
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Subject</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${subject}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Status</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:${statusColor};">
                      ${statusLabel.toUpperCase()}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;vertical-align:top;">
                      Your Description
                    </td>
                    <td style="padding:9px 0;text-align:right;color:#4b5563;
                                font-style:italic;line-height:1.6;">
                      &ldquo;${message}&rdquo;
                    </td>
                  </tr>
                  ${
                    resolvedMessage
                      ? `<tr style="border-top:1px solid #e5e7eb;">
                           <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">
                             ${isRejected ? "Rejection Reason" : "Resolution Note"}
                           </td>
                           <td style="padding:12px 0 4px;text-align:right;color:#4b5563;
                                       font-style:italic;line-height:1.6;">
                             &ldquo;${resolvedMessage}&rdquo;
                           </td>
                         </tr>`
                      : ""
                  }
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;">Actioned By</td>
                    <td style="padding:12px 0 4px;text-align:right;font-weight:700;color:#111827;">
                      ${actionBy}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
              ${
                isApproved
                  ? "Our technical team will reach out shortly. Thank you for your patience."
                  : isRejected
                  ? "If you have further questions, please contact your manager or HR."
                  : "We hope this resolves your concern. Feel free to raise a new issue if needed."
              }
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification regarding your technical issue.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ===============================================================
   EMAIL TEMPLATE — SuperAdmin notified when admin approves &
   forwards an issue for resolution
=============================================================== */
const superAdminForwardedIssueEmail = ({
  raisedByName, raisedByEmail, raisedByRole,
  approvedByName, approvedByEmail, companyId,
  subject, message, imageCount, issueId, approvedAt,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a,#1e40af,#0369a1);
                     padding:40px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:#93c5fd;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Super Admin &bull; Technical Support
            </p>
            <h1 style="margin:0;font-size:27px;color:#ffffff;font-weight:800;line-height:1.3;">
              Issue Approved &amp; Forwarded
            </h1>
            <p style="margin:12px 0 0;color:#bfdbfe;font-size:14px;line-height:1.6;">
              An admin has reviewed and approved a technical issue.<br/>
              <strong style="color:#ffffff;">Your action is required to resolve it.</strong>
            </p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#eff6ff;border-bottom:3px solid #3b82f6;
                     padding:14px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600;">
              ⚡ This issue has been escalated to you for final resolution
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">

            <!-- Section: Issue Overview -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Issue Overview
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:20px 22px;
                          border:1px solid #e5e7eb;margin-bottom:24px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;width:36%;">Issue ID</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;
                               color:#111827;font-family:monospace;font-size:13px;">
                      #${issueId}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;">Subject</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">
                      ${subject}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;">Attachments</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${imageCount > 0
                        ? `${imageCount} image${imageCount > 1 ? "s" : ""} attached`
                        : "No attachments"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;">Approved On</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${approvedAt}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;vertical-align:top;">
                      Description
                    </td>
                    <td style="padding:10px 0;text-align:right;color:#4b5563;
                                font-style:italic;line-height:1.6;">
                      &ldquo;${message}&rdquo;
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Two-column: Raised By + Approved By -->
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr valign="top">

                <!-- Raised By -->
                <td width="48%" style="padding-right:8px;">
                  <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:1px;">
                    Raised By (Employee)
                  </p>
                  <table width="100%" cellspacing="0" cellpadding="0"
                         style="background:#f8fafc;border-radius:10px;padding:16px 18px;
                                border:1px solid #e5e7eb;">
                    <tr><td>
                      <table width="100%" style="font-size:13px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:8px 0;color:#6b7280;">Name</td>
                          <td style="padding:8px 0;text-align:right;font-weight:700;
                                     color:#111827;">${raisedByName}</td>
                        </tr>
                        <tr style="border-top:1px solid #f1f5f9;">
                          <td style="padding:8px 0;color:#6b7280;">Email</td>
                          <td style="padding:8px 0;text-align:right;">
                            <a href="mailto:${raisedByEmail}"
                               style="color:#4f46e5;text-decoration:none;font-weight:600;
                                      font-size:12px;">
                              ${raisedByEmail || "N/A"}
                            </a>
                          </td>
                        </tr>
                        <tr style="border-top:1px solid #f1f5f9;">
                          <td style="padding:8px 0;color:#6b7280;">Role</td>
                          <td style="padding:8px 0;text-align:right;">
                            <span style="background:#ede9fe;color:#5b21b6;padding:2px 10px;
                                         border-radius:20px;font-size:12px;font-weight:600;
                                         text-transform:capitalize;">
                              ${raisedByRole}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </td>

                <!-- Approved By -->
                <td width="4%"></td>
                <td width="48%" style="padding-left:8px;">
                  <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:1px;">
                    Approved By (Admin)
                  </p>
                  <table width="100%" cellspacing="0" cellpadding="0"
                         style="background:#f0fdf4;border-radius:10px;padding:16px 18px;
                                border:1px solid #bbf7d0;">
                    <tr><td>
                      <table width="100%" style="font-size:13px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:8px 0;color:#6b7280;">Name</td>
                          <td style="padding:8px 0;text-align:right;font-weight:700;
                                     color:#111827;">${approvedByName}</td>
                        </tr>
                        <tr style="border-top:1px solid #dcfce7;">
                          <td style="padding:8px 0;color:#6b7280;">Email</td>
                          <td style="padding:8px 0;text-align:right;">
                            <a href="mailto:${approvedByEmail}"
                               style="color:#059669;text-decoration:none;font-weight:600;
                                      font-size:12px;">
                              ${approvedByEmail || "N/A"}
                            </a>
                          </td>
                        </tr>
                        <tr style="border-top:1px solid #dcfce7;">
                          <td style="padding:8px 0;color:#6b7280;">Company ID</td>
                          <td style="padding:8px 0;text-align:right;font-weight:600;
                                     color:#111827;font-family:monospace;font-size:12px;">
                            ${companyId || "N/A"}
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </td>

              </tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Super Admin Portal</strong> to review the full
              details and provide a resolution for this issue.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated escalation notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   EMAIL TEMPLATE — SuperAdmin notified when an Admin directly
   raises a technical issue (auto-approved on submission)
=============================================================== */
const superAdminAdminRaisedIssueEmail = ({
  adminName, adminEmail, companyId,
  subject, message, imageCount, issueId, submittedAt,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a,#0f4c81,#0369a1);
                     padding:40px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:#7dd3fc;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Super Admin &bull; Technical Support
            </p>
            <h1 style="margin:0;font-size:27px;color:#ffffff;font-weight:800;line-height:1.3;">
              New Issue Submitted by Admin
            </h1>
            <p style="margin:12px 0 0;color:#bae6fd;font-size:14px;line-height:1.6;">
              An admin has directly submitted a technical issue.<br/>
              <strong style="color:#ffffff;">Your action is required to resolve it.</strong>
            </p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#f0f9ff;border-bottom:3px solid #0369a1;
                     padding:14px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#0369a1;font-weight:600;">
              ⚡ This issue was submitted directly by an Admin and requires your resolution
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">

            <!-- Section: Admin Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Submitted By (Admin)
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f0f9ff;border-radius:10px;padding:20px 22px;
                          border:1px solid #bae6fd;margin-bottom:24px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;width:36%;">Admin Name</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">
                      ${adminName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:10px 0;color:#6b7280;">Admin Email</td>
                    <td style="padding:10px 0;text-align:right;">
                      <a href="mailto:${adminEmail}"
                         style="color:#0369a1;text-decoration:none;font-weight:600;">
                        ${adminEmail || "N/A"}
                      </a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:10px 0;color:#6b7280;">Role</td>
                    <td style="padding:10px 0;text-align:right;">
                      <span style="background:#dbeafe;color:#1d4ed8;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:600;">
                        Admin
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:10px 0;color:#6b7280;">Company ID</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;
                               color:#111827;font-family:monospace;font-size:13px;">
                      ${companyId || "N/A"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:10px 0;color:#6b7280;">Submitted On</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${submittedAt}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Section: Issue Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Issue Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:20px 22px;
                          border:1px solid #e5e7eb;margin-bottom:24px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;width:36%;">Issue ID</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;
                               color:#111827;font-family:monospace;font-size:13px;">
                      #${issueId}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;">Subject</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">
                      ${subject}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:10px 0;color:#6b7280;">Attachments</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${imageCount > 0
                        ? `${imageCount} image${imageCount > 1 ? "s" : ""} attached`
                        : "No attachments"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">
                      Description
                    </td>
                    <td style="padding:12px 0 4px;text-align:right;color:#4b5563;
                                font-style:italic;line-height:1.6;">
                      &ldquo;${message}&rdquo;
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Super Admin Portal</strong> to review and
              resolve this issue at your earliest convenience.
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

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const setUser = (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    token = token.replace(/(^"|"$)/g, "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRole = (decoded.role || decoded.type || "superadmin").toLowerCase();
    const userId = decoded.id || decoded._id || decoded.userId || decoded.employeeId || decoded.adminId || decoded.masterId;

    req.user = {
      _id: userId,
      role: userRole,
      name: decoded.name || "",
      email: decoded.email || "",
      adminId: decoded.adminId,
      companyId: decoded.companyId || decoded.company,
    };

    if (!req.user._id) return res.status(401).json({ success: false, message: "Invalid token" });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hrms/technical-issues",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }],
  },
});

const upload = multer({ storage });

// ─── CREATE ISSUE ─────────────────────────────────────────────────────────────
router.post("/", setUser, upload.array("images", 5), async (req, res) => {
  try {
    const { subject, message, raisedByName, raisedByEmail, adminId, companyId } = req.body;
    const { _id: userId, role } = req.user;

    let finalAdminId   = adminId   || req.user.adminId;
    let finalCompanyId = companyId || req.user.companyId;
    let fallbackEmail  = req.user.email;
    let fallbackName   = req.user.name;

    if (role === "employee") {
      const emp = await mongoose.model("Employee").findById(userId).lean();
      if (emp) {
        finalAdminId   = finalAdminId   || emp.adminId || emp.creatorId || emp.admin;
        finalCompanyId = finalCompanyId || emp.companyId || emp.tenantId || emp.company;
        fallbackEmail  = fallbackEmail  || emp.email;
        fallbackName   = fallbackName   || emp.name;
      }
    } else if (role === "admin" || role === "superadmin") {
      const adm = await mongoose.model("Admin").findById(userId).lean();
      if (adm) {
        finalAdminId   = finalAdminId   || userId;
        finalCompanyId = finalCompanyId || adm.companyId || adm.company || userId;
        fallbackEmail  = fallbackEmail  || adm.email;
        fallbackName   = fallbackName   || adm.name;
      }
    }

    if (!finalAdminId || !finalCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Hierarchy IDs missing. Unable to map issue to a Company/Admin.",
      });
    }

    const images = (req.files || []).map((f) => ({ url: f.path, publicId: f.filename }));

    const finalName  = raisedByName  || fallbackName  || "User";
    const finalEmail = raisedByEmail || fallbackEmail || "";

    const issue = await TechnicalIssue.create({
      subject:        subject.trim(),
      message:        message.trim(),
      images,
      raisedBy:       userId,
      raisedByName:   finalName,
      raisedByEmail:  finalEmail,
      role,
      adminId:        finalAdminId,
      companyId:      finalCompanyId,
      status:         role === "admin" || role === "superadmin" ? "approved" : "pending",
      approvalByAdmin: role === "admin" || role === "superadmin",
    });

    // ── EMAIL: notify scoped admin (employees only — admins raise directly as approved)
    if (role === "employee" && finalAdminId) {
      try {
        const admin = await mongoose.model("Admin").findById(finalAdminId).lean();
        if (admin?.email) {
          await transporter.sendMail({
            from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
            to:      admin.email,
            subject: `New Technical Issue: ${subject.trim()}`,
            html:    adminNewIssueEmail({
              raisedByName:  finalName,
              raisedByEmail: finalEmail,
              role,
              subject:       subject.trim(),
              message:       message.trim(),
              imageCount:    images.length,
            }),
          });
          console.log(`✅ Technical issue email sent to admin: ${admin.email}`);
        }
      } catch (emailErr) {
        console.error("❌ Failed to send issue notification email to admin:", emailErr);
      }
    }

    // ── EMAIL: when an Admin raises an issue it's auto-approved → notify all SuperAdmins
    if (role === "admin") {
      try {
        const masterAdmins = await MasterAdmin.find({}).lean();
        const masterEmails = masterAdmins.map((m) => m.email).filter(Boolean);

        if (masterEmails.length > 0) {
          const submittedAt = new Date().toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short",
          });

          await transporter.sendMail({
            from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
            to:      masterEmails.join(","),
            subject: `[Admin Issue] New Technical Issue Submitted: ${subject.trim()}`,
            html:    superAdminAdminRaisedIssueEmail({
              adminName:  finalName,
              adminEmail: finalEmail,
              companyId:  finalCompanyId?.toString() || "",
              subject:    subject.trim(),
              message:    message.trim(),
              imageCount: images.length,
              issueId:    issue._id.toString().slice(-8).toUpperCase(),
              submittedAt,
            }),
          });
          console.log(`✅ Admin issue email sent to superadmin(s): ${masterEmails.join(", ")}`);
        }
      } catch (emailErr) {
        console.error("❌ Failed to send admin issue email to superadmin:", emailErr);
      }
    }

    res.status(201).json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET ALL ISSUES (SCOPED) ──────────────────────────────────────────────────
router.get("/", setUser, async (req, res) => {
  try {
    const { role, _id } = req.user;
    let filter = {};

    if (role === "employee") {
      filter = { raisedBy: _id };
    } else if (role === "admin") {
      filter = { adminId: _id };
    } else if (role === "superadmin") {
      filter = {
        $or: [
          { role: "admin" },
          { role: "employee", status: { $in: ["approved", "resolved", "rejected"] } },
        ],
      };
    }

    const issues = await TechnicalIssue.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, issues });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN APPROVE ────────────────────────────────────────────────────────────
router.patch("/:id/approve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success: false });

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id, status: "pending" },
      { status: "approved", approvalByAdmin: true },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });

    // Fetch admin details for the forwarded email
    const adminDoc = await mongoose.model("Admin").findById(req.user._id).lean();
    const approvedAt = new Date().toLocaleString("en-IN", {
      dateStyle: "medium", timeStyle: "short",
    });

    // ── EMAIL 1: notify the issue raiser ──────────────────────────────────────
    if (issue.raisedByEmail) {
      try {
        await transporter.sendMail({
          from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
          to:      issue.raisedByEmail,
          subject: `Your Issue Has Been Approved: ${issue.subject}`,
          html:    raiserIssueStatusEmail({
            raisedByName:    issue.raisedByName,
            status:          "approved",
            subject:         issue.subject,
            message:         issue.message,
            resolvedMessage: null,
            actionBy:        req.user.name,
          }),
        });
        console.log(`✅ Issue approval email sent to raiser: ${issue.raisedByEmail}`);
      } catch (emailErr) {
        console.error("❌ Failed to send issue approval email to raiser:", emailErr);
      }
    }

    // ── EMAIL 2: forward issue to ALL MasterAdmins (SuperAdmins) ─────────────
    try {
      const masterAdmins = await MasterAdmin.find({}).lean();
      const masterEmails = masterAdmins.map((m) => m.email).filter(Boolean);

      if (masterEmails.length > 0) {
        await transporter.sendMail({
          from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
          to:      masterEmails.join(","),
          subject: `[Escalated] Technical Issue Approved & Forwarded: ${issue.subject}`,
          html:    superAdminForwardedIssueEmail({
            raisedByName:    issue.raisedByName,
            raisedByEmail:   issue.raisedByEmail,
            raisedByRole:    issue.role,
            approvedByName:  req.user.name,
            approvedByEmail: adminDoc?.email || "",
            companyId:       issue.companyId?.toString() || "",
            subject:         issue.subject,
            message:         issue.message,
            imageCount:      issue.images?.length || 0,
            issueId:         issue._id.toString().slice(-8).toUpperCase(),
            approvedAt,
          }),
        });
        console.log(`✅ Issue escalation email sent to superadmin(s): ${masterEmails.join(", ")}`);
      }
    } catch (emailErr) {
      console.error("❌ Failed to send issue escalation email to superadmin:", emailErr);
    }

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN REJECT ─────────────────────────────────────────────────────────────
router.patch("/:id/reject", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success: false });

    const { resolvedMessage } = req.body;

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id, status: "pending" },
      { status: "rejected", resolvedMessage },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });

    // ── EMAIL: notify raiser
    if (issue.raisedByEmail) {
      try {
        await transporter.sendMail({
          from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
          to:      issue.raisedByEmail,
          subject: `Your Issue Has Been Rejected: ${issue.subject}`,
          html:    raiserIssueStatusEmail({
            raisedByName:    issue.raisedByName,
            status:          "rejected",
            subject:         issue.subject,
            message:         issue.message,
            resolvedMessage: resolvedMessage || null,
            actionBy:        req.user.name,
          }),
        });
        console.log(`✅ Issue rejection email sent to: ${issue.raisedByEmail}`);
      } catch (emailErr) {
        console.error("❌ Failed to send issue rejection email:", emailErr);
      }
    }

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SUPERADMIN RESOLVE ───────────────────────────────────────────────────────
router.patch("/:id/resolve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { resolvedMessage } = req.body;
    if (!resolvedMessage?.trim()) {
      return res.status(400).json({ success: false, message: "Resolution message is required" });
    }

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, status: "approved" },
      { status: "resolved", resolvedMessage },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found or not in approved status" });
    }

    // ── EMAIL: notify raiser about resolution
    if (issue.raisedByEmail) {
      try {
        await transporter.sendMail({
          from:    `"HRMS Technical Support" <${process.env.SMTP_USER}>`,
          to:      issue.raisedByEmail,
          subject: `Your Issue Has Been Resolved: ${issue.subject}`,
          html:    raiserIssueStatusEmail({
            raisedByName:    issue.raisedByName,
            status:          "resolved",
            subject:         issue.subject,
            message:         issue.message,
            resolvedMessage: resolvedMessage.trim(),
            actionBy:        req.user.name || "Technical Support Team",
          }),
        });
        console.log(`✅ Issue resolution email sent to: ${issue.raisedByEmail}`);
      } catch (emailErr) {
        console.error("❌ Failed to send issue resolution email:", emailErr);
      }
    }

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE ISSUE ─────────────────────────────────────────────────────────────
router.delete("/:id", setUser, async (req, res) => {
  try {
    const issue = await TechnicalIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: "Not found" });

    const isOwner        = issue.raisedBy.toString() === req.user._id.toString();
    const isAdminOfIssue = req.user.role === "admin" && issue.adminId.toString() === req.user._id.toString();

    if (!isOwner && !isAdminOfIssue && req.user.role !== "superadmin") {
      return res.status(403).json({ success: false });
    }

    for (const img of issue.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }

    await issue.deleteOne();
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
// --- END OF FILE routes/issueRoutes.js ---