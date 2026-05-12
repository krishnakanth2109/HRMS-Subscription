import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";

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
  FaChevronDown, FaEnvelope, FaSearch, FaUserPlus, FaConnectdevelop, FaFileSignature, FaGift, FaClipboardCheck, FaInfoCircle
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
  getAllCompanies,
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
        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center gap-3 transition-colors duration-150 rounded-xl"
      >
        <FaSearch className="text-violet-500" /> View & Verify Docs
      </button>
      <button
        onClick={() => { onNavigate("/admin/hr-checklist"); onClose(); }}
        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center gap-3 transition-colors duration-150 rounded-b-xl"
      >
        <FaClipboardCheck className="text-violet-500" /> HR Checklist
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
  resignations = []
}) => {
  const isPendingResignation = resignations.some(r => r.employeeId === emp.employeeId && r.status === "Pending");

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
    <tr className={`border-t transition duration-150 hover:bg-blue-50 relative group`}>
      <td className="p-4 align-middle text-left font-mono font-semibold text-blue-700 text-sm pl-6 hidden sm:table-cell">
        {emp.employeeId}
      </td>
      <td className="p-4 align-middle text-left">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-blue-700 font-bold border border-gray-300 overflow-hidden cursor-pointer flex-shrink-0 relative"
            onClick={() => profilePic && onImageClick(profilePic)}
          >
            {profilePic ? (
              <img src={profilePic} alt={emp.name} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
            ) : (
              emp.name?.split(" ").map((n) => n[0]).join("")
            )}
            {isPendingResignation && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center animate-pulse shadow-sm" title="Pending Resignation">
                <span className="text-[8px] text-white font-bold">!</span>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              onClick={() => navigate(`/employee/${emp.employeeId}/profile`)}
              className="font-bold text-gray-900 cursor-pointer hover:text-blue-700 hover:underline text-sm flex items-center gap-2 truncate"
            >
              {emp.name}
              {isPendingResignation && (
                <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black border border-red-200 uppercase tracking-tighter shrink-0">
                  Resigning
                </span>
              )}
            </span>
            {/* Show Role/ID on mobile under name */}
            <span className="text-[10px] text-gray-500 font-medium sm:hidden truncate">
              {emp.employeeId} • {currentRole}
            </span>
          </div>
        </div>
      </td>
      <td className="p-4 align-middle text-left hidden md:table-cell">
        <span className="text-sm font-bold text-gray-900">{currentRole}</span>
      </td>
      <td className="p-4 align-middle text-left hidden lg:table-cell">
        <span className="text-sm font-bold text-gray-900">{currentDepartment}</span>
      </td>
      <td className="p-4 align-middle text-left hidden xl:table-cell">
        <span className="text-sm font-bold text-gray-900">{emp.companyName || "N/A"}</span>
      </td>
      <td className="p-4 align-middle text-left text-gray-900 text-sm font-semibold hidden xl:table-cell truncate max-w-[200px]">
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
      <td className="p-4 align-middle text-left pl-6 font-mono font-semibold text-gray-500 text-sm hidden sm:table-cell">{emp.employeeId}</td>
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
          <div className="flex flex-col min-w-0">
            <span onClick={() => navigate(`/employee/${emp.employeeId}/profile`)} className="font-semibold text-gray-600 cursor-pointer hover:text-blue-700 hover:underline text-sm truncate">
              {emp.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wide">Deactivated</span>
              <span className="text-[10px] text-gray-400 font-medium sm:hidden">• {emp.employeeId}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="p-4 align-middle text-left hidden md:table-cell"><span className="text-sm font-semibold text-gray-700">{currentRole}</span></td>
      <td className="p-4 align-middle text-left hidden lg:table-cell"><span className="text-sm font-semibold text-gray-700">{currentDepartment}</span></td>
      <td className="p-4 align-middle text-left hidden xl:table-cell"><span className="text-sm font-semibold text-gray-700">{emp.companyName || "N/A"}</span></td>
      <td className="p-4 align-middle text-left text-gray-700 text-sm font-semibold line-through decoration-red-800 hidden xl:table-cell truncate max-w-[200px]">
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
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    if (!reason.trim()) return;
    setIsOptimizing(true);
    try {
      const res = await api.post("/api/ai/optimize-reason", { reason });
      if (res.data && res.data.optimizedReason) {
        setReason(res.data.optimizedReason);
      }
    } catch (err) {
      console.error(err);
      setError("Optimization failed. Please check Gemini API key.");
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => { if (open) { setEndDate(""); setReason(""); setError(""); } }, [open]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!endDate || !reason.trim()) { setError("All fields are required."); return; }
    setError("");
    onSubmit({ endDate, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn cursor-pointer" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md transform transition-all scale-100 cursor-default" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-2">Deactivate Employee</h3>
        <p className="mb-4 text-gray-600">Deactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 font-bold mb-1">Effective Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 px-4 py-2.5 rounded-xl w-full mt-1 focus:ring-2 focus:ring-red-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 font-bold mb-1">
              Reason for Deactivation
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              className="border border-gray-300 px-4 py-2.5 rounded-xl w-full mt-1 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="Please provide a reason..."
              rows={3}
              maxLength={1000}
              required
            />
            <div className="flex justify-start mt-2">
              <button
                type="button"
                onClick={handleOptimize}
                disabled={isOptimizing || !reason.trim()}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-sm font-bold"
              >
                {isOptimizing ? "Optimizing..." : "✨ AI Optimize Reason"}
              </button>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm font-bold">{error}</div>}
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition-colors">Deactivate</button>
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
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    if (!reason.trim()) return;
    setIsOptimizing(true);
    try {
      const res = await api.post("/api/ai/optimize-reason", { reason });
      if (res.data && res.data.optimizedReason) {
        setReason(res.data.optimizedReason);
      }
    } catch (err) {
      console.error(err);
      setError("Optimization failed. Please check Gemini API key.");
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0]);
      setReason("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !reason.trim()) setError("All fields required.");
    else onSubmit({ date, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn cursor-pointer" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md transform transition-all scale-100 cursor-default" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-2">Reactivate Employee</h3>
        <p className="mb-4 text-gray-600">Reactivating <b>{employee.name}</b>.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 font-bold mb-1">Reactivation Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 px-4 py-2.5 rounded-xl w-full mt-1 focus:ring-2 focus:ring-green-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 font-bold mb-1">
              Reason for Reactivation
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 1000))}
              className="border border-gray-300 px-4 py-2.5 rounded-xl w-full mt-1 focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Reason for reactivation..."
              rows={3}
              maxLength={1000}
              required
            />
            <div className="flex justify-start mt-2">
              <button
                type="button"
                onClick={handleOptimize}
                disabled={isOptimizing || !reason.trim()}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-sm font-bold"
              >
                {isOptimizing ? "Optimizing..." : "✨ AI Optimize Reason"}
              </button>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm font-bold">{error}</div>}
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-md transition-colors">Reactivate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivationDetailsModal({ open, employee, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !employee) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn cursor-pointer" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 cursor-default" onClick={(e) => e.stopPropagation()}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-2 sm:p-4 cursor-pointer" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] md:h-[90vh] flex flex-col overflow-hidden cursor-default" onClick={(e) => e.stopPropagation()}>
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
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sm:text-xs font-bold">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left">Date</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Punch In</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden sm:table-cell">Punch Out</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden md:table-cell">Assigned</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Duration</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden lg:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingAtt ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading attendance data...</td></tr>
                  ) : attendanceData.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">No records found for this period.</td></tr>
                  ) : (
                    attendanceData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition text-xs sm:text-sm">
                        <td className="px-3 sm:px-4 py-3 font-medium text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-3 sm:px-4 py-3 text-green-700 font-semibold">
                          {row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-slate-400">--</span>}
                          {row.isLate && <span className="ml-1 sm:ml-2 px-1 py-0.5 bg-red-100 text-red-600 text-[8px] sm:text-[10px] rounded">LATE</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-red-700 font-semibold hidden sm:table-cell">
                          {row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-slate-400">--</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 font-medium text-slate-600 hidden md:table-cell">{formatDecimalHours(row.shiftDuration)}</td>
                        <td className="px-3 sm:px-4 py-3 font-mono text-slate-600">{row.displayTime || "-"}</td>
                        <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.workedStatus === "Full Day" ? "bg-green-100 text-green-700" : row.workedStatus.includes("Absent") ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
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
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sm:text-xs font-bold">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left">Applied</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Period</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden sm:table-cell">Type</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden md:table-cell">Reason</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLeave ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading leave data...</td></tr>
                  ) : leaveData.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500">No leave records found.</td></tr>
                  ) : (
                    leaveData.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition text-xs sm:text-sm">
                        <td className="px-3 sm:px-4 py-3 text-slate-600">{new Date(l.requestDate || l.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 sm:px-4 py-3 font-medium text-slate-800">
                          {new Date(l.from).toLocaleDateString()} <span className="text-slate-400">→</span> <span className="block sm:inline">{new Date(l.to).toLocaleDateString()}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-slate-700 hidden sm:table-cell">{l.leaveType}</td>
                        <td className="px-3 sm:px-4 py-3 text-slate-500 truncate max-w-[100px] sm:max-w-xs hidden md:table-cell">{l.reason || "-"}</td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${l.status === "Approved" ? "bg-green-100 text-green-700" : l.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
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
  const [allResignations, setAllResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState("All");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [companies, setCompanies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // HR Activities main dropdown
  const [hrActivitiesOpen, setHrActivitiesOpen] = useState(false);
  // Document Verification nested submenu
  const [docVerifyOpen, setDocVerifyOpen] = useState(false);

  // HR Flow Process Image modal
  const [hrFlowImageOpen, setHrFlowImageOpen] = useState(false);

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

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, resignationRes, companiesRes] = await Promise.all([
        getEmployees(),
        api.get("/api/resignations/admin/all"),
        getAllCompanies()
      ]);
      setEmployees(empRes);
      setAllResignations(resignationRes.data || []);
      setCompanies(Array.isArray(companiesRes) ? companiesRes : companiesRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedRole, selectedEmploymentType, selectedCompany]);

  useEffect(() => {
    const fetchImages = async () => {
      if (employees.length === 0) return;

      // Filter out IDs we already have images for
      const idsToFetch = employees
        .map((emp) => emp.employeeId)
        .filter((id) => id && !employeeImages[id]);

      if (idsToFetch.length === 0) return;

      try {
        // Use the new bulk fetch endpoint to get all profiles in one request
        const res = await api.post("/api/profile/bulk", { employeeIds: idsToFetch });
        const newImages = {};

        if (Array.isArray(res.data)) {
          res.data.forEach((profile) => {
            if (profile.profilePhoto?.url) {
              newImages[profile.employeeId] = getSecureUrl(profile.profilePhoto.url);
            }
          });
        }

        if (Object.keys(newImages).length > 0) {
          setEmployeeImages((prev) => ({ ...prev, ...newImages }));
        }
      } catch (err) {
        console.error("Error fetching bulk profiles:", err);
      }
    };

    fetchImages();
  }, [employees]);

  const handleDeactivateSubmit = async ({ endDate, reason }) => {
    try {
      await deactivateEmployeeById(selectedEmployee.employeeId, { endDate, reason });
      fetchAllData(); setDeactivateModalOpen(false); setSelectedEmployee(null);
    } catch (e) { alert("Error deactivating"); }
  };

  const handleReactivateSubmit = async ({ date, reason }) => {
    try {
      await activateEmployeeById(selectedEmployee.employeeId, { date, reason });
      fetchAllData(); setReactivateModalOpen(false); setSelectedEmployee(null);
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
        (selectedEmploymentType === "All" || currentEmploymentType === selectedEmploymentType) &&
        (selectedCompany === "All" || emp.company === selectedCompany)
      );
    });
    return {
      activeEmployees: filtered.filter((emp) => emp.isActive !== false),
      inactiveEmployees: filtered.filter((emp) => emp.isActive === false),
    };
  }, [employees, searchQuery, selectedDept, selectedRole, selectedEmploymentType, selectedCompany]);

  const { paginatedEmployees, totalPages } = useMemo(() => {
    const combined = [...activeEmployees, ...inactiveEmployees];
    const pages = Math.ceil(combined.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    return {
      paginatedEmployees: combined.slice(start, start + itemsPerPage),
      totalPages: pages
    };
  }, [activeEmployees, inactiveEmployees, currentPage]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-6 md:py-12">
      <div className="w-full max-w-[98%] xl:max-w-7xl mx-auto px-2 sm:px-4">

        {/* relative z-[20] keeps header above table (z-10) so dropdown never goes under */}
        <div className="relative z-15 flex flex-col bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 md:flex-row justify-between items-center mb-6 md:mb-8 gap-4 px-4 sm:px-8 py-6">
          <div className="text-center md:text-left w-full md:w-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">Employee Management</h2>
            <div className="flex justify-center md:justify-start gap-2 sm:gap-3 mt-3">
              <button onClick={handleDownloadActive} className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm text-xs sm:text-sm font-semibold flex items-center gap-2">
                <FaDownload /> <span className="hidden xs:inline">Active</span> Active List
              </button>
              <button onClick={handleDownloadInactive} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 shadow-sm text-xs sm:text-sm font-semibold flex items-center gap-2">
                <FaDownload /> <span className="hidden xs:inline">Inactive</span> Inactive List
              </button>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto">
            <div className="flex flex-col items-center md:items-end gap-1 w-full md:w-auto">

              {/* HR Flow Process Info Link Button */}
              <button
                onClick={() => setHrFlowImageOpen(true)}
                className="text-xs md:text-sm text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 font-medium transition-colors cursor-pointer mr-1"
                title="View HR Flow Process"
              >
                <FaInfoCircle /> View HR Flow Process
              </button>

              {/* HR Activities Dropdown */}
              <div className="relative w-full md:w-auto" ref={hrDropdownRef}>
                <button
                  onClick={() => { setHrActivitiesOpen(!hrActivitiesOpen); setDocVerifyOpen(false); }}
                  className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-md font-bold flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02] md:hover:scale-105 relative text-sm sm:text-base"
                >
                  <FaClipboardList /> HR Activities
                  {allResignations.filter(r => r.status === "Pending").length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-bounce">
                      {allResignations.filter(r => r.status === "Pending").length}
                    </span>
                  )}
                  <FaChevronDown className={`text-xs transition-transform duration-200 ${hrActivitiesOpen ? "rotate-180" : ""}`} />
                </button>

                {hrActivitiesOpen && (
                  <div className="absolute right-0 md:right-0 left-0 md:left-auto mt-2 w-full md:w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-[9999] overflow-visible">
                    {/* Document Verification with smart positioned nested submenu */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDocVerifyOpen(!docVerifyOpen); }}
                        className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 font-semibold flex items-center justify-between transition-all duration-150 border-b border-slate-100 rounded-t-xl"
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

                    {/* Offer Letter */}
                    <button
                      onClick={() => { navigate("/admin/offer-letter"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-all duration-150 border-b border-slate-100"
                    >
                      <FaFileAlt className="text-blue-500" /> Offer Letter
                    </button>

                    {/* Onboarding Invitation */}
                    <button
                      onClick={() => { navigate("/admin/onboarding-email"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-all duration-150 border-b border-slate-100"
                    >
                      <FaUser className="text-blue-500" /> Onboarding Invitation
                    </button>

                    {/* Add Employee */}
                    <button
                      onClick={() => { navigate("/employees/add"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-all duration-150 border-b border-slate-100"
                    >
                      <FaUserPlus className="text-blue-500" /> Add Employee
                    </button>

                    {/* Induction */}
                    <button
                      onClick={() => { navigate("/admin/induction"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-all duration-150 border-b border-slate-100"
                    >
                      <FaConnectdevelop className="text-blue-500" /> Induction
                    </button>

                    {/* Resignations */}
                    <button
                      onClick={() => { navigate("/admin/resignation"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center justify-between transition-all duration-150 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <FaFileSignature className="text-blue-500" /> Resignations
                      </div>
                      {allResignations.filter(r => r.status === "Pending").length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {allResignations.filter(r => r.status === "Pending").length} New
                        </span>
                      )}
                    </button>

                    {/* Welcome Kit */}
                    <button
                      onClick={() => { navigate("/admin/welcome-kits-management"); setHrActivitiesOpen(false); }}
                      className="w-full text-left px-5 py-3.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3 transition-all duration-150 rounded-b-xl"
                    >
                      <FaGift className="text-blue-500" /> Welcome Kit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>        {/* Filters Section */}
        <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-10 px-4 sm:px-8">
          <div className="relative flex-1 min-w-[200px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border bg-white border-gray-200 pl-10 pr-4 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="flex-1 min-w-[150px] bg-white border border-gray-200 px-3 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700 text-sm"
          >
            <option value="All">All Companies</option>
            {companies.map((company) => (
              <option key={company._id} value={company._id}>{company.name}</option>
            ))}
          </select>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="flex-1 min-w-[150px] bg-white border border-gray-200 px-3 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700 text-sm"
          >
            <option value="All">All Departments</option>
            {departmentSet.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="flex-1 min-w-[150px] bg-white border border-gray-200 px-3 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700 text-sm"
          >
            <option value="All">All Roles</option>
            {roleSet.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select
            value={selectedEmploymentType}
            onChange={(e) => setSelectedEmploymentType(e.target.value)}
            className="flex-1 min-w-[150px] bg-white border border-gray-200 px-3 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700 text-sm"
          >
            <option value="All">All Types</option>
            {employmentTypeSet.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Table Section */}
        <div className="bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 relative z-10 overflow-hidden mx-4 sm:px-0">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr className="text-white uppercase text-[10px] sm:text-xs font-semibold tracking-wider">
                  <th className="p-4 text-left pl-6 hidden sm:table-cell">ID</th>
                  <th className="p-4 text-left">Employee</th>
                  <th className="p-4 text-left hidden md:table-cell">Role</th>
                  <th className="p-4 text-left hidden lg:table-cell">Dept</th>
                  <th className="p-4 text-left hidden xl:table-cell">Company</th>
                  <th className="p-4 text-left hidden xl:table-cell">Email</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500 font-medium text-lg">
                      Loading employees data...
                    </td>
                  </tr>
                ) : paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((emp, idx) => {
                    const combinedList = [...activeEmployees, ...inactiveEmployees];
                    const firstInactiveIdx = combinedList.findIndex(e => e.isActive === false);
                    const globalIdx = (currentPage - 1) * itemsPerPage + idx;
                    const isFirstInactiveGlobal = firstInactiveIdx !== -1 && globalIdx === firstInactiveIdx;

                    return (
                      <Fragment key={emp.employeeId}>
                        {isFirstInactiveGlobal && (
                          <tr>
                            <td colSpan="7" className="p-3 text-center font-bold text-white text-sm tracking-widest uppercase bg-slate-700 border-b border-slate-600">
                              Inactive Employees
                            </td>
                          </tr>
                        )}
                        {emp.isActive !== false ? (
                          <EmployeeRow
                            emp={emp}
                            idx={idx}
                            navigate={navigate}
                            onDeactivateClick={openDeactivateModal}
                            onOverviewClick={openOverviewModal}
                            profilePic={employeeImages[emp.employeeId]}
                            onImageClick={setPreviewImage}
                            resignations={allResignations}
                          />
                        ) : (
                          <InactiveEmployeeRow
                            emp={emp}
                            navigate={navigate}
                            onReactivateClick={openReactivateModal}
                            onViewDetailsClick={openViewDetailsModal}
                            onOverviewClick={openOverviewModal}
                            profilePic={employeeImages[emp.employeeId]}
                            onImageClick={setPreviewImage}
                          />
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400 font-medium">
                      No employees found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-8 gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm font-medium"
            >
              Previous
            </button>
            <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 shrink-0 rounded-lg border font-medium transition-all ${currentPage === i + 1
                      ? "bg-blue-600 border-blue-600 text-white shadow-md scale-105"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm font-medium"
            >
              Next
            </button>
          </div>
        )}

        {/* MODALS */}
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

        {hrFlowImageOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-6" onClick={() => setHrFlowImageOpen(false)}>
            <div className="relative w-full max-w-5xl max-h-[95vh] bg-white rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b shrink-0">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FaInfoCircle className="text-indigo-600" /> HR Flow Process
                </h3>
                <button onClick={() => setHrFlowImageOpen(false)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <FaTimes size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto bg-gray-50 rounded-b-xl flex-1 text-center">
                <img
                  src="https://www.image2url.com/r2/default/images/1776774956564-99ccf970-8216-415e-b08a-90b2e1a709cb.png"
                  alt="HR Flow Process"
                  className="block w-full max-w-4xl mx-auto h-auto rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;
