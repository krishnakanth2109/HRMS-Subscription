import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  Plus, Bug, Loader2, X, Upload, Trash2,
  CheckCircle2, Clock, ThumbsUp,
  XCircle, ChevronDown
} from "lucide-react";

// Use your centralized API utility
import { 
  getTechnicalIssues, 
  createTechnicalIssue, 
  approveTechnicalIssue, 
  rejectTechnicalIssue 
} from "../api"; 

const STATUS_MAP = {
  pending:  { cls: "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 shadow-amber-500/10", Icon: Clock,        label: "Pending"  },
  approved: { cls: "bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 shadow-blue-500/10",       Icon: ThumbsUp,     label: "Approved" },
  resolved: { cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 shadow-emerald-500/10",    Icon: CheckCircle2, label: "Resolved" },
  rejected: { cls: "bg-rose-50 text-rose-600 ring-1 ring-rose-500/20 shadow-rose-500/10",          Icon: XCircle,      label: "Rejected" },
};

const TABS = ["all", "pending", "approved", "rejected", "resolved"];

function IssueCard({ issue, onApprove, onReject }) {
  const [open, setOpen]         = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const cfg = STATUS_MAP[issue.status] || STATUS_MAP.pending;
  const { Icon } = cfg;

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" />
          <button className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full"><X size={24} /></button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div className="p-5 sm:p-6 cursor-pointer" onClick={() => setOpen((p) => !p)}>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                  <Icon size={12} strokeWidth={2.5} /> {cfg.label}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(issue.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-orange-500 transition-colors">{issue.subject}</h3>
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                <span className="font-semibold text-slate-700">{issue.raisedByName || "Admin"}</span>
                <span className="mx-1.5 opacity-40">•</span>{issue.raisedByEmail || "No Email"}
              </p>
            </div>
            <button className={`p-2 rounded-full transition-all ${open ? 'bg-orange-50 text-orange-500 rotate-180' : 'bg-slate-50 text-slate-400'}`}>
              <ChevronDown size={18} />
            </button>
          </div>
          {issue.images?.length > 0 && (
            <div className="flex gap-3 mt-4 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {issue.images.map((img, i) => (
                <button key={i} onClick={() => setLightbox(img.url)} className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-slate-200 hover:scale-110 transition-all shadow-sm">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-50/50">
              <div className="bg-slate-50 rounded-2xl p-4 shadow-inner mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{issue.message}</p>
              </div>

              {issue.resolvedMessage && (
                <div className={`p-4 rounded-2xl text-sm mb-4 relative overflow-hidden ${issue.status === "resolved" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                  <p className="font-bold text-[11px] uppercase tracking-wider mb-1 opacity-80">
                    {issue.status === "resolved" ? "Resolution Details" : "Rejection Reason"}
                  </p>
                  {issue.resolvedMessage}
                </div>
              )}

              {issue.status === "pending" && issue.role === "employee" && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => onReject(issue._id)} className="flex-1 py-3 rounded-2xl bg-white border-2 border-rose-100 text-rose-500 text-sm font-bold hover:bg-rose-50 transition-all">✕ Reject</button>
                  <button onClick={() => onApprove(issue._id)} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2">✓ Approve & Forward</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ReportModal({ onClose, onSuccess, adminInfo }) {
  const [form, setForm]         = useState({ subject: "", message: "" });
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading]   = useState(false);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 5) { 
      Swal.fire("Limit Reached", "Max 5 images allowed.", "warning");
      return; 
    }
    const newPrev = selected.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setFiles((p) => [...p, ...selected]);
    setPreviews((p) => [...p, ...newPrev]);
  };

  const removeFile = (i) => {
    URL.revokeObjectURL(previews[i].url);
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) { 
      Swal.fire("Missing Fields", "Subject and message are required.", "warning");
      return; 
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("subject", form.subject.trim());
      fd.append("message", form.message.trim());
      fd.append("raisedByName", adminInfo.name || "Admin");
      fd.append("raisedByEmail", adminInfo.email || "");
      files.forEach((f) => fd.append("images", f));
      
      const data = await createTechnicalIssue(fd);
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      onSuccess(data.issue); 
      onClose();
    } catch (err) {
      // FIX: Ensure err is a string for Swal
      const errorMsg = err?.response?.data?.message || err.message || "Something went wrong";
      Swal.fire("Submission Failed", String(errorMsg), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-500"><Bug size={24} /></div>
            <h2 className="text-lg font-extrabold text-slate-900">Raise Technical Issue</h2>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700">Subject <span className="text-rose-500">*</span></label>
            <input type="text" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Title..." className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-orange-400 outline-none transition-all" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700">Message <span className="text-rose-500">*</span></label>
            <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Describe the issue..." rows={4} className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-orange-400 outline-none transition-all resize-none" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Screenshots (Max 5)</label>
            <div className="grid grid-cols-5 gap-3 mb-4">
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm group">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)} className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </div>
                ))}
            </div>
            {files.length < 5 && (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-orange-400 bg-slate-50/50 transition-all">
                <Upload size={20} className="text-orange-400" />
                <span className="text-sm font-semibold text-slate-500">Add Image</span>
                <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" />
              </label>
            )}
          </div>
          
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-white border-2 border-slate-100 text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Submit Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminIssues() {
  const [issues, setIssues]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [adminInfo, setAdminInfo] = useState({ name: "", email: "" });

// inside AdminIssues component
useEffect(() => {
  loadData();
  
  // ─── IMPROVED USER EXTRACTION ───
  const rawUser = sessionStorage.getItem("hrmsUser") || localStorage.getItem("hrmsUser");
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      // Check all common nesting patterns in your app
      const userObj = parsed.user || parsed.data || parsed; 
      
      setAdminInfo({
        name: userObj.name || "",
        email: userObj.email || "" // This ensures we grab it if it exists
      });
    } catch (e) {
      console.error("Error parsing user for email", e);
    }
  }
}, []);

// inside ReportModal's handleSubmit
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!form.subject.trim() || !form.message.trim()) {
    Swal.fire("Error", "Subject and Message are required", "warning");
    return;
  }

  setLoading(true);
  try {
    const fd = new FormData();
    fd.append("subject", form.subject.trim());
    fd.append("message", form.message.trim());
    
    // Ensure we aren't sending the string "undefined"
    fd.append("raisedByName", adminInfo.name || "");
    fd.append("raisedByEmail", adminInfo.email || "");

    files.forEach((f) => fd.append("images", f));

    const data = await createTechnicalIssue(fd); // Using your api.js function
    onSuccess(data.issue);
    onClose();
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || "Failed to post";
    Swal.fire("Error", String(msg), "error");
  } finally {
    setLoading(false);
  }
};

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getTechnicalIssues();
      if (data.success) setIssues(data.issues);
    } catch (err) {
      console.error("Load data failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    Swal.fire({
      title: "Approve Issue?",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Yes, Approve",
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          const data = await approveTechnicalIssue(id);
          if (data.success) {
            setIssues((p) => p.map((i) => (i._id === id ? data.issue : i)));
            return data;
          }
        } catch (err) {
          Swal.showValidationMessage(`Error: ${err?.response?.data?.message || err.message}`);
        }
      }
    }).then((res) => { if(res.isConfirmed) Swal.fire("Success", "Approved", "success"); });
  };

  const handleReject = async (id) => {
    Swal.fire({
      title: "Reject Issue",
      input: "textarea",
      inputPlaceholder: "Reason for rejection...",
      showCancelButton: true,
      confirmButtonText: "Reject",
      showLoaderOnConfirm: true,
      preConfirm: async (msg) => {
        if (!msg) return Swal.showValidationMessage("Reason is required");
        try {
          const data = await rejectTechnicalIssue(id, msg);
          if (data.success) {
            setIssues((p) => p.map((i) => (i._id === id ? data.issue : i)));
            return data;
          }
        } catch (err) {
          Swal.showValidationMessage(`Error: ${err?.response?.data?.message || err.message}`);
        }
      }
    }).then((res) => { if(res.isConfirmed) Swal.fire("Success", "Rejected", "success"); });
  };

  const filtered = tab === "all" ? issues : issues.filter((i) => i.status === tab);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Technical Issues</h1>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all">
            <Plus size={18} /> Raise Issue
          </button>
        </div>

        <div className="flex gap-2 p-1.5 bg-white rounded-2xl mb-8 overflow-x-auto shadow-sm">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${tab === t ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:bg-slate-100"}`}>
              {t} ({t === 'all' ? issues.length : issues.filter(i => i.status === t).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={40} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
            <Bug size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">No issues found in this category.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((issue) => (
              <IssueCard key={issue._id} issue={issue} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}

        {showModal && (
          <ReportModal 
            onClose={() => setShowModal(false)} 
            adminInfo={adminInfo} 
            onSuccess={(newIssue) => {
               setIssues((prev) => [newIssue, ...prev]);
               Swal.fire("Escalated!", "Technical issue has been logged.", "success");
            }} 
          />
        )}
      </div>
    </div>
  );
}