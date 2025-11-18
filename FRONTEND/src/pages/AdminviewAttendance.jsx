import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import { getAttendanceByDateRange, getAllOvertimeRequests } from "../api";
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaMapMarkerAlt } from "react-icons/fa";

// Helper function to determine worked status based on punch times
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

// ✅ Location Button Component to open Google Maps
const LocationViewButton = ({ location }) => {
  // If no location data, display a placeholder
  if (!location || !location.latitude || !location.longitude) {
    return <span className="text-slate-400">--</span>;
  }

  // Construct the Google Maps URL from coordinates
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      title={location.address || 'View on Google Maps'}
    >
      <FaMapMarkerAlt />
      <span>View Location</span>
    </a>
  );
};


// ✅ Attendance Detail Modal with updated Location Button
const AttendanceDetailModal = ({ isOpen, onClose, employeeData }) => {
  if (!isOpen || !employeeData) return null;

  const sortedRecords = [...employeeData.records].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-transform duration-300"
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
                  <th className="px-4 py-3 text-left font-semibold">In Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Punch Out</th>
                  <th className="px-4 py-3 text-left font-semibold">Out Location</th>
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
                      <td className="px-4 py-3">
                        <LocationViewButton location={record.punchInLocation} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-red-600">{record.punchOut ? new Date(record.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-4 py-3">
                        <LocationViewButton location={record.punchOutLocation} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">{record.displayTime || "0h 0m"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${record.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                          {record.loginStatus || "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
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
                  <tr><td colSpan="8" className="text-center p-10 text-slate-500">No attendance records in this period.</td></tr>
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
    fetchOvertimeData();
  }, [summaryStartDate, summaryEndDate, fetchSummaryData, fetchOvertimeData]);

  const dailyStats = useMemo(() => {
    const workingCount = dailyAttendanceData.filter(item => item.punchIn && !item.punchOut).length;
    const completedCount = dailyAttendanceData.filter(item => item.punchIn && item.punchOut).length;
    return { workingCount, completedCount };
  }, [dailyAttendanceData]);

  const employeeSummaryStats = useMemo(() => {
    if (!summaryAttendanceData.length) return [];

    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
        if (ot.status === 'APPROVED') {
            acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
        }
        return acc;
    }, {});

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
      if (record.punchIn) {
        employeeRecord.presentDays++;
        if (record.loginStatus === 'LATE') {
          employeeRecord.lateDays++;
        } else if (record.loginStatus === 'ON_TIME') {
          employeeRecord.onTimeDays++;
        }
      }

      if (record.workedStatus === "Full Day") employeeRecord.fullDays++;
      else if (record.workedStatus === "Half Day") employeeRecord.halfDays++;
      else if (record.workedStatus === "Quarter Day") employeeRecord.quarterDays++;

      return acc;
    }, {});

    return Object.values(summary)
        .map(employee => ({
            ...employee,
            approvedOT: approvedOTCounts[employee.employeeId] || 0,
        }))
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  }, [summaryAttendanceData, overtimeData]);

  const exportDailyLogToExcel = () => {
    const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";

    const formattedData = dailyAttendanceData.map(item => ({
        "Employee Name": item.employeeName,
        "Employee ID": item.employeeId,
        "Date": new Date(item.date).toLocaleDateString(),
        "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--",
        "Punch In Location": item.punchInLocation?.address || "--",
        "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--",
        "Punch Out Location": item.punchOutLocation?.address || "--",
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
        "Approved OT": item.approvedOT,
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

        {/* Daily Attendance Log */}
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
                  <th className="px-6 py-4 text-left font-semibold">Employee</th>
                  <th className="px-6 py-4 text-left font-semibold">Date</th>
                  <th className="px-6 py-4 text-left font-semibold">Punch In</th>
                  <th className="px-6 py-4 text-left font-semibold">In Location</th>
                  <th className="px-6 py-4 text-left font-semibold">Punch Out</th>
                  <th className="px-6 py-4 text-left font-semibold">Out Location</th>
                  <th className="px-6 py-4 text-left font-semibold">Duration</th>
                  <th className="px-6 py-4 text-left font-semibold">Login Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Worked Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan="10" className="text-center p-10 text-slate-500 font-medium">Loading daily log...</td></tr>
                ) : dailyAttendanceData.length === 0 ? (
                  <tr><td colSpan="10" className="text-center p-10 text-slate-500">No records found for this date range.</td></tr>
                ) : (
                  dailyAttendanceData.map((item, idx) => (
                    <tr key={item._id || idx} className="hover:bg-blue-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="font-semibold text-slate-800">{item.employeeName}</div><div className="text-slate-500 font-mono text-xs">{item.employeeId}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4">
                        <LocationViewButton location={item.punchInLocation} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4">
                        <LocationViewButton location={item.punchOutLocation} />
                      </td>
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

        {/* Employee Attendance Summary */}
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
                                  <td className="px-6 py-4 text-center font-bold text-blue-600">{emp.presentDays}</td>
                                  <td className="px-6 py-4 text-center font-semibold text-green-600">{emp.onTimeDays}</td>
                                  <td className="px-6 py-4 text-center font-semibold text-red-600">{emp.lateDays}</td>
                                  <td className="px-6 py-4 text-center font-semibold text-indigo-600">{emp.approvedOT}</td>
                                  <td className="px-6 py-4 text-center">{emp.fullDays}</td>
                                  <td className="px-6 py-4 text-center">{emp.halfDays}</td>
                                  <td className="px-6 py-4 text-center">{emp.quarterDays}</td>
                                  <td className="px-6 py-4 text-center">
                                    <button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <FaEye />
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