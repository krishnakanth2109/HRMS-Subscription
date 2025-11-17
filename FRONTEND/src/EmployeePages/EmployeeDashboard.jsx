import React, { useContext, useState, useEffect, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { NoticeContext } from "../context/NoticeContext";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  FaRegClock,
  FaUserCircle,
  FaBell,
  FaCalendarAlt,
  FaChartPie,
  FaCamera,
} from "react-icons/fa";
import {
  getAttendanceForEmployee,
  punchIn,
  punchOut,
  uploadProfilePic,
  getProfilePic,
} from "../api";
import { useNavigate } from "react-router-dom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const EmployeeDashboard = () => {
  const { user } = useContext(AuthContext);
  const { notices } = useContext(NoticeContext);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [profileImage, setProfileImage] = useState(
    sessionStorage.getItem("profileImage") || null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const navigate = useNavigate();

  // State for the frontend timer
  const [workedTime, setWorkedTime] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  // --- Voice Feedback ---
  const speak = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Fetch Attendance ---
  const loadAttendance = useCallback(
    async (empId) => {
      try {
        const data = await getAttendanceForEmployee(empId);
        const attendanceData = Array.isArray(data) ? data : [];
        setAttendance(attendanceData);
        const todayEntry = attendanceData.find((d) => d.date === today);
        setTodayLog(todayEntry || null);
      } catch (err) {
        console.error("Attendance fetch error:", err);
      }
    },
    [today]
  );

  // --- Fetch Profile Picture from backend ---
  const loadProfilePic = async () => {
    try {
      console.log("📸 Fetching profile picture...");
      const res = await getProfilePic();
      console.log("📸 Profile pic response:", res);

      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage", res.profilePhoto.url);
        console.log("✅ Profile picture loaded:", res.profilePhoto.url);
      } else {
        console.log("ℹ️ No profile picture found");
      }
    } catch (err) {
      console.error("Profile pic fetch error:", err);
      if (err.response?.status !== 404) {
        console.error("Unexpected error fetching profile pic:", err);
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (user && user.employeeId) {
        setLoading(true);
        await Promise.all([
          loadAttendance(user.employeeId),
          loadProfilePic(),
        ]);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    bootstrap();
  }, [user, loadAttendance]);
  
  // --- ✅ ADDED: Frontend Timer Effect ---
  useEffect(() => {
    let interval;

    // Start timer only if punched in but not punched out
    if (todayLog?.punchIn && !todayLog.punchOut) {
      const punchInTime = new Date(todayLog.punchIn);

      const updateTimer = () => {
        const now = new Date();
        const diffInSeconds = Math.floor((now - punchInTime) / 1000);
        setWorkedTime(diffInSeconds);
      };

      updateTimer(); // Set initial time immediately
      interval = setInterval(updateTimer, 1000); // Update every second
    }

    // Cleanup function to clear the interval when component unmounts or status changes
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [todayLog]); // This effect re-runs whenever the attendance log changes


  // --- Punch In/Out ---
  const handlePunch = async (action) => {
    if (!user) return;
    try {
      if (action === "IN") {
        await punchIn({
          employeeId: user.employeeId,
          employeeName: user.name,
        });
        speak(`${user.name}, punch in successful`);
      } else {
        await punchOut({ employeeId: user.employeeId });
        speak(`${user.name}, punch out successful`);
      }
      await loadAttendance(user.employeeId);
    } catch (err) {
      console.error("Punch error:", err);
      speak("Punch operation failed");
    }
  };

  // --- Upload New Profile Picture ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPEG, PNG, GIF, WEBP)");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("employeeId", user.employeeId);
    formData.append("name", user.name);
    formData.append("email", user.email);
    formData.append("phone", user.phone || "");

    setUploadingImage(true);
    try {
      const res = await uploadProfilePic(formData);
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage", res.profilePhoto.url);
        speak("Profile picture updated successfully");
        alert("Profile picture updated successfully!");
      } else {
        alert("Upload succeeded but response format was unexpected");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to upload image. Please try again.";
      alert(errorMessage);
      speak("Profile picture update failed");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  if (loading) return <div className="p-8 text-center text-lg font-semibold">Loading Employee Dashboard...</div>;
  if (!user) return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data.</div>;

  const { name, email, phone, employeeId } = user;

  const leaveBarData = {
    labels: ["Full Day", "Half Day", "Absent"],
    datasets: [{
      label: "Attendance",
      data: [
        attendance.filter((a) => a.status === "Present" && !a.isHalfDay).length,
        attendance.filter((a) => a.isHalfDay).length,
        attendance.filter((a) => a.status === "Absent").length,
      ],
      backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
      borderRadius: 6,
    }],
  };

  const workPieData = {
    labels: ["Worked Hours", "Remaining"],
    datasets: [{
      data: [todayLog?.workedHours || 0, Math.max(0, 8 - (todayLog?.workedHours || 0))],
      backgroundColor: ["#3b82f6", "#e5e7eb"],
    }],
  };
  
  // ✅ ADDED: Helper to format worked time from seconds
  const formatWorkedTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return "0h 0m 0s";
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatWorkedStatus = (status) => {
    if (!status || status === "NOT_APPLICABLE") return "--";
    return status.replace("_", " ").toLowerCase();
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Profile Section */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6">
        <div className="relative">
          <img
            alt="Employee"
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
            className="w-28 h-28 rounded-full border-4 border-white shadow object-cover"
          />
          <label
            htmlFor="profile-upload"
            className={`absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Upload Profile Picture"
          >
            {uploadingImage ? <div className="animate-spin">⏳</div> : <FaCamera size={16} />}
          </label>
          <input
            id="profile-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleImageUpload}
            disabled={uploadingImage}
          />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <FaUserCircle className="text-blue-400" /> {name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 mt-2">
            <div><b>ID:</b> {employeeId}</div>
            <div><b>Email:</b> {email}</div>
            <div><b>Phone:</b> {phone || "N/A"}</div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-100 rounded-2xl shadow-lg p-6 mb-8 animate-fade-in">
        <div className="flex items-center mb-6 gap-3 border-b border-gray-200 pb-4">
          <FaRegClock className="text-blue-600 text-2xl" />
          <h2 className="font-bold text-2xl text-gray-800">Daily Attendance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-blue-600 text-white uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Punch In</th>
                <th className="px-4 py-3 text-left">Punch Out</th>
                <th className="px-4 py-3 text-left">Worked</th>
                <th className="px-4 py-3 text-left">Login Status</th>
                <th className="px-4 py-3 text-left">Worked Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="text-gray-700 border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200 animate-fade-in-up">
                <td className="px-4 py-3 font-medium">{today}</td>
                <td className="px-4 py-3">{todayLog?.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString() : "--"}</td>
                <td className="px-4 py-3">{todayLog?.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString() : "--"}</td>
                {/* ✅ UPDATED: Show live timer or final time */}
                <td className="px-4 py-3 font-mono">
                  {todayLog?.punchIn && !todayLog?.punchOut
                    ? formatWorkedTime(workedTime)
                    : todayLog?.displayTime || "0h 0m 0s"}
                </td>
                <td className="px-4 py-3">
                  {todayLog?.punchIn ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                        todayLog.loginStatus === "LATE"
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-green-100 text-green-800 border border-green-200"
                      }`}
                    >
                      {todayLog.loginStatus === "LATE" ? "Late" : "On Time"}
                    </span>
                  ) : ("--")}
                </td>
                {/* ✅ UPDATED: Show "Working..." badge or final status */}
                <td className="px-4 py-3 capitalize">
                   {todayLog?.punchIn && !todayLog?.punchOut ? (
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Working...
                      </span>
                    ) : (
                      formatWorkedStatus(todayLog?.workedStatus)
                    )}
                </td>
                <td className="px-4 py-3 text-center">
                  {!todayLog?.punchIn ? (
                    <button
                      className="bg-green-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-600 active:scale-95 transform transition-transform duration-150"
                      onClick={() => handlePunch("IN")}
                    >
                      Punch In
                    </button>
                  ) : !todayLog?.punchOut ? (
                    <button
                      className="bg-red-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-600 active:scale-95 transform transition-transform duration-150"
                      onClick={() => handlePunch("OUT")}
                    >
                      Punch Out
                    </button>
                  ) : (
                    <span className="text-gray-500 font-semibold">Done</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-right mt-6">
          <button
            onClick={() => navigate("/employee/my-attendence")}
            className="bg-blue-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out transform hover:-translate-y-1"
          >
            View Attendance History →
          </button>
        </div>
      </div>

      {/* Charts & Notices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2"><FaCalendarAlt className="text-blue-500" /> Attendance Summary</h2>
          <Bar data={leaveBarData} />
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2"><FaChartPie className="text-yellow-500" /> Work Hours Today</h2>
          <Pie data={workPieData} />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-4 mb-8">
        <h2 className="font-bold flex items-center gap-2 mb-2"><FaBell className="text-red-500" /> Notice Board</h2>
        {notices?.length > 0 ? (
          <ul className="space-y-2">
            {notices.map((n, i) => (
              <li key={i} className="border-b pb-2"><b>{n.title}</b> - {n.description}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No Notices</p>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;