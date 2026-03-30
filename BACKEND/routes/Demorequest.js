// --- START OF FILE routes/demoRequestRoutes.js ---
import express from "express";
import nodemailer from "nodemailer";
import DemoRequest from "../models/Demorequest.js";
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
   HELPER — format date nicely
=============================================================== */
const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });



/* ===============================================================
   TEMPLATE 2 — User confirmation email after submitting request
=============================================================== */
const userSubmitConfirmationEmail = ({
  fullName, companyName, preferredDemoTime, phone, message,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a,#1d4ed8,#06b6d4);
                     padding:42px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:#a5f3fc;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              HRMS — Demo Request
            </p>
            <h1 style="margin:0;font-size:28px;color:#ffffff;font-weight:800;line-height:1.3;">
              We've Received Your Request!
            </h1>
            <p style="margin:12px 0 0;color:#bae6fd;font-size:15px;line-height:1.6;">
              Thank you for your interest in HRMS.<br/>
              Our team will confirm your demo within <strong style="color:#ffffff;">24 hours</strong>.
            </p>
          </td>
        </tr>

        <!-- Banner -->
        <tr>
          <td style="background:#f0f9ff;border-bottom:3px solid #0ea5e9;
                     padding:14px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#0369a1;font-weight:600;">
              Your demo request has been submitted successfully
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:38px 32px 28px;">
            <p style="margin:0 0 6px;font-size:17px;color:#1f2937;font-weight:600;">
              Dear <strong>${fullName}</strong>,
            </p>
            <p style="margin:0 0 26px;font-size:15px;color:#4b5563;line-height:1.8;">
              We're excited to connect with you! Below is a summary of your demo
              request. Our team will reach out to confirm the timing shortly.
            </p>

            <!-- Submitted Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Your Submission Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f0f9ff;border-radius:10px;padding:20px 22px;
                          border:1px solid #bae6fd;margin-bottom:24px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#0369a1;width:40%;">Full Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${fullName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Company</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#1d4ed8;">
                      ${companyName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Phone</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${phone}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Preferred Demo Time</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${fmtDate(preferredDemoTime)}
                    </td>
                  </tr>
                  ${message
                    ? `<tr style="border-top:1px solid #e0f2fe;">
                         <td style="padding:9px 0;color:#0369a1;vertical-align:top;">
                           Your Message
                         </td>
                         <td style="padding:9px 0;text-align:right;color:#4b5563;
                                     font-style:italic;line-height:1.6;">
                           &ldquo;${message}&rdquo;
                         </td>
                       </tr>`
                    : ""}
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Status</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#fef9c3;color:#92400e;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:700;">
                        Pending Confirmation
                      </span>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- What Happens Next -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              What Happens Next?
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 22px;
                          border:1px solid #e5e7eb;margin-bottom:24px;">
              <tr><td style="font-size:14px;color:#374151;line-height:2.1;">
                1&nbsp; Our team will review your request<br/>
                2&nbsp; We will send a confirmation email with the final demo link<br/>
                3&nbsp; Join the demo at the scheduled time<br/>
                4&nbsp; Get a personalised walkthrough of the HRMS platform
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
              If you need to make any changes or have questions,
              feel free to reply to this email or contact us directly.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:20px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;line-height:1.7;">
            &copy; ${new Date().getFullYear()} HRMS &nbsp;&bull;&nbsp;
            This is an automated confirmation of your demo request.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   TEMPLATE 3 — User notified when status changes
   Handles: scheduled, completed (+ feedback ask), cancelled
=============================================================== */
const userStatusUpdateEmail = ({
  fullName, companyName, status, preferredDemoTime,
}) => {
  const cfg = {
    scheduled: {
      gradient: "linear-gradient(135deg,#065f46,#059669,#10b981)",
      banner:   "#f0fdf4", bannerBorder: "#10b981", bannerText: "#065f46",
      bannerMsg: "Your demo has been confirmed — we look forward to meeting you!",
      badgeBg: "#dcfce7", badgeColor: "#166534",
      icon: "&#128197;",
      headline: "Your Demo Is Confirmed!",
      subline:  "Get ready for your personalised HRMS walkthrough.",
    },
    completed: {
      gradient: "linear-gradient(135deg,#1e3a8a,#3b82f6,#06b6d4)",
      banner:   "#eff6ff", bannerBorder: "#3b82f6", bannerText: "#1d4ed8",
      bannerMsg: "Thank you for attending the demo — we hope you found it useful!",
      badgeBg: "#dbeafe", badgeColor: "#1d4ed8",
      icon: "&#10003;",
      headline: "Demo Completed — Thank You!",
      subline:  "We hope the demo was insightful. Here's a summary.",
    },
    cancelled: {
      gradient: "linear-gradient(135deg,#7f1d1d,#b91c1c,#ef4444)",
      banner:   "#fff1f2", bannerBorder: "#ef4444", bannerText: "#b91c1c",
      bannerMsg: "We're sorry this demo had to be cancelled.",
      badgeBg: "#fee2e2", badgeColor: "#991b1b",
      icon: "&#10007;",
      headline: "Demo Request Cancelled",
      subline:  "Your demo request has been cancelled by our team.",
    },
  };

  const c = cfg[status] || cfg.cancelled;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:${c.gradient};padding:40px 32px;text-align:center;">
            <div style="font-size:44px;margin-bottom:10px;color:#ffffff;">${c.icon}</div>
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.75);
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              HRMS — Demo Request Update
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:800;line-height:1.3;">
              ${c.headline}
            </h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              ${c.subline}
            </p>
          </td>
        </tr>

        <!-- Banner -->
        <tr>
          <td style="background:${c.banner};border-bottom:3px solid ${c.bannerBorder};
                     padding:13px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:${c.bannerText};font-weight:600;">
              ${c.bannerMsg}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;font-size:16px;color:#1f2937;">
              Dear <strong>${fullName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.8;">
              ${status === "scheduled"
                ? `Great news! Your demo request for <strong>${companyName}</strong> has been reviewed and confirmed. Please find the details below.`
                : status === "completed"
                  ? `Thank you for attending the HRMS demo for <strong>${companyName}</strong>. We hope it was a valuable experience!`
                  : `We regret to inform you that your demo request for <strong>${companyName}</strong> has been cancelled. We apologise for any inconvenience caused.`}
            </p>

            <!-- Status Card -->
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Status</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:${c.badgeBg};color:${c.badgeColor};
                                   padding:4px 16px;border-radius:20px;
                                   font-size:13px;font-weight:700;">
                        ${statusLabel}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Company</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${companyName}
                    </td>
                  </tr>
                  ${preferredDemoTime
                    ? `<tr style="border-top:1px solid #f1f5f9;">
                         <td style="padding:9px 0;color:#6b7280;">Demo Time</td>
                         <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                           ${fmtDate(preferredDemoTime)}
                         </td>
                       </tr>`
                    : ""}
                </table>
              </td></tr>
            </table>

  

            ${status === "cancelled"
              ? `<table width="100%" cellspacing="0" cellpadding="0"
                        style="background:#fff7ed;border-radius:10px;padding:18px 22px;
                               border:1px solid #fed7aa;margin-bottom:22px;">
                   <tr><td style="text-align:center;">
                     <p style="margin:0 0 4px;font-size:15px;color:#92400e;font-weight:700;">
                       Interested in rescheduling?
                     </p>
                     <p style="margin:0;font-size:14px;color:#b45309;line-height:1.6;">
                       Feel free to submit a new demo request at any time.
                       We'd love the opportunity to walk you through HRMS.
                     </p>
                   </td></tr>
                 </table>`
              : ""}

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
              If you have any questions, feel free to reply to this email or contact
              our support team directly.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;line-height:1.7;">
            &copy; ${new Date().getFullYear()} HRMS &nbsp;&bull;&nbsp;
            This is an automated notification regarding your demo request.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ===============================================================
   TEMPLATE 4 — SuperAdmin notified when a new demo is requested
=============================================================== */
const superAdminNewDemoEmail = ({
  fullName, email, phone, companyName, preferredDemoTime, message,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="padding:40px 15px;">
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
              Super Admin &bull; Demo Requests
            </p>
            <h1 style="margin:0;font-size:27px;color:#ffffff;font-weight:800;line-height:1.3;">
              New Demo Request Received
            </h1>
            <p style="margin:12px 0 0;color:#bfdbfe;font-size:14px;line-height:1.6;">
              A prospect has submitted a demo request on the platform.<br/>
              <strong style="color:#ffffff;">Please review and ensure it is handled promptly.</strong>
            </p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#eff6ff;border-bottom:3px solid #3b82f6;
                     padding:14px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600;">
              A new demo request requires attention — confirm within 24 hours
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">
              <strong>${fullName}</strong> from <strong>${companyName}</strong>
              has submitted a demo request and is awaiting confirmation from your team.
            </p>

            <!-- Requester Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Requester Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f0f9ff;border-radius:10px;padding:18px 20px;
                          border:1px solid #bae6fd;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#0369a1;width:38%;">Full Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${fullName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Email</td>
                    <td style="padding:9px 0;text-align:right;">
                      <a href="mailto:${email}"
                         style="color:#0369a1;text-decoration:none;font-weight:600;">
                        ${email}
                      </a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Phone</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      <a href="tel:${phone}"
                         style="color:#0369a1;text-decoration:none;">${phone}</a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e0f2fe;">
                    <td style="padding:9px 0;color:#0369a1;">Company</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#1d4ed8;">
                      ${companyName}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Demo Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Demo Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">Preferred Time</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${fmtDate(preferredDemoTime)}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Current Status</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#fef9c3;color:#92400e;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:700;">
                        Pending Review
                      </span>
                    </td>
                  </tr>
                  ${message
                    ? `<tr style="border-top:1px solid #e5e7eb;">
                         <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">
                           Message
                         </td>
                         <td style="padding:12px 0 4px;text-align:right;color:#4b5563;
                                     font-style:italic;line-height:1.6;">
                           &ldquo;${message}&rdquo;
                         </td>
                       </tr>`
                    : ""}
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Super Admin Portal</strong> to monitor
              this request and ensure it is actioned by the team.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} HRMS &nbsp;&bull;&nbsp;
            This is an automated escalation notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   HELPER — fire-and-forget email sender (never breaks the API)
=============================================================== */
const sendMail = async (to, subject, html, label) => {
  try {
    await transporter.sendMail({
      from: `"HRMS Team" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ ${label} email sent to: ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send ${label} email:`, err.message);
  }
};

// ─── POST /api/demo-request  →  Submit new demo request (User) ───────────────
router.post("/", async (req, res) => {
  try {
    const { fullName, email, phone, companyName, preferredDemoTime, message } = req.body;

    // Presence check
    if (!fullName || !email || !phone || !companyName || !preferredDemoTime) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    // Validate: must be a valid date string and must be in the future
    const demoDate = new Date(preferredDemoTime);
    if (isNaN(demoDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format for preferred demo time.",
      });
    }
    if (demoDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Preferred demo time must be a future date and time.",
      });
    }

    // Block duplicate pending request from the same email
    const existing = await DemoRequest.findOne({
      email: email.toLowerCase().trim(),
      status: "pending",
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A pending demo request already exists for this email.",
      });
    }

    const demo = await DemoRequest.create({
      fullName,
      email,
      phone,
      companyName,
      preferredDemoTime: demoDate,
      message,
    });

    // ── EMAIL 2: User confirmation
    sendMail(
      email,
      "We've Received Your Demo Request — HRMS",
      userSubmitConfirmationEmail({ fullName, companyName, preferredDemoTime: demoDate, phone, message }),
      "User submission confirmation"
    );

    // ── EMAIL 3: All SuperAdmins (MasterAdmin collection) — same pattern as issueRoutes
    try {
      const masterAdmins = await MasterAdmin.find({}).lean();
      const masterEmails = masterAdmins.map((m) => m.email).filter(Boolean);
      if (masterEmails.length > 0) {
        sendMail(
          masterEmails.join(","),
          `[Demo Request] New Request from ${fullName} — ${companyName}`,
          superAdminNewDemoEmail({ fullName, email, phone, companyName, preferredDemoTime: demoDate, message }),
          "SuperAdmin demo request notification"
        );
      }
    } catch (saErr) {
      console.error("❌ Failed to fetch MasterAdmins for demo email:", saErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Demo request submitted! Our team will confirm within 24 hours.",
      data: {
        id:                demo._id,
        email:             demo.email,
        preferredDemoTime: demo.preferredDemoTime,
        status:            demo.status,
        createdAt:         demo.createdAt,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(422).json({ success: false, message: messages.join(". ") });
    }
    console.error("POST /demo-request:", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

// ─── GET /api/demo-request  →  All requests with filter/search/pagination (Admin) ──
router.get("/", async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (search) {
      filter.$or = [
        { fullName:    { $regex: search, $options: "i" } },
        { email:       { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    const total    = await DemoRequest.countDocuments(filter);
    const requests = await DemoRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.status(200).json({
      success:    true,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data:       requests,
    });
  } catch (error) {
    console.error("GET /demo-request:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch demo requests." });
  }
});

// ─── GET /api/demo-request/:id  →  Single request (Admin) ────────────────────
router.get("/:id", async (req, res) => {
  try {
    const demo = await DemoRequest.findById(req.params.id);
    if (!demo) return res.status(404).json({ success: false, message: "Demo request not found." });
    return res.status(200).json({ success: true, data: demo });
  } catch {
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─── PATCH /api/demo-request/:id/status  →  Update status (Admin) ────────────
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["pending", "scheduled", "completed", "cancelled"];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const updated = await DemoRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Demo request not found." });

    // ── EMAIL: notify user when status changes (skip "pending" re-set)
    if (status !== "pending") {
      // For "completed" status, include a feedback URL
  

      const subjectMap = {
        scheduled: `Your HRMS Demo Is Confirmed — ${updated.companyName}`,
        completed:  `Thank You for Attending the HRMS Demo, ${updated.fullName}!`,
        cancelled:  `Your HRMS Demo Request Has Been Cancelled`,
      };

      sendMail(
        updated.email,
        subjectMap[status],
        userStatusUpdateEmail({
          fullName:          updated.fullName,
          companyName:       updated.companyName,
          status,
          preferredDemoTime: updated.preferredDemoTime,
         
        }),
        `User status update (${status})`
      );
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to "${status}".`,
      data:    updated,
    });
  } catch (error) {
    console.error("PATCH status:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
});

// ─── DELETE /api/demo-request/:id  →  Delete request (Admin) ─────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await DemoRequest.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Demo request not found." });
    return res.status(200).json({ success: true, message: "Demo request deleted." });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete request." });
  }
});

export default router;
// --- END OF FILE routes/demoRequestRoutes.js ---