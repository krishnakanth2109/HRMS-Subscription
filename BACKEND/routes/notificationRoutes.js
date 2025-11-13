import express from "express";
import Notification from "../models/notificationModel.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const notifications = await Notification.find().sort({ createdAt: -1 });
  res.json(notifications);
});

router.post("/", async (req, res) => {
  const newNotification = new Notification(req.body);
  await newNotification.save();
  res.json(newNotification);
});

router.patch("/:id", async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, req.body);
  res.json({ message: "Updated" });
});

router.patch("/mark-all", async (req, res) => {
  await Notification.updateMany({}, { isRead: true });
  res.json({ message: "All marked as read" });
});

export default router;
