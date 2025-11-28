// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaUsers, 
  FaClipboardList, 
  FaBuilding, 
  FaChevronLeft, 
  FaChevronRight, 
  FaSyncAlt 
} from "react-icons/fa";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import DepartmentPieChart from "../components/DepartmentPieChart";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import { getAttendanceByDateRange } from "../api";

const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  const [selectedDept, setSelectedDept] = useState("All");
  const [currentWeek, setCurrentWeek] = useState(0); // 0 = Current Week, -1 = Last Week, etc.
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  // --- 1. General Dashboard Stats (Cards) ---
  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  // --- 2. Calculate Week Range (Sunday to Saturday) ---
  const weekDates = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + currentWeek * 7);
    
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    
    // Calculate Sunday (Start of week)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    // Calculate Saturday (End of week)
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    // Helper to format YYYY-MM-DD in Local Time
    const formatDate = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 10);
      return localISOTime;
    };

    return {
      start: formatDate(sunday),
      end: formatDate(saturday),
      startDateObj: sunday,
      endDateObj: saturday
    };
  }, [currentWeek]);

  // --- 3. Fetch Accurate Attendance Data from API ---
  useEffect(() => {
    const fetchWeeklyData = async () => {
      setLoadingGraph(true);
      try {
        const data = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setWeeklyAttendanceData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching weekly attendance:", error);
        setWeeklyAttendanceData([]);
      } finally {
        setLoadingGraph(false);
      }
    };
    fetchWeeklyData();
  }, [weekDates]);

  // --- 4. Process Data for Graph (Stop at Today) ---
  const weeklyChartData = useMemo(() => {
    // A. Filter Active Employees by Selected Department
    const deptEmployees = activeEmployees.filter(e => 
      selectedDept === "All" || e.department === selectedDept
    );
    const totalActiveCount = deptEmployees.length;

    // Valid IDs for this department
    const validEmployeeIds = new Set(deptEmployees.map(e => e.employeeId));

    const data = [];
    const startObj = new Date(weekDates.startDateObj);
    
    // Use midnight comparison for "Today"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // B. Loop 7 days (Sunday to Saturday)
    for (let i = 0; i < 7; i++) {
      const loopDate = new Date(startObj);
      loopDate.setDate(startObj.getDate() + i);
      
      // Stop if future
      if (loopDate > today) break;

      // Current loop date string in Local Time (YYYY-MM-DD)
      const offset = loopDate.getTimezoneOffset() * 60000;
      const dateStr = new Date(loopDate.getTime() - offset).toISOString().slice(0, 10);
      
      const dayName = loopDate.toLocaleDateString('en-US', { weekday: 'short' }); 

      // C. Count Present
      const presentSet = new Set();
      
      weeklyAttendanceData.forEach(record => {
        // 1. Determine the record's date in LOCAL TIME
        // Prefer punchIn timestamp; fallback to date string
        const recordRawDate = record.punchIn ? new Date(record.punchIn) : new Date(record.date);
        
        // Convert record timestamp to Local YYYY-MM-DD string
        const rOffset = recordRawDate.getTimezoneOffset() * 60000;
        const recordLocalStr = new Date(recordRawDate.getTime() - rOffset).toISOString().slice(0, 10);

        // 2. Compare Local String AND Check if Employee is Valid
        // We include record.punchIn check to ensure they actually started a shift
        if (recordLocalStr === dateStr && record.punchIn && validEmployeeIds.has(record.employeeId)) {
          presentSet.add(record.employeeId);
        }
      });
      
      const presentCount = presentSet.size;

      // D. Count Absent
      let absentCount = totalActiveCount - presentCount;
      if (absentCount < 0) absentCount = 0;

      data.push({
        name: dayName,
        date: dateStr,
        "Present": presentCount,
        "Absent": absentCount
      });
    }

    return data;
  }, [weeklyAttendanceData, activeEmployees, selectedDept, weekDates]);
  
  // --- 5. Helpers ---
  const formatWeekRange = (start, end) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const isCurrentWeek = currentWeek >= 0; 

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition flex flex-col items-center" onClick={() => navigate("/employees")}>
          <FaUsers className="text-3xl text-blue-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Total Employees</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.totalEmployees}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition flex flex-col items-center" onClick={() => navigate("/admin/admin-Leavemanage", { state: { defaultStatus: "Pending" } })}>
          <FaClipboardList className="text-3xl text-purple-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Pending Leaves</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.pendingLeaves}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <FaBuilding className="text-3xl text-green-600 mb-2" />
          <h3 className="text-gray-600 font-semibold">Departments</h3>
          <p className="text-3xl font-extrabold text-gray-800">{statCards.totalDepartments}</p>
        </div>
      </div>

      {/* Week Navigation & Filters */}
      <div className="mt-8 bg-white p-4 rounded-xl shadow-lg flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentWeek(currentWeek - 1)} 
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow"
            title="Previous Week"
          >
            <FaChevronLeft />
          </button>
          
          <span className="font-semibold text-gray-700 w-64 text-center">
            {formatWeekRange(weekDates.start, weekDates.end)}
          </span>
          
          <button 
            onClick={() => setCurrentWeek(currentWeek + 1)} 
            className={`p-2 rounded-lg transition shadow text-white ${isCurrentWeek ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
            disabled={isCurrentWeek}
            title="Next Week"
          >
            <FaChevronRight />
          </button>
          
          {currentWeek !== 0 && (
            <button onClick={() => setCurrentWeek(0)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow" title="Go to Current Week">
              <FaSyncAlt />
            </button>
          )}
        </div>
        
        <div className="w-full lg:w-auto">
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="border border-gray-300 px-4 py-2 rounded-lg w-full lg:w-64 font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="All">All Departments</option>
              {departmentList.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
            </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        
        {/* Weekly Attendance Overview - Updated Graph */}
        <div className="col-span-1 xl:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-blue-700 font-bold text-lg mb-4">Weekly Attendance Overview</h3>
          <div className="w-full h-80">
            {loadingGraph ? (
               <div className="flex items-center justify-center h-full text-gray-400">Loading Chart...</div>
            ) : weeklyChartData.length === 0 ? (
               <div className="flex items-center justify-center h-full text-gray-400">No data available yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="Present" 
                    name="Present" 
                    fill="#22c55e" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20}
                  />
                  <Bar 
                    dataKey="Absent" 
                    name="Absent" 
                    fill="#ef4444" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-1 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-blue-700 font-bold text-lg mb-4">Employee Distribution</h3>
          <div className="w-full h-80">
            <DepartmentPieChart data={activeEmployees} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;