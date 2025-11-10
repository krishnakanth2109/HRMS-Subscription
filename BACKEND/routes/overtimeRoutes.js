import express from "express";
import Overtime from "../models/Overtime.js";

const router = express.Router();

/* ==========================
   ✅ Apply Overtime
   ========================== */
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

/* ==========================
 ✅ IMPORTANT: Fetch ALL OTs (Admin)
  — Should come BEFORE "/:employeeId"
 ========================== */
router.get("/all", async (req, res) => {
  try {
    const list = await Overtime.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT ALL FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==========================
   ✅ Get Overtime for One Employee
   ========================== */
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
   ✅ Update OT Status
   ========================== */
router.put("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await Overtime.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({
      message: "Status updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("OT STATUS UPDATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
