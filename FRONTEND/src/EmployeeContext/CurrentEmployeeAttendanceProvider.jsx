// ✅ CurrentEmployeeAttendanceProvider.jsx (FINAL CLEAN VERSION)
import { useState, useEffect } from "react";
import axios from "axios";
import { CurrentEmployeeAttendanceContext } from "./CurrentEmployeeAttendanceContext";

const API = "http://localhost:5000";

const CurrentEmployeeAttendanceProvider = ({ children }) => {
  // ✅ Logged user
  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const employeeId = loggedUser?.employeeId; // ✅ Use exact value (EMP101)

  // ✅ Manual (dummy) attendance for fallback
  const manualAttendance = [
    // ✅ paste your full 30-day attendance list here
  ];

  // ✅ States
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [PermissionRequests, setPermissionRequests] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);

  // ✅ Update single attendance row
  const updateAttendanceRecord = (id, updates) => {
    setAttendanceRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;

        const updated = { ...rec, ...updates };

        // ✅ Auto-mark manual approval
        if (
          (updates.actualPunchIn && updates.actualPunchIn !== rec.actualPunchIn) ||
          (updates.actualPunchOut && updates.actualPunchOut !== rec.actualPunchOut)
        ) {
          updated.manualApproval = 0x01;
        }

        // ✅ Auto-calculate idle time
        if (updates.workedHours !== undefined) {
          updated.idleTime = Math.max(
            0,
            (updated.workHours || 0) - updates.workedHours
          );
        }

        return updated;
      })
    );
  };

  // ✅ Fetch Attendance
  const fetchAttendance = async () => {
    if (!employeeId) {
      console.warn("⚠ No employeeId found → using dummy data");
      setAttendanceRecords(manualAttendance);
      return;
    }

    console.log("✅ Fetching attendance for:", employeeId);

    try {
      const res = await axios.get(`${API}/attendance/${employeeId}`);

      if (Array.isArray(res.data) && res.data.length > 0) {
        const formatted = res.data.map((rec, index) => ({
          id: rec._id || index + 1,
          employeeId: rec.employeeId,
          name: rec.name || "Employee",
          date: rec.date,
          status: rec.status || "Present",
          punchIn: rec.punchIn || "",
          punchOut: rec.punchOut || "",
          actualPunchIn: rec.actualPunchIn || "",
          actualPunchOut: rec.actualPunchOut || "",
          workHours: rec.workHours || 0,
          workedHours: rec.workedHours || 0,
          idleTime: rec.idleTime || 0,
          isHalfDay: rec.isHalfDay ?? 0x00,
          isLateLogin: rec.isLateLogin ?? 0x00,
          isOtDay: rec.isOtDay ?? 0x00,
          manualApproval: rec.manualApproval ?? 0x00,
        }));

        setAttendanceRecords(formatted);
      } else {
        console.warn("⚠ No attendance in backend → using dummy");
        setAttendanceRecords(manualAttendance);
      }
    } catch (err) {
      console.error("❌ Attendance fetch failed:", err);
      setAttendanceRecords(manualAttendance);
    }
  };

  // ✅ Fetch Permission Requests
  const fetchPermissions = async () => {
    try {
      const res = await axios.get(`${API}/permissions/${employeeId}`);
      setPermissionRequests(res.data.length ? res.data : []);
    } catch (err) {
      console.error("❌ Permission fetch failed:", err);
      setPermissionRequests([]);
    }
  };

  // ✅ Fetch Overtime Requests
  const fetchOvertime = async () => {
    try {
      const res = await axios.get(`${API}/overtime/${employeeId}`);
      setOvertimeRequests(res.data.length ? res.data : []);
    } catch (err) {
      console.error("❌ Overtime fetch failed:", err);
      setOvertimeRequests([]);
    }
  };

  // ✅ On Employee Login Change → Load All Data
  useEffect(() => {
    fetchAttendance();
    fetchPermissions();
    fetchOvertime();
  }, [employeeId]);

  return (
    <CurrentEmployeeAttendanceContext.Provider
      value={{
        attendanceRecords,
        updateAttendanceRecord,

        PermissionRequests,

        overtimeRequests,
      }}
    >
      {children}
    </CurrentEmployeeAttendanceContext.Provider>
  );
};

export default CurrentEmployeeAttendanceProvider;
