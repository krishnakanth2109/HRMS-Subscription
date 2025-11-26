// --- START OF FILE controllers/attendanceController.js ---

import EmployeeAttendance from "../models/EmployeeAttendance.js";
import Shift from "../models/shiftModel.js"; // Importing Shift to check timings

// ✅ HELPER: Get current time explicitly in Indian Standard Time (IST)
const getCurrentIndianTime = () => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // IST is UTC + 5.5 hours
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utcTime + istOffset);
};

// ✅ Punch In: Calculates LATE/ON TIME based on IST
export const punchIn = async (req, res) => {
  try {
    const { employeeId, name } = req.user;
    const { latitude, longitude } = req.body; // Expect location from body

    const indianTime = getCurrentIndianTime();
    const today = indianTime.toISOString().split("T")[0]; // YYYY-MM-DD in IST

    // 1. Check if already punched in
    let attendance = await EmployeeAttendance.findOne({ employeeId, date: today });
    if (attendance) {
      return res.status(400).json({ message: "Already punched in for today" });
    }

    // 2. Fetch Shift Data for Logic
    // If no shift found, default to 9:30 AM IST
    const shift = await Shift.findOne({ employeeId }) || {
      shiftStartTime: "09:30",
      lateGracePeriod: 15
    };

    // 3. Logic: Compare Punch Time vs Shift Time (in Minutes)
    let loginStatus = "On Time";
    let lateByMinutes = 0;

    try {
      const [shiftHour, shiftMin] = shift.shiftStartTime.split(':').map(Number);
      
      // Create a Date object for today's Shift Start
      const shiftDate = new Date(indianTime);
      shiftDate.setHours(shiftHour, shiftMin, 0, 0);

      // Add Grace Period
      const graceMinutes = shift.lateGracePeriod || 15;
      const lateCutoff = new Date(shiftDate.getTime() + graceMinutes * 60000);

      // Comparison
      if (indianTime > lateCutoff) {
        loginStatus = "LATE";
        const diffMs = indianTime - shiftDate;
        lateByMinutes = Math.floor(diffMs / 60000); // Convert ms to minutes
      }
    } catch (calcError) {
      console.error("Time calculation error:", calcError);
      // Fallback to On Time if calculation fails
    }

    // 4. Save Record
    attendance = new EmployeeAttendance({
      employeeId,
      employeeName: name,
      date: today,
      punchIn: indianTime, // Saves IST time
      punchInLocation: { latitude, longitude },
      status: "Working",
      loginStatus: loginStatus, // Saved correctly as LATE or On Time
      lateBy: lateByMinutes
    });

    await attendance.save();
    res.json({ message: `Punch In successful (${loginStatus})`, attendance });

  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Punch Out
export const punchOut = async (req, res) => {
  try {
    const { employeeId } = req.user; 
    const { latitude, longitude } = req.body;
    
    // Use IST for finding the record
    const indianTime = getCurrentIndianTime();
    const today = indianTime.toISOString().split("T")[0];

    const attendance = await EmployeeAttendance.findOne({ employeeId, date: today });
    if (!attendance) {
      return res.status(400).json({ message: "Punch In not found for today" });
    }

    attendance.punchOut = indianTime;
    attendance.punchOutLocation = { latitude, longitude };
    attendance.status = "Completed";
    
    // Calculate Hours Worked
    const start = new Date(attendance.punchIn);
    const end = new Date(indianTime);
    const diffMs = end - start;
    const hours = Math.floor(diffMs / 1000 / 60 / 60);
    const minutes = Math.floor((diffMs / 1000 / 60) % 60);
    attendance.workedHours = hours + (minutes/60); // Store as decimal or string as needed

    await attendance.save();
    res.json({ message: "Punch Out successful", attendance });
  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get attendance
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user; 
    const attendance = await EmployeeAttendance.find({ employeeId }).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};