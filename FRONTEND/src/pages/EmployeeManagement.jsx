import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

import {
  FaUser,
  FaEdit,
  FaTrash,
  FaRedo,
  FaDownload,
  FaEye,
  FaClipboardList,
  FaCalendarAlt,
  FaFileExcel,
  FaTimes,
  FaFileAlt,
  FaShieldAlt,
  FaChevronDown, FaEnvelope, FaSearch, FaUserPlus,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api, {
  getEmployees,
  deactivateEmployeeById,
  activateEmployeeById,
  getAttendanceByDateRange,
  getAllShifts,
  getLeaveRequests,
  getHolidays,
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


const getCurrentDepartment = (employee) => {
  if (employee.currentDepartment) return employee.currentDepartment;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(
      (exp) => exp.lastWorkingDate === "Present",
    );
    return currentExp?.department || "N/A";
  }
  return "N/A";
};

const getCurrentRole = (employee) => {
  if (employee.currentRole) return employee.currentRole;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(
      (exp) => exp.lastWorkingDate === "Present",
    );
    return currentExp?.role || "N/A";
  }
  return "N/A";
};

const getCurrentEmploymentType = (employee) => {
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp =
      employee.experienceDetails.find(
        (exp) => exp.lastWorkingDate === "Present",
      ) || employee.experienceDetails[employee.experienceDetails.length - 1];
    return currentExp?.employmentType || "N/A";
  }
  return "N/A";
};

const getCurrentPhone = (employee) => {
  return (
    employee.phone ||
    employee.phoneNumber ||
    employee.personalDetails?.phone ||
    "N/A"
  );
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

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
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
  return (
    date.getFullYear() === parseInt(year) &&
    date.getMonth() + 1 === parseInt(month)
  );
};

const downloadExcelReport = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, filename);
};

// ==========================================
// SMART SUBMENU COMPONENT
// ==========================================

const SmartSubmenu = ({ onClose, onNavigate }) => {
  const submenuRef = useRef(null);
  const [position, setPosition] = useState({ left: true }); // true = open on right, false = open on left

  useEffect(() => {
    if (submenuRef.current) {
      const rect = submenuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Check if submenu would go off-screen to the right
      if (rect.right > viewportWidth) {
        setPosition({ left: false }); // Open to the left instead
      } else {
        setPosition({ left: true }); // Open to the right
      }
    }
  }, []);

  return (
    <div 
      ref={submenuRef}
      className={`absolute top-0 ${position.left ? 'left-full ml-1' : 'right-full mr-1'} w-64 bg-white rounded-xl shadow-2xl border border-slate-100 z-[10000]`}
    >
      <button
        onClick={() => { onNavigate("/admin/doc-verify-invite"); onClose(); }}
        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center gap-3 transition-colors duration-150 border-b border-slate-100 rounded-t-xl"
      >
        <FaEnvelope className="text-violet-500" /> Send Invitations
      </button>
      <button
        onClick={() => { onNavigate("/admin/doc-verify-portal"); onClose(); }}
        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center gap-3 transition-colors duration-150 rounded-b-xl"
      >
        <FaSearch className="text-violet-500" /> View & Verify Docs
      </button>
   <button
        onClick={() => { onNavigate("/admin/hr-checklist"); onClose(); }}
        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center gap-3 transition-colors duration-150 rounded-b-xl"
      >
        <FaSearch className="text-violet-500" /> HR Checklist
      </button>

  
    </div>
  );
};

// ==========================================
// SUB-COMPONENTS (ROWS)
// ==========================================

const EmployeeRow = ({
  emp,
  idx,
  navigate,
  onDeactivateClick,
  onOverviewClick,
  profilePic,
  onImageClick,
}) => {
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
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

  const mailSubject = encodeURIComponent("Notice From HRMS");
  const mailBody = encodeURIComponent(`Hi ${emp.name},\n\n`);
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emp.email}&su=${mailSubject}&body=${mailBody}`;

  return (
    <tr className={`border-t transition duration-150 hover:bg-blue-50 relative`}>
      <td className="p-4 align-middle text-left font-mono font-semibold text-blue-700 text-sm pl-6">
        {emp.employeeId}
      </td>
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
            className="font-bold text-gray-900 cursor-pointer hover:text-blue-700 hover:underline text-sm"
          >
            {emp.name}
          </span>
        </div>
      </td>
      <td className="p-4 align-middle text-left">
        <span className="text-sm font-bold text-gray-900">{currentRole}</span>
      </td>
      <td className="p-4 align-middle text-left">
        <span className="text-sm font-bold text-gray-900">{currentDepartment}</span>
      </td>
      <td className="p-4 align-middle text-left text-gray-900 text-sm font-semibold">
        <a href={gmailComposeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 hover:underline">
          {emp.email}
        </a>
      </td>
      <td className="p-4 align-middle text-center">
        <div className="inline-block text-left" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 font-medium text-xs shadow-sm transition-all"
          >
            Actions
            <svg className={`w-3 h-3 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          {isMenuOpen && (
            <div className="fixed right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20 border ring-1 ring-black ring-opacity-5 overflow-hidden origin-top-right">
              <div className="py-1">
                <button onClick={() => { navigate(`/employee/${emp.employeeId}/profile`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors">
                  <FaUser className="text-blue-500" /> Profile
                </button>
                <button onClick={() => { onOverviewClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-3 transition-colors">
                  <FaClipboardList className="text-teal-500" /> Overview
                </button>
                <button onClick={() => { navigate(`/employees/edit/${emp.employeeId}`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-3 transition-colors">
                  <FaEdit className="text-green-500" /> Edit
                </button>
                <button onClick={() => { onDeactivateClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3 transition-colors">
                  <FaTrash className="text-orange-500" /> Deactivate
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};


const InactiveEmployeeRow = ({
  emp,
  navigate,
  onReactivateClick,
  onViewDetailsClick,
  onOverviewClick,
  profilePic,
  onImageClick,
}) => {
  const currentDepartment = getCurrentDepartment(emp);
  const currentRole = getCurrentRole(emp);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
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

  const mailSubject = encodeURIComponent("Notice From HRMS");
  const mailBody = encodeURIComponent(`Hi ${emp.name},\n\n`);
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emp.email}&su=${mailSubject}&body=${mailBody}`;

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
            <span onClick={() => navigate(`/employee/${emp.employeeId}/profile`)} className="font-semibold text-gray-600 cursor-pointer hover:text-blue-700 hover:underline text-sm">
              {emp.name}
            </span>
            <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wide">Deactivated</span>
          </div>
        </div>
      </td>
      <td className="p-4 align-middle text-left"><span className="text-sm font-semibold text-gray-700">{currentRole}</span></td>
      <td className="p-4 align-middle text-left"><span className="text-sm font-semibold text-gray-700">{currentDepartment}</span></td>
      <td className="p-4 align-middle text-left text-gray-700 text-sm font-semibold line-through decoration-red-800">
        <a href={gmailComposeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 hover:underline">{emp.email}</a>
      </td>
      <td className="p-4 align-middle text-center">
        <div className="relative inline-block text-left" ref={menuRef}>
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + window.scrollY, left: rect.right - 180 });
              setIsMenuOpen(!isMenuOpen);
            }}
            className="bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 font-medium text-xs shadow-sm"
          >
            Actions
            <svg className={`w-3 h-3 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          {isMenuOpen && (
            <div style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }} className="w-48 bg-white rounded-lg shadow-xl border">
              <div className="py-1">
                <button onClick={() => { navigate(`/employee/${emp.employeeId}/profile`); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3"><FaUser /> Profile</button>
                <button onClick={() => { onOverviewClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-3"><FaClipboardList /> Overview</button>
                <button onClick={() => { onViewDetailsClick(emp); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-3"><FaEye /> Deactivation Details</button>
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

  useEffect(() => { if (open) { setEndDate(""); setReason(""); setError(""); } }, [open]);
  if (!open || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!endDate || !reason.trim()) { setError("All fields are required."); return; }
    setError("");
    onSubmit({ endDate, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Deactivate Employee</h3>
        <p className="mb-4 text-gray-600">Deactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" rows={3} required />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white">Deactivate</button>
          </div>
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !reason.trim()) setError("All fields required.");
    else onSubmit({ date, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Reactivate Employee</h3>
        <p className="mb-4 text-gray-600">Reactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border border-gray-300 px-3 py-2 rounded w-full mt-1" rows={3} required />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white">Reactivate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivationDetailsModal({ open, employee, onClose }) {
  if (!open || !employee) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold tracking-wide">Deactivation Details</h3>
            <p className="text-sm text-red-100">Employee Status Information</p>
          </div>
          <span className="px-3 py-1 text-xs rounded-full bg-white/20 backdrop-blur-sm">
            {employee?.deactivationDate ? "Deactivated" : "Inactive"}
          </span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee Name</label>
              <p className="text-lg font-semibold text-gray-800">{employee?.name || "N/A"}</p>
            </div>
          </div>
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Deactivation Date</label>
              <p className="text-md font-medium text-gray-700">{employee?.deactivationDate || "Not Recorded"}</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Deactivation Reason</label>
            <div className="mt-2 bg-gray-50 border rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
              {employee?.deactivationReason || "No reason provided."}
            </div>
          </div>
        </div>
        <div className="flex justify-end px-6 py-4 bg-gray-50 border-t">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition duration-200 shadow-md">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeOverviewModal({ open, employee, onClose }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = today.toISOString().split("T")[0];

  const [attStartDate, setAttStartDate] = useState(firstDay);
  const [attEndDate, setAttEndDate] = useState(lastDay);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [leaveMonth, setLeaveMonth] = useState("All");
  const [leaveData, setLeaveData] = useState([]);
  const [leaveStats, setLeaveStats] = useState(null);
  const [loadingLeave, setLoadingLeave] = useState(false);

  const fetchData = useCallback(async () => {
    if (!employee || !open) return;
    setLoadingAtt(true);
    try {
      const [allShiftsRes, attDataRes] = await Promise.all([getAllShifts(), getAttendanceByDateRange(attStartDate, attEndDate)]);
      const allShifts = Array.isArray(allShiftsRes) ? allShiftsRes : allShiftsRes.data || [];
      const attData = Array.isArray(attDataRes) ? attDataRes : attDataRes.data || [];
      const empShift = allShifts.find((s) => s.employeeId === employee.employeeId);
      const filteredAtt = attData.filter((a) => a.employeeId === employee.employeeId);
      const adminFullDayHours = empShift?.fullDayHours || 9;
      const adminHalfDayHours = empShift?.halfDayHours || 4.5;
      const processedAtt = filteredAtt
        .map((item) => ({ ...item, shiftDuration: adminFullDayHours, workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours), isLate: item.loginStatus === "LATE" }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendanceData(processedAtt);
    } catch (e) { console.error("Error fetching attendance overview", e); }
    setLoadingAtt(false);

    setLoadingLeave(true);
    try {
      const [leavesRes, holsRes] = await Promise.all([getLeaveRequests(), getHolidays()]);
      const leaves = Array.isArray(leavesRes) ? leavesRes : leavesRes.data || [];
      const hols = Array.isArray(holsRes) ? holsRes : holsRes.data || [];
      const normHolidays = hols.map((h) => ({ ...h, start: normalize(h.startDate), end: normalize(h.endDate || h.startDate) }));
      const empLeaves = leaves.filter((l) => l.employeeId === employee.employeeId);
      const filteredLeaves = empLeaves.filter((l) => leaveMonth === "All" || isDateInMonth(l.from, leaveMonth) || isDateInMonth(l.to, leaveMonth));
      const approvedLeaves = empLeaves.filter((l) => l.status === "Approved" && (leaveMonth === "All" || isDateInMonth(l.from, leaveMonth) || isDateInMonth(l.to, leaveMonth)));
      const bookedMap = new Map();
      approvedLeaves.forEach((l) => {
        let curr = new Date(l.from);
        const end = new Date(l.to);
        while (curr <= end) { bookedMap.set(formatDate(curr), !l.halfDaySession); curr = addDays(curr, 1); }
      });
      let sandwichDays = 0;
      normHolidays.forEach((h) => {
        if (leaveMonth !== "All" && !isDateInMonth(formatDate(h.start), leaveMonth)) return;
        const prev = formatDate(addDays(h.start, -1));
        const next = formatDate(addDays(h.end, 1));
        if (bookedMap.get(prev) === true && bookedMap.get(next) === true) sandwichDays += calculateLeaveDays(h.start, h.end);
      });
      for (const [dateStr, isFull] of bookedMap.entries()) {
        if (!isFull) continue;
        if (leaveMonth !== "All" && !isDateInMonth(dateStr, leaveMonth)) continue;
        const d = new Date(dateStr);
        if (d.getDay() === 6) { const mon = formatDate(addDays(d, 2)); if (bookedMap.get(mon) === true) sandwichDays += 1; }
      }
      const normalDays = approvedLeaves.reduce((acc, l) => acc + calculateLeaveDays(l.from, l.to), 0);
      const totalUsed = normalDays + sandwichDays;
      const credit = 1;
      setLeaveStats({ totalUsed, pending: Math.max(0, credit - totalUsed), extra: Math.max(0, totalUsed - credit), normalDays, sandwichDays });
      setLeaveData(filteredLeaves.sort((a, b) => new Date(b.from) - new Date(a.from)));
    } catch (e) { console.error("Error fetching leave overview", e); }
    setLoadingLeave(false);
  }, [employee, open, attStartDate, attEndDate, leaveMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);
  if (!open || !employee) return null;

  const exportAttendance = () => {
    const data = attendanceData.map((a) => ({ Date: new Date(a.date).toLocaleDateString(), "Punch In": a.punchIn ? new Date(a.punchIn).toLocaleTimeString() : "-", "Punch Out": a.punchOut ? new Date(a.punchOut).toLocaleTimeString() : "-", "Assigned Hrs": formatDecimalHours(a.shiftDuration), Status: a.status, "Worked Status": a.workedStatus, Duration: a.displayTime || "-" }));
    downloadExcelReport(data, `${employee.name}_Attendance.xlsx`);
  };

  const exportLeaves = () => {
    const data = leaveData.map((l) => ({ From: new Date(l.from).toLocaleDateString(), To: new Date(l.to).toLocaleDateString(), Type: l.leaveType, Status: l.status, Days: calculateLeaveDays(l.from, l.to) }));
    const csv = [Object.keys(data[0] || {}).join(","), ...data.map((row) => Object.values(row).join(","))].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${employee.name}_Leaves.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-wide flex items-center gap-3">
              <FaClipboardList className="text-teal-400" /> {employee.name}{" "}
              <span className="text-slate-400 font-normal text-lg">Overview</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-mono">{employee.employeeId} | {getCurrentDepartment(employee)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><FaTimes size={24} /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-8 flex-1 bg-slate-50">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FaCalendarAlt className="text-blue-600" /> Attendance History</h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1 border">
                  <span className="text-xs text-slate-500 mr-2 uppercase font-bold">From</span>
                  <input type="date" value={attStartDate} onChange={(e) => setAttStartDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700" />
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1 border">
                  <span className="text-xs text-slate-500 mr-2 uppercase font-bold">To</span>
                  <input type="date" value={attEndDate} onChange={(e) => setAttEndDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700" />
                </div>
                <button onClick={exportAttendance} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm"><FaFileExcel /> Export</button>
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
                          {row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-slate-400">--</span>}
                          {row.isLate && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">LATE</span>}
                        </td>
                        <td className="px-4 py-3 text-red-700 font-semibold">
                          {row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-slate-400">--</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">{formatDecimalHours(row.shiftDuration)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.displayTime || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${row.workedStatus === "Full Day" ? "bg-green-100 text-green-700" : row.workedStatus.includes("Absent") ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {row.workedStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-slate-300 border-dashed" />

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FaClipboardList className="text-purple-600" /> Leave Summary</h3>
              <div className="flex items-center gap-3">
                <select value={leaveMonth} onChange={(e) => setLeaveMonth(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-200">
                  <option value="All">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(); d.setMonth(i);
                    const val = `${d.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
                    return <option key={val} value={val}>{d.toLocaleString("default", { month: "long" })} {d.getFullYear()}</option>;
                  })}
                </select>
                <button onClick={exportLeaves} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-700 transition shadow-sm"><FaDownload /> CSV</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><p className="text-xs font-bold text-blue-600 uppercase">Pending (Credit)</p><p className="text-2xl font-bold text-slate-800">{leaveStats?.pending ?? "-"}</p></div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center"><p className="text-xs font-bold text-green-600 uppercase">Total Used</p><p className="text-2xl font-bold text-slate-800">{leaveStats?.totalUsed ?? "-"}</p></div>
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center"><p className="text-xs font-bold text-orange-600 uppercase">Extra (LOP)</p><p className="text-2xl font-bold text-slate-800">{leaveStats?.extra ?? "-"}</p></div>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center"><p className="text-xs font-bold text-purple-600 uppercase">Sandwich Days</p><p className="text-2xl font-bold text-slate-800">{leaveStats?.sandwichDays ?? "-"}</p></div>
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
                        <td className="px-4 py-3 font-medium text-slate-800">{new Date(l.from).toLocaleDateString()} <span className="text-slate-400">→</span> {new Date(l.to).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-slate-700">{l.leaveType}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{l.reason || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${l.status === "Approved" ? "bg-green-100 text-green-700" : l.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {l.status}
                          </span>
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState("All");

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // HR Activities main dropdown
  const [hrActivitiesOpen, setHrActivitiesOpen] = useState(false);
  // Document Verification nested submenu
  const [docVerifyOpen, setDocVerifyOpen] = useState(false);

  const hrDropdownRef = useRef(null);
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Close entire HR dropdown (and nested) on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (hrDropdownRef.current && !hrDropdownRef.current.contains(event.target)) {
        setHrActivitiesOpen(false);
        setDocVerifyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  // Auto-close nested when parent closes
  useEffect(() => {
    if (!hrActivitiesOpen) setDocVerifyOpen(false);
  }, [hrActivitiesOpen]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
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
          } catch (err) {}
        }
      }
      if (Object.keys(newImages).length > 0) setEmployeeImages((prev) => ({ ...prev, ...newImages }));
    };
    if (employees.length > 0) fetchImages();
  }, [employees]);

  const handleDeactivateSubmit = async ({ endDate, reason }) => {
    try {
      await deactivateEmployeeById(selectedEmployee.employeeId, { endDate, reason });
      fetchEmployees(); setDeactivateModalOpen(false); setSelectedEmployee(null);
    } catch (e) { alert("Error deactivating"); }
  };

  const handleReactivateSubmit = async ({ date, reason }) => {
    try {
      await activateEmployeeById(selectedEmployee.employeeId, { date, reason });
      fetchEmployees(); setReactivateModalOpen(false); setSelectedEmployee(null);
    } catch (e) { alert("Error reactivating"); }
  };

  const openDeactivateModal = (emp) => { setSelectedEmployee(emp); setDeactivateModalOpen(true); };
  const openReactivateModal = (emp) => { setSelectedEmployee(emp); setReactivateModalOpen(true); };
  const openViewDetailsModal = (emp) => { setSelectedEmployee(emp); setViewDetailsModalOpen(true); };
  const openOverviewModal = (emp) => { setSelectedEmployee(emp); setOverviewModalOpen(true); };

  const handleDownloadActive = () => {
    const data = activeEmployees.map((emp) => ({ ID: emp.employeeId, Name: emp.name, Role: getCurrentRole(emp), Department: getCurrentDepartment(emp), Email: emp.email, "Phone Number": getCurrentPhone(emp) }));
    downloadExcelReport(data, "Active_Employees.xlsx");
  };

  const handleDownloadInactive = () => {
    const data = inactiveEmployees.map((emp) => ({ ID: emp.employeeId, Name: emp.name, Role: getCurrentRole(emp), Department: getCurrentDepartment(emp), Email: emp.email, "Phone Number": getCurrentPhone(emp), "Deactivation Date": emp.deactivationDate || "N/A", "Deactivation Reason": emp.deactivationReason || "N/A" }));
    downloadExcelReport(data, "Inactive_Employees.xlsx");
  };

  const departmentSet = useMemo(() => {
    return employees.map((emp) => getCurrentDepartment(emp)).filter((dept, idx, arr) => dept && arr.indexOf(dept) === idx).sort();
  }, [employees]);

  const roleSet = useMemo(() => {
    return employees.map((emp) => getCurrentRole(emp)).filter((role, idx, arr) => role && arr.indexOf(role) === idx).sort();
  }, [employees]);

  const employmentTypeSet = useMemo(() => {
    return employees.map((emp) => getCurrentEmploymentType(emp)).filter((type, idx, arr) => type && arr.indexOf(type) === idx).sort();
  }, [employees]);

  const { activeEmployees, inactiveEmployees } = useMemo(() => {
    const filtered = employees.filter((emp) => {
      const currentDepartment = getCurrentDepartment(emp);
      const currentRole = getCurrentRole(emp);
      const currentEmploymentType = getCurrentEmploymentType(emp);
      const matchesSearch = [emp.employeeId, emp.name, currentDepartment, emp.email].some((field) =>
        (field ?? "").toString().toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        matchesSearch &&
        (selectedDept === "All" || currentDepartment === selectedDept) &&
        (selectedRole === "All" || currentRole === selectedRole) &&
        (selectedEmploymentType === "All" || currentEmploymentType === selectedEmploymentType)
      );
    });
    return {
      activeEmployees: filtered.filter((emp) => emp.isActive !== false),
      inactiveEmployees: filtered.filter((emp) => emp.isActive === false),
    };
  }, [employees, searchQuery, selectedDept, selectedRole, selectedEmploymentType]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-12">
      <div className="w-full max-w-[95%] xl:max-w-7xl mx-auto">

        {/* relative z-[20] keeps header above table (z-10) so dropdown never goes under */}
        <div className="relative z-[20] flex flex-col bg-white/20 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 md:flex-row justify-between items-center mb-8 gap-4 px-8 py-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Employee Management</h2>
            <div className="flex gap-3 mt-3">
              <button onClick={handleDownloadActive} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm text-sm font-semibold flex items-center gap-2">
                <FaDownload /> Active List
              </button>
              <button onClick={handleDownloadInactive} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow-sm text-sm font-semibold flex items-center gap-2">
                <FaDownload /> Inactive List
              </button>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* HR Activities Dropdown */}
            <div className="relative" ref={hrDropdownRef}>
              <button
                onClick={() => { setHrActivitiesOpen(!hrActivitiesOpen); setDocVerifyOpen(false); }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-md font-bold flex items-center gap-2 transition-all duration-200 transform hover:scale-105"
              >
                <FaClipboardList /> HR Activities
                <FaChevronDown className={`text-xs transition-transform duration-200 ${hrActivitiesOpen ? "rotate-180" : ""}`} />
              </button>

              {hrActivitiesOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-[9999]">
                  {/* Offer Letter */}
                  <button
                    onClick={() => { navigate("/admin/offer-letter"); setHrActivitiesOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-colors duration-150 border-b border-slate-100 rounded-t-xl"
                  >
                    <FaFileAlt className="text-blue-500" /> Offer Letter
                  </button>

                  {/* Onboarding Invitation */}
                  <button
                    onClick={() => { navigate("/admin/onboarding-email"); setHrActivitiesOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-colors duration-150 border-b border-slate-100"
                  >
                    <FaUser className="text-blue-500" /> Onboarding Invitation
                  </button>

                  {/* Document Verification with smart positioned nested submenu */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDocVerifyOpen(!docVerifyOpen); }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center justify-between transition-colors duration-150 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <FaShieldAlt className="text-violet-500" />
                        Document Verification
                      </div>
                      <FaChevronDown className={`text-xs text-slate-400 transition-transform duration-200 ${docVerifyOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Smart positioned submenu - opens right by default, left if off-screen */}
                    {docVerifyOpen && (
                      <SmartSubmenu
                        onClose={() => setDocVerifyOpen(false)}
                        onNavigate={(path) => {
                          navigate(path);
                          setHrActivitiesOpen(false);
                          setDocVerifyOpen(false);
                        }}
                      />
                    )}
                  </div>

                  {/* Add Employee */}
                  <button
                    onClick={() => { navigate("/employees/add"); setHrActivitiesOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-colors duration-150 rounded-b-xl"
                  >
                    <FaUserPlus className="text-blue-500" /> Add Employee
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-10 px-8">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/4 border bg-white border-gray-200 px-4 py-2.5 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full bg-white md:w-1/4 border border-gray-200 px-3 py-1.0 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Departments</option>
            {departmentSet.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full md:w-1/4 bg-white border border-gray-200 px-3 py-1.0 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Roles</option>
            {roleSet.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select value={selectedEmploymentType} onChange={(e) => setSelectedEmploymentType(e.target.value)} className="w-full bg-white md:w-1/4 border border-gray-200 px-3 py-1.0 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700">
            <option value="All">All Employment Types</option>
            {employmentTypeSet.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="bg-white/20 backdrop-blur-md rounded-2xl shadow-sm border border-gray-300 relative z-10 overflow-visible">
          <div className="overflow-x-auto">
            <table className="min-w-full rounded-2xl">
              <thead className="bg-gradient-to-r from-slate-800 to-slate-700 border-b rounded-lg border-slate-600">
                <tr className="text-white uppercase text-sm font-semibold tracking-wide">
                  <th className="p-4 text-left pl-6">ID</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-medium text-lg">Loading employees data...</td></tr>
                ) : activeEmployees.length > 0 || inactiveEmployees.length > 0 ? (
                  <>
                    {activeEmployees.map((emp, idx) => (
                      <EmployeeRow key={emp.employeeId} emp={emp} idx={idx} navigate={navigate} onDeactivateClick={openDeactivateModal} onOverviewClick={openOverviewModal} profilePic={employeeImages[emp.employeeId]} onImageClick={setPreviewImage} />
                    ))}
                    {activeEmployees.length > 0 && inactiveEmployees.length > 0 && (
                      <tr>
                        <td colSpan="6" className="p-2 text-center font-bold text-white text-lg tracking-widest uppercase bg-gradient-to-r from-slate-800 to-slate-700 border-b rounded-lg border-slate-600">
                          Inactive Employees
                        </td>
                      </tr>
                    )}
                    {inactiveEmployees.map((emp) => (
                      <InactiveEmployeeRow key={emp.employeeId} emp={emp} navigate={navigate} onReactivateClick={openReactivateModal} onViewDetailsClick={openViewDetailsModal} onOverviewClick={openOverviewModal} profilePic={employeeImages[emp.employeeId]} onImageClick={setPreviewImage} />
                    ))}
                  </>
                ) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center bg-white/20 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 text-gray-400 font-medium">
                      No employees found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DeactivateModal open={deactivateModalOpen} employee={selectedEmployee} onClose={() => setDeactivateModalOpen(false)} onSubmit={handleDeactivateSubmit} />
        <ReactivateModal open={reactivateModalOpen} employee={selectedEmployee} onClose={() => setReactivateModalOpen(false)} onSubmit={handleReactivateSubmit} />
        <DeactivationDetailsModal open={viewDetailsModalOpen} employee={selectedEmployee} onClose={() => setViewDetailsModalOpen(false)} />
        <EmployeeOverviewModal open={overviewModalOpen} employee={selectedEmployee} onClose={() => setOverviewModalOpen(false)} />

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