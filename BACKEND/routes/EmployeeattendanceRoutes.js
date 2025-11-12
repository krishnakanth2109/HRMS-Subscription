

import express from "express";
import Attendance from "../models/Attendance.js";

const router = express.Router();

const getToday = () => new Date().toISOString().split("T")[0];

// ✅ Exact time calculator
const calcWork = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);

  const diffMs = e - s;

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  return {
    floatHours: diffMs / (1000 * 60 * 60),
    hours,
    minutes,
    seconds,
    displayTime: `${hours}h ${minutes}m ${seconds}s`,
  };
};

// ✅ Punch IN
router.post("/punch-in", async (req, res) => {
  try {
    const { employeeId, employeeName } = req.body;
    const today = getToday();
    const punchInTime = new Date(); // Current time

    // ✅ Set cutoff time for late login (in 24rhr format)
    const lateCutoff = new Date();
    lateCutoff.setHours(10, 15, 0, 0); 

    const loginStatus = punchInTime > lateCutoff ? "LATE" : "ON_TIME";

    let record = await Attendance.findOne({ employeeId });

    if (!record) {
      record = new Attendance({
        employeeId,
        employeeName,
        attendance: [],
      });
    }

    let todayEntry = record.attendance.find((a) => a.date === today);

    if (todayEntry?.punchIn) {
      return res.json(record.attendance);
    }

    if (!todayEntry) {
      record.attendance.push({
        date: today,
        punchIn: punchInTime,
        status: "WORKING",
        loginStatus: loginStatus, // ✅ Set login status
        
      });
    } else {
      todayEntry.punchIn = punchInTime;
      todayEntry.status = "WORKING";
      todayEntry.loginStatus = loginStatus; // ✅ Set login status
    }

    await record.save();
    res.json(record.attendance);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Punch OUT
router.post("/punch-out", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = getToday();

    let record = await Attendance.findOne({ employeeId });

    if (!record) return res.status(400).json({ message: "Punch in first" });

    const todayEntry = record.attendance.find((a) => a.date === today);

    if (!todayEntry?.punchIn) {
      return res.status(400).json({ message: "Punch in first" });
    }
    
    // Prevent multiple punch-outs
    if(todayEntry.punchOut) {
      return res.json(record.attendance);
    }

    todayEntry.punchOut = new Date();
    todayEntry.status = "COMPLETED";

    const work = calcWork(todayEntry.punchIn, todayEntry.punchOut);

    todayEntry.workedHours = work.floatHours;
    todayEntry.workedMinutes = work.minutes;
    todayEntry.workedSeconds = work.seconds;
    todayEntry.displayTime = work.displayTime;

    if (work.floatHours >= 7) todayEntry.attendanceCategory = "FULL_DAY";
    else if (work.floatHours >= 4) todayEntry.attendanceCategory = "HALF_DAY";
    else todayEntry.attendanceCategory = "ABSENT";

    await record.save();
    res.json(record.attendance);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all logs
router.get("/:employeeId", async (req, res) => {
  try {
    const record = await Attendance.findOne({ employeeId: req.params.employeeId });
    if (!record) return res.json([]);
    res.json(record.attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;