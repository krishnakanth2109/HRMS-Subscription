import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
// ✅ IMPORT API for both attendance and overtime
import { getAttendanceByDateRange, getAllOvertimeRequests } from "../api"; 
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaHistory } from "react-icons/fa";

// --- Helper function to calculate worked status (NO CHANGE) ---
const getWorkedStatus = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) {
    return "Working..";
  }

  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);

  if (workedHours >= 8) {
    return "Full Day";
  } else if (workedHours >= 4) {
    return "Half Day";
  } else if (workedHours > 0) {
    return "Quarter Day";
  } else {
    return "N/A";
  }
};


// --- Attendance Detail Modal Component (NO CHANGE) ---
const AttendanceDetailModal = ({ isOpen, onClose, employeeData }) => {
  if (!isOpen || !employeeData) return null;

  const sortedRecords = [...employeeData.records].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <style>{`
        @keyframes modal-scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-modal-scale-in {
          animation: modal-scale-in 0.3s ease-out forwards;
        }
      `}</style>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-transform duration-300 animate-modal-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Attendance History</h3>
            <p className="text-slate-600 font-semibold">{employeeData.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Close modal"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-2 sm:p-5 overflow-y-auto">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Punch In</th>
                  <th className="px-4 py-3 text-left font-semibold">Punch Out</th>
                  <th className="px-4 py-3 text-left font-semibold">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold">Login Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Worked Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedRecords.length > 0 ? (
                  sortedRecords.map((record, idx) => (
                    <tr key={record._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-green-600">{record.punchIn ? new Date(record.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-red-600">{record.punchOut ? new Date(record.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">{record.displayTime || "0h 0m"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${record.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                          {record.loginStatus || "--"}
                        </span>
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap font-semibold">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              record.workedStatus === "Full Day" ? "bg-green-100 text-green-800" :
                              record.workedStatus === "Half Day" ? "bg-yellow-100 text-yellow-800" :
                              record.workedStatus === "Quarter Day" ? "bg-red-100 text-red-800" :
                              "bg-slate-100 text-slate-800"
                          }`}>
                              {record.workedStatus}
                          </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="text-center p-10 text-slate-500">No attendance records in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


const AdminAttendance = () => {
  const todayISO = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [dailyAttendanceData, setDailyAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [summaryStartDate, setSummaryStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [summaryEndDate, setSummaryEndDate] = useState(todayISO);
  const [summaryAttendanceData, setSummaryAttendanceData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ✅ NEW: State to store overtime data
  const [overtimeData, setOvertimeData] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const processAttendanceData = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      ...item,
      workedStatus: getWorkedStatus(item.punchIn, item.punchOut)
    }));
  };
  
  // ✅ NEW: Fetch all overtime requests
  const fetchOvertimeData = useCallback(async () => {
    try {
      const data = await getAllOvertimeRequests();
      setOvertimeData(data);
    } catch (error) {
      console.error("Error fetching overtime data:", error);
      setOvertimeData([]);
    }
  }, []);


  const fetchDailyData = useCallback(async (start, end) => {
    setLoading(true);
    try {
      const data = await getAttendanceByDateRange(start, end);
      setDailyAttendanceData(processAttendanceData(data));
    } catch (error) {
      console.error("Error fetching daily attendance data:", error);
      setDailyAttendanceData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummaryData = useCallback(async (start, end) => {
    setSummaryLoading(true);
    try {
      const data = await getAttendanceByDateRange(start, end);
      setSummaryAttendanceData(processAttendanceData(data));
    } catch (error) {
      console.error("Error fetching summary attendance data:", error);
      setSummaryAttendanceData([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyData(startDate, endDate);
  }, [startDate, endDate, fetchDailyData]);

  useEffect(() => {
    fetchSummaryData(summaryStartDate, summaryEndDate);
    fetchOvertimeData(); // Fetch OT data along with summary
  }, [summaryStartDate, summaryEndDate, fetchSummaryData, fetchOvertimeData]);

  const dailyStats = useMemo(() => {
    const workingCount = dailyAttendanceData.filter(item => item.punchIn && !item.punchOut).length;
    const completedCount = dailyAttendanceData.filter(item => item.punchIn && item.punchOut).length;
    return { workingCount, completedCount };
  }, [dailyAttendanceData]);

  
  // ✅ MODIFIED: Merged Overtime counts into the summary stats
  const employeeSummaryStats = useMemo(() => {
    if (!summaryAttendanceData.length) return [];

    // First, calculate approved OT counts for each employee
    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
        if (ot.status === 'APPROVED') {
            acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
        }
        return acc;
    }, {});

    // Then, calculate attendance summary
    const summary = summaryAttendanceData.reduce((acc, record) => {
      if (!acc[record.employeeId]) {
        acc[record.employeeId] = {
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          presentDays: 0,
          onTimeDays: 0,
          lateDays: 0,
          fullDays: 0,
          halfDays: 0,
          quarterDays: 0,
        };
      }

      const employeeRecord = acc[record.employeeId];
      const isPresent = record.punchIn;

      if (isPresent) {
        employeeRecord.presentDays++;
        if (record.loginStatus === 'LATE') {
          employeeRecord.lateDays++;
        } else {
          employeeRecord.onTimeDays++;
        }
      }

      if (record.workedStatus === "Full Day") employeeRecord.fullDays++;
      else if (record.workedStatus === "Half Day") employeeRecord.halfDays++;
      else if (record.workedStatus === "Quarter Day") employeeRecord.quarterDays++;

      return acc;
    }, {});

    // Finally, merge OT counts into the summary and return
    return Object.values(summary)
        .map(employee => ({
            ...employee,
            approvedOT: approvedOTCounts[employee.employeeId] || 0,
        }))
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  }, [summaryAttendanceData, overtimeData]); // Dependency array now includes overtimeData

  const exportDailyLogToExcel = () => {
    const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";

    const formattedData = dailyAttendanceData.map(item => ({
        "Employee Name": item.employeeName,
        "Employee ID": item.employeeId,
        "Date": new Date(item.date).toLocaleDateString(),
        "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--",
        "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--",
        "Duration": item.displayTime || "0h 0m",
        "Login Status": item.loginStatus || "--",
        "Worked Status": item.workedStatus,
        "Status": item.punchOut ? "Completed" : "Working",
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: fileType });
    FileSaver.saveAs(data, `Daily_Log_${startDate}_to_${endDate}${fileExtension}`);
  };

  // ✅ MODIFIED: Added Approved OT to the Excel export
  const exportSummaryToExcel = () => {
    if (employeeSummaryStats.length === 0) {
        alert("No summary data to export for the selected range.");
        return;
    }
    const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";
    const formattedData = employeeSummaryStats.map(item => ({
        "Employee ID": item.employeeId,
        "Employee Name": item.employeeName,
        "Present Days": item.presentDays,
        "On-Time Days": item.onTimeDays,
        "Late Days": item.lateDays,
        "Approved OT": item.approvedOT, // New column
        "Full Days": item.fullDays,
        "Half Days": item.halfDays,
        "Quarter Days": item.quarterDays,
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: fileType });
    FileSaver.saveAs(data, `Attendance_Summary_${summaryStartDate}_to_${summaryEndDate}${fileExtension}`);
  };

  const handleViewDetails = (employeeId, employeeName) => {
    const records = summaryAttendanceData.filter(
      record => record.employeeId === employeeId
    );
    setSelectedEmployee({ name: employeeName, records });
    setIsModalOpen(true);
  };

  const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex-1 p-5 bg-white rounded-xl shadow-md flex items-center gap-5 border-l-4 ${colorClass}`}>
      {icon}
      <div>
        <p className="text-sm text-slate-500 font-semibold uppercase">{title}</p>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* --- UI SECTION: DAILY ATTENDANCE LOG (NO CHANGE) --- */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <FaCalendarAlt className="text-2xl text-blue-600"/>
                    <h2 className="text-xl font-bold text-slate-800">Daily Attendance Log</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white shadow-sm border rounded-lg">
                        <span className="px-3 text-slate-500 text-sm font-medium">From</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" />
                    </div>
                    <div className="flex items-center bg-white shadow-sm border rounded-lg">
                        <span className="px-3 text-slate-500 text-sm font-medium">To</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" />
                    </div>
                    <button onClick={exportDailyLogToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform hover:scale-105">
                        <FaFileExcel/>
                        <span>Export</span>
                    </button>
                </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <StatCard icon={<FaClock className="text-orange-500 text-3xl"/>} title="Currently Working" value={dailyStats.workingCount} colorClass="border-orange-500" />
            <StatCard icon={<FaCheckCircle className="text-green-500 text-3xl"/>} title="Shift Completed" value={dailyStats.completedCount} colorClass="border-green-500" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800 text-slate-100 uppercase tracking-wider">
                <tr>
                  {['Employee', 'Date', 'Punch In', 'Punch Out', 'Duration', 'Login Status', 'Worked Status', 'Status'].map(h => <th key={h} className="px-6 py-4 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan="8" className="text-center p-10 text-slate-500 font-medium">Loading daily log...</td></tr>
                ) : dailyAttendanceData.length === 0 ? (
                  <tr><td colSpan="8" className="text-center p-10 text-slate-500">No records found for this date range.</td></tr>
                ) : (
                  dailyAttendanceData.map((item, idx) => (
                    <tr key={item._id || idx} className="hover:bg-blue-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="font-semibold text-slate-800">{item.employeeName}</div><div className="text-slate-500 font-mono text-xs">{item.employeeId}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-700">{item.displayTime || "0h 0m"}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{item.loginStatus || "--"}</span></td>
                       <td className="px-6 py-4 whitespace-nowrap font-semibold">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.workedStatus === "Full Day" ? "bg-green-100 text-green-800" :
                              item.workedStatus === "Half Day" ? "bg-yellow-100 text-yellow-800" :
                              item.workedStatus === "Quarter Day" ? "bg-red-100 text-red-800" :
                              "bg-slate-100 text-slate-800"
                          }`}>
                              {item.workedStatus}
                          </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${item.punchOut ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700 animate-pulse"}`}>{item.punchOut ? "Completed" : "Working"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- UI SECTION: EMPLOYEE ATTENDANCE SUMMARY --- */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <FaUsers className="text-2xl text-purple-600"/>
                        <h2 className="text-xl font-bold text-slate-800">Employee Attendance Summary</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-white shadow-sm border rounded-lg">
                            <span className="px-3 text-slate-500 text-sm font-medium">From</span>
                            <input type="date" value={summaryStartDate} onChange={(e) => setSummaryStartDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" />
                        </div>
                        <div className="flex items-center bg-white shadow-sm border rounded-lg">
                            <span className="px-3 text-slate-500 text-sm font-medium">To</span>
                            <input type="date" value={summaryEndDate} onChange={(e) => setSummaryEndDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" />
                        </div>
                        <button onClick={exportSummaryToExcel} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-transform hover:scale-105">
                            <FaFileExcel/>
                            <span>Export Summary</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                      {/* ✅ MODIFIED: Added "Approved OT" column header */}
                      <tr>
                          <th className="px-6 py-4 text-left font-semibold">Employee</th>
                          <th className="px-6 py-4 text-center font-semibold">Present</th>
                          <th className="px-6 py-4 text-center font-semibold">On Time</th>
                          <th className="px-6 py-4 text-center font-semibold">Late</th>
                          <th className="px-6 py-4 text-center font-semibold">Approved OT</th>
                          <th className="px-6 py-4 text-center font-semibold">Full Days</th>
                          <th className="px-6 py-4 text-center font-semibold">Half Days</th>
                          <th className="px-6 py-4 text-center font-semibold">Quarter Days</th>
                          <th className="px-6 py-4 text-center font-semibold">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                      {summaryLoading ? (
                          <tr><td colSpan="9" className="text-center p-10 text-slate-500 font-medium">Loading summary...</td></tr>
                      ) : employeeSummaryStats.length === 0 ? (
                          <tr><td colSpan="9" className="text-center p-10 text-slate-500">No summary data available for this date range.</td></tr>
                      ) : (
                          employeeSummaryStats.map((emp) => (
                              <tr key={emp.employeeId} className="hover:bg-purple-50/50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-semibold text-slate-800">{emp.employeeName}</div>
                                    <div className="text-slate-500 font-mono text-xs">{emp.employeeId}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-blue-600">{emp.presentDays}</td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-green-600">{emp.onTimeDays}</td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-red-600">{emp.lateDays}</td>
                                  {/* ✅ NEW: Displaying the approved OT count */}
                                  <td className="px-6 py-4 text-center font-bold text-lg text-indigo-600">{emp.approvedOT}</td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-green-500">{emp.fullDays}</td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-yellow-500">{emp.halfDays}</td>
                                  <td className="px-6 py-4 text-center font-bold text-lg text-orange-500">{emp.quarterDays}</td>
                                  <td className="px-6 py-4 text-center">
                                      <button
                                        onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)}
                                        className="flex items-center gap-1.5 bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-md hover:bg-blue-200 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                          <FaEye />
                                          <span>View</span>
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
            </div>
        </div>

      </div>
      
      <AttendanceDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employeeData={selectedEmployee}
      />
    </div>
  );
};

export default AdminAttendance;