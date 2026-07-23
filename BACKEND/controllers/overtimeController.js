// --- START OF FILE controllers/overtimeController.js ---

import Overtime from "../models/Overtime.js"; // Ensure capitalized Model name matches file
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import Notification from "../models/notificationModel.js";

// ===================================================================================
// 🔹 EMPLOYEE REQUESTS OVERTIME
// ===================================================================================
export const applyOvertime = async (req, res) => {
  try {
    const user = req.user;
    const { date, type, hours, reason, fromTime, toTime } = req.body;

    if (!date || !type || !hours || !reason || !fromTime || !toTime) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ============================================
    // 🔹 OT LIMIT VALIDATION (By Number of Requests)
    // ============================================
    const employee = await Employee.findOne({ employeeId: user.employeeId });
    if (employee && employee.monthlyOtLimit !== null) {
      // Calculate current month's total OT requests
      const currentMonth = date.substring(0, 7); // 'YYYY-MM'
      
      const existingOvertimes = await Overtime.find({
        employeeId: user.employeeId,
        date: { $regex: `^${currentMonth}` }, // matches dates starting with YYYY-MM
        status: { $in: ["PENDING", "APPROVED"] }
      });
      
      const currentRequestCount = existingOvertimes.length;
      
      if (currentRequestCount >= employee.monthlyOtLimit) {
        return res.status(400).json({ 
          message: `Monthly overtime limit exceeded. You can only request overtime ${employee.monthlyOtLimit} time(s) per month.` 
        });
      }
    }

    // 1. Create Overtime with Hierarchy
    const overtime = await Overtime.create({
      adminId: user.adminId, // Hierarchy
      companyId: user.company, // Hierarchy
      employeeId: user.employeeId,
      employeeName: user.name,
      date,
      type,
      hours,
      reason,
      fromTime,
      toTime,
      status: "PENDING",
      appliedAt: new Date(),
    });

    const io = req.app.get("io");
    // ✅ FEATURE 2 + BUG 3 FIX — target only this admin's room
    if (io) io.to(`user_${user.adminId}`).emit("overtime:new", overtime);

    // 2. Notify ONLY the specific Admin via their private socket room
    const admin = await Admin.findById(user.adminId);
    if (admin) {
      const notif = await Notification.create({
        adminId: admin._id,
        companyId: user.company,
        userId: admin._id,
        userType: "Admin",
        title: "New Overtime Request",
        message: `${user.name} requested ${hours}h overtime on ${date}`,
        type: "overtime",
        isRead: false,
        date: new Date(),
      });

      // Emit ONLY to this admin's private socket room — not to all clients
      if (io) io.to(`user_${admin._id}`).emit("newNotification", notif);
    }

    return res.status(201).json(overtime);
  } catch (err) {
    console.error("applyOvertime error:", err);
    res.status(500).json({ message: "Server error", error: err.message, stack: err.stack });
  }
};

// ===================================================================================
// 🔹 ADMIN GETS REQUESTS (SCOPED)
// ===================================================================================
export const getAllOvertimeRequests = async (req, res) => {
  try {
    // Only fetch records for this Admin
    const docs = await Overtime.find({ adminId: req.user._id })
        .sort({ appliedAt: -1 })
        .lean();
    res.json(docs);
  } catch (err) {
    console.error("getAllOvertimeRequests error:", err);
    res.status(500).json({ message: "Failed to fetch overtime requests." });
  }
};

// ===================================================================================
// 🔹 EMPLOYEE VIEWS OWN OVERTIME HISTORY
// ===================================================================================
export const getOvertimeForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;

    const docs = await Overtime.find({ employeeId }).sort({
      appliedAt: -1,
    });

    res.json(docs);
  } catch (err) {
    console.error("getOvertimeForEmployee error:", err);
    res.status(500).json({ message: "Failed to fetch your overtime." });
  }
};

// ===================================================================================
// 🔹 ADMIN UPDATES OVERTIME STATUS (SCOPED)
// ===================================================================================
export const updateOvertimeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    // Update ensuring Admin owns the record
    const updated = await Overtime.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      {
        status,
        approvedBy,
        actionDate: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Not found or unauthorized" });
    }

    const io = req.app.get("io");
    // ✅ FEATURE 2 + BUG 3 FIX — broadcast overtime update to admin room only
    if (io) io.to(`user_${req.user._id}`).emit("overtime:updated", updated);

    // Fetch employee and notify them via their private room
    const employee = await Employee.findOne({ employeeId: updated.employeeId });

    if (employee) {
      const notif = await Notification.create({
        adminId: req.user._id,
        companyId: updated.companyId,
        userId: employee._id,
        userType: "Employee",
        title: "Overtime Status Updated",
        message: `Your overtime request on ${updated.date} was ${status} by ${approvedBy}`,
        type: "overtime-status",
        isRead: false,
        date: new Date(),
      });

      // Emit only to this specific employee's socket room
      if (io) io.to(`user_${employee._id}`).emit("newNotification", notif);
    }

    return res.json(updated);
  } catch (err) {
    console.error("updateOvertimeStatus error:", err);
    res.status(500).json({ message: "Failed to update overtime status" });
  }
};

// ===================================================================================
// 🔹 EMPLOYEE CANCELS OVERTIME
// ===================================================================================
export const cancelOvertime = async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);
    if (!overtime) {
      return res.status(404).json({ message: "Not found" });
    }

    // Verify ownership
    if (overtime.employeeId !== req.user.employeeId) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (overtime.status !== "Pending") {
      return res.status(400).json({ message: "Cannot cancel an approved/rejected overtime" });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");
    // ✅ FEATURE 2 + BUG 3 FIX — notify only the relevant admin room
    if (io) io.to(`user_${overtime.adminId}`).emit("overtime:cancelled", { _id: req.params.id });

    // Notify specific Admin via their private socket room
    const admin = await Admin.findById(overtime.adminId);
    if (admin) {
      const notif = await Notification.create({
        adminId: admin._id,
        companyId: overtime.companyId,
        userId: admin._id,
        userType: "Admin",
        title: "Overtime Cancelled",
        message: `${req.user.name} cancelled the overtime request (${overtime.date})`,
        type: "overtime",
        isRead: false,
        date: new Date(),
      });

      // Emit ONLY to this admin's private socket room
      if (io) io.to(`user_${admin._id}`).emit("newNotification", notif);
    }

    res.json({ message: "Overtime cancelled successfully" });
  } catch (err) {
    console.error("cancelOvertime error:", err);
    res.status(500).json({ message: "Failed to cancel overtime" });
  }
};

// --- END OF FILE overtimeController.js ---