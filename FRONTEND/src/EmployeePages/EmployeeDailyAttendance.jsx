


// --- START OF FILE EmployeeDailyAttendance.jsx ---

import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";
import Swal from "sweetalert2";
import {
  getAttendanceForEmployee,
  getShiftByEmployeeId,
  getHolidays,
  getLeaveRequestsForEmployee,
  requestStatusCorrection,
  requestFullDay,
  requestCorrectionAdvanced,
  getPendingCorrections,
  getMyCorrections
} from "../api";
import Pagination from "../components/Pagination";

// --- Import Chart.js and React wrapper ---
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// --- Import Icons ---
import {
  FaRegClock,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUserClock,
  FaExclamationTriangle,
  FaStarHalfAlt,
  FaTimesCircle,
  FaFilter,
  FaFileDownload,
  FaListAlt,
  FaTimes,
  FaCheckCircle,
  FaEdit,
  FaHistory,
  FaSignInAlt,
  FaSignOutAlt,
  FaHourglassHalf,
  FaBullseye,
  FaCalendarAlt,
  FaChevronDown, // Added for scroll indicator
  FaArrowRight   // Added for modal button
} from "react-icons/fa";

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const ATTENDANCE_PAGE_SIZE = 7;

// Convert Date to YYYY-MM-DD for accurate comparison
const toISODateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAccountStartDate = (user) => {
  const currentExperience = Array.isArray(user?.experienceDetails)
    ? user.experienceDetails.find((exp) => exp.lastWorkingDate === "Present") || user.experienceDetails[0]
    : null;
  const rawDate = user?.createdAt || user?.joiningDate || currentExperience?.joiningDate;
  if (!rawDate) return null;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return "--";
  if (apiStatus === "LATE") return "LATE";

  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);

      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);

      if (punchDate > shiftDate) return "LATE";
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  return "ON_TIME";
};

// Helper to format milliseconds to 0h 0m 0s
const formatDuration = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const TableRowSkeleton = () => (
  <tr className="animate-pulse border-b border-gray-100">
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
  </tr>
);

// Summary Card Component
const SummaryCard = ({ title, count, icon, colorClass, bgClass }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow group">
    <div className="flex-1 min-w-0">
      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1 truncate">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{count}</h3>
      <p className="text-[10px] text-gray-400 mt-2 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">This month</p>
    </div>
    <div className={`p-3 rounded-xl ${bgClass} ${colorClass} text-xl flex-shrink-0 ml-3 shadow-inner`}>
      {icon}
    </div>
  </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

const EmployeeDailyAttendance = () => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(NotificationContext);
  const targetEmployeeId = user?.employeeId || user?.actualId || user?._id;

  // State
  const [attendance, setAttendance] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });
  const [currentPage, setCurrentPage] = useState(1);

  // Request Modals
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showCorrectionHistoryModal, setShowCorrectionHistoryModal] = useState(false);

  // Correction Submission Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({ date: "", punchIn: "", currentStatus: "" });
  const [requestedPunchOut, setRequestedPunchOut] = useState("");

  // ✅ NEW: Full Day Request Modal State
  const [showFullDayModal, setShowFullDayModal] = useState(false);
  const [fullDayData, setFullDayData] = useState({ date: "", currentStatus: "" });
  const [fullDayReason, setFullDayReason] = useState("");
  const [fullDaySubmitting, setFullDaySubmitting] = useState(false);
  const [showFullDayHistoryModal, setShowFullDayHistoryModal] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  // --- NEW: Advanced Correction Modal State ---
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedReqData, setAdvancedReqData] = useState({
    date: "",
    currentStatus: "",
    requestedStatus: "",
    currentPunchIn: "",
    currentPunchOut: "",
    requestedPunchIn: "10:00",
    requestedPunchOut: "19:00",
    reason: ""
  });
  const [myCorrections, setMyCorrections] = useState([]);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // --- NEW: Live Timer State ---
  const [liveTimer, setLiveTimer] = useState("0h 0m 0s");

  // --- NEW: Scroll Indicator State ---
  const tableContainerRef = useRef(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const accountStartDate = useMemo(() => getAccountStartDate(user), [user]);

  // --- Fetch Data ---
  const loadData = useCallback(async (empId) => {
    setLoading(true);
    try {
      const [attendanceRes, shiftRes, holidaysRes, leavesRes, correctionsRes] = await Promise.all([
        getAttendanceForEmployee(empId),
        getShiftByEmployeeId(empId).catch(() => null),
        getHolidays().catch(() => []),
        getLeaveRequestsForEmployee(empId).catch(() => []),
        getMyCorrections().catch(() => ({ data: [] }))
      ]);

      const attendanceData = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes.data || []);
      setAttendance(attendanceData);
      setShiftDetails(shiftRes);

      const hData = Array.isArray(holidaysRes) ? holidaysRes : (holidaysRes.data || []);
      setHolidays(hData);

      const lData = Array.isArray(leavesRes) ? leavesRes : (leavesRes.data || []);
      setLeaves(lData);

      setMyCorrections(correctionsRes.data || []);

    } catch (err) {
      console.error("Error loading data:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetEmployeeId) {
      loadData(targetEmployeeId);
    } else {
      setLoading(false);
    }
  }, [user, loadData, targetEmployeeId]);

  // ✅ Real-time refresh when Admin approves/rejects
  useEffect(() => {
    if (socket && targetEmployeeId) {
      const handleStatusUpdate = (data) => {
        console.log("⚡ Attendance Status Update received via Socket:", data);
        loadData(targetEmployeeId);

        // Optional: Show a subtle toast or notification
        if (data.status === "APPROVED") {
          Swal.fire({
            icon: 'success',
            title: 'Attendance Updated',
            text: `Your request for ${data.date} has been approved!`,
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
          });
        }
      };

      socket.on("fullDay:statusUpdate", handleStatusUpdate);
      socket.on("attendance:correctionUpdate", handleStatusUpdate);
      return () => {
        socket.off("fullDay:statusUpdate", handleStatusUpdate);
        socket.off("attendance:correctionUpdate", handleStatusUpdate);
      };
    }
  }, [socket, user, loadData]);

  // --- Extract Available Years ---
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (attendance.length === 0) return [currentYear];
    const years = new Set(attendance.map(a => new Date(a.date).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [attendance]);

  // --- Process Data for Calendar Table ---
  const processedCalendarData = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toISODateString(today);

    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0];

    return daysInMonth.map(dayDate => {
      const currentDateISO = toISODateString(dayDate);
      const isFuture = dayDate > today;
      const isBeforeAccountCreation = accountStartDate && dayDate < accountStartDate;
      const dayOfWeek = dayDate.getDay();

      const record = attendance.find(a => toISODateString(a.date) === currentDateISO);

      // Check Holiday
      const activeHoliday = holidays.find(h => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate || h.startDate);
        const hStartLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const hEndLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const currLocal = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        return currLocal >= hStartLocal && currLocal <= hEndLocal;
      });

      // Check Leave
      const activeLeave = leaves.find(l => {
        if (l.status !== 'Approved') return false;
        const start = new Date(l.from);
        const end = new Date(l.to);
        const lStartLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const lEndLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const currLocal = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        return currLocal >= lStartLocal && currLocal <= lEndLocal;
      });

      const isWeekOff = weeklyOffDays.includes(dayOfWeek);

      let finalStatus = "Absent";
      let loginStatus = "--";
      let displayTime = "00:00";
      let statusDetails = null;

      if (record && record.punchIn) {
        const end = record.punchOut ? new Date(record.punchOut) : new Date();
        const start = new Date(record.punchIn);
        const workedHours = (end - start) / (1000 * 60 * 60);

        if (workedHours >= adminFullDayHours) finalStatus = "Full Day";
        else if (workedHours >= adminHalfDayHours) finalStatus = "Half Day";
        else finalStatus = "Absent";

        // Override if record already has a specific status from DB (e.g. manually set by admin)
        if (record.workedStatus === "FULL_DAY") finalStatus = "Full Day";
        else if (record.workedStatus === "HALF_DAY") finalStatus = "Half Day";

        if (!record.punchOut && currentDateISO === todayISO) finalStatus = "Working";
        displayTime = record.displayTime || "00:00";
        loginStatus = calculateLoginStatus(record.punchIn, shiftDetails, record.loginStatus);
      } else {
        if (activeLeave) {
          finalStatus = "Leave";
          statusDetails = activeLeave.reason;
        } else if (activeHoliday) {
          finalStatus = "Holiday";
          statusDetails = activeHoliday.name;
        } else if (isWeekOff) {
          finalStatus = "Week Off";
        } else if (isFuture) {
          finalStatus = "Upcoming";
        } else {
          finalStatus = "Absent";
        }
      }

      return {
        date: dayDate.toISOString(),
        dayObj: dayDate,
        isBeforeAccountCreation,
        punchIn: record?.punchIn || null,
        punchOut: record?.punchOut || null,
        displayTime,
        status: record?.status || finalStatus.toUpperCase(),
        loginStatus,
        workedStatus: finalStatus,
        details: statusDetails,
        statusCorrectionRequest: record?.statusCorrectionRequest || { hasRequest: false },
        lateCorrectionRequest: record?.lateCorrectionRequest || { hasRequest: false },
        fullDayRequest: record?.fullDayRequest || { hasRequest: false }
      };
    });
  }, [selectedDate, attendance, shiftDetails, holidays, leaves, accountStartDate]);

  // --- Filter Logic ---
  const filteredData = useMemo(() => {
    let data = [...processedCalendarData];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    data = data.filter(item => {
      const d = new Date(item.date);
      return d <= today && item.workedStatus !== "Upcoming" && !item.isBeforeAccountCreation;
    });

    if (searchTerm) {
      data = data.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [processedCalendarData, searchTerm, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ATTENDANCE_PAGE_SIZE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ATTENDANCE_PAGE_SIZE;
    return filteredData.slice(start, start + ATTENDANCE_PAGE_SIZE);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchTerm, sortConfig]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // --- Calculate Yearly Stats for Graph ---
  const yearlyStats = useMemo(() => {
    const year = selectedDate.getFullYear();
    const statsPerMonth = Array(12).fill(null).map(() => ({
      present: 0,
      absent: 0,
      fullDay: 0,
      halfDay: 0,
      leave: 0,
      holidays: 0
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0];

    for (let m = 0; m < 12; m++) {
      const days = getDaysInMonth(year, m);
      days.forEach(dayDate => {
        if (dayDate > today) return;
        if (accountStartDate && dayDate < accountStartDate) return;
        const currentDateISO = toISODateString(dayDate);
        const dayOfWeek = dayDate.getDay();
        const record = attendance.find(a => toISODateString(a.date) === currentDateISO);

        const isHoliday = holidays.some(h => {
          const s = new Date(h.startDate); s.setHours(0, 0, 0, 0);
          const e = new Date(h.endDate || h.startDate); e.setHours(23, 59, 59, 999);
          return dayDate >= s && dayDate <= e;
        });
        const isLeave = leaves.some(l => {
          if (l.status !== 'Approved') return false;
          const s = new Date(l.from); s.setHours(0, 0, 0, 0);
          const e = new Date(l.to); e.setHours(23, 59, 59, 999);
          return dayDate >= s && dayDate <= e;
        });
        const isWeekOff = weeklyOffDays.includes(dayOfWeek);

        if (record && record.punchIn) {
          statsPerMonth[m].present++;
          const end = record.punchOut ? new Date(record.punchOut) : new Date();
          const start = new Date(record.punchIn);
          const workedHours = (end - start) / (1000 * 60 * 60);

          if (workedHours >= adminFullDayHours) statsPerMonth[m].fullDay++;
          else if (workedHours >= adminHalfDayHours) statsPerMonth[m].halfDay++;
        } else if (isLeave || (record && record.status === "LEAVE")) {
          statsPerMonth[m].leave++;
        } else {
          if (isHoliday) statsPerMonth[m].holidays++;
          else if (isWeekOff) { /* WeekOff */ }
          else statsPerMonth[m].absent++;
        }
      });
    }
    return statsPerMonth;
  }, [selectedDate, attendance, shiftDetails, holidays, leaves, accountStartDate]);

  // --- Summary Stats for the Cards & Donut ---
  const summaryStats = useMemo(() => {
    const m = selectedDate.getMonth();
    const stats = yearlyStats[m];
    const currentMonthData = processedCalendarData.filter(d => d.workedStatus !== "Upcoming" && !d.isBeforeAccountCreation);
    const weekOffs = currentMonthData.filter(d => d.workedStatus === "Week Off").length;
    const absentTotal = stats.absent + stats.leave;

    return {
      presentDays: stats.present,
      fullDays: stats.fullDay,
      halfDays: stats.halfDay,
      leaveDays: stats.leave,
      absentDays: absentTotal,
      holidayCount: stats.holidays,
      weekOffs: weekOffs,
      lateCount: processedCalendarData.filter(a => a.loginStatus === 'LATE' && a.workedStatus !== "Upcoming").length,
      onTimeCount: processedCalendarData.filter(a => a.loginStatus === 'ON_TIME' && a.workedStatus !== "Upcoming").length
    };
  }, [yearlyStats, selectedDate, processedCalendarData]);

  // --- Today's Specific Data ---
  const todayRecord = useMemo(() => {
    const todayISO = toISODateString(new Date());
    return processedCalendarData.find(d => toISODateString(d.date) === todayISO) || {
      punchIn: null,
      punchOut: null,
      displayTime: "00:00",
      loginStatus: "--"
    };
  }, [processedCalendarData]);

  // --- NEW: Live Timer Effect ---
  useEffect(() => {
    let interval;
    const updateTimer = () => {
      if (todayRecord.punchIn) {
        const start = new Date(todayRecord.punchIn);
        const end = todayRecord.punchOut ? new Date(todayRecord.punchOut) : new Date();
        setLiveTimer(formatDuration(end - start));
      } else {
        setLiveTimer("0h 0m 0s");
      }
    };

    updateTimer(); // Initial call
    if (todayRecord.punchIn && !todayRecord.punchOut) {
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [todayRecord]);

  // --- Chart Data Configuration ---
  const barGraphData = useMemo(() => {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Present',
          data: yearlyStats.map(s => s.present),
          backgroundColor: '#10b981', // Emerald 500
          borderRadius: 3,
          barThickness: 10,
        },
        {
          label: 'Absent',
          data: yearlyStats.map(s => s.absent + s.leave),
          backgroundColor: '#ef4444', // Red 500
          borderRadius: 3,
          barThickness: 10,
        }
      ]
    };
  }, [yearlyStats]);

  const donutData = {
    labels: ['Present', 'Absent', 'Late', 'Holidays/Off'],
    datasets: [
      {
        data: [
          summaryStats.presentDays,
          summaryStats.absentDays,
          summaryStats.lateCount,
          summaryStats.weekOffs + summaryStats.holidayCount
        ],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#cbd5e1'],
        borderWidth: 0,
        hoverOffset: 4
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          boxWidth: 10,      // 🔹 smaller color box
          boxHeight: 10,
          padding: 10,       // 🔹 space between items
          font: {
            size: 11,        // 🔥 REDUCE TEXT SIZE (default ~14)
            weight: "500"
          }
        }
      }
    }
  };


  // --- HISTORY LOGIC ---
  const lateRequestsHistory = useMemo(() => {
    const selectedMonth = selectedDate.getMonth();
    return attendance.filter(record => {
      const recordDate = new Date(record.date);
      return record.lateCorrectionRequest?.hasRequest &&
        recordDate.getMonth() === selectedMonth;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance, selectedDate]);

  const statusCorrectionHistory = useMemo(() => {
    return attendance.filter(record =>
      record.statusCorrectionRequest?.hasRequest
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance]);

  // ✅ NEW: Full Day Request History
  const fullDayRequestHistory = useMemo(() => {
    return attendance.filter(record =>
      record.fullDayRequest?.hasRequest
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance]);

  // --- NEW: Scroll Detection Logic ---
  const handleScroll = () => {
    if (tableContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
      // Show arrow if we are not at bottom and there is scrollable content
      setShowScrollArrow(scrollTop + clientHeight < scrollHeight - 10);
    }
  };

  useEffect(() => {
    handleScroll(); // check initially
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [filteredData]);


  // --- Handlers ---
  const handleYearChange = (e) => setSelectedDate(new Date(parseInt(e.target.value), selectedDate.getMonth()));
  const handleMonthChange = (e) => setSelectedDate(new Date(selectedDate.getFullYear(), parseInt(e.target.value)));

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-300" />;
    return sortConfig.direction === 'ascending' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  const openCorrectionModal = (record) => {
    setCorrectionData({
      date: toISODateString(record.date),
      punchIn: record.punchIn,
      currentStatus: record.workedStatus
    });
    setRequestedPunchOut("");
    setStatusReason("");
    setShowStatusModal(true);
  };

  // EmployeeDailyAttendance.jsx - Update submitStatusCorrection function

  // EmployeeDailyAttendance.jsx - Update this function only

  const submitStatusCorrection = async () => {
    if (!requestedPunchOut || !statusReason) {
      return Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please provide both time and reason.',
        confirmButtonColor: '#3b82f6'
      });
    }

    try {
      // Create a date string that preserves the local time
      // requestedPunchOut is in format "HH:MM" from the time input
      const [hours, minutes] = requestedPunchOut.split(':');

      // Create date in YYYY-MM-DD format from correctionData.date
      // Then append the time to create a local datetime string
      const localDateTimeStr = `${correctionData.date}T${hours}:${minutes}:00`;

      // Send as is - let the backend handle it as IST
      await requestStatusCorrection({
        employeeId: targetEmployeeId,
        date: correctionData.date,
        requestedPunchOut: localDateTimeStr, // Send full datetime string
        reason: statusReason
      });

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Request submitted successfully!',
        timer: 2000,
        showConfirmButton: false
      });
      setShowStatusModal(false);
      loadData(targetEmployeeId);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.response?.data?.message || "Failed to submit request",
        confirmButtonColor: '#ef4444'
      });
    }
  };

  // ✅ NEW: Open Full Day Request Modal
  const openFullDayModal = (record) => {
    setFullDayData({
      date: toISODateString(record.date),
      currentStatus: record.workedStatus
    });
    setFullDayReason("");
    setShowFullDayModal(true);
  };

  // ✅ NEW: Submit Full Day Request
  const submitFullDayRequest = async () => {
    if (!fullDayReason.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'Reason Required',
        text: 'Please provide a reason.',
        confirmButtonColor: '#10b981'
      });
    }
    setFullDaySubmitting(true);
    try {
      await requestFullDay({
        employeeId: targetEmployeeId,
        date: fullDayData.date,
        reason: fullDayReason
      });
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Full Day request submitted successfully!',
        timer: 2000,
        showConfirmButton: false
      });
      setShowFullDayModal(false);
      loadData(targetEmployeeId);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.response?.data?.message || "Failed to submit request.",
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setFullDaySubmitting(false);
    }
  };

  // ✅ NEW: Advanced Correction Request Handlers
  const openAdvancedCorrectionModal = (record) => {
    // Determine existing punch times if available
    const existingPunchIn = record.punchIn ? new Date(record.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "";
    const existingPunchOut = record.punchOut ? new Date(record.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "";

    setAdvancedReqData({
      date: toISODateString(record.date),
      currentStatus: record.workedStatus || "Absent",
      requestedStatus: record.workedStatus || "Full Day",
      currentPunchIn: existingPunchIn,
      currentPunchOut: existingPunchOut,
      requestedPunchIn: existingPunchIn || "10:00",
      requestedPunchOut: existingPunchOut || "19:00",
      reason: ""
    });
    setShowAdvancedModal(true);
  };

  const submitAdvancedCorrection = async () => {
    if (!advancedReqData.reason.trim()) {
      return Swal.fire({ icon: 'warning', title: 'Reason Required', text: 'Please explain why you are requesting this change.' });
    }

    setIsSubmittingCorrection(true);
    try {
      await requestCorrectionAdvanced({
        employeeId: targetEmployeeId,
        ...advancedReqData
      });

      Swal.fire({
        icon: 'success',
        title: 'Request Sent',
        text: 'Your attendance correction request has been submitted to Admin.',
        timer: 3000,
        showConfirmButton: false
      });
      setShowAdvancedModal(false);
      loadData(targetEmployeeId);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Request Failed',
        text: error.response?.data?.message || "Failed to submit correction request."
      });
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      return Swal.fire({
        icon: 'info',
        title: 'No Data',
        text: 'No data to export.',
        confirmButtonColor: '#1f2937'
      });
    }
    const monthName = barGraphData.labels[selectedDate.getMonth()];
    const fileName = `Attendance_${monthName}_${selectedDate.getFullYear()}_${user.name.replace(/\s+/g, '_')}.csv`;
    const headers = ["Date", "Day", "Punch In", "Punch Out", "Worked Hours", "Status", "Login Status", "Remarks"];
    const rows = filteredData.map(item => [
      toISODateString(item.date),
      new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
      item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--",
      item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--",
      item.displayTime,
      item.workedStatus,
      item.loginStatus,
      item.details || ""
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = fileName;
    link.click();
  };

  return (
    <div className="p-4 md:p-8  min-h-screen font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* --- Header Section --- */}
        <div className="flex flex-col bg-white rounded-3xl p-6 shadow-sm border border-gray-100 lg:flex-row lg:items-center justify-between gap-6 transition-all duration-300">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Have a Great Day, <span className="text-blue-600">{user?.name?.split(' ')[0] || "Employee"}</span>!
            </h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">
              Your attendance overview for <span className="text-gray-800 font-bold">{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <FaCalendarAlt className="text-blue-500 text-xs" />
              <select value={selectedDate.getMonth()} onChange={handleMonthChange} className="bg-transparent text-sm font-bold outline-none cursor-pointer hover:text-blue-600 grow text-center">
                {barGraphData.labels.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <FaRegClock className="text-blue-500 text-xs" />
              <select value={selectedDate.getFullYear()} onChange={handleYearChange} className="bg-transparent text-sm font-bold outline-none cursor-pointer hover:text-blue-600 grow text-center">
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* --- Top Summary Cards --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard title="Present" count={summaryStats.presentDays} icon={<FaCheckCircle />} colorClass="text-green-600" bgClass="bg-green-50" />
          <SummaryCard title="Full Days" count={summaryStats.fullDays} icon={<FaBullseye />} colorClass="text-pink-600" bgClass="bg-pink-50" />
          <SummaryCard title="Half Days" count={summaryStats.halfDays} icon={<FaStarHalfAlt />} colorClass="text-yellow-600" bgClass="bg-yellow-50" />
          <SummaryCard title="Absent" count={summaryStats.absentDays} icon={<FaTimesCircle />} colorClass="text-red-600" bgClass="bg-red-50" />
          <SummaryCard title="On Time" count={summaryStats.onTimeCount} icon={<FaUserClock />} colorClass="text-blue-600" bgClass="bg-blue-50" />
          <SummaryCard title="Late" count={summaryStats.lateCount} icon={<FaExclamationTriangle />} colorClass="text-orange-600" bgClass="bg-orange-50" />
        </div>

        {/* --- Middle Section: Today Status & Mini Calendar --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Today's Status (UPDATED UI & LIVE TIMER) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Today's Activity</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                Live Tracking
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Punch In */}
              <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center border border-transparent hover:border-green-100 hover:bg-green-50/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-lg mb-2 shadow-sm border border-green-100">
                  <FaSignInAlt />
                </div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Entry</p>
                <p className="text-base font-black text-gray-900 mt-0.5">
                  {todayRecord.punchIn ? new Date(todayRecord.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                </p>
              </div>

              {/* Punch Out */}
              <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center border border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg mb-2 shadow-sm border border-blue-100">
                  <FaSignOutAlt />
                </div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Exit</p>
                <p className="text-base font-black text-gray-900 mt-0.5">
                  {todayRecord.punchOut ? new Date(todayRecord.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "----"}
                </p>
              </div>

              {/* Working (Live Timer) */}
              <div className="bg-blue-600 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg mb-2 backdrop-blur-sm">
                  <FaHourglassHalf className={todayRecord.punchIn && !todayRecord.punchOut ? "animate-spin-slow" : ""} />
                </div>
                <p className="text-[8px] font-black text-blue-100 uppercase tracking-widest">Worked</p>
                <p className="text-base font-black text-white mt-0.5 font-mono">{liveTimer}</p>
              </div>

              {/* Target */}
              <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center border border-transparent hover:border-purple-100 hover:bg-purple-50/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg mb-2 shadow-sm border border-purple-100">
                  <FaBullseye />
                </div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Goal</p>
                <p className="text-base font-black text-gray-900 mt-0.5">
                  {shiftDetails?.fullDayHours || 9}h 00m
                </p>
              </div>
            </div>
          </div>

          {/* Right: Mini Calendar */}
          {/* Right: Mini Calendar */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</span>
              ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-7 gap-1 text-center flex-1">
              {(() => {
                const days = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
                const startDay = days[0].getDay();
                const slots = [];

                for (let i = 0; i < startDay; i++) slots.push(<div key={`empty-${i}`} className="h-8"></div>);

                days.forEach(d => {
                  const dISO = toISODateString(d);
                  const data = processedCalendarData.find(p => toISODateString(p.date) === dISO);
                  let bg = "hover:bg-gray-100 text-gray-600";

                  if (toISODateString(new Date()) === dISO) bg = "bg-blue-600 text-white shadow-md font-bold";
                  else if (data?.workedStatus === 'Full Day') bg = "bg-green-100 text-green-700 font-semibold";
                  else if (data?.workedStatus === 'Absent') bg = "bg-red-50 text-red-500";
                  else if (data?.workedStatus === 'Half Day') bg = "bg-yellow-50 text-yellow-600";

                  slots.push(
                    <div key={dISO} className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs cursor-default transition-colors ${bg}`}>
                      {d.getDate()}
                    </div>
                  );
                });

                return slots;
              })()}
            </div>

            {/* ✅ LEGEND (NOW PART OF CARD) */}
            <div className="mt-4 pt-3 border-t flex flex-wrap gap-3 text-[11px] text-gray-600 justify-center">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-600"></span> Today
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Full Day
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300"></span> Half Day
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-50 border border-red-300"></span> Absent
              </div>
            </div>
          </div>

        </div>

        {/* --- Charts Section --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Donut */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[300px]">
            <h3 className="text-gray-800 font-bold mb-6 flex items-center gap-2"><FaListAlt className="text-blue-500" /> Monthly Overview</h3>
            <div className="relative flex-1 flex flex-col items-center justify-center">
              <div className="w-full h-full max-h-56 relative">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                  <span className="text-3xl font-black text-gray-800">{getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth()).length}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Total Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Yearly Bar */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[300px] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-gray-800 font-bold flex items-center gap-2"><FaHistory className="text-emerald-500" /> Yearly Overview - {selectedDate.getFullYear()}</h3>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Absent</div>
              </div>
            </div>
            <div className="flex-1 w-full relative min-h-[200px]">
              <Bar
                data={barGraphData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                    y: { display: true, border: { display: false }, grid: { borderDash: [4, 4], color: '#f1f5f9' }, ticks: { stepSize: 5, font: { size: 10 } } }
                  },
                  plugins: { legend: { display: false } }
                }}
              />
            </div>
          </div>
        </div>

        {/* --- Attendance Records Section --- */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Section Header */}
          <div className="p-6 border-b border-gray-100 bg-white flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-xl tracking-tight">Attendance Records</h3>
                <p className="text-gray-400 text-xs mt-1 font-medium uppercase tracking-widest">
                  {selectedDate.toLocaleString('default', { month: 'long' })} {selectedDate.getFullYear()}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full transition-all focus:bg-white focus:shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 active:scale-95">
                  <FaFileDownload /> Export CSV
                </button>
              </div>
            </div>

            {/* Quick Filter / History Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowRequestsModal(true)}
                className="flex-1 min-w-[140px] px-4 py-2.5 text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 text-xs font-bold transition flex items-center justify-center gap-2 border border-orange-100"
              >
                <FaUserClock className="text-orange-400" /> Late History
              </button>
              <button
                onClick={() => setShowCorrectionHistoryModal(true)}
                className="flex-1 min-w-[140px] px-4 py-2.5 text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 text-xs font-bold transition flex items-center justify-center gap-2 border border-purple-100"
              >
                <FaHistory className="text-purple-400" /> Correction History
              </button>
              <button
                onClick={() => setShowFullDayHistoryModal(true)}
                className="flex-1 min-w-[140px] px-4 py-2.5 text-teal-600 bg-teal-50 rounded-xl hover:bg-teal-100 text-xs font-bold transition flex items-center justify-center gap-2 border border-teal-100"
              >
                <FaBullseye className="text-teal-400" /> Full Day History
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto custom-scrollbar border border-gray-100 rounded-2xl shadow-sm bg-white">
            <table className="min-w-[1100px] w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] border-b border-gray-100">
                  {['Date', 'Check In', 'Check Out', 'Worked', 'Attendance', 'Log', 'Type', 'Action', 'Edit'].map((h, i) => (
                    <th key={i} className="px-6 py-5 font-black cursor-pointer hover:text-blue-600 transition-colors whitespace-nowrap" onClick={() => requestSort(h.toLowerCase().replace(' ', ''))}>
                      <div className="flex items-center gap-1.5">{h} {getSortIcon(h.toLowerCase().replace(' ', ''))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((row) => {
                    const isWeekend = row.workedStatus === 'Week Off';
                    const isAbsent = row.workedStatus === 'Absent';
                    const correctionReq = myCorrections.find(c => c.date === toISODateString(row.date));
                    const isCorrectionPending = correctionReq?.requestStatus === 'pending';
                    const isCorrectionApproved = correctionReq?.requestStatus === 'approved';
                    const isCorrectionRejected = correctionReq?.requestStatus === 'rejected';

                    return (
                      <tr key={row.date} className="hover:bg-blue-50/20 transition-colors group border-b border-gray-50 last:border-0">
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-black text-gray-800 text-sm">{new Date(row.date).getDate()} {new Date(row.date).toLocaleString('default', { month: 'short' })}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-semibold text-gray-600 whitespace-nowrap">
                          {row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                        </td>
                        <td className="px-6 py-5 font-semibold text-gray-600 whitespace-nowrap">
                          {row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="font-black text-gray-900 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">{row.displayTime}</span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {row.workedStatus === "Working" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 animate-pulse">
                              <FaRegClock className="animate-spin-slow" /> Working
                            </span>
                          ) : row.workedStatus === "Full Day" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-600 border border-green-100">
                              <FaCheckCircle /> Full Day
                            </span>
                          ) : isAbsent ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
                              <FaTimesCircle /> Absent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-50 text-yellow-600 border border-yellow-100">{row.workedStatus}</span>
                          )}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {row.loginStatus === 'LATE' ? (
                            <span className="text-red-500 font-black text-[10px] uppercase tracking-widest bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">Late</span>
                          ) : row.punchIn ? (
                            <span className="text-green-500 font-black text-[10px] uppercase tracking-widest bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-100">On-Time</span>
                          ) : <span className="text-gray-300 font-bold">--</span>}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isWeekend ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
                            {isWeekend ? "Weekend" : "Week Day"}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {isCorrectionPending && <span className="text-[10px] text-orange-500 font-black uppercase bg-orange-50 px-3 py-1.5 rounded-full animate-pulse border border-orange-100">Pending</span>}
                          {isCorrectionApproved && <span className="text-[10px] text-green-600 font-black uppercase bg-green-50 px-3 py-1.5 rounded-full border border-green-100">Approved</span>}
                          {isCorrectionRejected && <span className="text-[10px] text-red-500 font-black uppercase bg-red-50 px-3 py-1.5 rounded-full border border-red-100">Rejected</span>}
                        </td>
                        <td className="px-6 py-5 text-center whitespace-nowrap">
                          {!isWeekend && !isCorrectionPending && !isCorrectionApproved && !row.isAdminCorrected && (
                            <button
                              onClick={() => openAdvancedCorrectionModal(row)}
                              className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-all mx-auto"
                              title="Request Correction"
                            >
                              <FaEdit size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="9" className="text-center py-20 text-gray-400 font-medium">No records found for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            <div className="flex flex-col gap-5 p-4 bg-gray-50/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-6 bg-white rounded-2xl animate-pulse space-y-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-10 bg-gray-100 rounded-xl"></div>
                      <div className="h-10 bg-gray-100 rounded-xl"></div>
                    </div>
                  </div>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((row) => {
                  const isWeekend = row.workedStatus === 'Week Off';
                  const isAbsent = row.workedStatus === 'Absent';
                  const correctionReq = myCorrections.find(c => c.date === toISODateString(row.date));
                  const isCorrectionPending = correctionReq?.requestStatus === 'pending';
                  const isCorrectionApproved = correctionReq?.requestStatus === 'approved';
                  const isCorrectionRejected = correctionReq?.requestStatus === 'rejected';

                  return (
                    <div key={row.date} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:border-blue-500 transition-all transform active:scale-[0.98]">
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex gap-4 items-center">
                          <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                            <span className="text-xl font-black leading-none">{new Date(row.date).getDate()}</span>
                            <span className="text-[9px] uppercase font-black mt-0.5">{new Date(row.date).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div>
                            <h4 className="font-black text-gray-800 text-base">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'long' })}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {row.loginStatus === 'LATE' ? (
                                <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100">Late Login</span>
                              ) : row.punchIn ? (
                                <span className="text-[8px] font-black uppercase text-green-500 bg-green-50 px-2 py-1 rounded-lg border border-green-100">On-Time</span>
                              ) : null}
                              <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${isWeekend ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                {isWeekend ? "Weekend" : "Working Day"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2.5">
                          <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 shadow-inner">
                            <span className="text-xs font-black text-gray-900">{row.displayTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCorrectionPending && <span className="text-[9px] font-black uppercase text-orange-500 bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-100 animate-pulse">Pending</span>}
                            {isCorrectionApproved && <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-100">Approved</span>}
                            {isCorrectionRejected && <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 px-2.5 py-1.5 rounded-xl border border-red-100">Rejected</span>}
                            {!isWeekend && !isCorrectionPending && !isCorrectionApproved && !row.isAdminCorrected && (
                              <button onClick={() => openAdvancedCorrectionModal(row)} className="text-blue-600 bg-blue-50 p-2.5 rounded-2xl border border-blue-100 shadow-sm active:scale-90 transition-transform">
                                <FaEdit size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1.5">Check In</p>
                          <p className="text-sm font-black text-gray-800 font-mono">{row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}</p>
                        </div>
                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1.5">Check Out</p>
                          <p className="text-sm font-black text-gray-800 font-mono">{row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        {row.workedStatus === "Working" ? (
                          <div className="w-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest py-3.5 rounded-2xl text-center shadow-lg shadow-blue-100 animate-pulse flex items-center justify-center gap-2">
                            <FaRegClock className="animate-spin-slow" /> Currently Working
                          </div>
                        ) : row.workedStatus === "Full Day" ? (
                          <div className="w-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest py-3.5 rounded-2xl text-center border border-green-100 flex items-center justify-center gap-2">
                            <FaCheckCircle /> Full Day Completed
                          </div>
                        ) : isAbsent ? (
                          <div className="w-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest py-3.5 rounded-2xl text-center border border-red-100 flex items-center justify-center gap-2">
                            <FaTimesCircle /> Marked Absent
                          </div>
                        ) : (
                          <div className="w-full bg-yellow-50 text-yellow-600 text-[10px] font-black uppercase tracking-widest py-3.5 rounded-2xl text-center border border-yellow-100">
                            {row.workedStatus} Status
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 font-black uppercase tracking-widest text-sm">No Records Found</div>
              )}
            </div>
          </div>

          {!loading && filteredData.length > 0 && (
            <Pagination
              totalItems={filteredData.length}
              itemsPerPage={ATTENDANCE_PAGE_SIZE}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              containerClass="flex flex-col gap-3 border-t border-gray-100 bg-white px-4 py-4 select-none sm:flex-row sm:items-center sm:justify-between"
            />
          )}
        </div>

        {/* --- MODALS (IMPROVED UI & DATA MAPPING) --- */}

        {/* Advanced Correction Modal */}
        {showAdvancedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 animate-fade-in-up overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <FaEdit /> Attendance Correction
                  </h3>
                  <p className="text-blue-100 text-xs mt-1">
                    Requesting change for {new Date(advancedReqData.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setShowAdvancedModal(false)} className="hover:bg-white/20 p-2 rounded-full transition">
                  <FaTimes />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Status Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Current Status</label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-semibold text-sm">
                      {advancedReqData.currentStatus}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Requested Status</label>
                    <select
                      value={advancedReqData.requestedStatus}
                      onChange={(e) => setAdvancedReqData({ ...advancedReqData, requestedStatus: e.target.value })}
                      className="w-full p-3 bg-white border border-blue-200 rounded-xl text-blue-600 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer"
                    >
                      <option value="Full Day">Full Day</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>

                {/* Time Selection */}
                {advancedReqData.requestedStatus !== 'Absent' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Requested Punch In</label>
                      <input
                        type="time"
                        value={advancedReqData.requestedPunchIn}
                        onChange={(e) => setAdvancedReqData({ ...advancedReqData, requestedPunchIn: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-medium text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Requested Punch Out</label>
                      <input
                        type="time"
                        value={advancedReqData.requestedPunchOut}
                        onChange={(e) => setAdvancedReqData({ ...advancedReqData, requestedPunchOut: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-medium text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      />
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Reason for Request</label>
                  <textarea
                    rows="3"
                    value={advancedReqData.reason}
                    onChange={(e) => setAdvancedReqData({ ...advancedReqData, reason: e.target.value })}
                    placeholder="E.g., Forget to punch in, Bio-metric error, Worked extra hours..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition resize-none"
                  ></textarea>
                </div>

                {/* Business Rule Warning */}
                <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex gap-3 items-start">
                  <FaExclamationTriangle className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-orange-700 leading-relaxed">
                    <strong>Note:</strong> Requests are subject to Admin approval. Ensure punch times meet office policy (9h for Full Day, 4.5h for Half Day).
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowAdvancedModal(false)}
                  className="flex-1 px-4 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAdvancedCorrection}
                  disabled={isSubmittingCorrection}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingCorrection ? "Sending..." : "Submit Request"} <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Late Request History */}
        {showRequestsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2"><FaUserClock /> Late Requests History</h3>
                <button onClick={() => setShowRequestsModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><FaTimes /></button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="overflow-y-auto p-0 flex-1 bg-gray-50 custom-scrollbar">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-5">Date</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Punch In</th>
                        <th className="px-6 py-5">Reason</th>
                        <th className="px-6 py-5">Admin Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {lateRequestsHistory.length > 0 ? (
                        lateRequestsHistory.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-5 font-black text-gray-700 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-6 py-5">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.lateCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                                row.lateCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                                }`}>{row.lateCorrectionRequest.status}</span>
                            </td>
                            <td className="px-6 py-5 font-mono text-xs font-bold whitespace-nowrap">{row.punchIn ? new Date(row.punchIn).toLocaleTimeString() : '--'}</td>
                            <td className="px-6 py-5 min-w-[200px] text-gray-500 text-xs leading-relaxed" title={row.lateCorrectionRequest.reason}>{row.lateCorrectionRequest.reason}</td>
                            <td className="px-6 py-5 italic text-gray-400 text-xs min-w-[150px]">{row.lateCorrectionRequest.adminComment || "--"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No late requests found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-4 space-y-4">
                  {lateRequestsHistory.length > 0 ? (
                    lateRequestsHistory.map((row, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Request Date</span>
                            <span className="text-sm font-black text-gray-800">{new Date(row.date).toLocaleDateString()}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.lateCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                            row.lateCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-yellow-50 text-yellow-600 border-yellow-200'
                            }`}>{row.lateCorrectionRequest.status}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tighter mb-1">Punch In</span>
                            <span className="text-xs font-bold text-gray-700 font-mono">{row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tighter mb-1">Type</span>
                            <span className="text-xs font-bold text-gray-700">Late Login</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</span>
                          <p className="text-xs text-gray-600 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">{row.lateCorrectionRequest.reason}</p>
                        </div>

                        {row.lateCorrectionRequest.adminComment && (
                          <div className="space-y-2 pt-2 border-t border-gray-50">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Admin Remark</span>
                            <p className="text-xs italic text-gray-500 bg-orange-50/50 p-3 rounded-xl border border-orange-100/50">{row.lateCorrectionRequest.adminComment}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No late requests found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Correction History */}
        {showCorrectionHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2"><FaHistory /> Attendance Correction Requests</h3>
                <button onClick={() => setShowCorrectionHistoryModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><FaTimes /></button>
              </div>

              <div className="overflow-y-auto p-0 flex-1 bg-gray-50 custom-scrollbar">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-5">Date</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Correction</th>
                        <th className="px-6 py-5">Reason</th>
                        <th className="px-6 py-5">Admin Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {statusCorrectionHistory.length > 0 ? (
                        statusCorrectionHistory.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-5 font-black text-gray-700 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-6 py-5">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.statusCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                                row.statusCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                                }`}>{row.statusCorrectionRequest.status}</span>
                            </td>
                            <td className="px-6 py-5 font-mono text-xs text-blue-600 font-black whitespace-nowrap">
                              {(() => {
                                const utcDate = new Date(row.statusCorrectionRequest.requestedPunchOut);
                                const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                                return istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              })()}
                            </td>
                            <td className="px-6 py-5 min-w-[200px] text-gray-500 text-xs leading-relaxed" title={row.statusCorrectionRequest.reason}>{row.statusCorrectionRequest.reason}</td>
                            <td className="px-6 py-5 italic text-gray-400 text-xs min-w-[150px]">{row.statusCorrectionRequest.adminComment || "--"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No correction history found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-4 space-y-4">
                  {statusCorrectionHistory.length > 0 ? (
                    statusCorrectionHistory.map((row, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Attendance Date</span>
                            <span className="text-sm font-black text-gray-800">{new Date(row.date).toLocaleDateString()}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.statusCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                            row.statusCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-yellow-50 text-yellow-600 border-yellow-200'
                            }`}>{row.statusCorrectionRequest.status}</span>
                        </div>

                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-600 uppercase">Requested Out</span>
                          <span className="text-sm font-black text-indigo-700 font-mono">
                            {(() => {
                              const utcDate = new Date(row.statusCorrectionRequest.requestedPunchOut);
                              const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                              return istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            })()}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason for Discrepancy</span>
                          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{row.statusCorrectionRequest.reason}</p>
                        </div>

                        {row.statusCorrectionRequest.adminComment && (
                          <div className="space-y-2 pt-2 border-t border-gray-50">
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Admin Response</span>
                            <p className="text-xs italic text-gray-500 bg-purple-50/50 p-3 rounded-xl border border-purple-100/50">{row.statusCorrectionRequest.adminComment}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No correction history found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Correction Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-down">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-800">Request Status Correction</h3>
                <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>

              <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                You are currently marked as <span className="font-bold text-red-500">{correctionData.currentStatus}</span> for <span className="font-bold text-gray-800">{new Date(correctionData.date).toLocaleDateString()}</span>.
                Please provide your correct punch-out time to request a Full Day.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correct Punch Out Time</label>
                  <input
                    type="time"
                    value={requestedPunchOut}
                    onChange={(e) => setRequestedPunchOut(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason</label>
                  <textarea
                    rows="3"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Explain discrepancy..."
                    className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition bg-gray-50 focus:bg-white"
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowStatusModal(false)} className="flex-1 px-4 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition">Cancel</button>
                <button onClick={submitStatusCorrection} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex justify-center items-center gap-2">Submit <FaArrowRight /></button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ NEW: Full Day Request Confirmation Modal */}
        {showFullDayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-down">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-800">Request Full Day</h3>
                <button onClick={() => setShowFullDayModal(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>

              <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                You are currently marked as <span className="font-bold text-yellow-600">{fullDayData.currentStatus}</span> for <span className="font-bold text-gray-800">{new Date(fullDayData.date).toLocaleDateString()}</span>.
                <br />Submit a request to upgrade this to <span className="font-bold text-green-600">Full Day</span>.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason for Full Day Request</label>
                  <textarea
                    rows="3"
                    value={fullDayReason}
                    onChange={(e) => setFullDayReason(e.target.value)}
                    placeholder="Explain why this should be marked as Full Day..."
                    className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none resize-none transition bg-gray-50 focus:bg-white"
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowFullDayModal(false)} className="flex-1 px-4 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition">Cancel</button>
                <button
                  onClick={submitFullDayRequest}
                  disabled={fullDaySubmitting}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {fullDaySubmitting ? "Submitting..." : "Submit Request"} <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ NEW: Full Day Request History Modal */}
        {showFullDayHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2"><FaStarHalfAlt /> Full Day Request History</h3>
                <button onClick={() => setShowFullDayHistoryModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><FaTimes /></button>
              </div>

              <div className="overflow-y-auto p-0 flex-1 bg-gray-50 custom-scrollbar">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-5">Date</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Submitted On</th>
                        <th className="px-6 py-5">Reason</th>
                        <th className="px-6 py-5">Admin Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {fullDayRequestHistory.length > 0 ? (
                        fullDayRequestHistory.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-5 font-black text-gray-700 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-6 py-5">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.fullDayRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                                row.fullDayRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                                }`}>{row.fullDayRequest.status}</span>
                            </td>
                            <td className="px-6 py-5 font-mono text-xs font-bold whitespace-nowrap">{row.fullDayRequest.requestedAt ? new Date(row.fullDayRequest.requestedAt).toLocaleString() : '--'}</td>
                            <td className="px-6 py-5 min-w-[200px] text-gray-500 text-xs leading-relaxed" title={row.fullDayRequest.reason}>{row.fullDayRequest.reason}</td>
                            <td className="px-6 py-5 italic text-gray-400 text-xs min-w-[150px]">{row.fullDayRequest.adminComment || "--"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No history found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden p-4 space-y-4">
                  {fullDayRequestHistory.length > 0 ? (
                    fullDayRequestHistory.map((row, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Attendance Date</span>
                            <span className="text-sm font-black text-gray-800">{new Date(row.date).toLocaleDateString()}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${row.fullDayRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                            row.fullDayRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-yellow-50 text-yellow-600 border-yellow-200'
                            }`}>{row.fullDayRequest.status}</span>
                        </div>

                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <span className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Submitted On</span>
                          <span className="text-xs font-bold text-emerald-700">{row.fullDayRequest.requestedAt ? new Date(row.fullDayRequest.requestedAt).toLocaleString() : '--'}</span>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</span>
                          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{row.fullDayRequest.reason}</p>
                        </div>

                        {row.fullDayRequest.adminComment && (
                          <div className="space-y-2 pt-2 border-t border-gray-50">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Admin Note</span>
                            <p className="text-xs italic text-gray-500 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">{row.fullDayRequest.adminComment}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-xs">No history found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmployeeDailyAttendance;
