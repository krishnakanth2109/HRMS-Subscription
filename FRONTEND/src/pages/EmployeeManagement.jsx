// --- START OF FILE src/pages/EmployeeManagement.jsx ---

import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react"; 
import { FaUser, FaEdit, FaTrash, FaRedo, FaDownload, FaEye, FaClipboardList, FaCalendarAlt, FaFileExcel, FaTimes } from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import api, { 
  getEmployees, 
  deactivateEmployeeById, 
  activateEmployeeById, 
  getAttendanceByDateRange, 
  getAllShifts, 
  getLeaveRequests, 
  getHolidays 
} from "../api";

// ==========================================
// HELPER FUNCTIONS & CONSTANTS
// ==========================================

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

// Helper: Get Department (Prioritize root, then experience)
const getCurrentDepartment = (employee) => {
  if (employee.currentDepartment) return employee.currentDepartment;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
    return currentExp?.department || "N/A";
  }
  return "N/A";
};

// Helper: Get Role (Prioritize root, then experience)
const getCurrentRole = (employee) => {
  if (employee.currentRole) return employee.currentRole;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
    return currentExp?.role || "N/A";
  }
  return "N/A";
};

// ✅ Helper: Get Employment Type (New function for filter)
const getCurrentEmploymentType = (employee) => {
  if (employee && Array.isArray(employee.experienceDetails)) {
    // Check for "Present" or fall back to the last entry
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present") || employee.experienceDetails[employee.experienceDetails.length - 1];
    return currentExp?.employmentType || "N/A";
  }
  return "N/A";
};

const formatDecimalHours = (decimalHours) => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return "--";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const getWorkedStatus = (punchIn, punchOut, apiStatus, fullDayThreshold, halfDayThreshold) => {
  if (apiStatus === "ABSENT") return "Absent";
  if (punchIn && !punchOut) return "Working..";
  if (!punchIn) return "Absent";
  
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  
  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day"; 
  return "Absent"; 
};

// --- Leave Helpers ---
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalize = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter || monthFilter === "All") return true;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split("-");
  return date.getFullYear() === parseInt(year) && date.getMonth() + 1 === parseInt(month);
};

// Excel Download
const downloadExcelReport = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, filename);
};


// ==========================================
// SUB-COMPONENTS (ROWS)
// ==========================================

const EmployeeRow = ({ emp, idx, navigate, onDeactivateClick, onOverviewClick, profilePic, onImageClick }) => {
  const isEven = idx % 2 === 0;
  const currentDepartment = getCurrentDepartment(emp);
  const currentRole = getCurrentRole(emp);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  return (
    <tr className={`border-t transition duration-150 ${isEven ? "bg-gray-50" : "bg-white"} hover:bg-blue-50`}>
      {/* 1. ID: Left Aligned with padding */}
      <td className="p-4 align-middle text-left font-mono font-semibold text-blue-700 text-sm pl-6">
        {emp.employeeId}
      </td>
      
      {/* 2. Name: Left Aligned with Image */}
      <td className="p-4 align-middle text-left">
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-blue-700 font-bold border border-gray-300 overflow-hidden cursor-pointer flex-shrink-0"
            onClick={() => profilePic && onImageClick(profilePic)}
          >
            {profilePic ? (
              <img src={profilePic} alt={emp.name} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
            ) : (
              emp.name?.split(" ").map((n) => n[0]).join("")
            )}
          </div>
          <span 
              onClick={() => navigate(`/employee/${emp.employeeId}/profile`)}
              className="font-semibold text-gray-900 cursor-pointer hover:text-blue-700 hover:underline text-sm"
          >
              {emp.name}
          </span>
        </div>
      </td>

      {/* 3. Role: Left Aligned, Black Text, No Box */}
      <td className="p-4 align-middle text-left">
         <span className="text-sm font-medium text-gray-900">
            {currentRole}
         </span>
      </td>

      {/* 4. Department: Left Aligned, Black Text, No Box */}
      <td className="p-4 align-middle text-left">
        <span className="text-sm font-medium text-gray-900">
          {currentDepartment}
        </span>
      </td>

      {/* 5. Email: Left Aligned */}
      <td className="p-4 align-middle text-left text-gray-600 text-sm">
          {emp.email}
      </td>

      {/* 6. Actions: Center Aligned */}
      <td className="p-4 align-middle text-center">
        <div className="relative inline-block text-left" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 font-medium text-xs shadow-sm transition-all">
            Actions
            <svg className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 border ring-1 ring-black ring-opacity-5 overflow-hidden">
              <div className="py-1">
                <button onClick={() => { navigate(`/employee/${emp.employeeId}/profile`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors"><FaUser className="text-blue-500"/> Profile</button>
                <button onClick={() => { onOverviewClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-3 transition-colors"><FaClipboardList className="text-teal-500"/> Overview</button>
                <button onClick={() => { navigate(`/employees/edit/${emp.employeeId}`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-3 transition-colors"><FaEdit className="text-green-500"/> Edit</button>
                <button onClick={() => { onDeactivateClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3 transition-colors"><FaTrash className="text-orange-500"/> Deactivate</button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

const InactiveEmployeeRow = ({ emp, navigate, onReactivateClick, onViewDetailsClick, onOverviewClick, profilePic, onImageClick }) => {
  const currentDepartment = getCurrentDepartment(emp);
  const currentRole = getCurrentRole(emp);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);
  
  return (
    <tr className="border-t transition duration-150 bg-gray-100 opacity-60 hover:opacity-100 hover:bg-gray-200">
      <td className="p-4 align-middle text-left pl-6 font-mono font-semibold text-gray-500 text-sm">{emp.employeeId}</td>
      
      <td className="p-4 align-middle text-left">
        <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold border border-gray-500 overflow-hidden cursor-pointer flex-shrink-0 grayscale"
              onClick={() => profilePic && onImageClick(profilePic)}
            >
              {profilePic ? (
                <img src={profilePic} alt={emp.name} className="w-full h-full object-cover" />
              ) : (
                emp.name?.split(" ").map((n) => n[0]).join("")
              )}
            </div>
            <div className="flex flex-col">
              <span 
                onClick={() => navigate(`/employee/${emp.employeeId}/profile`)}
                className="font-semibold text-gray-600 cursor-pointer hover:text-blue-700 hover:underline text-sm"
              >
                {emp.name}
              </span>
              <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wide">Deactivated</span>
            </div>
        </div>
      </td>

      <td className="p-4 align-middle text-left">
         <span className="text-sm font-medium text-gray-600">
            {currentRole}
         </span>
      </td>

      <td className="p-4 align-middle text-left">
        <span className="text-sm font-medium text-gray-600">
          {currentDepartment}
        </span>
      </td>

      <td className="p-4 align-middle text-left text-gray-500 text-sm line-through decoration-red-500">{emp.email}</td>

      <td className="p-4 align-middle text-center">
        <div className="relative inline-block text-left" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 font-medium text-xs shadow-sm">
            Actions
            <svg className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 border">
              <div className="py-1">
                <button onClick={() => { navigate(`/employee/${emp.employeeId}/profile`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3"><FaUser /> Profile</button>
                <button onClick={() => { onOverviewClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-3"><FaClipboardList /> Overview</button>
                <button onClick={() => { onViewDetailsClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-3"><FaEye /> Info</button>
                <button onClick={() => { onReactivateClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3"><FaRedo /> Reactivate</button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

// ==========================================
// MODALS
// ==========================================
function DeactivateModal({ open, employee, onClose, onSubmit }) {
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!open || !employee) return null;
  const handleSubmit = (e) => { e.preventDefault(); if (!endDate || !reason.trim()) { setError("All fields are required."); return; } setError(""); onSubmit({ endDate, reason }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Deactivate Employee</h3>
        <p className="mb-4 text-gray-600">Deactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="block text-sm font-medium text-gray-700">Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" required /></div>
          <div><label className="block text-sm font-medium text-gray-700">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" rows={3} required /></div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button><button type="submit" className="px-4 py-2 rounded bg-red-600 text-white">Deactivate</button></div>
        </form>
      </div>
    </div>
  );
}

function ReactivateModal({ open, employee, onClose, onSubmit }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setDate(new Date().toISOString().split("T")[0]); setReason(""); setError(""); } }, [open]);
  if (!open || !employee) return null;
  const handleSubmit = (e) => { e.preventDefault(); if (!date || !reason.trim()) setError("All fields required."); else onSubmit({ date, reason }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Reactivate Employee</h3>
        <p className="mb-4 text-gray-600">Reactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="block text-sm font-medium text-gray-700">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" required /></div>
          <div><label className="block text-sm font-medium text-gray-700">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" rows={3} required /></div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button><button type="submit" className="px-4 py-2 rounded bg-green-600 text-white">Reactivate</button></div>
        </form>
      </div>
    </div>
  );
}

function DeactivationDetailsModal({ open, employee, onClose }) {
  if (!open || !employee) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 border-b pb-2">Deactivation Details</h3>
        <div className="flex flex-col gap-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase">Name</label><p className="text-lg font-semibold">{employee.name}</p></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase">Date</label><p className="text-md font-medium">{employee.endDate || "N/A"}</p></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase">Reason</label><div className="bg-gray-100 p-3 rounded-md border mt-1"><p className="text-sm">{employee.reason || "N/A"}</p></div></div>
        </div>
        <div className="flex justify-end mt-6"><button onClick={onClose} className="px-5 py-2 rounded bg-blue-600 text-white">Close</button></div>
      </div>
    </div>
  );
}

// ✅ Comprehensive Overview Modal
function EmployeeOverviewModal({ open, employee, onClose }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [attStartDate, setAttStartDate] = useState(firstDay);
  const [attEndDate, setAttEndDate] = useState(lastDay);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  // Leave State
  const [leaveMonth, setLeaveMonth] = useState("All"); 
  const [leaveData, setLeaveData] = useState([]);
  const [leaveStats, setLeaveStats] = useState(null);
  const [loadingLeave, setLoadingLeave] = useState(false);

  // Fetch Data on Open or Filter Change
  const fetchData = useCallback(async () => {
    if (!employee || !open) return;

    // 1. Fetch Attendance & Shifts
    setLoadingAtt(true);
    try {
      const [allShiftsRes, attDataRes] = await Promise.all([
        getAllShifts(),
        getAttendanceByDateRange(attStartDate, attEndDate)
      ]);
      
      const allShifts = Array.isArray(allShiftsRes) ? allShiftsRes : (allShiftsRes.data || []);
      const attData = Array.isArray(attDataRes) ? attDataRes : (attDataRes.data || []);

      const empShift = allShifts.find(s => s.employeeId === employee.employeeId);
      const filteredAtt = attData.filter(a => a.employeeId === employee.employeeId);
      
      // Extract Admin Assigned Hours to Calculate Status Correctly
      const adminFullDayHours = empShift?.fullDayHours || 9;
      const adminHalfDayHours = empShift?.halfDayHours || 4.5;

      // Process Attendance
      const processedAtt = filteredAtt.map(item => {
        return {
          ...item,
          shiftDuration: adminFullDayHours, // Display assigned hours
          // Pass thresholds to getWorkedStatus
          workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours),
          isLate: item.loginStatus === "LATE"
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));

      setAttendanceData(processedAtt);
    } catch (e) { console.error("Error fetching attendance overview", e); }
    setLoadingAtt(false);

    // 2. Fetch Leaves & Holidays
    setLoadingLeave(true);
    try {
      const [leavesRes, holsRes] = await Promise.all([getLeaveRequests(), getHolidays()]);
      
      const leaves = Array.isArray(leavesRes) ? leavesRes : (leavesRes.data || []);
      const hols = Array.isArray(holsRes) ? holsRes : (holsRes.data || []);

      const normHolidays = hols.map(h => ({ ...h, start: normalize(h.startDate), end: normalize(h.endDate || h.startDate) }));

      const empLeaves = leaves.filter(l => l.employeeId === employee.employeeId);
      const filteredLeaves = empLeaves.filter(l => leaveMonth === "All" || isDateInMonth(l.from, leaveMonth) || isDateInMonth(l.to, leaveMonth));
      
      // Calculate Stats (Sandwich logic)
      const approvedLeaves = empLeaves.filter(l => l.status === "Approved" && (leaveMonth === "All" || isDateInMonth(l.from, leaveMonth) || isDateInMonth(l.to, leaveMonth)));
      
      // Build Booked Map
      const bookedMap = new Map();
      approvedLeaves.forEach(l => {
        let curr = new Date(l.from);
        const end = new Date(l.to);
        while (curr <= end) {
          bookedMap.set(formatDate(curr), !l.halfDaySession); // true if full day
          curr = addDays(curr, 1);
        }
      });

      let sandwichDays = 0;
      // Holiday Sandwich
      normHolidays.forEach(h => {
         if (leaveMonth !== "All" && !isDateInMonth(formatDate(h.start), leaveMonth)) return;
         const prev = formatDate(addDays(h.start, -1));
         const next = formatDate(addDays(h.end, 1));
         if (bookedMap.get(prev) === true && bookedMap.get(next) === true) {
            sandwichDays += calculateLeaveDays(h.start, h.end);
         }
      });
      // Weekend Sandwich (Sat check)
      for (const [dateStr, isFull] of bookedMap.entries()) {
         if (!isFull) continue;
         if (leaveMonth !== "All" && !isDateInMonth(dateStr, leaveMonth)) continue;
         const d = new Date(dateStr);
         if (d.getDay() === 6) { // Sat
            const mon = formatDate(addDays(d, 2));
            if (bookedMap.get(mon) === true) sandwichDays += 1; // Sun
         }
      }

      const normalDays = approvedLeaves.reduce((acc, l) => acc + calculateLeaveDays(l.from, l.to), 0);
      const totalUsed = normalDays + sandwichDays;
      const credit = 1; 
      
      setLeaveStats({
        totalUsed,
        pending: Math.max(0, credit - totalUsed),
        extra: Math.max(0, totalUsed - credit),
        normalDays,
        sandwichDays
      });
      
      setLeaveData(filteredLeaves.sort((a,b) => new Date(b.from) - new Date(a.from)));

    } catch (e) { console.error("Error fetching leave overview", e); }
    setLoadingLeave(false);

  }, [employee, open, attStartDate, attEndDate, leaveMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!open || !employee) return null;

  // Exports
  const exportAttendance = () => {
    const data = attendanceData.map(a => ({
      Date: new Date(a.date).toLocaleDateString(),
      "Punch In": a.punchIn ? new Date(a.punchIn).toLocaleTimeString() : "-",
      "Punch Out": a.punchOut ? new Date(a.punchOut).toLocaleTimeString() : "-",
      "Assigned Hrs": formatDecimalHours(a.shiftDuration),
      "Status": a.status,
      "Worked Status": a.workedStatus,
      "Duration": a.displayTime || "-"
    }));
    downloadExcelReport(data, `${employee.name}_Attendance.xlsx`);
  };

  const exportLeaves = () => {
     const data = leaveData.map(l => ({
        From: new Date(l.from).toLocaleDateString(),
        To: new Date(l.to).toLocaleDateString(),
        Type: l.leaveType,
        Status: l.status,
        Days: calculateLeaveDays(l.from, l.to)
     }));
     const csv = [
        Object.keys(data[0] || {}).join(","),
        ...data.map(row => Object.values(row).join(","))
     ].join("\n");
     saveAs(new Blob([csv], {type: "text/csv;charset=utf-8"}), `${employee.name}_Leaves.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 flex justify-between items-center text-white shrink-0">
           <div>
             <h2 className="text-2xl font-bold tracking-wide flex items-center gap-3">
               <FaClipboardList className="text-teal-400"/> {employee.name} <span className="text-slate-400 font-normal text-lg">Overview</span>
             </h2>
             <p className="text-slate-400 text-sm mt-1 font-mono">{employee.employeeId} | {getCurrentDepartment(employee)}</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><FaTimes size={24}/></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8 flex-1 bg-slate-50">
           
           {/* === SECTION 1: ATTENDANCE === */}
           <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FaCalendarAlt className="text-blue-600"/> Attendance History</h3>
                 <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1 border">
                       <span className="text-xs text-slate-500 mr-2 uppercase font-bold">From</span>
                       <input type="date" value={attStartDate} onChange={e => setAttStartDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700"/>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1 border">
                       <span className="text-xs text-slate-500 mr-2 uppercase font-bold">To</span>
                       <input type="date" value={attEndDate} onChange={e => setAttEndDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700"/>
                    </div>
                    <button onClick={exportAttendance} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm">
                       <FaFileExcel /> Export
                    </button>
                 </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                 <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                       <tr>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Punch In</th>
                          <th className="px-4 py-3 text-left">Punch Out</th>
                          <th className="px-4 py-3 text-left">Assigned Hrs</th>
                          <th className="px-4 py-3 text-left">Duration</th>
                          <th className="px-4 py-3 text-left">Worked Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {loadingAtt ? (
                          <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading attendance data...</td></tr>
                       ) : attendanceData.length === 0 ? (
                          <tr><td colSpan="6" className="p-8 text-center text-slate-500">No records found for this period.</td></tr>
                       ) : (
                          attendanceData.map((row, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-3 font-medium text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-green-700 font-semibold">
                                   {row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : <span className="text-slate-400">--</span>}
                                   {row.isLate && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">LATE</span>}
                                </td>
                                <td className="px-4 py-3 text-red-700 font-semibold">
                                   {row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : <span className="text-slate-400">--</span>}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-600">{formatDecimalHours(row.shiftDuration)}</td>
                                <td className="px-4 py-3 font-mono text-slate-600">{row.displayTime || "-"}</td>
                                <td className="px-4 py-3">
                                   <span className={`px-2 py-1 rounded text-xs font-bold ${
                                      row.workedStatus === "Full Day" ? "bg-green-100 text-green-700" :
                                      row.workedStatus.includes("Absent") ? "bg-red-100 text-red-700" :
                                      "bg-yellow-100 text-yellow-700"
                                   }`}>{row.workedStatus}</span>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

           {/* DIVIDER */}
           <hr className="border-slate-300 border-dashed" />

           {/* === SECTION 2: LEAVE SUMMARY === */}
           <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FaClipboardList className="text-purple-600"/> Leave Summary</h3>
                 <div className="flex items-center gap-3">
                    <select value={leaveMonth} onChange={(e) => setLeaveMonth(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-200">
                       <option value="All">All Months</option>
                       {Array.from({length: 12}, (_, i) => {
                          const d = new Date(); d.setMonth(i);
                          const val = `${d.getFullYear()}-${String(i+1).padStart(2, '0')}`;
                          return <option key={val} value={val}>{d.toLocaleString('default', {month:'long'})} {d.getFullYear()}</option>
                       })}
                    </select>
                    <button onClick={exportLeaves} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-700 transition shadow-sm">
                       <FaDownload /> CSV
                    </button>
                 </div>
              </div>

              {/* Leave Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                    <p className="text-xs font-bold text-blue-600 uppercase">Pending (Credit)</p>
                    <p className="text-2xl font-bold text-slate-800">{leaveStats?.pending ?? "-"}</p>
                 </div>
                 <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                    <p className="text-xs font-bold text-green-600 uppercase">Total Used</p>
                    <p className="text-2xl font-bold text-slate-800">{leaveStats?.totalUsed ?? "-"}</p>
                 </div>
                 <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                    <p className="text-xs font-bold text-orange-600 uppercase">Extra (LOP)</p>
                    <p className="text-2xl font-bold text-slate-800">{leaveStats?.extra ?? "-"}</p>
                 </div>
                 <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                    <p className="text-xs font-bold text-purple-600 uppercase">Sandwich Days</p>
                    <p className="text-2xl font-bold text-slate-800">{leaveStats?.sandwichDays ?? "-"}</p>
                 </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                 <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                       <tr>
                          <th className="px-4 py-3 text-left">Applied Date</th>
                          <th className="px-4 py-3 text-left">Period</th>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-left">Reason</th>
                          <th className="px-4 py-3 text-left">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {loadingLeave ? (
                          <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading leave data...</td></tr>
                       ) : leaveData.length === 0 ? (
                          <tr><td colSpan="5" className="p-8 text-center text-slate-500">No leave records found.</td></tr>
                       ) : (
                          leaveData.map((l, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-3 text-slate-600">{new Date(l.requestDate || l.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                   {new Date(l.from).toLocaleDateString()} <span className="text-slate-400">→</span> {new Date(l.to).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-slate-700">{l.leaveType}</td>
                                <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{l.reason || "-"}</td>
                                <td className="px-4 py-3">
                                   <span className={`px-2 py-1 rounded text-xs font-bold ${
                                      l.status === "Approved" ? "bg-green-100 text-green-700" :
                                      l.status === "Rejected" ? "bg-red-100 text-red-700" :
                                      "bg-yellow-100 text-yellow-700"
                                   }`}>{l.status}</span>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All"); 
  // ✅ NEW: Selected Employment Type State
  const [selectedEmploymentType, setSelectedEmploymentType] = useState("All");

  // Modal States
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false); 
  const [overviewModalOpen, setOverviewModalOpen] = useState(false); 
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Image States
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) { console.error("Failed to fetch employees:", err); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    const fetchImages = async () => {
      if (employees.length === 0) return;
      const newImages = {};
      for (const emp of employees) {
        if (!employeeImages[emp.employeeId]) {
            try {
               const res = await api.get(`/api/profile/${emp.employeeId}`);
               if (res.data?.profilePhoto?.url) newImages[emp.employeeId] = getSecureUrl(res.data.profilePhoto.url);
            } catch (err) { /* Silent fail */ }
        }
      }
      if (Object.keys(newImages).length > 0) setEmployeeImages(prev => ({ ...prev, ...newImages }));
    };
    if (employees.length > 0) fetchImages();
  }, [employees]);

  const handleDeactivateSubmit = async ({ endDate, reason }) => {
    try { await deactivateEmployeeById(selectedEmployee.employeeId, { endDate, reason }); fetchEmployees(); setDeactivateModalOpen(false); setSelectedEmployee(null); } 
    catch (e) { alert("Error deactivating"); }
  };

  const handleReactivateSubmit = async ({ date, reason }) => {
    try { await activateEmployeeById(selectedEmployee.employeeId, { date, reason }); fetchEmployees(); setReactivateModalOpen(false); setSelectedEmployee(null); } 
    catch (e) { alert("Error reactivating"); }
  };

  const openDeactivateModal = (emp) => { setSelectedEmployee(emp); setDeactivateModalOpen(true); };
  const openReactivateModal = (emp) => { setSelectedEmployee(emp); setReactivateModalOpen(true); };
  const openViewDetailsModal = (emp) => { setSelectedEmployee(emp); setViewDetailsModalOpen(true); };
  const openOverviewModal = (emp) => { setSelectedEmployee(emp); setOverviewModalOpen(true); };

  // 1. Department List
  const departmentSet = useMemo(() => {
    const depts = employees.map(emp => getCurrentDepartment(emp)).filter((dept, idx, arr) => dept && arr.indexOf(dept) === idx);
    return depts.sort();
  }, [employees]);

  // 2. Role List
  const roleSet = useMemo(() => {
    const roles = employees.map(emp => getCurrentRole(emp)).filter((role, idx, arr) => role && arr.indexOf(role) === idx);
    return roles.sort();
  }, [employees]);

  // ✅ 3. Employment Type List
  const employmentTypeSet = useMemo(() => {
    const types = employees.map(emp => getCurrentEmploymentType(emp)).filter((type, idx, arr) => type && arr.indexOf(type) === idx);
    return types.sort();
  }, [employees]);

  // 4. Filtering
  const { activeEmployees, inactiveEmployees } = useMemo(() => {
    const filtered = employees.filter((emp) => {
      const currentDepartment = getCurrentDepartment(emp);
      const currentRole = getCurrentRole(emp); 
      const currentEmploymentType = getCurrentEmploymentType(emp); // Get current employment type

      const matchesSearch = [emp.employeeId, emp.name, currentDepartment, emp.email].some((field) => (field ?? "").toString().toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = selectedDept === "All" || currentDepartment === selectedDept;
      const matchesRole = selectedRole === "All" || currentRole === selectedRole;
      
      // ✅ Check Employment Type Match
      const matchesType = selectedEmploymentType === "All" || currentEmploymentType === selectedEmploymentType;

      return matchesSearch && matchesDept && matchesRole && matchesType;
    });
    return {
      activeEmployees: filtered.filter((emp) => emp.isActive !== false),
      inactiveEmployees: filtered.filter((emp) => emp.isActive === false),
    };
  }, [employees, searchQuery, selectedDept, selectedRole, selectedEmploymentType]); // Add selectedEmploymentType dependency

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center py-12">
      <div className="w-full max-w-[95%] xl:max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Employee Management</h2>
            <div className="flex gap-3 mt-3">
              <button onClick={() => downloadExcelReport(activeEmployees, "Active_Emp.xlsx")} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm text-sm font-semibold flex items-center gap-2"><FaDownload /> Active List</button>
              <button onClick={() => downloadExcelReport(inactiveEmployees, "Inactive_Emp.xlsx")} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow-sm text-sm font-semibold flex items-center gap-2"><FaDownload /> Inactive List</button>
            </div>
          </div>
          <button onClick={() => navigate("/employees/add")} className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 shadow-md font-bold flex items-center gap-2 transition-transform transform hover:scale-105">
            <FaUser /> Add Employee
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <input type="text" placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-1/4 border border-gray-300 px-4 py-2.5 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          
          {/* Department Filter */}
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full md:w-1/4 border border-gray-300 px-4 py-2.5 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Departments</option>
            {departmentSet.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
          </select>

          {/* Role Filter */}
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full md:w-1/4 border border-gray-300 px-4 py-2.5 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Roles</option>
            {roleSet.map((role) => (<option key={role} value={role}>{role}</option>))}
          </select>

          {/* ✅ Employment Type Filter */}
          <select value={selectedEmploymentType} onChange={(e) => setSelectedEmploymentType(e.target.value)} className="w-full md:w-1/4 border border-gray-300 px-4 py-2.5 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Employment Types</option>
            {employmentTypeSet.map((type) => (<option key={type} value={type}>{type}</option>))}
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-300 border-b border-gray-200">
                {/* HEADERS: LEFT ALIGNED to match data */}
                <tr className="text-blue-600 uppercase text-size-600 font-bold tracking-wider ">
                  <th className="p-4 text-left  pl-6">ID</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeEmployees.length > 0 || inactiveEmployees.length > 0 ? (
                  <>
                    {activeEmployees.map((emp, idx) => (
                      <EmployeeRow key={emp.employeeId} emp={emp} idx={idx} navigate={navigate} onDeactivateClick={openDeactivateModal} onOverviewClick={openOverviewModal} profilePic={employeeImages[emp.employeeId]} onImageClick={setPreviewImage} />
                    ))}
                    {activeEmployees.length > 0 && inactiveEmployees.length > 0 && (
                       <tr><td colSpan="6" className="bg-gray-100 p-2 text-center font-bold text-gray-500 text-xs tracking-widest uppercase">Inactive Employees</td></tr>
                    )}
                    {inactiveEmployees.map((emp) => (
                      <InactiveEmployeeRow key={emp.employeeId} emp={emp} navigate={navigate} onReactivateClick={openReactivateModal} onViewDetailsClick={openViewDetailsModal} onOverviewClick={openOverviewModal} profilePic={employeeImages[emp.employeeId]} onImageClick={setPreviewImage} />
                    ))}
                  </>
                ) : (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400">No employees found matching criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        <DeactivateModal open={deactivateModalOpen} employee={selectedEmployee} onClose={() => setDeactivateModalOpen(false)} onSubmit={handleDeactivateSubmit} />
        <ReactivateModal open={reactivateModalOpen} employee={selectedEmployee} onClose={() => setReactivateModalOpen(false)} onSubmit={handleReactivateSubmit} />
        <DeactivationDetailsModal open={viewDetailsModalOpen} employee={selectedEmployee} onClose={() => setViewDetailsModalOpen(false)} />
        <EmployeeOverviewModal open={overviewModalOpen} employee={selectedEmployee} onClose={() => setOverviewModalOpen(false)} />

        {/* Image Lightbox */}
        {previewImage && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
              <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"><FaTimes size={30} /></button>
              <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;
// --- END OF FILE src/pages/EmployeeManagement.jsx ---