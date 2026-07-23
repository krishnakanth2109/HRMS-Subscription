import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { 
  Search, Filter, Calendar, Clock, Trash2, Eye, RefreshCw, 
  Sliders, User, Mail, Phone, Activity, Building2, X, AlertTriangle, CheckCircle2
} from "lucide-react";
import { getDemoRequests, updateDemoRequestStatus, deleteDemoRequest } from "../../api"; 

const STATUS_META = {
  pending:   { label: "Pending",   color: "#d97706", bg: "rgba(245,158,11,.06)",  border: "rgba(245,158,11,.12)",  icon: "🕐" },
  scheduled: { label: "Scheduled", color: "#2563eb", bg: "rgba(59,111,255,.06)",  border: "rgba(59,111,255,.12)",  icon: "📅" },
  completed: { label: "Completed", color: "#059669", bg: "rgba(5,150,105,.06)",   border: "rgba(5,150,105,.12)",   icon: "✅" },
  cancelled: { label: "Cancelled", color: "#e11d48", bg: "rgba(255,78,114,.06)",  border: "rgba(255,78,114,.12)",  icon: "🚫" },
};

// Format Date helpers
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
      style={{ color: m.color, backgroundColor: m.bg, borderColor: m.border }}
    >
      <span>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

export default function AdminDemoRequests() {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState(null);
  const [updating, setUpdating]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [counts, setCounts]         = useState({});
  const LIMIT = 8;

  const showToast = (icon, title, msg) => {
    setToast({ icon, title, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filter !== "all") params.status = filter;
      if (search.trim()) params.search = search.trim();
      
      const data = await getDemoRequests(params);
      
      if (data.success) {
        setRequests(data.data);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch { 
      showToast("⚠️", "Fetch Error", "Could not load requests."); 
    } finally { 
      setLoading(false); 
    }
  }, [filter, search, page]);

  const fetchCounts = useCallback(async () => {
    const statuses = ["pending", "scheduled", "completed", "cancelled"];
    try {
      const results = await Promise.all(
        statuses.map((s) => getDemoRequests({ status: s, limit: 1 }).catch(() => ({ total: 0 })))
      );
      const c = {};
      statuses.forEach((s, i) => { c[s] = results[i].total || 0; });
      setCounts(c);
    } catch {
      console.error("Error fetching counts");
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { setPage(1); }, [filter, search]);

  const updateStatus = async (id, status) => {
    const request = requests.find((r) => r._id === id) || selected;
    const name = request ? request.fullName : "this applicant";

    const result = await Swal.fire({
      title: "Update Status",
      text: `Are you sure want to change status of Demo Request for ${name} to "${STATUS_META[status].label}" and send an email notification?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0f172a",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, update it!"
    });

    if (!result.isConfirmed) {
      return;
    }

    setUpdating(id);
    try {
      const data = await updateDemoRequestStatus(id, status);
      
      if (data.success) {
        setRequests((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
        if (selected?._id === id) setSelected((s) => ({ ...s, status }));
        
        showToast("✅", "Status Updated", `Request marked as ${STATUS_META[status].label}.`);
        fetchCounts();
      } else {
        showToast("⚠️", "Update Failed", data.message);
      }
    } catch { 
      showToast("⚠️", "Error", "Could not update status."); 
    } finally { 
      setUpdating(null); 
    }
  };

  const deleteRequest = async (id) => {
    const result = await Swal.fire({
      title: "Delete Request?",
      text: "Delete this demo request? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!"
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const data = await deleteDemoRequest(id);
      
      if (data.success) {
        setRequests((prev) => prev.filter((r) => r._id !== id));
        if (selected?._id === id) setSelected(null);
        showToast("🗑️", "Deleted", "Demo request removed.");
        fetchCounts(); 
        fetchAll();
      } else {
        showToast("⚠️", "Delete Failed", data.message);
      }
    } catch { 
      showToast("⚠️", "Error", "Could not delete."); 
    }
  };

  function splitDemoTime(iso) {
    if (!iso) return { date: "—", time: "—" };
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };
  }

  const isPast = (iso) => iso && new Date(iso) < new Date();

  return (
    <div className="space-y-6 animate-[fadeIn_0.35s_ease-out] max-w-7xl mx-auto">
      
      {/* Page Title & Meta Info */}
      <div className="flex justify-between items-center pb-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-800" />
            Demo Bookings
          </h2>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Manage incoming demo requests, schedule live product walkthrough sessions, and track status.
          </p>
        </div>
      </div>

      {/* Stats Dashboard - Compact Independent Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(STATUS_META).map(([k, v]) => {
          const isActive = filter === k;
          const count = counts[k] ?? 0;

          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-left transition-all duration-200 rounded-xl p-4 flex items-center justify-between border
                ${isActive 
                  ? "bg-slate-50 border-slate-900 shadow-sm" 
                  : "bg-white border-slate-200 hover:border-slate-350 hover:shadow-sm"}`}
            >
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{v.label}</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{count}</span>
              </div>
              <div className="text-lg opacity-85 shrink-0">
                {v.icon}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Panel - Vercel Inline Style */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-1">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicants, companies..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-colors shadow-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {["all", "pending", "scheduled", "completed", "cancelled"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                  filter === f
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f === "all" ? "All" : STATUS_META[f].label}
              </button>
            ))}
          </div>

          <button
            onClick={() => { fetchAll(); fetchCounts(); }}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table / Directory Container */}
      <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-semibold">
            No demo requests found{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicant</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferred Date &amp; Time</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const m = STATUS_META[r.status] || STATUS_META.pending;
                  const dt = splitDemoTime(r.preferredDemoTime);
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-900">{r.fullName}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">{r.companyName}</div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="text-slate-800 font-semibold">{r.email}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{r.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="text-slate-800 font-semibold">{dt.date}</div>
                        <div className={`text-[10px] font-bold mt-0.5 ${isPast(r.preferredDemoTime) ? "text-slate-400" : "text-slate-600"}`}>
                          {dt.time}{isPast(r.preferredDemoTime) ? " (past)" : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {fmtDate(r.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border"
                          style={{ color: m.color, backgroundColor: m.bg, borderColor: m.border }}
                        >
                          <select 
                            className="bg-transparent outline-none cursor-pointer pr-1 font-bold text-[11px] appearance-none"
                            style={{ color: m.color }}
                            value={r.status} 
                            disabled={updating === r._id}
                            onChange={(e) => updateStatus(r._id, e.target.value)}
                          >
                            {Object.entries(STATUS_META).map(([k, v]) => (
                              <option key={k} value={k} className="bg-white text-slate-800 font-medium">{v.label}</option>
                            ))}
                          </select>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs">
                        <div className="flex items-center justify-end gap-4">
                          <button 
                            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                            onClick={() => setSelected(r)}
                          >
                            View
                          </button>
                          <button 
                            className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                            onClick={() => deleteRequest(r._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
            <span className="text-[11px] font-semibold text-slate-400">Showing page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setPage((p) => p - 1)} 
                disabled={page === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg hover:border-slate-350 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                  <button 
                    key={n} 
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border flex items-center justify-center ${
                      n === page 
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-350"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setPage((p) => p + 1)} 
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg hover:border-slate-350 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Overlay / Modal */}
      {selected && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl relative overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            
            {/* Top design accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900" />
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-slate-900">{selected.fullName}</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {selected.companyName} · Submitted on {fmtDate(selected.createdAt)}
                </p>
              </div>
              <button 
                className="p-1 rounded bg-white text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" 
                onClick={() => setSelected(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              
              {/* Highlight preferred slot box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-base mt-0.5">📅</span>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preferred Demo Slot</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">{fmtDateTime(selected.preferredDemoTime)}</div>
                </div>
              </div>

              {/* Grid details */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                  <span className="text-xs text-slate-800 font-semibold mt-1 block truncate" title={selected.email}>
                    {selected.email}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                  <span className="text-xs text-slate-800 font-semibold mt-1 block">
                    {selected.phone || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Company</span>
                  <span className="text-xs text-slate-800 font-semibold mt-1 block">
                    {selected.companyName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Current Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
              </div>

              {/* Message Box */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Applicant Message</span>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs leading-relaxed text-slate-600 min-h-[64px]">
                  {selected.message || <em className="text-slate-400 font-normal">No message provided.</em>}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="space-y-3 pt-6 border-t border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Update Status</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_META).filter(([k]) => k !== selected.status).map(([k, v]) => (
                    <button 
                      key={k} 
                      disabled={updating === selected._id}
                      onClick={() => updateStatus(selected._id, k)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition-all border active:scale-97 cursor-pointer ${
                        k === "scheduled" ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/50" :
                        k === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50" :
                        k === "cancelled" ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/50" :
                        "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/50"
                      }`}
                    >
                      {v.icon} Mark {v.label}
                    </button>
                  ))}
                  <button 
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-all active:scale-97 cursor-pointer"
                    onClick={() => deleteRequest(selected._id)}
                  >
                    Delete Request
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Slide-Up Alert Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-lg max-w-sm z-50 animate-[slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)]">
          <span className="text-lg mt-0.5 shrink-0">{toast.icon}</span>
          <div className="min-w-0">
            <strong className="block text-xs font-bold text-slate-800">{toast.title}</strong>
            <span className="block text-[11px] text-slate-400 font-medium mt-0.5">{toast.msg}</span>
          </div>
        </div>
      )}

    </div>
  );
}