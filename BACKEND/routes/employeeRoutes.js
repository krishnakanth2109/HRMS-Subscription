import express from "express";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";   // 🆕 added
                   // 🆕 socket

const router = express.Router();

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

// DEACTIVATE employee
router.patch("/deactivate/:id", async (req, res) => {
  const { endDate, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { isActive: false, endDate, reason },
      { new: true }
    );
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REACTIVATE employee
router.patch("/reactivate/:id", async (req, res) => {
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { isActive: true, endDate: "", reason: "" },
      { new: true }
    );
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/*  
==========================================================
 🔥 FINAL IDLE DETECTION ROUTE — FULLY FIXED
==========================================================
*/
router.post("/idle-activity", async (req, res) => {
  try {
    const { employeeId, name, department, role, lastActiveAt } = req.body;

    console.log("📥 Idle Activity:", req.body);

    // 1️⃣ Build message
    const msg = `${name} (${employeeId}) from ${department} is idle since ${new Date(
      lastActiveAt
    ).toLocaleTimeString()}.`;

    // 2️⃣ Save notification to DB (MATCHES YOUR MODEL)
    const notification = await Notification.create({
      userId: "admin",              // Admin receives notification
      title: "Employee Idle Alert", // REQUIRED
      message: msg,                 // REQUIRED
      type: "attendance",           // ✔ Valid enum value
      isRead: false
    });

    // 3️⃣ Socket emit
    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");

    const adminSocket = userSocketMap.get("admin");

    if (adminSocket) {
      io.to(adminSocket).emit("admin-notification", notification);
      console.log("📢 Idle Alert sent → Admin Socket:", adminSocket);
    } else {
      console.log("⚠️ No admin socket connected");
    }

    res.json({ success: true, notification });

  } catch (error) {
    console.error("❌ Idle Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});





export default router;
