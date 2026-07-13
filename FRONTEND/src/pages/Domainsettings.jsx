// --- START OF FILE pages/DomainSettings.jsx ---
import { useState, useEffect, useCallback } from "react";
import { baseURL } from "../api";

const API_BASE = `${baseURL}/api`;
const BASE_DOMAIN = "vwsync.com";

/* ─── FIX: Try all common token keys your app might use ─── */
const getToken = () =>
  sessionStorage.getItem("adminToken") ||
  sessionStorage.getItem("token") ||
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("adminToken") ||
  sessionStorage.getItem("token") ||
  "";

/* ─── tiny hook: debounce ─── */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── API helpers ─── */
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ─── SVG Icons ─── */
const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
  </svg>
);
const XCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);
const GlobeIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);
const SpinnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"
    style={{ animation: "ds-spin 0.75s linear infinite", display: "inline-block" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   - No own background / min-height — fits inside LayoutMaster
   - Token fix: reads adminToken → token → authToken in order
──────────────────────────────────────────────────────────────── */
export default function DomainSettings() {
  const [domain, setDomain]          = useState(null);
  const [loading, setLoading]        = useState(true);
  const [subInput, setSubInput]      = useState("");
  const [mode, setMode]              = useState("idle");
  const [availability, setAvail]     = useState(null);
  const [toast, setToast]            = useState(null);
  const [actionLoading, setAction]   = useState(false);
  const [confirmDisable, setConfirm] = useState(false);
  const [copied, setCopied]          = useState(false);

  const debouncedSub = useDebounce(subInput, 450);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDomain = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/domain/my-domain");
      setDomain(data);
    } catch {
      setDomain(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDomain(); }, [fetchDomain]);

  useEffect(() => {
    if (!debouncedSub || debouncedSub.length < 2) { setAvail(null); return; }
    const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(debouncedSub);
    if (!isValid) { setAvail("invalid"); return; }
    if (mode === "edit" && domain && debouncedSub === domain.subdomain) {
      setAvail("available"); return;
    }
    setAvail("checking");
    fetch(`${API_BASE}/domain/check/${debouncedSub}`)
      .then(r => r.json())
      .then(d => setAvail(d.available ? "available" : "taken"))
      .catch(() => setAvail(null));
  }, [debouncedSub, domain, mode]);

  const handleCopy = async () => {
    if (!domain) return;
    await navigator.clipboard.writeText(`https://${domain.subdomain}.${BASE_DOMAIN}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleCreate = async () => {
    if (availability !== "available") return;
    setAction(true);
    try {
      const data = await apiFetch("/domain/create", {
        method: "POST",
        body: JSON.stringify({ subdomain: subInput }),
      });
      setDomain(data.domain);
      setMode("idle"); setSubInput(""); setAvail(null);
      showToast("success", "Subdomain created! Your portal is live.");
    } catch (e) { showToast("error", e.message); }
    finally { setAction(false); }
  };

  const handleUpdate = async () => {
    if (availability !== "available") return;
    setAction(true);
    try {
      const data = await apiFetch("/domain/update", {
        method: "PUT",
        body: JSON.stringify({ subdomain: subInput }),
      });
      setDomain(data.domain);
      setMode("idle"); setSubInput(""); setAvail(null);
      showToast("success", "Subdomain updated.");
    } catch (e) { showToast("error", e.message); }
    finally { setAction(false); }
  };

  const handleDisable = async () => {
    setConfirm(false); setAction(true);
    try {
      await apiFetch("/domain/disable", { method: "DELETE" });
      await fetchDomain();
      showToast("success", "Domain disabled.");
    } catch (e) { showToast("error", e.message); }
    finally { setAction(false); }
  };

  const handleEnable = async () => {
    setAction(true);
    try {
      await apiFetch("/domain/enable", { method: "PATCH" });
      await fetchDomain();
      showToast("success", "Domain re-enabled.");
    } catch (e) { showToast("error", e.message); }
    finally { setAction(false); }
  };

  const startEdit = () => {
    setSubInput(domain?.subdomain || "");
    setMode("edit");
    setAvail("available");
  };
  const cancelMode = () => { setMode("idle"); setSubInput(""); setAvail(null); };

  const availColor = availability === "available" ? "#16a34a"
    : (availability === "taken" || availability === "invalid") ? "#dc2626" : "#6366f1";
  const inputBorderColor = availability === "available" ? "#16a34a"
    : (availability === "taken" || availability === "invalid") ? "#dc2626" : "#e2e8f0";

  return (
    <>
      <style>{`
        @keyframes ds-spin    { to { transform: rotate(360deg); } }
        @keyframes ds-fadein  { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:none; } }
        @keyframes ds-slide   { from { opacity:0;transform:translateX(20px);} to { opacity:1;transform:none; } }
        @keyframes ds-shimmer {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }

        /* Wrapper — transparent, no min-height, lives inside LayoutMaster scroll area */
        .ds-wrap { width:100%; max-width:860px; animation:ds-fadein .35s ease; }

        /* Title row */
        .ds-title-row {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:22px; flex-wrap:wrap; gap:10px;
        }
        .ds-title-row h2 {
          font-size:19px; font-weight:700; color:#0f172a;
          display:flex; align-items:center; gap:10px;
        }
        .ds-t-icon {
          width:34px; height:34px; border-radius:9px;
          background:linear-gradient(135deg,#4f46e5,#7c3aed);
          display:flex; align-items:center; justify-content:center;
          color:#fff; flex-shrink:0;
        }
        .ds-breadcrumb { font-size:12px; color:#94a3b8; }

        /* Grid */
        .ds-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        @media(max-width:640px){ .ds-grid { grid-template-columns:1fr; } }
        .ds-full { grid-column:1/-1; }

        /* Card */
        .ds-card {
          background:#fff; border:1px solid #e2e8f0;
          border-radius:14px; padding:22px;
          box-shadow:0 1px 4px rgba(0,0,0,.05);
          animation:ds-fadein .35s ease;
        }

        /* Card header */
        .ds-ch { display:flex; align-items:center; gap:9px; margin-bottom:16px; padding-bottom:13px; border-bottom:1px solid #f1f5f9; }
        .ds-ch-icon { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
        .ds-ch h3 { font-size:13px; font-weight:700; color:#1e293b; flex:1; }

        /* Badges */
        .ds-badge { font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }
        .ds-green  { background:#dcfce7; color:#15803d; }
        .ds-red    { background:#fee2e2; color:#dc2626; }
        .ds-indigo { background:#e0e7ff; color:#4338ca; }

        /* URL display */
        .ds-url-box {
          background:linear-gradient(135deg,#f8fafc,#f1f5f9);
          border:1px solid #e2e8f0; border-radius:11px;
          padding:14px 16px; margin-bottom:14px;
          display:flex; align-items:center; gap:11px;
        }
        .ds-url-orb {
          width:38px; height:38px; border-radius:9px;
          background:linear-gradient(135deg,#4f46e5,#7c3aed);
          display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;
        }
        .ds-url-main { font-size:13px; font-weight:700; color:#4338ca; word-break:break-all; }
        .ds-url-meta { font-size:11px; color:#94a3b8; margin-top:2px; }

        /* Copy btn */
        .ds-copy {
          display:inline-flex; align-items:center; gap:5px;
          background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px;
          padding:6px 11px; font-size:12px; font-weight:500; color:#64748b;
          cursor:pointer; transition:all .15s; white-space:nowrap; flex-shrink:0;
        }
        .ds-copy:hover { background:#ede9fe; border-color:#a5b4fc; color:#4338ca; }
        .ds-copy.ok    { background:#dcfce7; border-color:#86efac; color:#15803d; }

        /* Info rows */
        .ds-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f8fafc; font-size:13px; }
        .ds-row:last-of-type { border-bottom:none; }
        .ds-rl { color:#94a3b8; font-weight:500; }
        .ds-rv { color:#1e293b; font-weight:600; }

        /* Button row */
        .ds-btn-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
        .ds-btn {
          display:inline-flex; align-items:center; gap:6px;
          border:none; border-radius:8px; font-size:12px; font-weight:600;
          padding:8px 15px; cursor:pointer; transition:all .15s; white-space:nowrap;
        }
        .ds-btn:disabled { opacity:.45; cursor:not-allowed; }
        .ds-primary { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 2px 6px rgba(99,102,241,.3); }
        .ds-primary:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
        .ds-ghost  { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
        .ds-ghost:hover:not(:disabled)  { background:#e0e7ff; color:#4338ca; border-color:#a5b4fc; }
        .ds-danger { background:#fff; color:#dc2626; border:1px solid #fecaca; }
        .ds-danger:hover:not(:disabled) { background:#fee2e2; }
        .ds-success{ background:linear-gradient(135deg,#15803d,#16a34a); color:#fff; }
        .ds-success:hover:not(:disabled){ opacity:.88; }

        /* Empty state */
        .ds-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:36px 16px; grid-column:1/-1; }
        .ds-empty-orb { width:68px; height:68px; border-radius:18px; background:linear-gradient(135deg,#e0e7ff,#ede9fe); display:flex; align-items:center; justify-content:center; margin-bottom:14px; color:#6366f1; }
        .ds-empty h3  { font-size:16px; font-weight:700; color:#1e293b; margin-bottom:6px; }
        .ds-empty p   { font-size:13px; color:#94a3b8; margin-bottom:20px; max-width:300px; line-height:1.6; }

        /* Input */
        .ds-input-wrap { display:flex; border:1.5px solid #e2e8f0; border-radius:9px; overflow:hidden; transition:border-color .18s; background:#fff; }
        .ds-input-wrap:focus-within { border-color:#6366f1; }
        .ds-affix { padding:0 11px; background:#f8fafc; display:flex; align-items:center; font-size:12px; color:#94a3b8; user-select:none; white-space:nowrap; border-right:1.5px solid #e2e8f0; }
        .ds-affix.r { border-right:none; border-left:1.5px solid #e2e8f0; }
        .ds-input { flex:1; border:none; outline:none; padding:11px 13px; font-size:14px; font-weight:700; color:#1e293b; background:transparent; min-width:0; }
        .ds-input::placeholder { color:#cbd5e1; font-weight:400; }

        /* Avail hint */
        .ds-avail { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:500; margin-top:6px; }

        /* Tip */
        .ds-tip { background:#f0f9ff; border:1px solid #bae6fd; border-radius:9px; padding:11px 14px; font-size:12px; color:#0369a1; line-height:1.6; margin-top:14px; }
        .ds-tip strong { display:block; margin-bottom:2px; }

        /* Skeleton */
        .ds-skel { height:160px; border-radius:14px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:400%; animation:ds-shimmer 1.4s ease infinite; }

        /* Modal */
        .ds-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:9999; animation:ds-fadein .2s ease; }
        .ds-modal   { background:#fff; border-radius:16px; padding:26px; width:min(400px,90vw); box-shadow:0 20px 60px rgba(0,0,0,.15); }
        .ds-modal h3 { font-size:16px; font-weight:700; color:#1e293b; margin-bottom:7px; }
        .ds-modal p  { font-size:13px; color:#64748b; line-height:1.6; }
        .ds-modal-footer { display:flex; gap:8px; justify-content:flex-end; margin-top:20px; }

        /* Toast */
        .ds-toast { position:fixed; bottom:26px; right:26px; display:flex; align-items:center; gap:8px; background:#fff; border:1px solid; border-radius:11px; padding:11px 17px; font-size:13px; font-weight:500; z-index:10000; animation:ds-slide .28s ease; max-width:310px; box-shadow:0 8px 24px rgba(0,0,0,.11); }
        .ds-toast.success { border-color:#86efac; color:#15803d; }
        .ds-toast.error   { border-color:#fca5a5; color:#dc2626; }
      `}</style>

      {/* ROOT — no background, no min-height: fits LayoutMaster's <main> scroll area */}
      <div className="ds-wrap">

        {/* Title */}
        <div className="ds-title-row">
          <h2>
            <span className="ds-t-icon"><GlobeIcon size={15} /></span>
            Domain Settings
          </h2>
          <span className="ds-breadcrumb">Settings → Domain Management</span>
        </div>

        {/* ── LOADING ── */}
        {loading ? (
          <div className="ds-grid">
            <div className="ds-skel" />
            <div className="ds-skel" />
          </div>

        ) : domain ? (
          /* ══ HAS DOMAIN ══ */
          <div className="ds-grid">

            {/* Card A — Portal URL */}
            <div className="ds-card">
              <div className="ds-ch">
                <div className="ds-ch-icon" style={{background:"#ede9fe"}}>🌐</div>
                <h3>Your Portal URL</h3>
                <span className={`ds-badge ${domain.isActive ? "ds-green" : "ds-red"}`}>
                  {domain.isActive ? "Active" : "Disabled"}
                </span>
              </div>

              <div className="ds-url-box">
                <div className="ds-url-orb"><GlobeIcon size={16} /></div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="ds-url-main">https://{domain.subdomain}.{BASE_DOMAIN}</div>
                  <div className="ds-url-meta">{domain.companyName}</div>
                </div>
                <button className={`ds-copy ${copied ? "ok" : ""}`} onClick={handleCopy}>
                  <CopyIcon />{copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="ds-tip">
                <strong>🔗 Share with your team</strong>
                Employees log in directly at your company portal instead of the main site.
              </div>
            </div>

            {/* Card B — Details + Actions */}
            <div className="ds-card">
              <div className="ds-ch">
                <div className="ds-ch-icon" style={{background:"#e0e7ff"}}>📋</div>
                <h3>Domain Details</h3>
              </div>

              <div className="ds-row">
                <span className="ds-rl">Company</span>
                <span className="ds-rv">{domain.companyName}</span>
              </div>
              <div className="ds-row">
                <span className="ds-rl">Subdomain</span>
                <span className="ds-rv" style={{color:"#4338ca"}}>{domain.subdomain}</span>
              </div>
              <div className="ds-row">
                <span className="ds-rl">Status</span>
                <span className={`ds-badge ${domain.isActive ? "ds-green" : "ds-red"}`}>
                  {domain.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="ds-row">
                <span className="ds-rl">Created</span>
                <span className="ds-rv">{new Date(domain.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>
              </div>

              {mode === "idle" && (
                <div className="ds-btn-row">
                  <button className="ds-btn ds-ghost" onClick={startEdit}><EditIcon /> Change</button>
                  {domain.isActive
                    ? <button className="ds-btn ds-danger" onClick={() => setConfirm(true)}><TrashIcon /> Disable</button>
                    : <button className="ds-btn ds-success" onClick={handleEnable} disabled={actionLoading}>{actionLoading ? <SpinnerIcon/> : <RefreshIcon/>} Re-enable</button>
                  }
                </div>
              )}
            </div>

            {/* Card C — Edit form (full-width, only in edit mode) */}
            {mode === "edit" && (
              <div className="ds-card ds-full" style={{animation:"ds-fadein .25s ease"}}>
                <div className="ds-ch">
                  <div className="ds-ch-icon" style={{background:"#fef9c3"}}>✏️</div>
                  <h3>Change Subdomain</h3>
                </div>

                <label style={{fontSize:"11px",fontWeight:"700",color:"#64748b",display:"block",marginBottom:"7px",letterSpacing:".06em"}}>
                  NEW SUBDOMAIN
                </label>
                <div className="ds-input-wrap" style={{borderColor: inputBorderColor}}>
                  <span className="ds-affix">https://</span>
                  <input className="ds-input" value={subInput}
                    onChange={e => setSubInput(e.target.value.toLowerCase().replace(/\s/g,""))}
                    placeholder="newname" autoFocus />
                  <span className="ds-affix r">.{BASE_DOMAIN}</span>
                </div>

                {subInput.length >= 2 && (
                  <div className="ds-avail" style={{color: availColor}}>
                    {availability === "checking" && <><SpinnerIcon /> Checking…</>}
                    {availability === "available" && <><CheckCircleIcon /> Available</>}
                    {availability === "taken"     && <><XCircleIcon /> Already taken</>}
                    {availability === "invalid"   && <><XCircleIcon /> Invalid format</>}
                  </div>
                )}

                <div className="ds-btn-row">
                  <button className="ds-btn ds-primary" onClick={handleUpdate}
                    disabled={availability !== "available" || actionLoading}>
                    {actionLoading ? <SpinnerIcon /> : <CheckCircleIcon />} Save Changes
                  </button>
                  <button className="ds-btn ds-ghost" onClick={cancelMode}>Cancel</button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ══ NO DOMAIN YET ══ */
          <div className="ds-grid">
            {mode !== "create" ? (
              <div className="ds-empty">
                <div className="ds-empty-orb"><GlobeIcon size={26} /></div>
                <h3>No subdomain yet</h3>
                <p>
                  Claim your company's dedicated portal URL. Employees will log in at&nbsp;
                  <strong style={{color:"#4338ca"}}>yourcompany.{BASE_DOMAIN}</strong>
                </p>
                <button className="ds-btn ds-primary" onClick={() => setMode("create")}>
                  <LinkIcon /> Claim Your Subdomain
                </button>
              </div>
            ) : (
              <div className="ds-card ds-full">
                <div className="ds-ch">
                  <div className="ds-ch-icon" style={{background:"#e0e7ff"}}>🌐</div>
                  <h3>Claim Your Company Subdomain</h3>
                </div>

                <label style={{fontSize:"11px",fontWeight:"700",color:"#64748b",display:"block",marginBottom:"7px",letterSpacing:".06em"}}>
                  CHOOSE SUBDOMAIN
                </label>
                <div className="ds-input-wrap" style={{borderColor: inputBorderColor}}>
                  <span className="ds-affix">https://</span>
                  <input className="ds-input" value={subInput}
                    onChange={e => setSubInput(e.target.value.toLowerCase().replace(/\s/g,""))}
                    placeholder="yourcompany" autoFocus />
                  <span className="ds-affix r">.{BASE_DOMAIN}</span>
                </div>

                {subInput.length >= 2 && (
                  <div className="ds-avail" style={{color: availColor}}>
                    {availability === "checking" && <><SpinnerIcon /> Checking availability…</>}
                    {availability === "available" && <><CheckCircleIcon /> Available — looks great!</>}
                    {availability === "taken"     && <><XCircleIcon /> Already taken, try another</>}
                    {availability === "invalid"   && <><XCircleIcon /> Lowercase letters, numbers & hyphens only</>}
                  </div>
                )}

                <div className="ds-tip">
                  <strong>💡 Tips</strong>
                  Use your short brand name. E.g.: <em>acmecorp</em>, <em>zero7-hr</em>, <em>techwave</em>
                </div>

                <div className="ds-btn-row">
                  <button className="ds-btn ds-primary" onClick={handleCreate}
                    disabled={availability !== "available" || actionLoading}>
                    {actionLoading ? <SpinnerIcon /> : <CheckCircleIcon />} Create Subdomain
                  </button>
                  <button className="ds-btn ds-ghost" onClick={cancelMode}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Confirm disable modal ── */}
      {confirmDisable && (
        <div className="ds-overlay" onClick={() => setConfirm(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <h3>⚠️ Disable Domain?</h3>
            <p>
              Access via <strong style={{color:"#dc2626"}}>{domain?.subdomain}.{BASE_DOMAIN}</strong> will be
              blocked immediately. Your team won't be able to use the portal until you re-enable it.
            </p>
            <div className="ds-modal-footer">
              <button className="ds-btn ds-ghost" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="ds-btn ds-danger" onClick={handleDisable} disabled={actionLoading}>
                {actionLoading ? <SpinnerIcon /> : <TrashIcon />} Yes, Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`ds-toast ${toast.type}`}>
          {toast.type === "success" ? <CheckCircleIcon /> : <XCircleIcon />}
          {toast.msg}
        </div>
      )}
    </>
  );
}
// --- END OF FILE pages/DomainSettings.jsx ---