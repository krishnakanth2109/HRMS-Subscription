// --- START OF FILE controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js"; // Assuming this is your correct model

// Helper function to get an array of dates between two dates
function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ✅ CREATE LEAVE: Now securely uses the authenticated user's ID and name
export const createLeave = async (req, res) => {
  try {
    const { employeeId, name: employeeName } = req.user; // Get from 'protect' middleware
    const { from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);
    const details = listDates(from, to).map(date => ({
      date, leavecategory: "UnPaid", leaveType, leaveDayType: from === to ? leaveDayType : "Full Day",
    }));

    const doc = await LeaveRequest.create({
      employeeId, employeeName, from, to, reason, leaveType, leaveDayType,
      halfDaySession, monthKey, status: "Pending", approvedBy: "-",
      actionDate: "-", requestDate: new Date().toISOString().slice(0, 10), details,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave request." });
  }
};

// ✅ EMPLOYEE LIST: Securely fetches leaves for ONLY the logged-in user
export const listLeavesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user; // Get from 'protect' middleware, IGNORE query params
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

// ✅ ADMIN LIST: Fetches all leaves for the admin panel
export const adminListAllLeaves = async (req, res) => {
  try {
    let docs = await LeaveRequest.find().sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListAllLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ✅ GET DETAILS: Securely checks if the user is an admin or the owner of the request
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Leave request not found." });

    if (req.user.role !== 'admin' && doc.employeeId !== req.user.employeeId) {
        return res.status(403).json({ message: "You are not authorized to view these details." });
    }
    
    res.json(doc.details || []);
  } catch (err) {
    console.error("getLeaveDetails error:", err);
    res.status(500).json({ message: "Failed to fetch leave details." });
  }
};

// ✅ UPDATE STATUS: For Admins, automatically logs who took the action
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name; // Get admin's name from authenticated user

    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status provided." });
    }
    const actionDate = new Date().toISOString().slice(0, 10);

    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy, actionDate },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Leave request not found." });

    res.json(doc);
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
};

// ✅ CANCEL LEAVE: For Employees, ensures they can only cancel their own pending leaves
export const cancelLeave = async (req, res) => {
    try {
      const leave = await LeaveRequest.findById(req.params.id);
      if (!leave) return res.status(404).json({ message: "Leave request not found" });
      
      // Security Check: Make sure the employeeId on the leave matches the logged-in user
      if (leave.employeeId !== req.user.employeeId) {
          return res.status(403).json({ message: "You can only cancel your own leave requests." });
      }

      if (leave.status !== "Pending") {
        return res.status(400).json({ message: "Only pending leaves can be cancelled" });
      }
  
      await LeaveRequest.findByIdAndDelete(req.params.id);
      res.json({ message: "Leave cancelled successfully" });
    } catch (err) {
      console.error("Leave Cancel Error:", err);
      res.status(500).json({ message: "Server Error" });
    }
};