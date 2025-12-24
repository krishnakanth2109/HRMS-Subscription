// --- START OF FILE AdminviewAttendance.jsx ---

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import api, { getAttendanceByDateRange, getAllOvertimeRequests, getEmployees, getAllShifts, getHolidays } from "../api"; 
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaMapMarkerAlt, FaUserSlash, FaSignOutAlt, FaShareAlt, FaSearch, FaBriefcase, FaUserTimes, FaFilter, FaCalendarDay, FaBell, FaCheck, FaBan, FaTrash, FaHistory } from "react-icons/fa";
import { toBlob } from 'html-to-image'; 

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

// ✅ NEW: Helper for DD/MM/YYYY Format
const formatDateDMY = (dateInput) => {
  if (!dateInput) return "--";
  const date = new Date(dateInput);
  // Ensure valid date
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

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

const getWorkedStatus = (punchIn, punchOut, apiStatus, fullDayThreshold, halfDayThreshold) => {
  const statusUpper = (apiStatus || "").toUpperCase();

  if (statusUpper === "LEAVE") return "Leave";
  if (statusUpper === "HOLIDAY") return "Holiday";
  if (statusUpper === "ABSENT" && !punchIn) return "Absent";

  if (punchIn && !punchOut) return "Working..";

  if (!punchIn) return "Absent";

  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);

  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day";
  
  return "Absent"; // Or "Short Day" depending on logic, effectively not full day
};

const LocationViewButton = ({ location }) => {
  if (!location || !location.latitude || !location.longitude) {
    return <span className="text-slate-400 text-xs">No Loc</span>;
  }
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold mt-1" title={location.address || 'View on Google Maps'}>
      <FaMapMarkerAlt /> View Map
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

const normalizeDateStr = (dateInput) => {
  const d = new Date(dateInput);
  return d.toISOString().split('T')[0];
};

const isHoliday = (dateStr, holidays) => {
  const target = new Date(dateStr);
  target.setHours(0,0,0,0);
  
  if (!Array.isArray(holidays)) return null;

  return holidays.find(h => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate || h.startDate);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return target >= start && target <= end;
  });
};

const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      resolve({ latitude: 0, longitude: 0 });
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Location access denied or failed", error);
          resolve({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  });
};

// ==========================================
// ✅ NEW COMPONENT: Live Timer for UI
// ==========================================
const LiveTimer = ({ startTime }) => {
  const [timeStr, setTimeStr] = useState("0h 0m 0s");

  useEffect(() => {
    if (!startTime) return;
    
    const updateTimer = () => {
        const now = new Date();
        const start = new Date(startTime);
        const diffMs = now - start;

        if (diffMs < 0) {
            setTimeStr("0h 0m 0s");
            return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        setTimeStr(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="text-blue-600 font-mono font-bold animate-pulse">{timeStr}</span>;
};

// ==========================================
// ✅ REQUEST APPROVAL MODAL
// ==========================================
const RequestApprovalModal = ({ isOpen, onClose, requests, onAction, onDelete }) => {
  if (!isOpen) return null;

  const sortedRequests = [...requests].sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-fadeIn" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-full text-orange-600">
              <FaBell size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Punch Out Requests</h3>
              <p className="text-sm text-slate-500">{requests.filter(r => r.status === 'Pending').length} Pending Review</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-full transition-colors"><FaTimes size={20} /></button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto bg-slate-50">
          {sortedRequests.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center text-slate-500">
                <FaCheckCircle className="text-4xl text-green-300 mb-4" />
                <p className="font-medium">No requests found.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Shift Date</th>
                    <th className="px-6 py-4">Requested Time</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4 text-center">Status / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{req.employeeName}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{req.employeeId}</div>
                      </td>
                      {/* ✅ DD/MM/YYYY */}
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatDateDMY(req.originalDate)}
                      </td>
                      <td className="px-6 py-4">
                         <span className="bg-blue-50 text-blue-700 py-1 px-3 rounded-md font-mono font-semibold">
                            {new Date(req.requestedPunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic">"{req.reason}"</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          {req.status === 'Approved' ? (
                            <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold shadow-sm">
                                <FaCheckCircle /> Approved
                            </span>
                          ) : req.status === 'Rejected' ? (
                            <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-bold shadow-sm">
                                <FaBan /> Rejected
                            </span>
                          ) : (
                            <>
                              <button 
                                onClick={() => onAction(req._id, 'Approved', req)}
                                className="w-9 h-9 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition-all shadow-sm hover:shadow-md"
                                title="Approve Request"
                              >
                                <FaCheck />
                              </button>
                              <button 
                                onClick={() => onAction(req._id, 'Rejected', req)}
                                className="w-9 h-9 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm hover:shadow-md"
                                title="Reject Request"
                              >
                                <FaTimes />
                              </button>
                            </>
                          )}
                           {/* DELETE BUTTON */}
                           <button 
                                onClick={() => onDelete(req._id)}
                                className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-600 hover:text-white transition-all shadow-sm ml-2"
                                title="Delete Request"
                           >
                                <FaTrash size={12} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENTS (MODALS & PAGINATION)
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
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setPunchOutDateTime(localDateTime);
      setLocationLoading(true);
      setLocationError('');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
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
    if (selectedTime <= punchInTime) { alert('Punch out time must be after punch in time'); return; }
    setLoading(true);
    try {
      await onPunchOut(employee.employeeId, selectedTime.toISOString(), currentLocation, employee.date);
      onClose();
    } catch (error) {
      // Error is logged in handleAdminPunchOut
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div><h3 className="text-xl font-bold text-slate-800">Admin Punch Out</h3><p className="text-sm text-slate-600 font-semibold">{employee.employeeName}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2"><FaTimes size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600 font-medium">Record Date:</span><span className="text-slate-800 font-bold">{formatDateDMY(employee.date)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600 font-medium">Punch In Time:</span><span className="text-green-700 font-semibold">{new Date(employee.punchIn).toLocaleString()}</span></div>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2"><FaMapMarkerAlt className="text-blue-600" /><span className="text-sm font-semibold text-slate-700">Location Status</span></div>
            {locationLoading ? <p className="text-sm text-slate-600">Getting location...</p> : locationError ? <p className="text-sm text-red-600">{locationError}</p> : <p className="text-sm text-green-600">✓ Location acquired</p>}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Select Punch Out Time <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={punchOutDateTime} onChange={(e) => setPunchOutDateTime(e.target.value)} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
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

// ✅ UPDATED: Include employeeImages prop
const AttendanceDetailModal = ({ isOpen, onClose, employeeData, shiftsMap, holidays, dateRange, employeeImages }) => {
  const contentRef = useRef(null);

  const completeHistory = useMemo(() => {
    if (!isOpen || !employeeData || !dateRange.startDate || !dateRange.endDate) return [];

    const history = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    const shift = shiftsMap[employeeData.employeeId];
    const weeklyOffs = shift?.weeklyOffDays || [0];
    
    const adminFullDayHours = shift?.fullDayHours || 9;
    const adminHalfDayHours = shift?.halfDayHours || 4.5;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        
        const record = employeeData.records.find(r => normalizeDateStr(r.date) === dateStr);
        
        const holidayObj = isHoliday(dateStr, holidays);
        const isWeeklyOff = weeklyOffs.includes(dayOfWeek);
        const isWorkingDay = !holidayObj && !isWeeklyOff;

        let workedStatus = "--";
        let loginStatus = "--";
        let displayTime = "--";
        let punchIn = null;
        let punchOut = null;
        let rowClass = "";
        let shiftDuration = adminFullDayHours;

        if (record) {
            punchIn = record.punchIn;
            punchOut = record.punchOut;
            displayTime = record.displayTime;
            loginStatus = calculateLoginStatus(record.punchIn, shift, record.loginStatus);
            
            workedStatus = getWorkedStatus(record.punchIn, record.punchOut, record.status, adminFullDayHours, adminHalfDayHours);
            
            if (workedStatus === "Absent") {
                rowClass = "bg-red-50/50 hover:bg-red-50"; 
            } else if (workedStatus === "Half Day") {
                rowClass = "bg-yellow-50/50 hover:bg-yellow-50";
            } else {
                rowClass = "hover:bg-gray-50";
            }
        } else {
            if (isWorkingDay) {
                workedStatus = "Absent (Not Logged In)";
                rowClass = "bg-red-100/30 hover:bg-red-50";
            } else if (holidayObj) {
                workedStatus = `Holiday: ${holidayObj.name}`;
                rowClass = "bg-purple-50/50 text-purple-700 hover:bg-purple-50";
                shiftDuration = 0;
            } else if (isWeeklyOff) {
                workedStatus = "Weekly Off";
                rowClass = "bg-gray-100/50 text-gray-500 hover:bg-gray-100";
                shiftDuration = 0;
            }
        }

        history.push({
            date: dateStr,
            punchIn,
            punchOut,
            shiftHours: shiftDuration,
            displayTime,
            loginStatus,
            workedStatus,
            isWorkingDay,
            isAbsent: workedStatus.includes("Absent"),
            isFullDay: workedStatus === "Full Day",
            isHalfDay: workedStatus === "Half Day",
            isPresent: !!punchIn,
            rowClass
        });
    }
    
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [isOpen, employeeData, shiftsMap, holidays, dateRange]);

  const stats = useMemo(() => {
      return completeHistory.reduce((acc, curr) => {
          if (curr.isWorkingDay) acc.workingDays++;
          if (curr.isPresent) acc.present++;
          if (curr.isFullDay) acc.fullDays++;
          if (curr.isHalfDay) acc.halfDays++;
          if (curr.isAbsent) acc.absent++;
          return acc;
      }, { workingDays: 0, present: 0, fullDays: 0, halfDays: 0, absent: 0 });
  }, [completeHistory]);

  if (!isOpen || !employeeData) return null;

  const downloadIndividualReport = () => {
    if (completeHistory.length === 0) return;
    const formattedData = completeHistory.map(item => ({
        "Date": formatDateDMY(item.date),
        "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--",
        "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--",
        "Assigned Hrs": formatDecimalHours(item.shiftHours),
        "Duration": item.displayTime || "--",
        "Login Status": item.loginStatus,
        "Worked Status": item.workedStatus
    }));
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
                    await navigator.share({ files: [file], title: 'Attendance Summary', text: `Attendance for ${employeeData.name}` });
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `Attendance_${employeeData.name}.png`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                }
            }
        } catch (error) { console.error("Error generating image:", error); }
    }
  };

  // Get image for current user
  const profilePic = employeeImages ? employeeImages[employeeData.employeeId] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header - Fixed */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 z-20">
          <div className="flex items-center gap-3">
             {/* ✅ UPDATED: Show Profile Pic */}
             <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-lg overflow-hidden bg-slate-100">
                {profilePic ? (
                    <img src={profilePic} alt={employeeData.name} className="w-full h-full object-cover" />
                ) : (
                    (employeeData.name || "U").charAt(0)
                )}
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-800">Attendance History</h3>
                <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    {employeeData.name} ({employeeData.employeeId})
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleShareImage} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"><FaShareAlt /> Share</button>
            <button onClick={downloadIndividualReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"><FaFileExcel /> Download</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-50 rounded-full"><FaTimes size={20} /></button>
          </div>
        </div>
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar" ref={contentRef}>
            
            {/* Stats Cards */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4 sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm pb-6 border-b border-slate-200/50">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Working Days</span>
                    <span className="text-2xl font-bold text-slate-800">{stats.workingDays}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-indigo-500">
                    <span className="text-xs font-bold uppercase text-indigo-500 tracking-wider">Present</span>
                    <span className="text-2xl font-bold text-slate-800">{stats.present}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-green-500">
                    <span className="text-xs font-bold uppercase text-green-500 tracking-wider">Full Days</span>
                    <span className="text-2xl font-bold text-slate-800">{stats.fullDays}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-yellow-500">
                    <span className="text-xs font-bold uppercase text-yellow-600 tracking-wider">Half Days</span>
                    <span className="text-2xl font-bold text-slate-800">{stats.halfDays}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-red-500">
                    <span className="text-xs font-bold uppercase text-red-500 tracking-wider">Absent</span>
                    <span className="text-2xl font-bold text-slate-800">{stats.absent}</span>
                </div>
            </div>

            {/* Table Area */}
            <div className="px-5 pb-10">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar"> 
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-xs font-bold sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">Date</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Punch In</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Punch Out</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Assigned</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Duration</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Login Status</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Worked Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {completeHistory.length > 0 ? (completeHistory.map((item, idx) => (
                                <tr key={idx} className={`transition-all duration-200 ${item.rowClass}`}>
                                    {/* ✅ DD/MM/YYYY */}
                                    <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap border-r border-slate-50">
                                        {formatDateDMY(item.date)}
                                        <div className="text-[10px] font-normal text-slate-400 uppercase">
                                            {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-green-600 font-medium whitespace-nowrap">
                                        {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                                    </td>
                                    <td className="px-6 py-4 text-red-600 font-medium whitespace-nowrap">
                                        {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{formatDecimalHours(item.shiftHours)}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">{item.displayTime}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {item.loginStatus !== "--" && (
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide border ${item.loginStatus === "LATE" ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}>
                                                {item.loginStatus}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-semibold whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                                            item.workedStatus === "Full Day" ? "bg-green-100 text-green-800" : 
                                            item.workedStatus === "Half Day" ? "bg-yellow-100 text-yellow-800" :
                                            item.isAbsent ? "bg-red-100 text-red-800" : 
                                            "bg-slate-100 text-slate-600"
                                        }`}>
                                            {item.workedStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))) : (<tr><td colSpan="7" className="text-center p-10 text-slate-500">No data for selected range.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// ✅ UPDATED: Include employeeImages prop
const StatusListModal = ({ isOpen, onClose, title, employees, employeeImages }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70 rounded-t-2xl">
          <div><h3 className="text-xl font-bold text-slate-800">{title}</h3><p className="text-sm text-slate-500 font-semibold">{employees.length} Employees</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2"><FaTimes size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {employees.length > 0 ? (<ul className="divide-y divide-slate-200">{employees.map((emp, index) => {
             // Get image
             const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;

             return (
              <li key={emp.employeeId || index} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* ✅ UPDATED: Profile Picture */}
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-blue-700 font-bold border border-slate-300 overflow-hidden">
                        {profilePic ? (
                            <img src={profilePic} alt={emp.name || emp.employeeName} className="w-full h-full object-cover" />
                        ) : (
                            (emp.name || emp.employeeName || "U").charAt(0)
                        )}
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
             );
          })}</ul>) : (<p className="text-center text-slate-500 py-8">No employees in this category.</p>)}
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
  
  // Summary Date States
  const [summaryStartDate, setSummaryStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [summaryEndDate, setSummaryEndDate] = useState(todayISO);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const [rawSummaryData, setRawSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [overtimeData, setOvertimeData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [statusListModal, setStatusListModal] = useState({ isOpen: false, title: "", employees: [] });
  const [shiftsMap, setShiftsMap] = useState({});
  const [holidays, setHolidays] = useState([]); 
  
  const [dailyCurrentPage, setDailyCurrentPage] = useState(1);
  const [dailyItemsPerPage, setDailyItemsPerPage] = useState(10);
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const [summaryItemsPerPage, setSummaryItemsPerPage] = useState(10);
  const [punchOutModal, setPunchOutModal] = useState({ isOpen: false, employee: null });

  const [punchOutRequests, setPunchOutRequests] = useState([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [summarySearchTerm, setSummarySearchTerm] = useState("");

  // ✅ NEW STATES: For Profile Images & Lightbox
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const fetchShifts = useCallback(async () => {
    try {
      const response = await getAllShifts();
      const data = Array.isArray(response) ? response : response.data || [];
      const map = {};
      data.forEach(shift => { if(shift.employeeId) map[shift.employeeId] = shift; });
      setShiftsMap(map);
    } catch (error) { console.error("Error fetching shifts:", error); }
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
        const response = await getHolidays();
        setHolidays(response || []);
    } catch (error) {
        console.error("Error fetching holidays:", error);
    }
  }, []);

  const fetchAllEmployees = useCallback(async () => { 
    try { 
      const data = await getEmployees(); 
      setAllEmployees(data); 
    } catch (error) { setAllEmployees([]); } 
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

  const fetchPunchOutRequests = useCallback(async () => {
    try {
      const response = await api.get('/api/punchoutreq/all'); 
      setPunchOutRequests(response.data);
    } catch (error) {
      console.error("Error fetching requests", error);
    }
  }, []);

  // ✅ NEW: Fetch Images for all employees
  useEffect(() => {
    const fetchImages = async () => {
      const newImages = {};
      if (allEmployees.length === 0) return;

      // Limit calls or implement caching logic if needed. 
      // For now, we fetch for all loaded employees to ensure profiles are visible.
      for (const emp of allEmployees) {
         if (!employeeImages[emp.employeeId]) {
            try {
               const res = await api.get(`/api/profile/${emp.employeeId}`);
               if (res.data?.profilePhoto?.url) {
                  newImages[emp.employeeId] = getSecureUrl(res.data.profilePhoto.url);
               }
            } catch (err) {
               // Ignore errors, keep blank/initials
            }
         }
      }

      if (Object.keys(newImages).length > 0) {
        setEmployeeImages(prev => ({ ...prev, ...newImages }));
      }
    };
    
    if (allEmployees.length > 0) {
        fetchImages();
    }
  }, [allEmployees]);


  const handleRequestAction = async (requestId, status, request) => {
    try {
      if (status === 'Approved') {
        if (!request) { alert("Request details not found!"); return; }
        
        const targetDate = normalizeDateStr(request.originalDate);
        
        const attendanceRecord = rawDailyData.find(record => 
          record.employeeId === request.employeeId && 
          normalizeDateStr(record.date) === targetDate
        );

        if (!attendanceRecord || !attendanceRecord.punchIn) {
          const confirmAnyway = window.confirm(
            `Attendance record for ${request.employeeName} on ${new Date(targetDate).toLocaleDateString()} was not found in the currently loaded Daily Log.\n\n` +
            `This might be because your Date Filter doesn't cover this date.\n\n` +
            `Do you want to force the punch-out anyway?`
          );
          if (!confirmAnyway) return;
        } else if (attendanceRecord.punchOut) {
          alert(`Employee ${request.employeeName} has already punched OUT on ${new Date(targetDate).toLocaleDateString()}`);
          return;
        }

        const adminLocation = await getCurrentLocation();

        let punchOutSuccessful = false;
        try {
          const response = await api.post(`/api/attendance/admin-punch-out`, {
            employeeId: request.employeeId,
            punchOutTime: request.requestedPunchOut,
            latitude: adminLocation.latitude, 
            longitude: adminLocation.longitude, 
            adminId: 'Admin',
            date: targetDate
          });

          if (response.status === 200 || response.status === 201 || response.data?.success) {
            punchOutSuccessful = true;
          } else {
             throw new Error(response.data?.message || "Punch out request completed but indicated failure.");
          }
        } catch (punchOutError) {
          const errMsg = punchOutError.response?.data?.message || punchOutError.message;
          alert(`Punch Out Failed: ${errMsg}`);
          console.error("Punch out error:", punchOutError);
          return; 
        }

        if (punchOutSuccessful) {
            try {
                await api.post('/api/punchoutreq/action', { requestId, status });
                
                setPunchOutRequests((prev) => 
                   prev.map((req) => req._id === requestId ? { ...req, status: 'Approved' } : req)
                );

            } catch (statusError) {
                console.warn("Punch out successful, but failed to update Request Status:", statusError);
            }

            alert(`✅ Request Approved! Employee ${request.employeeName} punched out successfully.`);
            
            fetchDailyData(startDate, endDate);
            fetchSummaryData(summaryStartDate, summaryEndDate);
        }

      } else {
        await api.post('/api/punchoutreq/action', { requestId, status });
        
        setPunchOutRequests((prev) => 
             prev.map((req) => req._id === requestId ? { ...req, status: 'Rejected' } : req)
        );

        alert(`Request ${status} Successfully`);
      }
    } catch (error) {
      alert("Action failed: " + (error.response?.data?.message || error.message));
      console.error("Request action error:", error);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to delete this request permanently?")) return;
    try {
        await api.delete(`/api/punchoutreq/delete/${requestId}`);
        setPunchOutRequests((prev) => prev.filter(req => req._id !== requestId));
        alert("Request deleted successfully");
    } catch (error) {
        alert("Delete failed: " + (error.response?.data?.message || error.message));
    }
  };

  const handleAdminPunchOut = async (employeeId, punchOutTime, location, dateOfRecord) => {
    try {
      const response = await api.post(`/api/attendance/admin-punch-out`, {
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
      const errMsg = error.response?.data?.message || error.message;
      alert(`Failed to punch out: ${errMsg}`);
      throw error; 
    }
  };

  const handleMonthChange = (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    
    if(val) {
        const [year, month] = val.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); 
        
        const startStr = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const endStr = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        setSummaryStartDate(startStr);
        setSummaryEndDate(endStr);
    }
  };

  useEffect(() => { fetchShifts(); fetchHolidays(); fetchDailyData(startDate, endDate); fetchPunchOutRequests(); }, [startDate, endDate, fetchDailyData, fetchShifts, fetchHolidays, fetchPunchOutRequests]);
  useEffect(() => { fetchAllEmployees(); fetchSummaryData(summaryStartDate, summaryEndDate); fetchOvertimeData(); }, [summaryStartDate, summaryEndDate, fetchSummaryData, fetchOvertimeData, fetchAllEmployees]);

  const empNameMap = useMemo(() => {
    return allEmployees.reduce((acc, emp) => { acc[emp.employeeId] = emp.name; return acc; }, {});
  }, [allEmployees]);

  const processedDailyData = useMemo(() => {
    const mapped = rawDailyData.map(item => {
        const shift = shiftsMap[item.employeeId];
        const adminFullDayHours = shift?.fullDayHours || 9;
        const adminHalfDayHours = shift?.halfDayHours || 4.5;
        
        const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
        
        return {
            ...item,
            employeeName: realName,
            assignedHours: adminFullDayHours, 
            workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours),
            displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus)
        };
    });
    mapped.sort((a, b) => {
        const timeA = a.punchIn ? new Date(a.punchIn).getTime() : 0;
        const timeB = b.punchIn ? new Date(b.punchIn).getTime() : 0;
        return timeB - timeA;
    });
    if (!dailySearchTerm) return mapped;
    const lowerTerm = dailySearchTerm.toLowerCase();
    return mapped.filter(item => (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) || (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm)));
  }, [rawDailyData, shiftsMap, dailySearchTerm, empNameMap]);

  const processedSummaryData = useMemo(() => {
    return rawSummaryData.map(item => {
        const shift = shiftsMap[item.employeeId];
        
        const adminFullDayHours = shift?.fullDayHours || 9;
        const adminHalfDayHours = shift?.halfDayHours || 4.5;
        
        const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
        return { 
          ...item, 
          employeeName: realName, 
          assignedHours: adminFullDayHours, 
          workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours), 
          displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus) 
        };
    });
  }, [rawSummaryData, shiftsMap, empNameMap]);

  // ✅ UPDATED: Accurate Absent Logic using Date Loop
  const employeeSummaryStats = useMemo(() => {
    if (!allEmployees.length) return [];
    
    // Create Map for quick lookup of raw summary records
    const attendanceMap = new Map();
    processedSummaryData.forEach(r => {
        const key = `${r.employeeId}_${normalizeDateStr(r.date)}`;
        attendanceMap.set(key, r);
    });

    const approvedOTCounts = overtimeData.reduce((acc, ot) => { if (ot.status === 'APPROVED') { acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1; } return acc; }, {});

    // Iterate through ALL active employees
    const activeEmployees = allEmployees.filter(e => e.isActive !== false);

    const summaryArray = activeEmployees.map(emp => {
        const shift = shiftsMap[emp.employeeId];
        const weeklyOffs = shift?.weeklyOffDays || [0];
        const adminFullDayHours = shift?.fullDayHours || 9;
        
        let stats = {
            employeeId: emp.employeeId,
            employeeName: emp.name,
            assignedHours: adminFullDayHours,
            presentDays: 0,
            onTimeDays: 0,
            lateDays: 0,
            fullDays: 0,
            halfDays: 0,
            absentDays: 0,
            approvedOT: approvedOTCounts[emp.employeeId] || 0
        };

        const start = new Date(summaryStartDate);
        const end = new Date(summaryEndDate);

        // Loop through each day in the selected range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const key = `${emp.employeeId}_${dateStr}`;
            const record = attendanceMap.get(key);
            const dayOfWeek = d.getDay();
            
            const holidayObj = isHoliday(dateStr, holidays);
            const isWeeklyOff = weeklyOffs.includes(dayOfWeek);
            const isWorkingDay = !holidayObj && !isWeeklyOff;

            if (record) {
                // Present
                if (record.punchIn) {
                    stats.presentDays++;
                    if (record.displayLoginStatus === 'LATE') stats.lateDays++;
                    else stats.onTimeDays++;
                }

                if (record.workedStatus === "Full Day") stats.fullDays++;
                else if (record.workedStatus === "Half Day") stats.halfDays++;
                else if (record.status === "ABSENT" || record.workedStatus.includes("Absent")) stats.absentDays++;
                
            } else {
                // No record found for this day
                if (isWorkingDay) {
                    stats.absentDays++; // Absent only if it was a working day
                }
            }
        }
        return stats;
    });

    // Sort: Most present days first
    const sortedArray = summaryArray.sort((a, b) => {
        if (b.presentDays !== a.presentDays) return b.presentDays - a.presentDays; 
        return a.employeeName.localeCompare(b.employeeName);
    });

    if (!summarySearchTerm) return sortedArray;
    const lowerTerm = summarySearchTerm.toLowerCase();
    return sortedArray.filter(item => (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) || (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm)));
  }, [allEmployees, processedSummaryData, overtimeData, shiftsMap, holidays, summaryStartDate, summaryEndDate, summarySearchTerm]);

  const absentEmployees = useMemo(() => {
    if (allEmployees.length === 0 || loading || startDate !== endDate) return [];
    const activeOnly = allEmployees.filter(e => e.isActive !== false);
    const presentIds = new Set(rawDailyData.map(att => att.employeeId));
    return activeOnly.filter(emp => !presentIds.has(emp.employeeId));
  }, [allEmployees, rawDailyData, loading, startDate, endDate]);

  const dailyStats = useMemo(() => {
      const fullList = rawDailyData.map(item => {
        const shift = shiftsMap[item.employeeId];
        const adminFullDayHours = shift?.fullDayHours || 9;
        const adminHalfDayHours = shift?.halfDayHours || 4.5;
        
        const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
        return {
            ...item,
            employeeName: realName,
            workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours),
            displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus)
        };
      });
      const working = fullList.filter(item => item.punchIn && !item.punchOut);
      const completed = fullList.filter(item => item.punchIn && item.punchOut);
      return { workingList: working, workingCount: working.length, completedList: completed, completedCount: completed.length, absentCount: startDate === endDate ? absentEmployees.length : 0 };
  }, [rawDailyData, shiftsMap, absentEmployees, startDate, endDate, empNameMap]);
  
  const paginatedDailyData = useMemo(() => processedDailyData.slice((dailyCurrentPage - 1) * dailyItemsPerPage, dailyCurrentPage * dailyItemsPerPage), [processedDailyData, dailyCurrentPage, dailyItemsPerPage]);
  const paginatedSummaryData = useMemo(() => employeeSummaryStats.slice((summaryCurrentPage - 1) * summaryItemsPerPage, summaryCurrentPage * summaryItemsPerPage), [employeeSummaryStats, summaryCurrentPage, summaryItemsPerPage]);

  const exportDailyLogToExcel = () => exportToExcel(processedDailyData, `Daily_Log_${startDate}_to_${endDate}`, [
    { label: "Employee Name", value: item => item.employeeName }, 
    { label: "Employee ID", value: item => item.employeeId }, 
    // ✅ DD/MM/YYYY for Export
    { label: "Date", value: item => formatDateDMY(item.date) },
    { label: "Punch In", value: item => item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, 
    { label: "Punch Out", value: item => item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, 
    { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) },
    { label: "Duration", value: item => item.displayTime || "0h 0m" }, 
    { label: "Login Status", value: item => item.displayLoginStatus }, 
    { label: "Worked Status", value: item => item.workedStatus }
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

  const handleViewDetails = (employeeId, employeeName) => { 
      const records = rawSummaryData.filter(r => r.employeeId === employeeId); 
      setSelectedEmployee({ name: employeeName, records, employeeId, startDate: summaryStartDate, endDate: summaryEndDate }); 
      setIsModalOpen(true); 
  };
  
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
        
        {/* Daily Log Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            {/* Row 1: Heading */}
            <div className="mb-4">
                <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
                   <FaCalendarAlt className="text-blue-600"/> Daily Attendance Log
                </div>
            </div>

            {/* Row 2: Controls (Search, Date, Buttons) in one line */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative group flex-grow-0">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search Name or ID..." 
                      value={dailySearchTerm} 
                      onChange={(e) => { setDailySearchTerm(e.target.value); setDailyCurrentPage(1); }} 
                      className="pl-10 pr-3 py-2 w-64 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                    />
                </div>

                {/* From Date */}
                <div className="flex items-center bg-white shadow-sm border rounded-lg overflow-hidden">
                    <span className="px-3 bg-slate-50 text-slate-500 text-sm font-bold border-r">From</span>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      className="pl-2 pr-2 py-2 outline-none text-slate-700 font-medium" 
                    />
                </div>

                {/* To Date */}
                <div className="flex items-center bg-white shadow-sm border rounded-lg overflow-hidden">
                    <span className="px-3 bg-slate-50 text-slate-500 text-sm font-bold border-r">To</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      className="pl-2 pr-2 py-2 outline-none text-slate-700 font-medium" 
                    />
                </div>
                
                {/* Buttons Group (Right side of the row) */}
                <div className="flex items-center gap-3 ml-auto">
                    <button onClick={exportDailyLogToExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform active:scale-95">
                        <FaFileExcel/><span>Export</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsRequestModalOpen(true)} 
                        className="relative flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-transform active:scale-95"
                    >
                        <FaBell /> 
                        <span>Punch Out Requests</span>
                        {punchOutRequests.filter(r => r.status === 'Pending').length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm">
                                {punchOutRequests.filter(r => r.status === 'Pending').length}
                            </span>
                        )}
                    </button>
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
                <thead className="bg-slate-800 text-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left">Employee</th>
                    <th className="px-6 py-4 text-left">Date</th>
                    <th className="px-6 py-4 text-left">Punch In</th>
                    <th className="px-6 py-4 text-left">Punch Out</th>
                    <th className="px-6 py-4 text-left">Work Hrs</th>
                    <th className="px-6 py-4 text-left">Duration</th>
                    <th className="px-6 py-4 text-left">Login Status</th>
                    <th className="px-6 py-4 text-left">Worked Status</th>
                    <th className="px-6 py-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                {loading ? (<tr><td colSpan="9" className="text-center p-10 font-medium text-slate-500">Loading daily log...</td></tr>) : paginatedDailyData.length === 0 ? (<tr><td colSpan="9" className="text-center p-10 text-slate-500">No records found.</td></tr>) : paginatedDailyData.map((item, idx) => {
                  const isAbsent = item.status === "ABSENT" || item.workedStatus.includes("Absent");
                  const canPunchOut = item.punchIn && !item.punchOut;
                  
                  // Color Logic for Punch In: Red if Late, Green if On Time
                  const punchInColor = item.displayLoginStatus === 'LATE' ? 'text-red-600' : 'text-green-600';

                  // Color Logic for Punch Out: Green if Full Day, Red if Short Day/Half Day
                  const punchOutColor = item.workedStatus === 'Full Day' ? 'text-green-600' : 'text-red-600';

                  // Get Profile Pic
                  const profilePic = employeeImages ? employeeImages[item.employeeId] : null;

                  return (
                    <tr key={item._id || idx} className={`hover:bg-blue-50/60 transition-colors ${isAbsent ? "bg-red-50" : ""}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-3">
                             {/* ✅ UPDATED: Profile Picture */}
                             <div 
                                className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 font-bold overflow-hidden bg-white cursor-pointer"
                                onClick={() => profilePic && setPreviewImage(profilePic)}
                             >
                                {profilePic ? (
                                    <img src={profilePic} alt={item.employeeName} className="w-full h-full object-cover" />
                                ) : (
                                    (item.employeeName || "U").charAt(0)
                                )}
                             </div>
                             <div>
                                <div className="font-semibold text-slate-800">{item.employeeName}</div>
                                <div className="text-slate-500 font-mono text-xs">{item.employeeId}</div>
                             </div>
                         </div>
                      </td>
                      {/* ✅ DD/MM/YYYY */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{formatDateDMY(item.date)}</td>
                      
                      {/* Merged Punch In & Location */}
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className={`font-medium ${punchInColor}`}>
                            {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                         </div>
                         {item.punchIn && <LocationViewButton location={item.punchInLocation} />}
                      </td>

                      {/* Merged Punch Out & Location */}
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className={`font-medium ${item.punchOut ? punchOutColor : 'text-slate-400'}`}>
                             {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                         </div>
                         {item.punchOut && <LocationViewButton location={item.punchOutLocation} />}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">{formatDecimalHours(item.assignedHours)}</td>
                      
                      {/* Duration: Live Timer if Active, else Static */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-700">
                        {(!item.punchOut && item.punchIn) ? (
                            <LiveTimer startTime={item.punchIn} />
                        ) : (
                            item.displayTime || "0h 0m 0s"
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.displayLoginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{item.displayLoginStatus}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.workedStatus === "Full Day" ? "bg-green-100 text-green-800" : item.workedStatus === "Half Day" ? "bg-yellow-100 text-yellow-800" : isAbsent ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"}`}>{item.workedStatus}</span></td>
                      
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

        {/* Employee Attendance Summary Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col gap-6">
                
                <div className="flex items-center gap-3">
                    <FaUsers className="text-2xl text-purple-600"/>
                    <h2 className="text-xl font-bold text-slate-800">Employee Attendance Summary</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    
                    {/* Search */}
                    <div className="relative group w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Search Employee</label>
                        <FaSearch className="absolute left-3 top-[34px] text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Name or ID..." 
                            value={summarySearchTerm} 
                            onChange={(e) => { setSummarySearchTerm(e.target.value); setSummaryCurrentPage(1); }} 
                            className="pl-10 pr-3 py-2 w-full border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm"
                        />
                    </div>

                    {/* Month Filter */}
                    <div className="w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Select Month</label>
                        <div className="relative">
                            <FaCalendarDay className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={handleMonthChange} 
                                className="pl-10 pr-3 py-2 w-full border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 shadow-sm" 
                            />
                        </div>
                    </div>

                    {/* From Date */}
                    <div className="w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">From</label>
                        <input 
                            type="date" 
                            value={summaryStartDate} 
                            onChange={(e) => setSummaryStartDate(e.target.value)} 
                            className="px-3 py-2 w-full border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 shadow-sm" 
                        />
                    </div>

                    {/* To Date */}
                    <div className="w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">To</label>
                        <input 
                            type="date" 
                            value={summaryEndDate} 
                            onChange={(e) => setSummaryEndDate(e.target.value)} 
                            className="px-3 py-2 w-full border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 shadow-sm" 
                        />
                    </div>

                    {/* Export Button */}
                    <div className="w-full">
                        <button 
                            onClick={exportSummaryToExcel} 
                            className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-transform active:scale-95 h-[42px]"
                        >
                            <FaFileExcel/> Export Summary
                        </button>
                    </div>
                </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                      <th className="px-6 py-4 text-left font-semibold border-b">Employee</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Assigned Hrs</th>
                      <th className="px-6 py-4 text-center font-semibold border-b text-blue-700 bg-blue-50/50">Present</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">On Time</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Late</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Approved OT</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Full Days</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Half Days</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Absent</th>
                      <th className="px-6 py-4 text-center font-semibold border-b">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summaryLoading ? (<tr><td colSpan="10" className="text-center p-10 text-slate-500 font-medium">Loading summary...</td></tr>) : paginatedSummaryData.length === 0 ? (<tr><td colSpan="10" className="text-center p-10 text-slate-500">No summary data available.</td></tr>) : paginatedSummaryData.map((emp) => {
                    // Get Profile Pic
                    const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                    
                    return (
                    <tr key={emp.employeeId} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-3">
                             {/* ✅ UPDATED: Profile Picture */}
                             <div 
                                className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 font-bold overflow-hidden bg-white cursor-pointer"
                                onClick={() => profilePic && setPreviewImage(profilePic)}
                             >
                                {profilePic ? (
                                    <img src={profilePic} alt={emp.employeeName} className="w-full h-full object-cover" />
                                ) : (
                                    (emp.employeeName || "U").charAt(0)
                                )}
                             </div>
                             <div>
                                <div className="font-bold text-slate-800">{emp.employeeName}</div>
                                <div className="text-slate-500 font-mono text-xs">{emp.employeeId}</div>
                             </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-600">{formatDecimalHours(emp.assignedHours)}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600 bg-blue-50/30 text-lg">{emp.presentDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-green-600">{emp.onTimeDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-red-600">{emp.lateDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-indigo-600">{emp.approvedOT}</td>
                      <td className="px-6 py-4 text-center">{emp.fullDays}</td>
                      <td className="px-6 py-4 text-center">{emp.halfDays}</td>
                      <td className="px-6 py-4 text-center text-red-500 font-bold">{emp.absentDays}</td>
                      <td className="px-6 py-4 text-center"><button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"><FaEye /></button></td>
                    </tr>
                )})}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={employeeSummaryStats.length} itemsPerPage={summaryItemsPerPage} currentPage={summaryCurrentPage} onPageChange={setSummaryCurrentPage} setItemsPerPage={setSummaryItemsPerPage} />
        </div>
      </div>

      <AttendanceDetailModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          employeeData={selectedEmployee} 
          shiftsMap={shiftsMap} 
          holidays={holidays} 
          dateRange={{ startDate: summaryStartDate, endDate: summaryEndDate }} 
          employeeImages={employeeImages} // Pass images prop
      />
      
      <StatusListModal 
          isOpen={statusListModal.isOpen} 
          onClose={() => setStatusListModal({ ...statusListModal, isOpen: false })} 
          title={statusListModal.title} 
          employees={statusListModal.employees} 
          employeeImages={employeeImages} // Pass images prop
      />
      
      <AdminPunchOutModal isOpen={punchOutModal.isOpen} onClose={() => setPunchOutModal({ isOpen: false, employee: null })} employee={punchOutModal.employee} onPunchOut={handleAdminPunchOut} />
      
      {/* ✅ NEW: Request Approval Modal with Delete Function */}
      <RequestApprovalModal 
            isOpen={isRequestModalOpen} 
            onClose={() => setIsRequestModalOpen(false)} 
            requests={punchOutRequests} 
            onAction={handleRequestAction}
            onDelete={handleDeleteRequest} 
      />

      {/* ✅ LIGHTBOX / FULL SCREEN IMAGE POPUP */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 backdrop-blur-sm">
             <FaTimes size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Full Preview" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;

// --- END OF FILE AdminviewAttendance.jsx ---