import { useState, useEffect } from "react";
import {
  Shield, Bug, Loader2, Users, CheckCircle2,
  Clock, ThumbsUp, XCircle, ChevronDown, User, X
} from "lucide-react";
import { getTechnicalIssues, resolveTechnicalIssue } from ".././api";

const STATUS_MAP = {
  pending:  { cls: "bg-amber-50 text-amber-700 border-amber-200/60",      color: "#d97706", Icon: Clock,        label: "Pending"  },
  approved: { cls: "bg-blue-50 text-blue-700 border-blue-200/60",          color: "#2563eb", Icon: ThumbsUp,     label: "Approved" },
  resolved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60", color: "#059669", Icon: CheckCircle2, label: "Resolved" },
  rejected: { cls: "bg-rose-50 text-rose-700 border-rose-200/60",          color: "#e11d48", Icon: XCircle,      label: "Rejected" },
};

const TABS = ["all", "approved", "resolved"];

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2.5 border animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)] ${
      toast.type === "error" 
        ? "bg-rose-50 border-rose-100 text-rose-800" 
        : "bg-slate-900 border-slate-950 text-white"
    }`}>
      {toast.type === "error" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
      {toast.msg}
    </div>
  );
}

function IssueCard({ issue, onResolve }) {
  const [open, setOpen]               = useState(false);
  const [resolveMsg, setResolveMsg]   = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [lightbox, setLightbox]       = useState(null);
  const [busy, setBusy]               = useState(false);

  const cfg = STATUS_MAP[issue.status] || STATUS_MAP.pending;
  const { Icon } = cfg;

  const handleConfirmResolve = async () => {
    if (typeof onResolve !== "function") {
      console.error("Critical React Error: onResolve is missing.");
      return;
    }

    setBusy(true);
    try {
      await onResolve(issue._id, resolveMsg);
      setShowResolve(false);
    } catch (error) {
      console.error("Resolve failed", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          <button className="absolute top-6 right-6 p-1.5 rounded-lg border border-slate-200/50 bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Premium ticket card wrapper with status left border */}
      <div 
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-400 hover:shadow-md transition-all duration-300 border-l-4"
        style={{ borderLeftColor: cfg.color }}
      >
        
        {/* Ticket main preview bar */}
        <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Meta tags */}
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-semibold mb-1">
              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                TKT-{issue._id.slice(-6).toUpperCase()}
              </span>
              <span>•</span>
              <span className="text-slate-800 font-bold">{issue.raisedByName || "Unknown"}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200/50 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {issue.role === "admin" ? "Admin" : "Employee"}
              </span>
              <span>•</span>
              <span className="font-mono text-[9px] text-slate-400">
                {new Date(issue.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Subject */}
            <h3 className="font-bold text-slate-900 text-sm tracking-tight truncate">
              {issue.subject}
            </h3>

            {/* Message short preview */}
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">{issue.message}</p>
          </div>

          {/* Status, attachment labels & expand actions */}
          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                <Icon size={10} strokeWidth={2.5} /> {cfg.label}
              </span>
              {issue.images?.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 text-[9px] font-bold uppercase tracking-wider">
                  📎 {issue.images.length}
                </span>
              )}
            </div>

            <button 
              onClick={() => setOpen(!open)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Details</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Expanded Ticket View */}
        {open && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Detailed message */}
              <div className="md:col-span-2 space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Escalation Message</span>
                <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-lg p-3.5 whitespace-pre-wrap">
                  {issue.message}
                </p>
              </div>

              {/* Sender profile card */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Ticket Info</span>
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="text-xs">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reporter</p>
                    <p className="font-bold text-slate-900 mt-0.5">{issue.raisedByName || "Unknown"}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{issue.raisedByEmail || "No Email Provided"}</p>
                  </div>
                  {issue.images?.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Attachments</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {issue.images.map((img, i) => (
                          <button key={i} onClick={() => setLightbox(img.url)} className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-all shadow-sm">
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resolution display box */}
            {issue.resolvedMessage && (
              <div className="bg-emerald-50/40 border border-emerald-200/50 rounded-lg p-3.5 text-xs text-slate-700">
                <p className="font-bold text-[9px] uppercase tracking-widest mb-1.5 text-emerald-700">
                  Resolution Details
                </p>
                {issue.resolvedMessage}
              </div>
            )}

            {/* Resolve Form Action trigger */}
            {issue.status === "approved" && (
              <div className="pt-1">
                {!showResolve ? (
                  <button 
                    onClick={() => setShowResolve(true)} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-all active:scale-97 cursor-pointer"
                  >
                    <CheckCircle2 size={13} /> Mark as Resolved
                  </button>
                ) : (
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-w-2xl animate-in slide-in-from-top-2 duration-205">
                    <textarea 
                      value={resolveMsg} 
                      onChange={(e) => setResolveMsg(e.target.value)} 
                      placeholder="Describe the fix or resolution applied..." 
                      rows={3} 
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 outline-none resize-none transition-colors placeholder-slate-400" 
                    />
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => { setShowResolve(false); setResolveMsg(""); }} 
                        className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleConfirmResolve} 
                        disabled={!resolveMsg.trim() || busy} 
                        className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {busy ? <><Loader2 size={12} className="animate-spin" /> Resolving...</> : "Confirm Resolve"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
      .catch(() => showToast("Failed to fetch issues", "error"))
      .finally(() => setLoading(false));
  }, []);

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
    { label: "Total Issues",   value: issues.length,                                          Icon: Bug,          bg: "bg-slate-50 border-slate-200 text-slate-700" },
    { label: "From Employees", value: issues.filter((i) => i.role === "employee").length,     Icon: Users,        bg: "bg-indigo-50/40 border-indigo-100 text-indigo-700" },
    { label: "From Admins",    value: issues.filter((i) => i.role === "admin").length,        Icon: Shield,       bg: "bg-blue-50/40 border-blue-100 text-blue-700" },
    { label: "Resolved",       value: issues.filter((i) => i.status === "resolved").length,   Icon: CheckCircle2, bg: "bg-emerald-50/40 border-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="space-y-6 animate-[fadeIn_0.35s_ease-out] max-w-4xl mx-auto py-4">
      <Toast toast={toast} />

      {/* Page Title & Meta Info */}
      <div className="flex justify-between items-center pb-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-slate-800" />
            Technical Escalations
            {awaitingCount > 0 && (
              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                {awaitingCount} Awaiting Fix
              </span>
            )}
          </h2>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Review and resolve system bugs and user escalations reported by administrators and employees.
          </p>
        </div>
      </div>

      {/* Stats Dashboard - Compact Independent Cards with subtle color brand accents */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.Icon;
          return (
            <div key={s.label} className={`border rounded-xl p-4 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-sm transition-all duration-300 ${s.bg}`}>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest block opacity-75">{s.label}</span>
                <span className="text-xl font-bold mt-1 block">{s.value}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/60 border border-current/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Tabs - Colored Vercel Segmented Control */}
      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
        {TABS.map((t) => {
          const c = t === "all" ? issues.length : issues.filter((i) => i.status === t).length;
          const isActive = tab === t;
          
          let activeCls = "bg-white text-slate-900 shadow-sm border border-slate-200/40";
          if (isActive) {
            if (t === "approved") activeCls = "bg-blue-600 text-white shadow-sm";
            else if (t === "resolved") activeCls = "bg-emerald-600 text-white shadow-sm";
            else activeCls = "bg-slate-900 text-white shadow-sm";
          }

          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200 ${
                isActive ? activeCls : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "approved" ? "Awaiting Fix" : t}
              {c > 0 && <span className={`ml-1.5 text-[9px] font-semibold ${isActive ? "opacity-90" : "text-slate-400"}`}>({c})</span>}
            </button>
          );
        })}
      </div>

      {/* Tickets List Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-pulse">Loading Tickets...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200/60 shadow-sm">
          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Bug className="w-4.5 h-4.5 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Tickets Found</h4>
          <p className="text-slate-400 max-w-sm mt-1 text-xs font-semibold mx-auto">
            All systems are fully operational. There are no technical escalations reported under this filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((issue) => (
            <IssueCard key={issue._id} issue={issue} onResolve={handleResolve} />
          ))}
        </div>
      )}
    </div>
  );
}