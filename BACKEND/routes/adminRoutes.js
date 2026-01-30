import express from "express";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Admin from "../models/adminModel.js";
import { sendBrevoEmail } from "../Services/emailService.js";

const router = express.Router();

// =========================================================================
// 1. GLOBAL OFFICE SETTINGS ROUTES
// =========================================================================

router.get("/settings/office", async (req, res) => {
  try {
    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) {
      settings = await OfficeSettings.create({
        type: "Global",
        officeLocation: { latitude: 0, longitude: 0 },
        allowedRadius: 200,
        globalWorkMode: "WFO",
        requireAccurateLocation: true, // NEW: Default enabled
        employeeWorkModes: [],
        categories: []
      });
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/office", async (req, res) => {
  try {
    const { officeLocation, allowedRadius, globalWorkMode, requireAccurateLocation } = req.body;
    const settings = await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      { $set: { officeLocation, allowedRadius, globalWorkMode, requireAccurateLocation } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Office settings updated successfully", data: settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 2. EMPLOYEE WORK MODE ROUTES
// =========================================================================

// Update Single Employee Work Mode (Advanced Schedules)
router.put("/settings/employee-mode", async (req, res) => {
  try {
    const {
      employeeId,
      ruleType,
      mode,
      fromDate,
      toDate,
      days
    } = req.body;

    if (!employeeId || !ruleType) {
      return res.status(400).json({ message: "Employee ID and Rule Type are required" });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    const newConfig = {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      ruleType: ruleType,
      updatedAt: new Date()
    };

    if (ruleType === "Permanent") {
      newConfig.permanentMode = mode;
    } else if (ruleType === "Temporary") {
      newConfig.temporary = { mode, fromDate, toDate };
    } else if (ruleType === "Recurring") {
      newConfig.recurring = { mode, days };
    }

    const existingIndex = settings.employeeWorkModes.findIndex(e => e.employeeId === employeeId);
    if (existingIndex !== -1) {
      settings.employeeWorkModes[existingIndex] = newConfig;
    } else {
      settings.employeeWorkModes.push(newConfig);
    }

    await settings.save();
    res.status(200).json({ message: `Schedule updated for ${employee.name}` });
  } catch (error) {
    console.error("Error updating employee mode:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Bulk Update
router.post("/settings/employee-mode/bulk", async (req, res) => {
  try {
    const { employeeIds, mode } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || !mode) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    const employees = await Employee.find({ employeeId: { $in: employeeIds } });

    employees.forEach(emp => {
      const idx = settings.employeeWorkModes.findIndex(e => e.employeeId === emp.employeeId);
      const config = {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        updatedAt: new Date(),
        ruleType: mode === 'Global' ? 'Global' : 'Permanent',
        permanentMode: mode === 'Global' ? undefined : mode
      };

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

// Reset All
router.post("/settings/employee-mode/reset", async (req, res) => {
  try {
    await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      { $set: { employeeWorkModes: [] } }
    );
    res.status(200).json({ message: "All employees reset to Global Configuration" });
  } catch (error) {
    console.error("Error resetting modes:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 3. CATEGORY ROUTES
// =========================================================================
router.post("/settings/categories", async (req, res) => {
  try {
    const { name, employeeIds } = req.body;
    if (!name) return res.status(400).json({ message: "Category name required" });

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    settings.categories = settings.categories.filter(c => c.name !== name);
    if (employeeIds && employeeIds.length > 0) {
      settings.categories.forEach(cat => {
        cat.employeeIds = cat.employeeIds.filter(id => !employeeIds.includes(id));
      });
    }
    settings.categories.push({ name, employeeIds: employeeIds || [] });

    await settings.save();
    res.status(200).json({ message: "Category saved", categories: settings.categories });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.delete("/settings/categories/:name", async (req, res) => {
  try {
    const { name } = req.params;
    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) return res.status(404).json({ message: "Settings not found" });

    settings.categories = settings.categories.filter(c => c.name !== name);
    await settings.save();
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/categories/remove-employee", async (req, res) => {
  try {
    const { categoryName, employeeId } = req.body;
    let settings = await OfficeSettings.findOne({ type: "Global" });
    const category = settings.categories.find(c => c.name === categoryName);
    if (category) {
      category.employeeIds = category.employeeIds.filter(id => id !== employeeId);
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
// 4. DATA FETCHING (LOGIC FOR EFFECTIVE MODE)
// =========================================================================

const calculateEffectiveMode = (settings, empId) => {
  const config = settings.employeeWorkModes.find(e => e.employeeId === empId);
  if (!config || config.ruleType === "Global") return "Global";

  const today = new Date();

  if (config.ruleType === "Temporary" && config.temporary) {
    const from = new Date(config.temporary.fromDate);
    const to = new Date(config.temporary.toDate);
    today.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    if (today >= from && today <= to) {
      return config.temporary.mode;
    } else {
      return "Global";
    }
  }

  if (config.ruleType === "Recurring" && config.recurring) {
    const currentDay = new Date().getDay();
    if (config.recurring.days.includes(currentDay)) {
      return config.recurring.mode;
    } else {
      return "Global";
    }
  }

  if (config.ruleType === "Permanent") {
    return config.permanentMode;
  }

  return "Global";
};

router.get("/settings/employees-modes", async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }, { employeeId: 1, name: 1, email: 1, experienceDetails: 1 }).sort({ name: 1 });
    const settings = await OfficeSettings.findOne({ type: "Global" });
    const categories = settings?.categories || [];

    const employeesWithData = employees.map(emp => {
      const config = settings?.employeeWorkModes.find(e => e.employeeId === emp.employeeId);
      const effectiveMode = settings ? calculateEffectiveMode(settings, emp.employeeId) : "Global";
      const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present");
      const categoryEntry = categories.find(cat => cat.employeeIds.includes(emp.employeeId));

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        department: currentExp?.department || "",
        category: categoryEntry ? categoryEntry.name : "Uncategorized",
        ruleType: config?.ruleType || "Global",
        config: config || {},
        currentEffectiveMode: effectiveMode
      };
    });

    res.status(200).json({
      employees: employeesWithData,
      categories: categories.map(c => c.name)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/settings/employee-mode/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const settings = await OfficeSettings.findOne({ type: "Global" });

    if (!settings) return res.status(200).json({ workMode: "Global" });

    const mode = calculateEffectiveMode(settings, employeeId);
    const finalMode = mode === "Global" ? settings.globalWorkMode : mode;

    res.status(200).json({
      employeeId,
      workMode: finalMode,
      source: mode === "Global" ? "Global Settings" : "Custom Schedule"
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 5. WORK MODE REQUEST ROUTES (✅ NEWLY ADDED TO FIX 404)
// =========================================================================

// A. Submit Request (For Employee Side)
router.post("/request", async (req, res) => {
  try {
    const {
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    } = req.body;

    const newRequest = new WorkModeRequest({
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    });

    await newRequest.save();

    // ----------------------------------------------------
    // EMAIL NOTIFICATION LOGIC
    // ----------------------------------------------------
    try {
      // 1. Fetch all admins
      const admins = await Admin.find().lean();

      // 2. Prepare recipients list
      const adminRecipients = admins.map(admin => ({ name: admin.name, email: admin.email }));

      // 3. Explicitly add 'oragantisagar041@gmail.com'
      const specificAdminEmail = "oragantisagar041@gmail.com";
      const alreadyIncluded = adminRecipients.some(a => a.email.toLowerCase() === specificAdminEmail.toLowerCase());

      console.log("📧 WorkMode Email Debug: Found Admins count:", admins.length);

      if (!alreadyIncluded) {
        console.log("📧 WorkMode Email Debug: Adding specific admin manually:", specificAdminEmail);
        adminRecipients.push({ name: "Admin", email: specificAdminEmail });
      }

      console.log("📧 WorkMode Email Debug: Final Recipients:", adminRecipients.map(r => r.email));

      // 4. Construct Email Content
      let dateInfo = "N/A";
      if (requestType === "Temporary") {
        dateInfo = `${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
      } else if (requestType === "Recurring") {
        dateInfo = `Every ${recurringDays ? recurringDays.join(", ") : "N/A"}`;
      } else if (requestType === "Permanent") {
        dateInfo = "Starting immediately (Permanent)";
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #4f46e5;">New Work Mode Request</h2>
          <p><strong>${employeeName}</strong> (ID: ${employeeId}) has requested a change in work mode.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Name:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Department:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${department || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Requested Mode:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${requestedMode}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Request Type:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${requestType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date/Duration:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${dateInfo}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason || "No reason provided"}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please login to the Admin Portal to approve or reject this request.</p>
        </div>
      `;

      // 5. Send Email
      if (adminRecipients.length > 0) {
        console.log("📧 WorkMode Email Debug: Attempting to send...");
        const response = await sendBrevoEmail({
          to: adminRecipients,
          subject: `Work Mode Request: ${employeeName} - ${requestType}`,
          htmlContent: emailHtml,
        });
        console.log("📧 WorkMode Email Debug: Email Response:", response);
      } else {
        console.log("📧 WorkMode Email Debug: No recipients to send to.");
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Work Mode Request email:", emailErr);
    }

    res.status(201).json({ message: "Request submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// B. Get All Requests (For Admin - History & Pending)
// Matches frontend: /api/admin/requests
router.get("/requests", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find().sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// C. Get Employee Requests (For Employee History)
router.get("/requests/my/:employeeId", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// D. Approve or Reject Request
router.put("/requests/action", async (req, res) => {
  try {
    const { requestId, action } = req.body; // "Approved" or "Rejected"

    const request = await WorkModeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (action === "Rejected") {
      request.status = "Rejected";
      await request.save();
      return res.status(200).json({ message: "Request rejected" });
    }

    if (action === "Approved") {
      request.status = "Approved";
      await request.save();

      // Update Actual Office Settings based on request
      let settings = await OfficeSettings.findOne({ type: "Global" });
      if (!settings) settings = new OfficeSettings({ type: "Global" });

      const newConfig = {
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        ruleType: request.requestType,
        updatedAt: new Date()
      };

      if (request.requestType === "Permanent") {
        newConfig.permanentMode = request.requestedMode;
      } else if (request.requestType === "Temporary") {
        newConfig.temporary = {
          mode: request.requestedMode,
          fromDate: request.fromDate,
          toDate: request.toDate
        };
      } else if (request.requestType === "Recurring") {
        newConfig.recurring = {
          mode: request.requestedMode,
          days: request.recurringDays
        };
      }

      const existingIndex = settings.employeeWorkModes.findIndex(e => e.employeeId === request.employeeId);
      if (existingIndex !== -1) {
        settings.employeeWorkModes[existingIndex] = newConfig;
      } else {
        settings.employeeWorkModes.push(newConfig);
      }

      await settings.save();
      return res.status(200).json({ message: "Request approved and schedule updated" });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// E. Delete Request
router.delete("/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await WorkModeRequest.findByIdAndDelete(id);
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;