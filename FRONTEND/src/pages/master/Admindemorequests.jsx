
import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { getDemoRequests, updateDemoRequestStatus, deleteDemoRequest } from "../../api"; 

const STATUS_META = {
  pending:   { label: "Pending",   color: "#d97706", bg: "rgba(245,158,11,.12)",  icon: "🕐" },
  scheduled: { label: "Scheduled", color: "#3b6fff", bg: "rgba(59,111,255,.12)",  icon: "📅" },
  completed: { label: "Completed", color: "#059669", bg: "rgba(0,201,167,.12)",   icon: "✅" },
  cancelled: { label: "Cancelled", color: "#e11d48", bg: "rgba(255,78,114,.12)",  icon: "🚫" },
};

// Format stored Date → readable string
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

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
  .ad-root*,.ad-root *::before,.ad-root *::after{box-sizing:border-box;margin:0;padding:0;}
  .ad-root{
    --bg:#f8fafc;--surf:#ffffff;--surf2:#f1f5f9;--surf3:#e2e8f0;
    --border:rgba(0,0,0,0.08);--accent:#3b6fff;--teal:#059669;
    --text:#0f172a;--muted:#64748b;--err:#e11d48;--r:10px;
    font-family:'Outfit',sans-serif;background:var(--bg);
    color:var(--text);min-height:100vh;
  }
  /* Topbar */
  .ad-topbar{
    background:var(--surf);border-bottom:1px solid var(--border);
    padding:0 32px;height:62px;display:flex;align-items:center;
    justify-content:space-between;position:sticky;top:0;z-index:100;
  }
  .ad-brand{display:flex;align-items:center;gap:10px;}
  .ad-brand-box{
    width:32px;height:32px;background:var(--accent);border-radius:8px;
    display:grid;place-items:center;box-shadow:0 0 18px rgba(59,111,255,.25);
  }
  .ad-brand-box svg{width:16px;height:16px;}
  .ad-brand-name{font-size:.95rem;font-weight:800;letter-spacing:.02em;}
  .ad-brand-name span{color:var(--teal);}
  .ad-brand-tag{
    font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
    background:rgba(59,111,255,.12);color:#2563eb;
    border:1px solid rgba(59,111,255,.2);border-radius:50px;padding:3px 10px;
  }
  .ad-stats{display:flex;gap:6px;}
  .ad-stat{
    font-size:.72rem;font-weight:600;padding:5px 12px;border-radius:50px;
    border:1px solid var(--border);background:var(--surf2);color:var(--muted);
    cursor:pointer;transition:border-color .2s,color .2s;
  }
  .ad-stat:hover{border-color:var(--accent);color:var(--text);}
  /* Main */
  .ad-main{padding:32px;}
  .ad-head{margin-bottom:28px;}
  .ad-head h1{font-size:1.7rem;font-weight:800;letter-spacing:-.02em;margin-bottom:4px;}
  .ad-head p{font-size:.83rem;color:var(--muted);}
  /* Toolbar */
  .ad-toolbar{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;}
  .ad-search-wrap{position:relative;flex:1;min-width:200px;max-width:340px;}
  .ad-search-ic{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none;display:flex;}
  .ad-search{
    width:100%;background:var(--surf);border:1px solid var(--border);
    border-radius:var(--r);color:var(--text);font-family:'Outfit',sans-serif;
    font-size:.84rem;padding:9px 12px 9px 36px;outline:none;transition:border-color .2s;
  }
  .ad-search::placeholder{color:rgba(100,116,139,.6);}
  .ad-search:focus{border-color:var(--accent);}
  .ad-filter-btns{display:flex;gap:6px;flex-wrap:wrap;}
  .ad-filter{
    font-size:.75rem;font-weight:600;padding:7px 14px;border-radius:50px;
    border:1px solid var(--border);background:var(--surf);color:var(--muted);
    cursor:pointer;transition:all .2s;letter-spacing:.04em;
  }
  .ad-filter.active,.ad-filter:hover{border-color:var(--accent);color:var(--accent);background:rgba(59,111,255,.05);}
  .ad-refresh{
    margin-left:auto;background:var(--surf);border:1px solid var(--border);
    border-radius:var(--r);color:var(--muted);font-family:'Outfit',sans-serif;
    font-size:.78rem;padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:7px;
    transition:border-color .2s,color .2s;
  }
  .ad-refresh:hover{border-color:var(--accent);color:var(--accent);}
  .ad-refresh svg{transition:transform .3s;}
  .ad-refresh:hover svg{transform:rotate(180deg);}
  /* Table */
  .ad-table-wrap{overflow-x:auto;border-radius:16px;border:1px solid var(--border);background:var(--surf);}
  table{width:100%;border-collapse:collapse;}
  thead th{
    padding:13px 16px;text-align:left;font-size:.7rem;font-weight:700;
    letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
    border-bottom:1px solid var(--border);background:var(--surf2);white-space:nowrap;
  }
  thead th:first-child{border-radius:16px 0 0 0;}
  thead th:last-child{border-radius:0 16px 0 0;}
  tbody tr{border-bottom:1px solid var(--border);transition:background .15s;}
  tbody tr:last-child{border-bottom:none;}
  tbody tr:hover{background:var(--surf2);}
  td{padding:14px 16px;font-size:.83rem;vertical-align:middle;}
  .ad-name{font-weight:600;margin-bottom:2px;}
  .ad-company{font-size:.75rem;color:var(--muted);}
  .ad-email{color:#2563eb;font-size:.8rem;font-weight:500;}
  .ad-phone{color:var(--muted);font-size:.8rem;}
  /* Demo time cell */
  .ad-demo-date{font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:2px;}
  .ad-demo-time{font-size:.72rem;color:var(--teal);font-weight:600;}
  .ad-past-time{color:var(--muted)!important;}
  .ad-date{font-size:.75rem;color:var(--muted);}
  /* Status badge */
  .ad-badge{
    display:inline-flex;align-items:center;gap:5px;
    border-radius:50px;padding:4px 10px;
    font-size:.7rem;font-weight:700;letter-spacing:.05em;white-space:nowrap;
  }
  .ad-status-sel{
    background:transparent;border:none;outline:none;
    font-family:'Outfit',sans-serif;font-size:.7rem;font-weight:700;
    letter-spacing:.05em;cursor:pointer;appearance:none;padding-right:14px;
    /* Encoded hex #64748b for light theme down arrow */
    background-image:url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right center;
  }
  /* Actions */
  .ad-actions{display:flex;gap:6px;align-items:center;}
  .ad-btn-view{
    background:rgba(59,111,255,.08);border:1px solid rgba(59,111,255,.2);
    border-radius:7px;color:#2563eb;font-size:.72rem;font-weight:600;
    padding:5px 11px;cursor:pointer;transition:background .2s;
    font-family:'Outfit',sans-serif;
  }
  .ad-btn-view:hover{background:rgba(59,111,255,.15);}
  .ad-btn-del{
    background:rgba(255,78,114,.08);border:1px solid rgba(255,78,114,.2);
    border-radius:7px;color:#e11d48;font-size:.72rem;font-weight:600;
    padding:5px 11px;cursor:pointer;transition:background .2s;
    font-family:'Outfit',sans-serif;
  }
  .ad-btn-del:hover{background:rgba(255,78,114,.15);}
  /* Empty / loading */
  .ad-empty{padding:64px 24px;text-align:center;color:var(--muted);font-size:.88rem;}
  .ad-loading{display:flex;justify-content:center;padding:60px;}
  .ad-spin-big{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:adSpin .7s linear infinite;}
  /* Pagination */
  .ad-pagination{display:flex;align-items:center;gap:8px;padding:18px 20px;border-top:1px solid var(--border);}
  .ad-pg-info{font-size:.78rem;color:var(--muted);flex:1;}
  .ad-pg-btn{
    background:var(--surf);border:1px solid var(--border);border-radius:7px;
    color:var(--muted);font-family:'Outfit',sans-serif;font-size:.78rem;
    padding:6px 14px;cursor:pointer;transition:border-color .2s,color .2s;
  }
  .ad-pg-btn:hover:not(:disabled){border-color:var(--accent);color:var(--text);}
  .ad-pg-btn:disabled{opacity:.35;cursor:not-allowed;}
  .ad-pg-pages{display:flex;gap:4px;}
  .ad-pg-num{
    width:30px;height:30px;border-radius:6px;display:grid;place-items:center;
    border:1px solid var(--border);background:var(--surf);
    font-size:.75rem;color:var(--muted);cursor:pointer;transition:all .2s;
  }
  .ad-pg-num.cur{background:var(--accent);border-color:var(--accent);color:#fff;}
  .ad-pg-num:hover:not(.cur){border-color:var(--accent);color:var(--accent);}
  /* Modal */
  .ad-overlay{
    position:fixed;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);
    z-index:200;display:flex;align-items:center;justify-content:center;
    padding:20px;animation:adFadeIn .2s ease;
  }
  .ad-modal{
    background:var(--surf);border:1px solid var(--border);border-radius:20px;
    width:100%;max-width:540px;max-height:90vh;overflow-y:auto;
    box-shadow:0 20px 40px rgba(0,0,0,.1);
    animation:adSlideUp .3s cubic-bezier(.16,1,.3,1);position:relative;
  }
  .ad-modal::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--accent),var(--teal),transparent);
  }
  .ad-modal-head{padding:24px 28px 0;display:flex;justify-content:space-between;align-items:flex-start;}
  .ad-modal-head h2{font-size:1.2rem;font-weight:700;}
  .ad-modal-head p{font-size:.78rem;color:var(--muted);}
  .ad-close{
    background:var(--surf);border:1px solid var(--border);border-radius:7px;
    color:var(--muted);width:30px;height:30px;
    display:grid;place-items:center;cursor:pointer;transition:border-color .2s,color .2s;
  }
  .ad-close:hover{border-color:var(--err);color:var(--err);background:rgba(225,29,72,.05);}
  .ad-modal-body{padding:20px 28px 28px;}
  /* Demo time highlight box in modal */
  .ad-demo-box{
    background:rgba(59,111,255,.05);border:1px solid rgba(59,111,255,.15);
    border-radius:12px;padding:14px 18px;margin-bottom:20px;
    display:flex;align-items:center;gap:12px;
  }
  .ad-demo-box-icon{font-size:1.6rem;}
  .ad-demo-box-label{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-bottom:3px;}
  .ad-demo-box-val{font-size:.95rem;font-weight:700;color:#2563eb;}
  .ad-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
  .ad-detail-label{font-size:.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;}
  .ad-detail-val{font-size:.88rem;font-weight:500;}
  .ad-detail-msg{margin-bottom:20px;}
  .ad-detail-msg-box{
    background:var(--surf2);border:1px solid var(--border);border-radius:var(--r);
    padding:14px;font-size:.84rem;line-height:1.7;color:#334155;min-height:56px;
  }
  .ad-modal-actions{display:flex;gap:10px;flex-wrap:wrap;}
  .ad-upd-label{font-size:.72rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;}
  .ad-ma-btn{
    flex:1;padding:10px;border-radius:var(--r);border:1px solid;
    font-family:'Outfit',sans-serif;font-size:.8rem;font-weight:700;
    cursor:pointer;transition:opacity .2s,transform .15s;letter-spacing:.03em;
  }
  .ad-ma-btn:hover{opacity:.85;transform:translateY(-1px);}
  .ad-ma-btn:active{transform:none;}
  .ad-ma-btn.scheduled{background:rgba(59,111,255,.1);border-color:rgba(59,111,255,.25);color:#2563eb;}
  .ad-ma-btn.completed{background:rgba(5,150,105,.1);border-color:rgba(5,150,105,.25);color:var(--teal);}
  .ad-ma-btn.cancelled{background:rgba(225,29,72,.08);border-color:rgba(225,29,72,.25);color:#e11d48;}
  .ad-ma-btn.pending  {background:rgba(217,119,6,.1);border-color:rgba(217,119,6,.25);color:#d97706;}
  .ad-ma-del{
    flex:1;padding:10px;border-radius:var(--r);border:1px solid rgba(225,29,72,.25);
    background:rgba(225,29,72,.05);color:#e11d48;
    font-family:'Outfit',sans-serif;font-size:.8rem;font-weight:700;
    cursor:pointer;transition:background .2s;
  }
  .ad-ma-del:hover{background:rgba(225,29,72,.12);}
  /* Toast */
  .ad-toast{
    position:fixed;bottom:24px;right:24px;
    background:var(--surf);border:1px solid var(--border);border-radius:var(--r);
    padding:14px 18px;display:flex;align-items:center;gap:10px;
    max-width:320px;box-shadow:0 10px 30px rgba(0,0,0,.1);z-index:300;
    animation:adSlideUp .35s cubic-bezier(.16,1,.3,1);
  }
  .ad-toast-body strong{display:block;font-size:.82rem;font-weight:700;margin-bottom:1px;}
  .ad-toast-body span{font-size:.73rem;color:var(--muted);}
  @keyframes adSpin{to{transform:rotate(360deg)}}
  @keyframes adFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes adSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
`;

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return <span className="ad-badge" style={{ color: m.color, background: m.bg }}>{m.icon} {m.label}</span>;
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
      // Prepare query parameters
      const params = { page, limit: LIMIT };
      if (filter !== "all") params.status = filter;
      if (search.trim()) params.search = search.trim();
      
      // Use Axios API function
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
      // Use Axios API function
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
    // Find request details for the SweetAlert message
    const request = requests.find((r) => r._id === id) || selected;
    const name = request ? request.fullName : "this applicant";

    // Trigger SweetAlert Confirmation
    const result = await Swal.fire({
      title: "Update Status",
      text: `Are you sure want to ${status} of Demo Request to ${name} and send mail..?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b6fff",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, update it!"
    });

    if (!result.isConfirmed) {
      return; // Exit if user canceled
    }

    setUpdating(id);
    try {
      // Use Axios API function
      const data = await updateDemoRequestStatus(id, status);
      
      if (data.success) {
        setRequests((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
        if (selected?._id === id) setSelected((s) => ({ ...s, status }));
        
        // Optional: Can also show a success SweetAlert here, but preserving original toast
        showToast("✅", "Status Updated", `Marked as ${STATUS_META[status].label}.`);
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
    // Trigger SweetAlert Confirmation
    const result = await Swal.fire({
      title: "Delete Request?",
      text: "Delete this demo request? This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!"
    });

    if (!result.isConfirmed) {
      return; // Exit if user canceled
    }

    try {
      // Use Axios API function
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

  // Split stored ISO into date and time parts for table display
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
    <>
      <style>{style}</style>
      <div className="ad-root">

        {/* Topbar
        <div className="ad-topbar">
          <div className="ad-brand">
            <div className="ad-brand-box">
              <svg viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="2" fill="white" opacity=".9"/><rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity=".55"/><rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity=".55"/><rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity=".25"/></svg>
            </div>
            <span className="ad-brand-name">Work<span>Force</span> HRMS</span>
            <span className="ad-brand-tag">Admin</span>
          </div>
          <div className="ad-stats">
            {Object.entries(STATUS_META).map(([k, v]) => (
              <span key={k} className="ad-stat"
                onClick={() => setFilter(k)}
                style={filter === k ? { borderColor: v.color, color: v.color, background: v.bg } : {}}>
                {v.icon} {counts[k] ?? "—"}
              </span>
            ))}
          </div>
        </div> */}

        <main className="ad-main">
          <div className="ad-head">
            <h1>Requests Demo's</h1>
            <p>{total} total request{total !== 1 ? "s" : ""} · page {page} of {totalPages}</p>
          </div>

          {/* Toolbar */}
          <div className="ad-toolbar">
            <div className="ad-search-wrap">
              <span className="ad-search-ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input className="ad-search" placeholder="Search name, email, company…"
                value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
            <div className="ad-filter-btns">
              {["all", "pending", "scheduled", "completed", "cancelled"].map((f) => (
                <button key={f} className={`ad-filter${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : `${STATUS_META[f].icon} ${STATUS_META[f].label}`}
                </button>
              ))}
            </div>
            <button className="ad-refresh" onClick={() => { fetchAll(); fetchCounts(); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="ad-table-wrap">
            {loading ? (
              <div className="ad-loading"><div className="ad-spin-big"/></div>
            ) : requests.length === 0 ? (
              <div className="ad-empty">No demo requests found{filter !== "all" ? ` with status "${filter}"` : ""}.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Demo Date &amp; Time</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const m  = STATUS_META[r.status] || STATUS_META.pending;
                    const dt = splitDemoTime(r.preferredDemoTime);
                    return (
                      <tr key={r._id}>
                        <td>
                          <div className="ad-name">{r.fullName}</div>
                          <div className="ad-company">{r.companyName}</div>
                        </td>
                        <td>
                          <div className="ad-email">{r.email}</div>
                          <div className="ad-phone">{r.phone}</div>
                        </td>
                        <td>
                          <div className="ad-demo-date">📅 {dt.date}</div>
                          <div className={`ad-demo-time${isPast(r.preferredDemoTime) ? " ad-past-time" : ""}`}>
                            🕐 {dt.time}{isPast(r.preferredDemoTime) ? " (past)" : ""}
                          </div>
                        </td>
                        <td><span className="ad-date">{fmtDate(r.createdAt)}</span></td>
                        <td>
                          <span className="ad-badge" style={{ color: m.color, background: m.bg }}>
                            {m.icon}&nbsp;
                            <select className="ad-status-sel" style={{ color: m.color }}
                              value={r.status} disabled={updating === r._id}
                              onChange={(e) => updateStatus(r._id, e.target.value)}>
                              {Object.entries(STATUS_META).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </span>
                        </td>
                        <td>
                          <div className="ad-actions">
                            <button className="ad-btn-view" onClick={() => setSelected(r)}>View</button>
                            <button className="ad-btn-del"  onClick={() => deleteRequest(r._id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="ad-pagination">
                <span className="ad-pg-info">Page {page} of {totalPages}</span>
                <button className="ad-pg-btn" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Prev</button>
                <div className="ad-pg-pages">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={`ad-pg-num${n === page ? " cur" : ""}`} onClick={() => setPage(n)}>{n}</button>
                  ))}
                </div>
                <button className="ad-pg-btn" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next →</button>
              </div>
            )}
          </div>
        </main>

        {/* Detail Modal */}
        {selected && (
          <div className="ad-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
            <div className="ad-modal">
              <div className="ad-modal-head">
                <div>
                  <h2>{selected.fullName}</h2>
                  <p>{selected.companyName} · submitted {fmtDate(selected.createdAt)}</p>
                </div>
                <button className="ad-close" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="ad-modal-body">

                {/* Demo time highlight */}
                <div className="ad-demo-box">
                  <span className="ad-demo-box-icon">📅</span>
                  <div>
                    <div className="ad-demo-box-label">Preferred Demo Date &amp; Time</div>
                    <div className="ad-demo-box-val">{fmtDateTime(selected.preferredDemoTime)}</div>
                  </div>
                </div>

                <div className="ad-detail-grid">
                  {[
                    ["Email",     selected.email],
                    ["Phone",     selected.phone],
                    ["Company",   selected.companyName],
                    ["Submitted", fmtDate(selected.createdAt)],
                    ["Status",    <StatusBadge key="st" status={selected.status}/>],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="ad-detail-label">{l}</div>
                      <div className="ad-detail-val">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="ad-detail-msg">
                  <div className="ad-detail-label" style={{ marginBottom: 8 }}>Message</div>
                  <div className="ad-detail-msg-box">
                    {selected.message || <em style={{ color: "var(--muted)" }}>No message provided.</em>}
                  </div>
                </div>

                <div className="ad-upd-label">Update Status</div>
                <div className="ad-modal-actions">
                  {Object.entries(STATUS_META).filter(([k]) => k !== selected.status).map(([k, v]) => (
                    <button key={k} className={`ad-ma-btn ${k}`}
                      disabled={updating === selected._id}
                      onClick={() => updateStatus(selected._id, k)}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                  <button className="ad-ma-del" onClick={() => deleteRequest(selected._id)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="ad-toast">
            <span style={{ fontSize: "1.2rem" }}>{toast.icon}</span>
            <div className="ad-toast-body">
              <strong>{toast.title}</strong>
              <span>{toast.msg}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}