import React, { useContext, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AttendanceContext } from "../context/AttendanceContext";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Helper UI Components ---
const StatCard = ({ title, value, colorClass }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex flex-col justify-center items-center text-center">
    <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    <p className="text-xs font-medium text-gray-600 mt-1">{title}</p>
  </div>
);

// --- Main Component ---
const EmployeeAttendanceProfile = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  // 1. GET DATA & FUNCTIONS FROM THE REFACTORED ATTENDANCE CONTEXT
  const { getEmployeeAttendanceProfile, getAvailableMonthsForEmployee } = useContext(AttendanceContext);

  // 2. MANAGE UI-ONLY STATE
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showSandwichModal, setShowSandwichModal] = useState(false);

  // 3. FETCH & PROCESS DATA IN ONE GO (FROM THE SIMULATED BACKEND)
  const profileData = useMemo(() => {
    return getEmployeeAttendanceProfile(employeeId, selectedMonth);
  }, [employeeId, selectedMonth, getEmployeeAttendanceProfile]);

  const availableMonths = useMemo(() => {
    return getAvailableMonthsForEmployee(employeeId);
  }, [employeeId, getAvailableMonthsForEmployee]);
  
  // 4. DERIVE CHART DATA FROM THE FETCHED DATA
  const attendanceChartData = {
    labels: ["Full Day", "Half Day", "Absent", "On Leave", "Holiday"],
    datasets: [{
      label: "Days",
      data: [
        profileData?.monthlySummary?.present_days || 0,
        profileData?.monthlySummary?.half_days || 0,
        profileData?.monthlySummary?.absent_days || 0,
        profileData?.monthlySummary?.on_leave_days || 0,
        profileData?.monthlySummary?.holiday_days || 0,
      ],
      backgroundColor: ["#34d399", "#facc15", "#f87171", "#fbbf24", "#a78bfa"],
      borderRadius: 5,
    }],
  };
  
  const attendanceChartOptions = {
    responsive: true,
    plugins: { legend: { display: false }, title: { display: true, text: "Monthly Attendance Summary", font: { size: 16 } } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };
  
  // --- RENDER ---
  // Handle case where no data is found for the selected employee/month
  if (!profileData) {
    return (
      <div className="p-8">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
          &larr; Go Back
        </button>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold">No Attendance Data Found</h2>
          <p className="text-gray-500">There are no records for this employee in the selected month.</p>
           <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="mt-4 px-3 py-2 rounded-lg border bg-gray-50"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(`${month}-02`).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
        </div>
      </div>
    );
  }

  // Destructure the data for easier use in the JSX
  const { 
    profile, 
    monthlySummary, 
    workHoursSummary, 
    leaveSummary, 
    sandwichLeave, 
    dailyRecords 
  } = profileData;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50">
      <button type="button" onClick={() => navigate(-1)} className="mb-6 px-4 py-2 rounded-lg bg-white shadow-sm border hover:bg-gray-100 flex items-center gap-2">
        &larr; Go Back
      </button>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">{profile.employeeName}</h1>
          <p className="text-gray-500 font-mono">ID: {profile.employeeId}</p>
        </div>

        <div className="mb-6 flex justify-center">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-4 py-2 rounded-lg border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(`${month}-02`).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard title="Present (Full Day)" value={monthlySummary.present_days} colorClass="text-green-600" />
            <StatCard title="Present (Half Day)" value={monthlySummary.half_days} colorClass="text-yellow-500" />
            <StatCard title="Absent" value={monthlySummary.absent_days} colorClass="text-red-600" />
            <StatCard title="On Leave" value={monthlySummary.on_leave_days} colorClass="text-yellow-500" />
            <StatCard title="Holiday" value={monthlySummary.holiday_days} colorClass="text-purple-600" />
        </div>

        {/* Chart and Hours Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md"><Bar data={attendanceChartData} options={attendanceChartOptions} /></div>
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">Monthly Work Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-gray-500 text-sm">Total Work Hours</p>
                        <p className="text-2xl font-bold text-blue-600">{workHoursSummary.totalWorkHours.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Total Worked Hours</p>
                        <p className="text-2xl font-bold text-blue-600">{workHoursSummary.totalWorkedHours.toFixed(2)}</p>
                    </div>
                     <div>
                        <p className="text-gray-500 text-sm">Total Idle Time</p>
                        <p className="text-2xl font-bold text-blue-600">{workHoursSummary.totalIdleTime.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Leave and Sandwich Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-md text-center">
                 <h3 className="text-lg font-semibold text-gray-700 mb-2">Leave Requests</h3>
                 <p className="text-3xl font-bold text-blue-600 mb-3">{leaveSummary.applied}</p>
                 <div className="flex justify-center gap-2 text-xs">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">Approved: {leaveSummary.approved}</span>
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full">Rejected: {leaveSummary.rejected}</span>
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending: {leaveSummary.pending}</span>
                 </div>
             </div>
              <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md text-center">
                 <h3 className="text-lg font-semibold text-gray-700 mb-2">Sandwich Leaves</h3>
                 <p className="text-3xl font-bold text-blue-600 mb-3">{sandwichLeave.count}</p>
                 <button onClick={() => setShowSandwichModal(true)} disabled={sandwichLeave.count === 0} className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                     View Details
                 </button>
             </div>
        </div>

        {/* Daily Records Table */}
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Daily Attendance Log</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Punch In</th><th className="p-3">Punch Out</th><th className="p-3">Work Hours</th><th className="p-3">Worked Hours</th><th className="p-3">Idle Time</th></tr></thead>
                    <tbody>
                        {dailyRecords.map((rec) => (
                        <tr key={rec.id} className="border-t hover:bg-gray-50">
                            <td className="p-3 font-mono">{rec.date}</td>
                            <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${rec.status === 'Present' && !rec.isHalfDay ? 'bg-green-100 text-green-800' : rec.status === 'Present' && rec.isHalfDay ? 'bg-yellow-100 text-yellow-800' : rec.status === 'Absent' ? 'bg-red-100 text-red-800' : rec.status === 'Holiday' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{rec.isHalfDay ? 'Half Day' : rec.status}</span></td>
                            <td className="p-3">{rec.punchIn || "—"}</td>
                            <td className="p-3">{rec.punchOut || "—"}</td>
                            <td className="p-3">{rec.workHours.toFixed(2)}</td>
                            <td className="p-3">{rec.workedHours.toFixed(2)}</td>
                            <td className="p-3">{rec.idleTime.toFixed(2)}</td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
      
      {/* Sandwich Modal */}
      {showSandwichModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowSandwichModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Sandwich Leave Details</h3>
                <button onClick={() => setShowSandwichModal(false)} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            {sandwichLeave.dates.length > 0 ? (
                sandwichLeave.dates.map(item => (
                    <div key={item.date} className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
                        <p className="font-semibold text-blue-700">{item.name}</p>
                        <p className="text-sm text-gray-600">{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                ))
            ) : <p className="text-gray-600">No sandwich leave days were recorded for this month.</p>}
             <button onClick={() => setShowSandwichModal(false)} className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceProfile;