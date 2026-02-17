import express from "express";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Admin from "../models/adminModel.js";
import { sendBrevoEmail } from "../Services/emailService.js";
import { protect } from "../controllers/authController.js"; // Added protect middleware

const router = express.Router();

// Helper to get scoping query based on user role (Matching employeeRoutes logic)
const getScopeQuery = (user) => {
  return user.role === 'admin' 
    ? { adminId: user._id } 
    : { company: user.company };
};

// Helper to get Admin ID for Settings (Settings are usually tied to the Admin)
const getAdminId = (user) => {
  return user.role === 'admin' ? user._id : user.adminId;
};

// =========================================================================
// 1. GLOBAL OFFICE SETTINGS ROUTES
// =========================================================================

router.get("/settings/office", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    // Find settings specific to this Admin/Company instead of a generic "Global"
    let settings = await OfficeSettings.findOne({ adminId: adminId });
    
    if (!settings) {
      settings = await OfficeSettings.create({
        adminId: adminId,
        type: "Global", // Keeping the type string but scoped by adminId
        officeLocation: { latitude: 0, longitude: 0 },
        allowedRadius: 200,
        globalWorkMode: "WFO",
        requireAccurateLocation: true,
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

router.put("/settings/office", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const { officeLocation, allowedRadius, globalWorkMode, requireAccurateLocation } = req.body;
    const settings = await OfficeSettings.findOneAndUpdate(
      { adminId: adminId },
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

router.put("/settings/employee-mode", protect, async (req, res) => {
  try {
    const { employeeId, ruleType, mode, fromDate, toDate, days } = req.body;
    const adminId = getAdminId(req.user);

    if (!employeeId || !ruleType) {
      return res.status(400).json({ message: "Employee ID and Rule Type are required" });
    }

    // Ensure employee belongs to this admin/company
    const employeeQuery = { employeeId, ...getScopeQuery(req.user) };
    const employee = await Employee.findOne(employeeQuery);
    if (!employee) return res.status(404).json({ message: "Employee not found in your organization" });

    let settings = await OfficeSettings.findOne({ adminId: adminId });
    if (!settings) settings = new OfficeSettings({ adminId: adminId, type: "Global" });

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

router.post("/settings/employee-mode/bulk", protect, async (req, res) => {
  try {
    const { employeeIds, mode } = req.body;
    const adminId = getAdminId(req.user);

    if (!employeeIds || !Array.isArray(employeeIds) || !mode) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    let settings = await OfficeSettings.findOne({ adminId: adminId });
    if (!settings) settings = new OfficeSettings({ adminId: adminId, type: "Global" });

    // Scoped employee fetch
    const employees = await Employee.find({ 
        employeeId: { $in: employeeIds },
        ...getScopeQuery(req.user)
    });

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

router.post("/settings/employee-mode/reset", protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await OfficeSettings.findOneAndUpdate(
      { adminId: adminId },
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

router.post("/settings/categories", protect, async (req, res) => {
  try {
    const { name, employeeIds } = req.body;
    const adminId = getAdminId(req.user);
    if (!name) return res.status(400).json({ message: "Category name required" });

    let settings = await OfficeSettings.findOne({ adminId: adminId });
    if (!settings) settings = new OfficeSettings({ adminId: adminId, type: "Global" });

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

router.delete("/settings/categories/:name", protect, async (req, res) => {
  try {
    const { name } = req.params;
    const adminId = getAdminId(req.user);
    let settings = await OfficeSettings.findOne({ adminId: adminId });
    if (!settings) return res.status(404).json({ message: "Settings not found" });

    settings.categories = settings.categories.filter(c => c.name !== name);
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
    let settings = await OfficeSettings.findOne({ adminId: adminId });
    const category = settings?.categories.find(c => c.name === categoryName);
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

router.get("/settings/employees-modes", protect, async (req, res) => {
  try {
    // Scoped employee fetch
    const employees = await Employee.find(
        { isActive: true, ...getScopeQuery(req.user) }, 
        { employeeId: 1, name: 1, email: 1, experienceDetails: 1 }
    ).sort({ name: 1 });

    const adminId = getAdminId(req.user);
    const settings = await OfficeSettings.findOne({ adminId: adminId });
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

router.get("/settings/employee-mode/:employeeId", protect, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const adminId = getAdminId(req.user);
    const settings = await OfficeSettings.findOne({ adminId: adminId });

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
// 5. WORK MODE REQUEST ROUTES
// =========================================================================

router.post("/request", protect, async (req, res) => {
  try {
    const {
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    } = req.body;

    const newRequest = new WorkModeRequest({
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason,
      company: req.user.company, // Scope by company
      adminId: req.user.adminId // Hierarchy
    });

    await newRequest.save();

    try {
      // Fetch only admins belonging to THIS company
      const admins = await Admin.find({ _id: req.user.adminId }).lean();
      const adminRecipients = admins.map(admin => ({ name: admin.name, email: admin.email }));

      const specificAdminEmail = "oragantisagar041@gmail.com";
      const alreadyIncluded = adminRecipients.some(a => a.email.toLowerCase() === specificAdminEmail.toLowerCase());

      if (!alreadyIncluded) {
        adminRecipients.push({ name: "Admin", email: specificAdminEmail });
      }

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
          <!-- ... rest of email template ... -->
        </div>
      `;

      if (adminRecipients.length > 0) {
        await sendBrevoEmail({
          to: adminRecipients,
          subject: `Work Mode Request: ${employeeName} - ${requestType}`,
          htmlContent: emailHtml,
        });
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Work Mode Request email:", emailErr);
    }

    res.status(201).json({ message: "Request submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.get("/requests", protect, async (req, res) => {
  try {
    // Scoped request fetch (Admin only sees their company's requests)
    const requests = await WorkModeRequest.find(getScopeQuery(req.user)).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.get("/requests/my/:employeeId", protect, async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/requests/action", protect, async (req, res) => {
  try {
    const { requestId, action } = req.body;
    const adminId = getAdminId(req.user);

    // Verify request belongs to this admin's scope
    const request = await WorkModeRequest.findOne({ _id: requestId, ...getScopeQuery(req.user) });
    if (!request) return res.status(404).json({ message: "Request not found or unauthorized" });

    if (action === "Rejected") {
      request.status = "Rejected";
      await request.save();
      return res.status(200).json({ message: "Request rejected" });
    }

    if (action === "Approved") {
      request.status = "Approved";
      await request.save();

      let settings = await OfficeSettings.findOne({ adminId: adminId });
      if (!settings) settings = new OfficeSettings({ adminId: adminId, type: "Global" });

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

router.delete("/requests/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    await WorkModeRequest.findOneAndDelete({ _id: id, ...getScopeQuery(req.user) });
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;