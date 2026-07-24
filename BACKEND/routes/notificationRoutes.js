// --- START OF FILE routes/notificationRoutes.js ---
import express from "express";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import {
  getMyNotifications,
  createNotification,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
  deleteAllMyNotificationsController, // ✅ BUG 1 FIX — new controller
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect); // Ensure logged in

router.get("/", getMyNotifications);
router.post("/", onlyAdmin, createNotification);
router.patch("/:id", markNotificationAsReadController);
router.post("/mark-all", markAllNotificationsAsReadController);

// ✅ BUG 1 FIX — DELETE /api/notifications/clear-all
// Permanently removes all of the logged-in user's notifications from the DB.
// Must come BEFORE "/:id" to avoid route conflict.
router.delete("/clear-all", deleteAllMyNotificationsController);

export default router;