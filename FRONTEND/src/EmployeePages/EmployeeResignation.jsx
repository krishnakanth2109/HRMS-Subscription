import React, { useState, useEffect, useCallback, useContext } from "react";
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
            <p>Your AI-generated resignation letter will be created based on the information you provide. It will include your name, role, and reason for leaving.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Reason for Resignation <span className="text-red-500">*</span></label>
            <textarea rows={5} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Please describe your reason for resignation in detail..."
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
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

// ─── Exit Formalities Panel (Employee View) ─────────────────────────────────
const ExitFormalitiesEmployee = ({ resignation, onUpdate }) => {
  const [uploading, setUploading] = useState({});

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

  const handleAddMore = async () => {
    try {
      const { data } = await api.post(`/api/resignations/${resignation._id}/add-document`);
      onUpdate(data.resignation);
    } catch (e) {
      alert("Failed to add document: " + (e.response?.data?.message || e.message));
    }
  };

  const handleDownload = async (url, defaultName) => {
    try {
      window.open(url, "_blank"); // View in another tab

      const secureUrl = url.replace('http://', 'https://');
      const resp = await fetch(secureUrl.replace('/upload/', '/upload/fl_attachment/'));
      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = defaultName || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-3 mt-3">
      <h4 className="font-bold text-slate-700 text-sm">📦 Exit Formality Documents</h4>
      {resignation.exitDocuments.map((doc, idx) => (
        <div key={idx} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${doc.verifiedByAdmin ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${doc.verifiedByAdmin ? "bg-green-500" : doc.uploadedByEmployee ? "bg-yellow-400" : "bg-slate-300"}`} />
            <div>
              <p className="font-semibold text-sm text-slate-700">{doc.docName}</p>
              <p className="text-xs text-slate-400">
                {doc.verifiedByAdmin ? "✅ Verified by Admin" : doc.uploadedByEmployee ? "⏳ Awaiting admin verification" : "Pending upload"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download admin-uploaded document */}
            {doc.uploadedByAdmin && (
              <button onClick={() => handleDownload(doc.uploadedByAdmin, doc.docName)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                ⬇ Download
              </button>
            )}
            {/* Employee upload */}
            {!doc.verifiedByAdmin && (
              <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${uploading[idx] ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                {uploading[idx] ? "Uploading…" : doc.uploadedByEmployee ? "↻ Re-upload" : "📎 Upload"}
                <input type="file" className="hidden" accept="image/*"
                  onChange={e => handleUpload(idx, e.target.files[0])} disabled={uploading[idx] || doc.verifiedByAdmin} />
              </label>
            )}
          </div>
        </div>
      ))}

      {resignation.status === "Exit Formalities" && (
        <button onClick={handleAddMore} className="w-full mt-2 py-2 border-2 border-dashed border-blue-200 bg-blue-50 flex items-center justify-center text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition">
          + Add New Document
        </button>
      )}
    </div>
  );
};

// ─── Main Employee Resignation Page ──────────────────────────────────────────
const EmployeeResignation = () => {
  const { user } = useContext(AuthContext);
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [viewLetter, setViewLetter] = useState(null);
  const [viewAccLetter, setViewAccLetter] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const employeeId = user?.employeeId || user?.empId || "";

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    try {
      const { data } = await api.get(`/api/employees/${employeeId}`);
      setEmployee(data);
    } catch (e) {
      // Fallback to user context data
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

  const hasActiveResignation = resignations.some(r => ["Pending", "Approved", "Exit Formalities"].includes(r.status));
  const latest = resignations[0];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
            <p className="text-blue-200 text-sm">Our AI will generate a professional resignation letter based on your profile and reason, instantly.</p>
            {hasActiveResignation && (
              <p className="text-yellow-300 text-xs mt-2">⚠️ You already have an active resignation in progress.</p>
            )}
          </div>
          <button
            onClick={() => !hasActiveResignation && setShowSubmitModal(true)}
            disabled={hasActiveResignation}
            className={`flex-shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition shadow-md flex items-center gap-2
              ${hasActiveResignation ? "bg-white/20 cursor-not-allowed opacity-60" : "bg-white text-blue-700 hover:bg-blue-50"}`}
          >
            🤖 Generate Resignation Letter
          </button>
        </div>
      </div>

      {/* My Resignation History */}
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
                    <p className="font-bold text-slate-800 text-sm">{r.designation} · {r.department}</p>
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
                  {/* Notice Period Countdown */}
                  {r.status === "Approved" && r.noticePeriodEndDate && (
                    <CountdownTimer endDate={r.noticePeriodEndDate} />
                  )}

                  {/* Completion message */}
                  {r.status === "Completed" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold">
                      🎉 Your exit formalities are complete. Thank you for your service!
                    </div>
                  )}

                  {/* Rejection remark */}
                  {r.status === "Rejected" && r.adminRemark && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                      <span className="font-semibold text-red-700">Rejection Reason: </span>
                      <span className="text-red-600">{r.adminRemark}</span>
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
                  </div>

                  {/* Exit Formalities (employee upload section) */}
                  {(r.status === "Exit Formalities" || r.status === "Completed") && (
                    <ExitFormalitiesEmployee resignation={r} onUpdate={handleUpdate} />
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
