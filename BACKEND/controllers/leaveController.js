// --- START OF FILE controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";

// Helper: List dates
function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ===================================================================================
// ✅ EMPLOYEE CREATES LEAVE
// ===================================================================================
export const createLeave = async (req, res) => {
  try {
    const loggedUser = req.user; // employee or admin
    const { _id: userMongoId, name } = loggedUser;

    const { from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);

    const details = listDates(from, to).map((date) => ({
      date,
      leavecategory: "UnPaid",
      leaveType,
      leaveDayType: from === to ? leaveDayType : "Full Day",
    }));

    // CREATE LEAVE REQUEST
    const doc = await LeaveRequest.create({
      employeeId: loggedUser.employeeId || null,
      employeeName: loggedUser.name || "Unknown",
      from,
      to,
      reason,
      leaveType,
      leaveDayType,
      halfDaySession,
      monthKey,
      status: "Pending",
      approvedBy: "-",
      actionDate: "-",
      requestDate: new Date().toISOString().slice(0, 10),
      details,
    });

    // 🔥 FIND ALL ADMINS
    const admins = await Admin.find().lean();

    // 🔥 CREATE NOTIFICATION FOR EACH ADMIN
    const notifList = [];

    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id.toString(), // 📌 Store _id only
        title: "New Leave Request",
        message: `${name} submitted a leave request (${from} → ${to})`,
        type: "leave",
        isRead: false,
      });
      notifList.push(notif);
    }

    // 🔥 EMIT REAL-TIME NOTIFICATIONS
    const io = req.app.get("io");
    if (io) {
      notifList.forEach((n) => io.emit("newNotification", n));
    }

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave request." });
  }
};

// ===================================================================================
// FETCH USER LEAVES
// ===================================================================================
export const listLeavesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { month, status } = req.query;

    const query = { employeeId };

    if (month) query.monthKey = month;
    if (status && status !== "All") query.status = status;

    const docs = await LeaveRequest.find(query).sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("listLeavesForEmployee error:", err);
    res.status(500).json({ message: "Failed to fetch your leave requests." });
  }
};

// ===================================================================================
// ADMIN LIST ALL LEAVES
// ===================================================================================
export const adminListAllLeaves = async (req, res) => {
  try {
    const docs = await LeaveRequest.find().sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListAllLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ===================================================================================
// GET DETAILS
// ===================================================================================
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });

    const isAdmin = req.user.role === "admin";
    const isOwner = doc.employeeId === req.user.employeeId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(doc.details || []);
  } catch (err) {
    console.error("getLeaveDetails error:", err);
    res.status(500).json({ message: "Failed to fetch leave details." });
  }
};

// ===================================================================================
// ADMIN UPDATES LEAVE STATUS
// ===================================================================================
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name;

    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy, actionDate: new Date().toISOString().slice(0, 10) },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Not found" });

    // 🔥 NOTIFY EMPLOYEE
    const employee = await Employee.findOne({ employeeId: doc.employeeId });

    if (employee) {
      const notif = await Notification.create({
        userId: employee._id.toString(),
        title: "Leave Status Updated",
        message: `Your leave request has been ${status} by ${approvedBy}`,
        type: "leave-status",
        isRead: false,
      });

      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);
    }

    return res.json(doc);
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
  // ===================================================================================
  // 🔥 SEND NOTIFICATION TO EMPLOYEE WHEN ADMIN UPDATES STATUS
  // ===================================================================================
  const employee = await Employee.findOne({ employeeId: doc.employeeId });

  if (employee) {
    const notif = await Notification.create({
      userId: employee._id.toString(),
      title: "Leave Status Update",
      message: `Your leave request from ${doc.from} to ${doc.to} has been ${status} by ${approvedBy}.`,
      type: "leave-status",
      isRead: false,
    });

    const io = req.app.get("io");
    if (io) io.emit("newNotification", notif);
  }

};

// ===================================================================================
// EMPLOYEE CANCEL LEAVE
// ===================================================================================
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });

    if (leave.status !== "Pending") {
      return res.status(400).json({ message: "Cannot cancel this leave" });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);

    // 🔥 Notify all admins
    const admins = await Admin.find().lean();
    const notifList = [];

    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id.toString(),
        title: "Leave Cancelled",
        message: `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
        type: "leave",
        isRead: false,
      });
      notifList.push(notif);
    }

    const io = req.app.get("io");
    if (io) notifList.forEach((n) => io.emit("newNotification", n));

    return res.json({ message: "Leave cancelled successfully" });
  } catch (err) {
    console.error("cancelLeave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- END OF FILE leaveController.js ---
