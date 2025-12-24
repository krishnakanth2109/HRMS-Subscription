// --- START OF FILE EmployeeDashboard.jsx ---

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
// ✅ Ensuring Chart imports are correct
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
  FaLaptopHouse,
  FaBuilding,
  FaInfoCircle,
  FaHistory,
  FaHourglassHalf,
  FaCoffee,
  FaExclamationTriangle,
  FaPaperPlane,
  FaTimes,
  FaPen
} from "react-icons/fa";
import Swal from "sweetalert2"; 

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

// ✅ Registering Chart Components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// IDLE CONFIGURATION
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 Minutes
const WORK_START_HOUR = 0;
const WORK_END_HOUR = 24;

const recordIdleActivityLocally = async (data) => {
  return api.post("/api/attendance/record-idle-activity", data);
};

// Helper: Haversine Formula
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ✅ Helper: Date Formatter (DD/MM/YYYY)
const formatDateDDMMYYYY = (dateString) => {
  if (!dateString) return "--";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB"); // en-GB outputs dd/mm/yyyy
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
  
  // ✅ Office Settings State
  const [officeConfig, setOfficeConfig] = useState(null);

  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  
  // ✅ Break Dropdown State
  const [isBreakDropdownOpen, setIsBreakDropdownOpen] = useState(false);
  
  // ✅ Missed Punch Logic State
  const [missedPunchLog, setMissedPunchLog] = useState(null);
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqData, setReqData] = useState({ date: "", time: "", reason: "" });
  const [reqLoading, setReqLoading] = useState(false);

  // ✅ Late Correction State
  const [showLateReqModal, setShowLateReqModal] = useState(false);
  const [lateReqData, setLateReqData] = useState({ time: "", reason: "" });
  const [lateReqLoading, setLateReqLoading] = useState(false);

  const dropdownRef = useRef(null);
  const breakDropdownRef = useRef(null); 

  const navigate = useNavigate();

  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const [workedTime, setWorkedTime] = useState(0);

  const alarmPlayedRef = useRef(false);

  const todayIso = new Date().toISOString().split("T")[0]; // YYYY-MM-DD for logic

  // IDLE TRACKING REFS
  const isIdleRef = useRef(false);
  const idleStartTimeRef = useRef(null);
  const idleNotifiedRef = useRef(false); 
  const LOCAL_STORAGE_KEY = `lastActive_${user?.employeeId}`;

  // --- Voice Feedback ---
  const speak = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 1.0; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const playShiftCompletedSound = () => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play().catch(e => console.warn("Audio autoplay blocked:", e));
    const message = "Please punch out, your shift is completed. Please punch out, your shift is completed.";
    if ("speechSynthesis" in window) {
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 0.9; 
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }, 500);
    }
  };

  // ✅ UPDATED: Robust Location Fetcher (Retries + Fallback to Low Accuracy)
  const getCurrentLocation = () => {
    const getPosition = (options) => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    return getPosition({
      enableHighAccuracy: true,
      timeout: 15000, 
      maximumAge: 10000, 
    })
      .then((position) => ({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }))
      .catch(async (err) => {
        console.warn("High Accuracy GPS failed, switching to Low Accuracy fallback...", err);
        try {
          const position = await getPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 30000, 
          });
          return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        } catch (fallbackErr) {
          let errorMessage = "Unable to retrieve your location.";
          if (fallbackErr.code === 1) errorMessage = "Location access denied. Please enable location permissions.";
          else if (fallbackErr.code === 2) errorMessage = "Location signal lost. Please move near a window.";
          else if (fallbackErr.code === 3) errorMessage = "Location request timed out. Please try again.";
          
          throw new Error(errorMessage);
        }
      });
  };

  const loadShiftTimings = useCallback(async (empId) => {
    try {
      const shiftData = await getShiftByEmployeeId(empId);
      setShiftTimings(shiftData);
    } catch (err) {
      setShiftTimings({ 
          shiftStartTime: "09:00", 
          shiftEndTime: "18:00", 
          lateGracePeriod: 15, 
          fullDayHours: 9, 
          halfDayHours: 4.5, 
          autoExtendShift: true, 
          weeklyOffDays: [0], 
          isDefault: true 
      });
    }
  }, []);

  const loadAttendance = useCallback(async (empId) => {
      try {
        const data = await getAttendanceForEmployee(empId);
        const attendanceData = Array.isArray(data) ? data : (data.data || []);
        setAttendance(attendanceData);
        const todayStr = new Date().toISOString().split("T")[0];
        const todayEntry = attendanceData.find((d) => d.date === todayStr);
        setTodayLog(todayEntry || null);
      } catch (err) { console.error("Attendance fetch error:", err); }
    }, []
  );

  useEffect(() => {
    if (attendance.length > 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const prevLog = attendance.find(a => a.date === yesterdayStr);
        
        if (prevLog && prevLog.punchIn && !prevLog.punchOut) {
            setMissedPunchLog(prevLog);
            setReqData(prev => ({ ...prev, date: yesterdayStr }));
        } else {
            setMissedPunchLog(null);
        }
    }
  }, [attendance]);

  const loadProfilePic = async () => {
    try {
      const res = await getProfilePic();
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage", res.profilePhoto.url);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const fetchOfficeSettings = async () => {
      try {
        const { data } = await api.get("/api/admin/settings/office");
        setOfficeConfig(data);
      } catch (err) { console.error("Failed to load office settings:", err); }
    };
    fetchOfficeSettings();
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (user && user.employeeId) {
        setLoading(true);
        await Promise.all([loadAttendance(user.employeeId), loadProfilePic(), loadShiftTimings(user.employeeId)]);
        setLoading(false);
      } else { setLoading(false); }
    };
    bootstrap();
  }, [user, loadAttendance, loadShiftTimings]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsShiftDropdownOpen(false);
      }
      if (breakDropdownRef.current && !breakDropdownRef.current.contains(event.target)) {
        setIsBreakDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  const { name, email, phone, employeeId } = user || {};
  const latestExp = user?.experienceDetails?.[user.experienceDetails.length - 1];
  const role = latestExp?.role || user?.role || "N/A";
  const department = latestExp?.department || user?.department || "N/A";

  useEffect(() => {
    let interval;
    const isWorking = todayLog?.status === "WORKING";

    if (isWorking) {
      const updateTimer = () => {
        const now = new Date();
        let totalSeconds = 0;
        
        if (todayLog.sessions && todayLog.sessions.length > 0) {
            todayLog.sessions.forEach(sess => {
                const start = new Date(sess.punchIn);
                const end = sess.punchOut ? new Date(sess.punchOut) : now; 
                totalSeconds += (end - start) / 1000;
            });
        } else if (todayLog.punchIn) {
            const start = new Date(todayLog.punchIn);
            totalSeconds = (now - start) / 1000;
        }

        setWorkedTime(Math.floor(totalSeconds));

        if (shiftTimings) {
            const assignedFullDaySeconds = (shiftTimings.fullDayHours || 9) * 3600;
            
            if (totalSeconds >= assignedFullDaySeconds && !alarmPlayedRef.current) {
                alarmPlayedRef.current = true; 
                playShiftCompletedSound();
                Swal.fire({ title: "Shift Completed!", text: "Your required work hours are done. Please punch out.", icon: "success", confirmButtonText: "OK", confirmButtonColor: "#3b82f6", timer: 10000, timerProgressBar: true });
            }
        }
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
        if (todayLog?.workedHours !== undefined) {
             const storedSec = (todayLog.workedHours * 3600) + (todayLog.workedMinutes * 60) + (todayLog.workedSeconds || 0);
             setWorkedTime(storedSec);
        }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [todayLog, shiftTimings]);

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

  const calculateWorkModeStatus = useCallback(() => {
    const defaults = { 
      mode: officeConfig?.globalWorkMode || 'WFO', 
      description: "Adhering to standard company-wide policy." 
    };

    if (!officeConfig || !user) return defaults;
    const empConfig = officeConfig.employeeWorkModes?.find(e => e.employeeId === user.employeeId);
    if (!empConfig || empConfig.ruleType === "Global") return defaults;

    const today = new Date();
    today.setHours(0,0,0,0);

    if (empConfig.ruleType === "Temporary" && empConfig.temporary) {
      const from = new Date(empConfig.temporary.fromDate);
      const to = new Date(empConfig.temporary.toDate);
      from.setHours(0,0,0,0);
      to.setHours(23,59,59,999);
      if (today >= from && today <= to) return { mode: empConfig.temporary.mode, description: `Temporary schedule active.` };
    }

    if (empConfig.ruleType === "Recurring" && empConfig.recurring) {
      const currentDay = new Date().getDay();
      const daysMap = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
      const modeText = empConfig.recurring.mode === "WFH" ? "Remote" : "Work From Office";
      const sortedDays = [...(empConfig.recurring.days || [])].sort((a,b) => a - b);
      const allDaysStr = sortedDays.map(d => daysMap[d]).join(", ");
      
      if (empConfig.recurring.days.includes(currentDay)) {
        return { mode: empConfig.recurring.mode, description: `Recurring schedule active.` };
      } else {
        return { ...defaults, description: `Recurring schedule exists (${modeText} on ${allDaysStr}), but today follows Global settings.` };
      }
    }
    if (empConfig.ruleType === "Permanent") return { mode: empConfig.permanentMode, description: "Permanently assigned override by administration." };
    return defaults;
  }, [officeConfig, user]);

  const performPunchAction = async (action) => {
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
        const { mode: effectiveMode } = calculateWorkModeStatus();
        if (effectiveMode === "WFO") {
            if (officeConfig && officeConfig.officeLocation && officeConfig.requireAccurateLocation !== false) {
                const distance = getDistanceFromLatLonInMeters(location.latitude, location.longitude, officeConfig.officeLocation.latitude, officeConfig.officeLocation.longitude);
                const allowedRadius = (officeConfig.allowedRadius || 200); 
                
                if (distance > allowedRadius) {
                    setPunchStatus("IDLE");
                    speak("Punch failed. You are not in the office location.");
                    return Swal.fire({ 
                      icon: 'error', 
                      title: 'Location Error', 
                      html: `<b>You must be at the office to punch in.</b><br/><br/>
                             Your Distance: <b>${Math.round(distance)} meters</b><br/>
                             Allowed Radius: <b>${allowedRadius} meters</b><br/><br/>
                             <small style="color:gray">Note: If you are in the office, please open Google Maps to refresh your GPS.</small>`, 
                      confirmButtonColor: '#d33' 
                    });
                }
            }
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, Date.now());
        alarmPlayedRef.current = false; 
        await punchIn({ employeeId: user.employeeId, employeeName: user.name, latitude: location.latitude, longitude: location.longitude });
        speak(`${user.name}, punch in successful`);
        Swal.fire({ icon: 'success', title: 'Welcome!', text: 'Punch in recorded successfully.' });
      } else {
        await punchOut({ employeeId: user.employeeId, latitude: location.latitude, longitude: location.longitude });
        speak(`${user.name}, punch out successful`);
        Swal.fire({ icon: 'success', title: 'Goodbye!', text: 'Punch out recorded successfully.' });
      }
      await loadAttendance(user.employeeId);
    } catch (err) {
      console.error("Punch error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      
      if (msg.includes("Location")) { 
        Swal.fire({ 
          icon: 'warning', 
          title: 'Location Warning', 
          text: msg,
          confirmButtonText: "Try Again"
        });
      } else if (msg.toLowerCase().includes("already punched")) { 
        Swal.fire({ 
          icon: 'info', 
          title: 'Syncing', 
          text: "System syncing: You are already punched in." 
        }); 
        await loadAttendance(user.employeeId);
      } else { 
        speak("Punch operation failed"); 
        Swal.fire({ 
          icon: 'error', 
          title: 'Action Failed', 
          text: `Failed to record attendance: ${msg}` 
        }); 
      }
    } finally { setPunchStatus("IDLE"); }
  };

  const handlePunch = async (action) => {
    if (!user) return;
    if (action === "IN") {
        if (!todayLog) {
            if (missedPunchLog) {
                Swal.fire({ 
                  icon: 'error', 
                  title: 'Punch In Disabled', 
                  text: 'You did not punch out yesterday. Please use the "Request Punch Out" button above to resolve this with Admin.' 
                });
                return; 
            }
        }
        performPunchAction("IN");
    }
    
    if (action === "OUT") {
        const fullDaySeconds = shiftTimings ? (shiftTimings.fullDayHours * 3600) : (9 * 3600);
        const halfDaySeconds = shiftTimings ? (shiftTimings.halfDayHours * 3600) : (4.5 * 3600);
        
        if (workedTime >= fullDaySeconds) { await performPunchAction("OUT"); return; }
        
        let confirmMessage = workedTime < halfDaySeconds 
          ? "“Your worked hours are below the minimum Half-Day limit. If you don't punch in again, today will be marked as ABSENT. Do you want to continue?" 
          : "Your worked hours are below the Full-Day requirement. If you don't punch in again, today will be marked as HALF-DAY. Do you want to continue?";
        
        Swal.fire({ 
            title: "Early Punch Out?", 
            text: confirmMessage, 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33', 
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, punch out!' 
        }).then((result) => { 
          if (result.isConfirmed) { performPunchAction("OUT"); } 
        });
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqData.time || !reqData.reason) {
      Swal.fire("Error", "Please fill all fields", "error");
      return;
    }
    setReqLoading(true);
    try {
      const combinedDateTime = new Date(`${reqData.date}T${reqData.time}`);
      const payload = {
        employeeId: user.employeeId,
        employeeName: user.name,
        originalDate: reqData.date,
        requestedPunchOut: combinedDateTime.toISOString(),
        reason: reqData.reason
      };
      await api.post('/api/punchoutreq/create', payload);
      Swal.fire("Success", "Request sent successfully! Once approved, your record will be updated.", "success");
      setShowReqModal(false);
      setReqData({ ...reqData, time: "", reason: "" });
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      Swal.fire("Error", errMsg, "error");
    } finally {
      setReqLoading(false);
    }
  };

  // ✅ UPDATED HANDLER: Convert Local Time to UTC before sending
  const handleLateRequestSubmit = async (e) => {
    e.preventDefault();
    if (!lateReqData.time || !lateReqData.reason) {
        Swal.fire("Error", "Please enter time and reason", "error");
        return;
    }
    setLateReqLoading(true);
    try {
        // ✅ FIX: Create Date object from local time input
        const localDateTime = new Date(`${todayIso}T${lateReqData.time}`);
        
        // Extract UTC Hours and Minutes
        const utcHours = String(localDateTime.getUTCHours()).padStart(2, '0');
        const utcMinutes = String(localDateTime.getUTCMinutes()).padStart(2, '0');
        
        // Format as HH:mm in UTC
        const utcTimeStr = `${utcHours}:${utcMinutes}`;

        const payload = {
            employeeId: user.employeeId,
            date: todayIso, 
            time: utcTimeStr, // ✅ Sending UTC time to server
            reason: lateReqData.reason
        };
        await api.post('/api/attendance/request-correction', payload);
        Swal.fire("Success", "Request for On-Time login sent to Admin.", "success");
        setShowLateReqModal(false);
        setLateReqData({ time: "", reason: "" });
        await loadAttendance(user.employeeId);
    } catch (error) {
        const errMsg = error.response?.data?.message || error.message;
        Swal.fire("Error", errMsg, "error");
    } finally {
        setLateReqLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { Swal.fire("Error", "File size must be less than 5MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImageToCrop(reader.result); setShowCropModal(true); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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
      if (res?.profilePhoto?.url) { setProfileImage(res.profilePhoto.url); sessionStorage.setItem("profileImage", res.profilePhoto.url); setShowCropModal(false); }
    } catch (err) { Swal.fire("Error", "Failed to upload image.", "error"); } finally { setUploadingImage(false); }
  };

  const handleDeleteProfilePic = async () => {
    Swal.fire({ title: 'Are you sure?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
        if (result.isConfirmed) { await deleteProfilePic(); setProfileImage(null); sessionStorage.removeItem("profileImage"); }
    });
  };

  useEffect(() => {
    if (!user || !user.employeeId || !todayLog?.punchIn || todayLog?.punchOut) return;
    const handleActivity = () => {
      const now = Date.now();
      const lastSaved = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || 0);
      if (now - lastSaved > 1000) { localStorage.setItem(LOCAL_STORAGE_KEY, now); }
      if (isIdleRef.current && idleStartTimeRef.current) {
        const startT = idleStartTimeRef.current; isIdleRef.current = false; idleStartTimeRef.current = null; idleNotifiedRef.current = false;
        recordIdleActivityLocally({ employeeId: user.employeeId, idleEnd: new Date().toISOString(), isIdle: false, idleStart: startT }).then(() => { loadAttendance(user.employeeId); }).catch(err => console.error(err));
      }
    };
    window.addEventListener("mousemove", handleActivity); window.addEventListener("keydown", handleActivity); window.addEventListener("click", handleActivity);
    const intervalId = setInterval(async () => {
      const now = Date.now();
      const hour = new Date().getHours();
      if (hour < WORK_START_HOUR || hour >= WORK_END_HOUR) return;
      const lastActive = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || Date.now());
      if (now - lastActive >= INACTIVITY_LIMIT_MS && !isIdleRef.current) {
        isIdleRef.current = true; idleStartTimeRef.current = new Date().toISOString();
        try { await recordIdleActivityLocally({ employeeId: user.employeeId, idleStart: idleStartTimeRef.current, isIdle: true }); if (!idleNotifiedRef.current) { idleNotifiedRef.current = true; await sendIdleActivity({ employeeId: user.employeeId, name: user.name, department, role, lastActiveAt: new Date(lastActive).toISOString() }); } } catch (e) {}
      }
    }, 1000);
    return () => { window.removeEventListener("mousemove", handleActivity); window.removeEventListener("keydown", handleActivity); window.removeEventListener("click", handleActivity); clearInterval(intervalId); };
  }, [user, department, role, todayLog, loadAttendance, LOCAL_STORAGE_KEY]);

  const formatWorkedTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "0h 0m 0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getPunchButtonContent = (action) => {
    const spinner = <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />;
    if (punchStatus === "FETCHING") return <>{spinner} Extracting...</>;
    if (punchStatus === "PUNCHING") return <>{spinner} {action === "IN" ? "Punching In..." : "Punching Out..."}</>;
    if (action === "IN") return todayLog?.punchIn ? "Resume Work" : "Punch In";
    return "Punch Out";
  };

  const formatTimeDisplay = (timeString) => {
    if (!timeString) return "--";
    try { const [h, m] = timeString.split(':'); const hr = parseInt(h); const ampm = hr >= 12 ? 'PM' : 'AM'; return `${hr % 12 || 12}:${m} ${ampm}`; } catch (error) { return timeString; }
  };

  const getTargetWorkHours = () => {
    if (!shiftTimings) return "9h 0m";
    const hrs = shiftTimings.fullDayHours || 9;
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h}h ${m}m`;
  };

  const getTargetHalfDayHours = () => {
    if (!shiftTimings) return "4h 30m";
    const hrs = shiftTimings.halfDayHours || 4.5;
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h}h ${m}m`;
  };

  const getDayNames = (dayNumbers = []) => { const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; return dayNumbers.map(day => days[day]).join(', ') || 'None'; };

  const getWorkedStatusBadge = () => {
    if (!todayLog?.punchIn) return { label: "--", color: "text-gray-500" };
    if (!todayLog.punchOut) { return { label: "Working...", color: "bg-blue-100 text-blue-800 animate-pulse" }; }
    
    const fullDaySeconds = shiftTimings ? (shiftTimings.fullDayHours * 3600) : (9 * 3600);
    const halfDaySeconds = shiftTimings ? (shiftTimings.halfDayHours * 3600) : (4.5 * 3600);
    const currentWorkedSeconds = workedTime; 

    if (currentWorkedSeconds >= fullDaySeconds) { return { label: "Full Day", color: "bg-green-100 text-green-800" }; } else if (currentWorkedSeconds >= halfDaySeconds) { return { label: "Half Day", color: "bg-yellow-100 text-yellow-800" }; } else { return { label: "Absent", color: "bg-red-100 text-red-800" }; }
  };

  // ✅ HELPER: Display Login Status (Calculated Logic)
  const getDisplayLoginStatus = () => {
      if (!todayLog?.punchIn) return "--";

      let status = todayLog.loginStatus || "ON_TIME";
      
      // ✅ FORCE RECALCULATION: Check if shift timings exist and compare time
      if (shiftTimings) {
           const punchTime = new Date(todayLog.punchIn); 
           const [sHour, sMin] = shiftTimings.shiftStartTime.split(':').map(Number); 
           const shiftTime = new Date(punchTime); 
           shiftTime.setHours(sHour, sMin, 0, 0); 
           
           const grace = shiftTimings.lateGracePeriod || 15;
           shiftTime.setMinutes(shiftTime.getMinutes() + grace);
           
           // If punchTime is AFTER shiftTime (including grace), it is LATE
           if (punchTime > shiftTime) {
               status = "LATE";
           } else {
               status = "ON_TIME";
           }
      }

      const req = todayLog?.lateCorrectionRequest;
      const isPending = req?.hasRequest && req?.status === "PENDING";
      const isRejected = req?.hasRequest && req?.status === "REJECTED";

      return (
          <div className="flex flex-col items-start gap-1">
             <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}> 
                {status} 
             </span>
             {status === "LATE" && isPending && (
                 <span className="text-xs text-orange-600 font-semibold animate-pulse">Request Pending...</span>
             )}
              {status === "LATE" && isRejected && (
                 <span className="text-xs text-red-600 font-semibold">Request Rejected</span>
             )}
             {/* ✅ Added: Request Button inside Table Cell if NO request is pending */}
             {status === "LATE" && !isPending && !isRejected && (
                  <button 
                      onClick={() => setShowLateReqModal(true)} 
                      className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold mt-1"
                  >
                      Request On-Time Login
                  </button>
             )}
          </div>
      );
  };

  // ✅ HELPER: Should show correction button?
  const shouldShowCorrectionButton = () => {
      if (!todayLog?.punchIn) return false;
      let status = "ON_TIME"; // Default safe
      
      // ✅ FORCE RECALCULATION
      if (shiftTimings) {
           const punchTime = new Date(todayLog.punchIn); 
           const [sHour, sMin] = shiftTimings.shiftStartTime.split(':').map(Number); 
           const shiftTime = new Date(punchTime); 
           shiftTime.setHours(sHour, sMin, 0, 0); 
           const grace = shiftTimings.lateGracePeriod || 15;
           shiftTime.setMinutes(shiftTime.getMinutes() + grace);
           
           if (punchTime > shiftTime) status = "LATE";
      }
      
      const req = todayLog?.lateCorrectionRequest;
      const isPending = req?.hasRequest && req?.status === "PENDING";
      
      return status === "LATE" && !isPending;
  };

  // ✅ MEMOIZED CHART DATA
  const workMeterData = useMemo(() => {
    let targetSeconds = 9 * 3600; 
    if (shiftTimings?.fullDayHours) { 
        targetSeconds = shiftTimings.fullDayHours * 3600; 
    }
    
    const currentWorked = Math.max(0, workedTime);
    const remaining = Math.max(0, targetSeconds - currentWorked);
    return { labels: ["Worked", "Pending"], datasets: [ { data: [currentWorked, remaining], backgroundColor: ["#3b82f6", "#e5e7eb"], borderWidth: 0, cutout: "75%", circumference: 180, rotation: -90, }, ], rawValues: { currentWorked, remaining, targetSeconds } };
  }, [workedTime, shiftTimings]);

  const commonChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } } };
  const meterChartOptions = { ...commonChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { const val = context.raw; const h = Math.floor(val / 3600); const m = Math.floor((val % 3600) / 60); return `${context.label}: ${h}h ${m}m`; } } } } };

  const leaveBarData = useMemo(() => ({ labels: ["Full Day", "Half Day", "Absent"], datasets: [{ label: "Days", data: [ attendance.filter((a) => a.workedStatus === "FULL_DAY").length, attendance.filter((a) => a.workedStatus === "HALF_DAY").length, attendance.filter((a) => a.status === "ABSENT" || a.workedStatus === "ABSENT").length, ], backgroundColor: ["#22c55e", "#facc15", "#ef4444"], borderRadius: 6, }], }), [attendance]);

  if (loading) return <div className="p-8 text-center text-lg font-semibold">Loading Dashboard...</div>;
  if (!user) return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data.</div>;

  const displayLoginStatusContent = getDisplayLoginStatus();
  const showCorrectionBtn = shouldShowCorrectionButton();
  const workedStatusBadge = getWorkedStatusBadge();
  const calculatedTargetHours = getTargetWorkHours();
  const { mode: currentWorkMode, description: workModeDesc } = calculateWorkModeStatus();
  
  const targetSeconds = shiftTimings ? (shiftTimings.fullDayHours * 3600) : (9 * 3600);
  const isShiftCompleted = todayLog?.punchOut && (todayLog?.workedStatus === "FULL_DAY" || workedTime >= targetSeconds);
  
  const isShiftReqCompleted = workedTime >= targetSeconds;
  const showPunchInButton = !todayLog || todayLog.status !== "WORKING";

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen relative">
      
      {missedPunchLog && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r shadow-md flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <FaExclamationTriangle className="text-red-500 text-2xl" />
                <div>
                    <h4 className="font-bold text-red-800">Action Required: Missed Punch Out</h4>
                    <p className="text-sm text-red-700">
                        You did not punch out on <b>{formatDateDDMMYYYY(missedPunchLog.date)}</b>. 
                        You cannot Punch In for today until this is resolved.
                    </p>
                </div>
            </div>
            <button 
                onClick={() => setShowReqModal(true)}
                className="bg-red-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-red-700 transition flex items-center gap-2 whitespace-nowrap"
            >
                <FaPaperPlane /> Request Punch Out
            </button>
        </div>
      )}

      {/* Profile Section */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6 relative">
        <div className="relative group">
          <img src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`} alt="Profile" className="w-28 h-28 rounded-full border-4 border-white shadow-md object-cover" />
          <div className="absolute bottom-1 right-1 flex gap-1">
            <label htmlFor="profile-upload" className={`bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 ${uploadingImage ? "opacity-50" : ""}`}> {uploadingImage ? <div className="animate-spin">⏳</div> : profileImage ? <FaEdit size={14} /> : <FaCamera size={14} />} </label>
            {profileImage && ( <button onClick={handleDeleteProfilePic} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"> <FaTrash size={14} /> </button> )}
          </div>
          <input id="profile-upload" type="file" className="hidden" onChange={handleImageSelect} disabled={uploadingImage} />
        </div>
        
        <div className="flex-1 w-full">
          <div className="flex justify-between items-start w-full">
             <div>
                <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><FaUserCircle /> {name}</h3>
                <div className="mt-3 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ${currentWorkMode === 'WFH' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {currentWorkMode === 'WFH' ? <FaLaptopHouse size={16} /> : <FaBuilding size={16} />} {currentWorkMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium italic flex items-center gap-1 ml-1">
                      <FaInfoCircle size={10} /> 
                      {currentWorkMode === 'WFO' && officeConfig?.requireAccurateLocation !== false 
                        ? 'Accurate office location required'
                        : workModeDesc
                      }
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-gray-700 mt-2 text-sm">
                    <div><b>ID:</b> {employeeId}</div> <div><b>Email:</b> {email}</div> <div><b>Department:</b> {department}</div> <div><b>Role:</b> {role}</div>
                </div>
             </div>

             <div className="flex gap-2 items-start flex-wrap justify-end">
                
                {/* ✅ Request Correction Button */}
                {showCorrectionBtn && (
                    <button 
                        onClick={() => setShowLateReqModal(true)} 
                        className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg shadow-sm hover:bg-red-50 transition-all text-sm font-semibold animate-pulse-slow"
                    >
                        <FaPen size={12} /> Request on-time login
                    </button>
                )}

                {todayLog?.sessions?.length > 0 && (
                    <div className="relative" ref={breakDropdownRef}>
                        <button onClick={() => setIsBreakDropdownOpen(!isBreakDropdownOpen)} className="flex items-center gap-2 bg-white text-orange-700 border border-orange-200 px-4 py-2 rounded-lg shadow-sm hover:bg-orange-50 transition-all text-sm font-semibold"> <FaHistory /> Breaks & Sessions <FaChevronDown className={`transform transition-transform ${isBreakDropdownOpen ? 'rotate-180' : ''}`} size={12}/> </button>
                        {isBreakDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 animate-fade-in-down">
                                <h4 className="font-bold text-orange-800 border-b pb-2 mb-3">Today's Sessions</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {todayLog.sessions.map((sess, idx) => (
                                        <div key={idx} className="text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                            <div className="flex justify-between font-semibold text-gray-700 mb-1">
                                                <span>Session {idx + 1}</span>
                                                <span className={sess.punchOut ? "text-green-600" : "text-blue-600 animate-pulse"}>{sess.punchOut ? "Completed" : "Active"}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-500">
                                                <span>In: {new Date(sess.punchIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                <span>Out: {sess.punchOut ? new Date(sess.punchOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "--"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {shiftTimings && (
                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)} className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-50 transition-all text-sm font-semibold"> <FaRegClock /> Shift Details <FaChevronDown className={`transform transition-transform ${isShiftDropdownOpen ? 'rotate-180' : ''}`} size={12}/> </button>
                        {isShiftDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 animate-fade-in-down">
                                <h4 className="font-bold text-blue-800 border-b pb-2 mb-3">Admin Assigned Shift</h4>
                                <div className="space-y-3 text-sm text-gray-700">
                                    <div className="flex justify-between"><span>Start Time:</span> <span className="font-semibold">{formatTimeDisplay(shiftTimings.shiftStartTime)}</span></div>
                                    <div className="flex justify-between"><span>End Time:</span> <span className="font-semibold">{formatTimeDisplay(shiftTimings.shiftEndTime)}</span></div>
                                    
                                    <div className="flex justify-between bg-blue-50 p-1 rounded"><span>Required Work:</span> <span className="font-bold text-blue-700">{calculatedTargetHours}</span></div>
                                    <div className="flex justify-between text-xs text-gray-500"><span>Min Half Day:</span> <span>{getTargetHalfDayHours()}</span></div>
                                    <div className="flex justify-between text-xs text-gray-500"><span>Late Grace:</span> <span>{shiftTimings.lateGracePeriod} mins</span></div>

                                    <div className="pt-2 border-t mt-2"> <span className="block text-xs text-gray-500 mb-1">Weekly Offs:</span> <div className="font-medium text-blue-600">{getDayNames(shiftTimings.weeklyOffDays)}</div> </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
             </div>
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
                <th className="px-4 py-3 text-left">First In</th>
                <th className="px-4 py-3 text-left">Last Out</th>
                <th className="px-4 py-3 text-left">Worked</th>
                <th className="px-4 py-3 text-left">Login Status</th>
                <th className="px-4 py-3 text-left">Worked Status</th>
                <th className="px-4 py-3 text-left">Break Time</th>
                <th className="px-4 py-3 text-left">Idle Time</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="text-gray-700 border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                <td className="px-4 py-3 font-medium">{formatDateDDMMYYYY(todayIso)}</td>
                <td className="px-4 py-3">{todayLog?.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString() : "--"}</td>
                <td className="px-4 py-3">
                    {todayLog?.status === "WORKING" ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">Active</span>
                    ) : (
                        todayLog?.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString() : "--"
                    )}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-blue-600">{todayLog?.punchIn ? formatWorkedTime(workedTime) : "0h 0m 0s"}</td>
                
                {/* ✅ UPDATED Login Status Cell */}
                <td className="px-4 py-3">
                  {displayLoginStatusContent}
                </td>
                
                <td className="px-4 py-3 capitalize"> {todayLog?.punchIn ? ( <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${workedStatusBadge.color}`}> {workedStatusBadge.label} </span> ) : ( <span className="text-gray-500">--</span> )} </td>
                <td className="px-4 py-3 font-mono text-purple-600"> {todayLog?.totalBreakSeconds ? formatWorkedTime(todayLog.totalBreakSeconds) : "0h 0m 0s"} </td>
                <td className="px-4 py-3 font-mono font-bold text-orange-600"> {todayLog?.punchIn ? getTodayIdleTimeStr() : "--"} </td>
                
                <td className="px-4 py-3 text-center">
                  {isShiftCompleted ? (
                      <span className="text-gray-500 font-bold text-xs bg-gray-200 px-3 py-1 rounded-full">Completed</span>
                  ) : showPunchInButton ? ( 
                      <button className={`px-4 py-2 rounded-md mx-auto flex gap-2 shadow-sm text-white ${missedPunchLog ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`} onClick={() => handlePunch("IN")} disabled={punchStatus !== "IDLE"}>{getPunchButtonContent("IN")}</button>
                  ) : ( 
                      isShiftReqCompleted ? (
                        <button className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 disabled:opacity-50 mx-auto flex gap-2 shadow-sm" onClick={() => handlePunch("OUT")} disabled={punchStatus !== "IDLE"}>
                            {punchStatus === "PUNCHING" ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : null}
                            {punchStatus === "PUNCHING" ? "Punching Out..." : "Punch Out"}
                        </button>
                      ) : (
                        <button className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50 mx-auto flex gap-2 shadow-sm" onClick={() => handlePunch("OUT")} disabled={punchStatus !== "IDLE"}>
                            {punchStatus === "PUNCHING" ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FaCoffee />}
                            {punchStatus === "PUNCHING" ? "Starting Break..." : "Break"}
                        </button>
                      )
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-6">
          <div className="flex items-center gap-3">
            {todayLog?.punchInLocation && ( <button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchInLocation.latitude},${todayLog.punchInLocation.longitude}`, "_blank")} className="bg-blue-100 text-blue-800 px-3 py-1.5 text-xs rounded-full hover:bg-blue-200 flex gap-1"><FaMapMarkerAlt /> In Location</button> )}
            {todayLog?.punchOutLocation && ( <button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchOutLocation.latitude},${todayLog.punchOutLocation.longitude}`, "_blank")} className="bg-red-100 text-red-800 px-3 py-1.5 text-xs rounded-full hover:bg-red-200 flex gap-1"><FaMapMarkerAlt /> Out Location</button> )}
          </div>
          <button onClick={() => navigate("/employee/my-attendence")} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">View Attendance History →</button>
        </div>
      </div>

      {/* ✅ GRAPHS SECTION (Restored) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow p-6 h-80 flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-4 text-gray-700"><FaCalendarAlt className="text-blue-500" /> Attendance Summary</h2>
          <div className="flex-1 relative"> <Bar data={leaveBarData} options={commonChartOptions} /> </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-6 h-80 flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-4 text-gray-700"><FaChartPie className="text-yellow-500" /> Today Progress</h2>
          <div className="flex-1 relative flex flex-col items-center justify-center">
            <div className="w-full h-full max-h-40 relative">
                 <Doughnut data={workMeterData} options={meterChartOptions} />
                 <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none"> <span className="text-2xl font-bold text-gray-700"> {Math.floor((workMeterData.rawValues.currentWorked / workMeterData.rawValues.targetSeconds) * 100)}% </span> </div>
            </div>
            <div className="flex justify-between w-full px-8 mt-4 border-t pt-3">
                <div className="text-center"> <p className="text-xs text-gray-500 uppercase font-semibold">Worked Hrs</p> <p className="text-lg font-bold text-blue-600">{formatWorkedTime(workMeterData.rawValues.currentWorked)}</p> </div>
                <div className="text-center"> <p className="text-xs text-gray-500 uppercase font-semibold">Target Work</p> <p className="text-lg font-bold text-gray-400">{formatWorkedTime(workMeterData.rawValues.targetSeconds)}</p> </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MODAL: Missed Punch Yesterday Request */}
      {showReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
                  <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaPaperPlane /> Request Punch Out</h3>
                      <button onClick={() => setShowReqModal(false)} className="text-white hover:bg-blue-700 p-1 rounded"><FaTimes /></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4 bg-yellow-50 border border-yellow-200 p-2 rounded">
                          You missed punching out on <b>{formatDateDDMMYYYY(reqData.date)}</b>. Please provide the actual time you left work.
                      </p>
                      <form onSubmit={handleRequestSubmit} className="space-y-4">
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Missed Date</label>
                              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-100">
                                  <FaCalendarAlt className="text-gray-400 mr-2"/>
                                  <input type="text" value={formatDateDDMMYYYY(reqData.date)} disabled className="bg-transparent outline-none w-full text-gray-500 cursor-not-allowed" />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Actual Out Time</label>
                              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 ring-blue-200 transition">
                                  <FaRegClock className="text-gray-400 mr-2"/>
                                  <input 
                                      type="time" 
                                      value={reqData.time} 
                                      onChange={(e) => setReqData({...reqData, time: e.target.value})} 
                                      className="bg-transparent outline-none w-full text-gray-700" 
                                      required 
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
                              <textarea 
                                  value={reqData.reason} 
                                  onChange={(e) => setReqData({...reqData, reason: e.target.value})} 
                                  placeholder="e.g. Forgot to punch out, Network issue..." 
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-200 h-24 resize-none transition" 
                                  required 
                              />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                              <button type="button" onClick={() => setShowReqModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                              <button type="submit" disabled={reqLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2">
                                  {reqLoading ? "Sending..." : "Submit Request"}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* ✅ NEW MODAL: Late Login Correction Request (Today) */}
      {showLateReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
                  <div className="bg-orange-600 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaRegClock /> Request On-Time Login</h3>
                      <button onClick={() => setShowLateReqModal(false)} className="text-white hover:bg-orange-700 p-1 rounded"><FaTimes /></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4 bg-orange-50 border border-orange-200 p-2 rounded">
                          You are marked as <b>LATE</b>. If you arrived on time but missed punching in, or If you have a valid reason for the delay, Raise a correction request.
                      </p>
                      <form onSubmit={handleLateRequestSubmit} className="space-y-4">
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Today's Date</label>
                              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-100">
                                  <FaCalendarAlt className="text-gray-400 mr-2"/>
                                  <input type="text" value={formatDateDDMMYYYY(todayIso)} disabled className="bg-transparent outline-none w-full text-gray-500 cursor-not-allowed" />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Actual Arrival Time</label>
                              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 ring-orange-200 transition">
                                  <FaRegClock className="text-gray-400 mr-2"/>
                                  <input 
                                      type="time" 
                                      value={lateReqData.time} 
                                      onChange={(e) => setLateReqData({...lateReqData, time: e.target.value})} 
                                      className="bg-transparent outline-none w-full text-gray-700" 
                                      required 
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
                              <textarea 
                                  value={lateReqData.reason} 
                                  onChange={(e) => setLateReqData({...lateReqData, reason: e.target.value})} 
                                  placeholder="Reason for late login..." 
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-orange-200 h-24 resize-none transition" 
                                  required 
                              />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                              <button type="button" onClick={() => setShowLateReqModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                              <button type="submit" disabled={lateReqLoading} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2">
                                  {lateReqLoading ? "Sending..." : "Submit Request"}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {showCropModal && imageToCrop && ( <ImageCropModal imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => { setShowCropModal(false); setImageToCrop(null); }} isUploading={uploadingImage} /> )}
    </div>
  );
};

export default EmployeeDashboard;
// --- END OF FILE EmployeeDashboard.jsx ---