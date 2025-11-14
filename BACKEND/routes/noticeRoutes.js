import express from "express";
import Notice from "../models/Notice.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// ===================================================================
// GET ALL NOTICES
// ===================================================================
router.get("/", async (req, res) => {
  try {
    const notices = await Notice.find().sort({ date: -1 });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

// ===================================================================
// POST NEW NOTICE (ADMIN ONLY)
// ===================================================================
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can post notices" });
    }

    const { title, description } = req.body;

    // 1️⃣ Save notice
    const savedNotice = await Notice.create({
      title,
      description,
      date: new Date(),
      createdBy: req.user.name,
    });

    // 2️⃣ Fetch all employees
    const employees = await Employee.find({}, "_id name employeeId");

    // 3️⃣ Create notification for every employee
    const notificationsToInsert = employees.map((emp) => ({
      userId: emp._id.toString(),           // ✅ FIX: Use Mongo _id
      title: "New Notice Posted",
      message: title,
      type: "notice",                        // ✅ Now allowed in enum
      isRead: false,
      date: new Date(),
    }));

    await Notification.insertMany(notificationsToInsert);

    // 4️⃣ Emit real-time notice to all connected sockets
    const io = req.app.get("io");
    if (io) {
      io.emit("newNotice", {
        title,
        description,
        date: savedNotice.date,
      });
    }

    res.status(201).json({
      message: "Notice posted & notifications sent to all employees",
      notice: savedNotice,
    });
  } catch (error) {
    console.error("POST Notice Error:", error);
    res.status(500).json({ message: "Failed to post notice" });
  }
});

export default router;
