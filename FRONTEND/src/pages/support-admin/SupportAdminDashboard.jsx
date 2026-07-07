import React, { useState, useContext, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaUsers,
  FaUserClock,
  FaCalendarCheck,
  FaFileAlt,
  FaLaptopCode,
  FaChevronRight,
  FaChevronLeft,
  FaSyncAlt,
  FaCamera,
  FaTrash,
  FaEdit,
  FaUserCircle,
  FaLaptopHouse,
  FaBuilding,
  FaInfoCircle,
  FaRegClock,
  FaChevronDown,
  FaPlay,
  FaCoffee,
  FaMapMarkerAlt,
  FaHistory,
  FaSignOutAlt,
  FaCalendarAlt,
  FaPen,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Sector
} from "recharts";
import { EmployeeContext } from "../../context/EmployeeContext";
import { AttendanceContext } from "../../context/AttendanceContext";
import { LeaveRequestContext } from "../../context/LeaveRequestContext";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees,
  getAttendanceForEmployee,
  punchIn,
  punchOut,
  uploadProfilePic,
  getProfilePic,
  deleteProfilePic,
  getShiftByEmployeeId,
} from "../../api";
import { AuthContext } from "../../context/AuthContext";
import Swal from "sweetalert2";
import ImageCropModal from "../../EmployeePages/ImageCropModal";

const getDeptRole = (emp) => {
  const exp = Array.isArray(emp.experienceDetails)
    ? emp.experienceDetails.find((e) => e.lastWorkingDate === "Present") ||
    emp.experienceDetails[0]
    : null;
  return {
    department: emp.currentDepartment || exp?.department || "Unassigned",
    role: emp.currentRole || exp?.role || "—",
  };
};

const formatWeekRange = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

const formatDateDDMMYYYY = (dateString) => {
  if (!dateString) return "--";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB");
};

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

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 3}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={10}
    />
  );
};

const SupportAdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const { employees: ctxEmployees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests: ctxLeaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();
  // Profile & Attendance States for Support Admin Personal Section
  const [profileImage, setProfileImage] = useState(
    sessionStorage.getItem("profileImage_supportAdmin") || null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [punchStatus, setPunchStatus] = useState("IDLE");
  const [shiftTimings, setShiftTimings] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [isBreakDropdownOpen, setIsBreakDropdownOpen] = useState(false);

  const [workedTime, setWorkedTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);

  const [adminProfile, setAdminProfile] = useState(null);

  const dropdownRef = useRef(null);
  const breakDropdownRef = useRef(null);
  const alarmPlayedRef = useRef(false);

  const targetEmployeeId = user?.employeeId || user?.actualId || user?._id;
  const displayAdministrationId = adminProfile?.supportAdminId || user?.supportAdminId || targetEmployeeId;
  const displayRoleName = adminProfile?.positionName || user?.positionName || "Support Admin";
  const todayIso = new Date().toISOString().split("T")[0];

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getAttendanceForEmployeeLocal = useCallback(async (empId) => {
    try {
      const data = await getAttendanceForEmployee(empId);
      const attendanceData = Array.isArray(data) ? data : (data.data || []);
      setAttendance(attendanceData);
      const todayStr = new Date().toISOString().split("T")[0];
      const todayEntry = attendanceData.find((d) => d.date === todayStr);
      setTodayLog(todayEntry || null);
    } catch (err) {
      console.error("Attendance fetch error:", err);
    }
  }, []);

  const getShiftByEmployeeIdLocal = useCallback(async (empId) => {
    try {
      const shift = await getShiftByEmployeeId(empId);
      setShiftTimings(shift || null);
    } catch (err) {
      console.error("Shift fetch error:", err);
    }
  }, []);

  const loadProfilePic = async () => {
    try {
      const res = await getProfilePic();
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage_supportAdmin", res.profilePhoto.url);
      }
    } catch (err) {
      console.error("Profile pic fetch error:", err);
    }
  };

  const loadAdminProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");
      setAdminProfile(res.data);
    } catch (err) {
      console.error("Error loading admin profile:", err);
    }
  };

  // Load initial support admin personal data
  useEffect(() => {
    const bootstrap = async () => {
      if (targetEmployeeId) {
        await Promise.all([
          getAttendanceForEmployeeLocal(targetEmployeeId),
          getShiftByEmployeeIdLocal(targetEmployeeId),
          loadProfilePic(),
          loadAdminProfile(),
        ]);
      }
    };
    bootstrap();
  }, [targetEmployeeId, getAttendanceForEmployeeLocal, getShiftByEmployeeIdLocal]);

  // Real-time Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Worked Time Timer
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
  }, [todayLog]);

  // Break Time Timer
  useEffect(() => {
    let interval;
    const isOnBreak = todayLog?.isOnBreak === true;
    const isCompleted = todayLog?.isFinalPunchOut === true || todayLog?.adminPunchOut === true;

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

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser.");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }).catch(async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 30000,
          });
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

  const handlePunch = async (action) => {
    if (!targetEmployeeId) return;
    setPunchStatus("FETCHING");
    try {
      const location = await getCurrentLocation();
      setPunchStatus("PUNCHING");

      if (action === "IN") {
        await punchIn({
          employeeId: targetEmployeeId,
          employeeName: adminProfile?.name || user?.name || "Support Admin",
          latitude: location.latitude,
          longitude: location.longitude,
        });
        speak(`${adminProfile?.name || user?.name}, punch in successful`);
        Swal.fire({ icon: 'success', title: 'Welcome!', text: 'Punch in recorded successfully.' });
      } else {
        await punchOut({
          employeeId: targetEmployeeId,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        speak(`${adminProfile?.name || user?.name}, punch out successful`);
        Swal.fire({ icon: 'success', title: 'Goodbye!', text: 'Punch out recorded successfully.' });
      }
      await getAttendanceForEmployeeLocal(targetEmployeeId);
    } catch (err) {
      console.error("Punch error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      speak("Punch operation failed");
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: `Failed to record attendance: ${msg}`,
      });
    } finally {
      setPunchStatus("IDLE");
    }
  };

  const handleBreak = async () => {
    if (!targetEmployeeId) return;
    setPunchStatus("FETCHING");
    try {
      const location = await getCurrentLocation();
      setPunchStatus("PUNCHING");
      if (todayLog?.isOnBreak) {
        await api.post('/api/attendance/punch-in', {
          employeeId: targetEmployeeId,
          employeeName: adminProfile?.name || user?.name || "Support Admin",
          latitude: location.latitude,
          longitude: location.longitude,
        });
        const name = adminProfile?.name || user?.name || "Support Admin";
        speak(`${name}, break ended`);
        Swal.fire({ icon: 'success', title: 'Welcome Back!', text: 'Break ended. Work session resumed.' });
      } else {
        await api.post('/api/attendance/punch-break', {
          employeeId: targetEmployeeId,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        const name = adminProfile?.name || user?.name || "Support Admin";
        speak(`${name}, break started`);
        Swal.fire({ icon: 'info', title: 'Break Started! ☕', text: 'Your session is paused. Click Continue to resume work.' });
      }
      await getAttendanceForEmployeeLocal(targetEmployeeId);
    } catch (err) {
      console.error("Break toggle error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: `Failed to toggle break: ${msg}`,
      });
    } finally {
      setPunchStatus("IDLE");
    }
  };

  const handleCropComplete = async (croppedBlob) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", croppedBlob, "profile.jpg");
      formData.append("employeeId", targetEmployeeId);
      formData.append("name", adminProfile?.name || user?.name || "Support Admin");
      formData.append("email", adminProfile?.email || user?.email || "");

      const res = await uploadProfilePic(formData);
      if (res?.profilePhoto?.url) {
        setProfileImage(res.profilePhoto.url);
        sessionStorage.setItem("profileImage_supportAdmin", res.profilePhoto.url);
        setShowCropModal(false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: 'Failed to upload profile image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteProfilePic = async () => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to delete your profile picture?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteProfilePic();
          setProfileImage(null);
          sessionStorage.removeItem("profileImage_supportAdmin");
          Swal.fire('Deleted!', 'Your profile picture has been deleted.', 'success');
        } catch (err) {
          console.error("Delete pic error:", err);
          Swal.fire('Error!', 'Failed to delete profile picture.', 'error');
        }
      }
    });
  };

  const isShiftCompleted = todayLog?.punchIn && todayLog?.punchOut && todayLog?.isFinalPunchOut === true;

  const displayLoginStatusContent = useMemo(() => {
    if (!todayLog?.punchIn) return <span className="text-gray-400 font-medium text-xs">--</span>;
    if (todayLog.loginStatus === "ON_TIME") {
      return (
        <span className="px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border-2 bg-green-50 text-green-600 border-green-200 shadow-sm">
          On Time
        </span>
      );
    }
    return (
      <span className="px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border-2 bg-red-50 text-red-600 border-red-200 shadow-sm">
        Late Login
      </span>
    );
  }, [todayLog]);

  const workedStatusBadge = useMemo(() => {
    if (!todayLog?.punchIn) return { label: "--", color: "text-gray-500" };
     if (todayLog.status === "WORKING" || todayLog.status === "ON_BREAK") {
      return { label: "Working", color: "bg-indigo-50 text-indigo-600 border-indigo-200" };
    }
    if (todayLog.workedStatus === "FULL_DAY" || todayLog.workedStatus === "Full Day") {
      return { label: "Full Day", color: "bg-green-50 text-green-600 border-green-200" };
    }
    if (todayLog.workedStatus === "HALF_DAY" || todayLog.workedStatus === "Half Day") {
      return { label: "Half Day", color: "bg-amber-50 text-amber-600 border-amber-200" };
    }
    return { label: "Absent", color: "bg-red-50 text-red-600 border-red-200" };
  }, [todayLog]);

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
    if (action === "IN") {
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

  const getDayNames = (dayNums) => {
    if (!dayNums || !Array.isArray(dayNums)) return "Sundays";
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNums.map(n => days[n]).join(", ");
  };

  const [allEmployees, setAllEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [employeeWorkModes, setEmployeeWorkModes] = useState({});

  // Graph State
  const [viewMode, setViewMode] = useState("week");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentWeek, setCurrentWeek] = useState(0);
  const [chartRawData, setChartRawData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  const { statCards } = useMemo(
    () => getDashboardData(ctxEmployees, ctxLeaveRequests), [ctxEmployees, ctxLeaveRequests, getDashboardData]
  );

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [todayAtt, leavesData, empData] = await Promise.all([
        getAttendanceByDateRange(today, today).catch(() => []),
        getLeaveRequests().catch(() => []),
        getEmployees().catch(() => []),
      ]);

      setTodayAttendance(Array.isArray(todayAtt) ? todayAtt : []);
      setAllLeaves(Array.isArray(leavesData) ? leavesData : []);
      setAllEmployees(Array.isArray(empData) ? empData : []);

      try {
        const { data } = await api.get("/api/admin/settings/employees-modes");
        if (data?.employees) {
          const modeMap = {};
          data.employees.forEach((e) => {
            modeMap[e.employeeId] = e.currentEffectiveMode || "WFO";
          });
          setEmployeeWorkModes(modeMap);
        }
      } catch (err) {
        console.warn("SupportAdminDashboard work mode fetch skipped:", err?.message || err);
      }
    } catch (err) {
      console.error("SupportAdminDashboard fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.isActive !== false && (e.status || "").toLowerCase() !== "deactive"), [allEmployees]
  );

  const empMap = useMemo(() => {
    const m = {};
    allEmployees.forEach((e) => { m[e.employeeId] = e; });
    return m;
  }, [allEmployees]);

  const weekDates = useMemo(() => {
    const formatDate = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    };

    if (viewMode === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      lastDay.setHours(23, 59, 59, 999);

      return {
        start: formatDate(firstDay),
        end: formatDate(lastDay),
        startDateObj: firstDay,
        endDateObj: lastDay
      };
    }

    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);

    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: formatDate(monday),
      end: formatDate(sunday),
      startDateObj: monday,
      endDateObj: sunday
    };
  }, [currentWeek, viewMode, selectedMonth]);

  useEffect(() => {
    const fetchGraph = async () => {
      setLoadingGraph(true);
      try {
        const data = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setChartRawData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching graph data:", error);
        setChartRawData([]);
      } finally {
        setLoadingGraph(false);
      }
    };
    fetchGraph();
  }, [weekDates]);

  const weeklyChartData = useMemo(() => {
    const totalActive = activeEmployees.length || 1;
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const iterations = viewMode === 'week'
      ? 7
      : Math.ceil((weekDates.endDateObj - weekDates.startDateObj) / (1000 * 3600 * 24)) + 1;

    const startObj = new Date(weekDates.startDateObj);

    for (let i = 0; i < iterations; i++) {
      const loopDate = new Date(startObj);
      loopDate.setDate(startObj.getDate() + i);

      const loopDateNormalized = new Date(loopDate);
      loopDateNormalized.setHours(0, 0, 0, 0);

      const offset = loopDate.getTimezoneOffset() * 60000;
      const dateStr = new Date(loopDate.getTime() - offset).toISOString().slice(0, 10);

      const dayName = viewMode === 'week'
        ? loopDate.toLocaleDateString('en-US', { weekday: 'short' })
        : loopDate.getDate().toString();

      if (loopDateNormalized > today) {
        data.push({
          name: dayName,
          Present: 0,
          Absent: 0
        });
        continue;
      }

      let presentCount = 0;
      chartRawData.forEach(att => {
        const attDate = att.date
          ? att.date.split("T")[0]
          : (att.punchIn ? new Date(att.punchIn).toISOString().split("T")[0] : null);

        if (attDate === dateStr && att.punchIn) {
          if (activeEmployees.some(e => e.employeeId === att.employeeId)) {
            presentCount++;
          }
        }
      });

      const onLeaveCount = allLeaves.filter(l =>
        l.status === 'Approved' &&
        dateStr >= l.from &&
        dateStr <= l.to
      ).length;

      const absentCount = Math.max(0, totalActive - presentCount - onLeaveCount);

      data.push({
        name: dayName,
        Present: presentCount,
        Absent: absentCount
      });
    }

    return data;
  }, [chartRawData, activeEmployees, allLeaves, weekDates, viewMode]);

  const todayPresent = useMemo(
    () => todayAttendance.filter((a) => !!a.punchIn),
    [todayAttendance]
  );
  const presentIds = useMemo(() => new Set(todayAttendance.map((a) => a.employeeId)), [todayAttendance]);

  const onLeaveTodayList = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return allLeaves
      .filter(
        (l) =>
          l.status === "Approved" &&
          todayStr >= l.from &&
          todayStr <= l.to
      )
      .map((l) => {
        const emp = empMap[l.employeeId] || {};
        const { role } = getDeptRole(emp);
        return {
          employeeId: l.employeeId,
          name: emp.name || l.employeeName || l.employeeId,
          role,
          leaveType: l.leaveType || "Leave",
          from: l.from,
        };
      });
  }, [allLeaves, empMap]);

  const onLeaveIds = useMemo(() => new Set(onLeaveTodayList.map((l) => l.employeeId)), [onLeaveTodayList]);

  const todayAbsentCount = useMemo(() => {
    return activeEmployees.filter(
      (e) => !presentIds.has(e.employeeId) && !onLeaveIds.has(e.employeeId)
    ).length;
  }, [activeEmployees, presentIds, onLeaveIds]);

  const departmentData = useMemo(() => {
    const counts = {};
    activeEmployees.forEach((e) => {
      const { department } = getDeptRole(e);
      const deptName = department || "Unassigned";
      counts[deptName] = (counts[deptName] || 0) + 1;
    });

    return Object.keys(counts).map((dept) => ({
      name: dept,
      value: counts[dept],
    }));
  }, [activeEmployees]);

  const COLORS = [
    "#4f46e5",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  return (
    <div
      className="relative w-full font-sans text-gray-800 overflow-hidden flex flex-col"
      style={{ height: "calc(100vh - 70px)" }}
    >
      <style>{`
        .internal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .internal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .internal-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .internal-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      <div className="relative z-10 w-full h-full overflow-y-auto p-6 pb-20 internal-scroll">

        {/* Profile Section */}
        <div className="bg-white/60 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg p-5 md:p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative z-30 overflow-visible">
          <div className="flex flex-col items-center shrink-0">
            <div className="relative group/profile">
              <img
                src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(adminProfile?.name || user?.name || "Support Admin")}&background=0D8ABC&color=fff&size=128`}
                alt="Profile"
                className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover relative z-0 transition-transform duration-300 group-hover/profile:scale-105"
              />
              <div className="flex justify-center gap-2 -mt-6 relative z-10">
                <label
                  htmlFor="profile-upload"
                  className={`bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 shadow-lg border-2 border-white transition-all active:scale-90 ${uploadingImage ? "opacity-50" : ""}`}
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
                  <FaUserCircle className="text-indigo-500 hidden md:block" />
                  {adminProfile?.name || user?.name || "Support Admin"}
                </h3>
                <div className="mt-3 mb-4 flex flex-col items-center md:items-start gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider font-bold shadow-sm border bg-indigo-50 text-indigo-700 border-indigo-200">
                    <FaBuilding size={14} /> Work From Office
                  </span>
                  <div className="text-[11px] text-gray-500 font-medium italic flex items-center gap-1">
                    <FaInfoCircle size={10} />
                    Adhering to standard company-wide policy.
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-600 mt-2 text-sm font-medium border-t border-gray-100 pt-4 md:border-none md:pt-0">
                  <div className="flex items-center justify-between md:justify-start md:gap-2">
                    <b className="text-gray-800">ID:</b> <span>{displayAdministrationId}</span>
                  </div>
                  <div className="flex items-center justify-between md:justify-start md:gap-2">
                    <b className="text-gray-800">Email:</b> <span className="truncate max-w-[150px] md:max-w-none">{adminProfile?.email || user?.email || ""}</span>
                  </div>
                  <div className="flex items-center justify-between md:justify-start md:gap-2">
                    <b className="text-gray-800">Department:</b> <span>{adminProfile?.department || "Support"}</span>
                  </div>
                  <div className="flex items-center justify-between md:justify-start md:gap-2">
                    <b className="text-gray-800">Role:</b> <span>{displayRoleName}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-4 w-full xl:w-auto">
                <div className="text-center md:text-right bg-white/80 p-4 rounded-2xl border border-gray-100 shadow-sm w-full sm:w-auto min-w-[200px]">
                  <div className="text-3xl font-extrabold text-gray-800 tracking-wider font-mono">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase mt-1 tracking-widest">
                    {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full">
                  {/* Breaks & Sessions Dropdown */}
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

                            <div className="flex justify-between bg-blue-50 p-2 rounded-lg border border-blue-100 mt-2"><span>Required:</span> <span className="font-bold text-blue-700">{getTargetWorkHours()}</span></div>
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
        <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 relative bg-white mb-8 animate-fade-in z-10">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><FaRegClock size={18} /></div>
              <h2 className="font-bold text-lg text-gray-800">Daily Attendance</h2>
            </div>
            <button onClick={() => navigate("/support-admin/my-attendance")} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition shadow-sm">View History →</button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm mx-6 my-4">
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
                <tr className="hover:bg-indigo-50/30 transition-colors duration-200">
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
                      <span className="font-mono font-black text-indigo-600 text-base">{todayLog?.punchIn ? formatWorkedTime(workedTime) : "0h 0m 0s"}</span>
                      <div className="w-20 xl:w-24 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min((workedTime / (8.5 * 3600)) * 100, 100)}%` }}></div>
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
                        <button
                          className="px-4 xl:px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg text-white font-black text-xs transition transform active:scale-95 w-32 xl:w-36 bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-200 hover:-translate-y-0.5"
                          onClick={() => handlePunch("IN")}
                          disabled={punchStatus !== "IDLE"}
                        >
                          {getPunchButtonContent("IN")}
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 w-32 xl:w-36">
                          {todayLog?.status === "WORKING" && (
                            <button
                              className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md text-white font-black text-xs transition transform active:scale-95 bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-red-200 hover:-translate-y-0.5"
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
                              className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm font-black text-xs transition transform active:scale-95 border-2 ${todayLog?.isOnBreak ? 'text-green-700 bg-white border-green-200 hover:bg-green-50' : 'text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50'} hover:-translate-y-0.5`}
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
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none transition-transform group-hover:scale-110"></div>

              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Attendance Status</span>
                  <span className="text-sm font-bold text-gray-800 mt-1">{formatDateDDMMYYYY(todayIso)}</span>
                </div>
                {isShiftCompleted ? (
                  <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full border border-green-200">FINISHED</span>
                ) : todayLog?.status === "WORKING" ? (
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-200 animate-pulse">ACTIVE</span>
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
                <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                  <p className="text-[9px] text-indigo-400 font-black uppercase tracking-wider mb-2">Worked Time</p>
                  <p className="text-base font-black text-indigo-600 font-mono">{todayLog?.punchIn ? formatWorkedTime(workedTime) : "0h 0m"}</p>
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
                {isShiftCompleted ? (
                  <div className="w-full text-center bg-gray-50 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-dashed border-gray-200">
                    Daily Shift Completed
                  </div>
                ) : (!todayLog || todayLog.status === "NOT_STARTED") ? (
                  <button
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg text-white font-black text-sm transition transform active:scale-95 bg-gradient-to-r from-green-600 to-emerald-600 shadow-green-100"
                    onClick={() => handlePunch("IN")}
                    disabled={punchStatus !== "IDLE"}
                  >
                    {getPunchButtonContent("IN")}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {todayLog?.status === "WORKING" && (
                      <button
                        className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg text-white font-black text-sm transition transform active:scale-95 bg-gradient-to-r from-red-600 to-rose-600 shadow-red-100"
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
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm font-black text-sm transition transform active:scale-95 border-2 ${todayLog?.isOnBreak ? 'text-green-700 bg-white border-green-200' : 'text-indigo-700 bg-white border-indigo-200'}`}
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
            {todayLog?.punchInLocation && (<button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchInLocation.latitude},${todayLog.punchInLocation.longitude}`, "_blank")} className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-indigo-50 flex items-center gap-2 transition hover:-translate-y-0.5"><FaMapMarkerAlt /> Entry Location</button>)}
            {todayLog?.punchOutLocation && (<button onClick={() => window.open(`https://www.google.com/maps?q=${todayLog.punchOutLocation.latitude},${todayLog.punchOutLocation.longitude}`, "_blank")} className="bg-white border border-red-200 text-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-red-50 flex items-center gap-2 transition hover:-translate-y-0.5"><FaMapMarkerAlt /> Exit Location</button>)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Employees */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl">
              <FaUsers />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Managed Employees</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {activeEmployees.length}
              </h3>
            </div>
          </div>

          {/* Today Present */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-green-600 text-xl">
              <FaLaptopCode />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Present</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {todayPresent.length}
              </h3>
            </div>
          </div>

          {/* Today Absent */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[130px] transition-all hover:shadow-md">
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-red-600 text-xl">
              <FaFileAlt />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today Absent</p>
              <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                {todayAbsentCount}
              </h3>
            </div>
          </div>
        </div>

        {/* Charts & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Graph */}
          <div className="lg:col-span-2 bg-[#111C44] rounded-[24px] p-6 shadow-xl flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-white font-bold text-lg">
                  {viewMode === 'week' ? "Weekly Attendance" : "Monthly Attendance"}
                </h3>
                {!loadingGraph && weeklyChartData.length > 0 && (
                  <p className="text-[#39B8FF] text-[10px] font-bold uppercase tracking-wider mt-1">
                    Peak {viewMode === 'week' ? "Day" : "Date"}: {
                      weeklyChartData.reduce((prev, current) => (prev.Present >= current.Present) ? prev : current).name
                    }
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="bg-[#1B254B] text-white text-xs border-none rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>

                {viewMode === 'week' ? (
                  <div className="flex items-center gap-2 bg-[#1B254B] rounded-lg p-1">
                    <button
                      onClick={() => setCurrentWeek(currentWeek - 1)}
                      className="p-1.5 text-white hover:text-indigo-300"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    <span className="text-white text-[10px] min-w-[120px] text-center font-medium">
                      {formatWeekRange(weekDates.start, weekDates.end)}
                    </span>
                    <button
                      onClick={() => setCurrentWeek(currentWeek + 1)}
                      disabled={currentWeek >= 0}
                      className={`p-1.5 ${currentWeek >= 0 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:text-indigo-300'}`}
                    >
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                ) : (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                    className="bg-[#1B254B] text-white text-xs border-none rounded-lg px-3 py-1.5 outline-none"
                  />
                )}
              </div>
            </div>

            <div className="h-[250px] w-full">
              {loadingGraph ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">Loading Data...</div>
              ) : weeklyChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white opacity-50 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData}>
                    <defs>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#86DBFF" />
                        <stop offset="100%" stopColor="#E0F7FF" />
                      </linearGradient>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#AD6DFF" />
                        <stop offset="100%" stopColor="#7B2CFF" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#fff", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#fff", fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        background: "#111C44",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Present" fill="url(#pGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="Absent" fill="url(#aGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Department distribution */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <h3 className="text-slate-800 font-bold text-lg mb-4">
              Team Distribution
            </h3>
            <div className="flex justify-center h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {departmentData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 max-h-[100px] overflow-y-auto no-scrollbar">
              {departmentData.map((dept, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-gray-600 truncate">{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
      {showCropModal && imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropModal(false);
            setImageToCrop(null);
          }}
          isUploading={uploadingImage}
        />
      )}
    </div>
  );
};

export default SupportAdminDashboard;
