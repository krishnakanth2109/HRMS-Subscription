// --- UPDATED FILE: routes/notificationRoutes.js ---

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

import {
  getMyNotifications,
  createNotification,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
} from "../controllers/notificationController.js";

const router = express.Router();

/* ============================================================
   🔐 ALL ROUTES REQUIRE LOGIN
============================================================ */
router.use(protect);

/* ============================================================
   👤 ADMIN + MANAGER + EMPLOYEE → VIEW MY NOTIFICATIONS
============================================================ */
router.get("/", getMyNotifications);

/* ============================================================
   🟥 ADMIN ONLY → CREATE / SEND NOTIFICATION
============================================================ */
router.post("/", onlyAdmin, createNotification);

/* ============================================================
   👤 ALL USERS → MARK A NOTIFICATION AS READ
============================================================ */
router.patch("/:id", markNotificationAsReadController);

/* ============================================================
   👤 ALL USERS → MARK ALL NOTIFICATIONS READ
============================================================ */
router.post("/mark-all", markAllNotificationsAsReadController);

export default router;

// --- END ---
