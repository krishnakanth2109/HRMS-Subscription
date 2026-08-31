import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import {
  FaUserFriends,
  FaFileSignature,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaDownload,
  FaEye,
  FaTrash,
  FaSearch,
  FaFilter,
  FaBuilding,
  FaSyncAlt,
  FaPaperclip,
  FaBoxes,
  FaGift,
  FaTimes,
  FaShieldAlt,
  FaChevronDown,
  FaChevronUp,
  FaCalendarAlt,
  FaBalanceScale
} from "react-icons/fa";

// ─── Status Badge Colors ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200/80",
    dot: "bg-amber-500",
    glow: "shadow-[0_0_12px_-2px_rgba(245,158,11,0.25)]"
  },
  Approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
    glow: "shadow-[0_0_12px_-2px_rgba(16,185,129,0.25)]"
  },
  Rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    dot: "bg-rose-500",
    glow: ""
  },
  "Exit Formalities": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200/80",
    dot: "bg-purple-500",
    glow: "shadow-[0_0_12px_-2px_rgba(168,85,247,0.25)]"
  },
  Completed: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200/80",
    dot: "bg-blue-500",
    glow: "shadow-[0_0_12px_-2px_rgba(59,130,246,0.25)]"
  },
};

// ─── IST Countdown Timer ──────────────────────────────────────────────────────
const CountdownTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate) - new Date();
      if (diff <= 0) { setExpired(true); setTimeLeft("Expired"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endDate]);

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-extrabold px-3 py-1 rounded-xl border shadow-sm ${
      expired ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
    }`}>
      <span>{expired ? "⏰" : "⏱"}</span>
      <span>{expired ? "Expired" : timeLeft}</span>
    </span>
  );
};

// ─── View Letter Modal ─────────────────────────────────────────────────────────
const LetterModal = ({ title, html, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <FaFileSignature className="text-indigo-600" />
          {title}
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-all">
          <FaTimes />
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

// ─── Decision Modal ────────────────────────────────────────────────────────────
const DecisionModal = ({ resignation, onClose, onSubmit }) => {
  const [action, setAction] = useState("Approved");
  const [remark, setRemark] = useState("");
  const [noticeType, setNoticeType] = useState("Serve Required Notice");
  const [noticeDays, setNoticeDays] = useState(30);
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [acceptanceFile, setAcceptanceFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit({
      action,
      adminRemark: remark,
      noticePeriodType: noticeType === "Immediate Release" ? "Immediate" : noticeType === "Custom Notice Period" ? "Custom" : "Serve Required Notice",
      noticePeriodDays: noticeDays,
      releaseDate: noticeType === "Immediate Release" ? releaseDate : null,
      acceptanceFile,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FaBalanceScale className="text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Review Resignation Decision</h3>
              <p className="text-xs text-slate-500 font-semibold">{resignation.employeeName} ({resignation.employeeId})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/60 transition-all">
            <FaTimes />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</p>
              <p className="text-slate-800 font-bold text-sm mt-0.5">{resignation.reason || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submission Date</p>
              <p className="text-slate-800 font-bold text-sm mt-0.5">
                {resignation.resignationDate ? new Date(resignation.resignationDate).toLocaleDateString("en-IN") : new Date(resignation.submittedAt).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          {/* Decision */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Decision Action</label>
            <div className="flex gap-3 max-w-xs">
              {["Approved", "Rejected"].map(a => (
                <button 
                  key={a} 
                  onClick={() => setAction(a)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border shadow-sm ${
                    action === a
                      ? (a === "Approved" ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20" : "bg-rose-600 text-white border-rose-600 shadow-rose-500/20")
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {a === "Approved" ? "Approve Resignation" : "Reject"}
                </button>
              ))}
            </div>
          </div>

          {/* Notice period */}
          {action === "Approved" && (
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Notice Period Determination</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["Serve Required Notice", "Immediate Release", "Custom Notice Period"].map(t => (
                  <button 
                    key={t} 
                    onClick={() => setNoticeType(t)}
                    className={`py-3 px-3 rounded-2xl border font-bold text-xs transition-all text-center shadow-sm ${
                      noticeType === t 
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              
              {noticeType === "Custom Notice Period" && (
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <input 
                    type="number" 
                    min={1} 
                    max={365} 
                    value={noticeDays}
                    onChange={e => setNoticeDays(e.target.value)}
                    className="border border-slate-300 rounded-xl px-4 py-2 w-28 text-center font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white" 
                  />
                  <span className="text-slate-700 text-xs font-bold">Days Notice Period</span>
                </div>
              )}

              {noticeType === "Serve Required Notice" && (
                <div className="text-xs font-bold text-indigo-700 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80">
                  Employee will serve standard company notice duration (30 Days).
                </div>
              )}

              {noticeType === "Immediate Release" && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Release Date</label>
                  <input 
                    type="date" 
                    value={releaseDate} 
                    onChange={e => setReleaseDate(e.target.value)}
                    className="border border-slate-300 rounded-xl px-4 py-2 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white" 
                  />
                </div>
              )}

              {/* Upload acceptance letter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Upload Signed Acceptance Letter <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-2xl p-4 hover:bg-indigo-50/80 transition-all">
                  <FaPaperclip className="text-indigo-600 text-xl" />
                  <div className="flex-1">
                    {acceptanceFile ? (
                      <p className="text-xs font-bold text-indigo-700">{acceptanceFile.name}</p>
                    ) : (
                      <p className="text-xs font-bold text-indigo-600">Choose PDF or Image file to attach</p>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/*,.pdf"
                    onChange={e => setAcceptanceFile(e.target.files[0] || null)} />
                </label>
              </div>
            </div>
          )}

          {/* Remark */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Admin Remarks</label>
            <textarea 
              rows={3} 
              value={remark} 
              onChange={e => setRemark(e.target.value)}
              placeholder="Internal notes or communication to the employee..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className={`px-6 py-2.5 rounded-2xl font-black text-xs text-white transition-all shadow-md ${
              action === "Approved" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
            } disabled:opacity-60`}
          >
            {loading ? "Processing..." : (action === "Approved" ? "Confirm Approval" : "Confirm Rejection")}
          </button>
        </div>
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

// ─── Exit Formalities Panel (Admin) ───────────────────────────────────────────
const ExitFormalities = ({ resignation, onUpdate }) => {
  const [uploading, setUploading] = useState({});
  const [newDocName, setNewDocName] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [finalDocName, setFinalDocName] = useState("");
  const [uploadingFinal, setUploadingFinal] = useState(false);

  const handleAdminUpload = async (idx, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [idx]: true }));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/api/resignations/admin/upload-doc/${resignation._id}/${idx}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      onUpdate(data.resignation);
    } catch (e) { alert("Upload failed: " + (e.response?.data?.error || e.message)); }
    setUploading(prev => ({ ...prev, [idx]: false }));
  };

  const handleVerify = async (idx) => {
    try {
      const { data } = await api.post(`/api/resignations/admin/verify-doc/${resignation._id}/${idx}`);
      onUpdate(data.resignation);
    } catch { alert("Verify failed"); }
  };

  const handleAddDoc = async () => {
    if (!newDocName.trim()) return alert("Please enter a document name.");
    setAddingDoc(true);
    try {
      const { data } = await api.post(`/api/resignations/admin/add-exit-doc/${resignation._id}`, { docName: newDocName.trim() });
      onUpdate(data.resignation);
      setNewDocName("");
    } catch (e) { alert("Failed: " + (e.response?.data?.message || e.message)); }
    setAddingDoc(false);
  };

  const handleUploadFinalDoc = async (file) => {
    if (!file) return;
    if (!finalDocName.trim()) return alert("Please enter a document name first.");
    setUploadingFinal(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("docName", finalDocName.trim());
    try {
      const { data } = await api.post(`/api/resignations/admin/upload-final-doc/${resignation._id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      onUpdate(data.resignation);
      setFinalDocName("");
    } catch (e) { alert("Upload failed: " + (e.response?.data?.error || e.message)); }
    setUploadingFinal(false);
  };

  const handleDeleteFinalDoc = async (idx) => {
    if (!window.confirm("Remove this document?")) return;
    try {
      const { data } = await api.delete(`/api/resignations/admin/delete-final-doc/${resignation._id}/${idx}`);
      onUpdate(data.resignation);
    } catch { alert("Delete failed"); }
  };

  const handleComplete = async () => {
    if (!window.confirm("Mark this resignation as Completed and notify the employee?")) return;
    try {
      const { data } = await api.post(`/api/resignations/admin/complete/${resignation._id}`);
      onUpdate(data.resignation);
    } catch { alert("Failed"); }
  };

  return (
    <div className="mt-4 space-y-6 pt-4 border-t border-slate-100">
      {/* Employee Exit Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <FaBoxes className="text-indigo-600" /> Employee Exit Submissions
          </h4>
        </div>

        {resignation.exitDocuments.map((doc, idx) => (
          <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
            doc.verifiedByAdmin ? "bg-emerald-50/60 border-emerald-200/80" : "bg-slate-50 border-slate-200/80"
          }`}>
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${
                doc.verifiedByAdmin ? "bg-emerald-500" : doc.uploadedByEmployee ? "bg-amber-400" : "bg-slate-300"
              }`} />
              <div>
                <p className="font-extrabold text-xs text-slate-800">{doc.docName}</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {doc.verifiedByAdmin ? "Verified" : doc.uploadedByEmployee ? "Uploaded by employee — pending verification" : "Awaiting employee upload"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm ${
                uploading[idx] ? "bg-slate-400" : "bg-slate-800 hover:bg-slate-900"
              }`}>
                {uploading[idx] ? "Uploading..." : "📎 Admin Upload"}
                <input type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleAdminUpload(idx, e.target.files[0])} disabled={uploading[idx]} />
              </label>
              {doc.uploadedByEmployee && (
                <button onClick={() => downloadFile(doc.uploadedByEmployee, `${doc.docName}_employee`)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 flex items-center gap-1">
                  <FaDownload /> Employee File
                </button>
              )}
              {!doc.verifiedByAdmin && doc.uploadedByEmployee && (
                <button onClick={() => handleVerify(idx)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1">
                  <FaCheckCircle /> Verify
                </button>
              )}
            </div>
          </div>
        ))}

        {resignation.status === "Exit Formalities" && (
          <div className="flex gap-2 pt-2">
            <input 
              value={newDocName} 
              onChange={e => setNewDocName(e.target.value)}
              placeholder="Add required document (e.g. Access Card Return)"
              className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
            />
            <button 
              onClick={handleAddDoc} 
              disabled={addingDoc}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-sm"
            >
              {addingDoc ? "Adding..." : "+ Add Requirement"}
            </button>
          </div>
        )}
      </div>

      {/* Welcome Kit Return */}
      {resignation.welcomeKitItems && resignation.welcomeKitItems.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 space-y-3">
          <h4 className="font-black text-amber-900 text-xs uppercase tracking-wider flex items-center gap-2">
            <FaGift className="text-amber-600" /> Welcome Kit Checklist Status
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {resignation.welcomeKitItems.map((item, i) => (
              <div key={i} className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                item.returned ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-amber-200 text-amber-800"
              }`}>
                <span>{item.returned ? "✅" : "⏳"}</span>
                <span>{item.itemName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Documents */}
      <div className="space-y-3">
        <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">
          Final Release Documents (Relieving, Experience Letter)
        </h4>

        {resignation.adminFinalDocs && resignation.adminFinalDocs.length > 0 ? (
          <div className="space-y-2">
            {resignation.adminFinalDocs.map((doc, i) => (
              <div key={i} className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5">
                <p className="font-bold text-xs text-indigo-950">📄 {doc.docName}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => downloadFile(doc.uploadedByAdmin, doc.docName)}
                    className="px-3 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-50">
                    View
                  </button>
                  <button onClick={() => handleDeleteFinalDoc(i)}
                    className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No release letters uploaded yet.</p>
        )}

        <div className="flex gap-2">
          <input 
            value={finalDocName} 
            onChange={e => setFinalDocName(e.target.value)}
            placeholder="Document title (e.g. Official Relieving Letter)"
            className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
          />
          <label className={`cursor-pointer px-5 py-2 rounded-2xl text-xs font-black text-white shadow-sm flex items-center gap-1.5 ${
            uploadingFinal ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
          }`}>
            {uploadingFinal ? "Uploading..." : "📎 Upload Release File"}
            <input type="file" className="hidden" accept="image/*,.pdf"
              onChange={e => handleUploadFinalDoc(e.target.files[0])} disabled={uploadingFinal} />
          </label>
        </div>
      </div>

      {resignation.status === "Exit Formalities" && (
        <button onClick={handleComplete}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 transition-all">
          Mark Exit Formalities Complete & Grant Documents
        </button>
      )}
    </div>
  );
};

// ─── Main Admin Resignation Page ───────────────────────────────────────────────
const AdminResignation = () => {
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [viewLetter, setViewLetter] = useState(null);
  const [viewAccLetter, setViewAccLetter] = useState(null);
  const [decisionModal, setDecisionModal] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const intervalRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await api.get("/api/resignations/admin/all");
      setResignations(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(() => {
      api.post("/api/resignations/system/check-countdowns").then(fetchAll).catch(() => {});
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  const handleDecision = async ({ action, adminRemark, noticePeriodType, noticePeriodDays, acceptanceFile }) => {
    try {
      const fd = new FormData();
      fd.append("action", action);
      fd.append("adminRemark", adminRemark || "");
      fd.append("noticePeriodType", noticePeriodType || "Immediate");
      fd.append("noticePeriodDays", noticePeriodDays || 0);
      if (acceptanceFile) fd.append("acceptanceFile", acceptanceFile);

      await api.post(`/api/resignations/admin/decision/${decisionModal._id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setDecisionModal(null);
      fetchAll();
    } catch (e) { alert("Error: " + (e.response?.data?.message || e.message)); }
  };

  const handleUpdate = (updated) => {
    setResignations(prev => prev.map(r => r._id === updated._id ? updated : r));
  };

  const handleDeleteResignation = async (id) => {
    if (!window.confirm("Permanently delete this resignation entry?")) return;
    try {
      await api.delete(`/api/resignations/admin/${id}`);
      setResignations(prev => prev.filter(r => r._id !== id));
      if (expanded === id) setExpanded(null);
    } catch (e) {
      alert("Error: " + (e.response?.data?.message || e.message));
    }
  };

  const isNoticePeriodCompleted = (r) => r.noticePeriodEndDate && new Date() >= new Date(r.noticePeriodEndDate);
  const showExitFormalities = (r) =>
    r.status === "Exit Formalities" ||
    r.status === "Completed" ||
    (r.status === "Approved" && isNoticePeriodCompleted(r));

  const companies = ["All", ...new Set(resignations.map(r => r.companyName || "Unknown").filter(Boolean))];

  const filtered = resignations.filter(r => {
    const matchSearch = r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    const matchCompany = companyFilter === "All" || (r.companyName || "Unknown") === companyFilter;
    return matchSearch && matchStatus && matchCompany;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent tracking-tight">
            Resignation Management Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
            Review submissions, configure notice durations, and manage employee exit handovers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"].map(s => {
          const count = resignations.filter(r => r.status === s).length;
          const conf = STATUS_CONFIG[s];
          return (
            <div 
              key={s} 
              onClick={() => setStatusFilter(s === statusFilter ? "All" : s)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all duration-200 shadow-sm ${
                statusFilter === s 
                  ? "bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-md -translate-y-0.5" 
                  : "bg-white/90 border-slate-200/80 hover:border-indigo-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{s}</span>
                <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{count}</h3>
            </div>
          );
        })}
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by employee name or ID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
          />
        </div>
        <select 
          value={companyFilter} 
          onChange={e => setCompanyFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
        >
          {companies.map(c => <option key={c} value={c}>{c === "All" ? "All Companies" : c}</option>)}
        </select>
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
        >
          <option value="All">All Statuses</option>
          {["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button 
          onClick={fetchAll} 
          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 transition-colors border border-indigo-200/60"
        >
          <FaSyncAlt className="text-xs" /> Refresh
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FaFileSignature className="text-2xl" />
            </div>
            <p className="text-base font-bold text-slate-700">No Resignation Entries Found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search query or status filter.</p>
          </div>
        ) : (
          filtered.map(r => (
            <div key={r._id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-indigo-200">
              <div 
                className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                onClick={() => setExpanded(expanded === r._id ? null : r._id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-500/20">
                    {r.employeeName?.[0]?.toUpperCase() || "E"}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {r.employeeName} <span className="text-slate-400 font-mono font-normal text-xs">({r.employeeId})</span>
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      {r.designation} · {r.department} {r.companyName && r.companyName !== "Unknown" ? `· ${r.companyName}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${STATUS_CONFIG[r.status]?.bg || "bg-slate-100"} ${STATUS_CONFIG[r.status]?.text || "text-slate-600"} ${STATUS_CONFIG[r.status]?.border || "border-slate-200"}`}>
                    {r.status}
                  </span>
                  {r.status === "Approved" && r.noticePeriodEndDate && (
                    <CountdownTimer endDate={r.noticePeriodEndDate} />
                  )}
                  <span className="text-xs font-semibold text-slate-400">
                    {new Date(r.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                  </span>
                  <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                    {expanded === r._id ? <FaChevronUp /> : <FaChevronDown />}
                  </button>
                </div>
              </div>

              {expanded === r._id && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-xs">
                      <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Reason for Leaving</p>
                      <p className="font-bold text-slate-800 text-sm">{r.reason || "—"}</p>
                    </div>
                    {r.noticePeriodDays > 0 && (
                      <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80 text-xs">
                        <p className="font-bold text-indigo-600 uppercase tracking-wider mb-1">Notice Period Schedule</p>
                        <p className="font-extrabold text-indigo-950 text-sm">
                          {r.noticePeriodDays} days — concludes {new Date(r.noticePeriodEndDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {r.resignationLetterHtml && (
                      <button onClick={() => setViewLetter(r)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <FaEye /> Resignation Letter
                      </button>
                    )}
                    {r.acceptanceLetterHtml && (
                      <button onClick={() => setViewAccLetter(r)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <FaFileSignature /> Acceptance Letter
                      </button>
                    )}
                    {r.status === "Pending" && (
                      <button onClick={() => setDecisionModal(r)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 flex items-center gap-1.5">
                        <FaCheckCircle /> Review & Approve
                      </button>
                    )}
                    <button onClick={() => handleDeleteResignation(r._id)}
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 ml-auto flex items-center gap-1.5">
                      <FaTrash /> Delete Entry
                    </button>
                  </div>

                  {showExitFormalities(r) && (
                    <ExitFormalities resignation={r} onUpdate={handleUpdate} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {viewLetter && (
        <LetterModal title={`Resignation Letter — ${viewLetter.employeeName}`}
          html={viewLetter.resignationLetterHtml} onClose={() => setViewLetter(null)} />
      )}
      {viewAccLetter && (
        <LetterModal title={`Acceptance Letter — ${viewAccLetter.employeeName}`}
          html={viewAccLetter.acceptanceLetterHtml} onClose={() => setViewAccLetter(null)} />
      )}
      {decisionModal && (
        <DecisionModal resignation={decisionModal} onClose={() => setDecisionModal(null)} onSubmit={handleDecision} />
      )}
    </div>
  );
};

export default AdminResignation;