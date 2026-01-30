// --- START OF FILE EmployeeattendanceRoutes.js ---

import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// Admin Only: Get All (Scoped)
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    // Only Admin's data
    const records = await Attendance.find({ adminId: req.user._id });
    const sortedRecords = records.map(rec => {
      rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      return rec;
    });
    res.status(200).json({ success: true, count: sortedRecords.length, data: sortedRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= UTILITIES ================= */
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

/* ================= PUNCH IN ================= */
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName) return res.status(400).json({ message: 'Employee ID & Name required' });
    if (!validateCoordinates(latitude, longitude)) return res.status(400).json({ message: "Invalid coordinates" });

    const today = getToday();
    const now = new Date();
    let address = "Unknown Location";
    try { address = await reverseGeocode(latitude, longitude); } catch {}

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) {
      // Inject Hierarchy
      attendance = new Attendance({ 
          adminId: req.user.adminId, 
          companyId: req.user.company, 
          employeeId, 
          employeeName, 
          attendance: [] 
      });
    }

    let todayRecord = attendance.attendance.find(a => a.date === today);

    // Shift Logic
    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = { shiftStartTime: "09:00", shiftEndTime: "18:00", lateGracePeriod: 15, autoExtendShift: true, fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };
    }

    // --- SCENARIO 1: FIRST PUNCH IN ---
    if (!todayRecord) {
      const diffMin = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
      const isLate = diffMin > shift.lateGracePeriod;
      
      let adjustedShiftEnd = shift.shiftEndTime;
      if (isLate && shift.autoExtendShift) {
        adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, diffMin - shift.lateGracePeriod);
      }

      todayRecord = {
        date: today,
        punchIn: now, 
        punchOut: null,
        punchInLocation: { latitude, longitude, address, timestamp: now },
        sessions: [{ punchIn: now, punchOut: null, durationSeconds: 0 }],
        workedHours: 0,
        workedMinutes: 0,
        workedSeconds: 0,
        totalBreakSeconds: 0,
        displayTime: "0h 0m 0s",
        status: "WORKING",
        loginStatus: isLate ? "LATE" : "ON_TIME",
  
      };
      attendance.attendance.push(todayRecord);
    } 
    // --- SCENARIO 2: RESUME WORK (PUNCH IN AGAIN) ---
    else {
        if (todayRecord.workedStatus === "FULL_DAY") {
            return res.status(400).json({ message: "Your shift is completed. You cannot punch in again today." });
        }

        if (todayRecord.status === "WORKING") {
            return res.status(400).json({ message: "You are already Punched In." });
        }

        const lastSession = todayRecord.sessions[todayRecord.sessions.length - 1];
        if (lastSession && lastSession.punchOut) {
            const breakDiff = (now - new Date(lastSession.punchOut)) / 1000;
            todayRecord.totalBreakSeconds = (todayRecord.totalBreakSeconds || 0) + breakDiff;
        }

        todayRecord.sessions.push({ punchIn: now, punchOut: null, durationSeconds: 0 });
        todayRecord.status = "WORKING";
        todayRecord.punchOut = null; 
    }

    await attendance.save();
    return res.json({ success: true, message: "Work resumed successfully", data: attendance.attendance.find(a => a.date === today) });

  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= PUNCH OUT ================= */
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord) return res.status(400).json({ message: "No attendance record for today" });

    const sessions = todayRecord.sessions || [];
    const currentSession = sessions.find(s => !s.punchOut);

    if (!currentSession) {
        return res.status(400).json({ message: "You are already Punched Out." });
    }

    // 1. Close current session
    currentSession.punchOut = now;
    const sessionDuration = (new Date(now) - new Date(currentSession.punchIn)) / 1000;
    currentSession.durationSeconds = sessionDuration;

    // 2. Update Top-Level Data
    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    todayRecord.status = "COMPLETED";

    // 3. Calculate Total Worked Time
    let totalSeconds = 0;
    todayRecord.sessions.forEach(sess => {
        if(sess.punchIn && sess.punchOut) {
            totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
        }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;

    // 4. Update Worked Status
    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let attendanceCategory = "ABSENT";
    let workedStatus = "ABSENT";

    if (h >= shift.fullDayHours) { attendanceCategory = "FULL_DAY"; workedStatus = "FULL_DAY"; }
    else if (h >= shift.halfDayHours) { attendanceCategory = "HALF_DAY"; workedStatus = "HALF_DAY"; }
    else if (h >= shift.quarterDayHours) { workedStatus = "HALF_DAY"; }

    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    res.json({ success: true, message: `Punched out. Total: ${h}h ${m}m`, data: todayRecord });

  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ADMIN PUNCH OUT ROUTE (Scoped) ================= */
router.post('/admin-punch-out', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, punchOutTime, latitude, longitude, date } = req.body;

    if (!employeeId || !punchOutTime || !date) {
      return res.status(400).json({ message: "Employee ID, Punch Out Time and Date are required" });
    }

    const punchOutDateObj = new Date(punchOutTime);
    
    // Ensure Admin owns record
    let attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendance) return res.status(404).json({ message: "No attendance record found for this employee" });

    let targetDateStr = date;
    if(date.includes("T")) targetDateStr = date.split("T")[0];

    let dayRecord = attendance.attendance.find(a => a.date === targetDateStr);
    
    if (!dayRecord) {
        return res.status(400).json({ message: `No attendance entry found for date: ${targetDateStr}` });
    }

    const sessions = dayRecord.sessions || [];
    const openSession = sessions.find(s => !s.punchOut);

    if (openSession) {
        openSession.punchOut = punchOutDateObj;
        openSession.durationSeconds = (punchOutDateObj - new Date(openSession.punchIn)) / 1000;
    }

    dayRecord.punchOut = punchOutDateObj;
    dayRecord.punchOutLocation = { 
        latitude: latitude || 0, 
        longitude: longitude || 0, 
        address: "Admin Force Logout",
        timestamp: new Date()
    };
    dayRecord.status = "COMPLETED";
    dayRecord.adminPunchOut = true;
    dayRecord.adminPunchOutBy = req.user.name; 
    dayRecord.adminPunchOutTimestamp = new Date();

    let totalSeconds = 0;
    dayRecord.sessions.forEach(sess => {
        if(sess.punchIn && sess.punchOut) {
            totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
        }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    dayRecord.workedHours = h;
    dayRecord.workedMinutes = m;
    dayRecord.workedSeconds = s;
    dayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let workedStatus = "ABSENT";
    if (h >= shift.fullDayHours) workedStatus = "FULL_DAY";
    else if (h >= shift.halfDayHours) workedStatus = "HALF_DAY";
    else if (h >= shift.quarterDayHours) workedStatus = "HALF_DAY";

    dayRecord.workedStatus = workedStatus;
    dayRecord.attendanceCategory = workedStatus === "FULL_DAY" ? "FULL_DAY" : (workedStatus === "HALF_DAY" ? "HALF_DAY" : "ABSENT");

    await attendance.save();

    res.json({ success: true, message: "Employee punched out by Admin successfully", data: dayRecord });

  } catch (err) {
    console.error("Admin Punch Out Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= EMPLOYEE REQUEST FOR LATE CORRECTION ================= */
router.post('/request-correction', async (req, res) => {
    try {
        const { employeeId, date, time, reason } = req.body;
        // User sends time as "HH:mm" (e.g. "09:00")
        
        let attendance = await Attendance.findOne({ employeeId });
        if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

        let dayRecord = attendance.attendance.find(a => a.date === date);
        if (!dayRecord) return res.status(400).json({ message: "No attendance found for this date." });

        // Construct Date object for requested time
        const requestedDateObj = new Date(`${date}T${time}:00`);

        // Update the request fields inside the Daily Schema
        dayRecord.lateCorrectionRequest = {
            hasRequest: true,
            status: "PENDING",
            requestedTime: requestedDateObj,
            reason: reason
        };

        await attendance.save();
        res.json({ success: true, message: "Request sent to Admin." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ================= ADMIN APPROVE CORRECTION ================= */
router.post('/approve-correction', onlyAdmin, async (req, res) => {
    try {
        const { employeeId, date, status, adminComment } = req.body; 
        // status: "APPROVED" or "REJECTED"

        // Ensure Admin owns record
        let attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
        if (!attendance) return res.status(404).json({ message: "Record not found" });

        let dayRecord = attendance.attendance.find(a => a.date === date);
        if (!dayRecord || !dayRecord.lateCorrectionRequest?.hasRequest) {
            return res.status(400).json({ message: "No pending request found." });
        }

        if (status === "REJECTED") {
            dayRecord.lateCorrectionRequest.status = "REJECTED";
            dayRecord.lateCorrectionRequest.adminComment = adminComment;
        } 
        else if (status === "APPROVED") {
            const newPunchIn = new Date(dayRecord.lateCorrectionRequest.requestedTime);

            // 1. Update Request Status
            dayRecord.lateCorrectionRequest.status = "APPROVED";
            dayRecord.lateCorrectionRequest.adminComment = adminComment;

            // 2. Update First Session Punch In
            if (dayRecord.sessions.length > 0) {
                dayRecord.sessions[0].punchIn = newPunchIn;
                
                // Recalculate duration if punchOut exists
                if (dayRecord.sessions[0].punchOut) {
                    dayRecord.sessions[0].durationSeconds = (new Date(dayRecord.sessions[0].punchOut) - newPunchIn) / 1000;
                }
            }

            // 3. Update Root Punch In
            dayRecord.punchIn = newPunchIn;

            // 4. Recalculate Login Status (Is it Late?)
            let shift = await Shift.findOne({ employeeId });
            // Fallback default
            if (!shift) shift = { shiftStartTime: "09:00", lateGracePeriod: 15 };

            const diffMin = getTimeDifferenceInMinutes(newPunchIn, shift.shiftStartTime);
            
            // If new time is within grace period, mark ON TIME
            if (diffMin <= shift.lateGracePeriod) {
                dayRecord.loginStatus = "ON_TIME";
            } else {
                dayRecord.loginStatus = "LATE";
            }

            // 5. Recalculate Total Worked Hours (Since start time changed)
            let totalSeconds = 0;
            dayRecord.sessions.forEach(sess => {
                if(sess.punchIn && sess.punchOut) {
                    totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
                }
            });
            
            if (dayRecord.status === "COMPLETED") {
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = Math.floor(totalSeconds % 60);

                dayRecord.workedHours = h;
                dayRecord.workedMinutes = m;
                dayRecord.workedSeconds = s;
                dayRecord.displayTime = `${h}h ${m}m ${s}s`;
            }
        }

        await attendance.save();
        res.json({ success: true, message: `Request ${status.toLowerCase()} successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ================= OTHER ROUTES ================= */
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
// --- END OF FILE EmployeeattendanceRoutes.js ---