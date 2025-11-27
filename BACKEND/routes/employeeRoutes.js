// --- START OF FILE routes/employeeRoutes.js ---

import express from "express";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import { upload } from "../config/cloudinary.js"; 

const router = express.Router();

// ============================================================================
// 📂 1. FILE UPLOAD ROUTE
// ============================================================================
router.post("/upload-doc", upload.single("file"), (req, res) => {
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

// ============================================================================
// 👤 2. EMPLOYEE CRUD OPERATIONS
// ============================================================================

// CREATE employee
router.post("/", async (req, res) => {
  try {
    const employee = new Employee(req.body);
    const result = await employee.save();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by employeeId
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee by employeeId
router.put("/:id", async (req, res) => {
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

// DELETE employee by employeeId
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Employee.findOneAndDelete({ employeeId: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DEACTIVATE employee
router.patch("/:id/deactivate", async (req, res) => {
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

// ✅ REACTIVATE employee (Updated to store Date & Reason)
router.patch("/:id/reactivate", async (req, res) => {
  const { date, reason } = req.body; // Capture data from frontend
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { 
        isActive: true, 
        status: "Active", 
        reactivationDate: date,   // Store in DB
        reactivationReason: reason, // Store in DB
        // Optionally keep deactivation history, or clear it. 
        // Here we keep deactivation history but change status.
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/*  
==========================================================
 🔥 IDLE DETECTION ROUTE
==========================================================
*/
router.post("/idle-activity", async (req, res) => {
  try {
    const { employeeId, name, department, role, lastActiveAt } = req.body;

    console.log("📥 Idle Activity:", req.body);

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