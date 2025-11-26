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
import { Bar, Doughnut } from "react-chartjs-2";
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
  FaCalendarAlt,
  FaChartPie,
  FaCamera,
  FaMapMarkerAlt,
  FaEdit,
  FaTrash,
  FaChevronDown,
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
  
  // Toggle for Shift Dropdown
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
        // Find today's entry based on date string match
        const todayStr = new Date().toISOString().split("T")[0];
        const todayEntry = attendanceData.find((d) => d.date === todayStr);
        setTodayLog(todayEntry || null);
      } catch (err) {
        console.error("Attendance fetch error:", err);
      }
    },
    []
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsShiftDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    } else if (todayLog?.workedHours) {
        // If already punched out, set fixed time
        setWorkedTime(todayLog.workedHours * 3600);
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

    if (todayLog.idleActivity && todayLog.idleActivity.length > 0) {
      const lastEntry = todayLog.idleActivity[todayLog.idleActivity.length - 1];
      if (lastEntry && !lastEntry.idleEnd && !isIdleRef.current) {
          isIdleRef.current = true;
          idleStartTimeRef.current = lastEntry.idleStart;
      }
    }

    const handleActivity = () => {
      const now = Date.now();
      const lastSaved = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || 0);
      if (now - lastSaved > 1000) {
          localStorage.setItem(LOCAL_STORAGE_KEY, now);
      }

      if (isIdleRef.current && idleStartTimeRef.current) {
        const startT = idleStartTimeRef.current;
        isIdleRef.current = false;
        idleStartTimeRef.current = null;
        idleNotifiedRef.current = false;
        
        recordIdleActivityLocally({
            employeeId: user.employeeId,
            idleEnd: new Date().toISOString(),
            isIdle: false,
            idleStart: startT 
        })
        .then(() => { loadAttendance(user.employeeId); })
        .catch(err => console.error(err));
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

      if (diff >= INACTIVITY_LIMIT_MS && !isIdleRef.current) {
        isIdleRef.current = true;
        idleStartTimeRef.current = new Date().toISOString();
        
        try {
          await recordIdleActivityLocally({
            employeeId: user.employeeId,
            idleStart: idleStartTimeRef.current,
            isIdle: true,
          });
          if (!idleNotifiedRef.current) {
            idleNotifiedRef.current = true;
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
      if (isIdleRef.current) setWorkedTime(prev => prev); 
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

  // ✅ New Helper: Calculate difference between shift times in Seconds
  const getShiftDurationInSeconds = (startTime, endTime) => {
    if(!startTime || !endTime) return 8 * 3600; // Default 8 hrs
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    // Handle overnight shifts (e.g. 10 PM to 6 AM)
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }
    
    return diffMinutes * 60;
  };

  // ✅ New Helper: Worked Status Badge Logic
  const getWorkedStatusBadge = () => {
    if (!todayLog?.punchIn) return { label: "--", color: "text-gray-500" };

    // 1. If actively working (Not punched out)
    if (!todayLog.punchOut) {
        return { label: "Working...", color: "bg-blue-100 text-blue-800 animate-pulse" };
    }

    // 2. If punched out, calculate final status
    // Use total shift seconds from shift details
    const totalShiftSeconds = shiftTimings ? getShiftDurationInSeconds(shiftTimings.shiftStartTime, shiftTimings.shiftEndTime) : 8 * 3600;
    
    // workedTime state holds the seconds, ensure it's accurate
    const currentWorkedSeconds = workedTime; 
    const fiveHoursSeconds = 5 * 3600;

    if (currentWorkedSeconds >= totalShiftSeconds) {
        return { label: "Full Day", color: "bg-green-100 text-green-800" };
    } else if (currentWorkedSeconds > fiveHoursSeconds) {
        return { label: "Half Day", color: "bg-yellow-100 text-yellow-800" };
    } else {
        // Less than or equal to 5 hours
        return { label: "Absent", color: "bg-red-100 text-red-800" };
    }
  };

  // ✅ New Helper Function to calculate visual Login status
  const getDisplayLoginStatus = () => {
    if (!todayLog?.punchIn || !shiftTimings) return todayLog?.loginStatus || "--";
    
    // If backend says LATE, believe it
    if (todayLog.loginStatus === "LATE") return "LATE";

    // Double check on frontend in case backend time was off
    try {
      const punchTime = new Date(todayLog.punchIn);
      const [sHour, sMin] = shiftTimings.shiftStartTime.split(':').map(Number);
      
      const shiftTime = new Date(punchTime);
      shiftTime.setHours(sHour, sMin, 0, 0);
      
      // Add Grace
      shiftTime.setMinutes(shiftTime.getMinutes() + (shiftTimings.lateGracePeriod || 15));

      if (punchTime > shiftTime) {
        return "LATE";
      }
      return "On Time";
    } catch (e) {
      return todayLog.loginStatus || "On Time";
    }
  };

  // --- Dynamic Meter Chart Calculation ---
  const workMeterData = useMemo(() => {
    // 1. Determine Total Shift Seconds (Based on Start & End Time)
    let totalShiftSeconds = 8 * 3600; // default
    if (shiftTimings?.shiftStartTime && shiftTimings?.shiftEndTime) {
        totalShiftSeconds = getShiftDurationInSeconds(shiftTimings.shiftStartTime, shiftTimings.shiftEndTime);
    } else if (shiftTimings?.fullDayHours) {
        totalShiftSeconds = shiftTimings.fullDayHours * 3600;
    }

    // 2. Determine Current Worked Seconds (Live or Static)
    // workedTime is updated every second by useEffect if punched in
    // Ensure we don't go below 0
    const currentWorked = Math.max(0, workedTime);
    
    // 3. Determine Remaining
    const remaining = Math.max(0, totalShiftSeconds - currentWorked);

    return {
      labels: ["Worked", "Pending"],
      datasets: [
        {
          data: [currentWorked, remaining],
          backgroundColor: ["#3b82f6", "#e5e7eb"], // Blue for work, Gray for pending
          borderWidth: 0,
          cutout: "75%", // Thin line for meter look
          circumference: 180, // Half circle
          rotation: -90, // Rotate to start from left
        },
      ],
      // Store raw values for external use if needed
      rawValues: { currentWorked, remaining, totalShiftSeconds }
    };
  }, [workedTime, shiftTimings]);

  // Chart Options for UI consistency
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true }
    }
  };

  const meterChartOptions = {
    ...commonChartOptions,
    plugins: {
        legend: { display: false }, // Hide legend for meter, use custom text below
        tooltip: { 
            callbacks: {
                label: function(context) {
                    const val = context.raw;
                    const h = Math.floor(val / 3600);
                    const m = Math.floor((val % 3600) / 60);
                    return `${context.label}: ${h}h ${m}m`;
                }
            }
        }
    }
  };

  const leaveBarData = useMemo(() => ({
    labels: ["Full Day", "Half Day", "Absent"],
    datasets: [{
        label: "Days",
        data: [
          attendance.filter((a) => a.workedStatus === "FULL_DAY").length,
          attendance.filter((a) => a.workedStatus === "HALF_DAY").length,
          attendance.filter((a) => a.status === "ABSENT" || a.workedStatus === "ABSENT").length,
        ],
        backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
        borderRadius: 6,
    }],
  }), [attendance]);

  if (loading) return <div className="p-8 text-center text-lg font-semibold">Loading Dashboard...</div>;
  if (!user) return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data.</div>;

  // Calculate status for display
  const displayStatus = getDisplayLoginStatus();
  const workedStatusBadge = getWorkedStatusBadge();
  
  // ✅ UPDATED: Format calculated Shift Hours to "Xh Ym" instead of decimal
  const getFormattedShiftDuration = () => {
      if(!shiftTimings) return "8h 0m";
      const totalSeconds = getShiftDurationInSeconds(shiftTimings.shiftStartTime, shiftTimings.shiftEndTime);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      return `${h}h ${m}m`;
  };
  const calculatedShiftHours = getFormattedShiftDuration();

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Profile Section */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6 relative">
        <div className="relative group">
          <img
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
            alt="Profile Img"
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
        
        <div className="flex-1 w-full">
          <div className="flex justify-between items-start w-full">
             <div>
                <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><FaUserCircle /> {name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-gray-700 mt-2 text-sm">
                    <div><b>ID:</b> {employeeId}</div>
                    <div><b>Email:</b> {email}</div>
                    <div><b>Department:</b> {department}</div>
                    <div><b>Role:</b> {role}</div>
                </div>
             </div>

             {/* Dynamic Dropdown for Shift Timings */}
             {shiftTimings && (
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)}
                        className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-50 transition-all text-sm font-semibold"
                    >
                        <FaRegClock /> Shift Details <FaChevronDown className={`transform transition-transform ${isShiftDropdownOpen ? 'rotate-180' : ''}`} size={12}/>
                    </button>

                    {isShiftDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 animate-fade-in-down">
                            <h4 className="font-bold text-blue-800 border-b pb-2 mb-3">Assigned Shift</h4>
                            <div className="space-y-3 text-sm text-gray-700">
                                <div className="flex justify-between"><span>Start Time:</span> <span className="font-semibold text-gray-900">{formatTimeDisplay(shiftTimings.shiftStartTime)}</span></div>
                                <div className="flex justify-between"><span>End Time:</span> <span className="font-semibold text-gray-900">{formatTimeDisplay(shiftTimings.shiftEndTime)}</span></div>
                                <div className="flex justify-between"><span>Late Grace:</span> <span className="font-semibold text-gray-900">{shiftTimings.lateGracePeriod} mins</span></div>
                                <div className="flex justify-between"><span>Calc Work Hrs:</span> <span className="font-semibold text-gray-900">{calculatedShiftHours}</span></div>
                                <div className="pt-2 border-t mt-2">
                                    <span className="block text-xs text-gray-500 mb-1">Weekly Offs:</span>
                                    <div className="font-medium text-blue-600">{getDayNames(shiftTimings.weeklyOffDays)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
             )}
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${displayStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                      {displayStatus === "LATE" ? "Late" : "On Time"}
                    </span>
                  ) : "--"}
                </td>
                <td className="px-4 py-3 capitalize">
                    {/* Updated Status Logic */}
                    {todayLog?.punchIn ? (
                         <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${workedStatusBadge.color}`}>
                             {workedStatusBadge.label}
                         </span>
                    ) : (
                        <span className="text-gray-500">--</span>
                    )}
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

      {/* Graphs Section - Equal Size */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Attendance Summary Bar Chart */}
        <div className="bg-white rounded-2xl shadow p-6 h-80 flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-4 text-gray-700"><FaCalendarAlt className="text-blue-500" /> Attendance Summary</h2>
          <div className="flex-1 relative">
            <Bar data={leaveBarData} options={commonChartOptions} />
          </div>
        </div>

        {/* Work Hours Meter Chart */}
        <div className="bg-white rounded-2xl shadow p-6 h-80 flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-4 text-gray-700"><FaChartPie className="text-yellow-500" /> Today Progress</h2>
          
          {/* Chart Container */}
          <div className="flex-1 relative flex flex-col items-center justify-center">
            <div className="w-full h-full max-h-40 relative">
                 <Doughnut data={workMeterData} options={meterChartOptions} />
                 
                 {/* Center Text for Meter */}
                 <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
                     <span className="text-2xl font-bold text-gray-700">
                         {Math.floor((workMeterData.rawValues.currentWorked / workMeterData.rawValues.totalShiftSeconds) * 100)}%
                     </span>
                 </div>
            </div>

            {/* Bottom Stats Text */}
            <div className="flex justify-between w-full px-8 mt-4 border-t pt-3">
                <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Worked Hrs</p>
                    <p className="text-lg font-bold text-blue-600">{formatWorkedTime(workMeterData.rawValues.currentWorked)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Total Shift</p>
                    <p className="text-lg font-bold text-gray-400">{formatWorkedTime(workMeterData.rawValues.totalShiftSeconds)}</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {showCropModal && imageToCrop && (
      <ImageCropModal imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => { setShowCropModal(false); setImageToCrop(null); }} isUploading={uploadingImage} />
      )}
    </div>
  );
};

export default EmployeeDashboard;