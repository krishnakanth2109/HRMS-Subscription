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

    // ----------------------------------------------------
    // EMAIL NOTIFICATION LOGIC
    // ----------------------------------------------------
    try {
      // 1. Fetch all admins
      const admins = await Admin.find().lean();

      // 2. Prepare recipients list
      const adminRecipients = admins.map(admin => ({ name: admin.name, email: admin.email }));

      // 3. Explicitly add 'oragantisagar041@gmail.com'
      const specificAdminEmail = "oragantisagar041@gmail.com";
      const alreadyIncluded = adminRecipients.some(a => a.email.toLowerCase() === specificAdminEmail.toLowerCase());

      console.log("📧 Leave Email Debug: Found Admins count:", admins.length);

      if (!alreadyIncluded) {
        console.log("📧 Leave Email Debug: Adding specific admin manually:", specificAdminEmail);
        adminRecipients.push({ name: "Admin", email: specificAdminEmail });
      }

      console.log("📧 Leave Email Debug: Final Recipients:", adminRecipients.map(r => r.email));

      // 4. Construct Email Content
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #4f46e5;">New Leave Request</h2>
          <p><strong>${name}</strong> (ID: ${loggedUser.employeeId}) has submitted a leave request.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Name:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee ID:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${loggedUser.employeeId || "N/A"}</td>
            </tr>
             <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Email:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${loggedUser.email || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Leave Type:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${leaveType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Dates:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(from).toLocaleDateString()} to ${new Date(to).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason || "No reason provided"}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please login to the Admin Portal to approve or reject this request.</p>
        </div>
      `;

      // 5. Send Email
      if (adminRecipients.length > 0) {
        console.log("📧 Leave Email Debug: Attempting to send...");
        await sendBrevoEmail({
          to: adminRecipients,
          subject: `Leave Request: ${name} - ${leaveType}`,
          htmlContent: emailHtml,
        });
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Leave Request email:", emailErr);
    }

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

    // Update the leave request
    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvedBy,
        actionDate: new Date().toISOString().slice(0, 10),
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave request not found" });

    // 🔥 Find the employee
    const employee = await Employee.findOne({ employeeId: doc.employeeId });

    if (employee) {
      // 🔥 Create notification for employee
      const notif = await Notification.create({
        userId: employee._id,
        userType: "Employee",     // REQUIRED!!
        title: "Leave Status Update",
        message: `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
        type: "leave-status",
        isRead: false,
      });

      // 🔥 Emit socket event
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
