import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";

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
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${expired ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
      <span>{expired ? "⏰" : "⏱"}</span>
      <span>{timeLeft}</span>
      {!expired && (
        <span className="text-xs text-blue-500">
          (ends {new Date(endDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })})
        </span>
      )}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = {
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Approved: "bg-blue-100 text-blue-700 border-blue-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
    "Exit Formalities": "bg-purple-100 text-purple-700 border-purple-200",
    Completed: "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
};

const hasReceivedFinalDocs = (r) => Array.isArray(r.adminFinalDocs) && r.adminFinalDocs.length > 0;

// ─── View Letter Modal ────────────────────────────────────────────────────────
const LetterModal = ({ title, html, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
      </div>
      <div className="overflow-y-auto p-6 flex-1 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="px-6 py-3 border-t flex justify-end">
        <button onClick={onClose} className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Close</button>
      </div>
    </div>
  </div>
);

// ─── Submit Form Modal ────────────────────────────────────────────────────────
const SubmitModal = ({ employee, onClose, onSuccess }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-800">✍️ Submit Resignation Letter</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            Your AI-generated resignation letter will be created based on the information you provide. It will include your name, role, and reason for leaving.
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Reason for Resignation <span className="text-red-500">*</span></label>
            <textarea rows={5} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Please describe your reason for resignation in detail..."
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Letter…</>
              ) : "🤖 Generate & Submit"}
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

// ─── Goodbye Popup (15 seconds countdown, then auto-logout) ──────────────────
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white rounded-full opacity-60 animate-pulse"
            style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }} />
        ))}
      </div>

      <div className="relative text-center px-8 py-10 max-w-lg mx-4">
        {/* Big emoji */}
        <div className="text-8xl mb-6 animate-bounce">🎓</div>

        <h1 className="text-4xl font-extrabold text-white mb-3">
          Goodbye, {employeeName?.split(" ")[0]}! 👋
        </h1>
        <p className="text-indigo-200 text-lg mb-2 font-medium">
          Thank you for your wonderful contribution!
        </p>
        <p className="text-purple-200 text-base mb-6 leading-relaxed">
          Your time here has been truly valued. Wishing you all the very best in your next chapter. Go shine! 🌟
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="h-px bg-white/20 flex-1" />
          <span className="text-white/50 text-sm">All the best</span>
          <div className="h-px bg-white/20 flex-1" />
        </div>

        {/* Messages */}
        <div className="grid grid-cols-3 gap-3 mb-8 text-sm">
          {["Keep growing 🌱", "Stay amazing ✨", "New adventures 🚀"].map(m => (
            <div key={m} className="bg-white/10 rounded-xl px-3 py-2 text-white font-medium">{m}</div>
          ))}
        </div>

        {/* Countdown */}
        <div className="bg-white/10 rounded-2xl px-6 py-4 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-extrabold text-xl">
            {count}
          </div>
          <p className="text-white/80 text-sm">Logging you out automatically…</p>
        </div>

        {/* Manual logout button */}
        <button onClick={onLogout}
          className="mt-5 px-8 py-3 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition text-sm">
          Logout Now →
        </button>
      </div>
    </div>
  );
};

// ─── Exit Formalities Panel (Employee View) ───────────────────────────────────
const ExitFormalitiesEmployee = ({ resignation, onUpdate, onFinalExit }) => {
  const [uploading, setUploading] = useState({});
  const [kitItems, setKitItems] = useState([]);
  const [kitSubmitting, setKitSubmitting] = useState(false);
  const [kitSubmitted, setKitSubmitted] = useState(false);

  // Init welcome kit items from resignation data
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

  // Check if all employee docs are uploaded (at least one doc per slot)
  const allDocsUploaded = resignation.exitDocuments.length > 0 &&
    resignation.exitDocuments.every(d => d.uploadedByEmployee || d.uploadedByAdmin);

  // Check if all docs verified by admin
  const allVerified = resignation.exitDocuments.length > 0 &&
    resignation.exitDocuments.every(d => d.verifiedByAdmin);

  const hasKitItems = kitItems.length > 0;
  const kitReady = !hasKitItems || kitSubmitted;

  // HR contact message: show after doc uploads are done but not yet verified
  const showHRMessage = allDocsUploaded && (!allVerified || (hasKitItems && kitSubmitted));

  return (
    <div className="space-y-5 mt-3">

      {/* ── Documents to upload (employee side) ── */}
      {resignation.exitDocuments.length > 0 && (
        <div>
          <h4 className="font-bold text-slate-700 text-sm mb-2">📦 Exit Formality Documents</h4>
          {resignation.exitDocuments.map((doc, idx) => (
            <div key={idx} className={`flex flex-wrap items-center justify-between rounded-xl px-4 py-3 border mb-2 ${doc.verifiedByAdmin ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${doc.verifiedByAdmin ? "bg-green-500" : doc.uploadedByEmployee ? "bg-yellow-400" : "bg-slate-300"}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-700 truncate">{doc.docName}</p>
                  <p className="text-xs text-slate-400">
                    {doc.verifiedByAdmin ? "✅ Verified by Admin" : doc.uploadedByEmployee ? "⏳ Awaiting admin verification" : "Please upload this document"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View admin uploaded document */}
                {doc.uploadedByAdmin && (
                  <button onClick={() => downloadFile(doc.uploadedByAdmin, doc.docName)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                    👁 View
                  </button>
                )}
                {/* Employee upload */}
                {!doc.verifiedByAdmin && (
                  <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${uploading[idx] ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                    {uploading[idx] ? "Uploading…" : doc.uploadedByEmployee ? "↻ Re-upload" : "📎 Upload"}
                    <input type="file" className="hidden" accept="image/*,.pdf"
                      onChange={e => handleUpload(idx, e.target.files[0])} disabled={uploading[idx] || doc.verifiedByAdmin} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Welcome Kit Return (checklist) ── */}
      {hasKitItems && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h4 className="font-bold text-amber-800 text-sm mb-1">🎁 Welcome Kit Return</h4>
          <p className="text-xs text-amber-600 mb-3">
            {kitSubmitted
              ? "You have submitted your kit return status."
              : "Please confirm which items you have returned to the organization."}
          </p>
          <div className="space-y-2">
            {kitItems.map((item, i) => (
              <label key={i}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border cursor-pointer transition ${kitSubmitted ? "cursor-default" : "hover:bg-amber-100"} ${item.returned ? "bg-green-50 border-green-300" : "bg-white border-amber-200"}`}>
                <input type="checkbox" checked={item.returned} onChange={() => toggleKitItem(i)}
                  disabled={kitSubmitted}
                  className="w-4 h-4 accent-green-600 rounded" />
                <span className="text-sm font-semibold text-slate-700">
                  {item.returned ? "✅" : "⬜"} Have you returned the <span className="text-amber-700">{item.itemName}</span>?
                </span>
              </label>
            ))}
          </div>
          {!kitSubmitted && (
            <button onClick={handleKitSubmit} disabled={kitSubmitting}
              className="mt-3 w-full py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:opacity-60 transition text-sm">
              {kitSubmitting ? "Submitting…" : "✅ Submit Kit Return"}
            </button>
          )}
          {kitSubmitted && (
            <p className="mt-2 text-center text-green-700 text-xs font-semibold">🎉 Kit return submitted successfully!</p>
          )}
        </div>
      )}

      {/* ── HR Contact Message ── */}
      {showHRMessage && !allVerified && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-2xl">📞</span>
          <div>
            <p className="font-bold text-blue-800 text-sm">Please contact HR for final exit</p>
            <p className="text-blue-600 text-xs mt-1">Your documents are under review. HR will verify them and share your final documents.</p>
          </div>
        </div>
      )}

      {/* ── Admin Verified: show verified message ── */}
      {allVerified && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold">
          ✅ Your uploaded documents have been verified by Admin!
        </div>
      )}

      {/* ── Final Documents from Admin ── */}
      {resignation.adminFinalDocs && resignation.adminFinalDocs.length > 0 && resignation.status === "Completed" && (
        <div>
          <h4 className="font-bold text-slate-700 text-sm mb-2">📄 Your Final Documents</h4>
          <div className="space-y-2">
            {resignation.adminFinalDocs.map((doc, i) => (
              <div key={i} className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-indigo-800 text-sm">📄 {doc.docName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(doc.uploadedByAdmin, "_blank")}
                    className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-200 border border-indigo-300">
                    👁 View
                  </button>
                  <button onClick={() => downloadFile(doc.uploadedByAdmin, doc.docName)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                    ⬇ Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FINAL EXIT Button ── */}
      {(resignation.status === "Completed" && hasReceivedFinalDocs(resignation)) && (
        <button onClick={onFinalExit}
          className="w-full py-4 bg-gradient-to-r from-red-500 via-pink-600 to-purple-700 text-white rounded-2xl font-extrabold text-lg hover:opacity-90 transition shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-100">
          🚪 FINAL EXIT
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
  const getDesignation = (r) => r.designation || r.currentRole || employee?.designation || employee?.currentRole || user?.designation || user?.currentRole || "Designation";
  const getDepartment = (r) => r.department || r.currentDepartment || employee?.department || employee?.currentDepartment || user?.department || user?.currentDepartment || "Department";

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
    } catch { /* record the final exit — non-blocking */ }
    setGoodbyeResignation(resignation);
    setShowGoodbye(true);
  };

  const handleLogout = () => {
    if (logout) logout();
    else {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const hasActiveResignation = resignations.some(r => ["Pending", "Approved", "Exit Formalities"].includes(r.status));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Show goodbye screen
  if (showGoodbye) {
    return (
      <GoodbyePopup
        employeeName={goodbyeResignation?.employeeName || user?.name || ""}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">📝 Resignation Portal</h1>
        <p className="text-slate-500 mt-1 text-sm">Submit and track your resignation request here.</p>
      </div>

      {/* Generate Button Hero Card */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 mb-6 shadow-lg text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">AI-Powered Resignation Letter</h2>
            <p className="text-blue-200 text-sm">Our AI will generate a professional resignation letter based on your profile and reason.</p>
            {hasActiveResignation && (
              <p className="text-yellow-300 text-xs mt-2">⚠️ You already have an active resignation in progress.</p>
            )}
          </div>
          <button
            onClick={() => !hasActiveResignation && setShowSubmitModal(true)}
            disabled={hasActiveResignation}
            className={`flex-shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition shadow-md flex items-center gap-2
              ${hasActiveResignation ? "bg-white/20 cursor-not-allowed opacity-60" : "bg-white text-blue-700 hover:bg-blue-50"}`}>
            🤖 Generate Resignation Letter
          </button>
        </div>
      </div>

      {/* Resignation History */}
      {resignations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg font-semibold text-slate-600">No resignations submitted yet.</p>
          <p className="text-slate-400 text-sm mt-1">Click the button above to generate and submit your resignation letter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-700">My Resignation History</h2>
          {resignations.map(r => (
            <div key={r._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between px-5 py-4 gap-3 cursor-pointer"
                onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                    {r.status === "Completed" ? "🎉" : r.status === "Approved" ? "✅" : r.status === "Rejected" ? "❌" : "📝"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {r.employeeName || employeeName}
                    </p>
                    <p className="text-xs text-slate-400">Submitted: {new Date(r.submittedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-slate-400 text-sm">{expanded === r._id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded */}
              {expanded === r._id && (
                <div className="border-t border-slate-100 px-5 py-5 space-y-4">
                  {/* Notice period countdown */}
                  {r.status === "Approved" && r.noticePeriodEndDate && (
                    <CountdownTimer endDate={r.noticePeriodEndDate} />
                  )}

                  {/* Rejection */}
                  {r.status === "Rejected" && r.adminRemark && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                      <span className="font-semibold text-red-700">Rejection Reason: </span>
                      <span className="text-red-600">{r.adminRemark}</span>
                    </div>
                  )}

                  {/* Approved — show acceptance status */}
                  {(r.status === "Approved" || r.status === "Exit Formalities" || r.status === "Completed") && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-semibold">
                      ✅ Your resignation has been accepted by HR.
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {r.resignationLetterHtml && (
                      <button onClick={() => setViewLetter(r)}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600">
                        📄 View Resignation Letter
                      </button>
                    )}
                    {r.acceptanceLetterHtml && (
                      <button onClick={() => setViewAccLetter(r)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                        📃 View Acceptance Letter
                      </button>
                    )}
                    {/* Download acceptance letter file if admin uploaded one */}
                    {r.acceptanceLetterFileUrl && (
                      <button onClick={() => downloadFile(r.acceptanceLetterFileUrl, `Acceptance_Letter_${r.employeeName}`)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
                        ⬇ Download Acceptance Letter
                      </button>
                    )}
                  </div>

                  {/* Exit Formalities */}
                  {(r.status === "Exit Formalities" || r.status === "Completed") && (
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

      {/* Modals */}
      {showSubmitModal && employee && (
        <SubmitModal employee={employee} onClose={() => setShowSubmitModal(false)}
          onSuccess={() => { setShowSubmitModal(false); fetchResignations(); }} />
      )}
      {viewLetter && (
        <LetterModal title="Your Resignation Letter" html={viewLetter.resignationLetterHtml} onClose={() => setViewLetter(null)} />
      )}
      {viewAccLetter && (
        <LetterModal title="Acceptance Letter from HR" html={viewAccLetter.acceptanceLetterHtml} onClose={() => setViewAccLetter(null)} />
      )}
    </div>
  );
};

export default EmployeeResignation;