// --- START OF FILE controllers/attendanceController.js ---

import Attendance from "../models/Attendance.js"; // Updated import name
import Shift from "../models/shiftModel.js"; 

// ✅ HELPER: Get current time explicitly in Indian Standard Time (IST)
const getCurrentIndianTime = () => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utcTime + istOffset);
};

// ✅ Punch In
export const punchIn = async (req, res) => {
  try {
    // req.user is populated from authController (Employee)
    const { employeeId, name, adminId, company } = req.user; 
    const { latitude, longitude } = req.body; 

    const indianTime = getCurrentIndianTime();
    const today = indianTime.toISOString().split("T")[0]; 

    // 1. Find existing Attendance doc for this employee
    let attendanceDoc = await Attendance.findOne({ employeeId });

    if (!attendanceDoc) {
        // Create parent document if not exists (First ever punch for this employee)
        attendanceDoc = new Attendance({
            adminId: adminId,       // Hierarchy Link
            companyId: company,     // Hierarchy Link
            employeeId,
            employeeName: name,
            attendance: []
        });
    }

    // 2. Check if already punched in TODAY
    const dailyRecord = attendanceDoc.attendance.find(r => r.date === today);
    if (dailyRecord && dailyRecord.punchIn) {
      return res.status(400).json({ message: "Already punched in for today" });
    }

    // 3. Fetch Shift Data for Logic
    const shift = await Shift.findOne({ employeeId }) || {
      shiftStartTime: "09:30",
      lateGracePeriod: 15
    };

    // 4. Time Logic
    let loginStatus = "ON_TIME";
    let lateByMinutes = 0;

    try {
      const [shiftHour, shiftMin] = shift.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(indianTime);
      shiftDate.setHours(shiftHour, shiftMin, 0, 0);

      const graceMinutes = shift.lateGracePeriod || 15;
      const lateCutoff = new Date(shiftDate.getTime() + graceMinutes * 60000);

      if (indianTime > lateCutoff) {
        loginStatus = "LATE";
        const diffMs = indianTime - shiftDate;
        lateByMinutes = Math.floor(diffMs / 60000);
      }
    } catch (calcError) {
      console.error("Time calculation error:", calcError);
    }

    // 5. Create Daily Schema Object
    const newDailyRecord = {
      date: today,
      punchIn: indianTime,
      punchInLocation: { latitude, longitude },
      status: "WORKING",
      loginStatus: loginStatus,
      sessions: [{ punchIn: indianTime }] // Start first session
    };

    // Push to array
    attendanceDoc.attendance.push(newDailyRecord);
    await attendanceDoc.save();

    res.json({ message: `Punch In successful (${loginStatus})`, attendance: newDailyRecord });

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
    
    const indianTime = getCurrentIndianTime();
    const today = indianTime.toISOString().split("T")[0];

    const attendanceDoc = await Attendance.findOne({ employeeId });
    if (!attendanceDoc) return res.status(404).json({ message: "No attendance record found" });

    // Find today's record
    const dailyRecord = attendanceDoc.attendance.find(r => r.date === today);
    
    if (!dailyRecord || !dailyRecord.punchIn) {
      return res.status(400).json({ message: "Punch In not found for today" });
    }

    if (dailyRecord.punchOut) {
        return res.status(400).json({ message: "Already punched out" });
    }

    // Update Record
    dailyRecord.punchOut = indianTime;
    dailyRecord.punchOutLocation = { latitude, longitude };
    dailyRecord.status = "COMPLETED";

    // Close Session
    const lastSession = dailyRecord.sessions[dailyRecord.sessions.length - 1];
    if (lastSession && !lastSession.punchOut) {
        lastSession.punchOut = indianTime;
        lastSession.durationSeconds = (indianTime - lastSession.punchIn) / 1000;
    }
    
    // Calc Total Hours
    const start = new Date(dailyRecord.punchIn);
    const end = new Date(indianTime);
    const diffMs = end - start;
    const hours = Math.floor(diffMs / 1000 / 60 / 60);
    const minutes = Math.floor((diffMs / 1000 / 60) % 60);
    
    dailyRecord.workedHours = hours;
    dailyRecord.workedMinutes = minutes;
    dailyRecord.displayTime = `${hours}h ${minutes}m`;

    await attendanceDoc.save();
    res.json({ message: "Punch Out successful", attendance: dailyRecord });
  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get attendance (Employee Side)
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user; 
    const doc = await Attendance.findOne({ employeeId });
    // Return the array of daily logs, sorted newest first
    const logs = doc ? doc.attendance.reverse() : [];
    res.json(logs);
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};