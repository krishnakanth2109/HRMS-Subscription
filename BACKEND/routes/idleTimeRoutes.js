import express from "express";
import IdleTime from "../models/IdleTimeModel.js";

const router = express.Router();

/**
 * POST /idletime
 * Save idle session safely with UPSERT (NO duplicates)
 */
router.post("/", async (req, res) => {
  try {
    const {
      employeeId,
      name,
      department,
      role,
      date,
      idleStart,
      idleEnd,
      idleDurationSeconds,
    } = req.body;

    if (!employeeId || !idleStart || !idleEnd || !date) {
      return res.status(400).json({ message: "Missing required values" });
    }

    // NEW idle session object
    const idleEntry = {
      idleStart: new Date(idleStart),
      idleEnd: new Date(idleEnd),
      idleDurationSeconds,
    };

    // Atomic operation: create OR update the SAME document
    const updatedRecord = await IdleTime.findOneAndUpdate(
      { employeeId, date },
      {
        $setOnInsert: { employeeId, name, department, role, date },
        $push: { idleTimeline: idleEntry },
      },
      {
        new: true,
        upsert: true, // This ensures no duplicates EVER
      }
    );

    return res.json({
      message: "Idle session saved",
      record: updatedRecord,
    });
  } catch (err) {
    console.error("❌ Idle time save error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message || err,
    });
  }
});

/**
 * GET /idletime/:employeeId/:date
 */
router.get("/:employeeId/:date", async (req, res) => {
  const { employeeId, date } = req.params;

  try {
    const record = await IdleTime.findOne({ employeeId, date });

    return res.json(record || { employeeId, date, idleTimeline: [] });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /idletime/employee/:employeeId
 */
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const rows = await IdleTime.find({
      employeeId: req.params.employeeId,
    }).sort({ date: -1 });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
