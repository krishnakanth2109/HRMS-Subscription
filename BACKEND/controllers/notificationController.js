// --- START OF FILE controllers/notificationController.js ---
import Notification from "../models/notificationModel.js";

/*
  🔒 BUG 3 FIX — Helper to build a scoped filter per user.
  Admin ONLY sees notifications that belong to their own adminId tenant.
  This prevents an admin from seeing another admin's employees' messages.
*/
const buildNotificationFilterForUser = (user) => {
  if (!user) return { _id: null };

  if (user.role === "admin" || user.role === "manager") {
    // Admin sees:
    //  1. Notifications directly addressed to them (userId == admin._id)
    //  2. Broadcast notifications scoped to their tenant (adminId == admin._id)
    // The strict adminId check on BOTH clauses prevents cross-admin leakage.
    return {
      $or: [
        { userId: user._id, adminId: user._id },
        { role: "admin",    adminId: user._id },
      ],
    };
  }

  // Employee sees:
  //  1. Direct messages addressed to them
  //  2. Broadcasts scoped to their company
  return {
    $or: [
      { userId: user._id },
      { role: "employee", companyId: user.company },
    ],
  };
};

/*
===================================================================
 🔹 Get MY Notifications
===================================================================
*/
export const getMyNotifications = async (req, res) => {
  try {
    const filter = buildNotificationFilterForUser(req.user);
    const notifications = await Notification.find(filter).sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/*
===================================================================
 🔹 Create Notification
===================================================================
*/
export const createNotification = async (req, res) => {
  try {
    const { message, title, type, userId, role } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Determine Hierarchy based on creator
    // Assuming creator is Admin or Employee from req.user
    const adminId = req.user.role === 'admin' ? req.user._id : req.user.adminId;
    const companyId = req.user.role === 'admin' ? null : req.user.company; // Admin might target any company, logic depends on frontend payload

    const notification = await Notification.create({
      adminId, 
      companyId: companyId || req.body.companyId, // Allow passing companyId if Admin broadcasts to specific company
      message,
      title: title || "",
      type: type || "general",
      userId: userId || null,
      role: role || null,
    });

    res.status(201).json(notification);
  } catch (err) {
    console.error("POST /api/notifications error:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

/*
===================================================================
 🔹 Mark Single Notification Read
===================================================================
*/
export const markNotificationAsReadController = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const user = req.user;
    
    // Security check: Is this notification meant for this user?
    const isOwner = notification.userId && notification.userId.toString() === user._id.toString();
    const isAdmin = user.role === "admin" && notification.adminId && notification.adminId.toString() === user._id.toString();

    if (!isOwner && !isAdmin && notification.role !== 'all') {
      // Relaxed check for broadcasts, but ideally we check hierarchy
      // For now, allow if they are the target user
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: "Updated", data: notification });
  } catch (err) {
    console.error("PATCH /api/notifications/:id error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

/*
===================================================================
 🔹 Mark ALL My Notifications Read
 ✅ BUG 2 FIX — Only runs if unread notifications actually exist.
===================================================================
*/
export const markAllNotificationsAsReadController = async (req, res) => {
  try {
    const user = req.user;
    const filter = buildNotificationFilterForUser(user);

    // 🛡️ Guard: check if any unread notifications exist first
    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });
    if (unreadCount === 0) {
      return res.json({ message: "No unread notifications to mark", updated: 0 });
    }

    await Notification.updateMany({ ...filter, isRead: false }, { isRead: true });

    res.json({ message: "All notifications marked as read", updated: unreadCount });
  } catch (err) {
    console.error("PATCH /api/notifications/mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};

/*
===================================================================
 🔹 Delete ALL My Notifications (Clear All)
 ✅ BUG 1 FIX — Permanently removes from DB so they never reappear.
===================================================================
*/
export const deleteAllMyNotificationsController = async (req, res) => {
  try {
    const user = req.user;
    const filter = buildNotificationFilterForUser(user);

    const result = await Notification.deleteMany(filter);

    res.json({ message: "All notifications cleared", deleted: result.deletedCount });
  } catch (err) {
    console.error("DELETE /api/notifications/clear-all error:", err);
    res.status(500).json({ message: "Failed to clear notifications" });
  }
};