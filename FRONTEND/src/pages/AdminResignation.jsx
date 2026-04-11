import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

// ─── Status badge colors ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Approved: "bg-blue-100 text-blue-800 border-blue-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
  "Exit Formalities": "bg-purple-100 text-purple-800 border-purple-300",
  Completed: "bg-green-100 text-green-800 border-green-300",
};

// ─── IST Countdown Timer Component ────────────────────────────────────────────
const CountdownTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const end = new Date(endDate);
      const diff = end - now;
      if (diff <= 0) { setExpired(true); setTimeLeft("Expired"); return; }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endDate]);

  return (
    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${expired ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"}`}>
      {expired ? "⏰ Expired" : `⏱ ${timeLeft}`}
    </span>
  );
};

// ─── View Letter Modal ─────────────────────────────────────────────────────────
const LetterModal = ({ title, html, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
      </div>
      <div className="overflow-y-auto p-6 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="px-6 py-3 border-t flex justify-end">
        <button onClick={onClose} className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Close</button>
      </div>
    </div>
  </div>
);

// ─── Decision Modal ─────────────────────────────────────────────────────────────
const DecisionModal = ({ resignation, onClose, onSubmit }) => {
  const [action, setAction] = useState("Approved");
  const [remark, setRemark] = useState("");
  const [noticeType, setNoticeType] = useState("Immediate");
  const [noticeDays, setNoticeDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit({ action, adminRemark: remark, noticePeriodType: noticeType, noticePeriodDays: noticeDays });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-800">Review Resignation — {resignation.employeeName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Action */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Decision</label>
            <div className="flex gap-3">
              {["Approved", "Rejected"].map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={`flex-1 py-2 rounded-lg border font-semibold transition ${action === a
                    ? (a === "Approved" ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600")
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                >{a}</button>
              ))}
            </div>
          </div>

          {/* Notice period (only on approve) */}
          {action === "Approved" && (
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Notice Period</label>
              <div className="flex gap-3 mb-2">
                {["Immediate", "Custom"].map(t => (
                  <button key={t} onClick={() => setNoticeType(t)}
                    className={`flex-1 py-2 rounded-lg border font-semibold transition text-sm ${noticeType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300"}`}
                  >{t === "Immediate" ? "⚡ Immediate Release" : "📅 Custom Days"}</button>
                ))}
              </div>
              {noticeType === "Custom" && (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={365} value={noticeDays}
                    onChange={e => setNoticeDays(e.target.value)}
                    className="border border-slate-300 rounded-lg px-4 py-2 w-32 text-center font-bold text-slate-800"
                  />
                  <span className="text-slate-500 text-sm">days notice period</span>
                </div>
              )}
            </div>
          )}

          {/* Remark */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Remark (optional)</label>
            <textarea rows={3} value={remark} onChange={e => setRemark(e.target.value)}
              placeholder="Write a note to the employee..."
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className={`px-6 py-2 rounded-lg font-semibold text-white transition ${action === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >{loading ? "Submitting…" : `${action === "Approved" ? "✅ Approve" : "❌ Reject"}`}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Exit Formalities Panel ────────────────────────────────────────────────────
const ExitFormalities = ({ resignation, onUpdate }) => {
  const [uploading, setUploading] = useState({});

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
    } catch (e) { alert("Verify failed"); }
  };

  const handleComplete = async () => {
    if (!window.confirm("Mark this resignation as fully completed?")) return;
    try {
      const { data } = await api.post(`/api/resignations/admin/complete/${resignation._id}`);
      onUpdate(data.resignation);
    } catch (e) { alert("Failed"); }
  };

  const handleAddMore = async () => {
    try {
      const { data } = await api.post(`/api/resignations/${resignation._id}/add-document`);
      onUpdate(data.resignation);
    } catch (e) {
      alert("Failed to add document: " + (e.response?.data?.message || e.message));
    }
  };

  const handleFileDownload = async (url, defaultName) => {
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
    <div className="mt-4 space-y-3">
      <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Exit Documents</h4>
      {resignation.exitDocuments.map((doc, idx) => (
        <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${doc.verifiedByAdmin ? "bg-green-500" : "bg-slate-300"}`} />
            <span className="font-medium text-slate-700 text-sm">{doc.docName}</span>
            {doc.verifiedByAdmin && <span className="text-xs text-green-600 font-semibold">✓ Verified</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Admin upload */}
            <label className="cursor-pointer px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
              {uploading[idx] ? "Uploading…" : "📎 Upload"}
              <input type="file" className="hidden" accept="image/*"
                onChange={e => handleAdminUpload(idx, e.target.files[0])} disabled={uploading[idx]} />
            </label>
            {/* Admin download employee's file */}
            {doc.uploadedByEmployee && (
              <button onClick={() => handleFileDownload(doc.uploadedByEmployee, `${doc.docName} - Employee`)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                ⬇ Employee Doc
              </button>
            )}
            {/* Admin download own uploaded file */}
            {doc.uploadedByAdmin && (
              <button onClick={() => handleFileDownload(doc.uploadedByAdmin, `${doc.docName} - Admin`)}
                className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700">
                ⬇ Admin Doc
              </button>
            )}
            {/* Verify button */}
            {!doc.verifiedByAdmin && doc.uploadedByEmployee && (
              <button onClick={() => handleVerify(idx)}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                ✔ Verify
              </button>
            )}
          </div>
        </div>
      ))}

      {resignation.status === "Exit Formalities" && (
        <button onClick={handleAddMore} className="w-full mt-2 py-2 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition">
          + Add New Document
        </button>
      )}

      {resignation.status === "Exit Formalities" && (
        <button onClick={handleComplete}
          className="mt-4 w-full py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition">
          🎯 Mark as Completed
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
    // Poll countdown check every 60s
    intervalRef.current = setInterval(() => {
      api.post("/api/resignations/system/check-countdowns").then(fetchAll).catch(() => {});
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  const handleDecision = async (payload) => {
    try {
      await api.post(`/api/resignations/admin/decision/${decisionModal._id}`, payload);
      setDecisionModal(null);
      fetchAll();
    } catch (e) { alert("Error: " + (e.response?.data?.message || e.message)); }
  };

  const handleUpdate = (updated) => {
    setResignations(prev => prev.map(r => r._id === updated._id ? updated : r));
  };

  const companies = ["All", ...new Set(resignations.map(r => r.companyName || "Unknown").filter(Boolean))];

  const filtered = resignations.filter(r => {
    const matchSearch = r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    const matchCompany = companyFilter === "All" || (r.companyName || "Unknown") === companyFilter;
    return matchSearch && matchStatus && matchCompany;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">📋 Resignation Management</h1>
        <p className="text-slate-500 mt-1">Manage employee resignations, approvals, notice periods, and exit formalities.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"].map(s => {
          const count = resignations.filter(r => r.status === s).length;
          return (
            <div key={s} onClick={() => setStatusFilter(s === statusFilter ? "All" : s)}
              className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer transition hover:shadow-md ${statusFilter === s ? "ring-2 ring-blue-500" : ""}`}>
              <div className="text-2xl font-bold text-slate-800">{count}</div>
              <div className="text-xs text-slate-500 mt-1">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name or ID..."
          className="flex-1 min-w-[200px] border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
          
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
          className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          {companies.map(c => <option key={c} value={c}>{c === "All" ? "All Companies" : c}</option>)}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="All">All Status</option>
          {["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={fetchAll} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700">↺ Refresh</button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-lg">No resignations found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => (
            <div key={r._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Row header */}
              <div className="flex flex-wrap items-center justify-between px-5 py-4 gap-3 cursor-pointer"
                onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {r.employeeName?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{r.employeeName} <span className="text-slate-400 font-normal text-sm">({r.employeeId})</span></p>
                      <p className="text-xs text-slate-500">{r.designation} · {r.department} {r.companyName && r.companyName !== "Unknown" ? `· ${r.companyName}` : ""}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-600"}`}>
                    {r.status}
                  </span>
                  {r.status === "Approved" && r.noticePeriodEndDate && (
                    <CountdownTimer endDate={r.noticePeriodEndDate} />
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(r.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                  </span>
                  <span className="text-slate-400 text-sm">{expanded === r._id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === r._id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-slate-600 mb-1">Reason for Leaving</p>
                      <p className="text-slate-700">{r.reason || "—"}</p>
                    </div>
                    {r.adminRemark && (
                      <div className="bg-slate-50 rounded-xl p-4 text-sm">
                        <p className="font-semibold text-slate-600 mb-1">Admin Remark</p>
                        <p className="text-slate-700">{r.adminRemark}</p>
                      </div>
                    )}
                    {r.noticePeriodDays > 0 && (
                      <div className="bg-blue-50 rounded-xl p-4 text-sm">
                        <p className="font-semibold text-blue-700 mb-1">Notice Period</p>
                        <p className="text-blue-800">{r.noticePeriodDays} days — ends {new Date(r.noticePeriodEndDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {/* View resignation letter */}
                    {r.resignationLetterHtml && (
                      <button onClick={() => setViewLetter(r)}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600">
                        📄 View Resignation Letter
                      </button>
                    )}
                    {/* View acceptance letter */}
                    {r.acceptanceLetterHtml && (
                      <button onClick={() => setViewAccLetter(r)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                        📃 View Acceptance Letter
                      </button>
                    )}
                    {/* Decision button */}
                    {r.status === "Pending" && (
                      <button onClick={() => setDecisionModal(r)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                        ⚖️ Review & Decide
                      </button>
                    )}
                    {/* Move to exit formalities */}
                    {r.status === "Approved" && r.noticePeriodEndDate && new Date() >= new Date(r.noticePeriodEndDate) && (
                      <button onClick={async () => {
                        await api.post(`/api/resignations/admin/exit-formalities/${r._id}`);
                        fetchAll();
                      }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
                        📦 Start Exit Formalities
                      </button>
                    )}
                  </div>

                  {/* Exit formalities panel */}
                  {(r.status === "Exit Formalities" || r.status === "Completed") && (
                    <ExitFormalities resignation={r} onUpdate={handleUpdate} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
