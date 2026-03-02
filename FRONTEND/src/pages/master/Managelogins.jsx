import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api"; // your configured axios instance
import Swal from "sweetalert2";

/* ──────────────────────────────────────────────
   TINY HELPERS
────────────────────────────────────────────── */
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const isPlanExpired = (expiresAt) =>
  expiresAt ? new Date() > new Date(expiresAt) : false;

const getDaysAgo = (date) => {
  if (!date) return "";
  const diffTime = Math.abs(new Date() - new Date(date));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `(${diffDays} days ago)`;
};

/* ──────────────────────────────────────────────
   TOGGLE COMPONENT
────────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none 
        ${checked ? "bg-emerald-500" : "bg-gray-300"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Badge({ active, label, variant = "status" }) {
  const styles = variant === "danger" 
    ? "bg-rose-100 text-rose-700" 
    : (active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600");

  const dot = variant === "danger" ? "bg-rose-500" : (active ? "bg-emerald-500" : "bg-red-500");

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles}`}>
      <span className={`w-1 h-1 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────────── */
export default function ManageLogins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); 
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [pendingChanges, setPendingChanges] = useState({});

  /* ── SWEET ALERT HELPERS ── */
  const toast = (message, icon = "success") => {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      icon,
      title: message,
    });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/admin/login-access");
      setAdmins(data);
    } catch (err) {
      toast("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleAdmin = (adminId, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [adminId]: { ...prev[adminId], loginEnabled: value }
    }));
  };

  const handleToggleEmployees = (adminId, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [adminId]: { ...prev[adminId], employeesLoginEnabled: value }
    }));
  };

  const getAdminLogin = (admin) => pendingChanges[admin.id]?.loginEnabled ?? admin.loginEnabled;

  const getEmployeeLogin = (admin, adminOn) => {
    if (!adminOn) return false; 
    if (pendingChanges[admin.id]?.employeesLoginEnabled !== undefined) return pendingChanges[admin.id].employeesLoginEnabled;
    if (admin.totalEmployees === 0) return false;
    return admin.disabledEmployees < admin.totalEmployees;
  };

  const handleSave = async (adminId) => {
    const changes = pendingChanges[adminId];
    if (!changes) return;
    const admin = admins.find((a) => a.id === adminId);
    const willDisableAdmin = changes.loginEnabled === false && admin.loginEnabled !== false;

    const doSave = async () => {
      setSaving((prev) => ({ ...prev, [adminId]: true }));
      try {
        const promises = [];
        if (changes.loginEnabled !== undefined) promises.push(api.patch(`/api/admin/login-access/admin/${adminId}`, { loginEnabled: changes.loginEnabled }));
        if (changes.employeesLoginEnabled !== undefined) promises.push(api.patch(`/api/admin/login-access/employees/${adminId}`, { loginEnabled: changes.employeesLoginEnabled }));
        await Promise.all(promises);
        setAdmins((prev) => prev.map((a) => (a.id !== adminId ? a : {
          ...a,
          loginEnabled: changes.loginEnabled ?? a.loginEnabled,
          disabledEmployees: changes.employeesLoginEnabled === false ? a.totalEmployees : (changes.employeesLoginEnabled === true ? 0 : a.disabledEmployees),
        })));
        setPendingChanges((prev) => { const n = { ...prev }; delete n[adminId]; return n; });
        toast("Changes saved successfully!");
      } catch (err) {
        toast("Failed to save changes.", "error");
      } finally {
        setSaving((prev) => ({ ...prev, [adminId]: false }));
      }
    };

    if (willDisableAdmin) {
      Swal.fire({
        title: "Stop Admin Login?",
        text: `Disabling "${admin.name}" will also block all staff members immediately.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Yes, Stop Login"
      }).then((result) => { if (result.isConfirmed) doSave(); });
    } else {
      doSave();
    }
  };

  /* ── DATA COMPUTATION ── */
  const stats = useMemo(() => ({
    all: admins.length,
    active: admins.filter(a => a.loginEnabled !== false && !isPlanExpired(a.planExpiresAt)).length,
    blocked: admins.filter(a => a.loginEnabled === false).length,
    expired: admins.filter(a => isPlanExpired(a.planExpiresAt)).length,
  }), [admins]);

  const uniquePlans = useMemo(() => ["All Plans", ...new Set(admins.map(a => a.plan).filter(Boolean))], [admins]);

  const violations = useMemo(() => {
    return admins.filter(a => isPlanExpired(a.planExpiresAt) && a.disabledEmployees < a.totalEmployees && a.totalEmployees > 0);
  }, [admins]);

  const filtered = admins.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "All Plans" || a.plan === planFilter;
    const isExpired = isPlanExpired(a.planExpiresAt);
    let matchesStatus = true;
    if (activeFilter === "active") matchesStatus = a.loginEnabled !== false && !isExpired;
    if (activeFilter === "blocked") matchesStatus = a.loginEnabled === false;
    if (activeFilter === "expired") matchesStatus = isExpired;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        
        {/* ── COUNTS / STATS ── */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { id: "all", label: "Total Accounts", value: stats.all, icon: "👥", color: "blue" },
              { id: "active", label: "Active Access", value: stats.active, icon: "✅", color: "emerald" },
              { id: "blocked", label: "Blocked", value: stats.blocked, icon: "🚫", color: "rose" },
              { id: "expired", label: "Expired Plan", value: stats.expired, icon: "⌛", color: "amber" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveFilter(s.id); setSearch(""); }}
                className={`text-left transition-all duration-200 bg-white p-5 rounded-2xl border-2 relative overflow-hidden shadow-sm
                  ${activeFilter === s.id ? `border-${s.color}-500 ring-4 ring-${s.color}-50` : "border-transparent hover:border-gray-200"}`}
              >
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{s.value}</p>
                  </div>
                  <span className="text-2xl opacity-80">{s.icon}</span>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 w-full bg-${s.color}-500 ${activeFilter === s.id ? "opacity-100" : "opacity-10"}`} />
              </button>
            ))}
          </div>
        )}

        {/* ── SEPARATE FRAME: STAFF LOGIN VIOLATIONS ── */}
        {!loading && violations.length > 0 && (
          <div className="mb-8 bg-white border-2 border-rose-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-rose-50 px-6 py-3 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚨</span>
                <h2 className="text-xs font-black text-rose-700 uppercase tracking-widest">Identify Violations: Staff active on Expired Plans</h2>
              </div>
              <span className="bg-rose-200 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">{violations.length} ACCOUNTS</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {violations.map(v => (
                <div 
                  key={v.id} 
                  onClick={() => { setSearch(v.email); setActiveFilter("all"); setPlanFilter("All Plans"); }}
                  className="bg-rose-50/30 border border-rose-100 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/50 transition-colors group"
                >
                   <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate group-hover:text-rose-600 transition-colors">{v.name}</p>
                      <p className="text-[10px] text-rose-500 font-black">
                        {formatDate(v.planExpiresAt)} <span className="ml-1 opacity-70">{getDaysAgo(v.planExpiresAt)}</span>
                      </p>
                   </div>
                   <div className="text-right shrink-0">
                      <p className="text-[9px] font-black text-gray-400">STAFF ACTIVE</p>
                      <p className="text-sm font-black text-rose-600">{v.totalEmployees - v.disabledEmployees}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH & PLAN FILTER ── */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-1 shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase ml-2">Select Plan:</span>
            <select 
              value={planFilter} 
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-sm font-bold text-gray-700 outline-none bg-transparent py-2 cursor-pointer min-w-[140px]"
            >
              {uniquePlans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </div>
        </div>

        {/* ── MAIN LIST AREA ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <p className="text-gray-400 font-medium">No results found.</p>
            <button onClick={() => {setSearch(""); setPlanFilter("All Plans"); setActiveFilter("all");}} className="mt-2 text-blue-600 text-sm font-bold uppercase tracking-widest">Reset Filters</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((admin) => {
              const adminOn = getAdminLogin(admin);
              const empOn = getEmployeeLogin(admin, adminOn); 
              const expired = isPlanExpired(admin.planExpiresAt);
              const hasPending = !!pendingChanges[admin.id];

              return (
                <div key={admin.id} className={`bg-white rounded-2xl border transition-all duration-200 ${hasPending ? "border-blue-400 shadow-md ring-1 ring-blue-50" : "border-gray-200 shadow-sm hover:border-gray-300"}`}>
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-lg font-bold ${adminOn ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                        {admin.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 truncate">{admin.name}</h3>
                          <Badge active={adminOn} label={adminOn ? "Admin Active" : "Admin Disabled"} />
                          {expired && <Badge variant="danger" label={`Plan jExpired`} />}
                        </div>
                        <p className="text-xs text-gray-500 mb-3 truncate">{admin.email}</p>
                        <div className="flex flex-wrap gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <span>Plan: <span className="text-gray-800">{admin.plan || "N/A"}</span></span>
                          <span>Expires: <span className={expired ? "text-rose-500" : "text-gray-800"}>{formatDate(admin.planExpiresAt)}</span></span>
                          <span>Staff Total: <span className="text-gray-800">{admin.totalEmployees}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 shrink-0">
                      <div className="flex items-center gap-3 px-3 border-r border-slate-200">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Admin</span>
                        <Toggle checked={adminOn} onChange={(v) => handleToggleAdmin(admin.id, v)} disabled={saving[admin.id]} />
                      </div>
                      <div className="flex items-center gap-3 px-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Staff</span>
                        <Toggle checked={empOn} onChange={(v) => handleToggleEmployees(admin.id, v)} disabled={saving[admin.id] || admin.totalEmployees === 0 || !adminOn} />
                      </div>
                      <button
                        onClick={() => handleSave(admin.id)}
                        disabled={!hasPending || saving[admin.id]}
                        className={`ml-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${hasPending ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                      >
                        {saving[admin.id] ? "..." : "SAVE"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}