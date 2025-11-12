import React, { useEffect, useState } from "react";
import axios from "axios";

const NewEmployeeAttendance = ({ employeeId, employeeName, department, role }) => {
  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);

  const loadAttendance = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/${employeeId}`);

      const data = Array.isArray(res.data) ? res.data : [];

      setAttendance(data);

      const today = new Date().toISOString().split("T")[0];
      const log = data.find((x) => x.date === today);

      setTodayLog(log);
    } catch (err) {
      console.error("Attendance fetch error:", err);
      setAttendance([]);
    }
  };

  const handlePunch = async () => {
    try {
      if (!todayLog || !todayLog.punchIn) {
        await axios.post("http://localhost:5000/api/attendance/punch-in", {
          employeeId,
          employeeName
        });
      } else {
        await axios.post("http://localhost:5000/api/attendance/punch-out", {
          employeeId
        });
      }

      loadAttendance();
    } catch (err) {
      console.error("Punch error:", err);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Daily Attendance</h2>

      {/* ✅ Top Employee Info */}
      <div className="border p-4 rounded-lg mb-4 bg-blue-50">
        <p><b>Name:</b> {employeeName}</p>
        <p><b>ID:</b> {employeeId}</p>
        <p><b>Department:</b> {department}</p>
        <p><b>Role:</b> {role}</p>

        <button
          onClick={handlePunch}
          className={`mt-3 px-4 py-2 text-white rounded ${
            todayLog?.punchIn && !todayLog?.punchOut
              ? "bg-red-600"
              : "bg-green-600"
          }`}
        >
          {todayLog?.punchIn && !todayLog?.punchOut ? "Punch Out" : "Punch In"}
        </button>
      </div>

      {/* ✅ Attendance Table */}
      <table className="min-w-full text-sm border">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-3 py-2 border">Date</th>
            <th className="px-3 py-2 border">Punch In</th>
            <th className="px-3 py-2 border">Punch Out</th>
            <th className="px-3 py-2 border">Status</th>
            <th className="px-3 py-2 border">Worked Hours</th>
          </tr>
        </thead>

        <tbody>
          {attendance.length > 0 ? (
            attendance.map((item) => (
              <tr key={item._id} className="text-center">
                <td className="border px-2 py-2">{item.date}</td>
                <td className="border px-2 py-2">
                  {item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "-"}
                </td>
                <td className="border px-2 py-2">
                  {item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "-"}
                </td>
                <td className="border px-2 py-2">{item.status}</td>
                <td className="border px-2 py-2">{item.workedHours} hrs</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="text-center p-4">No attendance found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default NewEmployeeAttendance;
