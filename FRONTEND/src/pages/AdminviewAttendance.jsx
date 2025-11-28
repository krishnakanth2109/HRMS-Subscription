import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import { getAttendanceByDateRange, getAllOvertimeRequests, getEmployees, getAllShifts } from "../api"; 
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaMapMarkerAlt, FaUserSlash, FaSignOutAlt, FaShareAlt, FaSearch } from "react-icons/fa";
import axios from 'axios';
import { toBlob } from 'html-to-image'; 

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getShiftDurationInHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 9;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  return Math.round((diffMinutes / 60) * 10) / 10;
};

const formatDecimalHours = (decimalHours) => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return "--";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const getWorkedStatus = (punchIn, punchOut, apiStatus, targetWorkHours) => {
  if (apiStatus === "ABSENT") return "Absent";
  if (punchIn && !punchOut) return "Working..";
  if (!punchIn || !punchOut) return "Absent";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= targetWorkHours) return "Full Day";
  if (workedHours > 5) return "Half Day";
  return "Absent(<5)";
};

const LocationViewButton = ({ location }) => {
  if (!location || !location.latitude || !location.longitude) {
    return <span className="text-slate-400">--</span>;
  }
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" title={location.address || 'View on Google Maps'}>
      <FaMapMarkerAlt /> <span>View</span>
    </a>
  );
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

// ==========================================
// SUB-COMPONENTS (MODALS)
// ==========================================

const AdminPunchOutModal = ({ isOpen, onClose, employee, onPunchOut }) => {
  const [punchOutDateTime, setPunchOutDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      // Adjust to local timezone for the input value
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setPunchOutDateTime(localDateTime);
      
      setLocationLoading(true);
      setLocationError('');
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setLocationLoading(false);
          },
          (error) => {
            console.error('Location error:', error);
            setLocationError('Unable to get location. Please enable location services.');
            setLocationLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setLocationError('Geolocation is not supported by this browser.');
        setLocationLoading(false);
      }
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!punchOutDateTime) { alert('Please select a punch out time'); return; }
    if (locationLoading) { alert('Please wait while we get your location...'); return; }
    if (locationError || !currentLocation) { alert('Location is required. Please enable location services.'); return; }

    const selectedTime = new Date(punchOutDateTime);
    const punchInTime = new Date(employee.punchIn);

    if (selectedTime <= punchInTime) {
      alert('Punch out time must be after punch in time');
      return;
    }

    setLoading(true);
    try {
      await onPunchOut(employee.employeeId, selectedTime.toISOString(), currentLocation, employee.date);
      onClose();
    } catch (error) {
      console.error('Punch out error:', error);
      const errorMsg = error.response?.data?.message || error.message;
      alert('Failed to punch out: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Admin Punch Out</h3>
            <p className="text-sm text-slate-600 font-semibold">{employee.employeeName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2"><FaTimes size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Record Date:</span>
              <span className="text-slate-800 font-bold">{new Date(employee.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Punch In Time:</span>
              <span className="text-green-700 font-semibold">{new Date(employee.punchIn).toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2"><FaMapMarkerAlt className="text-blue-600" /><span className="text-sm font-semibold text-slate-700">Location Status</span></div>
            {locationLoading ? <p className="text-sm text-slate-600">Getting location...</p> : locationError ? <p className="text-sm text-red-600">{locationError}</p> : <p className="text-sm text-green-600">✓ Location acquired</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Select Punch Out Time <span className="text-red-500">*</span></label>
            <input 
              type="datetime-local" 
              value={punchOutDateTime} 
              onChange={(e) => setPunchOutDateTime(e.target.value)} 
              max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} 
              required 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
            />
            <p className="text-xs text-slate-500">Note: Ensure the date matches the employee's work day if necessary.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50" disabled={loading}>Cancel</button>
            <button type="submit" disabled={loading || locationLoading || !!locationError} className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400">{loading ? 'Processing...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AttendanceDetailModal = ({ isOpen, onClose, employeeData, shiftsMap }) => {
  const contentRef = useRef(null);

  if (!isOpen || !employeeData) return null;
  const sortedRecords = [...employeeData.records].sort((a, b) => new Date(b.date) - new Date(a.date));
  const shift = shiftsMap[employeeData.employeeId];
  const shiftHours = shift ? getShiftDurationInHours(shift.shiftStartTime, shift.shiftEndTime) : 9;

  const downloadIndividualReport = () => {
    if (sortedRecords.length === 0) return;
    const formattedData = sortedRecords.map(item => {
        const realStatus = calculateLoginStatus(item.punchIn, shift, item.loginStatus);
        const dynamicWorkedStatus = getWorkedStatus(item.punchIn, item.punchOut, item.status, shiftHours);
        return {
            "Date": new Date(item.date).toLocaleDateString(),
            "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--",
            "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--",
            "Assigned Hrs": formatDecimalHours(shiftHours),
            "Duration": item.displayTime || "--",
            "Login Status": realStatus,
            "Worked Status": dynamicWorkedStatus
        };
    });
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${employeeData.name.replace(/\s+/g, '_')}_Attendance_Report.xlsx`);
  };

  const handleShareImage = async () => {
    if (contentRef.current) {
        try {
            const blob = await toBlob(contentRef.current, { backgroundColor: '#ffffff' });
            
            if (blob) {
                const file = new File([blob], "attendance_summary.png", { type: "image/png" });
                
                if (navigator.share) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Attendance Summary',
                            text: `Attendance history for ${employeeData.name}`,
                        });
                    } catch (err) {
                        console.error('Error sharing:', err);
                    }
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `Attendance_${employeeData.name}.png`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                }
            }
        } catch (error) {
            console.error("Error generating image:", error);
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div><h3 className="text-xl font-bold text-slate-800">Attendance History</h3><p className="text-slate-600 font-semibold">{employeeData.name}</p></div>
          <div className="flex items-center gap-3">
            <button onClick={handleShareImage} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700">
                <FaShareAlt /> Share
            </button>
            <button onClick={downloadIndividualReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-full hover:bg-green-700"><FaFileExcel /> Download</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2"><FaTimes size={20} /></button>
          </div>
        </div>
        
        <div className="p-2 sm:p-5 overflow-y-auto" ref={contentRef}> 
          <div className="bg-white p-2">
            <table className="min-w-full text-sm border border-slate-200">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Punch In</th><th className="px-4 py-3 text-left">Punch Out</th><th className="px-4 py-3 text-left">Assigned Hrs</th><th className="px-4 py-3 text-left">Duration</th><th className="px-4 py-3 text-left">Login Status</th><th className="px-4 py-3 text-left">Worked Status</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                {sortedRecords.length > 0 ? (sortedRecords.map((record, idx) => {
                    const realStatus = calculateLoginStatus(record.punchIn, shift, record.loginStatus);
                    const dynamicWorkedStatus = getWorkedStatus(record.punchIn, record.punchOut, record.status, shiftHours);
                    const isAbsent = record.status === "ABSENT" || dynamicWorkedStatus.includes("Absent");
                    return (
                    <tr key={idx} className={`hover:bg-slate-50 ${isAbsent ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-green-600">{record.punchIn ? new Date(record.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                    <td className="px-4 py-3 text-red-600">{record.punchOut ? new Date(record.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{formatDecimalHours(shiftHours)}</td>
                    <td className="px-4 py-3 font-mono">{record.displayTime || "0h 0m"}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${realStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{realStatus}</span></td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${dynamicWorkedStatus === "Full Day" ? "bg-green-100 text-green-800" : isAbsent ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{dynamicWorkedStatus}</span></td>
                    </tr>
                )})) : (<tr><td colSpan="7" className="text-center p-10">No records.</td></tr>)}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusListModal = ({ isOpen, onClose, title, employees }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div><h3 className="text-xl font-bold text-slate-800">{title}</h3><p className="text-sm text-slate-500 font-semibold">{employees.length} Employees</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2"><FaTimes size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {employees.length > 0 ? (<ul className="divide-y divide-slate-200">{employees.map((emp, index) => (
            <li key={emp.employeeId || index} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-blue-700 font-bold border border-slate-300">
                        {(emp.name || emp.employeeName)?.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div><p className="font-semibold text-slate-800">{emp.name || emp.employeeName}</p><p className="text-sm text-slate-500 font-mono">{emp.employeeId}</p></div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {emp.displayLoginStatus && <span className={`text-xs px-2 py-1 rounded-full ${emp.displayLoginStatus === 'LATE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{emp.displayLoginStatus}</span>}
                    {emp.workedStatus && (
                         <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                            emp.workedStatus === 'Full Day' ? 'bg-green-100 text-green-800' :
                            emp.workedStatus === 'Half Day' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                            {emp.workedStatus}
                        </span>
                    )}
                </div>
            </li>
          ))}</ul>) : (<p className="text-center text-slate-500 py-8">No employees in this category.</p>)}
        </div>
      </div>
    </div>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange, setItemsPerPage }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  if (totalItems === 0) return null;
  return (
    <div className="flex items-center justify-between p-4 bg-white border-t border-slate-200 rounded-b-2xl">
      <div className="flex items-center gap-2"><label className="text-sm font-medium text-slate-600">Rows:</label><select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); onPageChange(1); }} className="bg-slate-50 border border-slate-300 text-sm rounded-md p-1.5"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></div>
      <div className="flex items-center gap-4"><span className="text-sm font-medium text-slate-600">Showing {startItem}-{endItem} of {totalItems}</span><div><button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-r-0 border-slate-300 rounded-l-md hover:bg-slate-100 disabled:opacity-50">Previous</button><button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-r-md hover:bg-slate-100 disabled:opacity-50">Next</button></div></div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

const AdminAttendance = () => {
  const todayISO = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [rawDailyData, setRawDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState([]);
  const [summaryStartDate, setSummaryStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split("T")[0]);
  const [summaryEndDate, setSummaryEndDate] = useState(todayISO);
  const [rawSummaryData, setRawSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [overtimeData, setOvertimeData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [statusListModal, setStatusListModal] = useState({ isOpen: false, title: "", employees: [] });
  const [shiftsMap, setShiftsMap] = useState({});
  const [dailyCurrentPage, setDailyCurrentPage] = useState(1);
  const [dailyItemsPerPage, setDailyItemsPerPage] = useState(10);
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const [summaryItemsPerPage, setSummaryItemsPerPage] = useState(10);
  const [punchOutModal, setPunchOutModal] = useState({ isOpen: false, employee: null });

  // Search States
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [summarySearchTerm, setSummarySearchTerm] = useState("");

  const fetchShifts = useCallback(async () => {
    try {
      const response = await getAllShifts();
      const data = Array.isArray(response) ? response : response.data || [];
      const map = {};
      data.forEach(shift => { if(shift.employeeId) map[shift.employeeId] = shift; });
      setShiftsMap(map);
    } catch (error) { console.error("Error fetching shifts:", error); }
  }, []);

  const fetchAllEmployees = useCallback(async () => { 
    try { const data = await getEmployees(); setAllEmployees(data.filter(emp => emp.isActive !== false)); } catch (error) { setAllEmployees([]); } 
  }, []);

  const fetchOvertimeData = useCallback(async () => { 
    try { const data = await getAllOvertimeRequests(); setOvertimeData(data); } catch (error) { setOvertimeData([]); } 
  }, []);
  
  const fetchDailyData = useCallback(async (start, end) => { 
    setLoading(true); 
    try { const data = await getAttendanceByDateRange(start, end); setRawDailyData(Array.isArray(data) ? data : []); } catch (error) { setRawDailyData([]); } finally { setLoading(false); } 
  }, []);
  
  const fetchSummaryData = useCallback(async (start, end) => { 
    setSummaryLoading(true); 
    try { const data = await getAttendanceByDateRange(start, end); setRawSummaryData(Array.isArray(data) ? data : []); } catch (error) { setRawSummaryData([]); } finally { setSummaryLoading(false); } 
  }, []);

  const handleAdminPunchOut = async (employeeId, punchOutTime, location, dateOfRecord) => {
    try {
      const LIVE_BACKEND = 'https://hrms-ask.onrender.com/api';
      let baseUrl = import.meta.env?.VITE_API_URL || 
                    (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 
                    LIVE_BACKEND;
      
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      
      const response = await axios.post(`${baseUrl}/attendance/admin-punch-out`, {
        employeeId,
        punchOutTime,
        latitude: location.latitude,
        longitude: location.longitude,
        adminId: 'Admin',
        date: dateOfRecord
      });

      if (response.data.success) {
        alert('Employee punched out successfully!');
        await fetchDailyData(startDate, endDate);
        await fetchSummaryData(summaryStartDate, summaryEndDate);
      }
    } catch (error) {
      console.error('Admin punch out error:', error);
      const errMsg = error.response?.data?.message || error.message;
      alert(`Failed to punch out: ${errMsg}`);
      throw error; 
    }
  };

  useEffect(() => { fetchShifts(); fetchDailyData(startDate, endDate); }, [startDate, endDate, fetchDailyData, fetchShifts]);
  useEffect(() => { fetchAllEmployees(); fetchSummaryData(summaryStartDate, summaryEndDate); fetchOvertimeData(); }, [summaryStartDate, summaryEndDate, fetchSummaryData, fetchOvertimeData, fetchAllEmployees]);

  const processedDailyData = useMemo(() => {
    const mapped = rawDailyData.map(item => {
        const shift = shiftsMap[item.employeeId];
        const targetHours = shift ? getShiftDurationInHours(shift.shiftStartTime, shift.shiftEndTime) : 9;
        return {
            ...item,
            assignedHours: targetHours,
            workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, targetHours),
            displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus)
        };
    });

    // Sort: Recent Punch In on Top (Descending)
    mapped.sort((a, b) => {
        const timeA = a.punchIn ? new Date(a.punchIn).getTime() : 0;
        const timeB = b.punchIn ? new Date(b.punchIn).getTime() : 0;
        return timeB - timeA;
    });

    if (!dailySearchTerm) return mapped;
    const lowerTerm = dailySearchTerm.toLowerCase();
    return mapped.filter(item => 
        (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) ||
        (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm))
    );
  }, [rawDailyData, shiftsMap, dailySearchTerm]);

  // ✅ RESTORED: This useMemo was missing in the previous version causing the error
  const processedSummaryData = useMemo(() => {
    return rawSummaryData.map(item => {
        const shift = shiftsMap[item.employeeId];
        const targetHours = shift ? getShiftDurationInHours(shift.shiftStartTime, shift.shiftEndTime) : 9;
        return { ...item, assignedHours: targetHours, workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, targetHours), displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus) };
    });
  }, [rawSummaryData, shiftsMap]);

  const employeeSummaryStats = useMemo(() => {
    if (!processedSummaryData.length) return [];
    const approvedOTCounts = overtimeData.reduce((acc, ot) => { if (ot.status === 'APPROVED') { acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1; } return acc; }, {});
    
    const summary = processedSummaryData.reduce((acc, record) => {
      if (!acc[record.employeeId]) { acc[record.employeeId] = { employeeId: record.employeeId, employeeName: record.employeeName, assignedHours: record.assignedHours, presentDays: 0, onTimeDays: 0, lateDays: 0, fullDays: 0, halfDays: 0, absentDays: 0 }; }
      const empRec = acc[record.employeeId];
      if (record.punchIn) { empRec.presentDays++; if (record.displayLoginStatus === 'LATE') empRec.lateDays++; else empRec.onTimeDays++; }
      if (record.workedStatus === "Full Day") empRec.fullDays++; else if (record.workedStatus === "Half Day") empRec.halfDays++; else if (record.status === "ABSENT" || record.workedStatus.includes("Absent")) empRec.absentDays++;
      return acc;
    }, {});

    const resultArray = Object.values(summary).map(employee => ({ ...employee, approvedOT: approvedOTCounts[employee.employeeId] || 0 })).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    if (!summarySearchTerm) return resultArray;
    const lowerTerm = summarySearchTerm.toLowerCase();
    return resultArray.filter(item => 
        (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) ||
        (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm))
    );
  }, [processedSummaryData, overtimeData, summarySearchTerm]);

  const absentEmployees = useMemo(() => {
    if (allEmployees.length === 0 || loading || startDate !== endDate) return [];
    const presentIds = new Set(rawDailyData.map(att => att.employeeId));
    return allEmployees.filter(emp => !presentIds.has(emp.employeeId));
  }, [allEmployees, rawDailyData, loading, startDate, endDate]);

  const dailyStats = useMemo(() => {
      const fullList = rawDailyData.map(item => {
        const shift = shiftsMap[item.employeeId];
        const targetHours = shift ? getShiftDurationInHours(shift.shiftStartTime, shift.shiftEndTime) : 9;
        return {
            ...item,
            workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, targetHours),
            displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus)
        };
      });

      const working = fullList.filter(item => item.punchIn && !item.punchOut);
      const completed = fullList.filter(item => item.punchIn && item.punchOut);
      return { workingList: working, workingCount: working.length, completedList: completed, completedCount: completed.length, absentCount: startDate === endDate ? absentEmployees.length : 0 };
  }, [rawDailyData, shiftsMap, absentEmployees, startDate, endDate]);
  
  const paginatedDailyData = useMemo(() => processedDailyData.slice((dailyCurrentPage - 1) * dailyItemsPerPage, dailyCurrentPage * dailyItemsPerPage), [processedDailyData, dailyCurrentPage, dailyItemsPerPage]);
  const paginatedSummaryData = useMemo(() => employeeSummaryStats.slice((summaryCurrentPage - 1) * summaryItemsPerPage, summaryCurrentPage * summaryItemsPerPage), [employeeSummaryStats, summaryCurrentPage, summaryItemsPerPage]);

  const exportDailyLogToExcel = () => exportToExcel(processedDailyData, `Daily_Log_${startDate}_to_${endDate}`, [
    { label: "Employee Name", value: item => item.employeeName }, 
    { label: "Employee ID", value: item => item.employeeId }, 
    { label: "Date", value: item => new Date(item.date).toLocaleDateString() },
    { label: "Punch In", value: item => item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, 
    { label: "Punch Out", value: item => item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, 
    { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) },
    { label: "Duration", value: item => item.displayTime || "0h 0m" }, 
    { label: "Login Status", value: item => item.displayLoginStatus }, 
    { label: "Worked Status", value: item => item.workedStatus }, 
    { label: "Status", value: item => item.punchOut ? "Completed" : "Working" },
  ]);

  const exportSummaryToExcel = () => exportToExcel(employeeSummaryStats, `Attendance_Summary_${summaryStartDate}_to_${summaryEndDate}`, [
    { label: "Employee ID", value: item => item.employeeId }, 
    { label: "Employee Name", value: item => item.employeeName }, 
    { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) },
    { label: "Present Days", value: item => item.presentDays },
    { label: "On-Time Days", value: item => item.onTimeDays }, 
    { label: "Late Days", value: item => item.lateDays }, 
    { label: "Approved OT", value: item => item.approvedOT },
    { label: "Full Days", value: item => item.fullDays }, 
    { label: "Half Days", value: item => item.halfDays }, 
    { label: "Absent Days", value: item => item.absentDays },
  ]);

  const exportToExcel = (data, fileName, fields) => {
    if (data.length === 0) { alert("No data to export."); return; }
    const formattedData = data.map(item => fields.reduce((obj, field) => { obj[field.label] = field.value(item); return obj; }, {}));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${fileName}.xlsx`);
  };

  const handleViewDetails = (employeeId, employeeName) => { const records = rawSummaryData.filter(r => r.employeeId === employeeId); setSelectedEmployee({ name: employeeName, records, employeeId }); setIsModalOpen(true); };
  
  const handleOpenStatusModal = (type) => {
      if (type === 'WORKING') setStatusListModal({ isOpen: true, title: "Currently Working", employees: dailyStats.workingList });
      else if (type === 'COMPLETED') setStatusListModal({ isOpen: true, title: "Shift Completed", employees: dailyStats.completedList });
      else if (type === 'ABSENT' && startDate === endDate) setStatusListModal({ isOpen: true, title: "Not Logged In", employees: absentEmployees });
  };

  const StatCard = ({ icon, title, value, colorClass, onClick }) => (
    <div className={`relative flex-1 p-5 bg-white rounded-xl shadow-md flex items-center gap-5 border-l-4 ${colorClass} ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`} onClick={onClick}>
      {icon}<div><p className="text-sm text-slate-500 font-semibold uppercase">{title}</p><p className="text-3xl font-bold text-slate-800">{value}</p></div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            {/* Header Layout for Daily Log */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3"><FaCalendarAlt className="text-2xl text-blue-600"/><h2 className="text-xl font-bold text-slate-800">Daily Attendance Log</h2></div>
              
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Search Input for Daily Log */}
                <div className="relative group">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search Name or ID..." 
                        value={dailySearchTerm}
                        onChange={(e) => { setDailySearchTerm(e.target.value); setDailyCurrentPage(1); }}
                        className="pl-10 pr-3 py-2 w-full lg:w-64 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    />
                </div>

                <div className="flex items-center bg-white shadow-sm border rounded-lg"><span className="px-3 text-slate-500 text-sm font-medium">From</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" /></div>
                <div className="flex items-center bg-white shadow-sm border rounded-lg"><span className="px-3 text-slate-500 text-sm font-medium">To</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" /></div>
                <button onClick={exportDailyLogToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform hover:scale-105"><FaFileExcel/><span>Export</span></button>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
            <StatCard icon={<FaClock className="text-orange-500 text-3xl"/>} title="Currently Working" value={dailyStats.workingCount} colorClass="border-orange-500" onClick={() => handleOpenStatusModal('WORKING')} />
            <StatCard icon={<FaCheckCircle className="text-green-500 text-3xl"/>} title="Shift Completed" value={dailyStats.completedCount} colorClass="border-green-500" onClick={() => handleOpenStatusModal('COMPLETED')} />
            {startDate === endDate && (<StatCard icon={<FaUserSlash className="text-red-500 text-3xl"/>} title="Not Logged In" value={loading ? '...' : dailyStats.absentCount} colorClass="border-red-500" onClick={() => handleOpenStatusModal('ABSENT')} />)}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800 text-slate-100 uppercase tracking-wider"><tr><th className="px-6 py-4 text-left">Employee</th><th className="px-6 py-4 text-left">Date</th><th className="px-6 py-4 text-left">Punch In</th><th className="px-6 py-4 text-left">In Location</th><th className="px-6 py-4 text-left">Punch Out</th><th className="px-6 py-4 text-left">Out Location</th><th className="px-6 py-4 text-left">Work Hrs</th><th className="px-6 py-4 text-left">Duration</th><th className="px-6 py-4 text-left">Login Status</th><th className="px-6 py-4 text-left">Worked Status</th><th className="px-6 py-4 text-left">Status</th><th className="px-6 py-4 text-left">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (<tr><td colSpan="12" className="text-center p-10 font-medium text-slate-500">Loading daily log...</td></tr>) : paginatedDailyData.length === 0 ? (<tr><td colSpan="12" className="text-center p-10 text-slate-500">No records found.</td></tr>) : paginatedDailyData.map((item, idx) => {
                  const isAbsent = item.status === "ABSENT" || item.workedStatus.includes("Absent");
                  const canPunchOut = item.punchIn && !item.punchOut;
                  return (
                    <tr key={item._id || idx} className={`hover:bg-blue-50/60 transition-colors ${isAbsent ? "bg-red-50" : ""}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{item.employeeName}</div>
                        <div className="text-slate-500 font-mono text-xs">{item.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4"><LocationViewButton location={item.punchInLocation} /></td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                      <td className="px-6 py-4"><LocationViewButton location={item.punchOutLocation} /></td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">{formatDecimalHours(item.assignedHours)}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-700">{item.displayTime || "0h 0m"}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.displayLoginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{item.displayLoginStatus}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.workedStatus === "Full Day" ? "bg-green-100 text-green-800" : item.workedStatus === "Half Day" ? "bg-yellow-100 text-yellow-800" : isAbsent ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"}`}>{item.workedStatus}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${item.punchOut ? "bg-slate-100 text-slate-600" : isAbsent ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700 animate-pulse"}`}>{item.punchOut ? "Completed" : isAbsent ? "Absent" : "Working"}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canPunchOut ? (
                          <button onClick={() => setPunchOutModal({ isOpen: true, employee: item })} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" title="Admin Punch Out"><FaSignOutAlt /> Punch Out</button>
                        ) : item.punchOut ? <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-md"><FaCheckCircle /> Done</span> : <span className="text-slate-400 text-xs">--</span>}
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={processedDailyData.length} itemsPerPage={dailyItemsPerPage} currentPage={dailyCurrentPage} onPageChange={setDailyCurrentPage} setItemsPerPage={setDailyItemsPerPage} />
        </div>
        {/* Summary Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            {/* Header Layout for Summary */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3"><FaUsers className="text-2xl text-purple-600"/><h2 className="text-xl font-bold text-slate-800">Employee Attendance Summary</h2></div>
              
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                 {/* Search Input for Summary */}
                 <div className="relative group">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search Name or ID..." 
                        value={summarySearchTerm}
                        onChange={(e) => { setSummarySearchTerm(e.target.value); setSummaryCurrentPage(1); }}
                        className="pl-10 pr-3 py-2 w-full lg:w-64 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm"
                    />
                </div>

                <div className="flex items-center bg-white shadow-sm border rounded-lg"><span className="px-3 text-slate-500 text-sm font-medium">From</span><input type="date" value={summaryStartDate} onChange={(e) => setSummaryStartDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" /></div>
                <div className="flex items-center bg-white shadow-sm border rounded-lg"><span className="px-3 text-slate-500 text-sm font-medium">To</span><input type="date" value={summaryEndDate} onChange={(e) => setSummaryEndDate(e.target.value)} className="pl-1 pr-3 py-2 outline-none text-slate-700 font-medium rounded-r-lg" /></div>
                <button onClick={exportSummaryToExcel} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-transform hover:scale-105"><FaFileExcel/><span>Export Summary</span></button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider"><tr><th className="px-6 py-4 text-left font-semibold">Employee</th><th className="px-6 py-4 text-center font-semibold">Assigned Hrs</th><th className="px-6 py-4 text-center font-semibold">Present</th><th className="px-6 py-4 text-center font-semibold">On Time</th><th className="px-6 py-4 text-center font-semibold">Late</th><th className="px-6 py-4 text-center font-semibold">Approved OT</th><th className="px-6 py-4 text-center font-semibold">Full Days</th><th className="px-6 py-4 text-center font-semibold">Half Days</th><th className="px-6 py-4 text-center font-semibold">Absent</th><th className="px-6 py-4 text-center font-semibold">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {summaryLoading ? (<tr><td colSpan="10" className="text-center p-10 text-slate-500 font-medium">Loading summary...</td></tr>) : paginatedSummaryData.length === 0 ? (<tr><td colSpan="10" className="text-center p-10 text-slate-500">No summary data available.</td></tr>) : paginatedSummaryData.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{emp.employeeName}</div>
                        <div className="text-slate-500 font-mono text-xs">{emp.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-600">{formatDecimalHours(emp.assignedHours)}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">{emp.presentDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-green-600">{emp.onTimeDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-red-600">{emp.lateDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-indigo-600">{emp.approvedOT}</td>
                      <td className="px-6 py-4 text-center">{emp.fullDays}</td>
                      <td className="px-6 py-4 text-center">{emp.halfDays}</td>
                      <td className="px-6 py-4 text-center text-red-500 font-semibold">{emp.absentDays}</td>
                      <td className="px-6 py-4 text-center"><button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"><FaEye /></button></td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={employeeSummaryStats.length} itemsPerPage={summaryItemsPerPage} currentPage={summaryCurrentPage} onPageChange={setSummaryCurrentPage} setItemsPerPage={setSummaryItemsPerPage} />
        </div>
      </div>

      <AttendanceDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} employeeData={selectedEmployee} shiftsMap={shiftsMap} />
      <StatusListModal isOpen={statusListModal.isOpen} onClose={() => setStatusListModal({ ...statusListModal, isOpen: false })} title={statusListModal.title} employees={statusListModal.employees} />
      <AdminPunchOutModal isOpen={punchOutModal.isOpen} onClose={() => setPunchOutModal({ isOpen: false, employee: null })} employee={punchOutModal.employee} onPunchOut={handleAdminPunchOut} />
    </div>
  );
};

export default AdminAttendance;