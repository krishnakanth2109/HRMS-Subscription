import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js'; // From File 1
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js'; // From File 2

const router = express.Router();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getToday = () => new Date().toISOString().split("T")[0];

// Helper to parse time string "HH:MM" to minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper to add minutes to a time string
const addMinutesToTime = (timeStr, minutesToAdd) => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Helper to calculate time difference in minutes
const getTimeDifferenceInMinutes = (punchInTime, shiftStartTime) => {
  const punchInDate = new Date(punchInTime);
  const punchInMinutes = punchInDate.getHours() * 60 + punchInDate.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  return punchInMinutes - shiftStartMinutes;
};

// ============================================================
// ROUTES
// ============================================================

// ✅ GET ALL RECORDS (Must be at the top to avoid conflict with /:employeeId)
router.get('/all', async (req, res) => {
  try {
    console.log("✅ Backend: Fetching ALL attendance records...");
    const records = await Attendance.find({});
    // Sorting by date descending (newest first)
    const sortedRecords = records.map(rec => {
        rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
        return rec;
    });
    res.status(200).json({
      success: true,
      count: sortedRecords.length,
      data: sortedRecords
    });
  } catch (err) {
    console.error("Error fetching all attendance:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ PUNCH IN (Merges Shift Logic with Location Validation)
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName) {
      return res.status(400).json({ success: false, message: 'Employee ID and Name are required' });
    }

    // 1. Validate Location (From File 2)
    if (!latitude || !longitude) return res.status(400).json({ error: "Location data required." });
    if (!validateCoordinates(latitude, longitude)) return res.status(400).json({ error: "Invalid coordinates." });

    const today = getToday();
    const now = new Date();

    // 2. Fetch Shift Configuration (From File 1)
    let shift = await Shift.findOne({ employeeId, isActive: true });
    
    // Default shift if not configured
    if (!shift) {
      shift = {
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        autoExtendShift: true,
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2
      };
    }

    // 3. Get Address
    let address = 'Unknown Location';
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (err) {
      console.error("Geocode failed, using default", err);
    }

    // 4. Find or create attendance record
    let attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      attendance = new Attendance({
        employeeId,
        employeeName,
        attendance: []
      });
    }

    // 5. Check if already punched in
    let todayRecord = attendance.attendance.find(a => a.date === today);

    if (todayRecord && todayRecord.punchIn) {
      return res.status(400).json({ success: false, message: 'Already punched in today' });
    }

    // 6. Calculate LATE status based on Shift (From File 1)
    const timeDiffMinutes = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
    const isLate = timeDiffMinutes > shift.lateGracePeriod;
    
    let loginStatus = 'ON_TIME';
    let adjustedShiftEnd = shift.shiftEndTime;

    if (isLate) {
      loginStatus = 'LATE';
      // Auto-extend shift if enabled
      if (shift.autoExtendShift) {
        const lateMinutes = timeDiffMinutes - shift.lateGracePeriod;
        adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, lateMinutes);
      }
    }

    const punchInData = {
        date: today,
        punchIn: now,
        punchInLocation: {
          latitude,
          longitude,
          address,
          timestamp: now
        },
        punchOut: null,
        punchOutLocation: null,
        workedHours: 0,
        workedMinutes: 0,
        workedSeconds: 0,
        displayTime: '0h 0m 0s',
        status: 'WORKING',
        loginStatus: loginStatus,
        workedStatus: 'NOT_APPLICABLE',
        attendanceCategory: 'NOT_APPLICABLE',
        
        // Shift details
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: adjustedShiftEnd,
        originalShiftEnd: shift.shiftEndTime,
        lateMinutes: isLate ? Math.max(0, timeDiffMinutes - shift.lateGracePeriod) : 0,
        
        // Initialize Idle Activity (From File 2)
        idleActivity: [] 
    };

    if (!todayRecord) {
      attendance.attendance.push(punchInData);
    } else {
      // If record existed but punchIn was null (rare edge case)
      Object.assign(todayRecord, punchInData);
    }

    await attendance.save();

    // Return the specific today record and shift info
    const savedRecord = attendance.attendance.find(a => a.date === today);
    
    return res.status(200).json({
      success: true,
      message: isLate 
        ? `Punched in (Late). Shift extended to ${adjustedShiftEnd}` 
        : 'Punched in successfully',
      data: savedRecord, // Return just the object, or attendance array if preferred
      attendance: attendance.attendance, // For compatibility with File 2 frontend
      shift: {
        original: shift.shiftEndTime,
        adjusted: adjustedShiftEnd,
        isExtended: isLate && shift.autoExtendShift
      }
    });

  } catch (error) {
    console.error('Punch-in error:', error);
    return res.status(500).json({ success: false, message: 'Failed to punch in', error: error.message });
  }
});

// ✅ PUNCH OUT (Merges Idle Check + Shift Calculation)
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;

    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    if (!latitude || !longitude) return res.status(400).json({ error: "Location data required." });

    const today = getToday();
    const now = new Date();

    // 1. Fetch Shift Configuration
    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = {
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
        breakTimeMinutes: 60 // Default break deduction
      };
    }

    // 2. Get Address
    let address = 'Unknown Location';
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (err) {
       console.error("Geocode error", err);
    }

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ success: false, message: 'No attendance record found' });

    const todayRecord = attendance.attendance.find(a => a.date === today);

    if (!todayRecord || !todayRecord.punchIn) {
      return res.status(400).json({ success: false, message: 'No punch-in record found for today' });
    }

    if (todayRecord.punchOut) {
        // If already punched out, just return current state
        return res.json({ success: true, data: todayRecord, attendance: attendance.attendance });
    }

    // 3. CLOSE IDLE SESSION IF ACTIVE (From File 2 Logic)
    if (todayRecord.idleActivity && todayRecord.idleActivity.length > 0) {
        const lastIdle = todayRecord.idleActivity[todayRecord.idleActivity.length - 1];
        if (!lastIdle.idleEnd) {
          lastIdle.idleEnd = now;
        }
    }

    // 4. Calculate Worked Time (Subtracting Break - From File 1 Logic)
    const punchInTime = new Date(todayRecord.punchIn);
    const diffMs = now - punchInTime;
    const totalSeconds = Math.floor(diffMs / 1000);

    // Subtract break time defined in Shift
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);

    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    // 5. Determine Status based on Shift Thresholds (From File 1 Logic)
    let workedStatus = 'NOT_APPLICABLE';
    let attendanceCategory = 'NOT_APPLICABLE';

    if (hours >= shift.fullDayHours) {
      workedStatus = 'FULL_DAY';
      attendanceCategory = 'FULL_DAY';
    } else if (hours >= shift.halfDayHours) {
      workedStatus = 'HALF_DAY';
      attendanceCategory = 'HALF_DAY';
    } else if (hours >= shift.quarterDayHours) {
      workedStatus = 'QUARTER_DAY';
      attendanceCategory = 'HALF_DAY'; // Quarter day counts as half usually
    } else {
      workedStatus = 'ABSENT';
      attendanceCategory = 'ABSENT';
    }

    // 6. Update Record
    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = {
      latitude,
      longitude,
      address,
      timestamp: now
    };
    todayRecord.workedHours = hours;
    todayRecord.workedMinutes = minutes;
    todayRecord.workedSeconds = seconds;
    todayRecord.displayTime = `${hours}h ${minutes}m ${seconds}s`;
    todayRecord.status = 'COMPLETED';
    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: `Punched out successfully. Worked: ${hours}h ${minutes}m (${workedStatus})`,
      data: todayRecord,
      attendance: attendance.attendance // Support both response formats
    });

  } catch (error) {
    console.error('Punch-out error:', error);
    return res.status(500).json({ success: false, message: 'Failed to punch out', error: error.message });
  }
});

// ✅ RECORD IDLE ACTIVITY (From File 2)
router.post("/record-idle-activity", async (req, res) => {
  try {
    const { employeeId, idleStart, idleEnd, isIdle } = req.body;
    const today = getToday();

    let record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(404).json({ message: "Record not found." });

    let todayEntry = record.attendance.find((a) => a.date === today);
    if (!todayEntry) return res.status(400).json({ message: "Punch in first." });

    if (!todayEntry.idleActivity) todayEntry.idleActivity = [];

    if (isIdle) {
      // Start Idle
      const lastEntry = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      // Only start new if previous is finished or array is empty
      if (!lastEntry || lastEntry.idleEnd) {
         todayEntry.idleActivity.push({ idleStart: new Date(idleStart) });
      }
    } else {
      // End Idle
      const lastEntry = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (lastEntry && !lastEntry.idleEnd) {
        lastEntry.idleEnd = new Date(idleEnd);
      } else if (idleStart && idleEnd) {
        // Case where complete block is sent
        todayEntry.idleActivity.push({
           idleStart: new Date(idleStart),
           idleEnd: new Date(idleEnd)
        });
      }
    }

    await record.save();
    res.json({ message: "Idle updated", attendance: record.attendance });
  } catch (err) {
    console.error("Idle record error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET SINGLE EMPLOYEE ATTENDANCE (Must be at bottom)
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Sort desc
    const sortedData = attendance.attendance.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    return res.status(200).json({
      success: true,
      data: sortedData
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

export default router;