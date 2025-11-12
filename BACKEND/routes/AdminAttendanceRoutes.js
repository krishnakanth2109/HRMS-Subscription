import express from "express";
import Attendance from "../models/Attendance.js";

const router = express.Router();

// ✅ Admin fetch attendance by date
router.get("/by-date/:date", async (req, res) => {
  try {
    const selectedDate = req.params.date; // YYYY-MM-DD

    // Fetch all employee attendance documents
    const allEmployees = await Attendance.find();

    // Flatten attendance by date
    const result = [];

    allEmployees.forEach((emp) => {
      const dayEntry = emp.attendance.find(a => a.date === selectedDate);

      if (dayEntry) {
        result.push({
          employeeName: emp.employeeName,
          employeeId: emp.employeeId,
          date: selectedDate,
          punchIn: dayEntry.punchIn,
          punchOut: dayEntry.punchOut,
          displayTime: dayEntry.displayTime,
          loginStatus: dayEntry.loginStatus,
          status: dayEntry.status,
        });
      }
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
