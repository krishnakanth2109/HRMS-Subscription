// --- START OF FILE EmployeeDailyAttendance.jsx ---

import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { 
  getAttendanceForEmployee, 
  getShiftByEmployeeId, 
  getHolidays, 
  getLeaveRequestsForEmployee 
} from "../api";

// --- Import Chart.js and React wrapper ---
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
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
  FaCalendarCheck,
  FaUserClock,
  FaExclamationTriangle,
  FaBusinessTime,
  FaStarHalfAlt,
  FaTimesCircle,
  FaFilter,
  FaCouch,        
  FaUmbrellaBeach,
  FaFileDownload,
  FaBriefcase,
  FaListAlt, // Added for the Requests button
  FaTimes, // Added for closing modal
  FaCheckCircle // Added for Present icon
} from "react-icons/fa";

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ==========================================
// HELPER FUNCTIONS & SUB-COMPONENTS
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

// Convert Date to YYYY-MM-DD for accurate comparison
const toISODateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
  </tr>
);

// Defined outside main component to avoid scope issues
const StatCard = ({ icon, title, value, colorClass }) => (
  <div className="flex-1 p-4 bg-white rounded-xl shadow-md flex items-center gap-4 transition-transform transform hover:scale-105 border border-gray-100">
    <div className={`p-3 rounded-full ${colorClass}`}>{icon}</div>
    <div>
      <p className="text-xs text-gray-500 font-bold uppercase">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const BreakdownItem = ({ icon, title, value, color, bg }) => (
  <div className={`flex flex-col items-start p-4 rounded-xl ${bg} border border-transparent hover:border-${color}-200 transition-all duration-200`}>
    <div className={`text-2xl mb-2 ${color}`}>{icon}</div>
    <p className="text-3xl font-bold text-gray-800 mb-1">{value}</p>
    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">{title}</p>
  </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

const EmployeeDailyAttendance = () => {
  const { user } = useContext(AuthContext);
  
  // State
  const [attendance, setAttendance] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);
  const [holidays, setHolidays] = useState([]); 
  const [leaves, setLeaves] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });
  
  // ✅ New State for Requests Modal
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  // --- Fetch Data ---
  const loadData = useCallback(async (empId) => {
    setLoading(true);
    try {
      const [attendanceRes, shiftRes, holidaysRes, leavesRes] = await Promise.all([
        getAttendanceForEmployee(empId),
        getShiftByEmployeeId(empId).catch(err => {
            console.warn("Failed to fetch shift, using defaults");
            return null;
        }),
        getHolidays().catch(err => []),
        getLeaveRequestsForEmployee(empId).catch(err => [])
      ]);

      const attendanceData = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes.data || []);
      setAttendance(attendanceData);
      setShiftDetails(shiftRes);
      
      const hData = Array.isArray(holidaysRes) ? holidaysRes : (holidaysRes.data || []);
      setHolidays(hData);

      const lData = Array.isArray(leavesRes) ? leavesRes : (leavesRes.data || []);
      setLeaves(lData);

    } catch (err) {
      console.error("Error loading data:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.employeeId) {
      loadData(user.employeeId);
    } else {
      setLoading(false);
    }
  }, [user, loadData]);

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
    today.setHours(0,0,0,0);
    const todayISO = toISODateString(today);

    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0]; 

    return daysInMonth.map(dayDate => {
      const currentDateISO = toISODateString(dayDate);
      const isFuture = dayDate > today;
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
        if(l.status !== 'Approved') return false;
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
      let statusDetails = null; // To store Holiday Name or Leave Reason

      if (record && record.punchIn) {
        const end = record.punchOut ? new Date(record.punchOut) : new Date();
        const start = new Date(record.punchIn);
        const workedHours = (end - start) / (1000 * 60 * 60);

        if (workedHours >= adminFullDayHours) finalStatus = "Full Day";
        else if (workedHours >= adminHalfDayHours) finalStatus = "Half Day";
        else finalStatus = "Absent"; 

        if (!record.punchOut && currentDateISO === todayISO) finalStatus = "Working..";
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
        punchIn: record?.punchIn || null,
        punchOut: record?.punchOut || null,
        displayTime,
        status: record?.status || finalStatus.toUpperCase(),
        loginStatus,
        workedStatus: finalStatus,
        details: statusDetails
      };
    });
  }, [selectedDate, attendance, shiftDetails, holidays, leaves]);

  // --- Filter Logic ---
  const filteredData = useMemo(() => {
    let data = [...processedCalendarData];
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    data = data.filter(item => {
        const d = new Date(item.date);
        return d <= today && item.workedStatus !== "Upcoming";
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
    today.setHours(0,0,0,0);

    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0];

    for (let m = 0; m < 12; m++) {
        const days = getDaysInMonth(year, m);
        
        days.forEach(dayDate => {
            if (dayDate > today) return; 

            const currentDateISO = toISODateString(dayDate);
            const dayOfWeek = dayDate.getDay();
            const record = attendance.find(a => toISODateString(a.date) === currentDateISO);
            
            const isHoliday = holidays.some(h => {
                const s = new Date(h.startDate); s.setHours(0,0,0,0);
                const e = new Date(h.endDate || h.startDate); e.setHours(23,59,59,999);
                return dayDate >= s && dayDate <= e;
            });

            const isLeave = leaves.some(l => {
                if(l.status !== 'Approved') return false;
                const s = new Date(l.from); s.setHours(0,0,0,0);
                const e = new Date(l.to); e.setHours(23,59,59,999);
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

  }, [selectedDate, attendance, shiftDetails, holidays, leaves]);

  // --- Chart Data Configuration ---
  const graphData = useMemo(() => {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Present',
          data: yearlyStats.map(s => s.present),
          backgroundColor: '#22c55e', 
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        },
        {
          label: 'Absent',
          // Leaves included in Absent for graph
          data: yearlyStats.map(s => s.absent + s.leave),
          backgroundColor: '#ef4444', 
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }
      ]
    };
  }, [yearlyStats]);

  const graphOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end' },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        callbacks: {
          label: function(context) {
             return `${context.dataset.label}: ${context.raw}`;
          },
          afterBody: function(tooltipItems) {
             const index = tooltipItems[0].dataIndex;
             const stats = yearlyStats[index];
             return [
                 '', 
                 `✅ Full Days: ${stats.fullDay}`,
                 `🌗 Half Days: ${stats.halfDay}`,
                 `🏖️ Holidays: ${stats.holidays}`,
                 `📄 Leaves:   ${stats.leave}`,
                 `❌ Absent:   ${stats.absent}`
             ];
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [3, 4] }, border: { display: false } },
      x: { grid: { display: false }, border: { display: false } }
    }
  };

  // --- Summary Stats ---
  const summaryStats = useMemo(() => {
    const m = selectedDate.getMonth();
    const stats = yearlyStats[m];
    
    // Filter out future dates to get "from 1st of month to Today"
    const currentMonthData = processedCalendarData.filter(d => d.workedStatus !== "Upcoming");
    
    const weekOffs = currentMonthData.filter(d => d.workedStatus === "Week Off").length;
    const holidaysCount = currentMonthData.filter(d => d.workedStatus === "Holiday").length;
    
    // UPDATED: Working Days Logic
    const workingDays = Math.max(0, currentMonthData.length - weekOffs - holidaysCount);

    // Consolidated Absent Count (Regular Absent + Leaves)
    const absentTotal = stats.absent + stats.leave;

    return {
        presentDays: stats.present,
        fullDays: stats.fullDay,
        halfDays: stats.halfDay,
        leaveDays: stats.leave,
        absentDays: absentTotal,
        holidayCount: stats.holidays,
        weekOffs: weekOffs,
        workingDays: workingDays,
        lateCount: processedCalendarData.filter(a => a.loginStatus === 'LATE' && a.workedStatus !== "Upcoming").length,
        onTimeCount: processedCalendarData.filter(a => a.loginStatus === 'ON_TIME' && a.workedStatus !== "Upcoming").length
    };
  }, [yearlyStats, selectedDate, processedCalendarData]);

  // --- Dynamic Heading Logic ---
  const getBreakdownTitle = () => {
    const today = new Date();
    const isCurrent = selectedDate.getMonth() === today.getMonth() && 
                      selectedDate.getFullYear() === today.getFullYear();
    
    if (isCurrent) return "Monthly Breakdown As Per Today";
    
    const monthName = selectedDate.toLocaleString('default', { month: 'long' });
    return `Monthly Breakdown of ${monthName} ${selectedDate.getFullYear()}`;
  };

  // ✅ MEMOIZED: Get Late Requests for Selected Period
  const lateRequestsHistory = useMemo(() => {
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();

    return attendance.filter(record => {
        const recordDate = new Date(record.date);
        return record.lateCorrectionRequest?.hasRequest && 
               recordDate.getMonth() === selectedMonth && 
               recordDate.getFullYear() === selectedYear;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance, selectedDate]);

  // --- Event Handlers (Defined BEFORE they are used in JSX) ---
  
  const handleYearChange = (e) => {
    setSelectedDate(new Date(parseInt(e.target.value), selectedDate.getMonth()));
  };

  const handleMonthChange = (e) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), parseInt(e.target.value)));
  };

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-400" />;
    return sortConfig.direction === 'ascending' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  // --- Export Function ---
  const handleExport = () => {
    if (filteredData.length === 0) {
        alert("No data to export.");
        return;
    }

    const monthName = graphData.labels[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    const empName = user.name.replace(/\s+/g, '_');
    const fileName = `Attendance_${monthName}_${year}_${empName}.csv`;

    const headers = ["Date", "Day", "Punch In", "Punch Out", "Worked Hours", "Status", "Login Status", "Remarks"];
    
    const rows = filteredData.map(item => {
        const dateObj = new Date(item.date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yearStr = dateObj.getFullYear();
        const dateStr = `${day}-${month}-${yearStr}`;

        const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        
        const punchIn = item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--";
        const punchOut = item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--";
        const remarks = item.details ? item.details.replace(/,/g, ' ').replace(/\n/g, ' ') : "";
        
        return [
            dateStr,
            dayStr,
            punchIn,
            punchOut,
            item.displayTime,
            item.workedStatus,
            item.loginStatus,
            remarks
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6 gap-3">
          <FaRegClock className="text-blue-600 text-3xl" />
          <h1 className="font-bold text-3xl text-gray-800">Your Attendance History</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaFilter />
            <span>Filter by Period</span>
          </div>
          <div className="w-full md:w-auto">
            <select value={selectedDate.getFullYear()} onChange={handleYearChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="w-full md:w-auto">
            <select value={selectedDate.getMonth()} onChange={handleMonthChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              {graphData.labels.map((month, index) => <option key={index} value={index}>{month}</option>)}
            </select>
          </div>
          
          <div className="flex-grow md:text-right flex justify-end gap-3">
             {/* ✅ Added View Requests Button */}
             <button 
                onClick={() => setShowRequestsModal(true)}
                className="inline-flex items-center gap-2 bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors"
             >
                <FaListAlt /> Late Requests History
             </button>

             <button 
                onClick={handleExport}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors"
             >
                <FaFileDownload /> Export CSV
             </button>
          </div>
        </div>

        {/* Stats & Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          
          {/* Summary Column - UPDATED DYNAMIC TITLE & CONTENT */}
          <div className="lg:col-span-2 p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">
              {getBreakdownTitle()}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              
              {/* Full Days (Kept) */}
              <BreakdownItem 
                icon={<FaBusinessTime />} 
                title="Full Days" 
                value={summaryStats.fullDays} 
                color="text-green-600" 
                bg="bg-green-50" 
              />
              
              {/* Half Days (Kept) */}
              <BreakdownItem 
                icon={<FaStarHalfAlt />} 
                title="Half Days" 
                value={summaryStats.halfDays} 
                color="text-yellow-600" 
                bg="bg-yellow-50" 
              />

              {/* Present (New - replaced Working Days) */}
               <BreakdownItem 
                icon={<FaCheckCircle />} 
                title="Present" 
                value={summaryStats.presentDays} 
                color="text-blue-600" 
                bg="bg-blue-50" 
              />
              
              {/* On Time (New - replaced Leaves) */}
              <BreakdownItem 
                icon={<FaUserClock />} 
                title="On Time" 
                value={summaryStats.onTimeCount} 
                color="text-teal-600" 
                bg="bg-teal-50" 
              />

              {/* Late Login (New - replaced Holidays) */}
              <BreakdownItem 
                icon={<FaExclamationTriangle />} 
                title="Late Login" 
                value={summaryStats.lateCount} 
                color="text-red-600" 
                bg="bg-red-50" 
              />
              
              {/* Absent (Consolidated: Leave + Absent) */}
              <BreakdownItem 
                icon={<FaTimesCircle />} 
                title="Absent" 
                value={summaryStats.absentDays} 
                color="text-rose-700" 
                bg="bg-rose-50" 
              />

            </div>
          </div>

          {/* Graph Column */}
          <div className="lg:col-span-3 p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-lg mb-2 text-gray-800">Yearly Overview - {selectedDate.getFullYear()}</h3>
            <div className="relative h-64">
              <Bar options={graphOptions} data={graphData} />
            </div>
          </div>
        </div>



        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <FaSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder={`Search records...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600 uppercase border-b border-gray-200">
                  {['date', 'in', 'out', 'worked', 'status', 'login Status', 'worked status'].map(header => (
                    <th key={header} className="px-4 py-3 text-left font-semibold" onClick={() => requestSort(header.replace(/\s+/g, '').toLowerCase())}>
                      <div className="flex items-center gap-2 cursor-pointer select-none hover:text-blue-600 transition-colors">
                        <span>{header}</span>
                        {getSortIcon(header.replace(/\s+/g, '').toLowerCase())}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
                ) : filteredData.length > 0 ? (
                  filteredData.map((a) => {
                    const isAbsent = a.workedStatus === 'Absent';
                    const isLeave = a.workedStatus === 'Leave';
                    const isHoliday = a.workedStatus === 'Holiday';
                    const isWeekOff = a.workedStatus === 'Week Off';
                    const isHalfDay = a.workedStatus === 'Half Day';

                    let rowClass = "hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100 last:border-b-0 ";
                    if (isAbsent) rowClass += "bg-red-50/30";
                    else if (isLeave) rowClass += "bg-orange-50/30";
                    else if (isHalfDay) rowClass += "bg-yellow-50/30";
                    else if (isWeekOff) rowClass += "bg-gray-50/60 text-gray-500";
                    else if (isHoliday) rowClass += "bg-purple-50/30";

                    return (
                      <tr key={a.date} className={rowClass}>
                        <td className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{new Date(a.date).toLocaleDateString('en-GB')}</span>
                            <span className="text-xs text-gray-400 font-normal">{new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-3 text-left whitespace-nowrap text-green-600 font-medium">
                           {a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-300">--:--</span>}
                        </td>
                        
                        <td className="px-4 py-3 text-left whitespace-nowrap text-red-600 font-medium">
                           {a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-300">--:--</span>}
                        </td>
                        
                        <td className="px-4 py-3 font-mono text-left whitespace-nowrap text-gray-700">
                           {a.punchIn ? a.displayTime : <span className="text-gray-300">00:00</span>}
                        </td>
                        
                        <td className="px-4 py-3 text-left whitespace-nowrap text-xs font-bold">
                            {a.details ? 
                                <span className="text-gray-700 truncate max-w-[150px] inline-block" title={a.details}>{a.details}</span> 
                                : a.status
                            }
                        </td>
                        
                        <td className="px-4 py-3 text-left whitespace-nowrap">
                          {a.punchIn ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1 border ${a.loginStatus === "LATE" ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"}`}>
                              {a.loginStatus === "LATE" ? "Late" : "On Time"}
                            </span>
                          ) : <span className="text-gray-300">--</span>}
                        </td>

                        <td className="px-4 py-3 capitalize text-left whitespace-nowrap font-medium">
                          {(() => {
                            if (isAbsent) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600"><FaTimesCircle/> Absent</span>;
                            if (isWeekOff) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600"><FaCouch/> Week Off</span>;
                            if (isHoliday) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-600"><FaUmbrellaBeach/> Holiday</span>;
                            if (isLeave) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-600">On Leave</span>;
                            if (isHalfDay) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><FaStarHalfAlt/> Half Day</span>;
                            if (a.workedStatus === "Full Day") return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Full Day</span>;
                            return <span className="text-gray-500 text-xs">{a.workedStatus}</span>;
                          })()}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan="7" className="text-center py-16 text-gray-500">
                    <p className="font-semibold text-lg">No Records Found</p>
                    <p className="text-sm mt-1">No attendance data is available for the selected period.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ LATE REQUESTS MODAL */}
        {showRequestsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-down flex flex-col max-h-[80vh]">
                    <div className="bg-orange-600 px-6 py-4 flex justify-between items-center text-white">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><FaUserClock /> Late Requests History</h3>
                            <p className="text-xs text-orange-100 opacity-90 mt-1">Showing requests for {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                        </div>
                        <button onClick={() => setShowRequestsModal(false)} className="hover:bg-orange-700 p-2 rounded-full transition"><FaTimes /></button>
                    </div>
                    
                    <div className="p-0 overflow-auto flex-1">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                                <tr className="text-gray-600 uppercase">
                                    <th className="px-6 py-3 font-semibold">Date</th>
                                    <th className="px-6 py-3 font-semibold">Status</th>
                                    <th className="px-6 py-3 font-semibold">Punch In</th>
                                    <th className="px-6 py-3 font-semibold">Requested Time</th>
                                    <th className="px-6 py-3 font-semibold">Reason</th>
                                    <th className="px-6 py-3 font-semibold">Admin Comment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lateRequestsHistory.length > 0 ? (
                                    lateRequestsHistory.map((req, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-800">
                                                {new Date(req.date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                    req.lateCorrectionRequest.status === "APPROVED" ? "bg-green-100 text-green-700 border-green-200" :
                                                    req.lateCorrectionRequest.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                                                    "bg-yellow-100 text-yellow-700 border-yellow-200"
                                                }`}>
                                                    {req.lateCorrectionRequest.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {req.punchIn ? new Date(req.punchIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "--:--"}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-blue-600 font-bold">
                                                {new Date(req.lateCorrectionRequest.requestedTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={req.lateCorrectionRequest.reason}>
                                                {req.lateCorrectionRequest.reason}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 italic">
                                                {req.lateCorrectionRequest.adminComment || "--"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-gray-400">
                                            No late correction requests found for this month.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default EmployeeDailyAttendance;