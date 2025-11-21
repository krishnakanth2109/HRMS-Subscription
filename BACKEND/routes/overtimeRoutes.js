// --- START OF FILE overtimeRoutes.js ---

import express from "express";
import Overtime from "../models/Overtime.js";

const router = express.Router();

/* ======================================================
   ✅ APPLY OVERTIME REQUEST
====================================================== */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date, type } = req.body;

    if (!employeeId || !employeeName || !date || !type) {
      return res.status(400).json({
        message: "employeeId, employeeName, date and type are required",
      });
    }

    const newOT = new Overtime({
      employeeId,
      employeeName,
      date,
      type,
      status: "PENDING",
    });

    await newOT.save();

    res.status(201).json({
      message: "Overtime request submitted",
      data: newOT,
    });
  } catch (err) {
    console.error("OT CREATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ✅ ADMIN: GET ALL OVERTIME REQUESTS
====================================================== */
router.get("/all", async (req, res) => {
  try {
    const list = await Overtime.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT ALL FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ✅ CANCEL OVERTIME REQUEST (IMPORTANT: ABOVE /:id)
====================================================== */
router.patch("/cancel/:id", async (req, res) => {
  try {
    const overtime = await Overtime.findByIdAndUpdate(
      req.params.id,
      { status: "CANCELLED" },
      { new: true }
    );

    if (!overtime) {
      return res.status(404).json({ message: "Overtime request not found" });
    }

    res.json({
      message: "Overtime cancelled successfully",
      data: overtime,
    });
  } catch (error) {
    console.error("Cancel OT failed:", error);
    res.status(500).json({ message: "Failed to cancel overtime request" });
  }
});

/* ======================================================
   ✅ UPDATE OVERTIME STATUS (ADMIN)
====================================================== */
router.put("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await Overtime.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Overtime request not found" });
    }

    res.json({
      message: "Status updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("OT STATUS UPDATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ✅ GET OVERTIME REQUESTS FOR ONE EMPLOYEE
   ⚠️ Must remain LAST to avoid capturing other routes
====================================================== */
router.get("/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const list = await Overtime.find({ employeeId }).sort({ date: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==========================
   DELETE OVERTIME REQUEST
========================== */
router.delete("/delete/:id", async (req, res) => {
  try {
    const removed = await Overtime.findByIdAndDelete(req.params.id);

    if (!removed) {
      return res.status(404).json({ message: "Overtime not found" });
    }

    res.json({ message: "Overtime deleted successfully" });
  } catch (err) {
    console.error("OT DELETE ERROR →", err);
    res.status(500).json({ message: "Failed to delete overtime request" });
  }
});


export default router;

// --- END OF FILE overtimeRoutes.js ---
