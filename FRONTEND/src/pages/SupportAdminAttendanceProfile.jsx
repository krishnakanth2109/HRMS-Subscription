import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import api, { getAllShifts, getHolidays, getAllOvertimeRequests } from "../api";
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaMapMarkerAlt, FaUserSlash, FaSignOutAlt, FaShareAlt, FaSearch, FaBriefcase, FaUserTimes, FaFilter, FaCalendarDay, FaExchangeAlt, FaCheck, FaHome, FaList, FaLayerGroup, FaChevronDown, FaChevronUp, FaInfoCircle, FaCoffee, FaSpinner } from "react-icons/fa";
import { toBlob } from 'html-to-image';
import ModalWrapper from "../components/ModalWrapper";

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const getSecureUrl = (url) => { if (!url) return ""; if (url.startsWith("http:")) { return url.replace("http:", "https:"); } return url; };
const formatDateDMY = (dateInput) => { if (!dateInput) return "--"; const date = new Date(dateInput); if (isNaN(date.getTime())) return "--"; return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
const getShiftDurationInHours = (startTime, endTime) => { if (!startTime || !endTime) return 9; const [startH, startM] = startTime.split(':').map(Number); const [endH, endM] = endTime.split(':').map(Number); let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM); if (diffMinutes < 0) diffMinutes += 24 * 60; return Math.round((diffMinutes / 60) * 10) / 10; };
const formatDecimalHours = (decimalHours) => { if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return "0h 0m"; const hours = Math.floor(decimalHours); const minutes = Math.round((decimalHours - hours) * 60); if (minutes === 0) return `${hours}h`; return `${hours}h ${minutes}m`; };
const getCurrentRole = (employee) => { if (employee.currentRole) return employee.currentRole; if (employee && Array.isArray(employee.experienceDetails)) { const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present"); return currentExp?.role || "N/A"; } return "N/A"; };
const getWorkedStatus = (punchIn, punchOut, apiStatus, fullDayThreshold, halfDayThreshold) => { const statusUpper = (apiStatus || "").toUpperCase(); if (statusUpper === "LEAVE") return "Leave"; if (statusUpper === "HOLIDAY") return "Holiday"; if (statusUpper === "ABSENT" && !punchIn) return "Absent"; if (punchIn && !punchOut) return "Working.."; if (!punchIn) return "Absent"; const workedMilliseconds = new Date(punchOut) - new Date(punchIn); const workedHours = workedMilliseconds / (1000 * 60 * 60); if (workedHours >= fullDayThreshold) return "Full Day"; if (workedHours >= halfDayThreshold) return "Half Day"; return "Absent"; };
const LocationViewButton = ({ location }) => { if (!location || !location.latitude || !location.longitude) return <span className="text-gray-400 text-xs font-medium">No Loc</span>; const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`; return (<a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[11px] font-semibold mt-1 bg-blue-50 px-2 py-0.5 rounded-full transition-colors" title={location.address || 'View on Google Maps'}><FaMapMarkerAlt size={10} /> View Map</a>); };
const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => { if (!punchInTime) return "--"; if (apiStatus === "LATE") return "LATE"; if (shiftData && shiftData.shiftStartTime) { try { const punchDate = new Date(punchInTime); const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number); const shiftDate = new Date(punchDate); shiftDate.setHours(sHour, sMin, 0, 0); const grace = shiftData.lateGracePeriod || 15; shiftDate.setMinutes(shiftDate.getMinutes() + grace); if (punchDate > shiftDate) return "LATE"; } catch (e) { console.error("Date calc error", e); } } return "ON_TIME"; };
const normalizeDateStr = (dateInput) => { const d = new Date(dateInput); return d.toISOString().split('T')[0]; };
const formatBreakDuration = (seconds) => { if (!seconds || seconds <= 0) return "0m 0s"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60); if (h > 0) return `${h}h ${m}m ${s}s`; return `${m}m ${s}s`; };
const calcTotalBreakSeconds = (breakSessions) => { if (!Array.isArray(breakSessions) || breakSessions.length === 0) return 0; const now = new Date(); return breakSessions.reduce((total, brk) => { if (!brk.from) return total; const from = new Date(brk.from); const to = brk.to ? new Date(brk.to) : now; const diff = (to - from) / 1000; return total + (diff > 0 ? diff : 0); }, 0); };
const calcBreakSessionDuration = (brk) => { if (!brk || !brk.from) return 0; const from = new Date(brk.from); const to = brk.to ? new Date(brk.to) : new Date(); const diff = (to - from) / 1000; return diff > 0 ? diff : 0; };
const isHoliday = (dateStr, holidays) => { const target = new Date(dateStr); target.setHours(0, 0, 0, 0); if (!Array.isArray(holidays)) return null; return holidays.find(h => { const start = new Date(h.startDate); const end = new Date(h.endDate || h.startDate); start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); return target >= start && target <= end; }); };

const LiveTimer = ({ startTime }) => {
  const [timeStr, setTimeStr] = useState("0h 0m 0s");
  useEffect(() => {
    if (!startTime) return;
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diffMs = now - start;
      if (diffMs < 0) { setTimeStr("0h 0m 0s"); return; }
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeStr(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span className="text-blue-600 font-mono font-bold animate-pulse bg-blue-50 px-2 py-1 rounded-md">{timeStr}</span>;
};

// ==========================================
// MODALS & COMPONENTS
// ==========================================
const AttendanceComparisonModal = ({ isOpen, onClose, selectedStats, employeeImages, startDate, endDate }) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      backdropClass="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
      containerClass="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn"
    >
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
        <div><h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3"><FaExchangeAlt className="text-blue-600" /> Attendance Comparison</h2><p className="text-gray-500 font-medium text-sm mt-1">{formatDateDMY(startDate)} to {formatDateDMY(endDate)}</p></div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"><FaTimes size={20} /></button>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedStats.map(emp => (
            <div key={emp.employeeId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-gray-100 bg-white flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                  {employeeImages[emp.employeeId] ? (<img src={employeeImages[emp.employeeId]} className="w-full h-full object-cover" alt="" />) : (<div className="w-full h-full flex items-center justify-center font-bold text-2xl text-gray-400">{emp.employeeName.charAt(0)}</div>)}
                </div>
                <div><h4 className="font-bold text-lg text-gray-800 leading-tight">{emp.employeeName}</h4><p className="text-sm font-mono text-gray-500 mt-0.5">{emp.supportAdminId || emp.employeeId}</p></div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-center"><p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Present Days</p><p className="text-2xl font-black text-blue-700 mt-1">{emp.presentDays}</p></div>
                  <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl text-center"><p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Absent Days</p><p className="text-2xl font-black text-red-700 mt-1">{emp.absentDays}</p></div>
                </div>
                <div className="space-y-1 mt-4">
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50"><span className="text-sm font-medium text-gray-500">On Time</span><span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{emp.onTimeDays}</span></div>
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50"><span className="text-sm font-medium text-gray-500">Late Arrivals</span><span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">{emp.lateDays}</span></div>
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50"><span className="text-sm font-medium text-gray-500">Full Days</span><span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{emp.fullDays}</span></div>
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50"><span className="text-sm font-medium text-gray-500">Half Days</span><span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{emp.halfDays}</span></div>
                  <div className="flex justify-between items-center py-2.5"><span className="text-sm font-medium text-gray-500">Approved OT</span><span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{emp.approvedOT}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
        <button onClick={onClose} className="px-6 py-2.5 bg-gray-800 text-white font-semibold text-sm rounded-xl hover:bg-gray-900 transition-colors shadow-sm">Close Comparison</button>
      </div>
    </ModalWrapper>
  );
};

const AdminPunchOutModal = ({ isOpen, onClose, employee, onPunchOut }) => {
  const [punchOutDateTime, setPunchOutDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setPunchOutDateTime(localDateTime);
      setLocationLoading(true);
      setLocationError('');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => { setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationLoading(false); },
          (error) => { setLocationError('Unable to get location.'); setLocationLoading(false); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else { setLocationError('Geolocation not supported.'); setLocationLoading(false); }
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!punchOutDateTime) { alert('Please select a punch out time'); return; }
    if (locationLoading) { alert('Getting location...'); return; }
    if (locationError || !currentLocation) { alert('Location required.'); return; }
    const selectedTime = new Date(punchOutDateTime);
    const punchInTime = new Date(employee.punchIn);
    if (selectedTime <= punchInTime) { alert('Must be after punch in'); return; }
    setLoading(true);
    try { await onPunchOut(employee.employeeId, selectedTime.toISOString(), currentLocation, employee.date); onClose(); }
    catch (error) { }
    finally { setLoading(false); }
  };

  if (!employee) return null;
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      backdropClass="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200"
      containerClass="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn"
    >
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
        <div><h3 className="text-xl font-bold text-gray-800">Admin Punch Out</h3><p className="text-sm text-gray-500 font-medium mt-0.5">{employee.employeeName}</p></div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"><FaTimes size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
          <div className="flex justify-between items-center text-sm"><span className="text-blue-800 font-medium">Record Date:</span><span className="text-blue-900 font-bold bg-blue-100/50 px-2 py-1 rounded-md">{formatDateDMY(employee.date)}</span></div>
          <div className="flex justify-between items-center text-sm"><span className="text-blue-800 font-medium">Punch In Time:</span><span className="text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md">{new Date(employee.punchIn).toLocaleString()}</span></div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2"><FaMapMarkerAlt className="text-blue-600" /><span className="text-sm font-bold text-gray-700">Location Status</span></div>
          {locationLoading ? <p className="text-sm font-medium text-gray-500 animate-pulse">Getting location...</p> : locationError ? <p className="text-sm font-medium text-red-600">{locationError}</p> : <p className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg inline-block">✓ Location acquired</p>}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700">Select Punch Out Time <span className="text-red-500">*</span></label>
          <input type="datetime-local" value={punchOutDateTime} onChange={(e) => setPunchOutDateTime(e.target.value)} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-gray-700" />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors" disabled={loading}>Cancel</button>
          <button type="submit" disabled={loading || locationLoading || !!locationError} className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm">{loading ? 'Processing...' : 'Confirm Punch Out'}</button>
        </div>
      </form>
    </ModalWrapper>
  );
};

const PunchOutRequestsModal = ({ isOpen, onClose, requests, loading, onAction, onDelete, actionLoading }) => {
  const pending = (requests || []).filter(req => req.status === 'Pending');
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      backdropClass="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex justify-center items-center p-4 animate-in fade-in duration-200"
      containerClass="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden animate-scaleIn"
    >
      <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Punch Out Requests</h3>
          <p className="text-sm text-gray-500 mt-1">Review pending punch out requests and approve, reject, or delete them.</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"><FaTimes size={20} /></button>
      </div>
      <div className="p-5 overflow-y-auto max-h-[65vh] bg-gray-50">
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">Loading requests...</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-medium">No pending punch out requests.</div>
        ) : (
          <div className="space-y-4">
            {pending.map((req) => (
              <div key={req._id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500">Support Admin</div>
                    <div className="font-semibold text-gray-900">{req.employeeName || req.employeeId}</div>
                  </div>
                  <div className="text-sm text-gray-500">Requested Date</div>
                  <div className="font-semibold text-gray-900">{formatDateDMY(req.originalDate)}</div>
                  <div className="text-sm text-gray-500">Requested Punch Out</div>
                  <div className="font-semibold text-gray-900">{req.requestedPunchOut ? new Date(req.requestedPunchOut).toLocaleString() : 'N/A'}</div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wider text-gray-400">Reason</div>
                    <div className="mt-2 text-sm text-gray-700">{req.reason || 'No reason provided.'}</div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wider text-gray-400">Requested On</div>
                    <div className="mt-2 text-sm text-gray-700">{req.requestDate ? new Date(req.requestDate).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => onAction(req._id, 'Approved')} disabled={actionLoading} className="px-4 py-2 rounded-2xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => onAction(req._id, 'Rejected')} disabled={actionLoading} className="px-4 py-2 rounded-2xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50">Reject</button>
                  <button type="button" onClick={() => onDelete(req._id)} disabled={actionLoading} className="px-4 py-2 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
        <button onClick={onClose} className="px-5 py-2.5 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-900 transition-colors">Close</button>
      </div>
    </ModalWrapper>
  );
};

const AttendanceDetailModal = ({ isOpen, onClose, employeeData, shiftsMap, holidays, dateRange, employeeImages }) => {
  const contentRef = useRef(null);
  const [viewMode, setViewMode] = useState("daily");
  const [expandedWeeks, setExpandedWeeks] = useState({});

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

      let workedStatus = "--"; let loginStatus = "--"; let displayTime = "--"; let punchIn = null; let punchOut = null; let rowClass = ""; let shiftDuration = adminFullDayHours; let actualWorkedHours = 0;

      if (record) {
        punchIn = record.punchIn; punchOut = record.punchOut;
        displayTime = record.displayTime || "0h 0m 0s";
        loginStatus = calculateLoginStatus(record.punchIn, shift, record.loginStatus);
        workedStatus = getWorkedStatus(record.punchIn, record.punchOut, record.status, adminFullDayHours, adminHalfDayHours);
        if (punchIn && punchOut) { actualWorkedHours = (new Date(punchOut) - new Date(punchIn)) / (1000 * 60 * 60); }
        if (workedStatus === "Absent") rowClass = "bg-red-50/30 hover:bg-red-50";
        else if (workedStatus === "Half Day") rowClass = "bg-yellow-50/30 hover:bg-yellow-50";
        else rowClass = "bg-white hover:bg-gray-50/80";
      } else {
        if (isWorkingDay) { workedStatus = "Absent (Not Logged In)"; rowClass = "bg-red-50/50 hover:bg-red-50"; }
        else if (holidayObj) { workedStatus = `Holiday: ${holidayObj.name}`; rowClass = "bg-purple-50/30 text-purple-700 hover:bg-purple-50"; shiftDuration = 0; }
        else if (isWeeklyOff) { workedStatus = "Weekly Off"; rowClass = "bg-gray-50 text-gray-500 hover:bg-gray-100"; shiftDuration = 0; }
      }
      history.push({ date: dateStr, punchIn, punchOut, shiftHours: shiftDuration, actualWorkedHours, displayTime, loginStatus, workedStatus, isWorkingDay, isAbsent: workedStatus.includes("Absent"), isFullDay: workedStatus === "Full Day", isHalfDay: workedStatus === "Half Day", isPresent: !!punchIn, rowClass });
    }
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [isOpen, employeeData, shiftsMap, holidays, dateRange]);

  const weeklyHistory = useMemo(() => {
    if (viewMode !== "weekly") return [];
    const weeks = {};
    const sortedDaily = [...completeHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedDaily.forEach(day => {
      const date = new Date(day.date); const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek; const weekStart = new Date(date.setDate(diff)); weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeks[weekKey]) { const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weeks[weekKey] = { weekStart: weekKey, weekEnd: weekEnd.toISOString().split('T')[0], days: [], totalHours: 0, stats: { full: 0, half: 0, absent: 0, late: 0 } }; }
      weeks[weekKey].days.push(day);
      weeks[weekKey].totalHours += day.actualWorkedHours || 0;
      if (day.isWorkingDay) { if (day.isFullDay) weeks[weekKey].stats.full++; else if (day.isHalfDay) weeks[weekKey].stats.half++; else if (day.isAbsent) weeks[weekKey].stats.absent++; if (day.loginStatus === "LATE") weeks[weekKey].stats.late++; }
    });
    return Object.values(weeks).sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
  }, [completeHistory, viewMode]);

  const toggleWeekExpansion = (weekKey) => { setExpandedWeeks(prev => ({ ...prev, [weekKey]: !prev[weekKey] })); };

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
      "Date": formatDateDMY(item.date), "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--",
      "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--",
      "Assigned Hrs": formatDecimalHours(item.shiftHours), "Duration": item.displayTime || "--",
      "Login Status": item.loginStatus, "Worked Status": item.workedStatus
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
          if (navigator.share) await navigator.share({ files: [file], title: 'Attendance Summary', text: `Attendance for ${employeeData.name}` });
          else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Attendance_${employeeData.name}.png`; link.click(); URL.revokeObjectURL(link.href); }
        }
      } catch (error) { console.error("Error generating image:", error); }
    }
  };

  const profilePic = employeeImages ? employeeImages[employeeData.employeeId] : null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      backdropClass="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200"
      containerClass="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-scaleIn"
    >
      <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white shrink-0 z-20">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold sm:text-xl overflow-hidden bg-gray-50 shrink-0">
              {profilePic ? <img src={profilePic} alt={employeeData.name} className="w-full h-full object-cover" /> : (employeeData.name || "U").charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">{employeeData.name}</h3>
              <p className="text-gray-500 font-medium text-[10px] sm:text-sm flex items-center gap-2 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>{employeeData.supportAdminId || employeeData.employeeId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <button onClick={handleShareImage} className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 text-[10px] sm:text-sm font-bold rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"><FaShareAlt /> <span className="hidden xs:inline">Share</span></button>
              <button onClick={downloadIndividualReport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-[10px] sm:text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"><FaFileExcel /> <span className="hidden xs:inline">Download</span></button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-full transition-colors"><FaTimes size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50/50 custom-scrollbar" ref={contentRef}>
          <div className="p-3 sm:p-6 flex sm:grid sm:grid-cols-5 gap-2 sm:gap-4 overflow-x-auto bg-white border-b border-gray-200/50 no-scrollbar items-stretch">
            <div className="flex-1 min-w-[75px] sm:min-w-0 bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:shadow-md transition-shadow shrink-0">
              <span className="text-[7px] sm:text-[10px] font-bold uppercase text-gray-400 tracking-wider text-center leading-tight">Working Days</span>
              <span className="text-base sm:text-2xl font-black text-gray-800">{stats.workingDays}</span>
            </div>
            <div className="flex-1 min-w-[75px] sm:min-w-0 bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:shadow-md transition-shadow border-b-2 sm:border-b-4 border-b-indigo-500 shrink-0">
              <span className="text-[7px] sm:text-[10px] font-bold uppercase text-indigo-500 tracking-wider text-center leading-tight">Present</span>
              <span className="text-base sm:text-2xl font-black text-gray-800">{stats.present}</span>
            </div>
            <div className="flex-1 min-w-[75px] sm:min-w-0 bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:shadow-md transition-shadow border-b-2 sm:border-b-4 border-b-green-500 shrink-0">
              <span className="text-[7px] sm:text-[10px] font-bold uppercase text-green-500 tracking-wider text-center leading-tight">Full Days</span>
              <span className="text-base sm:text-2xl font-black text-gray-800">{stats.fullDays}</span>
            </div>
            <div className="flex-1 min-w-[75px] sm:min-w-0 bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:shadow-md transition-shadow border-b-2 sm:border-b-4 border-b-yellow-500 shrink-0">
              <span className="text-[7px] sm:text-[10px] font-bold uppercase text-yellow-600 tracking-wider text-center leading-tight">Half Days</span>
              <span className="text-base sm:text-2xl font-black text-gray-800">{stats.halfDays}</span>
            </div>
            <div className="flex-1 min-w-[75px] sm:min-w-0 bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:shadow-md transition-shadow border-b-2 sm:border-b-4 border-b-red-500 shrink-0">
              <span className="text-[7px] sm:text-[10px] font-bold uppercase text-red-500 tracking-wider text-center leading-tight">Absent</span>
              <span className="text-base sm:text-2xl font-black text-gray-800">{stats.absent}</span>
            </div>
          </div>
          <div className="px-6 mb-6 mt-4">
            <div className="flex bg-gray-200/50 p-1.5 rounded-xl w-fit border border-gray-200">
              <button onClick={() => setViewMode("daily")} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><FaList /> Daily History</button>
              <button onClick={() => setViewMode("weekly")} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "weekly" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><FaLayerGroup /> Weekly Report</button>
            </div>
          </div>
          <div className="px-6 pb-10">
            {viewMode === "daily" ? (
              <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sm:text-xs font-bold tracking-wider border-b border-gray-200 sticky top-0 z-20">
                      <tr>
                        <th className="px-4 sm:px-6 py-4">Date</th>
                        <th className="px-4 sm:px-6 py-4">Punch In</th>
                        <th className="px-4 sm:px-6 py-4">Punch Out</th>
                        <th className="px-6 py-4 hidden lg:table-cell">Assigned</th>
                        <th className="px-6 py-4 hidden md:table-cell">Duration</th>
                        <th className="px-6 py-4 hidden xl:table-cell">Login Status</th>
                        <th className="px-4 sm:px-6 py-4">Worked Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {completeHistory.length > 0 ? (completeHistory.map((item, idx) => (
                        <tr key={idx} className={`transition-all duration-200 ${item.rowClass}`}>
                          <td className="px-4 sm:px-6 py-4 font-semibold text-gray-800">
                            {formatDateDMY(item.date)}
                            <div className="text-[10px] font-medium text-gray-400 uppercase mt-0.5">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-green-600 font-semibold">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                          <td className="px-4 sm:px-6 py-4 text-red-600 font-semibold">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                          <td className="px-6 py-4 text-gray-500 font-medium hidden lg:table-cell">{formatDecimalHours(item.shiftHours)}</td>
                          <td className="px-6 py-4 font-mono font-bold text-gray-700 hidden md:table-cell">{item.displayTime}</td>
                          <td className="px-6 py-4 hidden xl:table-cell">{item.loginStatus !== "--" && (<span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide ${item.loginStatus === "LATE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.loginStatus}</span>)}</td>
                          <td className="px-4 sm:px-6 py-4 font-semibold"><span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : item.isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{item.workedStatus}</span></td>
                        </tr>
                      ))) : (<tr><td colSpan="7" className="text-center p-10 text-gray-500 font-medium bg-white">No data for selected range.</td></tr>)}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Daily Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {completeHistory.length > 0 ? (completeHistory.map((item, idx) => (
                    <div key={idx} className={`p-4 space-y-3 ${item.rowClass}`}>
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-gray-800 text-sm">
                          {formatDateDMY(item.date)}
                          <span className="ml-2 text-[10px] text-gray-400 font-medium uppercase">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : item.isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{item.workedStatus}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-white/50 p-2.5 rounded-xl border border-gray-100/50">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Punch In</p>
                          <p className="text-[11px] font-bold text-green-600">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Punch Out</p>
                          <p className="text-[11px] font-bold text-red-600">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Worked</p>
                          <p className="text-[11px] font-mono font-bold text-gray-700">{item.displayTime || "--"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Status</p>
                          <p className="text-[11px] font-bold">{item.loginStatus !== "--" ? <span className={item.loginStatus === "LATE" ? "text-red-600" : "text-green-600"}>{item.loginStatus}</span> : "--"}</p>
                        </div>
                      </div>
                    </div>
                  ))) : (<div className="text-center p-10 text-gray-500 font-medium">No records found.</div>)}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {weeklyHistory.length > 0 ? (weeklyHistory.map((week, wIdx) => {
                  const isExpanded = expandedWeeks[week.weekStart];
                  return (
                    <div key={wIdx} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
                      <div className="bg-gray-50 border-b border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
                          <div><span className="text-[9px] font-bold uppercase text-gray-400 tracking-widest block mb-0.5">Weekly Range</span><span className="text-sm sm:text-base font-bold text-gray-800">{formatDateDMY(week.weekStart)} — {formatDateDMY(week.weekEnd)}</span></div>
                          <button onClick={() => toggleWeekExpansion(week.weekStart)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase text-gray-600 transition-colors shadow-sm"><FaInfoCircle className="text-blue-500" /> {isExpanded ? "Hide" : "Details"} {isExpanded ? <FaChevronUp /> : <FaChevronDown />}</button>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
                          <span className="text-[9px] font-bold uppercase text-gray-400 tracking-widest block mb-0.5">Total Hours</span>
                          <span className="text-lg sm:text-xl font-black text-green-600 font-mono bg-green-50 px-3 py-1 rounded-lg border border-green-100/50">{formatDecimalHours(week.totalHours)}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-4 sm:p-5 bg-gray-50/50 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 animate-in slide-in-from-top duration-300">
                          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border-l-4 border-green-500 border border-gray-100"><p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Full</p><p className="text-base sm:text-xl font-black text-gray-800 mt-1">{week.stats.full}</p></div>
                          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border-l-4 border-yellow-500 border border-gray-100"><p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Half</p><p className="text-base sm:text-xl font-black text-gray-800 mt-1">{week.stats.half}</p></div>
                          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border-l-4 border-red-500 border border-gray-100"><p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Abs</p><p className="text-base sm:text-xl font-black text-gray-800 mt-1">{week.stats.absent}</p></div>
                          <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border-l-4 border-orange-500 border border-gray-100"><p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Late</p><p className="text-base sm:text-xl font-black text-gray-800 mt-1">{week.stats.late}</p></div>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="hidden md:table min-w-full text-sm text-left whitespace-nowrap">
                          <thead className="bg-white text-gray-400 uppercase text-[10px] sm:text-[11px] font-bold tracking-wider border-b border-gray-100">
                            <tr>
                              <th className="px-4 sm:px-6 py-3">Day</th>
                              <th className="px-4 sm:px-6 py-3">Punch In</th>
                              <th className="px-4 sm:px-6 py-3">Punch Out</th>
                              <th className="px-6 py-3 text-center hidden md:table-cell">Login Status</th>
                              <th className="px-6 py-3 text-right hidden sm:table-cell">Hours Worked</th>
                              <th className="px-4 sm:px-6 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {week.days.map((day, dIdx) => (
                              <tr key={dIdx} className={day.rowClass}>
                                <td className="px-4 sm:px-6 py-3.5 font-semibold text-gray-700">
                                  {formatDateDMY(day.date)}
                                  <span className="ml-1 text-[10px] text-gray-400 font-medium uppercase bg-gray-100 px-1 py-0.5 rounded sm:ml-2 sm:px-1.5">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                </td>
                                <td className="px-4 sm:px-6 py-3.5 font-medium text-gray-600">{day.punchIn ? new Date(day.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                                <td className="px-4 sm:px-6 py-3.5 font-medium text-gray-600">{day.punchOut ? new Date(day.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                                <td className="px-6 py-3.5 text-center hidden md:table-cell">{day.loginStatus !== "--" && (<span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${day.loginStatus === "LATE" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>{day.loginStatus}</span>)}</td>
                                <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-700 hidden sm:table-cell">{day.displayTime || "0h 0m"}</td>
                                <td className="px-4 sm:px-6 py-3.5"><span className={`px-2 sm:px-2.5 py-1 rounded-full font-bold text-[9px] sm:text-[10px] ${day.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border border-green-100" : day.isAbsent ? "bg-red-50 text-red-700 border border-red-100" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>{day.workedStatus}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Mobile Weekly Detail Cards */}
                        <div className="md:hidden divide-y divide-gray-50">
                          {week.days.map((day, dIdx) => (
                            <div key={dIdx} className={`p-4 space-y-2 ${day.rowClass}`}>
                              <div className="flex justify-between items-center">
                                <div className="text-[11px] font-bold text-gray-700">{formatDateDMY(day.date)} <span className="ml-1 text-[9px] text-gray-400 uppercase">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span></div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm ${day.workedStatus === "Full Day" ? "bg-green-50 text-green-700" : day.isAbsent ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>{day.workedStatus}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <div className="flex gap-3">
                                  <span className="text-green-600 font-medium">In: {day.punchIn ? new Date(day.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</span>
                                  <span className="text-red-600 font-medium">Out: {day.punchOut ? new Date(day.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</span>
                                </div>
                                <div className="font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{day.displayTime || "0h 0m"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })) : (<div className="text-center p-10 bg-white rounded-2xl border border-gray-200 text-gray-500 font-medium shadow-sm">No weekly history available.</div>)}
              </div>
            )}
          </div>
        </div>
    </ModalWrapper>
  );
};

const StatusListModal = ({ isOpen, onClose, title, employees, employeeImages, allEmployees, loading, onPunchOut, date }) => {
  if (!isOpen) return null;
  const employeeInfoMap = useMemo(() => { const map = {}; allEmployees.forEach(emp => { map[emp.employeeId] = { name: emp.name, role: getCurrentRole(emp) }; }); return map; }, [allEmployees]);
  const empIdDisplayMap = useMemo(() => {
    const map = {};
    allEmployees.forEach(emp => {
      map[emp.employeeId] = emp.supportAdminId || emp.employeeId;
    });
    return map;
  }, [allEmployees]);
  const isLoginRequired = title === "Login Required";
  const isOnBreakModal = title === "On Break";
  const isWorkingModal = title === "Currently Working";
  const canPunchOutInModal = isWorkingModal || isOnBreakModal;

  const getBreakStartTime = (emp) => { if (!emp.breakSessions || emp.breakSessions.length === 0) return null; const openBreak = [...emp.breakSessions].reverse().find(b => !b.to); return openBreak ? openBreak.from : emp.breakSessions[emp.breakSessions.length - 1]?.from; };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      backdropClass="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200"
      containerClass="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-scaleIn"
    >
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">{isOnBreakModal && <FaCoffee className="text-amber-500" />}{title}</h3>
            {!loading && <p className="text-sm text-gray-500 font-medium mt-0.5">{employees.length} Support Admins</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"><FaTimes size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500"><FaSpinner className="animate-spin text-3xl mb-3 text-blue-500" />Loading...</div>
          ) : employees.length > 0 ? (
            <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sm:text-[11px] font-bold tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-4 sm:px-6 py-4">Support Admin</th>
                      <th className="px-6 py-4 hidden md:table-cell">Role</th>
                      {isOnBreakModal && <th className="px-4 sm:px-6 py-4">Break At</th>}
                      {isOnBreakModal && <th className="px-6 py-4 hidden sm:table-cell">Total Break Time</th>}
                      {!isLoginRequired && !isOnBreakModal && <th className="px-6 py-4 hidden sm:table-cell">Worked Status</th>}
                      {canPunchOutInModal && <th className="px-4 sm:px-6 py-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {employees.map((emp, index) => {
                      const employeeInfo = employeeInfoMap[emp.employeeId] || {};
                      const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                      const breakStartTime = isOnBreakModal ? getBreakStartTime(emp) : null;
                      const totalBreakSecs = isOnBreakModal ? calcTotalBreakSeconds(emp.breakSessions || []) : 0;
                      return (
                        <tr key={emp.employeeId || index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-gray-500 font-bold border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                                {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.name || emp.employeeName || "U").charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-800 text-xs sm:text-sm truncate">{emp.name || emp.employeeName || employeeInfo.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{empIdDisplayMap[emp.employeeId] || emp.employeeId}</p>
                                <p className="text-[10px] text-blue-600 font-medium md:hidden truncate">{employeeInfo.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell"><span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">{employeeInfo.role || "N/A"}</span></td>
                          {isOnBreakModal && (
                            <td className="px-4 sm:px-6 py-4">
                              {breakStartTime ? (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                                    <FaCoffee size={10} /> {new Date(breakStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  <span className="text-[10px] font-mono text-orange-600 sm:hidden">{formatBreakDuration(totalBreakSecs)}</span>
                                </div>
                              ) : (<span className="text-gray-400 text-xs">--</span>)}
                            </td>
                          )}
                          {isOnBreakModal && (<td className="px-6 py-4 hidden sm:table-cell"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100 font-mono">{formatBreakDuration(totalBreakSecs)}</span></td>)}
                          {!isLoginRequired && !isOnBreakModal && (<td className="px-6 py-4 hidden sm:table-cell">{emp.displayLoginStatus && (<span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-bold ${emp.displayLoginStatus === 'LATE' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{emp.displayLoginStatus}</span>)}</td>)}
                          {canPunchOutInModal && (
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <button onClick={() => onPunchOut(emp)} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-[10px] font-bold transition-all shadow-sm border border-red-100"><FaSignOutAlt size={10} /> Punch Out</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {employees.map((emp, index) => {
                  const employeeInfo = employeeInfoMap[emp.employeeId] || {};
                  const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                  const breakStartTime = isOnBreakModal ? getBreakStartTime(emp) : null;
                  const totalBreakSecs = isOnBreakModal ? calcTotalBreakSeconds(emp.breakSessions || []) : 0;
                  return (
                    <div key={emp.employeeId || index} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 font-bold border border-gray-200 overflow-hidden bg-gray-50">
                            {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.name || emp.employeeName || "U").charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{emp.name || emp.employeeName || employeeInfo.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{empIdDisplayMap[emp.employeeId] || emp.employeeId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{employeeInfo.role || "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center justify-between bg-gray-50/50 p-2.5 rounded-xl border border-gray-100/50">
                        {isOnBreakModal && (
                          <div className="flex gap-3">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-gray-400 font-bold uppercase">Break At</span>
                              <span className="text-[10px] font-bold text-amber-600">{breakStartTime ? new Date(breakStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-gray-400 font-bold uppercase">Duration</span>
                              <span className="text-[10px] font-bold text-orange-600 font-mono">{formatBreakDuration(totalBreakSecs)}</span>
                            </div>
                          </div>
                        )}
                        {!isLoginRequired && !isOnBreakModal && emp.displayLoginStatus && (
                          <div className="flex flex-col">
                            <span className="text-[8px] text-gray-400 font-bold uppercase">Status</span>
                            <span className={`text-[10px] font-bold ${emp.displayLoginStatus === 'LATE' ? 'text-red-600' : 'text-green-600'}`}>{emp.displayLoginStatus}</span>
                          </div>
                        )}
                        {canPunchOutInModal && (
                          <button onClick={() => onPunchOut(emp)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold shadow-sm"><FaSignOutAlt /> Punch Out</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="text-center text-slate-500 py-8">No support admins in this category.</p>}
        </div>
    </ModalWrapper>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange, setItemsPerPage }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  if (totalItems === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-4 bg-white border-t border-gray-200 gap-4">
      <div className="flex items-center gap-3 order-2 sm:order-1">
        <label className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">Rows per page:</label>
        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); onPageChange(1); }} className="bg-gray-50 border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
      <div className="flex flex-col min-[480px]:flex-row items-center gap-3 sm:gap-6 order-1 sm:order-2 w-full sm:w-auto">
        <span className="text-[11px] sm:text-sm font-bold text-gray-500 order-2 min-[480px]:order-1 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Showing <span className="text-gray-900">{startItem}-{endItem}</span> of <span className="text-blue-600">{totalItems}</span></span>
        <div className="flex rounded-xl shadow-sm border border-gray-200 overflow-hidden order-1 min-[480px]:order-2 w-full min-[480px]:w-auto">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="flex-1 min-[480px]:px-6 py-2.5 text-xs sm:text-sm font-black text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 border-r border-gray-200 transition-all active:bg-gray-100">Prev</button>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="flex-1 min-[480px]:px-6 py-2.5 text-xs sm:text-sm font-black text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:bg-gray-50 transition-all active:bg-gray-100">Next</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const SupportAdminAttendance = () => {
  const location = useLocation();
  const todayISO = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [rawDailyData, setRawDailyData] = useState([]);
  const [dailyTotalItems, setDailyTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const [allEmployees, setAllEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  const [summaryStartDate, setSummaryStartDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
  const [summaryEndDate, setSummaryEndDate] = useState(todayISO);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rawSummaryData, setRawSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [overtimeData, setOvertimeData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [statusListModal, setStatusListModal] = useState({ isOpen: false, title: "", employees: [], loading: false });
  const [shiftsMap, setShiftsMap] = useState({});
  const [holidays, setHolidays] = useState([]);

  const [dailyCurrentPage, setDailyCurrentPage] = useState(1);
  const [dailyItemsPerPage, setDailyItemsPerPage] = useState(10);
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const [summaryItemsPerPage, setSummaryItemsPerPage] = useState(10);

  const [punchOutModal, setPunchOutModal] = useState({ isOpen: false, employee: null });
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [summarySearchTerm, setSummarySearchTerm] = useState("");
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [punchOutRequests, setPunchOutRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [isPunchOutRequestsOpen, setIsPunchOutRequestsOpen] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState(false);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  const [dailyCounts, setDailyCounts] = useState({ working: 0, completed: 0, onBreak: 0, presentIds: [], absent: 0 });
  const [openBreakDropdownId, setOpenBreakDropdownId] = useState(null);
  const [fetchedBreaks, setFetchedBreaks] = useState({});

  const fetchShifts = useCallback(async () => {
    try { const response = await getAllShifts(); const data = Array.isArray(response) ? response : response.data || []; const map = {}; data.forEach(shift => { if (shift.employeeId) map[shift.employeeId] = shift; }); setShiftsMap(map); }
    catch (error) { console.error("Error fetching shifts:", error); }
  }, []);

  const fetchHolidays = useCallback(async () => {
    try { const response = await getHolidays(); setHolidays(response || []); }
    catch (error) { console.error("Error fetching holidays:", error); }
  }, []);

  const fetchAllEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const response = await api.get("/api/admin/support-admins");
      const supportAdmins = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      const normalizedSupportAdmins = supportAdmins.map((admin) => ({
        ...admin,
        employeeId: admin.employeeId || admin._id,
        name: admin.name || admin.email || "Support Admin",
        isActive: admin.loginEnabled !== false,
      }));
      setAllEmployees(normalizedSupportAdmins);
    }
    catch (error) { setAllEmployees([]); }
    finally { setEmployeesLoading(false); }
  }, []);

  const fetchOvertimeData = useCallback(async () => {
    try { const data = await getAllOvertimeRequests(); setOvertimeData(data); }
    catch (error) { setOvertimeData([]); }
  }, []);

  const fetchPunchOutRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await api.get("/api/punchoutreq/all");
      const requests = Array.isArray(response.data) ? response.data : [];
      setPunchOutRequests(requests);
    } catch (error) {
      console.error("Error fetching punch out requests:", error);
      setPunchOutRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const handlePunchOutRequestAction = async (requestId, status) => {
    setRequestActionLoading(true);
    try {
      const response = await api.post("/api/punchoutreq/action", { requestId, status });
      if (response.data?.success) {
        await fetchPunchOutRequests();
        await fetchDailyData();
        if (startDate === endDate) await fetchDailyCounts(startDate);
      }
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      alert(`Unable to ${status.toLowerCase()} the request: ${errMsg}`);
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleDeletePunchOutRequest = async (requestId) => {
    setRequestActionLoading(true);
    try {
      const response = await api.delete(`/api/punchoutreq/delete/${requestId}`);
      if (response.data?.success) {
        await fetchPunchOutRequests();
      }
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      alert(`Unable to delete the request: ${errMsg}`);
    } finally {
      setRequestActionLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.openPunchOutRequests) {
      setIsPunchOutRequestsOpen(true);
      // Clear state after reading to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Daily counts uses scoped API (backend already filters by adminId via middleware)
  const fetchDailyCounts = useCallback(async (date) => {
    try {
      const { data } = await api.get(`/api/attendance/admin/daily-counts?date=${date}&audience=support-admin`);
      setDailyCounts({
        working: data.workingCount,
        completed: data.completedCount,
        onBreak: data.onBreakCount,
        presentIds: data.presentIds,
        absent: allEmployees.filter(e => e.isActive !== false && !data.presentIds.includes(e.employeeId)).length
      });
    } catch (err) { console.error(err); }
  }, [allEmployees]);

  // Paginated daily log — backend scoped by adminId
  const fetchDailyData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/attendance/admin/daily-log?start=${startDate}&end=${endDate}&page=${dailyCurrentPage}&limit=${dailyItemsPerPage}&search=${dailySearchTerm}&audience=support-admin`);
      setRawDailyData(data.data || []);
      setDailyTotalItems(data.total || 0);
    } catch (error) { setRawDailyData([]); setDailyTotalItems(0); }
    finally { setLoading(false); }
  }, [startDate, endDate, dailyCurrentPage, dailyItemsPerPage, dailySearchTerm]);

  useEffect(() => { fetchShifts(); fetchHolidays(); fetchAllEmployees(); fetchOvertimeData(); fetchPunchOutRequests(); }, [fetchPunchOutRequests, fetchHolidays, fetchShifts, fetchAllEmployees, fetchOvertimeData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchDailyData(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchDailyData]);

  useEffect(() => { if (startDate === endDate && allEmployees.length > 0) fetchDailyCounts(startDate); }, [startDate, endDate, fetchDailyCounts, allEmployees]);

  useEffect(() => {
    const fetchImages = async () => {
      if (allEmployees.length === 0) return;

      const idsToFetch = allEmployees
        .map(emp => emp.employeeId)
        .filter(id => id && !employeeImages[id]);

      if (idsToFetch.length === 0) return;

      try {
        const response = await api.post("/api/profile/bulk", { employeeIds: idsToFetch });
        const profilesList = Array.isArray(response.data) ? response.data : [];
        const newImages = {};
        profilesList.forEach(profile => {
          if (profile.employeeId && profile.profilePhoto?.url) {
            newImages[profile.employeeId] = getSecureUrl(profile.profilePhoto.url);
          }
        });

        if (Object.keys(newImages).length > 0) {
          setEmployeeImages(prev => ({ ...prev, ...newImages }));
        }
      } catch (err) {
        console.error("Failed to fetch bulk profile images", err);
      }
    };

    if (allEmployees.length > 0) {
      fetchImages();
    }
  }, [allEmployees]);

  // ==========================================
  // Summary Pagination Logic (fixed loop & flicker)
  // ==========================================
  const paginatedEmployeesForSummary = useMemo(() => {
    let activeEmployees = allEmployees.filter(e => e.isActive !== false);
    if (summarySearchTerm) {
      const lowerSearch = summarySearchTerm.toLowerCase();
      activeEmployees = activeEmployees.filter(item =>
        (item.name && item.name.toLowerCase().includes(lowerSearch)) ||
        (item.employeeId && item.employeeId.toLowerCase().includes(lowerSearch))
      );
    }
    activeEmployees.sort((a, b) => a.name.localeCompare(b.name));
    return activeEmployees;
  }, [allEmployees, summarySearchTerm]);

  const currentSummaryEmployees = useMemo(() => {
    return paginatedEmployeesForSummary.slice((summaryCurrentPage - 1) * summaryItemsPerPage, summaryCurrentPage * summaryItemsPerPage);
  }, [paginatedEmployeesForSummary, summaryCurrentPage, summaryItemsPerPage]);

  // Use a stable primitive string dep to prevent infinite loops
  const currentEmpIdsStr = JSON.stringify(currentSummaryEmployees.map(e => e.employeeId));

  useEffect(() => {
    if (employeesLoading) return;
    const empIds = JSON.parse(currentEmpIdsStr);

    if (empIds.length === 0) { setRawSummaryData([]); setSummaryLoading(false); return; }

    let isMounted = true;
    const fetchSummaryForChunk = async () => {
      setSummaryLoading(true);
      try {
        // Backend scoped by adminId via protect middleware
        const { data } = await api.post(`/api/attendance/admin/date-range-for-employees`, {
          start: summaryStartDate,
          end: summaryEndDate,
          employeeIds: empIds
        });
        if (isMounted) setRawSummaryData(data || []);
      } catch (error) {
        if (isMounted) setRawSummaryData([]);
      } finally {
        if (isMounted) setSummaryLoading(false);
      }
    };

    fetchSummaryForChunk();
    return () => { isMounted = false; };
  }, [summaryStartDate, summaryEndDate, currentEmpIdsStr, employeesLoading]);

  const handleAdminPunchOut = async (employeeId, punchOutTime, location, dateOfRecord) => {
    try {
      const response = await api.post(`/api/attendance/admin-punch-out`, {
        employeeId, punchOutTime,
        latitude: location.latitude, longitude: location.longitude,
        adminId: 'Admin', date: dateOfRecord
      });
      if (response.data.success) {
        alert('Support admin punched out successfully!');
        await fetchDailyData();
        if (startDate === endDate) fetchDailyCounts(startDate);
      }
    } catch (error) { const errMsg = error.response?.data?.message || error.message; alert(`Failed to punch out: ${errMsg}`); }
  };

  const handleMonthChange = (e) => {
    const val = e.target.value; setSelectedMonth(val);
    if (val) {
      const startStr = `${val}-01`;
      const [year, month] = val.split('-').map(Number);
      const end = new Date(year, month, 0);
      const offset = end.getTimezoneOffset() * 60000;
      const endStr = new Date(end.getTime() - offset).toISOString().split('T')[0];
      setSummaryStartDate(startStr); setSummaryEndDate(endStr);
    }
  };

  const empNameMap = useMemo(() => { return allEmployees.reduce((acc, emp) => { acc[emp.employeeId] = emp.name; return acc; }, {}); }, [allEmployees]);
  const empIdDisplayMap = useMemo(() => { return allEmployees.reduce((acc, emp) => { acc[emp.employeeId] = emp.supportAdminId || emp.employeeId; return acc; }, {}); }, [allEmployees]);

  const processedDailyData = useMemo(() => {
    return rawDailyData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const adminFullDayHours = shift?.fullDayHours || 9;
      const adminHalfDayHours = shift?.halfDayHours || 4.5;
      const supportAdminName = empNameMap[item.employeeId] || item.name || item.employeeName || item.employeeId;
      return {
        ...item, supportAdminName, assignedHours: adminFullDayHours,
        workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours),
        displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus),
        isOnBreak: item.isOnBreak || false
      };
    });
  }, [rawDailyData, shiftsMap, empNameMap]);

  const toggleBreakDropdown = async (item) => {
    const id = item._id || `${item.employeeId}-${item.date}`;
    if (openBreakDropdownId === id) { setOpenBreakDropdownId(null); }
    else {
      setOpenBreakDropdownId(id);
      if (!fetchedBreaks[id]) {
        setFetchedBreaks(prev => ({ ...prev, [id]: { loading: true, data: [] } }));
        try {
          const { data } = await api.get(`/api/attendance/admin/breaks/${item.employeeId}/${item.date}`);
          setFetchedBreaks(prev => ({ ...prev, [id]: { loading: false, data: data } }));
        } catch (e) { setFetchedBreaks(prev => ({ ...prev, [id]: { loading: false, data: [] } })); }
      }
    }
  };

  const employeeSummaryStats = useMemo(() => {
    if (!currentSummaryEmployees.length) return [];
    const attendanceMap = new Map();
    rawSummaryData.forEach(r => { const key = `${r.employeeId}_${normalizeDateStr(r.date)}`; attendanceMap.set(key, r); });
    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
      if (ot.status === 'APPROVED') { const otDateStr = normalizeDateStr(ot.date); if (otDateStr >= summaryStartDate && otDateStr <= summaryEndDate) acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1; }
      return acc;
    }, {});

    return currentSummaryEmployees.map(emp => {
      const shift = shiftsMap[emp.employeeId]; const weeklyOffs = shift?.weeklyOffDays || [0]; const adminFullDayHours = shift?.fullDayHours || 9;
      let stats = { employeeId: emp.employeeId, supportAdminId: emp.supportAdminId, employeeName: emp.name, assignedHours: adminFullDayHours, presentDays: 0, onTimeDays: 0, lateDays: 0, fullDays: 0, halfDays: 0, absentDays: 0, approvedOT: approvedOTCounts[emp.employeeId] || 0 };
      const start = new Date(summaryStartDate); const end = new Date(summaryEndDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]; const key = `${emp.employeeId}_${dateStr}`; const record = attendanceMap.get(key); const holidayObj = isHoliday(dateStr, holidays); const isWeeklyOff = weeklyOffs.includes(d.getDay());
        if (record) {
          if (record.punchIn) { stats.presentDays++; if (calculateLoginStatus(record.punchIn, shift, record.loginStatus) === 'LATE') stats.lateDays++; else stats.onTimeDays++; }
          const wStat = getWorkedStatus(record.punchIn, record.punchOut, record.status, adminFullDayHours, shift?.halfDayHours || 4.5);
          if (wStat === "Full Day") stats.fullDays++; else if (wStat === "Half Day") stats.halfDays++; else if (record.status === "ABSENT" || wStat.includes("Absent")) stats.absentDays++;
        } else if (!holidayObj && !isWeeklyOff) stats.absentDays++;
      }
      return stats;
    });
  }, [currentSummaryEmployees, rawSummaryData, overtimeData, shiftsMap, holidays, summaryStartDate, summaryEndDate]);

  // Export: fetches ALL records for date range (backend scoped by adminId)
  const exportDailyLogToExcel = async () => {
    try {
      const { data } = await api.get(`/api/attendance/admin/date-range?start=${startDate}&end=${endDate}&audience=support-admin`);
      const mapped = data.map(item => ({
        ...item,
        employeeName: empNameMap[item.employeeId] || item.employeeName,
        assignedHours: shiftsMap[item.employeeId]?.fullDayHours || 9,
        displayLoginStatus: calculateLoginStatus(item.punchIn, shiftsMap[item.employeeId], item.loginStatus),
        workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, shiftsMap[item.employeeId]?.fullDayHours || 9, shiftsMap[item.employeeId]?.halfDayHours || 4.5)
      }));
      exportToExcel(mapped, `Daily_Log_${startDate}_to_${endDate}`, [
        { label: "Support Admin Name", value: item => item.employeeName },
        { label: "Support Admin ID", value: item => empIdDisplayMap[item.employeeId] || item.employeeId },
        { label: "Date", value: item => formatDateDMY(item.date) },
        { label: "Punch In", value: item => item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" },
        { label: "Punch Out", value: item => item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" },
        { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) },
        { label: "Duration", value: item => item.displayTime || "0h 0m" },
        { label: "Login Status", value: item => item.displayLoginStatus },
        { label: "Worked Status", value: item => item.workedStatus }
      ]);
    } catch (e) { alert("Error exporting full data."); }
  };

  const exportSummaryToExcel = async () => {
    try {
      const activeEmps = allEmployees.filter(e => e.isActive !== false);
      const ids = activeEmps.map(e => e.employeeId);
      const { data } = await api.post(`/api/attendance/admin/date-range-for-employees`, { start: summaryStartDate, end: summaryEndDate, employeeIds: ids });
      const attendanceMap = new Map();
      data.forEach(r => { const key = `${r.employeeId}_${normalizeDateStr(r.date)}`; attendanceMap.set(key, r); });
      const approvedOTCounts = overtimeData.reduce((acc, ot) => {
        if (ot.status === 'APPROVED') { const otDateStr = normalizeDateStr(ot.date); if (otDateStr >= summaryStartDate && otDateStr <= summaryEndDate) acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1; }
        return acc;
      }, {});
      const fullSummary = activeEmps.map(emp => {
        const shift = shiftsMap[emp.employeeId]; const weeklyOffs = shift?.weeklyOffDays || [0]; const adminFullDayHours = shift?.fullDayHours || 9;
        let stats = { employeeId: emp.employeeId, supportAdminId: emp.supportAdminId, employeeName: emp.name, assignedHours: adminFullDayHours, presentDays: 0, onTimeDays: 0, lateDays: 0, fullDays: 0, halfDays: 0, absentDays: 0, approvedOT: approvedOTCounts[emp.employeeId] || 0 };
        const start = new Date(summaryStartDate); const end = new Date(summaryEndDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]; const key = `${emp.employeeId}_${dateStr}`; const record = attendanceMap.get(key); const holidayObj = isHoliday(dateStr, holidays); const isWeeklyOff = weeklyOffs.includes(d.getDay());
          if (record) {
            if (record.punchIn) { stats.presentDays++; if (calculateLoginStatus(record.punchIn, shift, record.loginStatus) === 'LATE') stats.lateDays++; else stats.onTimeDays++; }
            const wStat = getWorkedStatus(record.punchIn, record.punchOut, record.status, adminFullDayHours, shift?.halfDayHours || 4.5);
            if (wStat === "Full Day") stats.fullDays++; else if (wStat === "Half Day") stats.halfDays++; else if (record.status === "ABSENT" || wStat.includes("Absent")) stats.absentDays++;
          } else if (!holidayObj && !isWeeklyOff) stats.absentDays++;
        }
        return stats;
      });
      exportToExcel(fullSummary, `Attendance_Summary_${summaryStartDate}_to_${summaryEndDate}`, [
        { label: "Support Admin ID", value: item => item.supportAdminId || item.employeeId },
        { label: "Support Admin Name", value: item => item.employeeName },
        { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) },
        { label: "Present Days", value: item => item.presentDays },
        { label: "On-Time Days", value: item => item.onTimeDays },
        { label: "Late Days", value: item => item.lateDays },
        { label: "Approved OT", value: item => item.approvedOT },
        { label: "Full Days", value: item => item.fullDays },
        { label: "Half Days", value: item => item.halfDays },
        { label: "Absent Days", value: item => item.absentDays },
      ]);
    } catch (e) { alert("Error exporting full data"); }
  };

  const exportToExcel = (data, fileName, fields) => {
    if (data.length === 0) { alert("No data to export."); return; }
    const formattedData = data.map(item => fields.reduce((obj, field) => { obj[field.label] = field.value(item); return obj; }, {}));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${fileName}.xlsx`);
  };

  const handleViewDetails = async (employeeId, employeeName) => {
    try {
      const { data } = await api.post(`/api/attendance/admin/date-range-for-employees`, { start: summaryStartDate, end: summaryEndDate, employeeIds: [employeeId] });
      const emp = allEmployees.find(e => e.employeeId === employeeId);
      setSelectedEmployee({ name: employeeName, records: data, employeeId, supportAdminId: emp?.supportAdminId, startDate: summaryStartDate, endDate: summaryEndDate });
      setIsModalOpen(true);
    } catch (e) { }
  };

  const handleOpenStatusModal = async (type) => {
    if (type === 'ABSENT' && startDate === endDate) {
      const absentList = allEmployees.filter(e => e.isActive !== false && !dailyCounts.presentIds.includes(e.employeeId));
      setStatusListModal({ isOpen: true, title: "Login Required", employees: absentList, loading: false });
    } else {
      setStatusListModal({ isOpen: true, title: "Loading...", employees: [], loading: true });
      try {
        const { data } = await api.get(`/api/attendance/admin/daily-status-list?date=${startDate}&type=${type}&audience=support-admin`);
        let title = type === 'WORKING' ? 'Currently Working' : type === 'COMPLETED' ? 'Shift Completed' : 'On Break';
        setStatusListModal({ isOpen: true, title, employees: data, loading: false });
      } catch (e) { setStatusListModal({ isOpen: false, title: "", employees: [], loading: false }); }
    }
  };

  const toggleSelection = (id) => { setSelectedCompareIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };
  const selectedStatsForComparison = useMemo(() => { return employeeSummaryStats.filter(s => selectedCompareIds.includes(s.employeeId)); }, [employeeSummaryStats, selectedCompareIds]);
  const pendingPunchOutRequests = useMemo(() => punchOutRequests.filter(r => r.status === 'Pending'), [punchOutRequests]);

  const StatCard = ({ icon, title, value, colorClass, onClick }) => (
    <div className={`relative flex-1 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5 overflow-hidden group ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-200' : ''}`} onClick={onClick}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass}`}></div>
      <div className="p-3 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <div>
        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-black text-gray-800 mt-1">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ========================================== */}
        {/* Daily Log Section */}
        {/* ========================================== */}
        <div className="flex flex-col space-y-6">
          <div className="p-6 border border-gray-200 shadow-sm bg-white rounded-2xl flex flex-col gap-5">

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xl font-bold text-gray-800"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FaCalendarAlt /></div> Daily Attendance Log</div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button onClick={() => setIsPunchOutRequestsOpen(true)} className="flex-1 sm:flex-none relative flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95">
                  <FaSignOutAlt size={16} />
                  <span className="truncate">Punch Out Requests</span>
                  {pendingPunchOutRequests.length > 0 && (<span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-black px-2 py-1 animate-pulse">{pendingPunchOutRequests.length}</span>)}
                </button>
                <button onClick={exportDailyLogToExcel} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all active:scale-95"><FaFileExcel size={16} /><span className="truncate">Export CSV</span></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="relative group w-full">
                <FaSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input type="text" placeholder="Search Name or ID..." value={dailySearchTerm} onChange={(e) => { setDailySearchTerm(e.target.value); setDailyCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-sm font-medium text-gray-700" />
              </div>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-sm overflow-hidden flex items-center">
                <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 h-full flex items-center shrink-0">From</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-3 pr-3 py-2.5 outline-none bg-transparent text-gray-700 font-medium text-xs sm:text-sm" />
              </div>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-sm overflow-hidden flex items-center">
                <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider border-r border-gray-200 h-full flex items-center shrink-0">To</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-3 pr-3 py-2.5 outline-none bg-transparent text-gray-700 font-medium text-xs sm:text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard icon={<FaClock className="text-orange-500 text-2xl" />} title="Currently Working" value={dailyCounts.working} colorClass="bg-orange-500" onClick={() => handleOpenStatusModal('WORKING')} />
            <StatCard icon={<FaCheckCircle className="text-green-500 text-2xl" />} title="Shift Completed" value={dailyCounts.completed} colorClass="bg-green-500" onClick={() => handleOpenStatusModal('COMPLETED')} />
            <StatCard icon={<FaCoffee className="text-amber-500 text-2xl" />} title="On Break" value={dailyCounts.onBreak} colorClass="bg-amber-500" onClick={() => handleOpenStatusModal('ON_BREAK')} />
            {startDate === endDate && (<StatCard icon={<FaUserSlash className="text-red-500 text-2xl" />} title="Login Required" value={dailyCounts.absent} colorClass="bg-red-500" onClick={() => handleOpenStatusModal('ABSENT')} />)}

          </div>

          <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 sm:px-6 py-4">Support Admin</th>
                    <th className="px-6 py-4 hidden md:table-cell">Date</th>
                    <th className="px-4 sm:px-6 py-4">Punch In</th>
                    <th className="px-4 sm:px-6 py-4">Punch Out</th>
                    <th className="px-6 py-4 hidden lg:table-cell">Work Hrs</th>
                    <th className="px-6 py-4 hidden sm:table-cell">Duration</th>
                    <th className="px-6 py-4 hidden xl:table-cell">Login Status</th>
                    <th className="px-6 py-4 hidden lg:table-cell">Worked Status</th>
                    <th className="px-6 py-4 hidden xl:table-cell">Breaks</th>
                    <th className="px-4 sm:px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    <tr><td colSpan="10" className="text-center p-10 font-medium text-gray-500"><FaSpinner className="animate-spin text-xl inline-block mr-2 text-blue-500" />Loading daily log...</td></tr>
                  ) : processedDailyData.length === 0 ? (
                    <tr><td colSpan="10" className="text-center p-10 text-gray-500 font-medium">No records found.</td></tr>
                  ) : processedDailyData.map((item, idx) => {
                    const isAbsent = item.status === "ABSENT" || item.workedStatus.includes("Absent");
                    const canPunchOut = item.punchIn && !item.isFinalPunchOut && !item.adminPunchOut;
                    const punchInColor = item.displayLoginStatus === 'LATE' ? 'text-red-600' : 'text-green-600';
                    const punchOutColor = item.workedStatus === 'Full Day' ? 'text-green-600' : 'text-red-600';
                    const profilePic = employeeImages ? employeeImages[item.employeeId] : null;
                    const breakState = fetchedBreaks[item._id || `${item.employeeId}-${item.date}`];
                    const rowBreakSessions = breakState?.data || [];
                    const rowTotalBreakSecs = calcTotalBreakSeconds(rowBreakSessions);

                    return (
                      <tr key={item._id || idx} className={`hover:bg-gray-50 transition-colors ${isAbsent ? "bg-red-50/20" : "bg-white"}`}>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow shrink-0" onClick={() => profilePic && setPreviewImage(profilePic)}>
                              {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (item.supportAdminName || "U").charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-800 text-xs sm:text-sm truncate">{item.supportAdminName}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-gray-500 font-mono text-[10px]">{empIdDisplayMap[item.employeeId] || item.employeeId}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 md:hidden mt-1">{formatDateDMY(item.date)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-600 hidden md:table-cell">{formatDateDMY(item.date)}</td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className={`font-bold text-xs sm:text-sm ${punchInColor}`}>{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</div>
                          {item.punchIn && <div className="hidden sm:block"><LocationViewButton location={item.punchInLocation} /></div>}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          {item.isOnBreak ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[9px] sm:text-[11px] bg-amber-50 border border-amber-100 px-1.5 sm:px-2 py-0.5 rounded-full animate-pulse"><FaCoffee size={9} /> On Break</span>
                          ) : (
                            <>
                              <div className={`font-bold text-xs sm:text-sm ${item.punchOut ? punchOutColor : 'text-gray-400'}`}>{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</div>
                              {item.punchOut && !item.isOnBreak && <div className="hidden sm:block"><LocationViewButton location={item.punchOutLocation} /></div>}
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-500 hidden lg:table-cell">{formatDecimalHours(item.assignedHours)}</td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-700 hidden sm:table-cell">
                          {(item.status === "WORKING" && item.punchIn) ? <LiveTimer startTime={item.punchIn} /> : (item.displayTime || "0h 0m 0s")}
                        </td>
                        <td className="px-6 py-4 hidden xl:table-cell">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${item.displayLoginStatus === "LATE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.displayLoginStatus}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold hidden lg:table-cell">
                          {item.isOnBreak ? (
                            <span className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-sm border bg-amber-50 text-amber-700 border-amber-200 animate-pulse flex items-center gap-1.5 w-fit"><FaCoffee size={9} /> On Break</span>
                          ) : (
                            <span className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-sm border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{item.workedStatus}</span>
                          )}
                        </td>

                        <td className="px-6 py-4 hidden xl:table-cell">
                          {item.breakCount > 0 ? (
                            <div className="relative">
                              <button onClick={() => toggleBreakDropdown(item)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-lg hover:bg-amber-100 transition-colors">
                                <FaCoffee size={10} />{item.breakCount} Break{item.breakCount > 1 ? "s" : ""}<FaChevronDown size={8} className={`transition-transform duration-200 ${openBreakDropdownId === (item._id || `${item.employeeId}-${item.date}`) ? "rotate-180" : ""}`} />
                              </button>
                              {openBreakDropdownId === (item._id || `${item.employeeId}-${item.date}`) && (
                                <div className="absolute right-0 sm:left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[260px] overflow-hidden animate-in slide-in-from-top-2 duration-150">
                                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5"><FaCoffee className="text-amber-500" size={10} /><span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Break Sessions</span></div>
                                  {breakState?.loading ? (
                                    <div className="px-3 py-4 text-center text-xs text-amber-600"><FaSpinner className="animate-spin inline mr-1" /> Loading breaks...</div>
                                  ) : (
                                    <>
                                      {rowBreakSessions.map((brk, bIdx) => {
                                        const dur = calcBreakSessionDuration(brk);
                                        return (
                                          <div key={bIdx} className="px-3 py-2.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-gray-400 uppercase w-6">{bIdx + 1}</span>
                                              <div className="flex items-center gap-1 text-[11px] font-semibold">
                                                <span className="text-green-600">{brk.from ? new Date(brk.from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</span>
                                                <span className="text-gray-300">→</span>
                                                <span className="text-red-600">{brk.to ? new Date(brk.to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-amber-500 animate-pulse">Active</span>}</span>
                                              </div>
                                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-mono">{formatBreakDuration(dur)}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Break</span>
                                        <span className="text-[11px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 font-mono">{formatBreakDuration(rowTotalBreakSecs)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (<span className="text-gray-400 text-xs font-medium">--</span>)}
                        </td>

                        <td className="px-4 sm:px-6 py-4 text-center">
                          {canPunchOut ? (
                            <button onClick={() => setPunchOutModal({ isOpen: true, employee: item })} className="flex items-center justify-center gap-1.5 px-2 py-1 bg-white border border-red-200 text-red-600 text-[9px] sm:text-[10px] font-bold rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm mx-auto"><FaSignOutAlt size={10} /> <span className="hidden xs:inline">Punch Out</span></button>
                          ) : (item.isFinalPunchOut || item.adminPunchOut) ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-[10px] sm:text-[11px] font-bold rounded-lg mx-auto"><FaCheckCircle className="text-green-500" /> <span className="hidden xs:inline">Done</span></span>
                          ) : (<span className="text-gray-400 text-xs font-medium">--</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-gray-100">
              {loading ? (
                <div className="text-center p-10 font-medium text-gray-500"><FaSpinner className="animate-spin text-xl inline-block mr-2 text-blue-500" />Loading daily log...</div>
              ) : processedDailyData.length === 0 ? (
                <div className="text-center p-10 text-gray-500 font-medium">No records found.</div>
              ) : processedDailyData.map((item, idx) => {
                const isAbsent = item.status === "ABSENT" || item.workedStatus.includes("Absent");
                const canPunchOut = item.punchIn && !item.isFinalPunchOut && !item.adminPunchOut;
                const punchInColor = item.displayLoginStatus === 'LATE' ? 'text-red-600' : 'text-green-600';
                const punchOutColor = item.workedStatus === 'Full Day' ? 'text-green-600' : 'text-red-600';
                const profilePic = employeeImages ? employeeImages[item.employeeId] : null;

                return (
                  <div key={item._id || idx} className={`p-4 space-y-4 ${isAbsent ? "bg-red-50/20" : "bg-white hover:bg-gray-50 transition-colors"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 shrink-0" onClick={() => profilePic && setPreviewImage(profilePic)}>
                          {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (item.supportAdminName || "U").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800 text-sm truncate">{item.supportAdminName}</div>
                          <div className="text-[10px] text-gray-500 font-mono truncate">{empIdDisplayMap[item.employeeId] || item.employeeId}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase ${item.displayLoginStatus === "LATE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.displayLoginStatus}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{item.workedStatus}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Date</p>
                        <p className="text-[11px] font-semibold text-gray-700">{formatDateDMY(item.date)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Duration</p>
                        <p className="text-[11px] font-mono font-bold text-gray-700">{(item.status === "WORKING" && item.punchIn) ? <LiveTimer startTime={item.punchIn} /> : (item.displayTime || "0h 0m")}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Punch In</p>
                        <p className={`text-[11px] font-bold ${punchInColor}`}>{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Punch Out</p>
                        <p className={`text-[11px] font-bold ${item.punchOut ? punchOutColor : 'text-gray-400'}`}>{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      {item.breakCount > 0 && (
                        <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 flex items-center gap-1">
                          <FaCoffee size={10} /> {item.breakCount} Break{item.breakCount > 1 ? 's' : ''}
                        </div>
                      )}
                      <div className="flex-1 flex justify-end">
                        {canPunchOut ? (
                          <button onClick={() => setPunchOutModal({ isOpen: true, employee: item })} className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg shadow-sm active:scale-95 transition-all"><FaSignOutAlt size={10} /> Punch Out Now</button>
                        ) : (item.isFinalPunchOut || item.adminPunchOut) ? (
                          <span className="text-[10px] font-bold text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100"><FaCheckCircle /> Shift Completed</span>
                        ) : (<span className="text-gray-400 text-xs">--</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination totalItems={dailyTotalItems} itemsPerPage={dailyItemsPerPage} currentPage={dailyCurrentPage} onPageChange={setDailyCurrentPage} setItemsPerPage={setDailyItemsPerPage} />
          </div>
        </div>

        {/* ========================================== */}
        {/* Support Admin Attendance Summary Section */}
        {/* ========================================== */}
        <div className="flex flex-col space-y-6 mt-10">
          <div className="p-6 border border-gray-200 shadow-sm bg-white rounded-2xl flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FaUsers size={20} /></div><h2 className="text-xl font-bold text-gray-800">Support Admin Attendance Summary</h2></div>
              <div className="flex items-center gap-2 sm:gap-3">
                {!isCompareMode ? (
                  <button onClick={() => setIsCompareMode(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95"><FaExchangeAlt className="text-blue-500" /> Compare</button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 animate-in slide-in-from-right duration-300">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full">{selectedCompareIds.length} Selected</span>
                    <button onClick={() => { if (selectedCompareIds.length < 2) alert("Select at least 2 support admins to compare."); else setIsComparisonModalOpen(true); }} className="px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl shadow hover:bg-green-700 transition-all">Proceed</button>
                    <button onClick={() => { setIsCompareMode(false); setSelectedCompareIds([]); }} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                )}
                <button onClick={exportSummaryToExcel} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition-transform active:scale-95"><FaFileExcel size={16} /> <span className="hidden xs:inline">Export</span></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 items-end">
              <div className="relative group w-full">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1 block">Search Support Admin</label>
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500" />
                  <input type="text" placeholder="Name or ID..." value={summarySearchTerm} onChange={(e) => { setSummarySearchTerm(e.target.value); setSummaryCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-sm font-medium" />
                </div>
              </div>
              <div className="w-full">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1 block">Select Month</label>
                <div className="relative"><FaCalendarDay className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input type="month" value={selectedMonth} onChange={handleMonthChange} className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium" /></div>
              </div>
              <div className="w-full">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1 block">From Date</label>
                <input type="date" value={summaryStartDate} onChange={(e) => setSummaryStartDate(e.target.value)} className="px-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium text-gray-700" />
              </div>
              <div className="w-full">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1 block">To Date</label>
                <input type="date" value={summaryEndDate} onChange={(e) => setSummaryEndDate(e.target.value)} className="px-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium text-gray-700" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sm:text-[11px] font-bold tracking-wider border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                  <tr>
                    {isCompareMode && <th className="px-4 sm:px-6 py-4 text-center">Sel</th>}
                    <th className="px-4 sm:px-6 py-4">Support Admin</th>
                    <th className="px-6 py-4 text-center hidden lg:table-cell">Assigned</th>
                    <th className="px-4 sm:px-6 py-4 text-center">Pres</th>
                    <th className="px-6 py-4 text-center hidden sm:table-cell">On Time</th>
                    <th className="px-6 py-4 text-center hidden sm:table-cell">Late</th>
                    <th className="px-6 py-4 text-center hidden md:table-cell">OT</th>
                    <th className="px-6 py-4 text-center hidden lg:table-cell">Full</th>
                    <th className="px-6 py-4 text-center hidden lg:table-cell">Half</th>
                    <th className="px-4 sm:px-6 py-4 text-center">Abs</th>
                    <th className="px-4 sm:px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {summaryLoading || employeesLoading ? (
                    <tr><td colSpan="11" className="text-center p-10 text-gray-500 font-medium"><FaSpinner className="animate-spin text-xl inline-block mr-2 text-blue-500" />Loading summary...</td></tr>
                  ) : employeeSummaryStats.length === 0 ? (
                    <tr><td colSpan="11" className="text-center p-10 text-gray-500 font-medium">No summary data available.</td></tr>
                  ) : employeeSummaryStats.map((emp) => {
                    const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                    return (
                      <tr key={emp.employeeId} className={`transition-colors ${selectedCompareIds.includes(emp.employeeId) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        {isCompareMode && (
                          <td className="px-4 sm:px-6 py-4 text-center"><input type="checkbox" className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selectedCompareIds.includes(emp.employeeId)} onChange={() => toggleSelection(emp.employeeId)} /></td>
                        )}
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow shrink-0" onClick={() => profilePic && setPreviewImage(profilePic)}>
                              {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.employeeName || "U").charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-800 text-xs sm:text-sm truncate">{emp.employeeName}</div>
                              <div className="text-gray-500 font-mono text-[10px] mt-0.5 truncate">{emp.supportAdminId || emp.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-500 hidden lg:table-cell">{formatDecimalHours(emp.assignedHours)}</td>
                        <td className="px-4 sm:px-6 py-4 text-center font-black text-blue-700 bg-blue-50/30 text-sm sm:text-lg">{emp.presentDays}</td>
                        <td className="px-6 py-4 text-center font-bold text-green-600 hidden sm:table-cell">{emp.onTimeDays}</td>
                        <td className="px-6 py-4 text-center font-bold text-red-600 hidden sm:table-cell">{emp.lateDays}</td>
                        <td className="px-6 py-4 text-center font-bold text-indigo-600 hidden md:table-cell">{emp.approvedOT}</td>
                        <td className="px-6 py-4 text-center font-semibold text-gray-700 hidden lg:table-cell">{emp.fullDays}</td>
                        <td className="px-6 py-4 text-center font-semibold text-gray-700 hidden lg:table-cell">{emp.halfDays}</td>
                        <td className="px-4 sm:px-6 py-4 text-center text-red-600 font-black text-sm sm:text-lg">{emp.absentDays}</td>
                        <td className="px-4 sm:px-6 py-4 text-center">
                          <button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"><FaEye size={14} className="sm:w-4 sm:h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Summary Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {summaryLoading || employeesLoading ? (
                <div className="text-center p-10 text-gray-500 font-medium"><FaSpinner className="animate-spin text-xl inline-block mr-2 text-blue-500" />Loading summary...</div>
              ) : employeeSummaryStats.length === 0 ? (
                <div className="text-center p-10 text-gray-500 font-medium">No summary data available.</div>
              ) : employeeSummaryStats.map((emp) => {
                const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                return (
                  <div key={emp.employeeId} className={`p-4 space-y-4 ${selectedCompareIds.includes(emp.employeeId) ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50 transition-colors'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isCompareMode && (<input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selectedCompareIds.includes(emp.employeeId)} onChange={() => toggleSelection(emp.employeeId)} />)}
                        <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 shrink-0" onClick={() => profilePic && setPreviewImage(profilePic)}>
                          {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.employeeName || "U").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800 text-sm truncate">{emp.employeeName}</div>
                          <div className="text-[10px] text-gray-500 font-mono truncate">{emp.supportAdminId || emp.employeeId}</div>
                        </div>
                      </div>
                      <button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-sm"><FaEye size={14} /></button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50/50 p-2 rounded-lg text-center border border-blue-100/50">
                        <p className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Present</p>
                        <p className="text-sm font-black text-blue-700">{emp.presentDays}</p>
                      </div>
                      <div className="bg-green-50/50 p-2 rounded-lg text-center border border-green-100/50">
                        <p className="text-[8px] font-bold text-green-400 uppercase tracking-tighter">On Time</p>
                        <p className="text-sm font-black text-green-700">{emp.onTimeDays}</p>
                      </div>
                      <div className="bg-red-50/50 p-2 rounded-lg text-center border border-red-100/50">
                        <p className="text-[8px] font-bold text-red-400 uppercase tracking-tighter">Absent</p>
                        <p className="text-sm font-black text-red-700">{emp.absentDays}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <div className="flex gap-4">
                        <div className="text-[10px] font-medium text-gray-500">Late: <span className="font-bold text-orange-600">{emp.lateDays}</span></div>
                        <div className="text-[10px] font-medium text-gray-500">OT: <span className="font-bold text-indigo-600">{emp.approvedOT}</span></div>
                      </div>
                      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{formatDecimalHours(emp.assignedHours)} Shift</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination totalItems={paginatedEmployeesForSummary.length} itemsPerPage={summaryItemsPerPage} currentPage={summaryCurrentPage} onPageChange={setSummaryCurrentPage} setItemsPerPage={setSummaryItemsPerPage} />
          </div>
        </div>
      </div>

      <AttendanceDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} employeeData={selectedEmployee} shiftsMap={shiftsMap} holidays={holidays} dateRange={{ startDate: summaryStartDate, endDate: summaryEndDate }} employeeImages={employeeImages} />
      <StatusListModal
        isOpen={statusListModal.isOpen}
        onClose={() => setStatusListModal({ ...statusListModal, isOpen: false })}
        title={statusListModal.title}
        employees={statusListModal.employees}
        loading={statusListModal.loading}
        employeeImages={employeeImages}
        allEmployees={allEmployees}
        date={startDate}
        onPunchOut={(emp) => {
          // Prepare support admin object for AdminPunchOutModal
          // StatusListModal employees have slightly different structure from rawDailyData
          const empForPunchOut = {
            ...emp,
            employeeName: emp.name || emp.employeeName || (allEmployees.find(e => e.employeeId === emp.employeeId)?.name),
            date: startDate,
            punchIn: emp.punchIn || (rawDailyData.find(d => d.employeeId === emp.employeeId && d.date === startDate)?.punchIn)
          };
          setPunchOutModal({ isOpen: true, employee: empForPunchOut });
          setStatusListModal(prev => ({ ...prev, isOpen: false }));
        }}
      />
      <AdminPunchOutModal isOpen={punchOutModal.isOpen} onClose={() => setPunchOutModal({ isOpen: false, employee: null })} employee={punchOutModal.employee} onPunchOut={handleAdminPunchOut} />
      <PunchOutRequestsModal isOpen={isPunchOutRequestsOpen} onClose={() => setIsPunchOutRequestsOpen(false)} requests={punchOutRequests} loading={requestsLoading} onAction={handlePunchOutRequestAction} onDelete={handleDeletePunchOutRequest} actionLoading={requestActionLoading} />
      <AttendanceComparisonModal isOpen={isComparisonModalOpen} onClose={() => setIsComparisonModalOpen(false)} selectedStats={selectedStatsForComparison} employeeImages={employeeImages} startDate={summaryStartDate} endDate={summaryEndDate} />

      {previewImage && (
        <div className="fixed inset-0 z-[200] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"><FaTimes size={24} /></button>
          <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default SupportAdminAttendance;