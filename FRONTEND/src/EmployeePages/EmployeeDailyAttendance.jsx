import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { getAttendanceForEmployee } from "../api"; // Make sure this path is correct

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
  FaExclamationTriangle
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

// A skeleton component for a better loading state UI
const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
  </tr>
);

// The main component
const EmployeeDailyAttendance = () => {
  const { user } = useContext(AuthContext);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for dynamic UI features
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });

  // Data fetching function
  const loadAttendance = useCallback(async (empId) => {
    setLoading(true);
    try {
      const data = await getAttendanceForEmployee(empId);
      setAttendance(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to trigger data fetching
  useEffect(() => {
    if (user?.employeeId) {
      loadAttendance(user.employeeId);
    } else {
      setLoading(false);
    }
  }, [user, loadAttendance]);

  // Memoized calculation for available years
  const availableYears = useMemo(() => {
    if (attendance.length === 0) return [new Date().getFullYear()];
    const years = new Set(attendance.map(a => new Date(a.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [attendance]);
  
  // --- FIX: Centralized, case-insensitive logic to check for presence ---
  const isPresent = (record) => {
    if (!record || !record.status) return false;
    const status = record.status.toLowerCase();
    return status === 'completed' || status === 'working';
  };

  // Memoized data preparation for the bar graph
  const graphData = useMemo(() => {
    const monthlyCounts = Array(12).fill(0);
    attendance.forEach(a => {
      const recordDate = new Date(a.date);
      if (recordDate.getFullYear() === selectedDate.getFullYear() && isPresent(a)) {
        monthlyCounts[recordDate.getMonth()] += 1;
      }
    });

    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: `Present Days in ${selectedDate.getFullYear()}`,
        data: monthlyCounts,
        backgroundColor: monthlyCounts.map((_, index) =>
          index === selectedDate.getMonth() ? 'rgba(59, 130, 246, 1)' : 'rgba(165, 207, 255, 1)'
        ),
        borderColor: 'rgba(59, 130, 246, 0.2)',
        borderRadius: 5,
        borderWidth: 1,
        barThickness: 15,
      }]
    }
  }, [attendance, selectedDate]);

  // Memoized logic to filter and sort the attendance data for the table
  const monthlyFilteredAttendance = useMemo(() => {
    let dataForSelectedMonth = attendance.filter(item => {
      const recordDate = new Date(item.date);
      return recordDate.getFullYear() === selectedDate.getFullYear() &&
        recordDate.getMonth() === selectedDate.getMonth();
    });

    if (searchTerm) {
        dataForSelectedMonth = dataForSelectedMonth.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }

    if (sortConfig.key) {
      dataForSelectedMonth.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return dataForSelectedMonth;
  }, [attendance, selectedDate, searchTerm, sortConfig]);

  // --- FIX STARTS HERE: THIS LOGIC NOW PERFECTLY MIRRORS THE TABLE'S DISPLAY LOGIC ---
  const summaryStats = useMemo(() => {
    const data = monthlyFilteredAttendance;
    const totalDays = data.filter(isPresent).length;

    // A day is "Late" if the employee was present, punched in, AND the status is "LATE".
    const lateCount = data.filter(a =>
        isPresent(a) && a.punchIn && a.loginStatus === 'LATE'
    ).length;
    
    // A day is "On Time" if the employee was present, punched in, AND the status is NOT "LATE".
    // This correctly includes records where loginStatus might be null, undefined, or "On Time".
    const onTimeCount = data.filter(a =>
        isPresent(a) && a.punchIn && a.loginStatus !== 'LATE'
    ).length;

    return { totalDays, onTimeCount, lateCount };
  }, [monthlyFilteredAttendance]);
  // --- FIX ENDS HERE ---

  // Handlers for UI interactions
  const handleYearChange = (e) => setSelectedDate(new Date(parseInt(e.target.value), selectedDate.getMonth()));
  const handleMonthChange = (e) => setSelectedDate(new Date(selectedDate.getFullYear(), parseInt(e.target.value)));

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-400" />;
    return sortConfig.direction === 'ascending' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="flex-1 p-4 bg-white rounded-xl shadow-md flex items-center gap-4 transition-transform transform hover:scale-105">
      <div className={`p-3 rounded-full ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6 gap-3">
          <FaRegClock className="text-blue-600 text-3xl" />
          <h1 className="font-bold text-3xl text-gray-800">Your Attendance</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          <div className="lg:col-span-2 p-4 bg-white rounded-xl shadow-md flex flex-col justify-center">
            <h3 className="font-semibold text-lg mb-4 text-gray-800">Select Period</h3>
            <div className="space-y-4">
              <div>
                  <label htmlFor="year-select" className="block text-sm font-medium text-gray-600 mb-1">Year</label>
                  <select id="year-select" value={selectedDate.getFullYear()} onChange={handleYearChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="month-select" className="block text-sm font-medium text-gray-600 mb-1">Month</label>
                  <select id="month-select" value={selectedDate.getMonth()} onChange={handleMonthChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {graphData.labels.map((month, index) => <option key={index} value={index}>{month}</option>)}
                  </select>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-3 p-4 bg-white rounded-xl shadow-md">
            <h3 className="font-semibold text-lg mb-2 text-gray-800">Monthly Overview - {selectedDate.getFullYear()}</h3>
            <div className="relative h-64">
              <Bar
                  options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                  }}
                  data={graphData}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard icon={<FaCalendarCheck className="text-white"/>} title={`Present Days in ${graphData.labels[selectedDate.getMonth()]}`} value={summaryStats.totalDays} colorClass="bg-blue-500" />
            <StatCard icon={<FaUserClock className="text-white"/>} title="On Time Days" value={summaryStats.onTimeCount} colorClass="bg-green-500" />
            <StatCard icon={<FaExclamationTriangle className="text-white"/>} title="Late Days" value={summaryStats.lateCount} colorClass="bg-red-500" />
        </div>

        <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b border-gray-200">
                <div className="relative">
                    <FaSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder={`Search in records for ${graphData.labels[selectedDate.getMonth()]}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100/60">
                      <tr className="text-gray-600 uppercase">
                          {['date', 'in', 'out', 'worked', 'status', 'login Status'].map(header => (
                              <th key={header} className="px-4 py-3 text-left" onClick={() => requestSort(header.replace(' ', '').toLowerCase())}>
                                  <div className="flex items-center gap-2 cursor-pointer select-none">
                                      <span>{header}</span>
                                      {getSortIcon(header.replace(' ', '').toLowerCase())}
                                  </div>
                              </th>
                          ))}
                      </tr>
                  </thead>
                    <tbody>
                        {loading ? (
                           Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
                        ) : monthlyFilteredAttendance.length > 0 ? (
                           monthlyFilteredAttendance.map((a) => (
                               <tr key={a.date} className="text-gray-800 hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100 last:border-b-0">
                                   <td className="px-4 py-3 font-medium text-left whitespace-nowrap">{new Date(a.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                   <td className="px-4 py-3 text-left whitespace-nowrap">{a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-400">--</span>}</td>
                                   <td className="px-4 py-3 text-left whitespace-nowrap">{a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-400">--</span>}</td>
                                   <td className="px-4 py-3 font-mono text-left whitespace-nowrap">{a.displayTime || <span className="text-gray-400">00:00</span>}</td>
                                   <td className="px-4 py-3 text-left whitespace-nowrap">{a.status}</td>
                                   <td className="px-4 py-3 text-left whitespace-nowrap">
                                     {a.punchIn ? (
                                       <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                                         a.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                                       }`}>
                                         <span className={`h-2 w-2 rounded-full ${a.loginStatus === "LATE" ? "bg-red-500" : "bg-green-500"}`}></span>
                                         {a.loginStatus === "LATE" ? "Late" : "On Time"}
                                       </span>
                                     ) : <span className="text-gray-400">--</span>}
                                   </td>
                               </tr>
                           ))
                        ) : (
                            <tr><td colSpan="6" className="text-center py-16 text-gray-500">
                                <p className="font-semibold text-lg">No Records Found</p>
                                <p className="text-sm mt-1">No attendance data is available for the selected period.</p>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDailyAttendance;