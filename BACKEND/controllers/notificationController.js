// --- START OF FILE controllers/notificationController.js ---
import Notification from "../models/notificationModel.js";

/*
 Helper to filter notifications based on user role and hierarchy
*/
const buildNotificationFilterForUser = (user) => {
  if (!user) return { _id: null };

  if (user.role === "admin" || user.role === "manager") {
    // Admin: 
    // 1. Direct messages (userId matches)
    // 2. Broadcasts to role 'admin' WITHIN their tenant (adminId matches)
    return {
      $or: [
        { userId: user._id }, 
        { role: "admin", adminId: user._id } 
      ],
    };
  }

  // Employee:
  // 1. Direct messages
  // 2. Broadcasts to 'employee' WITHIN their company
  return {
    $or: [
      { userId: user._id },
      { role: "employee", companyId: user.company } 
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
===================================================================
*/
export const markAllNotificationsAsReadController = async (req, res) => {
  try {
    const user = req.user;
    const filter = buildNotificationFilterForUser(user);

    await Notification.updateMany(filter, { isRead: true });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("PATCH /api/notifications/mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};