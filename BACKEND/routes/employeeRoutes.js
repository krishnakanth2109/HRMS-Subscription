// --- START OF FILE: routes/employeeRoutes.js ---

import express from "express";
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import { upload } from "../config/cloudinary.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ==============================================================
==============
 📁 1. FILE UPLOAD ROUTE
 ✅ FIX: Removed 'onlyAdmin' so regular employees can upload documents
=================================================================
=========== */
router.post("/upload-doc", protect, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // Return the Cloudinary URL (or local path)
    res.status(200).json({ url: req.file.path });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==============================================================
==============
 👤 2. EMPLOYEE CRUD
=================================================================
=========== */

// CREATE employee → ADMIN ONLY
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {

    // ✅ USE COMPANY'S employeeCount COUNTER (ensures ID consistency)
    // ✅ USE COMPANY'S employeeCount COUNTER (ensures ID consistency)
    if (req.body.company) {
      // Find the company to get the prefix
      const company = await Company.findById(req.body.company);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // ✅ RE-COUNT ACTUAL EMPLOYEES to ensure ID accuracy
      const currentCount = await Employee.countDocuments({ company: req.body.company });

      // Generate employee ID: prefix + (count + 1) with zero padding
      const paddedCount = String(currentCount + 1).padStart(2, "0");
      req.body.employeeId = `${company.prefix}${paddedCount}`;

      // Update company count to be consistent (optional but good for sync)
      company.employeeCount = currentCount + 1;
      await company.save();
    } else {
      // Fallback for unexpected cases where company is missing but creation proceeds?
      // Ideally should fail if company is required. The model likely requires it.
      // Assuming the model validation handles "required: true" for company.
    }

    const employee = new Employee(req.body);
    const result = await employee.save();
    res.status(201).json(result);
  } catch (err) {
    console.error("❌ Employee creation error:", err);
    console.error("Full error details:", err.errors || err.message);

    // Handle duplicate key error (e.g., duplicate email)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate value entered for ${field}. Please use a different one.`,
        field: field
      });
    }

    res.status(500).json({
      error: err.message,
      details: err.errors ? Object.keys(err.errors).map(key => err.errors[key].message) : undefined
    });
  }
});

// GET all employees → Authenticated users allowed
router.get("/", protect, async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by ID → Authenticated users allowed
router.get("/:id", protect, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee
// ✅ FIX: Allow Admin OR the Employee themselves to update the profile
router.put("/:id", protect, async (req, res) => {
  try {
    // 1. Check if user is Admin
    const isAdmin = req.user.role === "admin";

    // 2. Check if user is updating their OWN profile
    // (Ensure req.user.employeeId is populated by your protect middleware)
    const isSelf = req.user.employeeId === req.params.id;

    // 3. If not admin and not self, reject
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const updated = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Employee not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE employee → ADMIN ONLY
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    // 1. Find the employee to be deleted
    const employeeToDelete = await Employee.findOne({ employeeId: req.params.id });

    if (!employeeToDelete) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const companyId = employeeToDelete.company;
    const deletedId = employeeToDelete.employeeId;

    // 2. Find the company to get the prefix (essential for parsing IDs)
    const company = await Company.findById(companyId);
    if (!company) {
      // If company doesn't exist, just delete the employee (fallback)
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (Company not found, IDs not shifted)" });
    }

    // 3. Extract the numeric part of the deleted employee's ID
    // Assuming ID format is PREFIX + Number (e.g., VAG01)
    const prefixLength = company.prefix.length;
    const deletedNumber = parseInt(deletedId.slice(prefixLength), 10);

    if (isNaN(deletedNumber)) {
      // Fallback if ID format is unexpected
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (ID format invalid for shifting)" });
    }

    // 4. Delete the employee
    await Employee.findOneAndDelete({ employeeId: req.params.id });

    // 5. Find all remaining employees of this company
    const siblings = await Employee.find({ company: companyId });

    // 6. Iterate and shift IDs for those with number > deletedNumber
    const updatePromises = siblings.map(async (emp) => {
      const currentNum = parseInt(emp.employeeId.slice(prefixLength), 10);

      if (!isNaN(currentNum) && currentNum > deletedNumber) {
        const newNum = currentNum - 1;
        // Pad with 0 to match existing format (2 digits minimum)
        const newId = `${company.prefix}${String(newNum).padStart(2, "0")}`;

        emp.employeeId = newId;
        return emp.save(); // Save the updated employee
      }
    });

    await Promise.all(updatePromises);

    // 7. Decrement the company's employeeCount
    if (company.employeeCount > 0) {
      company.employeeCount -= 1;
      await company.save();
    }

    res.status(200).json({
      message: "Employee deleted and subsequent IDs shifted successfully",
      adjustedCount: company.employeeCount
    });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
==============
 🔐 DEACTIVATE / REACTIVATE → ADMIN ONLY
=================================================================
=========== */

router.patch("/:id/deactivate", protect, onlyAdmin, async (req, res) => {
  const { endDate, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      {
        isActive: false,
        status: "Inactive",
        deactivationDate: endDate,
        deactivationReason: reason
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/reactivate", protect, onlyAdmin, async (req, res) => {
  const { date, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      {
        isActive: true,
        status: "Active",
        reactivationDate: date,
        reactivationReason: reason
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
==============
 🔥 IDLE DETECTION → SYSTEM GENERATED
=================================================================
=========== */
router.post("/idle-activity", protect, async (req, res) => {
  try {
    const { employeeId, name, department, role, lastActiveAt } = req.body;

    const msg = `${name} (${employeeId}) from ${department} is idle since ${new Date(
      lastActiveAt
    ).toLocaleTimeString()}.`;

    const notification = await Notification.create({
      userId: "admin",
      title: "Employee Idle Alert",
      message: msg,
      type: "attendance",
      isRead: false
    });

    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");
    const adminSocket = userSocketMap.get("admin");

    if (adminSocket) {
      io.to(adminSocket).emit("admin-notification", notification);
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error("❌ Idle Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// --- END OF FILE routes/employeeRoutes.js ---
