import LeaveRequest from "../models/LeaveRequest.js";

function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ✅ CREATE LEAVE
export const createLeave = async (req, res) => {
  try {
    const { employeeId, from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!employeeId || !from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);

    const dates = listDates(from, to);
    const details = dates.map((date) => ({
      date,
      leavecategory: "UnPaid",
      leaveType,
      leaveDayType: from === to ? leaveDayType : "Full Day",
    }));

    const doc = await LeaveRequest.create({
      employeeId,
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

    res.status(201).json(doc);

  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave." });
  }
};

// ✅ EMPLOYEE LIST (Only employee's leaves)
export const listLeaves = async (req, res) => {
  try {
    const { employeeId, month, status } = req.query;

    if (!employeeId || employeeId.trim() === "") {
      return res.json([]);  // ✅ Prevent cross-employee data leaks
    }

    const query = { employeeId };

    if (month) query.monthKey = month;

    if (status && status !== "All") query.status = status;

    const docs = await LeaveRequest.find(query).sort({ createdAt: -1 }).lean();

    res.json(docs);

  } catch (err) {
    console.error("listLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch leaves." });
  }
};

// ✅ ADMIN LIST (fetch all leaves)
export const adminListLeaves = async (req, res) => {
  try {
    let docs = await LeaveRequest.find().sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("adminListLeaves error:", err);
    res.status(500).json({ message: "Failed to fetch admin leaves." });
  }
};

// ✅ GET PER-DAY DETAILS
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();

    if (!doc) return res.status(404).json({ message: "Leave not found" });

    res.json(doc.details || []);

  } catch (err) {
    console.error("getLeaveDetails error:", err);
    res.status(500).json({ message: "Failed to fetch details." });
  }
};

// ✅ UPDATE STATUS (admin)
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status, approvedBy = "-" } = req.body;

    if (!["Approved", "Rejected", "Cancelled", "Pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const actionDate = new Date().toISOString().slice(0, 10);

    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy, actionDate },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave not found." });

    res.json(doc);

  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
};
