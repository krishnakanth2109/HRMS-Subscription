import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  FaMapMarkerAlt,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
// ✅ Imported 'api' default export for custom requests
import api, {
  getAttendanceForEmployee,
  punchIn,
  punchOut,
  uploadProfilePic,
  getProfilePic,
  deleteProfilePic,
  sendIdleActivity,
  getShiftByEmployeeId,
} from "../api";
import { useNavigate } from "react-router-dom";
import ImageCropModal from "./ImageCropModal";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// 🔴 IDLE CONFIGURATION
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 Minutes
const WORK_START_HOUR = 0;
const WORK_END_HOUR = 24;

// ✅ Updated to use centralized API (handles Token & BaseURL automatically)
const recordIdleActivityLocally = async (data) => {
  return api.post("/api/attendance/record-idle-activity", data);
};

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
  const [punchStatus, setPunchStatus] = useState("IDLE");
  const [shiftTimings, setShiftTimings] = useState(null);
  const navigate = useNavigate();

  // Crop modal states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  // State for the frontend timer
  const [workedTime, setWorkedTime] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  // 🔴 IDLE TRACKING REFS
  const isIdleRef = useRef(false);
  const idleStartTimeRef = useRef(null);
  const idleNotifiedRef = useRef(false); 
  const LOCAL_STORAGE_KEY = `lastActive_${user?.employeeId}`;

  // --- Voice Feedback ---
  const speak = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // ✅ Get user's current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          let errorMessage = "Unable to retrieve your location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied. Please enable location permissions.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
            default:
              break;
          }
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // --- Fetch Shift Timings ---
  const loadShiftTimings = useCallback(async (empId) => {
    try {
      const shiftData = await getShiftByEmployeeId(empId);
      setShiftTimings(shiftData);
    } catch (err) {
      console.error("Shift timings fetch error:", err);
      setShiftTimings({
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        fullDayHours: 8,
        halfDayHours: 4,
        autoExtendShift: true,
        weeklyOffDays: [0],
        isDefault: true
      });
    }
  }, []);

  // --- Fetch Attendance ---
  const loadAttendance = useCallback(
    async (empId) => {
      try {
        const data = await getAttendanceForEmployee(empId);
        const attendanceData = Array.isArray(data) ? data : (data.data || []);
        setAttendance(attendanceData);
        const todayEntry = attendanceData.find((d) => d.date === today);
        setTodayLog(todayEntry || null);
      } catch (err) {
        console.error("Attendance fetch error:", err);
      }
    },
    [today]
  );

  // --- Fetch Profile Picture ---
  const loadProfilePic = async () => {
    try {
      const res = await getProfilePic();
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage", res.profilePhoto.url);
      }
    } catch (err) {
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
          loadShiftTimings(user.employeeId)
        ]);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    bootstrap();
  }, [user, loadAttendance, loadShiftTimings]);

  const { name, email, phone, employeeId } = user || {};
  const latestExp = user?.experienceDetails?.[user.experienceDetails.length - 1];
  const role = latestExp?.role || user?.role || "N/A";
  const department = latestExp?.department || user?.department || "N/A";

  // --- Frontend Timer Effect ---
  useEffect(() => {
    let interval;
    if (todayLog?.punchIn && !todayLog.punchOut) {
      const punchInTime = new Date(todayLog.punchIn);
      const updateTimer = () => {
        const now = new Date();
        const diffInSeconds = Math.floor((now - punchInTime) / 1000);
        setWorkedTime(diffInSeconds);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [todayLog]);

  // 🔴 Helper to calculate Idle Time String
  const getTodayIdleTimeStr = () => {
    const activities = todayLog?.idleActivity || [];
    if (activities.length === 0) return "--";
    
    let totalMs = 0;
    activities.forEach((item) => {
      const start = new Date(item.idleStart).getTime();
      const end = item.idleEnd ? new Date(item.idleEnd).getTime() : new Date().getTime();
      
      if (todayLog.punchOut && !item.idleEnd) {
         const punchOutTime = new Date(todayLog.punchOut).getTime();
         if (punchOutTime > start) totalMs += (punchOutTime - start);
      } else {
         if (end > start) totalMs += (end - start);
      }
    });

    const totalSec = Math.floor(totalMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // ✅ Punch In/Out
  const handlePunch = async (action) => {
    if (!user) return;

    // 🔴 If Punching Out while Idle, force stop idle first
    if (action === "OUT" && isIdleRef.current) {
        try {
            await recordIdleActivityLocally({
                employeeId: user.employeeId,
                idleEnd: new Date().toISOString(),
                isIdle: false,
                idleStart: idleStartTimeRef.current
            });
            isIdleRef.current = false;
        } catch(e) { console.error(e); }
    }

    setPunchStatus("FETCHING");

    try {
      const location = await getCurrentLocation();
      setPunchStatus("PUNCHING");

      if (action === "IN") {
        // Reset local storage on punch in
        localStorage.setItem(LOCAL_STORAGE_KEY, Date.now());
        await punchIn({
          employeeId: user.employeeId,
          employeeName: user.name,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        speak(`${user.name}, punch in successful`);
      } else {
        await punchOut({
          employeeId: user.employeeId,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        speak(`${user.name}, punch out successful`);
      }

      await loadAttendance(user.employeeId);
    } catch (err) {
      console.error("Punch error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      if (msg.includes("Location")) {
        alert(msg);
      } else if (msg.toLowerCase().includes("already punched")) {
        alert("System syncing: You are already punched in.");
        await loadAttendance(user.employeeId);
      } else {
        speak("Punch operation failed");
        alert(`Failed to record attendance: ${msg}`);
      }
    } finally {
      setPunchStatus("IDLE");
    }
  };

  // --- Handle Image Selection ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // --- Handle Cropped Image Upload ---
  const handleCropComplete = async (croppedBlob) => {
    if (!user) return;
    const formData = new FormData();
    formData.append("image", croppedBlob, "profile.jpg");
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
        speak("Profile updated");
        alert("Profile picture updated successfully!");
        setShowCropModal(false);
        setImageToCrop(null);
      }
    } catch (err) {
      alert("Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProfilePic = async () => {
    if (!window.confirm("Are you sure you want to delete your profile picture?")) return;
    try {
      await deleteProfilePic();
      setProfileImage(null);
      sessionStorage.removeItem("profileImage");
      speak("Profile deleted");
    } catch (err) {
      alert("Failed to delete profile picture.");
    }
  };

  // ============================================================
  // 🔴 ROBUST IDLE TRACKING
  // ============================================================
  useEffect(() => {
    if (!user || !user.employeeId || !todayLog?.punchIn || todayLog?.punchOut) return;

    // 1. Sync with DB on Load
    // If DB says we are idle (null idleEnd), ensure the Ref knows it!
    if (todayLog.idleActivity && todayLog.idleActivity.length > 0) {
      const lastEntry = todayLog.idleActivity[todayLog.idleActivity.length - 1];
      if (lastEntry && !lastEntry.idleEnd && !isIdleRef.current) {
          console.log("🔄 Syncing: DB says user is idle. Updating Ref.");
          isIdleRef.current = true;
          idleStartTimeRef.current = lastEntry.idleStart;
      }
    }

    const handleActivity = () => {
      // Sync LocalStorage
      const now = Date.now();
      const lastSaved = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || 0);
      if (now - lastSaved > 1000) {
          localStorage.setItem(LOCAL_STORAGE_KEY, now);
      }

      // 2. If Idle -> Stop Idle
      if (isIdleRef.current && idleStartTimeRef.current) {
        const startT = idleStartTimeRef.current;
        
        // Reset immediately
        isIdleRef.current = false;
        idleStartTimeRef.current = null;
        idleNotifiedRef.current = false;

        console.log("🟢 User Active. Sending STOP IDLE to DB...");
        
        recordIdleActivityLocally({
            employeeId: user.employeeId,
            idleEnd: new Date().toISOString(),
            isIdle: false,
            idleStart: startT 
        })
        .then(() => {
           console.log("✅ DB Updated: Idle Stopped.");
           loadAttendance(user.employeeId); 
        })
        .catch(err => console.error("❌ Failed to stop idle:", err));
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    const intervalId = setInterval(async () => {
      const now = Date.now();
      const hour = new Date().getHours();
      if (hour < WORK_START_HOUR || hour >= WORK_END_HOUR) return;

      const lastActive = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || Date.now());
      const diff = now - lastActive;

      // 3. If Inactive -> Start Idle
      if (diff >= INACTIVITY_LIMIT_MS && !isIdleRef.current) {
        isIdleRef.current = true;
        idleStartTimeRef.current = new Date().toISOString();
        
        console.log("🔴 User Inactive. Sending START IDLE to DB...");
        
        try {
          await recordIdleActivityLocally({
            employeeId: user.employeeId,
            idleStart: idleStartTimeRef.current,
            isIdle: true,
          });
          
          if (!idleNotifiedRef.current) {
            idleNotifiedRef.current = true;
            // Optional: Send notification
            await sendIdleActivity({
              employeeId: user.employeeId,
              name: user.name,
              department,
              role,
              lastActiveAt: new Date(lastActive).toISOString(),
            });
          }
        } catch (error) { console.error("Failed to record idle start:", error); }
      }

      // Force re-render for live timer updates
      if (isIdleRef.current) {
         setWorkedTime(prev => prev); 
      }
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      clearInterval(intervalId);
    };
  }, [user, department, role, todayLog, loadAttendance, LOCAL_STORAGE_KEY]);


  // Data formatting
  const formatWorkedTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "0h 0m 0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatWorkedStatus = (status) => {
    if (!status || status === "NOT_APPLICABLE") return "--";
    return status.replace(/_/g, " ").toLowerCase();
  };

  const getPunchButtonContent = (action) => {
    const spinner = <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />;
    if (punchStatus === "FETCHING") return <>{spinner} Extracting Location...</>;
    if (punchStatus === "PUNCHING") return <>{spinner} {action === "IN" ? "Punching In..." : "Punching Out..."}</>;
    return action === "IN" ? "Punch In" : "Punch Out";
  };

  const formatTimeDisplay = (timeString) => {
    if (!timeString) return "--";
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) { return timeString; }
  };

  const getDayNames = (dayNumbers = []) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNumbers.map(day => days[day]).join(', ') || 'None';
  };

  const leaveBarData = useMemo(() => ({
    labels: ["Full Day", "Half Day", "Absent"],
    datasets: [{
        label: "Attendance",
        data: [
          attendance.filter((a) => a.workedStatus === "FULL_DAY").length,
          attendance.filter((a) => a.workedStatus === "HALF_DAY").length,
          attendance.filter((a) => a.status === "ABSENT" || a.workedStatus === "ABSENT").length,
        ],
        backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
        borderRadius: 6,
    }],
  }), [attendance]);

  const workPieData = useMemo(() => ({
    labels: ["Worked Hours", "Remaining"],
    datasets: [{
        data: [
          todayLog?.workedHours || 0,
          Math.max(0, (shiftTimings?.fullDayHours || 8) - (todayLog?.workedHours || 0)),
        ],
        backgroundColor: ["#3b82f6", "#e5e7eb"],
    }],
  }), [todayLog, shiftTimings]);

  if (loading) return <div className="p-8 text-center text-lg font-semibold">Loading Dashboard...</div>;
  if (!user) return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data.</div>;

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Profile Section (With Cloudinary Fix) */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6">
        <div className="relative group">
          <img
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
            alt="Profile"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className="w-28 h-28 rounded-full border-4 border-white shadow-md object-cover"
          />
          <div className="absolute bottom-1 right-1 flex gap-1">
            <label htmlFor="profile-upload" className={`bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}>
              {uploadingImage ? <div className="animate-spin">⏳</div> : profileImage ? <FaEdit size={14} /> : <FaCamera size={14} />}
            </label>
            {profileImage && (
              <button onClick={handleDeleteProfilePic} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                <FaTrash size={14} />
              </button>
            )}
          </div>
          <input id="profile-upload" type="file" className="hidden" onChange={handleImageSelect} disabled={uploadingImage} />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><FaUserCircle /> {name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 mt-2">
            <div><b>ID:</b> {employeeId}</div>
            <div><b>Email:</b> {email}</div>
            <div><b>Phone:</b> {phone || "N/A"}</div>
            <div><b>Department:</b> {department}</div>
            <div><b>Role:</b> {role}</div>
          </div>
          
          {/* Shift Timings (Preserved) */}
          {shiftTimings && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><FaRegClock /> Your Shift Timings</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-600">Start:</span><div className="font-semibold">{formatTimeDisplay(shiftTimings.shiftStartTime)}</div></div>
                <div><span className="text-gray-600">End:</span><div className="font-semibold">{formatTimeDisplay(shiftTimings.shiftEndTime)}</div></div>
                <div><span className="text-gray-600">Grace:</span><div className="font-semibold">{shiftTimings.lateGracePeriod} mins</div></div>
                <div><span className="text-gray-600">Weekly Off:</span><div className="font-semibold text-xs">{getDayNames(shiftTimings.weeklyOffDays)}</div></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Table (With IDLE TIME Column) */}
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
                <th className="px-4 py-3 text-left">Idle Time</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="text-gray-700 border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                <td className="px-4 py-3 font-medium">{today}</td>
                <td className="px-4 py-3">{todayLog?.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString() : "--"}</td>
                <td className="px-4 py-3">{todayLog?.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString() : "--"}</td>
                <td className="px-4 py-3 font-mono">{todayLog?.punchIn && !todayLog?.punchOut ? formatWorkedTime(workedTime) : todayLog?.displayTime || "0h 0m 0s"}</td>
                <td className="px-4 py-3">
                  {todayLog?.punchIn ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${todayLog.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                      {todayLog.loginStatus === "LATE" ? "Late" : "On Time"}
                    </span>
                  ) : "--"}
                </td>
                <td className="px-4 py-3 capitalize">
                  {todayLog?.punchIn && !todayLog?.punchOut ? <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">Working...</span> : formatWorkedStatus(todayLog?.workedStatus)}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-orange-600">
                  {todayLog?.punchIn ? getTodayIdleTimeStr() : "--"}
                </td>
                <td className="px-4 py-3 text-center">
                  {!todayLog?.punchIn ? (
                    <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 mx-auto flex gap-2" onClick={() => handlePunch("IN")} disabled={punchStatus !== "IDLE"}>{getPunchButtonContent("IN")}</button>
                  ) : !todayLog?.punchOut ? (
                    <button className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 disabled:opacity-50 mx-auto flex gap-2" onClick={() => handlePunch("OUT")} disabled={punchStatus !== "IDLE"}>{getPunchButtonContent("OUT")}</button>
                  ) : (
                    <span className="text-gray-500 font-semibold">Done</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-6">
          <div className="flex items-center gap-3">
            {todayLog?.punchInLocation && (
              <button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchInLocation.latitude},${todayLog.punchInLocation.longitude}`, "_blank")} className="bg-blue-100 text-blue-800 px-3 py-1.5 text-xs rounded-full hover:bg-blue-200 flex gap-1"><FaMapMarkerAlt /> In Location</button>
            )}
            {todayLog?.punchOutLocation && (
              <button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchOutLocation.latitude},${todayLog.punchOutLocation.longitude}`, "_blank")} className="bg-red-100 text-red-800 px-3 py-1.5 text-xs rounded-full hover:bg-red-200 flex gap-1"><FaMapMarkerAlt /> Out Location</button>
            )}
          </div>
          <button onClick={() => navigate("/employee/my-attendence")} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">View Attendance History →</button>
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

      {showCropModal && imageToCrop && (
      <ImageCropModal imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => { setShowCropModal(false); setImageToCrop(null); }} isUploading={uploadingImage} />
      )}
    </div>
  );
};

export default EmployeeDashboard;