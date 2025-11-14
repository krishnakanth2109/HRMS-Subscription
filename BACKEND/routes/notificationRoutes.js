import express from "express";
import Notification from "../models/notificationModel.js";

const router = express.Router();

// ===================================================================
// 🔹 MARK ALL NOTIFICATIONS READ  (⚠ MUST BE ABOVE :id ROUTE)
// ===================================================================
router.patch("/mark-all", async (req, res) => {
  try {
    await Notification.updateMany({}, { isRead: true });

    // Optional socket emit
    const io = req.app.get("io");
    if (io) io.emit("notificationsAllRead");

    res.json({ message: "All marked as read" });
  } catch (err) {
    console.error("PATCH mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
});

// ===================================================================
// 🔹 UPDATE SINGLE NOTIFICATION (READ / EDIT)
// ===================================================================
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
    console.error("PATCH notification error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// ===================================================================
// 🔹 GET ALL NOTIFICATIONS
// ===================================================================
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("GET notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// ===================================================================
// 🔹 CREATE NOTIFICATION + EMIT SOCKET EVENT
// ===================================================================
router.post("/", async (req, res) => {
  try {
    const newNotification = await Notification.create(req.body);

    // Socket event
    const io = req.app.get("io");
    if (io) io.emit("newNotification", newNotification);

    res.status(201).json(newNotification);
  } catch (err) {
    console.error("POST notification error:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
});

export default router;
