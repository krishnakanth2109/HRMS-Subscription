// --- UPDATED FILE: routes/noticeRoutes.js ---

import express from "express";
import Notice from "../models/Notice.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ============================================================================
   📌 ADMIN → GET ALL NOTICES
============================================================================ */
router.get("/all", protect, onlyAdmin, async (req, res) => {
  try {
    const allNotices = await Notice.find().sort({ date: -1 });
    res.json(allNotices);
  } catch (error) {
    console.error("GET All Notices Error:", error);
    res.status(500).json({ message: "Failed to fetch all notices" });
  }
});

/* ============================================================================
   👤 EMPLOYEE + MANAGER → GET Notices Meant For Them
============================================================================ */
router.get("/", protect, async (req, res) => {
  try {
    const employeeId = req.user._id.toString();

    const notices = await Notice.find({
      $or: [
        { recipients: "ALL" },
        { recipients: { $in: [employeeId] } }
      ]
    }).sort({ date: -1 });

    res.json(notices);
  } catch (error) {
    console.error("GET Notices Error:", error);
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* ============================================================================
   📝 ADMIN → CREATE NOTICE
============================================================================ */
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {
    const { title, description, recipients } = req.body;

    const recipientValue = recipients && recipients.length > 0 ? recipients : "ALL";

    const savedNotice = await Notice.create({
      title,
      description,
      date: new Date(),
      createdBy: req.user._id,
      recipients: recipientValue
    });

    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");

    // 🎯 SEND TO SPECIFIC EMPLOYEES
    if (recipientValue !== "ALL" && Array.isArray(recipientValue)) {
      const notifications = [];

      for (const empId of recipientValue) {
        notifications.push({
          userId: empId.toString(),
          title: "New Notice Posted",
          message: title,
          type: "notice"
        });

        const socketId = userSocketMap.get(empId.toString());
        if (socketId) io.to(socketId).emit("newNotice", savedNotice);
      }

      await Notification.insertMany(notifications);
    } 
    else {
      // 🌍 SEND TO ALL EMPLOYEES
      const allEmployees = await Employee.find({}, "_id");

      const notifications = allEmployees.map((emp) => ({
        userId: emp._id.toString(),
        title: "New Notice Posted",
        message: title,
        type: "notice"
      }));

      await Notification.insertMany(notifications);
      io.emit("newNotice", savedNotice);
    }

    res.status(201).json({
      message: "Notice posted successfully",
      notice: savedNotice
    });

  } catch (error) {
    console.error("POST Notice Error:", error);
    res.status(500).json({ message: "Failed to post notice" });
  }
});

/* ============================================================================
   ✏ UPDATE NOTICE → ADMIN ONLY
============================================================================ */
router.put("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const { title, description, recipients } = req.body;

    const updateData = { title, description };

    if (recipients !== undefined) {
      updateData.recipients = recipients.length > 0 ? recipients : "ALL";
    }

    const updatedNotice = await Notice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedNotice) {
      return res.status(404).json({ message: "Notice not found" });
    }

    res.json({
      message: "Notice updated successfully",
      notice: updatedNotice
    });
  } catch (error) {
    console.error("PUT Notice Error:", error);
    res.status(500).json({ message: "Failed to update notice" });
  }
});

/* ============================================================================
   🗑 DELETE NOTICE → ADMIN ONLY
============================================================================ */
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const deletedNotice = await Notice.findByIdAndDelete(req.params.id);

    if (!deletedNotice) {
      return res.status(404).json({ message: "Notice not found" });
    }

    res.json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("DELETE Notice Error:", error);
    res.status(500).json({ message: "Failed to delete notice" });
  }
});

export default router;

// --- END ---
