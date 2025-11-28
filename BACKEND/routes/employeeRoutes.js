// --- UPDATED FILE: routes/employeeRoutes.js ---

import express from "express";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import { upload } from "../config/cloudinary.js"; 
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ============================================================================
 📂 1. FILE UPLOAD ROUTE  → ONLY ADMIN
============================================================================ */
router.post("/upload-doc", protect, onlyAdmin, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.status(200).json({ url: req.file.path });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ============================================================================
 👤 2. EMPLOYEE CRUD (ADMIN ONLY)
============================================================================ */

// CREATE employee  → ADMIN ONLY
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {
    const employee = new Employee(req.body);
    const result = await employee.save();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all employees → ADMIN + MANAGER allowed
router.get("/", protect, async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by ID → ADMIN + MANAGER allowed
router.get("/:id", protect, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee → ADMIN ONLY
router.put("/:id", protect, onlyAdmin, async (req, res) => {
  try {
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
    const deleted = await Employee.findOneAndDelete({ employeeId: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================================
 🔒 DEACTIVATE / REACTIVATE → ADMIN ONLY
============================================================================ */

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

/* ============================================================================
 🔥 IDLE DETECTION → MANAGER CAN’T CREATE, BUT THIS IS SYSTEM GENERATED
============================================================================ */
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
