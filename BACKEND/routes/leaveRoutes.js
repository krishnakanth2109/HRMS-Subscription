import express from "express";
import Leave from "../models/Leave.js";

const router = express.Router();

/* ✅ Submit Leave */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date_from, date_to, leaveType, reason } = req.body;

    if (!employeeId || !employeeName || !date_from || !date_to || !leaveType || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newLeave = new Leave({
      employeeId,
      employeeName,
      date_from,
      date_to,
      leaveType,
      reason,
      status: "PENDING",
    });

    await newLeave.save();

    res.status(201).json({ message: "Leave applied", data: newLeave });
  } catch (err) {
    console.error("Leave Apply Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ✅ CANCEL LEAVE — MUST COME BEFORE :employeeId */
router.delete("/cancel/:id", async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    if (leave.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending leaves can be cancelled" });
    }

    await Leave.findByIdAndDelete(req.params.id);

    res.json({ message: "Leave cancelled successfully" });
  } catch (err) {
    console.error("Leave Cancel Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ✅ Admin: Get ALL Leaves */
router.get("/admin/all", async (req, res) => {
  try {
    const list = await Leave.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("Fetch All Leaves Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ✅ Admin: Update Leave Status */
router.put("/admin/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await Leave.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({ message: "Status updated", data: updated });
  } catch (err) {
    console.error("Update Leave Status Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ✅ Get all Leaves of one employee — MUST BE LAST */
router.get("/:employeeId", async (req, res) => {
  try {
    const list = await Leave.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("Fetch Employee Leave Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
