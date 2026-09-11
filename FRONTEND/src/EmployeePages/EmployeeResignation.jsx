import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import { generateOfferLetterPdf } from "../utils/offerLetterPdfGenerator";
import {
  FaFileAlt,
  FaFileSignature,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaDownload,
  FaEye,
  FaDoorOpen,
  FaRobot,
  FaExclamationTriangle,
  FaBoxes,
  FaGift,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
  FaPaperPlane,
  FaUserCheck,
  FaShieldAlt
} from "react-icons/fa";

// ─── IST Countdown Timer ──────────────────────────────────────────────────────
const CountdownTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate) - new Date();
      if (diff <= 0) { setExpired(true); setTimeLeft("Notice period ended"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s remaining`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endDate]);

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border shadow-sm ${
      expired 
        ? "bg-rose-50 text-rose-700 border-rose-200" 
        : "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-indigo-500/5"
    }`}>
      <span className="text-sm">{expired ? "⏰" : "⏱"}</span>
      <span>{timeLeft}</span>
      {!expired && (
        <span className="text-[11px] text-indigo-500/80 font-semibold">
          (Ends {new Date(endDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })})
        </span>
      )}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const badgeConfig = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200/80 shadow-[0_0_12px_-2px_rgba(245,158,11,0.25)]",
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-[0_0_12px_-2px_rgba(16,185,129,0.25)]",
    Rejected: "bg-rose-50 text-rose-700 border-rose-200/80",
    "Exit Formalities": "bg-purple-50 text-purple-700 border-purple-200/80 shadow-[0_0_12px_-2px_rgba(168,85,247,0.25)]",
    Completed: "bg-blue-50 text-blue-700 border-blue-200/80 shadow-[0_0_12px_-2px_rgba(59,130,246,0.25)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full border ${badgeConfig[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === "Approved" ? "bg-emerald-500 animate-pulse" :
        status === "Pending" ? "bg-amber-500" :
        status === "Rejected" ? "bg-rose-500" : "bg-purple-500"
      }`} />
      {status}
    </span>
  );
};

const hasReceivedFinalDocs = (r) => Array.isArray(r.adminFinalDocs) && r.adminFinalDocs.length > 0;

const formatNoticeDate = (date) => new Date(date).toLocaleDateString("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const isNoticePeriodCompleted = (r) => r.noticePeriodEndDate && new Date() >= new Date(r.noticePeriodEndDate);

const shouldShowExitFormalities = (r) =>
  r.status === "Exit Formalities" ||
  r.status === "Completed" ||
  (r.status === "Approved" && isNoticePeriodCompleted(r));

// ─── View Letter Modal ────────────────────────────────────────────────────────
const LetterModal = ({ title, html, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <FaFileAlt className="text-indigo-600" />
          {title}
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-all">
          <FaTimes className="text-base" />
        </button>
      </div>
      <div className="overflow-y-auto p-6 sm:p-8 flex-1 text-sm leading-relaxed text-slate-800 bg-white" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
        <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-extrabold transition-all shadow-md">
          Close Document
        </button>
      </div>
    </div>
  </div>
);

// ─── Submit Form Modal ────────────────────────────────────────────────────────
const SubmitModal = ({ employee, onClose, onSuccess }) => {
  const [reason, setReason] = useState("Better Opportunity");
  const [resignationDate, setResignationDate] = useState(new Date().toISOString().split("T")[0]);
  const [additionalRemarks, setAdditionalRemarks] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError("Please check the acknowledgment box."); return; }
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/api/resignations/submit", {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        employeeEmail: employee.email,
        department: employee.department || employee.currentDepartment || "",
        designation: employee.designation || employee.currentRole || "",
        companyName: employee.companyName || "Unknown",
        reason,
        resignationDate,
        additionalRemarks
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FaRobot className="text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Submit Resignation Request</h3>
              <p className="text-xs text-slate-500 font-semibold">AI will generate a formal draft for management review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/60 transition-all">
            <FaTimes className="text-base" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Reason for Resignation <span className="text-rose-500">*</span>
              </label>
              <select 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="Better Opportunity">Better Opportunity</option>
                <option value="Health Issues">Health Issues</option>
                <option value="Personal Reasons">Personal Reasons</option>
                <option value="Higher Education">Higher Education</option>
                <option value="Relocation">Relocation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Resignation Date <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                value={resignationDate} 
                onChange={e => setResignationDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Additional Remarks (Optional)
            </label>
            <textarea 
              rows={3} 
              value={additionalRemarks} 
              onChange={e => setAdditionalRemarks(e.target.value)}
              placeholder="Provide any context or appreciation for the team..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-semibold text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
            />
          </div>

          <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 cursor-pointer hover:bg-indigo-50/30 transition-colors">
            <input 
              type="checkbox" 
              checked={agreed} 
              onChange={e => setAgreed(e.target.checked)} 
              className="w-5 h-5 accent-indigo-600 mt-0.5 rounded cursor-pointer" 
            />
            <span className="text-xs font-bold text-slate-700 leading-relaxed">
              I understand that I will serve the applicable notice period as determined by management upon review.
            </span>
          </label>

          {error && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center gap-2">
              <FaExclamationTriangle className="shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2 justify-end border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2.5 border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60 flex items-center gap-2"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Generate & Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── File download helper ──────────────────────────────────────────────────────
const downloadFile = async (url, name) => {
  try {
    window.open(url, "_blank");
    const secureUrl = url.replace("http://", "https://");
    const resp = await fetch(secureUrl.replace("/upload/", "/upload/fl_attachment/"));
    const blob = await resp.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = name || "document";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch { window.open(url, "_blank"); }
};

// ─── Goodbye Popup ─────────────────────────────────────────────────────────────
const GoodbyePopup = ({ employeeName, onLogout }) => {
  const [count, setCount] = useState(15);

  useEffect(() => {
    const iv = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(iv); onLogout(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onLogout]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-6">
      <div className="relative text-center px-8 py-10 max-w-lg mx-auto bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl">
        <div className="text-7xl mb-4 animate-bounce">🎓</div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
          Farewell, {employeeName?.split(" ")[0]}! 👋
        </h1>
        <p className="text-indigo-200 text-sm mb-6 font-semibold">
          Thank you for your valuable contributions. We wish you boundless success in your future journeys!
        </p>

        <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-center gap-3 mb-6 border border-white/10">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-base">
            {count}
          </div>
          <p className="text-white/80 text-xs font-semibold">Logging out automatically...</p>
        </div>

        <button 
          onClick={onLogout}
          className="w-full py-3 bg-white hover:bg-slate-100 text-indigo-950 font-black rounded-2xl transition-all shadow-lg text-xs tracking-wide uppercase"
        >
          Logout Immediately →
        </button>
      </div>
    </div>
  );
};

// ─── Exit Formalities Panel ────────────────────────────────────────────────────
const ExitFormalitiesEmployee = ({ resignation, onUpdate, onFinalExit }) => {
  const [uploading, setUploading] = useState({});
  const [kitItems, setKitItems] = useState([]);
  const [kitSubmitting, setKitSubmitting] = useState(false);
  const [kitSubmitted, setKitSubmitted] = useState(false);

  useEffect(() => {
    if (resignation.welcomeKitItems && resignation.welcomeKitItems.length > 0) {
      setKitItems(resignation.welcomeKitItems.map(i => ({ ...i })));
      setKitSubmitted(resignation.welcomeKitSubmittedByEmployee || false);
    }
  }, [resignation.welcomeKitItems, resignation.welcomeKitSubmittedByEmployee]);

  const handleUpload = async (idx, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [idx]: true }));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/api/resignations/employee/upload-doc/${resignation._id}/${idx}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      onUpdate(data.resignation);
    } catch (e) { alert("Upload failed: " + (e.response?.data?.error || e.message)); }
    setUploading(prev => ({ ...prev, [idx]: false }));
  };

  const toggleKitItem = (idx) => {
    if (kitSubmitted) return;
    setKitItems(prev => prev.map((item, i) => i === idx ? { ...item, returned: !item.returned } : item));
  };

  const handleKitSubmit = async () => {
    setKitSubmitting(true);
    try {
      const { data } = await api.post(`/api/resignations/employee/welcome-kit-return/${resignation._id}`, {
        returnedItems: kitItems
      });
      onUpdate(data.resignation);
      setKitSubmitted(true);
    } catch (e) { alert("Failed to submit: " + (e.response?.data?.message || e.message)); }
    setKitSubmitting(false);
  };

  const allDocsUploaded = resignation.exitDocuments.length > 0 &&
    resignation.exitDocuments.every(d => d.uploadedByEmployee || d.uploadedByAdmin);

  const allVerified = resignation.exitDocuments.length > 0 &&
    resignation.exitDocuments.every(d => d.verifiedByAdmin);

  const hasKitItems = kitItems.length > 0;
  const showHRMessage = allDocsUploaded && (!allVerified || (hasKitItems && kitSubmitted));

  return (
    <div className="space-y-4 pt-3 border-t border-slate-100">
      {resignation.exitDocuments.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <FaBoxes className="text-indigo-600" /> Exit Handover Documents
          </h4>
          {resignation.exitDocuments.map((doc, idx) => (
            <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              doc.verifiedByAdmin 
                ? "bg-emerald-50/60 border-emerald-200/80" 
                : "bg-slate-50 border-slate-200/80"
            }`}>
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  doc.verifiedByAdmin ? "bg-emerald-500" : doc.uploadedByEmployee ? "bg-amber-400" : "bg-slate-300"
                }`} />
                <div>
                  <p className="font-extrabold text-xs text-slate-800">{doc.docName}</p>
                  <p className="text-[11px] font-semibold text-slate-400">
                    {doc.verifiedByAdmin ? "Verified by Admin" : doc.uploadedByEmployee ? "Awaiting admin verification" : "Upload requested file"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.uploadedByAdmin && (
                  <button onClick={() => downloadFile(doc.uploadedByAdmin, doc.docName)}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 flex items-center gap-1.5">
                    <FaEye /> View
                  </button>
                )}
                {!doc.verifiedByAdmin && (
                  <label className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 shadow-sm transition-all ${
                    uploading[idx] ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}>
                    {uploading[idx] ? "Uploading..." : doc.uploadedByEmployee ? "↻ Re-upload" : "📎 Upload"}
                    <input type="file" className="hidden" accept="image/*,.pdf"
                      onChange={e => handleUpload(idx, e.target.files[0])} disabled={uploading[idx] || doc.verifiedByAdmin} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasKitItems && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FaGift className="text-amber-600 text-base" />
            <h4 className="font-black text-amber-900 text-xs uppercase tracking-wider">Welcome Kit & Asset Return</h4>
          </div>
          <div className="space-y-2">
            {kitItems.map((item, i) => (
              <label key={i}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  item.returned ? "bg-emerald-50 border-emerald-300" : "bg-white border-amber-200/80 hover:bg-amber-50"
                }`}>
                <input type="checkbox" checked={item.returned} onChange={() => toggleKitItem(i)}
                  disabled={kitSubmitted}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
                <span className="text-xs font-bold text-slate-700">
                  {item.returned ? "✅" : "⬜"} Returned <span className="text-amber-800">{item.itemName}</span>
                </span>
              </label>
            ))}
          </div>
          {!kitSubmitted && (
            <button onClick={handleKitSubmit} disabled={kitSubmitting}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs shadow-md transition-all">
              {kitSubmitting ? "Submitting..." : "Submit Kit Status"}
            </button>
          )}
        </div>
      )}

      {showHRMessage && !allVerified && (
        <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3">
          <FaShieldAlt className="text-blue-600 text-lg shrink-0" />
          <p className="text-xs font-bold text-blue-800">
            Your documents are under review. HR will verify all uploads and finalize your exit credentials.
          </p>
        </div>
      )}

      {resignation.status === "Completed" && hasReceivedFinalDocs(resignation) && (
        <button onClick={onFinalExit}
          className="w-full py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 text-white rounded-2xl font-black text-sm hover:opacity-95 transition-all shadow-xl shadow-rose-500/20 active:scale-98 flex items-center justify-center gap-2">
          <FaDoorOpen className="text-lg" /> COMPLETE FINAL EXIT & LOGOUT
        </button>
      )}
    </div>
  );
};

// ─── Main Employee Resignation Page ──────────────────────────────────────────
const EmployeeResignation = () => {
  const { user, logout } = useContext(AuthContext);
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [viewLetter, setViewLetter] = useState(null);
  const [viewAccLetter, setViewAccLetter] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showGoodbye, setShowGoodbye] = useState(false);
  const [goodbyeResignation, setGoodbyeResignation] = useState(null);

  const employeeId = user?.employeeId || user?.empId || "";
  const employeeName = employee?.name || employee?.employeeName || user?.name || user?.employeeName || "Employee";

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    try {
      const { data } = await api.get(`/api/employees/${employeeId}`);
      setEmployee(data);
    } catch {
      setEmployee({ ...user, employeeId });
    }
  }, [employeeId, user]);

  const fetchResignations = useCallback(async () => {
    if (!employeeId) return;
    try {
      const { data } = await api.get(`/api/resignations/my/${employeeId}`);
      setResignations(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchEmployee();
    fetchResignations();
  }, [fetchEmployee, fetchResignations]);

  const handleUpdate = (updated) => {
    setResignations(prev => prev.map(r => r._id === updated._id ? updated : r));
  };

  const handleFinalExit = async (resignation) => {
    try {
      await api.post(`/api/resignations/employee/final-exit/${resignation._id}`);
    } catch {}
    setGoodbyeResignation(resignation);
    setShowGoodbye(true);
  };

  const handleLogout = () => {
    if (logout) logout();
    else {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const hasActiveResignation = resignations.some(r => ["Pending", "Approved", "Exit Formalities"].includes(r.status));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (showGoodbye) {
    return (
      <GoodbyePopup
        employeeName={goodbyeResignation?.employeeName || user?.name || ""}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent tracking-tight">
            Resignation & Career Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
            Submit, review letters, track notice periods, and complete exit formalities
          </p>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 shadow-xl shadow-indigo-500/10 text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <FaFileSignature className="text-[200px]" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">
              AI-Powered Assistant
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">Generate Professional Resignation Letter</h2>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-xl font-medium leading-relaxed">
              Our automated system drafts a formal, polished resignation letter customized to your department, role, and reasons.
            </p>
            {hasActiveResignation && (
              <p className="text-amber-300 text-xs font-bold flex items-center gap-1.5 pt-1">
                <FaExclamationTriangle /> An active resignation request is currently in review.
              </p>
            )}
          </div>
          <button
            onClick={() => !hasActiveResignation && setShowSubmitModal(true)}
            disabled={hasActiveResignation}
            className={`px-6 py-3.5 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 ${
              hasActiveResignation 
                ? "bg-white/20 text-white/50 cursor-not-allowed" 
                : "bg-white text-indigo-700 hover:bg-indigo-50 shadow-indigo-950/20 active:scale-95"
            }`}
          >
            <FaRobot className="text-base" /> Generate Resignation Draft
          </button>
        </div>
      </div>

      {/* Resignation History */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-800 tracking-tight">My Resignation Record</h3>
        {resignations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FaFileSignature className="text-2xl" />
            </div>
            <p className="text-base font-bold text-slate-700">No Resignations Submitted</p>
            <p className="text-xs text-slate-400 mt-1">When you submit a resignation, your status, letters, and notice period will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {resignations.map(r => (
              <div key={r._id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-indigo-200">
                <div 
                  className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpanded(expanded === r._id ? null : r._id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {r.status === "Completed" ? "🎉" : r.status === "Approved" ? "✅" : r.status === "Rejected" ? "❌" : "📝"}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">{r.employeeName || employeeName}</h4>
                      <p className="text-xs text-slate-400 font-semibold">
                        Submitted: {new Date(r.submittedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                      {expanded === r._id ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                  </div>
                </div>

                {expanded === r._id && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/40">
                    {r.status === "Approved" && r.noticePeriodEndDate && (
                      <div className="pt-2">
                        <CountdownTimer endDate={r.noticePeriodEndDate} />
                      </div>
                    )}

                    {r.status === "Rejected" && r.adminRemark && (
                      <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs font-bold text-rose-800">
                        <span>Rejection Remark: </span>{r.adminRemark}
                      </div>
                    )}

                    {r.status === "Approved" && r.noticePeriodEndDate && new Date(r.noticePeriodEndDate) > new Date() ? (
                      <div className="p-4 bg-indigo-50 border border-indigo-200/80 rounded-2xl text-xs font-bold text-indigo-800">
                        ✅ Resignation accepted. Please serve the required notice period until {formatNoticeDate(r.noticePeriodEndDate)}.
                      </div>
                    ) : (r.status === "Approved" || r.status === "Exit Formalities" || r.status === "Completed") && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs font-bold text-emerald-800">
                        ✅ Resignation formally accepted by management.
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2.5 pt-2">
                      {r.resignationLetterHtml && (
                        <button onClick={() => setViewLetter(r)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                          <FaEye /> View Resignation Letter
                        </button>
                      )}
                      {r.acceptanceLetterHtml && (
                        <button onClick={() => setViewAccLetter(r)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                          <FaFileAlt /> View Acceptance Letter
                        </button>
                      )}
                      {r.acceptanceLetterFileUrl && (!r.noticePeriodEndDate || new Date(r.noticePeriodEndDate) <= new Date()) && (
                        <button onClick={() => downloadFile(r.acceptanceLetterFileUrl, `Acceptance_Letter_${r.employeeName}`)}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                          <FaDownload /> Download Signed Acceptance
                        </button>
                      )}
                      {(isNoticePeriodCompleted(r) || r.status === "Completed") && !r.relievingLetterDownloaded && (
                        <button onClick={async () => {
                          if (window.confirm("Downloading the Relieving Letter will conclude your tenure and deactivate access. Proceed?")) {
                            try {
                              const res = await api.post(`/api/resignations/employee/download-relieving/${r._id}`);
                              
                              if (res.data.relievingHtml) {
                                // Generate PDF
                                const dataUri = await generateOfferLetterPdf(res.data.relievingHtml);
                                // Trigger local download
                                const link = document.createElement("a");
                                link.href = dataUri;
                                link.download = `Relieving_Letter_${r.employeeName.replace(/\s+/g, '_')}.pdf`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }

                              alert("Relieving letter downloaded. Account deactivated.");
                              handleLogout();
                            } catch (err) {
                              console.error(err);
                              alert("Failed to download relieving letter.");
                            }
                          }
                        }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                          <FaDownload /> Download Relieving Letter
                        </button>
                      )}
                    </div>

                    {shouldShowExitFormalities(r) && (
                      <ExitFormalitiesEmployee
                        resignation={r}
                        onUpdate={handleUpdate}
                        onFinalExit={() => handleFinalExit(r)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSubmitModal && employee && (
        <SubmitModal employee={employee} onClose={() => setShowSubmitModal(false)}
          onSuccess={() => { setShowSubmitModal(false); fetchResignations(); }} />
      )}
      {viewLetter && (
        <LetterModal title="Resignation Letter" html={viewLetter.resignationLetterHtml} onClose={() => setViewLetter(null)} />
      )}
      {viewAccLetter && (
        <LetterModal title="Acceptance Letter" html={viewAccLetter.acceptanceLetterHtml} onClose={() => setViewAccLetter(null)} />
      )}
    </div>
  );
};

export default EmployeeResignation;