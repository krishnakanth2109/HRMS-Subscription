import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaUserClock,
  FaExclamationCircle,
  FaCheckCircle,
  FaCalendarAlt,
  FaChartLine,
  FaTimes,
  FaClock,
  FaChartPie 
} from "react-icons/fa";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement 
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

// Import from centralized API
import { getAllAttendanceRecords } from "../api"; 

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const IdleTimeTracking = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState(null);
  
  // Modal State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchIdleData = async () => {
    if(employees.length === 0) setLoading(true);
    
    try {
      // ✅ Uses api.js function (which handles sessionStorage token automatically)
      const responseData = await getAllAttendanceRecords();

      let allRecords = [];
      // Robust check for response structure
      if (responseData && Array.isArray(responseData.data)) {
        allRecords = responseData.data;
      } else if (Array.isArray(responseData)) {
        allRecords = responseData;
      } else if (responseData && responseData.success && Array.isArray(responseData.data)) {
        allRecords = responseData.data;
      }

      const now = new Date().getTime();

      const processedData = allRecords.map((record) => {
        const history = record.attendance || [];
        
        // Robust date matching
        const log = history.find((l) => {
            if (!l.date) return false;
            return l.date === selectedDate || l.date.split("T")[0] === selectedDate;
        });

        let totalIdleMs = 0;
        let isCurrentlyIdle = false;
        let status = "Not Logged In";
        let punchInTime = null;
        let punchOutTime = null;
        let idleSegments = [];

        if (log) {
          if (log.punchOut) status = "Completed";
          else if (log.punchIn) status = "Working";

          punchInTime = log.punchIn ? new Date(log.punchIn).getTime() : null;
          punchOutTime = log.punchOut ? new Date(log.punchOut).getTime() : null;

          if (log.idleActivity && log.idleActivity.length > 0) {
            log.idleActivity.forEach((item) => {
              const start = new Date(item.idleStart).getTime();
              let end = item.idleEnd ? new Date(item.idleEnd).getTime() : (punchOutTime || now);

              if (punchOutTime && end > punchOutTime) {
                 end = punchOutTime;
              }

              if (end > start) {
                totalIdleMs += (end - start);
                idleSegments.push({ start, end });
              }

              if (!item.idleEnd && !log.punchOut) {
                isCurrentlyIdle = true;
              }
            });
          }
        }

        let grossDurationMs = 0;
        if (punchInTime) {
          const endTime = punchOutTime || now;
          grossDurationMs = Math.max(0, endTime - punchInTime);
        }

        // NEW CALCULATION: Net Worked Time = Gross - Idle
        const netWorkedMs = Math.max(0, grossDurationMs - totalIdleMs);

        return {
          id: record.employeeId,
          name: record.employeeName,
          punchIn: log?.punchIn,
          punchOut: log?.punchOut,
          status,
          totalIdleMs,
          displayIdle: formatDuration(totalIdleMs),
          grossDurationMs,
          displayWork: formatDuration(grossDurationMs), // Gross
          netWorkedMs, 
          displayNetWork: formatDuration(netWorkedMs), // Display Net Time
          isCurrentlyIdle,
          idleSegments,
          date: selectedDate
        };
      });

      const sortedData = processedData.sort((a, b) => {
        const getScore = (s) => {
           if (s === "Working") return 3;
           if (s === "Completed") return 2;
           return 1;
        };
        return getScore(b.status) - getScore(a.status);
      });

      setEmployees(sortedData);
      setError(null);

    } catch (err) {
      console.error(err);
      if(employees.length === 0) setError("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdleData();
    const interval = setInterval(fetchIdleData, 5000); 
    return () => clearInterval(interval);
  }, [selectedDate]);

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return "0h 0m";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleView = (emp) => {
    setSelectedEmployee(emp);
    setIsModalOpen(true);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FaUserClock className="text-blue-600" /> Live Productivity Tracker
            </h1>
            <p className="text-slate-500 text-sm mt-1">Real-time monitoring of work hours & inactivity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
              <FaCalendarAlt className="text-slate-500 mr-2"/>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent outline-none text-slate-700 font-semibold text-sm"/>
            </div>
            <div className="relative flex-1 md:w-64">
              <FaSearch className="absolute left-3 top-3 text-slate-400 text-xs" />
              <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
            <button onClick={fetchIdleData} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
               <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Shift Times</th>
                <th className="px-6 py-4 text-center text-blue-600">Gross Hours</th>
                <th className="px-6 py-4 text-center text-orange-500">Total Idle</th>
                <th className="px-6 py-4 text-center">Live Status</th>
                <th className="px-6 py-4 text-center">View Graph</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredEmployees.length === 0 ? (
                <tr><td colSpan="7" className="p-10 text-center text-slate-400">Loading...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan="7" className="p-10 text-center text-slate-400">No records found.</td></tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">{emp.name.charAt(0)}</div>
                        <div><p className="font-bold text-slate-800">{emp.name}</p><p className="text-xs text-slate-400 font-mono">{emp.id}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-3 py-1 rounded-full text-xs font-bold border ${emp.status === 'Working' ? 'bg-green-50 border-green-200 text-green-700' : emp.status === 'Completed' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{emp.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs font-medium text-slate-500 flex flex-col gap-1">
                        <span className="text-green-600">In: {emp.punchIn ? new Date(emp.punchIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}</span>
                        <span className="text-red-500">Out: {emp.punchOut ? new Date(emp.punchOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-blue-600 text-base">{emp.displayWork}</td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-orange-500 text-base">{emp.displayIdle}</td>
                    <td className="px-6 py-4 text-center">
                      {emp.isCurrentlyIdle ? <div className="flex items-center justify-center gap-1 text-red-600 font-bold text-xs animate-pulse border border-red-100 bg-red-50 px-2 py-1 rounded"><FaExclamationCircle /> IDLE</div> : emp.status === 'Working' ? <div className="flex items-center justify-center gap-1 text-green-600 font-bold text-xs border border-green-100 bg-green-50 px-2 py-1 rounded"><FaCheckCircle /> Active</div> : <span className="text-slate-300 text-xs">-</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleView(emp)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition"><FaChartLine /> View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeGraphModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        employee={selectedEmployee} 
      />
    </div>
  );
};

// 📊 MODAL COMPONENT
const EmployeeGraphModal = ({ isOpen, onClose, employee }) => {
  // State to toggle between Graph and Pie Chart
  const [activeTab, setActiveTab] = useState('line'); 

  if (!isOpen || !employee) return null;

  // --- LINE CHART DATA ---
  const getLineChartData = () => {
    if (!employee.punchIn) return null;
    const startTime = new Date(employee.punchIn).getTime();
    const endTime = employee.punchOut ? new Date(employee.punchOut).getTime() : new Date().getTime();
    const labels = [];
    const dataPoints = [];
    let productivityScore = 0;
    
    for (let t = startTime; t <= endTime; t += 60000) {
      const timeStr = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isIdleAtThisTime = employee.idleSegments.some(seg => t >= seg.start && t <= seg.end);
      if (isIdleAtThisTime) productivityScore -= 1;
      else productivityScore += 1;
      labels.push(timeStr);
      dataPoints.push(productivityScore); 
    }
    return {
      labels,
      datasets: [{
        label: 'Productivity Flow',
        data: dataPoints,
        borderColor: '#2563EB',
        backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
            return gradient;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.1, 
        pointRadius: 0, 
        pointHoverRadius: 4,
      }]
    };
  };

  // --- PIE CHART DATA ---
  const getPieChartData = () => {
    // Convert MS to Minutes for better chart proportion
    const workedMinutes = Math.floor(employee.netWorkedMs / 60000);
    const idleMinutes = Math.floor(employee.totalIdleMs / 60000);

    return {
      labels: ['Actual Worked Time', 'Idle Time'],
      datasets: [{
        data: [workedMinutes, idleMinutes],
        backgroundColor: ['#10B981', '#F97316'], // Green (Worked), Orange (Idle)
        hoverBackgroundColor: ['#059669', '#EA580C'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  };

  const lineData = getLineChartData();
  const pieData = getPieChartData();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 text-blue-600 flex items-center justify-center font-bold text-xl shadow-sm">
              {employee.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{employee.name}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                <span className="flex items-center gap-1"><FaClock/> {employee.date}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{employee.status}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white hover:bg-red-50 hover:text-red-600 shadow-sm border border-slate-200 transition">
            <FaTimes size={18}/>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* 4 Stats Cards (Added Net Worked) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
               <p className="text-xs font-bold text-blue-500 uppercase">Gross Hours</p>
               <p className="text-2xl font-bold text-slate-800 mt-1">{employee.displayWork}</p>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
               <p className="text-xs font-bold text-orange-500 uppercase">Total Idle</p>
               <p className="text-2xl font-bold text-slate-800 mt-1">{employee.displayIdle}</p>
            </div>
            
            {/* Net Worked Card (Worked - Idle) */}
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
               <p className="text-xs font-bold text-green-600 uppercase">Net Worked</p>
               <p className="text-2xl font-bold text-slate-800 mt-1">{employee.displayNetWork}</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
               <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
               <div className="mt-1 font-bold text-slate-700 text-lg">
                 {employee.isCurrentlyIdle ? "Inactive" : employee.status}
               </div>
            </div>
          </div>

          {/* TABS for Navigation */}
          <div className="flex gap-2 mb-4 border-b border-slate-100 pb-1">
             <button 
               onClick={() => setActiveTab('line')}
               className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeTab === 'line' ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <FaChartLine className="inline mr-2"/> Timeline
             </button>
             <button 
               onClick={() => setActiveTab('pie')}
               className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeTab === 'pie' ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <FaChartPie className="inline mr-2"/> Distribution
             </button>
          </div>

          {/* Chart Area (Switches based on Tab) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative min-h-[350px] flex flex-col">
            
            {activeTab === 'line' ? (
              // LINE CHART VIEW
              <>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  Productivity Timeline
                </h3>
                <div className="h-64 w-full">
                  {lineData ? (
                    <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { grid: { borderDash: [4, 4] }, title: { display: true, text: 'Score' } } }, plugins: { legend: { display: false } } }} />
                  ) : <p className="text-center text-slate-400 mt-10">No Data</p>}
                </div>
              </>
            ) : (
              // PIE CHART VIEW
              <div className="flex flex-col md:flex-row items-center justify-center h-full gap-8">
                <div className="h-64 w-64">
                   <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
                <div className="space-y-2">
                   <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-bold text-slate-700">Actual Worked: {employee.displayNetWork}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                      <span className="text-sm font-bold text-slate-700">Idle Time: {employee.displayIdle}</span>
                   </div>
                </div>
              </div>
            )}

            {/* CALCULATION FOOTER */}
            <div className="mt-auto pt-4 border-t border-slate-100 text-center text-sm text-slate-500 font-mono bg-slate-50 p-2 rounded-lg">
               <span className="font-bold text-blue-600">{employee.displayWork} (Gross)</span> 
               <span className="mx-2">-</span> 
               <span className="font-bold text-orange-500">{employee.displayIdle} (Idle)</span> 
               <span className="mx-2">=</span> 
               <span className="font-bold text-green-600">{employee.displayNetWork} (Net Worked)</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default IdleTimeTracking;