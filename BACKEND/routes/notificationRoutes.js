import express from "express";
import Notification from "../models/notificationModel.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply protect middleware to ALL notification routes that need user info
router.use(protect);

/*
===================================================================
 🔹 MARK ALL NOTIFICATIONS READ (For Logged-in Employee Only)
===================================================================
*/
router.patch("/mark-all", async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    await Notification.updateMany(
      { userId },
      { isRead: true }
    );

    const io = req.app.get("io");
    if (io) io.emit("notificationsAllRead", { userId });

    res.json({ message: "All personal notifications marked as read" });
  } catch (err) {
    console.error("PATCH /mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
});

/*
===================================================================
 🔹 MARK SINGLE NOTIFICATION READ
===================================================================
*/
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    const io = req.app.get("io");
    if (io) io.emit("notificationUpdated", updated);

    res.json({ message: "Updated", data: updated });
  } catch (err) {
    console.error("PATCH /:id error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

/*
===================================================================
 🔹 GET ALL NOTIFICATIONS (Admin only? Optional)
===================================================================
*/
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("GET error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

export default router;
