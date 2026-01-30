// --- START OF FILE controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import { sendBrevoEmail } from "../Services/emailService.js";

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
    const loggedUser = req.user; // Employee
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

    // 1. CREATE LEAVE REQUEST WITH HIERARCHY
    const doc = await LeaveRequest.create({
      adminId: loggedUser.adminId, // Hierarchy
      companyId: loggedUser.company, // Hierarchy
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

    // 2. IDENTIFY RECIPIENT ADMIN
    // We only notify the Admin who owns this employee
    const admin = await Admin.findById(loggedUser.adminId).lean();
    
    if (admin) {
        // --- EMAIL NOTIFICATION LOGIC ---
        try {
          const adminRecipients = [{ name: admin.name, email: admin.email }];

          // Optional: Hardcoded specific admin if required by business logic
          const specificAdminEmail = "oragantisagar041@gmail.com";
          if (admin.email !== specificAdminEmail) {
             adminRecipients.push({ name: "Super Admin", email: specificAdminEmail });
          }

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #4f46e5;">New Leave Request</h2>
              <p><strong>${loggedUser.name}</strong> has submitted a leave request.</p>
              <ul>
                <li><strong>Type:</strong> ${leaveType}</li>
                <li><strong>Dates:</strong> ${new Date(from).toLocaleDateString()} to ${new Date(to).toLocaleDateString()}</li>
                <li><strong>Reason:</strong> ${reason}</li>
              </ul>
            </div>
          `;

          await sendBrevoEmail({
            to: adminRecipients,
            subject: `Leave Request: ${loggedUser.name}`,
            htmlContent: emailHtml,
          });
        } catch (emailErr) {
          console.error("❌ Failed to send Leave Email:", emailErr);
        }

        // --- SYSTEM NOTIFICATION LOGIC ---
        const notif = await Notification.create({
            adminId: admin._id,     // Hierarchy
            companyId: loggedUser.company, // Hierarchy
            userId: admin._id.toString(),
            userType: "Admin",
            title: "New Leave Request",
            message: `${loggedUser.name} submitted a leave request`,
            type: "leave",
            isRead: false,
        });

        // Real-time socket
        const io = req.app.get("io");
        if (io) io.emit("newNotification", notif);
    }

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave request." });
  }
};

// ===================================================================================
// FETCH USER LEAVES (EMPLOYEE)
// ===================================================================================
export const listLeavesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { month, status } = req.query;

    const query = { employeeId }; 
    // Implicitly safe as employeeId is unique, but could add companyId

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
// ADMIN LIST ALL LEAVES (SCOPED)
// ===================================================================================
export const adminListAllLeaves = async (req, res) => {
  try {
    // Only fetch leaves belonging to this Admin
    const docs = await LeaveRequest.find({ adminId: req.user._id })
        .sort({ requestDate: -1 })
        .lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListAllLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ===================================================================================
// GET DETAILS (SCOPED)
// ===================================================================================
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });

    const isAdmin = req.user.role === "admin";
    
    // Security Check
    if (isAdmin) {
        // Admin must own the record
        if (doc.adminId && doc.adminId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized access to another tenant's data" });
        }
    } else {
        // Employee must own the record
        if (doc.employeeId !== req.user.employeeId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
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

    // Update with scope check
    const doc = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id }, // Only update if Admin owns it
      {
        status,
        approvedBy,
        actionDate: new Date().toISOString().slice(0, 10),
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave request not found or unauthorized" });

    // Notify Employee
    const employee = await Employee.findOne({ employeeId: doc.employeeId });

    if (employee) {
      const notif = await Notification.create({
        adminId: req.user._id, // Hierarchy
        companyId: doc.companyId, // Hierarchy
        userId: employee._id,
        userType: "Employee",
        title: "Leave Status Update",
        message: `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
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
};


// ===================================================================================
// EMPLOYEE CANCEL LEAVE
// ===================================================================================
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });

    // Verify ownership
    if (leave.employeeId !== req.user.employeeId) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (leave.status !== "Pending") {
      return res.status(400).json({ message: "Cannot cancel this leave" });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);

    // Notify specific Admin
    const admin = await Admin.findById(leave.adminId);
    if(admin) {
        const notif = await Notification.create({
            adminId: admin._id,
            companyId: leave.companyId,
            userId: admin._id.toString(),
            userType: "Admin",
            title: "Leave Cancelled",
            message: `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
            type: "leave",
            isRead: false,
        });

        const io = req.app.get("io");
        if (io) io.emit("newNotification", notif);
    }

    return res.json({ message: "Leave cancelled successfully" });
  } catch (err) {
    console.error("cancelLeave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// --- END OF FILE leaveController.js ---