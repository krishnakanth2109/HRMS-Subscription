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
import { NotificationContext } from "../context/NotificationContext";
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
  FaCoffee,
  FaExclamationTriangle,
  FaPaperPlane,
  FaTimes,
  FaPen,
  FaBirthdayCake,
  FaUmbrellaBeach,
  FaAngleRight,
  FaLuggageCart,
  FaClock,
  FaBullhorn,
  FaSignInAlt,
  FaSignOutAlt,
  FaPlay,
  FaExternalLinkAlt,
} from "react-icons/fa";
import Swal from "sweetalert2";

import api, {
  getAttendanceForEmployee,
  punchIn,
  punchOut,
  uploadProfilePic,
  getProfilePic,
  deleteProfilePic,
  getShiftByEmployeeId,
  getHolidays,
  getLeaveRequestsForEmployee,
  getEmployeeById,
} from "../api";
import { useNavigate, Link } from "react-router-dom";
import ImageCropModal from "./ImageCropModal";
import EmployeeQRCodeModal from "../components/employee/EmployeeQRCodeModal";

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
  return date.toLocaleDateString("en-GB");
};

// ✅ Helper: Format Date for Comparison (YYYY-MM-DD) - Local Time
const toISODateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EmployeeDashboard = () => {
  const { user } = useContext(AuthContext);
  const { notices } = useContext(NoticeContext);
  const { socket } = useContext(NotificationContext);

  // ✅ OPTIMIZATION: Split loading state
  const [loading, setLoading] = useState(true);
  const [loadingTeamData, setLoadingTeamData] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);

  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [profileImage, setProfileImage] = useState(
    sessionStorage.getItem("profileImage") || null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [punchStatus, setPunchStatus] = useState("IDLE");
  const [shiftTimings, setShiftTimings] = useState(null);
  const [mobileAccessEnabled, setMobileAccessEnabled] = useState(true);

  // ✅ Office Settings State
  const [officeConfig, setOfficeConfig] = useState(null);

  // ✅ NEW: Today's Birthdays and On Leave Today States
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [showBirthdayBanner, setShowBirthdayBanner] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return sessionStorage.getItem(`birthdayBannerClosed_${today}`) !== "true";
  });
  const [onLeaveToday, setOnLeaveToday] = useState([]);

  // ✅ NEW: Remote Workers & Leave Balance States
  const [remoteWorkers, setRemoteWorkers] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({ available: 1, taken: 0 });
  const [showAllRemoteEmp, setShowAllRemoteEmp] = useState(false);

  // ✅ NEW: Full Holidays and Leaves for Graph Accuracy
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // ✅ NEW: Real-time Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ Socket Listener for Real-time Attendance Updates
  useEffect(() => {
    if (socket && user?.employeeId) {
      const handleUpdate = (data) => {
        console.log("Real-time attendance update received:", data);
        // Refresh attendance data
        loadAttendance(user.employeeId);

        if (data?.type === "FORCE_PUNCH_OUT") {
          Swal.fire({
            title: "Admin Action",
            text: data.message || "An administrator has punched you out.",
            icon: "info",
            confirmButtonColor: "#3085d6"
          });
        }
      };

      socket.on("attendance:correctionUpdate", handleUpdate);
      socket.on("fullDay:statusUpdate", handleUpdate);
      return () => {
        socket.off("attendance:correctionUpdate", handleUpdate);
        socket.off("fullDay:statusUpdate", handleUpdate);
      };
    }
  }, [socket, user?.employeeId]);

  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [isBreakDropdownOpen, setIsBreakDropdownOpen] = useState(false);

  // ✅ Missed Punch Logic State
  const [missedPunchLog, setMissedPunchLog] = useState(null);
  const [missedPunchRequestStatus, setMissedPunchRequestStatus] = useState(null);
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqData, setReqData] = useState({ date: "", time: "", reason: "" });
  const [reqLoading, setReqLoading] = useState(false);

  // ✅ Late Correction State
  const [showLateReqModal, setShowLateReqModal] = useState(false);
  const [lateReqData, setLateReqData] = useState({ time: "", reason: "" });
  const [lateReqLoading, setLateReqLoading] = useState(false);

  // ✅ NEW: Request Limit State
  const [requestLimit, setRequestLimit] = useState({ limit: 5, used: 0 });

  const dropdownRef = useRef(null);
  const breakDropdownRef = useRef(null);
  const navigate = useNavigate();

  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [workedTime, setWorkedTime] = useState(0);
  // ✅ FIX: Fresh employee data fetched from API on every mount so edits from EditEmployee reflect immediately
  const [employeeData, setEmployeeData] = useState(null);
  // ✅ NEW: Live break time counter (seconds)
  const [breakTime, setBreakTime] = useState(0);
  const alarmPlayedRef = useRef(false);

  const todayIso = new Date().toISOString().split("T")[0];

  // ✅ NEW: Break state toggle
  const [isOnBreak, setIsOnBreak] = useState(false);

  useEffect(() => {
    const fetchMobileAccess = async () => {
      try {
        const { data } = await api.get("/api/admin/mobile-access");
        setMobileAccessEnabled(data.mobileAccessEnabled !== false);
      } catch {
        setMobileAccessEnabled(true);
      }
    };

    fetchMobileAccess();
  }, []);

  // ✅ Sync isOnBreak with todayLog
  useEffect(() => {
    setIsOnBreak(todayLog?.isOnBreak || false);
  }, [todayLog]);

  // ✅ Helper for visibility
  const isPunchedIn = !!todayLog?.punchIn;

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

  // ✅ UPDATED: Robust Location Fetcher
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

  // ✅ NEW: Real-time Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ OPTIMIZED: Fetch all team data
  const fetchOptimizedTeamData = async () => {
    setLoadingTeamData(true);
    try {
      const [
        employeesRes,
        leavesRes,
        officeConfigRes,
        employeeModesRes,
        myLeavesRes
      ] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/leaves"),
        api.get("/api/admin/settings/office"),
        api.get("/api/admin/settings/employees-modes"),
        api.get("/api/leaves", { params: { employeeId: user.employeeId } })
      ]);

      // ✅ FIX: Filter active employees immediately so they don't show in birthdays
      const allEmployeesRaw = employeesRes.data || [];
      const allEmployees = allEmployeesRaw.filter(emp => emp.isActive !== false);

      const allLeaves = leavesRes.data || [];
      const configData = officeConfigRes.data;
      setOfficeConfig(configData);

      const empModes = employeeModesRes.data?.employees || [];
      const myLeavesRaw = myLeavesRes.data;
      const myLeaves = Array.isArray(myLeavesRaw) ? myLeavesRaw : (myLeavesRaw?.leaves || []);

      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDate = today.getDate();

      // --- LOGIC 1: BIRTHDAYS (Active Only) ---
      const birthdays = allEmployees.filter(emp => {
        if (!emp.personalDetails?.dob) return false;
        const dob = new Date(emp.personalDetails.dob);
        return (dob.getMonth() + 1) === todayMonth && dob.getDate() === todayDate;
      }).map(emp => ({
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department || emp.experienceDetails?.[0]?.department || "N/A",
      }));
      setTodaysBirthdays(birthdays);

      // --- LOGIC 2: ON LEAVE TODAY (Active Only) ---
      const employeeMap = new Map();
      allEmployees.forEach(emp => {
        employeeMap.set(emp.employeeId, {
          name: emp.name,
          employeeId: emp.employeeId,
          department: emp.department || "N/A",
        });
      });

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayLeaves = allLeaves.filter(leave => {
        if (leave.status !== 'Approved') return false;
        if (!employeeMap.has(leave.employeeId)) return false;
        const fromDate = new Date(leave.from);
        const toDate = new Date(leave.to);
        fromDate.setHours(0, 0, 0, 0); toDate.setHours(23, 59, 59, 999);
        return todayStart >= fromDate && todayStart <= toDate;
      });

      const onLeave = todayLeaves.map(leave => {
        const empDetails = employeeMap.get(leave.employeeId);
        return { ...empDetails, leaveType: leave.leaveType || "Casual" };
      });
      setOnLeaveToday(Array.from(new Map(onLeave.map(item => [item.employeeId, item])).values()));

      // --- LOGIC 3: REMOTE WORKERS ---
      const currentGlobalMode = configData.globalWorkMode || 'WFO';
      let remoteList = [];
      empModes.forEach(emp => {
        const basicInfo = employeeMap.get(emp.employeeId);
        if (!basicInfo) return;
        let mode = currentGlobalMode;
        if (emp.ruleType === "Permanent") mode = emp.config.permanentMode;
        if (mode === 'WFH') remoteList.push(basicInfo);
      });
      setRemoteWorkers(remoteList);

      // Leave Balance Logic
      let totalDaysTaken = 0;
      myLeaves.forEach(leave => {
        if (leave.status === 'Approved') {
          const lFrom = new Date(leave.from);
          if (lFrom >= new Date(today.getFullYear(), today.getMonth(), 1)) {
            const diffDays = Math.ceil(Math.abs(new Date(leave.to) - lFrom) / 86400000) + 1;
            totalDaysTaken += (leave.halfDaySession && leave.from === leave.to) ? 0.5 : diffDays;
          }
        }
      });
      setLeaveBalance({ available: totalDaysTaken > 0 ? 0 : 1, taken: totalDaysTaken, extra: Math.max(0, totalDaysTaken - 1) });

    } catch (error) {
      console.error("Error fetching background data:", error);
    } finally {
      setLoadingTeamData(false);
    }
  };

  // ✅ NEW: Load monthly request limit from backend
  const loadRequestLimit = useCallback(async (empId) => {
    try {
      const { data } = await api.get(`/api/attendance/request-limit/${empId}`);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthData = data.monthlyRequestLimits?.[currentMonth] || { limit: 5, used: 0 };
      setRequestLimit(monthData);
    } catch (err) {
      console.error("Failed to load request limit", err);
      setRequestLimit({ limit: 5, used: 0 });
    }
  }, []);

  const loadHolidaysAndLeaves = useCallback(async (empId) => {
    try {
      const [hRes, lRes] = await Promise.all([
        getHolidays().catch(e => []),
        getLeaveRequestsForEmployee(empId).catch(e => [])
      ]);
      setHolidays(Array.isArray(hRes) ? hRes : (hRes.data || []));
      setLeaves(Array.isArray(lRes) ? lRes : (lRes.data || []));
    } catch (e) {
      console.error("Failed to load holidays/leaves", e);
    }
  }, []);

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
  }, []);

  // ✅ UPDATED: Fetch request status from backend
  useEffect(() => {
    if (attendance.length > 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const prevLog = attendance.find(a => a.date === yesterdayStr);

      if (prevLog && prevLog.punchIn && !prevLog.punchOut) {
        setReqData(prev => ({ ...prev, date: yesterdayStr }));

        // Fetch status dynamically from backend
        const fetchStatus = async () => {
          try {
            const { data } = await api.get("/api/punchoutreq/status", {
              params: { employeeId: user.employeeId, date: yesterdayStr }
            });
            if (data.found) {
              setMissedPunchRequestStatus(data.status);
              // ✅ FIX: If approved, reload attendance so punchOut gets populated
              // and missedPunchLog clears automatically on next cycle
              if (data.status === "Approved") {
                await loadAttendance(user.employeeId);
                return; // attendance reload will re-trigger this effect and clear missedPunchLog
              }
            } else {
              setMissedPunchRequestStatus(null);
            }
          } catch (error) {
            console.error("Failed to check request status:", error);
          }
          // Only set missedPunchLog if status is NOT Approved
          setMissedPunchLog(prevLog);
        };
        fetchStatus();

      } else {
        setMissedPunchLog(null);
        setMissedPunchRequestStatus(null);
      }
    }
  }, [attendance, user.employeeId]);

  // ✅ OPTIMIZED BOOTSTRAP: Critical first, background second
  useEffect(() => {
    const bootstrap = async () => {
      if (user && user.employeeId) {
        setLoading(true);
        await Promise.all([
          loadAttendance(user.employeeId),
          loadShiftTimings(user.employeeId),
          loadProfilePic(),
          loadRequestLimit(user.employeeId),
          // ✅ FIX: Fetch fresh employee data from DB so edits from EditEmployee are reflected immediately
          getEmployeeById(user.employeeId)
            .then((freshData) => { if (freshData) setEmployeeData(freshData); })
            .catch(() => { }),
        ]);
        setLoading(false);

        fetchOptimizedTeamData();
        loadHolidaysAndLeaves(user.employeeId);
      } else {
        setLoading(false);
      }
    };
    bootstrap();
  }, [user, loadAttendance, loadShiftTimings, loadHolidaysAndLeaves, loadRequestLimit]);

  const loadProfilePic = async () => {
    try {
      const res = await getProfilePic();
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage", res.profilePhoto.url);
      }
    } catch (err) { }
  };

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

  // ✅ FIX: Use freshly fetched employeeData so edits from EditEmployee are visible immediately.
  // Falls back to AuthContext user if fetch hasn't completed yet.
  const displayUser = employeeData || user;
  const { name, email, phone, employeeId } = displayUser || {};
  const latestExp = displayUser?.experienceDetails?.[displayUser.experienceDetails.length - 1];
  const role = latestExp?.role || displayUser?.currentRole || displayUser?.role || "N/A";
  const department = latestExp?.department || displayUser?.currentDepartment || displayUser?.department || "N/A";

  // ✅ EMAIL CHANGE NOTIFICATION
  useEffect(() => {
    if (displayUser?.previousEmail && !loading) {
      Swal.fire({
        title: 'Account Update Notice',
        html: `Your registered email has been updated by an administrator.<br/><br/>
               <b>Old Email:</b> ${displayUser.previousEmail}<br/>
               <b>New Email:</b> ${displayUser.email}<br/><br/>
               Please use the new email for future logins.`,
        icon: 'info',
        confirmButtonText: 'I understand',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.patch(`/api/employees/${displayUser.employeeId}/clear-old-email`);
            if (employeeData) {
              setEmployeeData({ ...employeeData, previousEmail: null });
            }
          } catch (err) {
            console.error("Failed to clear previous email notification:", err);
          }
        }
      });
    }
  }, [displayUser, loading, employeeData]);

  useEffect(() => {
    let interval;
    const isWorking = todayLog?.status === "WORKING" && !todayLog?.isOnBreak;

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

  // ✅ NEW: Live break time counter
  // When isOnBreak=true: ticks from open breakSession.from + already accumulated totalBreakSeconds
  // When not on break: shows static totalBreakSeconds
  useEffect(() => {
    let interval;
    const isOnBreak = todayLog?.isOnBreak === true;

    // ✅ Logic: Stop counting break if shift is completed (by admin or punch-out)
    const isCompleted =
      todayLog?.isFinalPunchOut === true ||
      todayLog?.adminPunchOut === true;

    if (isOnBreak && !isCompleted) {
      const updateBreakTimer = () => {
        const now = new Date();
        const alreadyDone = todayLog.totalBreakSeconds || 0;
        const breakSessions = todayLog.breakSessions || [];
        const openBreak = [...breakSessions].reverse().find(b => !b.to);
        let currentBreakSeconds = 0;
        if (openBreak && openBreak.from) {
          currentBreakSeconds = (now - new Date(openBreak.from)) / 1000;
        }
        setBreakTime(Math.floor(alreadyDone + currentBreakSeconds));
      };
      updateBreakTimer();
      interval = setInterval(updateBreakTimer, 1000);
    } else {
      setBreakTime(Math.floor(todayLog?.totalBreakSeconds || 0));
    }

    return () => { if (interval) clearInterval(interval); };
  }, [todayLog]);

  const calculateWorkModeStatus = useCallback(() => {
    const defaults = {
      mode: officeConfig?.globalWorkMode || 'WFO',
      description: "Adhering to standard company-wide policy."
    };

    if (!officeConfig || !user) return defaults;
    const empConfig = officeConfig.employeeWorkModes?.find(e => e.employeeId === user.employeeId);
    if (!empConfig || empConfig.ruleType === "Global") return defaults;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (empConfig.ruleType === "Temporary" && empConfig.temporary) {
      const from = new Date(empConfig.temporary.fromDate);
      const to = new Date(empConfig.temporary.toDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      if (today >= from && today <= to) return { mode: empConfig.temporary.mode, description: `Temporary schedule active.` };
    }

    if (empConfig.ruleType === "Recurring" && empConfig.recurring) {
      const currentDay = new Date().getDay();
      const daysMap = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
      const modeText = empConfig.recurring.mode === "WFH" ? "Remote" : "Work From Office";
      const sortedDays = [...(empConfig.recurring.days || [])].sort((a, b) => a - b);
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
        alarmPlayedRef.current = false;
        await punchIn({ employeeId: user.employeeId, employeeName: user.name, latitude: location.latitude, longitude: location.longitude });
        speak(`${user.name}, punch in successful`);
        Swal.fire({ icon: 'success', title: 'Welcome!', text: 'Punch in recorded successfully.' });

      } else if (action === "BREAK") {
        // ✅ NEW: Break action — pauses session without final punch-out
        await api.post('/api/attendance/punch-break', {
          employeeId: user.employeeId,
          latitude: location.latitude,
          longitude: location.longitude
        });
        speak(`${user.name}, break started`);
        Swal.fire({ icon: 'info', title: 'Break Started! ☕', text: 'Your session is paused. Click Punch In to resume work.' });

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
        if (missedPunchLog && missedPunchRequestStatus !== "Approved") {
          Swal.fire({
            icon: 'error',
            title: 'Punch In Disabled',
            text: missedPunchRequestStatus === "Pending"
              ? 'Your punch-out request is pending admin approval. You can punch in once it is approved.'
              : 'You did not punch out yesterday. Please use the "Request Punch Out" button above to resolve this with Admin.'
          });
          return;
        }
      }

      // ✅ WEEK OFF GUARD — check if today is assigned week off
      const todayDayNum = new Date().getDay(); // 0=Sunday … 6=Saturday
      const weeklyOffDays = shiftTimings?.weeklyOffDays ?? [0];
      const isTodayWeekOff = Array.isArray(weeklyOffDays) && weeklyOffDays.includes(todayDayNum);

      if (isTodayWeekOff) {
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const { data: otList } = await api.get(`/api/overtime/${user.employeeId}`);
          const approvedOT = Array.isArray(otList)
            ? otList.find(ot => ot.date === todayStr && ot.status === "APPROVED")
            : null;

          if (!approvedOT) {
            // No approved OT — block and show informative alert
            Swal.fire({
              icon: "warning",
              title: "🗓️ Today is Your Week Off!",
              html: `
                <p style="font-size:15px; color:#374151; margin-bottom:12px">
                  Punch-in is <b>not allowed</b> on your assigned week off.
                </p>
                <div style="background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:12px; text-align:left; font-size:13px; color:#92400e; line-height:1.8">
                  <b>Want to work today? Follow these steps:</b><br/>
                  1️⃣ Apply for <b>Overtime</b> from Quick Actions or the Overtime page<br/>
                  2️⃣ Contact your <b>Admin</b> to approve the overtime request<br/>
                  3️⃣ Once <b>Approved</b>, come back here to punch in
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: "Apply Overtime →",
              cancelButtonText: "Close",
              confirmButtonColor: "#4f46e5",
              cancelButtonColor: "#6b7280",
            }).then((result) => {
              if (result.isConfirmed) {
                navigate("/employee/empovertime");
              }
            });
            return; // ❌ Block punch-in
          }
          // ✅ Approved OT found — fall through to performPunchAction below
        } catch (err) {
          console.error("Week-off OT check failed:", err);
          // If check fails, let backend decide — don't silently allow
          Swal.fire({
            icon: "error",
            title: "Check Failed",
            text: "Could not verify your overtime status. Please try again.",
          });
          return;
        }
      }
      // ✅ Either not a week off, or approved OT exists — proceed to punch in
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

  // ✅ NEW: Toggling Break handler
  const handleBreak = async () => {
    if (!user) return;

    if (isOnBreak) {
      // Resume Work
      handlePunch("IN");
    } else {
      // Take a Break
      Swal.fire({
        title: "Take a Break?",
        text: "Your work session will be paused. You can Click 'Continue Work' to resume.",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, take a break!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          performPunchAction("BREAK");
        }
      });
    }
  };

  // ✅ UPDATED: Request submit validation with state update
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqData.time || !reqData.reason) {
      Swal.fire("Error", "Please fill all fields", "error");
      return;
    }

    if (missedPunchLog?.punchIn) {
      const punchInDate = new Date(missedPunchLog.punchIn);
      const requestedDate = new Date(`${reqData.date}T${reqData.time}`);

      if (requestedDate <= punchInDate) {
        Swal.fire({
          icon: "error",
          title: "Invalid Time",
          text: `Requested punch-out time must be after your actual punch-in time (${punchInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
          confirmButtonColor: "#3b82f6"
        });
        return;
      }
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

      // Update state to Pending instantly
      setMissedPunchRequestStatus("Pending");

      setShowReqModal(false);
      setReqData({ ...reqData, time: "", reason: "" });
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      Swal.fire("Error", errMsg, "error");
    } finally {
      setReqLoading(false);
    }
  };

  // ✅ UPDATED: Late correction uses /submit-late-correction endpoint + checks limit
  const handleLateRequestSubmit = async (e) => {
    e.preventDefault();

    if (requestLimit.limit - requestLimit.used <= 0) {
      Swal.fire({
        title: "Limit Reached",
        text: `You have used all ${requestLimit.limit} late correction requests for this month.`,
        icon: "warning",
        confirmButtonColor: "#d33"
      });
      return;
    }

    setLateReqLoading(true);

    try {
      const { time, reason } = lateReqData;
      const todayDate = new Date().toISOString().split("T")[0];
      const requestedDateTime = new Date(`${todayDate}T${time}:00`);

      await api.post("/api/attendance/submit-late-correction", {
        employeeId: user.employeeId,
        date: todayDate,
        requestedTime: requestedDateTime.toISOString(),
        reason,
      });

      await loadRequestLimit(user.employeeId);

      Swal.fire({
        title: "Request Submitted!",
        html: `Your late correction request has been sent to admin for approval.<br/>
               <small class="text-gray-500">Remaining requests: ${requestLimit.limit - requestLimit.used - 1}</small>`,
        icon: "success",
        confirmButtonColor: "#10b981"
      });

      setShowLateReqModal(false);
      setLateReqData({ time: "", reason: "" });

      await loadAttendance(user.employeeId);

    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;

      if (err.response?.data?.limitReached) {
        await loadRequestLimit(user.employeeId);
      }

      Swal.fire({
        title: "Submission Failed",
        text: errorMsg,
        icon: "error",
        confirmButtonColor: "#d33"
      });
    } finally {
      setLateReqLoading(false);
    }
  };

  // ✅ NEW: Open late modal — guard with remaining request check
  const handleOpenLateRequestModal = () => {
    const remaining = requestLimit.limit - requestLimit.used;

    if (remaining <= 0) {
      Swal.fire({
        title: "Limit Reached",
        text: `You have used all ${requestLimit.limit} late correction requests for this month. Please contact admin for further assistance.`,
        icon: "warning",
        confirmButtonColor: "#d33"
      });
      return;
    }

    setShowLateReqModal(true);
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

  const formatWorkedTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "0h 0m 0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // ✅ UPDATED: "Resume Work" detection uses isFinalPunchOut flag from model
  const getPunchButtonContent = (action) => {
    const spinner = <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />;
    if (punchStatus === "FETCHING") return <>{spinner} Extracting...</>;
    if (punchStatus === "PUNCHING") return <>{spinner} {action === "IN" ? "Punching In..." : "Punching Out..."}</>;
    if (action === "IN") {
      // ✅ Show "Resume Work" when employee is on break (has sessions but not actively working)
      const isOnBreak = todayLog?.punchIn &&
        todayLog?.status !== "WORKING" &&
        todayLog?.isFinalPunchOut !== true &&
        todayLog?.adminPunchOut !== true &&
        todayLog?.workedStatus !== "FULL_DAY" &&
        (todayLog?.sessions || []).length > 0;
      return isOnBreak ? "Resume Work" : "Punch In";
    }
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

    // ✅ NEW: Show ON_BREAK when employee is currently on break
    if (todayLog?.isOnBreak === true) {
      return { label: "On Break", color: "bg-amber-100 text-amber-800 animate-pulse border border-amber-200" };
    }

    if (!todayLog.punchOut) { return { label: "Working...", color: "bg-blue-100 text-blue-700 animate-pulse border border-blue-200" }; }

    const fullDaySeconds = shiftTimings ? (shiftTimings.fullDayHours * 3600) : (9 * 3600);
    const halfDaySeconds = shiftTimings ? (shiftTimings.halfDayHours * 3600) : (4.5 * 3600);
    const currentWorkedSeconds = workedTime;

    if (currentWorkedSeconds >= fullDaySeconds) { return { label: "Full Day", color: "bg-green-100 text-green-800 border border-green-200" }; } else if (currentWorkedSeconds >= halfDaySeconds) { return { label: "Half Day", color: "bg-yellow-100 text-yellow-800 border border-yellow-200" }; } else { return { label: "Absent", color: "bg-red-100 text-red-800 border border-red-200" }; }
  };

  const getDisplayLoginStatus = () => {
    if (!todayLog?.punchIn) return "--";

    let status = todayLog.loginStatus || "ON_TIME";

    if (shiftTimings) {
      const punchTime = new Date(todayLog.punchIn);
      const [sHour, sMin] = shiftTimings.shiftStartTime.split(':').map(Number);
      const shiftTime = new Date(punchTime);
      shiftTime.setHours(sHour, sMin, 0, 0);

      const grace = shiftTimings.lateGracePeriod || 15;
      shiftTime.setMinutes(shiftTime.getMinutes() + grace);

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
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm border ${status === "LATE" ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}>
          {status}
        </span>
        {status === "LATE" && isPending && (
          <span className="text-[10px] text-orange-600 font-semibold animate-pulse mt-0.5">Request Pending...</span>
        )}
        {status === "LATE" && isRejected && (
          <span className="text-[10px] text-red-600 font-semibold mt-0.5">Request Rejected</span>
        )}
        {status === "LATE" && !isPending && !isRejected && (
          <button
            onClick={handleOpenLateRequestModal}
            className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold mt-1"
          >
            Request On-Time Login ({requestLimit.limit - requestLimit.used} left)
          </button>
        )}
      </div>
    );
  };

  const shouldShowCorrectionButton = () => {
    if (!todayLog?.punchIn) return false;
    let status = "ON_TIME";

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

  const workMeterData = useMemo(() => {
    let targetSeconds = 9 * 3600;
    if (shiftTimings?.fullDayHours) {
      targetSeconds = shiftTimings.fullDayHours * 3600;
    }

    const currentWorked = Math.max(0, workedTime);
    const remaining = Math.max(0, targetSeconds - currentWorked);
    return { labels: ["Worked", "Pending"], datasets: [{ data: [currentWorked, remaining], backgroundColor: ["#3b82f6", "#e5e7eb"], borderWidth: 0, cutout: "75%", circumference: 180, rotation: -90, },], rawValues: { currentWorked, remaining, targetSeconds } };
  }, [workedTime, shiftTimings]);

  const commonChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } } };
  const meterChartOptions = { ...commonChartOptions, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (context) { const val = context.raw; const h = Math.floor(val / 3600); const m = Math.floor((val % 3600) / 60); return `${context.label}: ${h}h ${m}m`; } } } } };

  const leaveBarData = useMemo(() => {
    const adminFullDayHours = shiftTimings?.fullDayHours || 9;
    const adminHalfDayHours = shiftTimings?.halfDayHours || 4.5;
    const weeklyOffDays = shiftTimings?.weeklyOffDays || [0];

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const currentDayDate = today.getDate();

    let fullDayCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;

    for (let day = 1; day <= currentDayDate; day++) {
      const checkDate = new Date(currentYear, currentMonth, day);
      const checkDateISO = toISODateString(checkDate);
      const isToday = (day === currentDayDate);
      const dayOfWeek = checkDate.getDay();

      const record = attendance.find((a) => a.date === checkDateISO);

      const isHoliday = holidays.some(h => {
        const start = new Date(h.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(h.endDate || h.startDate); end.setHours(23, 59, 59, 999);
        const check = new Date(currentYear, currentMonth, day);
        return check >= start && check <= end;
      });

      const isLeave = leaves.some(l => {
        if (l.status !== 'Approved') return false;
        const start = new Date(l.from); start.setHours(0, 0, 0, 0);
        const end = new Date(l.to); end.setHours(23, 59, 59, 999);
        const check = new Date(currentYear, currentMonth, day);
        return check >= start && check <= end;
      });

      if (record && record.punchIn) {
        let workedHours = 0;

        if (record.punchOut) {
          const start = new Date(record.punchIn);
          const end = new Date(record.punchOut);
          workedHours = (end - start) / (1000 * 60 * 60);
        } else if (isToday) {
          const start = new Date(record.punchIn);
          const now = new Date();
          workedHours = (now - start) / (1000 * 60 * 60);
        }

        if (workedHours >= adminFullDayHours) {
          fullDayCount++;
        } else if (workedHours >= adminHalfDayHours) {
          halfDayCount++;
        } else {
          if (!isToday && !isLeave) absentCount++;
        }

      } else {
        if (isToday) continue;
        if (weeklyOffDays.includes(dayOfWeek)) continue;
        if (isHoliday) continue;
        if (isLeave) continue;
        absentCount++;
      }
    }

    return {
      labels: ["Full Day", "Half Day", "Absent"],
      datasets: [
        {
          label: "Days",
          data: [fullDayCount, halfDayCount, absentCount],
          backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
          borderRadius: 6,
        },
      ],
    };
  }, [attendance, shiftTimings, holidays, leaves]);

  if (loading) return <div className="p-8 text-center text-lg font-semibold animate-pulse text-gray-500">Loading Dashboard...</div>;
  if (!user) return <div className="p-8 text-center text-red-600 font-semibold">Could not load employee data.</div>;

  const displayLoginStatusContent = getDisplayLoginStatus();
  const showCorrectionBtn = shouldShowCorrectionButton();
  const workedStatusBadge = getWorkedStatusBadge();
  const calculatedTargetHours = getTargetWorkHours();
  const { mode: currentWorkMode, description: workModeDesc } = calculateWorkModeStatus();

  const targetSeconds = shiftTimings ? (shiftTimings.fullDayHours * 3600) : (9 * 3600);

  // ✅ UPDATED: Shift completed ONLY if final punch out or admin punch out
  const isShiftCompleted =
    (todayLog?.status === "COMPLETED" && todayLog?.isFinalPunchOut === true) ||
    todayLog?.adminPunchOut === true ||
    (todayLog?.punchIn && todayLog?.punchOut && todayLog?.isFinalPunchOut === true);

  const isShiftReqCompleted = workedTime >= targetSeconds;

  const showPunchInButton = !todayLog || (todayLog.status !== "WORKING" && !isShiftCompleted);

  const isGlobalWFH = officeConfig?.globalWorkMode === 'WFH';

  const gradients = [
    "from-blue-400 to-indigo-500",
    "from-pink-400 to-rose-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-amber-500",
    "from-purple-400 to-violet-500",
  ];

  return (
    <div className="p-4 md:p-8 min-h-screen relative font-sans text-gray-800 max-w-7xl mx-auto overflow-x-hidden">

      {/* 🎂 BIRTHDAY BANNER */}
      {todaysBirthdays.length > 0 && showBirthdayBanner && (
        <div className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 text-white p-4 mb-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in-down relative overflow-hidden pr-12 md:pr-4">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-yellow-300 opacity-10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-4 relative z-10 flex-1">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm border border-white/30 shadow-inner">
              <FaBirthdayCake className="text-3xl text-yellow-100 drop-shadow-md animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl tracking-tight text-white drop-shadow-sm flex items-center gap-2">
                Happy Birthday! <span className="text-lg">🎉</span>
              </h3>
              <p className="text-sm font-medium text-pink-50 mt-0.5 leading-relaxed">
                {(() => {
                  const myBirthday = todaysBirthdays.find(b => b.employeeId === user?.employeeId || b.email === user?.email);
                  const othersBirthdays = todaysBirthdays.filter(b => b.employeeId !== user?.employeeId && b.email !== user?.email);
                  
                  if (myBirthday && othersBirthdays.length === 0) {
                    return <span>Wishing you a very Happy Birthday from the entire team! Have a fantastic day! 🥳</span>;
                  } else if (myBirthday && othersBirthdays.length > 0) {
                    return <span>Wishing you a very Happy Birthday from the team! 🥳 Also, wish a Happy Birthday to <span className="font-bold text-white border-b border-dashed border-white/50 pb-0.5">{othersBirthdays.map(b => b.name).join(', ')}</span>!</span>;
                  } else {
                    return <span>Today is <span className="font-bold text-white border-b border-dashed border-white/50 pb-0.5">{othersBirthdays.map(b => b.name).join(', ')}</span>'s birthday! Wish them a great day! 🥳</span>;
                  }
                })()}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              sessionStorage.setItem(`birthdayBannerClosed_${today}`, "true");
              setShowBirthdayBanner(false);
            }}
            className="absolute top-3 right-3 md:relative md:top-auto md:right-auto z-10 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
            title="Dismiss"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* ✅ MISSED PUNCH BANNER — shows Pending/Rejected status + conditionally hides button */}
      {missedPunchLog && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse-slow">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-500 text-2xl" />
            <div>
              <h4 className="font-bold text-red-800">Action Required: Missed Punch Out</h4>
              <p className="text-sm text-red-700">
                You did not punch out on <b>{formatDateDDMMYYYY(missedPunchLog.date)}</b>.
                You cannot Punch In for today until this is resolved.
              </p>

              {/* ✅ NEW: Pending Status Logic */}
              {missedPunchRequestStatus === 'Pending' && (
                <span className="text-orange-600 font-bold text-xs bg-orange-100 border border-orange-200 px-2 py-1 rounded mt-2 inline-flex items-center gap-1">
                  <FaRegClock /> Request Pending Approval Please Wait for Approval
                </span>
              )}
              {missedPunchRequestStatus === 'Rejected' && (
                <span className="text-red-600 font-bold text-xs bg-red-100 border border-red-200 px-2 py-1 rounded mt-2 inline-block">
                  Request Rejected - Please submit again
                </span>
              )}
            </div>
          </div>

          {/* ✅ NEW: Hide button when Pending */}
          {missedPunchRequestStatus !== 'Pending' && (
            <button
              onClick={() => setShowReqModal(true)}
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-red-700 transition flex items-center gap-2 whitespace-nowrap active:scale-95"
            >
              <FaPaperPlane /> Request Punch Out
            </button>
          )}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white/60 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg p-5 md:p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10 overflow-visible">
        <div className="flex flex-col items-center shrink-0">
          <div className="relative group/profile">
            <img
              src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover relative z-0 transition-transform duration-300 group-hover/profile:scale-105"
            />
            <div className="flex justify-center gap-2 -mt-6 relative z-10">
              <label
                htmlFor="profile-upload"
                className={`bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg border-2 border-white transition-all active:scale-90 ${uploadingImage ? "opacity-50" : ""}`}
              >
                {uploadingImage ? <div className="animate-spin text-xs">⏳</div> : profileImage ? <FaEdit size={12} /> : <FaCamera size={12} />}
              </label>

              {profileImage && (
                <button
                  onClick={handleDeleteProfilePic}
                  className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg border-2 border-white transition-all active:scale-90"
                >
                  <FaTrash size={12} />
                </button>
              )}
            </div>
          </div>
          <input id="profile-upload" type="file" className="hidden" onChange={handleImageSelect} disabled={uploadingImage} />
        </div>

        <div className="flex-1 w-full">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-6">
            <div className="w-full xl:w-auto text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-800 flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
                <FaUserCircle className="text-blue-500 hidden md:block" />
                {name}
              </h3>
              <div className="mt-3 mb-4 flex flex-col items-center md:items-start gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider font-bold shadow-sm border ${currentWorkMode === 'WFH' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {currentWorkMode === 'WFH' ? <FaLaptopHouse size={14} /> : <FaBuilding size={14} />} {currentWorkMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                </span>
                <div className="text-[11px] text-gray-500 font-medium italic flex items-center gap-1">
                  <FaInfoCircle size={10} />
                  {currentWorkMode === 'WFO' && officeConfig?.requireAccurateLocation !== false
                    ? 'Accurate office location required'
                    : workModeDesc
                  }
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-600 mt-2 text-sm font-medium border-t border-gray-100 pt-4 md:border-none md:pt-0">
                <div className="flex items-center justify-between md:justify-start md:gap-2">
                  <b className="text-gray-800">ID:</b> <span>{employeeId}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-2">
                  <b className="text-gray-800">Email:</b> <span className="truncate max-w-[150px] md:max-w-none">{email}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-2">
                  <b className="text-gray-800">Department:</b> <span>{department}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-2">
                  <b className="text-gray-800">Role:</b> <span>{role}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-2 col-span-1 sm:col-span-2 mt-2">
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-xs font-bold w-full md:w-auto justify-center shadow-sm"
                  >
                    <FaExternalLinkAlt className="w-3 h-3" />
                    View Public Portfolio
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4 w-full xl:w-auto">
              <div className="text-center md:text-right bg-white/80 p-4 rounded-2xl border border-gray-100 shadow-sm w-full sm:w-auto min-w-[200px]">
                <div className="text-3xl font-extrabold text-gray-800 tracking-wider font-mono">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-[10px] font-bold text-blue-600 uppercase mt-1 tracking-widest">
                  {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full">
                {showCorrectionBtn && (
                  <button
                    onClick={handleOpenLateRequestModal}
                    className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded-xl shadow-sm hover:bg-red-50 transition-all text-xs font-bold animate-pulse-slow grow sm:grow-0 justify-center"
                  >
                    <div className="flex flex-col items-center md:items-start leading-tight">
                      <span className="flex items-center gap-1.5">
                        <FaPen size={10} /> Request on-time login
                      </span>
                      <span className="text-[9px] text-red-400 font-semibold mt-0.5">
                        {requestLimit.limit - requestLimit.used} left
                      </span>
                    </div>
                  </button>
                )}

                {/* ✅ NEW: Breaks & Sessions Dropdown */}
                {todayLog?.sessions?.length > 0 && (
                  <div className="relative grow sm:grow-0" ref={breakDropdownRef}>
                    <button onClick={() => setIsBreakDropdownOpen(!isBreakDropdownOpen)} className="flex items-center justify-center gap-2 bg-white text-orange-700 border border-orange-200 px-4 py-2 rounded-xl shadow-sm hover:bg-orange-50 transition-all text-xs font-bold h-11 w-full sm:w-auto"> <FaHistory /> Sessions <FaChevronDown className={`transform transition-transform ${isBreakDropdownOpen ? 'rotate-180' : ''}`} size={10} /> </button>
                    {isBreakDropdownOpen && (
                      <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] p-5 animate-fade-in-down max-h-[70vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}>
                        <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-3 uppercase text-[10px] tracking-wider shrink-0">Today's Sessions</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {todayLog.sessions.map((sess, idx) => (
                            <div key={idx} className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <div className="flex justify-between font-bold text-gray-700 mb-1">
                                <span>Session {idx + 1}</span>
                                <span className={sess.punchOut ? "text-green-600 bg-green-50 px-2 py-0.5 rounded" : "text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse"}>{sess.punchOut ? "Completed" : "Active"}</span>
                              </div>
                              <div className="flex justify-between text-gray-500 font-medium">
                                <span>In: {new Date(sess.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>Out: {sess.punchOut ? new Date(sess.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {shiftTimings && (
                  <div className="relative grow sm:grow-0" ref={dropdownRef}>
                    <button onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)} className="flex items-center justify-center gap-2 bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-xl shadow-sm hover:bg-blue-50 transition-all text-xs font-bold h-11 w-full sm:w-auto"> <FaRegClock /> Shift <FaChevronDown className={`transform transition-transform ${isShiftDropdownOpen ? 'rotate-180' : ''}`} size={10} /> </button>
                    {isShiftDropdownOpen && (
                      <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] p-5 animate-fade-in-down"
                        onClick={(e) => e.stopPropagation()}>
                        <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-3 uppercase text-[10px] tracking-wider">Assigned Shift</h4>
                        <div className="space-y-3 text-sm text-gray-700 font-medium max-h-80 overflow-y-auto custom-scrollbar pr-1">
                          <div className="flex justify-between"><span>Start Time:</span> <span className="font-bold text-gray-900">{formatTimeDisplay(shiftTimings.shiftStartTime)}</span></div>
                          <div className="flex justify-between"><span>End Time:</span> <span className="font-bold text-gray-900">{formatTimeDisplay(shiftTimings.shiftEndTime)}</span></div>

                          <div className="flex justify-between bg-blue-50 p-2 rounded-lg border border-blue-100 mt-2"><span>Required:</span> <span className="font-bold text-blue-700">{calculatedTargetHours}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Min Half Day:</span> <span>{getTargetHalfDayHours()}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Grace:</span> <span>{shiftTimings.lateGracePeriod} mins</span></div>

                          <div className="pt-3 border-t border-gray-100 mt-2">
                            <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Weekly Offs:</span>
                            <div className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">{getDayNames(shiftTimings.weeklyOffDays)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Daily Attendance Section */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 relative bg-white mb-8 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FaRegClock size={18} /></div>
            <h2 className="font-bold text-lg text-gray-800">Daily Attendance</h2>
          </div>
          <button onClick={() => navigate("/employee/my-attendence")} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition shadow-sm">View History →</button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar border border-gray-100 rounded-xl bg-white shadow-sm">
          <table className="min-w-[950px] w-full text-[13px] xl:text-sm text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Date</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">First In</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Last Out</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Worked</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Login Status</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Worked Status</th>
                <th className="px-4 xl:px-6 py-5 whitespace-nowrap">Break Time</th>
                <th className="px-4 xl:px-6 py-5 text-center whitespace-nowrap">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              <tr className="hover:bg-blue-50/30 transition-colors duration-200">
                <td className="px-4 xl:px-6 py-5 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800">{formatDateDDMMYYYY(todayIso)}</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase">Today</span>
                  </div>
                </td>
                <td className="px-4 xl:px-6 py-5 font-semibold text-gray-600 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm shadow-green-100"></div>
                    {todayLog?.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                  </div>
                </td>
                <td className="px-4 xl:px-6 py-5 whitespace-nowrap">
                  {isShiftCompleted ? (
                    <div className="flex items-center gap-2 font-bold text-red-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-100"></div>
                      {todayLog?.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                    </div>
                  ) : todayLog?.status === "WORKING" ? (
                    <span className="bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-black animate-pulse">In Progress</span>
                  ) : todayLog?.isOnBreak ? (
                    <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-black animate-pulse">On Break</span>
                  ) : (
                    <span className="text-gray-300 font-medium italic text-xs">Awaiting...</span>
                  )}
                </td>
                <td className="px-4 xl:px-6 py-5 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-mono font-black text-blue-600 text-base">{todayLog?.punchIn ? formatWorkedTime(workedTime) : "0h 0m 0s"}</span>
                    <div className="w-20 xl:w-24 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min((workedTime / (8.5 * 3600)) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 xl:px-6 py-5 whitespace-nowrap">{displayLoginStatusContent}</td>
                <td className="px-4 xl:px-6 py-5 whitespace-nowrap">
                  {!todayLog || todayLog.status === "NOT_STARTED" ? (
                    <span className="text-gray-400 font-medium text-xs">Not Started</span>
                  ) : isShiftCompleted ? (
                    <span className="px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border-2 bg-green-50 text-green-600 border-green-200 shadow-sm">
                      Completed ✅
                    </span>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border-2 shadow-sm ${workedStatusBadge.color}`}>
                      {workedStatusBadge.label}
                    </span>
                  )}
                </td>
                <td className="px-4 xl:px-6 py-5 font-mono font-medium whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className={todayLog?.isOnBreak ? 'text-amber-600 animate-pulse font-bold' : 'text-purple-600'}>
                      {formatWorkedTime(breakTime)}
                    </span>
                    {todayLog?.isOnBreak && <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Active Break</span>}
                  </div>
                </td>

                <td className="px-4 xl:px-6 py-5">
                  <div className="flex items-center justify-center">
                    {isShiftCompleted ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="bg-green-100 text-green-600 p-2 rounded-full shadow-sm shadow-green-50"><FaSignOutAlt size={14} /></div>
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Logged Out</span>
                      </div>
                    ) : (!todayLog || todayLog.status === "NOT_STARTED") ? (
                      showPunchInButton ? (
                        <button
                          className={`px-4 xl:px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg text-white font-black text-xs transition transform active:scale-95 w-32 xl:w-36 ${missedPunchLog && missedPunchRequestStatus !== "Approved" ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-200 hover:-translate-y-0.5'}`}
                          onClick={() => handlePunch("IN")}
                          disabled={punchStatus !== "IDLE"}
                        >
                          {getPunchButtonContent("IN")}
                        </button>
                      ) : (
                        <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl">Shift Ended</span>
                      )
                    ) : (
                      <div className="flex flex-col gap-2 w-32 xl:w-36">
                        {todayLog?.status === "WORKING" && (
                          <button
                            className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md text-white font-black text-xs transition transform active:scale-95 ${isShiftReqCompleted ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-red-200' : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:shadow-orange-200'} hover:-translate-y-0.5`}
                            onClick={() => handlePunch("OUT")}
                            disabled={punchStatus !== "IDLE"}
                          >
                            {punchStatus === "PUNCHING" ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FaSignOutAlt />}
                            {punchStatus === "PUNCHING" ? "..." : "Punch Out"}
                          </button>
                        )}
                        {todayLog?.punchIn && !isShiftCompleted && (
                          <button
                            onClick={handleBreak}
                            disabled={punchStatus !== "IDLE"}
                            className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm font-black text-xs transition transform active:scale-95 border-2 ${todayLog?.isOnBreak ? 'text-green-700 bg-white border-green-200 hover:bg-green-50' : 'text-blue-700 bg-white border-blue-200 hover:bg-blue-50'} hover:-translate-y-0.5`}
                          >
                            {todayLog?.isOnBreak ? <FaPlay /> : <FaCoffee />}
                            {todayLog?.isOnBreak ? "Continue" : "Take Break"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none transition-transform group-hover:scale-110"></div>

            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Attendance Status</span>
                <span className="text-sm font-bold text-gray-800 mt-1">{formatDateDDMMYYYY(todayIso)}</span>
              </div>
              {isShiftCompleted ? (
                <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full border border-green-200">FINISHED</span>
              ) : todayLog?.status === "WORKING" ? (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full border border-blue-200 animate-pulse">ACTIVE</span>
              ) : (
                <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-3 py-1 rounded-full border border-gray-200">IDLE</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-1 rounded-full bg-green-500"></div>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">First In</p>
                </div>
                <p className="text-sm font-bold text-gray-800">{todayLog?.punchIn ? new Date(todayLog.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-1 rounded-full bg-red-500"></div>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Last Out</p>
                </div>
                <p className="text-sm font-bold text-gray-800">
                  {isShiftCompleted ? (
                    <span className="text-red-600">{todayLog?.punchOut ? new Date(todayLog.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}</span>
                  ) : "--:--"}
                </p>
              </div>
              <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-wider mb-2">Worked Time</p>
                <p className="text-base font-black text-blue-600 font-mono">{todayLog?.punchIn ? formatWorkedTime(workedTime) : "0h 0m"}</p>
              </div>
              <div className="bg-purple-50/30 p-4 rounded-2xl border border-purple-100/50">
                <p className="text-[9px] text-purple-400 font-black uppercase tracking-wider mb-2">Break Time</p>
                <p className={`text-base font-black font-mono ${todayLog?.isOnBreak ? 'text-amber-600 animate-pulse' : 'text-purple-600'}`}>{formatWorkedTime(breakTime)}</p>
              </div>
            </div>

            <div className="space-y-4 pt-2 mb-6">
              <div className="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Login Compliance</span>
                {displayLoginStatusContent}
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Shift Progress</span>
                {!todayLog || todayLog.status === "NOT_STARTED" ? (
                  <span className="text-[10px] font-black text-gray-400 uppercase">Not Started</span>
                ) : isShiftCompleted ? (
                  <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded border border-green-100">Success ✅</span>
                ) : (
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border-2 ${workedStatusBadge.color}`}>
                    {workedStatusBadge.label}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2">
              {!mobileAccessEnabled ? (
                <div className="w-full text-center bg-gray-50 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-dashed border-gray-200">
                  Mobile Punch Access Disabled
                </div>
              ) : isShiftCompleted ? (
                <div className="w-full text-center bg-gray-50 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-dashed border-gray-200">
                  Daily Shift Completed
                </div>
              ) : (!todayLog || todayLog.status === "NOT_STARTED") ? (
                <button
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg text-white font-black text-sm transition transform active:scale-95 ${missedPunchLog && missedPunchRequestStatus !== "Approved" ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 shadow-green-100'}`}
                  onClick={() => handlePunch("IN")}
                  disabled={punchStatus !== "IDLE"}
                >
                  {getPunchButtonContent("IN")}
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {todayLog?.status === "WORKING" && (
                    <button
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg text-white font-black text-sm transition transform active:scale-95 ${isShiftReqCompleted ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-100' : 'bg-gradient-to-r from-orange-500 to-amber-600 shadow-orange-100'}`}
                      onClick={() => handlePunch("OUT")}
                      disabled={punchStatus !== "IDLE"}
                    >
                      {punchStatus === "PUNCHING" ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FaSignOutAlt />}
                      {punchStatus === "PUNCHING" ? "Processing..." : "Punch Out"}
                    </button>
                  )}
                  {todayLog?.punchIn && !isShiftCompleted && (
                    <button
                      onClick={handleBreak}
                      disabled={punchStatus !== "IDLE"}
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm font-black text-sm transition transform active:scale-95 border-2 ${todayLog?.isOnBreak ? 'text-green-700 bg-white border-green-200' : 'text-blue-700 bg-white border-blue-200'}`}
                    >
                      {todayLog?.isOnBreak ? <FaPlay /> : <FaCoffee />}
                      {todayLog?.isOnBreak ? "Resume" : "Break"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-center lg:justify-start gap-4">
          {todayLog?.punchInLocation && (<button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchInLocation.latitude},${todayLog.punchInLocation.longitude}`, "_blank")} className="bg-white border border-blue-200 text-blue-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-blue-50 flex items-center gap-2 transition hover:-translate-y-0.5"><FaMapMarkerAlt /> Entry Location</button>)}
          {todayLog?.punchOutLocation && (<button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchOutLocation.latitude},${todayLog.punchOutLocation.longitude}`, "_blank")} className="bg-white border border-red-200 text-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-red-50 flex items-center gap-2 transition hover:-translate-y-0.5"><FaMapMarkerAlt /> Exit Location</button>)}
        </div>
      </div>

      {/* GRAPHS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white p-6 min-h-[320px] flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-6 text-gray-800"><FaCalendarAlt className="text-blue-500" /> Attendance Summary</h2>
          <div className="flex-1 relative min-h-[200px]">
            {loadingTeamData && attendance.length === 0 ? <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium text-sm">Loading Stats...</div> : <Bar data={leaveBarData} options={commonChartOptions} />}
          </div>
        </div>
        <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white p-6 min-h-[320px] flex flex-col">
          <h2 className="font-bold flex items-center gap-2 mb-6 text-gray-800"><FaChartPie className="text-amber-500" /> Today's Progress</h2>
          <div className="flex-1 relative flex flex-col items-center justify-center">
            <div className="w-full h-full max-h-44 relative">
              <Doughnut data={workMeterData} options={meterChartOptions} />
              <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none"> <span className="text-2xl font-black text-gray-800"> {Math.floor((workMeterData.rawValues.currentWorked / workMeterData.rawValues.targetSeconds) * 100)}% </span> </div>
            </div>
            <div className="flex justify-between w-full px-4 sm:px-8 mt-6 border-t border-gray-100 pt-4">
              <div className="text-center"> <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Worked</p> <p className="text-sm sm:text-lg font-black text-blue-600">{formatWorkedTime(workMeterData.rawValues.currentWorked)}</p> </div>
              <div className="text-center"> <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Target</p> <p className="text-sm sm:text-lg font-black text-gray-600">{formatWorkedTime(workMeterData.rawValues.targetSeconds)}</p> </div>
            </div>
          </div>
        </div>
      </div>

      {/* BIRTHDAYS & ON LEAVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* 🎂 BIRTHDAYS */}
        <div className="bg-white rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.08)] border border-gray-100 p-6 relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                <FaBirthdayCake className="text-lg animate-bounce-slow" />
              </div>
              <h2 className="font-bold text-lg text-gray-800">Birthdays</h2>
            </div>
            <span className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm tracking-wider">
              {todaysBirthdays.length} TODAY
            </span>
          </div>

          {loadingTeamData ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : todaysBirthdays.length > 0 ? (
            <div className="flex flex-wrap gap-4 sm:gap-8 relative z-10 px-2 justify-center md:justify-start">
              {todaysBirthdays.map((person, index) => (
                <div key={index} className="group/avatar flex flex-col items-center cursor-pointer relative">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-yellow-400 via-orange-500 to-pink-500 rounded-full opacity-80 blur-[1px]"></div>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-pink-600 text-base sm:text-lg">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-[10px] border border-gray-100">🎉</div>
                  </div>
                  <p className="mt-2 text-[10px] sm:text-[11px] font-bold text-gray-700 text-center w-20 sm:w-24 truncate">
                    {person.name}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm font-medium">No cakes to cut today 🎂</p>
            </div>
          )}
        </div>

        {/* 🏖️ ON LEAVE */}
        <div className="relative overflow-hidden bg-white rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.08)] border border-gray-200 p-6 z-10 h-full flex flex-col">
          <div className="absolute top-0 left-0 -ml-10 -mt-10 w-32 h-32 bg-gradient-to-br from-blue-400 to-cyan-300 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-500 shadow-sm">
                <FaUmbrellaBeach className="text-lg" />
              </div>
              <h2 className="font-bold text-lg text-gray-800">On Leave</h2>
            </div>
            <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full shadow-sm">
              {onLeaveToday.length} Away
            </span>
          </div>

          {loadingTeamData ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : onLeaveToday.length > 0 ? (
            <div className="flex flex-wrap gap-4 sm:gap-6 relative z-10 pl-2 justify-center md:justify-start">
              {onLeaveToday.map((person, index) => (
                <div key={index} className="group/avatar flex flex-col items-center cursor-pointer relative">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-300 to-cyan-500 rounded-full opacity-50 group-hover/avatar:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center border-2 border-white shadow-sm group-hover/avatar:scale-105 transition-transform duration-300">
                      <span className="font-bold text-gray-500 text-base sm:text-lg group-hover/avatar:text-blue-600 transition-colors">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full shadow-sm z-10" title="Away"></div>
                  </div>
                  <p className="mt-2 text-[10px] sm:text-xs font-bold text-gray-700 text-center w-16 sm:w-20 truncate group-hover/avatar:text-blue-600 transition-colors">
                    {person.name.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm font-medium">Full house today! 🏠</p>
            </div>
          )}
        </div>
      </div>

      {/* REMOTE WORK & QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* 🏠 Working Remotely */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col relative z-10 overflow-visible group transition-all duration-300">
          <div className="flex items-center justify-between mb-6 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm">
                <FaLaptopHouse className="text-lg" />
              </div>
              <h2 className="font-bold text-gray-800 text-lg">Remote Team</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold border uppercase tracking-wider shadow-sm ${isGlobalWFH ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {isGlobalWFH ? 'Global Remote' : 'Hybrid'}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center z-10">
            {loadingTeamData ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : isGlobalWFH ? (
              <div className="flex flex-col items-center justify-center py-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed">
                <FaLaptopHouse className="text-2xl text-indigo-500 mb-2" />
                <h3 className="font-bold text-indigo-800 text-sm">Full Remote Day</h3>
                <p className="text-[10px] text-indigo-400 mt-1 uppercase font-bold tracking-widest">Everyone is WFH</p>
              </div>
            ) : remoteWorkers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                <FaBuilding className="text-2xl text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-500">No Remote Workers Today</p>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center pt-2">
                <div className="flex -space-x-3 items-end justify-center py-4 min-h-[70px]">
                  {remoteWorkers.slice(0, 5).map((worker, i) => (
                    <div key={i} className="group/avatar relative transition-all duration-300 hover:-translate-y-2 hover:z-20 z-0">
                      <div className={`relative w-11 h-11 rounded-full ring-2 ring-white bg-gradient-to-tr ${gradients[i % gradients.length]} flex items-center justify-center shadow-md cursor-pointer border border-white`}>
                        <span className="text-white font-bold text-sm">{worker.name.charAt(0)}</span>
                      </div>
                    </div>
                  ))}
                  {remoteWorkers.length > 5 && (
                    <button onClick={() => setShowAllRemoteEmp(!showAllRemoteEmp)} className="relative z-0 hover:z-10 transition-transform hover:scale-105 cursor-pointer">
                      <div className="w-11 h-11 rounded-full ring-2 ring-white bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs shadow-sm">
                        {showAllRemoteEmp ? <FaTimes /> : `+${remoteWorkers.length - 5}`}
                      </div>
                    </button>
                  )}
                </div>
                {showAllRemoteEmp && (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {remoteWorkers.map((w, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-700">{w.name}</span>
                        <span className="text-[9px] uppercase font-semibold text-gray-400">{w.department}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-4 bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100">
                  <span className="text-indigo-600">{remoteWorkers.length}</span> Remote Today
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 🌿 Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col justify-between relative overflow-hidden group transition-all duration-300 z-10">
          <div className="flex items-center justify-between mb-6 z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-500 shadow-sm">
                <FaLuggageCart className="text-lg" />
              </div>
              <h2 className="font-bold text-gray-800 text-lg">Quick Actions</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 z-10 relative">
            <Link to="/employee/leave-management" className="group/link bg-white hover:bg-cyan-50/50 border border-gray-100 hover:border-cyan-200 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs shrink-0"><FaLuggageCart /></div>
              <div className="flex-1"><h3 className="font-bold text-gray-800 text-[11px] group-hover/link:text-cyan-700">Leaves</h3></div>
              <FaAngleRight className="text-gray-300 group-hover/link:text-cyan-50 group-hover/link:translate-x-1 transition-all text-xs" />
            </Link>
            <Link to="/employee/holiday-calendar" className="group/link bg-white hover:bg-emerald-50/50 border border-gray-100 hover:border-emerald-200 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0"><FaCalendarAlt /></div>
              <div className="flex-1"><h3 className="font-bold text-gray-800 text-[11px] group-hover/link:text-emerald-700">Holidays</h3></div>
              <FaAngleRight className="text-gray-300 group-hover/link:text-emerald-500 group-hover/link:translate-x-1 transition-all text-xs" />
            </Link>
            <Link to="/employee/empovertime" className="group/link bg-white hover:bg-amber-50/50 border border-gray-100 hover:border-amber-200 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0"><FaClock /></div>
              <div className="flex-1"><h3 className="font-bold text-gray-800 text-[11px] group-hover/link:text-amber-700">Overtime</h3></div>
              <FaAngleRight className="text-gray-300 group-hover/link:text-amber-500 group-hover/link:translate-x-1 transition-all text-xs" />
            </Link>
            <Link to="/employee/notices" className="group/link bg-white hover:bg-purple-50/50 border border-gray-100 hover:border-purple-200 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs shrink-0"><FaBullhorn /></div>
              <div className="flex-1"><h3 className="font-bold text-gray-800 text-[11px] group-hover/link:text-purple-700">Notices</h3></div>
              <FaAngleRight className="text-gray-300 group-hover/link:text-purple-500 group-hover/link:translate-x-1 transition-all text-xs" />
            </Link>
            <Link to="/employee/payslip" className="group/link bg-blue-600 hover:bg-blue-700 border border-blue-500 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 shadow-md col-span-full">
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-black text-sm shrink-0">₹</div>
              <div className="flex-1"><h3 className="font-bold text-white text-[11px]">View Payslips</h3></div>
              <FaAngleRight className="text-white/70 group-hover/link:translate-x-1 transition-all text-xs" />
            </Link>
          </div>
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Missed Punch Yesterday — Request Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down border border-gray-200">
            <div className="bg-red-600 px-6 py-5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaPaperPlane /> Request Punch Out</h3>
              <button onClick={() => setShowReqModal(false)} className="text-white hover:text-red-200 transition"><FaTimes size={18} /></button>
            </div>
            <div className="p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-800 mb-5 bg-red-50 border border-red-100 p-3 rounded-lg">
                You missed punching out on <b>{formatDateDDMMYYYY(reqData.date)}</b>. Please provide the actual time you left work.
              </p>
              <form onSubmit={handleRequestSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Missed Date</label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 shadow-sm">
                    <FaCalendarAlt className="text-gray-400 mr-3" />
                    <input type="text" value={formatDateDDMMYYYY(reqData.date)} disabled className="bg-transparent outline-none w-full text-gray-500 font-semibold cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Actual Out Time (in 24 HRS format)</label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus-within:ring-2 focus-within:ring-blue-500 transition shadow-sm">
                    <FaRegClock className="text-gray-400 mr-3" />
                    <input
                      type="time"
                      value={reqData.time}
                      onChange={(e) => setReqData({ ...reqData, time: e.target.value })}
                      className="bg-transparent outline-none w-full text-gray-800 font-semibold"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason</label>
                  <textarea
                    value={reqData.reason}
                    onChange={(e) => setReqData({ ...reqData, reason: e.target.value })}
                    placeholder="e.g. Forgot to punch out, Network issue..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none transition shadow-sm text-sm font-medium"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => setShowReqModal(false)} className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 font-bold text-sm hover:bg-gray-50 rounded-xl transition shadow-sm">Cancel</button>
                  <button type="submit" disabled={reqLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 flex items-center gap-2 transition active:scale-95">
                    {reqLoading ? "Sending..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Late Login Correction Modal — with request limit progress bar */}
      {showLateReqModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down border border-gray-200">
            <div className="bg-orange-500 px-6 py-5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaRegClock /> Request On-Time Login</h3>
              <button onClick={() => setShowLateReqModal(false)} className="text-white hover:text-orange-200 transition"><FaTimes size={18} /></button>
            </div>
            <div className="p-6">

              {/* ✅ NEW: Monthly request limit progress bar */}
              <div className="mb-5 bg-purple-50 border border-purple-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Monthly Request Limit</span>
                  <span className="text-lg font-black text-purple-800">
                    {requestLimit.limit - requestLimit.used} / {requestLimit.limit}
                  </span>
                </div>
                <div className="w-full bg-purple-200/50 rounded-full h-2 border border-purple-200">
                  <div
                    className="bg-purple-500 h-1.5 rounded-full transition-all duration-300 m-[1px]"
                    style={{ width: `${Math.min(((requestLimit.limit - requestLimit.used) / requestLimit.limit) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-purple-500 mt-2">
                  {requestLimit.limit - requestLimit.used === 0 ? (
                    <span className="text-red-500">⚠️ No requests remaining</span>
                  ) : (
                    `${requestLimit.limit - requestLimit.used} request${requestLimit.limit - requestLimit.used !== 1 ? 's' : ''} remaining`
                  )}
                </p>
              </div>

              <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wider mb-5 bg-orange-50 border border-orange-100 p-3 rounded-lg leading-relaxed">
                You are marked as <b>LATE</b>. If you arrived on time but missed punching in, or have a valid reason, raise a correction request.
              </p>

              <form onSubmit={handleLateRequestSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Today's Date</label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 shadow-sm">
                    <FaCalendarAlt className="text-gray-400 mr-3" />
                    <input type="text" value={formatDateDDMMYYYY(todayIso)} disabled className="bg-transparent outline-none w-full text-gray-500 font-semibold cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Actual Arrival Time</label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus-within:ring-2 focus-within:ring-orange-400 transition shadow-sm">
                    <FaRegClock className="text-gray-400 mr-3" />
                    <input
                      type="time"
                      value={lateReqData.time}
                      onChange={(e) => setLateReqData({ ...lateReqData, time: e.target.value })}
                      className="bg-transparent outline-none w-full text-gray-800 font-semibold"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason</label>
                  <textarea
                    value={lateReqData.reason}
                    onChange={(e) => setLateReqData({ ...lateReqData, reason: e.target.value })}
                    placeholder="Reason for late login..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-400 h-24 resize-none transition shadow-sm text-sm font-medium"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowLateReqModal(false)}
                    className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 font-bold text-sm hover:bg-gray-50 rounded-xl transition shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={lateReqLoading || (requestLimit.limit - requestLimit.used) === 0}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition active:scale-95"
                  >
                    {lateReqLoading ? "Sending..." :
                      (requestLimit.limit - requestLimit.used) === 0 ? "Limit Reached" :
                        "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCropModal && imageToCrop && (<ImageCropModal imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => { setShowCropModal(false); setImageToCrop(null); }} isUploading={uploadingImage} />)}
      
      <EmployeeQRCodeModal 
        isOpen={showQRModal} 
        onClose={() => setShowQRModal(false)} 
        qrCodeUrl={displayUser?.qrCodeUrl} 
        portfolioUrl={`https://vwsync.com/portfolio/${employeeId}`}
        employeeName={displayUser?.name}
      />
    </div>
  );
};

export default EmployeeDashboard;
