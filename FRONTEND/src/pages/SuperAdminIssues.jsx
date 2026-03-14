import { useState, useEffect } from "react";
import {
  Shield, Bug, Loader2, Users, CheckCircle2,
  Clock, ThumbsUp, XCircle, ChevronDown, User, X
} from "lucide-react";

// Make sure this path points correctly to your api.js
import { getTechnicalIssues, resolveTechnicalIssue } from ".././api";

const STATUS_MAP = {
  pending:  { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20", Icon: Clock,        label: "Pending"  },
  approved: { cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",       Icon: ThumbsUp,     label: "Approved" },
  resolved: { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",    Icon: CheckCircle2, label: "Resolved" },
  rejected: { cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",          Icon: XCircle,      label: "Rejected" },
};

const TABS = ["all", "approved", "resolved"];

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-6 right-6 z-[100] px-5 py-3.5 rounded-2xl text-sm font-semibold shadow-2xl flex items-center gap-3 transform transition-all duration-500 animate-in slide-in-from-top-10 fade-in text-white ${toast.type === "error" ? "bg-rose-500" : "bg-slate-900"}`}>
      {toast.type === "error" ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
      {toast.msg}
    </div>
  );
}

// ✅ Explicitly destructuring onResolve here
function IssueCard({ issue, onResolve }) {
  const [open, setOpen]               = useState(false);
  const [resolveMsg, setResolveMsg]   = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [lightbox, setLightbox]       = useState(null);
  const [busy, setBusy]               = useState(false);

  const cfg = STATUS_MAP[issue.status] || STATUS_MAP.pending;
  const { Icon } = cfg;

  // ✅ Replaced the weird `act` wrapper with a solid, direct function
  const handleConfirmResolve = async () => {
    // Safety check to absolutely prevent crashes
    if (typeof onResolve !== "function") {
      console.error("Critical React Error: onResolve is missing.");
      return;
    }

    setBusy(true);
    try {
      await onResolve(issue._id, resolveMsg);
      setShowResolve(false); // Close the inline form on success
    } catch (error) {
      console.error("Resolve failed", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl transform scale-100 transition-transform duration-300" />
          <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"><X size={24} /></button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
        <div className="p-5 sm:p-6 cursor-pointer" onClick={() => setOpen((p) => !p)}>
          <div className="flex items-start gap-4">
            
        

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm ${cfg.cls}`}>
                  <Icon size={12} strokeWidth={2.5} /> {cfg.label}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 ring-1 ring-slate-200/50">
                  {issue.role === "admin" ? <><Shield size={11} strokeWidth={2.5} /> Admin</> : <><User size={11} strokeWidth={2.5} /> Employee</>}
                </span>
                <span className="text-[11px] text-slate-400 font-medium ml-auto">
                  {new Date(issue.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-slate-600 transition-colors">{issue.subject}</h3>

              <p className="text-sm text-slate-500 mt-0.5 truncate">
                <span className="font-semibold text-slate-700">{issue.raisedByName || "Unknown"}</span>
                {issue.raisedByEmail && <><span className="mx-1.5 opacity-40">•</span>{issue.raisedByEmail}</>}
              </p>
            </div>

            <button className={`p-2 rounded-full transition-all duration-300 ${open ? 'bg-slate-100 text-slate-900 rotate-180' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
              <ChevronDown size={18} />
            </button>
          </div>

          {issue.images?.length > 0 && (
            <div className="flex gap-3 mt-4 flex-wrap pl-14" onClick={(e) => e.stopPropagation()}>
              {issue.images.map((img, i) => (
                <button key={i} onClick={() => setLightbox(img.url)} className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-slate-200 hover:ring-slate-400 hover:scale-110 transition-all duration-300 shadow-sm">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Accordion Animation */}
        <div className={`grid transition-all duration-400 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
           <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-50/50">
              
              <div className="bg-slate-50 rounded-2xl p-4 shadow-inner mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{issue.message}</p>
              </div>

              {issue.resolvedMessage && (
                <div className="p-4 rounded-2xl text-sm mb-4 relative overflow-hidden bg-slate-50 text-slate-800 ring-1 ring-slate-200">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                  <p className="font-bold text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                    Resolution Details
                  </p>
                  {issue.resolvedMessage}
                </div>
              )}

              {issue.status === "approved" && (
                <div className="space-y-3 pt-2">
                  {!showResolve ? (
                    <button onClick={() => setShowResolve(true)} className="w-full py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> Mark as Resolved
                    </button>
                  ) : (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in slide-in-from-top-4 fade-in duration-300">
                      <textarea 
                        value={resolveMsg} 
                        onChange={(e) => setResolveMsg(e.target.value)} 
                        placeholder="Describe the fix or resolution applied..." 
                        rows={3} 
                        className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 resize-none transition-all shadow-sm" 
                      />
                      <div className="flex gap-3">
                        <button onClick={() => { setShowResolve(false); setResolveMsg(""); }} className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 active:scale-95 transition-all">
                          Cancel
                        </button>
                        
                        {/* ✅ Uses the new direct function */}
                        <button 
                          onClick={handleConfirmResolve} 
                          disabled={!resolveMsg.trim() || busy} 
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {busy ? <><Loader2 size={15} className="animate-spin" /> Resolving...</> : "Confirm Resolve"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SuperAdminIssues() {
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("all");
  const [toast, setToast]     = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    getTechnicalIssues()
      .then((data) => { if (data.success) setIssues(data.issues); })
      .catch((err) => showToast("Failed to fetch issues", "error"))
      .finally(() => setLoading(false));
  }, []);

  // ✅ This is the function being passed down
  const handleResolve = async (id, resolvedMessage) => {
    try {
      const data = await resolveTechnicalIssue(id, resolvedMessage);
      if (data.success) {
        setIssues((p) => p.map((i) => (i._id === id ? data.issue : i)));
        showToast("Issue resolved!");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to resolve", "error");
    }
  };

  const filtered      = tab === "all" ? issues : issues.filter((i) => i.status === tab);
  const awaitingCount = issues.filter((i) => i.status === "approved").length;

  const stats = [
    { label: "Total Issues",   value: issues.length,                                          Icon: Bug,          color: "text-slate-600"   },
    { label: "From Employees", value: issues.filter((i) => i.role === "employee").length,     Icon: Users,        color: "text-slate-600"   },
    { label: "From Admins",    value: issues.filter((i) => i.role === "admin").length,        Icon: Shield,       color: "text-slate-600" },
    { label: "Resolved",       value: issues.filter((i) => i.status === "resolved").length,   Icon: CheckCircle2, color: "text-emerald-600"  },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 selection:bg-slate-200 selection:text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <Toast toast={toast} />

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-900/20">
              <Shield size={24} />
            </div>
            Technical Escalations
            {awaitingCount > 0 && (
              <span className="bg-rose-500 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider animate-pulse ml-2">
                {awaitingCount} Awaiting
              </span>
            )}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2 ml-1">Review and resolve system issues across the organization</p>
        </div>

        {/* Minimalist Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-slate-50 rounded-lg">
                  <s.Icon size={14} className={s.color} />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              </div>
              <p className={`text-3xl font-black ${s.color === 'text-emerald-600' ? 'text-emerald-600' : 'text-slate-800'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Fluid Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl mb-8 overflow-x-auto shadow-inner ring-1 ring-slate-200/50 hide-scrollbar">
          {TABS.map((t) => {
            const c = t === "all" ? issues.length : issues.filter((i) => i.status === t).length;
            const isActive = tab === t;
            return (
              <button 
                key={t} 
                onClick={() => setTab(t)} 
                className={`flex-1 min-w-fit px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2
                  ${isActive ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50 scale-[1.02]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"}`}
              >
                {t === "approved" ? "Awaiting Fix" : t} 
                {c > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/50 text-slate-400'}`}>{c}</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="p-4 bg-white rounded-full shadow-lg shadow-slate-200/50 animate-spin">
              <Loader2 size={32} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-400 animate-pulse">Loading tickets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No {tab !== "all" ? tab : ""} issues found</h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">The system is running smoothly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((issue) => (
              // ✅ handleResolve is passed explicitly here
              <IssueCard key={issue._id} issue={issue} onResolve={handleResolve} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}