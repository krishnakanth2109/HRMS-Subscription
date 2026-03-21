// --- START OF FILE routes/officeSettingsRoutes.js ---
import express from "express";
import nodemailer from "nodemailer";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Admin from "../models/adminModel.js";
import { protect } from "../controllers/authController.js";

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
   SCOPE HELPERS
=============================================================== */
const getScopeQuery = (user) =>
  user.role === "admin" ? { adminId: user._id } : { company: user.company };

const getAdminId = (user) =>
  user.role === "admin" ? user._id : user.adminId;

const getCompanyId = (user) =>
  user.company || user.companyId || user._id;

/* ===============================================================
   EMAIL TEMPLATE — Admin notified when employee submits request
=============================================================== */
const adminWorkModeRequestEmail = ({
  employeeName, employeeId, employeeEmail, department,
  requestType, requestedMode, fromDate, toDate, recurringDays, reason,
}) => {
  const formattedDays =
    Array.isArray(recurringDays) && recurringDays.length
      ? recurringDays.join(", ")
      : "N/A";

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#bfdbfe;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
              Work Mode Management
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;">New Work Mode Request</h1>
            <p style="margin:10px 0 0;color:#e0e7ff;font-size:14px;opacity:0.9;">
              Action Required &mdash; Pending Your Approval
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">
              A new work mode request has been submitted by <strong>${employeeName}</strong>
              from the <strong>${department || "N/A"}</strong> department and is awaiting your review.
            </p>

            <!-- Section: Employee Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
              Employee Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:40%;">Full Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">${employeeName}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Employee ID</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${employeeId || "N/A"}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Email Address</td>
                    <td style="padding:9px 0;text-align:right;">
                      <a href="mailto:${employeeEmail}" style="color:#3b82f6;text-decoration:none;font-weight:600;">
                        ${employeeEmail || "N/A"}
                      </a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Department</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${department || "N/A"}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Section: Request Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
              Request Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:40%;">Request Type</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#dbeafe;color:#1d4ed8;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:600;">
                        ${requestType}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Requested Mode</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#ede9fe;color:#5b21b6;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:600;">
                        ${requestedMode}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">From Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${fmtDate(fromDate)}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">To Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${fmtDate(toDate)}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Recurring Days</td>
                    <td style="padding:9px 0;text-align:right;color:#111827;">${formattedDays}</td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">Reason</td>
                    <td style="padding:12px 0 4px;text-align:right;color:#4b5563;font-style:italic;">
                      &ldquo;${reason || "No reason provided."}&rdquo;
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              Please log in to the <strong>Admin Portal</strong> to approve or reject this request.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification. Please do not reply directly.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ===============================================================
   EMAIL TEMPLATE — Employee notified when admin approves/rejects
=============================================================== */
const employeeWorkModeStatusEmail = ({
  employeeName, status, requestType, requestedMode,
  fromDate, toDate, recurringDays, reason, actionBy,
}) => {
  const isApproved     = status === "Approved";
  const statusColor    = isApproved ? "#10b981" : "#ef4444";
  const headerGradient = isApproved
    ? "linear-gradient(135deg,#059669,#10b981)"
    : "linear-gradient(135deg,#b91c1c,#ef4444)";
  const badgeBg        = isApproved ? "#d1fae5" : "#fee2e2";
  const badgeColor     = isApproved ? "#065f46" : "#991b1b";

  const formattedDays =
    Array.isArray(recurringDays) && recurringDays.length
      ? recurringDays.join(", ")
      : "N/A";

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:${headerGradient};padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:2px;text-transform:uppercase;font-weight:600;">
              Work Mode Management
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;">
              Work Mode Request ${status}
            </h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Official Work Mode Notification
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
              Your work mode request has been reviewed and processed. Here is a summary of the decision:
            </p>

            <!-- Status Badge -->
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
              <tr>
                <td align="center">
                  <span style="display:inline-block;background:${badgeBg};color:${badgeColor};
                               padding:10px 32px;border-radius:30px;font-size:16px;font-weight:700;
                               letter-spacing:1px;">
                    ${status.toUpperCase()}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Section: Request Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
              Request Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;border:1px solid #e5e7eb;margin-bottom:22px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:40%;">Decision Status</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:${statusColor};">
                      ${status.toUpperCase()}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Request Type</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${requestType}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Requested Mode</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${requestedMode}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">From Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${fmtDate(fromDate)}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">To Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">${fmtDate(toDate)}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Recurring Days</td>
                    <td style="padding:9px 0;text-align:right;color:#111827;">${formattedDays}</td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Reason Submitted</td>
                    <td style="padding:9px 0;text-align:right;color:#4b5563;font-style:italic;">
                      &ldquo;${reason || "N/A"}&rdquo;
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;">Actioned By</td>
                    <td style="padding:12px 0 4px;text-align:right;font-weight:700;color:#111827;">${actionBy}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
              ${
                isApproved
                  ? "Your schedule has been updated accordingly. For any queries, please contact your manager or HR."
                  : "If you believe this decision was made in error, please reach out to your manager or HR department."
              }
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification regarding your work mode request.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// =========================================================================
// 1. GLOBAL OFFICE SETTINGS ROUTES
// =========================================================================

router.get("/settings/office", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    let settings = await OfficeSettings.findOne({ adminId });

    if (!settings) {
      const payload = {
        adminId,
        companyId: getCompanyId(req.user),
        type: "Global",
        officeLocation: { latitude: 0, longitude: 0 },
        allowedRadius: 200,
        globalWorkMode: "WFO",
        requireAccurateLocation: true,
        employeeWorkModes: [],
        categories: [],
      };

      try {
        settings = await OfficeSettings.create(payload);
      } catch (dbError) {
        if (dbError.code === 11000 && dbError.keyPattern?.type) {
          console.log("🛠️ Dropping restrictive unique index 'type_1'...");
          await OfficeSettings.collection.dropIndex("type_1").catch(() => {});
          settings = await OfficeSettings.create(payload);
        } else {
          throw dbError;
        }
      }
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/office", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const { officeLocation, allowedRadius, globalWorkMode, requireAccurateLocation } = req.body;

    const updateQuery = {
      $set: { officeLocation, allowedRadius, globalWorkMode, requireAccurateLocation },
      $setOnInsert: { companyId: getCompanyId(req.user), type: "Global" },
    };

    let settings;
    try {
      settings = await OfficeSettings.findOneAndUpdate(
        { adminId },
        updateQuery,
        { new: true, upsert: true }
      );
    } catch (dbError) {
      if (dbError.code === 11000 && dbError.keyPattern?.type) {
        console.log("🛠️ Dropping restrictive unique index 'type_1'...");
        await OfficeSettings.collection.dropIndex("type_1").catch(() => {});
        settings = await OfficeSettings.findOneAndUpdate(
          { adminId },
          updateQuery,
          { new: true, upsert: true }
        );
      } else {
        throw dbError;
      }
    }

    res.status(200).json({ message: "Office settings updated successfully", data: settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 2. EMPLOYEE WORK MODE ROUTES
// =========================================================================

router.put("/settings/employee-mode", protect, async (req, res) => {
  try {
    const { employeeId, ruleType, mode, fromDate, toDate, days } = req.body;
    const adminId = getAdminId(req.user);

    if (!employeeId || !ruleType)
      return res.status(400).json({ message: "Employee ID and Rule Type are required" });

    const employee = await Employee.findOne({ employeeId, ...getScopeQuery(req.user) });
    if (!employee) return res.status(404).json({ message: "Employee not found in your organization" });

    let settings = await OfficeSettings.findOne({ adminId });
    if (!settings)
      settings = new OfficeSettings({ adminId, companyId: getCompanyId(req.user), type: "Global" });

    const newConfig = { employeeId: employee.employeeId, employeeName: employee.name, ruleType, updatedAt: new Date() };

    if (ruleType === "Permanent") newConfig.permanentMode = mode;
    else if (ruleType === "Temporary") newConfig.temporary = { mode, fromDate, toDate };
    else if (ruleType === "Recurring") newConfig.recurring = { mode, days };

    const idx = settings.employeeWorkModes.findIndex((e) => e.employeeId === employeeId);
    if (idx !== -1) settings.employeeWorkModes[idx] = newConfig;
    else settings.employeeWorkModes.push(newConfig);

    await settings.save();
    res.status(200).json({ message: `Schedule updated for ${employee.name}` });
  } catch (error) {
    console.error("Error updating employee mode:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.post("/settings/employee-mode/bulk", protect, async (req, res) => {
  try {
    const { employeeIds, mode } = req.body;
    const adminId = getAdminId(req.user);

    if (!employeeIds || !Array.isArray(employeeIds) || !mode)
      return res.status(400).json({ message: "Invalid payload" });

    let settings = await OfficeSettings.findOne({ adminId });
    if (!settings)
      settings = new OfficeSettings({ adminId, companyId: getCompanyId(req.user), type: "Global" });

    const employees = await Employee.find({ employeeId: { $in: employeeIds }, ...getScopeQuery(req.user) });

    employees.forEach((emp) => {
      const config = {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        updatedAt: new Date(),
        ruleType: mode === "Global" ? "Global" : "Permanent",
        permanentMode: mode === "Global" ? undefined : mode,
      };
      const idx = settings.employeeWorkModes.findIndex((e) => e.employeeId === emp.employeeId);
      if (idx !== -1) settings.employeeWorkModes[idx] = config;
      else settings.employeeWorkModes.push(config);
    });

    await settings.save();
    res.status(200).json({ message: "Bulk update successful" });
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.post("/settings/employee-mode/reset", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await OfficeSettings.findOneAndUpdate({ adminId }, { $set: { employeeWorkModes: [] } });
    res.status(200).json({ message: "All employees reset to Global Configuration" });
  } catch (error) {
    console.error("Error resetting modes:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 3. CATEGORY ROUTES
// =========================================================================

router.post("/settings/categories", protect, async (req, res) => {
  try {
    const { name, employeeIds } = req.body;
    const adminId = getAdminId(req.user);
    if (!name) return res.status(400).json({ message: "Category name required" });

    let settings = await OfficeSettings.findOne({ adminId });
    if (!settings)
      settings = new OfficeSettings({ adminId, companyId: getCompanyId(req.user), type: "Global" });

    settings.categories = settings.categories.filter((c) => c.name !== name);
    if (employeeIds?.length) {
      settings.categories.forEach((cat) => {
        cat.employeeIds = cat.employeeIds.filter((id) => !employeeIds.includes(id));
      });
    }
    settings.categories.push({ name, employeeIds: employeeIds || [] });

    await settings.save();
    res.status(200).json({ message: "Category saved", categories: settings.categories });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.delete("/settings/categories/:name", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    let settings = await OfficeSettings.findOne({ adminId });
    if (!settings) return res.status(404).json({ message: "Settings not found" });

    settings.categories = settings.categories.filter((c) => c.name !== req.params.name);
    await settings.save();
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/categories/remove-employee", protect, async (req, res) => {
  try {
    const { categoryName, employeeId } = req.body;
    const adminId = getAdminId(req.user);
    const settings = await OfficeSettings.findOne({ adminId });
    const category = settings?.categories.find((c) => c.name === categoryName);
    if (category) {
      category.employeeIds = category.employeeIds.filter((id) => id !== employeeId);
      await settings.save();
      res.status(200).json({ message: "Employee removed" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 4. DATA FETCHING (EFFECTIVE MODE LOGIC)
// =========================================================================

const calculateEffectiveMode = (settings, empId) => {
  const config = settings.employeeWorkModes.find((e) => e.employeeId === empId);
  if (!config || config.ruleType === "Global") return "Global";

  const today = new Date();

  if (config.ruleType === "Temporary" && config.temporary) {
    const from = new Date(config.temporary.fromDate);
    const to = new Date(config.temporary.toDate);
    today.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return today >= from && today <= to ? config.temporary.mode : "Global";
  }

  if (config.ruleType === "Recurring" && config.recurring) {
    const currentDay = new Date().getDay();
    return config.recurring.days.includes(currentDay) ? config.recurring.mode : "Global";
  }

  if (config.ruleType === "Permanent") return config.permanentMode;

  return "Global";
};

router.get("/settings/employees-modes", protect, async (req, res) => {
  try {
    const employees = await Employee.find(
      { isActive: true, ...getScopeQuery(req.user) },
      { employeeId: 1, name: 1, email: 1, experienceDetails: 1 }
    ).sort({ name: 1 });

    const adminId = getAdminId(req.user);
    const settings = await OfficeSettings.findOne({ adminId });
    const categories = settings?.categories || [];

    const employeesWithData = employees.map((emp) => {
      const config = settings?.employeeWorkModes.find((e) => e.employeeId === emp.employeeId);
      const effectiveMode = settings ? calculateEffectiveMode(settings, emp.employeeId) : "Global";
      const currentExp = emp.experienceDetails?.find((exp) => exp.lastWorkingDate === "Present");
      const categoryEntry = categories.find((cat) => cat.employeeIds.includes(emp.employeeId));

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        department: currentExp?.department || "",
        category: categoryEntry ? categoryEntry.name : "Uncategorized",
        ruleType: config?.ruleType || "Global",
        config: config || {},
        currentEffectiveMode: effectiveMode,
      };
    });

    res.status(200).json({
      employees: employeesWithData,
      categories: categories.map((c) => c.name),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/settings/employee-mode/:employeeId", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const settings = await OfficeSettings.findOne({ adminId });
    if (!settings) return res.status(200).json({ workMode: "Global" });

    const mode = calculateEffectiveMode(settings, req.params.employeeId);
    const finalMode = mode === "Global" ? settings.globalWorkMode : mode;

    res.status(200).json({
      employeeId: req.params.employeeId,
      workMode: finalMode,
      source: mode === "Global" ? "Global Settings" : "Custom Schedule",
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 5. WORK MODE REQUEST ROUTES
// =========================================================================

// =======================================================================
// ✅ EMPLOYEE SUBMITS REQUEST  →  Email to scoped Admin ONLY (via SMTP)
// =======================================================================
router.post("/request", protect, async (req, res) => {
  try {
    const {
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason,
    } = req.body;

    // 1. Save request (hierarchy preserved)
    const newRequest = new WorkModeRequest({
      employeeId,
      employeeName,
      department,
      requestType,
      fromDate,
      toDate,
      recurringDays,
      requestedMode,
      reason,
      companyId: getCompanyId(req.user),
      adminId:   getAdminId(req.user),
    });
    await newRequest.save();

    // 2. Find scoped admin only
    const admin = await Admin.findById(getAdminId(req.user)).lean();

    if (admin?.email) {
      try {
        await transporter.sendMail({
          from:    `"HRMS Work Mode Notification" <${process.env.SMTP_USER}>`,
          to:      admin.email,
          subject: `New Work Mode Request from ${employeeName}`,
          html:    adminWorkModeRequestEmail({
            employeeName,
            employeeId,
            employeeEmail: req.user.email,
            department,
            requestType,
            requestedMode,
            fromDate,
            toDate,
            recurringDays,
            reason,
          }),
        });
        console.log(`✅ Work mode request email sent to admin: ${admin.email}`);
      } catch (emailErr) {
        console.error("❌ Failed to send work mode request email to admin:", emailErr);
      }
    }

    res.status(201).json({ message: "Request submitted successfully" });
  } catch (error) {
    console.error("WorkMode /request error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =======================================================================
// GET ALL REQUESTS (scoped)
// =======================================================================
router.get("/requests", protect, async (req, res) => {
  try {
    const requests = await WorkModeRequest.find(getScopeQuery(req.user)).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =======================================================================
// GET EMPLOYEE'S OWN REQUESTS
// =======================================================================
router.get("/requests/my/:employeeId", protect, async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =======================================================================
// ✅ ADMIN ACTION (Approve / Reject)  →  Email to Employee (via SMTP)
// =======================================================================
router.put("/requests/action", protect, async (req, res) => {
  try {
    const { requestId, action } = req.body;
    const adminId = getAdminId(req.user);

    if (!["Approved", "Rejected"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'Approved' or 'Rejected'." });
    }

    // Scoped lookup — admin can only act on their own records
    const request = await WorkModeRequest.findOne({ _id: requestId, ...getScopeQuery(req.user) });
    if (!request) return res.status(404).json({ message: "Request not found or unauthorized" });

    request.status   = action;
    request.actionBy = req.user.name;
    await request.save();

    // If approved → apply the schedule to OfficeSettings
    if (action === "Approved") {
      let settings = await OfficeSettings.findOne({ adminId });
      if (!settings)
        settings = new OfficeSettings({ adminId, companyId: getCompanyId(req.user), type: "Global" });

      const newConfig = {
        employeeId:   request.employeeId,
        employeeName: request.employeeName,
        ruleType:     request.requestType,
        updatedAt:    new Date(),
      };

      if (request.requestType === "Permanent") {
        newConfig.permanentMode = request.requestedMode;
      } else if (request.requestType === "Temporary") {
        newConfig.temporary = { mode: request.requestedMode, fromDate: request.fromDate, toDate: request.toDate };
      } else if (request.requestType === "Recurring") {
        newConfig.recurring = { mode: request.requestedMode, days: request.recurringDays };
      }

      const existingIdx = settings.employeeWorkModes.findIndex((e) => e.employeeId === request.employeeId);
      if (existingIdx !== -1) settings.employeeWorkModes[existingIdx] = newConfig;
      else settings.employeeWorkModes.push(newConfig);

      await settings.save();
    }

    // Find employee to send email
    const employee = await Employee.findOne({ employeeId: request.employeeId });

    if (employee?.email) {
      try {
        await transporter.sendMail({
          from:    `"Work Mode Management" <${process.env.SMTP_USER}>`,
          to:      employee.email,
          subject: `Work Mode Request ${action}`,
          html:    employeeWorkModeStatusEmail({
            employeeName:  employee.name,
            status:        action,
            requestType:   request.requestType,
            requestedMode: request.requestedMode,
            fromDate:      request.fromDate,
            toDate:        request.toDate,
            recurringDays: request.recurringDays,
            reason:        request.reason,
            actionBy:      req.user.name,
          }),
        });
        console.log(`✅ Work mode ${action.toLowerCase()} email sent to employee: ${employee.email}`);
      } catch (emailErr) {
        console.error(`❌ Failed to send work mode ${action.toLowerCase()} email:`, emailErr);
      }
    }

    return res.status(200).json({
      message: action === "Approved"
        ? "Request approved and schedule updated"
        : "Request rejected",
    });
  } catch (error) {
    console.error("WorkMode /requests/action error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =======================================================================
// DELETE REQUEST (scoped)
// =======================================================================
router.delete("/requests/:id", protect, async (req, res) => {
  try {
    await WorkModeRequest.findOneAndDelete({ _id: req.params.id, ...getScopeQuery(req.user) });
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;
// --- END OF FILE routes/officeSettingsRoutes.js ---