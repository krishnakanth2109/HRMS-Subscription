import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  Plus, Bug, Loader2, X, Upload, Trash2,
  AlertCircle, CheckCircle2, Clock, ThumbsUp,
  XCircle, ChevronDown
} from "lucide-react";

const BASE = `${import.meta.env.VITE_API_URL_DEVELOPMENT}/api/issues`;
const PROFILE_URL = `${import.meta.env.VITE_API_URL_DEVELOPMENT}/api/admin/profile`;

// Strictly using sessionStorage
const getAuthToken = () => {
  let token = sessionStorage.getItem("token") || sessionStorage.getItem("masterToken");
  return token ? token.replace(/(^"|"$)/g, "") : "";
};
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

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

  const handleApproveClick = () => {
    Swal.fire({
      title: "Approve Issue?",
      text: "This will forward the issue to the IT Support Team.",
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: "#2563eb", 
      cancelButtonColor: "#94a3b8", 
      confirmButtonText: "Yes, Approve",
      showLoaderOnConfirm: true,
      preConfirm: () => onApprove(issue._id),
      allowOutsideClick: () => !Swal.isLoading()
    });
  };

  const handleRejectClick = () => {
    Swal.fire({
      title: "Reject Request",
      input: "textarea",
      inputPlaceholder: "Please provide a reason for rejection...",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e", 
      cancelButtonColor: "#94a3b8", 
      confirmButtonText: "Confirm Reject",
      showLoaderOnConfirm: true,
      preConfirm: (msg) => {
        if (!msg.trim()) {
          Swal.showValidationMessage("A reason is required to reject.");
          return false;
        }
        return onReject(issue._id, msg);
      },
      allowOutsideClick: () => !Swal.isLoading()
    });
  };

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl transform scale-100 transition-transform duration-300" />
          <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"><X size={24} /></button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="p-5 sm:p-6 cursor-pointer" onClick={() => setOpen((p) => !p)}>
          <div className="flex items-start gap-4">
      

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm ${cfg.cls}`}>
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

            <button className={`p-2 rounded-full transition-all duration-300 ${open ? 'bg-orange-50 text-orange-500 rotate-180' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
              <ChevronDown size={18} />
            </button>
          </div>

          {issue.images?.length > 0 && (
            <div className="flex gap-3 mt-4 flex-wrap pl-14" onClick={(e) => e.stopPropagation()}>
              {issue.images.map((img, i) => (
                <button key={i} onClick={() => setLightbox(img.url)} className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-slate-200 hover:ring-orange-400 hover:scale-110 transition-all duration-300 shadow-sm">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`grid transition-all duration-400 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
         <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-50/50">
              
              <div className="bg-slate-50 rounded-2xl p-4 shadow-inner mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{issue.message}</p>
              </div>

              {issue.resolvedMessage && (
                <div className={`p-4 rounded-2xl text-sm mb-4 relative overflow-hidden ${issue.status === "resolved" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                  <div className={`absolute top-0 left-0 w-1 h-full ${issue.status === "resolved" ? "bg-emerald-400" : "bg-rose-400"}`}></div>
                  <p className="font-bold text-[11px] uppercase tracking-wider mb-1 opacity-80">
                    {issue.status === "resolved" ? "Resolution Details" : "Rejection Reason"}
                  </p>
                  {issue.resolvedMessage}
                </div>
              )}

              {issue.status === "pending" && issue.role === "employee" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleRejectClick}
                    className="flex-1 py-3 rounded-2xl bg-white border-2 border-rose-100 text-rose-500 text-sm font-bold hover:bg-rose-50 hover:border-rose-200 active:scale-[0.98] transition-all"
                  >
                    ✕ Reject
                  </button>
                  <button
                    onClick={handleApproveClick}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    ✓ Approve & Forword to IT Team
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ✅ Notice the new `adminInfo` prop passed here!
function ReportModal({ onClose, onSuccess, adminInfo }) {
  const [form, setForm]         = useState({ subject: "", message: "" });
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading]   = useState(false);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 5) { 
      Swal.fire("Limit Reached", "You can only upload a maximum of 5 images.", "warning");
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
      Swal.fire("Missing Fields", "Subject and message are strictly required.", "warning");
      return; 
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("subject", form.subject.trim());
      fd.append("message", form.message.trim());
      
      // ✅ Explicitly appending the fetched Admin Name & Email to the form data!
      fd.append("raisedByName", adminInfo.name);
      fd.append("raisedByEmail", adminInfo.email);

      files.forEach((f) => fd.append("images", f));
      
      const res = await fetch(BASE, { method: "POST", headers: authHeaders(), body: fd });
      const data = await res.json();
      
      if (!data.success) throw new Error(data.message);
      
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      onSuccess(data.issue); 
      onClose();
    } catch (err) {
      Swal.fire("Submission Failed", err.message || "Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-500">
              <Bug size={24} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Raise Issue</h2>
              <p className="text-xs font-medium text-slate-400">
                {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">Subject <span className="text-rose-500">*</span></label>
            <input type="text" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Brief title of the issue..." maxLength={150} className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 outline-none text-sm font-medium transition-all shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">Message <span className="text-rose-500">*</span></label>
            <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Describe the issue in detail..." rows={4} className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 outline-none text-sm font-medium transition-all shadow-sm resize-none" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 ml-1">Screenshots <span className="text-slate-400 font-medium text-xs ml-1">(Optional, max 5)</span></label>
            
            {previews.length > 0 && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                {previews.map((p, i) => (
                  <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)} className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
            
            {files.length < 5 && (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all group bg-slate-50/50">
                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                  <Upload size={20} className="text-orange-400" />
                </div>
                <span className="text-sm font-semibold text-slate-500 group-hover:text-orange-500 transition-colors">Click to upload screenshots</span>
                <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" />
              </label>
            )}
          </div>
          
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-3.5 rounded-2xl bg-white border-2 border-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:border-slate-200 active:scale-95 transition-all disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Escalatng...</> : "Submit Issue"}
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
  
  // ✅ State to store the Admin's details to send during issue submission
  const [adminInfo, setAdminInfo] = useState({ name: "", email: "" });

  useEffect(() => {
    // 1. Fetch the list of issues
    fetch(BASE, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.success) setIssues(d.issues); })
      .finally(() => setLoading(false));

    // 2. ✅ Fetch Admin Profile dynamically using logic similar to AdminProfile.js
    fetch(PROFILE_URL, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        // Depending on backend structure, data could be nested (data.profile.name) or direct (data.name)
        const profile = data.profile || data; 
        setAdminInfo({
          name: profile.name || "",
          email: profile.email || ""
        });
      })
      .catch((err) => console.error("Failed to fetch admin profile", err));
  }, []);

  const handleApprove = (id) => {
    return fetch(`${BASE}/${id}/approve`, { method: "PATCH", headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setIssues((p) => p.map((i) => (i._id === id ? data.issue : i)));
          Swal.fire("Approved!", "Issue has been forwarded to IT Support.", "success");
        } else {
          Swal.fire("Error!", data.message, "error");
        }
      })
      .catch(() => Swal.fire("Error!", "Something went wrong during approval.", "error"));
  };

  const handleReject = (id, msg) => {
    return fetch(`${BASE}/${id}/reject`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ resolvedMessage: msg }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setIssues((p) => p.map((i) => (i._id === id ? data.issue : i)));
          Swal.fire("Rejected!", "The issue has been rejected successfully.", "success");
        } else {
          Swal.fire("Error!", data.message, "error");
        }
      })
      .catch(() => Swal.fire("Error!", "Something went wrong during rejection.", "error"));
  };

  const filtered     = tab === "all" ? issues : issues.filter((i) => i.status === tab);
  const pendingCount = issues.filter((i) => i.status === "pending").length;

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans selection:bg-orange-100 selection:text-orange-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
        
                Manage Technical Issues
              {pendingCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm animate-pulse">{pendingCount}</span>
              )}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-2 ml-1">Review, approve, and escalate tickets to the IT team</p>
          </div>
          
          <button onClick={() => setShowModal(true)} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95 transition-all">
            <Plus size={18} strokeWidth={3} /> Raise New Issue
          </button>
        </div>

        {/* Fluid Tabs */}
        <div className="flex gap-2 p-1.5 bg-white/60 backdrop-blur-md rounded-2xl mb-8 overflow-x-auto shadow-sm ring-1 ring-slate-200/50 hide-scrollbar">
          {TABS.map((t) => {
            const c = t === "all" ? issues.length : issues.filter((i) => i.status === t).length;
            const isActive = tab === t;
            return (
              <button 
                key={t} 
                onClick={() => setTab(t)} 
                className={`flex-1 min-w-fit px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2
                  ${isActive ? "bg-white text-orange-600 shadow-md ring-1 ring-slate-100 scale-[1.02]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"}`}
              >
                {t} {c > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>{c}</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="p-4 bg-white rounded-full shadow-lg shadow-orange-500/10 animate-spin">
              <Loader2 size={32} className="text-orange-500" />
            </div>
            <p className="text-sm font-bold text-slate-400 animate-pulse">Fetching records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bug size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No {tab !== "all" ? tab : ""} issues found</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">You're all caught up for now!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((issue) => (
              <IssueCard key={issue._id} issue={issue} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}

        {showModal && (
          <ReportModal 
            onClose={() => setShowModal(false)} 
            adminInfo={adminInfo} /* ✅ Passed down to the form */
            onSuccess={(newIssue) => {
               setIssues((prev) => [newIssue, ...prev]);
               Swal.fire({
                 icon: "success",
                 title: "Escalated Successfully!",
                 text: "Your issue has been auto-approved and forwarded to SuperAdmin.",
                 confirmButtonColor: "#f97316"
               });
            }} 
          />
        )}
      </div>
    </div>
  );
}