import express from "express";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";

const router = express.Router();

// =========================================================================
// 1. GLOBAL OFFICE SETTINGS ROUTES
// =========================================================================

// -------------------------------------------------------------------------
// GET: Global Office Settings
// Fetches lat, lng, radius, global mode, categories, and overrides
// -------------------------------------------------------------------------
router.get("/settings/office", async (req, res) => {
  try {
    let settings = await OfficeSettings.findOne({ type: "Global" });
    
    // Create default settings if they don't exist
    if (!settings) {
      settings = await OfficeSettings.create({
        type: "Global",
        officeLocation: { latitude: 0, longitude: 0 },
        allowedRadius: 200,
        globalWorkMode: "WFO",
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

// -------------------------------------------------------------------------
// PUT: Update Global Office Settings
// Updates coordinates, radius, and default work mode
// -------------------------------------------------------------------------
router.put("/settings/office", async (req, res) => {
  try {
    const { officeLocation, allowedRadius, globalWorkMode } = req.body;

    const settings = await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      {
        $set: {
          officeLocation,
          allowedRadius,
          globalWorkMode
        }
      },
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

// -------------------------------------------------------------------------
// PUT: Update Single Employee Work Mode
// Sets a specific mode (WFO/WFH/Global) for one employee
// -------------------------------------------------------------------------
router.put("/settings/employee-mode", async (req, res) => {
  try {
    const { employeeId, mode } = req.body;
    
    if (!employeeId || !mode) {
      return res.status(400).json({ message: "Employee ID and mode are required" });
    }

    // Validate Employee exists
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    // Find existing override index
    const existingIndex = settings.employeeWorkModes.findIndex(
      emp => emp.employeeId === employeeId
    );

    if (existingIndex !== -1) {
      // Update existing
      settings.employeeWorkModes[existingIndex].workMode = mode;
      settings.employeeWorkModes[existingIndex].updatedAt = new Date();
    } else {
      // Create new override
      settings.employeeWorkModes.push({
        employeeId: employee.employeeId,
        employeeName: employee.name,
        workMode: mode,
        updatedAt: new Date()
      });
    }

    await settings.save();
    res.status(200).json({ message: `Work mode updated for ${employee.name}` });
  } catch (error) {
    console.error("Error updating employee mode:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// POST: Bulk Update Employee Work Modes
// Updates multiple employees to a specific mode at once
// -------------------------------------------------------------------------
router.post("/settings/employee-mode/bulk", async (req, res) => {
  try {
    const { employeeIds, mode } = req.body; // Expects array of IDs and mode string

    if (!employeeIds || !Array.isArray(employeeIds) || !mode) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    // Fetch employee details for names
    const employees = await Employee.find({ employeeId: { $in: employeeIds } });

    employees.forEach(emp => {
      const idx = settings.employeeWorkModes.findIndex(e => e.employeeId === emp.employeeId);
      
      if (idx !== -1) {
        settings.employeeWorkModes[idx].workMode = mode;
        settings.employeeWorkModes[idx].updatedAt = new Date();
      } else {
        settings.employeeWorkModes.push({
          employeeId: emp.employeeId,
          employeeName: emp.name,
          workMode: mode,
          updatedAt: new Date()
        });
      }
    });

    await settings.save();
    res.status(200).json({ message: "Bulk update successful" });
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// POST: Reset All Employees to Global
// Clears all individual overrides
// -------------------------------------------------------------------------
router.post("/settings/employee-mode/reset", async (req, res) => {
  try {
    await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      { $set: { employeeWorkModes: [] } } // Clear the array
    );
    res.status(200).json({ message: "All employees reset to Follow Global Settings" });
  } catch (error) {
    console.error("Error resetting modes:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 3. CATEGORY MANAGEMENT ROUTES
// =========================================================================

// -------------------------------------------------------------------------
// POST: Create or Update Category
// Creates a category and moves selected employees into it
// -------------------------------------------------------------------------
router.post("/settings/categories", async (req, res) => {
  try {
    const { name, employeeIds } = req.body;

    if (!name) return res.status(400).json({ message: "Category name required" });

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    // 1. Remove this category if it already exists (to update it)
    settings.categories = settings.categories.filter(c => c.name !== name);
    
    // 2. Remove selected employees from ANY other categories to avoid duplicates
    // (An employee can only belong to one category for this UI logic)
    if (employeeIds && employeeIds.length > 0) {
      settings.categories.forEach(cat => {
        cat.employeeIds = cat.employeeIds.filter(id => !employeeIds.includes(id));
      });
    }

    // 3. Push the new/updated category
    settings.categories.push({
      name,
      employeeIds: employeeIds || []
    });

    await settings.save();
    res.status(200).json({ message: "Category saved successfully", categories: settings.categories });
  } catch (error) {
    console.error("Error saving category:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// DELETE: Delete a Category
// Removes the category completely. Employees become "Uncategorized".
// -------------------------------------------------------------------------
router.delete("/settings/categories/:name", async (req, res) => {
  try {
    const { name } = req.params;
    let settings = await OfficeSettings.findOne({ type: "Global" });

    if (!settings) return res.status(404).json({ message: "Settings not found" });

    // Filter out the specific category
    settings.categories = settings.categories.filter(c => c.name !== name);

    await settings.save();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// PUT: Remove Employee from Category
// Removes a specific employee from a specific category
// -------------------------------------------------------------------------
router.put("/settings/categories/remove-employee", async (req, res) => {
  try {
    const { categoryName, employeeId } = req.body;
    let settings = await OfficeSettings.findOne({ type: "Global" });

    const category = settings.categories.find(c => c.name === categoryName);
    
    if (category) {
      // Remove ID from array
      category.employeeIds = category.employeeIds.filter(id => id !== employeeId);
      await settings.save();
      res.status(200).json({ message: "Employee removed from category" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    console.error("Error removing employee from category:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 4. DATA FETCHING ROUTES
// =========================================================================

// -------------------------------------------------------------------------
// GET: All Employees with Modes and Categories
// Used to populate the Admin Dashboard UI
// -------------------------------------------------------------------------
router.get("/settings/employees-modes", async (req, res) => {
  try {
    // 1. Get all active employees
    const employees = await Employee.find(
      { isActive: true },
      { 
        employeeId: 1, 
        name: 1, 
        email: 1, 
        experienceDetails: 1
      }
    ).sort({ name: 1 });

    // 2. Get Global Settings
    const settings = await OfficeSettings.findOne({ type: "Global" });
    const employeeWorkModes = settings?.employeeWorkModes || [];
    const categories = settings?.categories || [];

    // 3. Merge Data
    const employeesWithData = employees.map(emp => {
      // Find Work Mode Override
      const workModeEntry = employeeWorkModes.find(
        entry => entry.employeeId === emp.employeeId
      );

      // Find Department
      const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present");
      const department = currentExp?.department || "";

      // Find Category (Group)
      const categoryEntry = categories.find(cat => cat.employeeIds.includes(emp.employeeId));

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        department: department,
        personalWorkMode: workModeEntry?.workMode || "Global",
        category: categoryEntry ? categoryEntry.name : "Uncategorized"
      };
    });

    res.status(200).json({
      employees: employeesWithData,
      categories: categories.map(c => c.name) // Send list of category names for tabs
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// GET: Single Employee Mode
// Used by Employee Dashboard to determine permissions
// -------------------------------------------------------------------------
router.get("/settings/employee-mode/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const settings = await OfficeSettings.findOne({ type: "Global" });
    
    if (!settings) {
      return res.status(200).json({ workMode: "Global" });
    }

    const employeeMode = settings.employeeWorkModes.find(
      emp => emp.employeeId === employeeId
    );

    res.status(200).json({
      employeeId,
      workMode: employeeMode?.workMode || "Global"
    });
  } catch (error) {
    console.error("Error fetching employee work mode:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;