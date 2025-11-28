// --- UPDATED FILE: routes/attendanceRoutes.js ---

import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ======================================================
   🔐 ALL ROUTES REQUIRE AUTH
====================================================== */
router.use(protect);

/* ======================================================
   🟥 ADMIN ONLY → GET ALL ATTENDANCE RECORDS
====================================================== */
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    console.log("Fetching ALL attendance records...");
    const records = await Attendance.find({});

    const sortedRecords = records.map(rec => {
      rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      return rec;
    });

    res.status(200).json({
      success: true,
      count: sortedRecords.length,
      data: sortedRecords,
    });

  } catch (err) {
    console.error("Error fetching all attendance:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   INTERNAL UTILITIES
====================================================== */

const getToday = () => new Date().toISOString().split("T")[0];

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const total = timeToMinutes(timeStr) + minutesToAdd;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getTimeDifferenceInMinutes = (punchIn, shiftStart) => {
  const t = new Date(punchIn);
  return t.getHours() * 60 + t.getMinutes() - timeToMinutes(shiftStart);
};

/* ======================================================
   👤 EMPLOYEE / MANAGER → PUNCH IN
====================================================== */
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName)
      return res.status(400).json({ message: 'Employee ID & Name required' });

    if (!validateCoordinates(latitude, longitude))
      return res.status(400).json({ message: "Invalid coordinates" });

    const today = getToday();
    const now = new Date();

    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = {
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        autoExtendShift: true,
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
      };
    }

    let address = "Unknown Location";
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch {}

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) {
      attendance = new Attendance({ employeeId, employeeName, attendance: [] });
    }

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (todayRecord?.punchIn)
      return res.status(400).json({ message: "Already punched in" });

    const diffMin = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
    const isLate = diffMin > shift.lateGracePeriod;

    let adjustedShiftEnd = shift.shiftEndTime;
    if (isLate && shift.autoExtendShift) {
      adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, diffMin - shift.lateGracePeriod);
    }

    const punchInData = {
      date: today,
      punchIn: now,
      punchInLocation: { latitude, longitude, address, timestamp: now },
      punchOut: null,
      workedHours: 0,
      workedMinutes: 0,
      displayTime: "0h 0m 0s",
      status: "WORKING",
      loginStatus: isLate ? "LATE" : "ON_TIME",
      shiftStartTime: shift.shiftStartTime,
      shiftEndTime: adjustedShiftEnd,
      originalShiftEnd: shift.shiftEndTime,
      lateMinutes: isLate ? Math.max(0, diffMin - shift.lateGracePeriod) : 0,
      idleActivity: [],
    };

    if (!todayRecord) attendance.attendance.push(punchInData);
    else Object.assign(todayRecord, punchInData);

    await attendance.save();

    return res.json({
      success: true,
      message: isLate ? `Late. Shift extended to ${adjustedShiftEnd}` : "Punched in successfully",
      data: attendance.attendance.find(a => a.date === today),
    });

  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   👤 EMPLOYEE / MANAGER → PUNCH OUT
====================================================== */
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord?.punchIn)
      return res.status(400).json({ message: "Punch in first" });

    if (todayRecord.punchOut)
      return res.json({ success: true, data: todayRecord });

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2, breakTimeMinutes: 60 };

    let punchInTime = new Date(todayRecord.punchIn);
    const diffMs = now - punchInTime;
    const totalSeconds = Math.floor(diffMs / 1000);
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;

    const effective = Math.max(0, totalSeconds - breakSeconds);

    const h = Math.floor(effective / 3600);
    const m = Math.floor((effective % 3600) / 60);
    const s = effective % 60;

    let attendanceCategory = "ABSENT";
    if (h >= shift.fullDayHours) attendanceCategory = "FULL_DAY";
    else if (h >= shift.halfDayHours) attendanceCategory = "HALF_DAY";
    else if (h >= shift.quarterDayHours) attendanceCategory = "HALF_DAY";

    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;
    todayRecord.status = "COMPLETED";
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    res.json({
      success: true,
      message: `Punched out (${attendanceCategory})`,
      data: todayRecord,
    });

  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   👤 EMPLOYEE → RECORD IDLE
====================================================== */
router.post('/record-idle-activity', async (req, res) => {
  try {
    const { employeeId, idleStart, idleEnd, isIdle } = req.body;

    const today = getToday();
    const record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(404).json({ message: "Not found" });

    const todayEntry = record.attendance.find(a => a.date === today);
    if (!todayEntry) return res.status(400).json({ message: "Punch in first" });

    if (!todayEntry.idleActivity) todayEntry.idleActivity = [];

    if (isIdle) todayEntry.idleActivity.push({ idleStart: new Date(idleStart) });
    else {
      const last = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (last && !last.idleEnd) last.idleEnd = new Date(idleEnd);
    }

    await record.save();
    res.json({ success: true, data: todayEntry });

  } catch (err) {
    console.error("Idle error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   👤 EMPLOYEE / MANAGER → ONLY VIEW OWN ATTENDANCE
   🟥 ADMIN → CAN VIEW ANY EMPLOYEE
====================================================== */
router.get('/:employeeId', async (req, res) => {
  try {
    const requestedId = req.params.employeeId;
    const loggedUser = req.user;

    if (loggedUser.role !== "admin" && loggedUser.employeeId !== requestedId) {
      return res.status(403).json({ message: "Access denied." });
    }

    const record = await Attendance.findOne({ employeeId: requestedId });
    if (!record) return res.json({ success: true, data: [] });

    const sorted = record.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: sorted });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// --- END ---
