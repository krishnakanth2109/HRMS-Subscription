// --- START OF FILE controllers/attendanceController.js ---

import EmployeeAttendance from "../models/EmployeeAttendance.js";

// ✅ Punch In now uses the logged-in user's ID
export const punchIn = async (req, res) => {
  try {
    // Get employeeId and name from the authenticated user object
    const { employeeId, name } = req.user;
    const { punchIn } = req.body;

    const today = new Date().toISOString().split("T")[0];
    let attendance = await EmployeeAttendance.findOne({ employeeId, date: today });
    if (attendance) {
      return res.status(400).json({ message: "Already punched in for today" });
    }
    attendance = new EmployeeAttendance({
      employeeId,
      employeeName: name, // Store the name as well
      date: today,
      punchIn,
      status: "Working",
    });
    await attendance.save();
    res.json({ message: "Punch In successful", attendance });
  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Punch Out now uses the logged-in user's ID
export const punchOut = async (req, res) => {
  try {
    const { employeeId } = req.user; // Get from authenticated user
    const { punchOut } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const attendance = await EmployeeAttendance.findOne({ employeeId, date: today });
    if (!attendance) {
      return res.status(400).json({ message: "Punch In not found for today" });
    }
    attendance.punchOut = punchOut;
    attendance.status = "Completed";
    await attendance.save();
    res.json({ message: "Punch Out successful", attendance });
  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get attendance now automatically gets it for the logged-in user
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user; // Get from authenticated user
    const attendance = await EmployeeAttendance.find({ employeeId });
    res.json(attendance);
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};