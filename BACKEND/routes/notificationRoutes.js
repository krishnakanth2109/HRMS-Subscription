// --- START OF FILE routes/notificationRoutes.js ---
import express from "express";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import {
  getMyNotifications,
  createNotification,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect); // Ensure logged in

router.get("/", getMyNotifications);
router.post("/", onlyAdmin, createNotification);
router.patch("/:id", markNotificationAsReadController);
router.post("/mark-all", markAllNotificationsAsReadController);

export default router;